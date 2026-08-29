/**
 * @jest-environment jsdom
 *
 * Regression tests for GAME-1, GAME-2 and GAME-3 — the object pooling cluster.
 *
 * These use the REAL Phaser Group implementation, not a stub. That matters:
 * GAME-1 exists entirely because `Group.add()` returns early when the group is
 * at maxSize, and a hand-written stub that reimplemented that rule would only
 * prove the stub agrees with itself. The real Group loads standalone under
 * jsdom (it pulls in Phaser's device detection, which needs `window`), so we
 * get authentic semantics without booting the engine — a full Phaser.Game never
 * reaches create() under jsdom because the texture manager waits on Image
 * onload events that never fire.
 *
 * The sprites are the real BasicZombie / AnimatedZombie / Bullet classes,
 * extending the stub Sprite base from test/stubs/phaser.js.
 */

const Group = require('phaser/src/gameobjects/group/Group.js');

import BasicZombie from '../src/sprites/BasicZombie.js';
import TankZombie from '../src/sprites/TankZombie.js';
import FastZombie from '../src/sprites/FastZombie.js';
import AnimatedZombie from '../src/sprites/AnimatedZombie.js';
import Bullet from '../src/sprites/Bullet.js';
import GameScene from '../src/scenes/GameScene.js';

/** Timers fired manually so death delays do not need real time. */
let pendingTimers = [];

function makeScene() {
    const scene = {
        sys: {
            displayList: { exists: () => false, add() {}, queueDepthSort() {}, events: { emit() {} } },
            updateList: { add() {}, remove() {} },
            queueDepthSort() {},
        },
        events: { on() {}, once() {}, off() {} },
        add: { existing() {}, graphics: () => ({ fillStyle() {}, fillCircle() {}, generateTexture() {}, destroy() {} }) },
        physics: { add: { existing() {} } },
        textures: { exists: () => true },
        anims: { exists: () => true, create() {}, generateFrameNames: () => [] },
        time: { delayedCall: (ms, fn) => { pendingTimers.push(fn); return { destroy() {}, remove() {} }; } },
        tweens: { add: (cfg) => { if (cfg.onComplete) pendingTimers.push(cfg.onComplete); return {}; }, killTweensOf() {} },
        cameras: { main: { width: 800, height: 600, scrollX: 0, scrollY: 0 } },
        spawnPowerUp() {},
        damagePlayer() {},
        killAllZombies() {},
        addScore() {},
        addZombieKill() {},
    };
    return scene;
}

function runTimers() {
    const queued = pendingTimers;
    pendingTimers = [];
    queued.forEach((fn) => fn());
}

function makeGroup(scene, classType, maxSize) {
    return new Group(scene, null, { classType, maxSize });
}

/**
 * A GameScene with only the fields _spawnZombieOfType touches. Calling the real
 * method is the point — a reimplementation here would test nothing.
 */
function makeSpawner(scene, { speedMultiplier = 1, hpMultiplier = 1 } = {}) {
    const gs = Object.create(GameScene.prototype);
    gs.cameras = scene.cameras;
    gs.tileMap = null;
    gs.zombieSpeedMultiplier = speedMultiplier;
    gs.zombieHpMultiplier = hpMultiplier;
    return gs;
}

let scene;
let logSpy;
let errorSpy;

beforeEach(() => {
    pendingTimers = [];
    scene = makeScene();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
});

describe('the Phaser behaviour GAME-1 rests on', () => {
    // Pinning the engine contract itself. If a Phaser upgrade ever changed
    // this, the fix below would become unnecessary — or wrong — silently.
    it('Group.add() silently drops a child when the group is full', () => {
        const group = makeGroup(scene, BasicZombie, 2);
        group.add(new BasicZombie(scene, 0, 0));
        group.add(new BasicZombie(scene, 0, 0));
        expect(group.isFull()).toBe(true);

        const orphan = new BasicZombie(scene, 9, 9);
        group.add(orphan);

        expect(group.getLength()).toBe(2);
        expect(group.contains(orphan)).toBe(false);
    });

    it('Group.create() returns null when full instead of building an orphan', () => {
        const group = makeGroup(scene, BasicZombie, 1);
        expect(group.create(0, 0)).not.toBeNull();
        expect(group.create(0, 0)).toBeNull();
        expect(group.getLength()).toBe(1);
    });
});

describe('GAME-1 · spawning never creates an unkillable zombie', () => {
    it('stops spawning once the group is at maxSize', () => {
        const group = makeGroup(scene, BasicZombie, 3);
        const spawner = makeSpawner(scene);

        for (let i = 0; i < 25; i++) spawner._spawnZombieOfType(group);

        expect(group.getLength()).toBe(3);
    });

    // The heart of GAME-1: an orphan renders, pathfinds and damages the player
    // while sitting outside the group that bullet overlap and killAllZombies
    // both iterate. Every zombie that exists must be a group member.
    it('leaves no zombie outside the group', () => {
        const group = makeGroup(scene, BasicZombie, 4);
        const spawner = makeSpawner(scene);

        const constructed = [];
        const original = scene.physics.add.existing;
        scene.physics.add.existing = function (obj) { constructed.push(obj); return original.call(this, obj); };

        for (let i = 0; i < 20; i++) spawner._spawnZombieOfType(group);

        expect(constructed).toHaveLength(4);
        for (const zombie of constructed) {
            expect(group.contains(zombie)).toBe(true);
        }
    });

    it('recycles rather than growing the group once zombies die', () => {
        const group = makeGroup(scene, BasicZombie, 2);
        const spawner = makeSpawner(scene);

        spawner._spawnZombieOfType(group);
        spawner._spawnZombieOfType(group);
        expect(group.getLength()).toBe(2);

        group.children.entries[0].deactivate();
        spawner._spawnZombieOfType(group);

        expect(group.getLength()).toBe(2);
        expect(group.children.entries.every((z) => z.active)).toBe(true);
    });

    // Drives the real GameScene.shoot(). An orphaned bullet is excluded from
    // runChildUpdate, so its update() never runs: it never leaves the screen,
    // never returns to the pool, and accumulates for the rest of the round.
    it('applies the same rule to bullets fired from shoot()', () => {
        const group = makeGroup(scene, Bullet, 3);
        const gs = Object.create(GameScene.prototype);
        gs.bullets = group;
        gs.tileMap = null;
        gs.player = { x: 0, y: 0 };
        gs.rapidFireActive = false;
        gs.dualShotActive = false;
        gs.shotCooldown = 0;
        gs.lastShotTime = -Infinity;
        gs.time = { now: 1000, delayedCall: (ms, fn) => { pendingTimers.push(fn); return {}; } };

        const constructed = [];
        scene.physics.add.existing = (obj) => { constructed.push(obj); };

        for (let i = 0; i < 30; i++) {
            gs.time.now += 1000;
            gs.shoot(500, 500);
        }

        expect(group.getLength()).toBe(3);
        expect(constructed).toHaveLength(3);
        for (const bullet of constructed) {
            expect(group.contains(bullet)).toBe(true);
        }
    });
});

describe('GAME-2 · zombies deactivate instead of destroying', () => {
    // All four types, because three of them did not pool at all before this
    // change and AnimatedZombie was the only one that did.
    it.each([
        ['BasicZombie', BasicZombie],
        ['TankZombie', TankZombie],
        ['FastZombie', FastZombie],
        ['AnimatedZombie', AnimatedZombie],
    ])('%s.deactivate() leaves the sprite poolable', (_name, ZombieClass) => {
        const group = makeGroup(scene, ZombieClass, 5);
        const zombie = group.create(0, 0);

        zombie.deactivate();

        expect(zombie.active).toBe(false);
        expect(zombie.visible).toBe(false);
        expect(zombie.body.enable).toBe(false);
        expect(zombie.destroyed).toBeUndefined();      // NOT destroyed
        expect(group.contains(zombie)).toBe(true);      // still a member
        expect(group.getFirstDead(false)).toBe(zombie); // and findable for reuse
    });

    it('the death path deactivates rather than destroying', () => {
        const group = makeGroup(scene, BasicZombie, 5);
        const zombie = group.create(100, 100);

        zombie.die();
        runTimers();

        expect(zombie.destroyed).toBeUndefined();
        expect(zombie.active).toBe(false);
        expect(group.getLength()).toBe(1);
        expect(group.getFirstDead(false)).toBe(zombie);
    });

    it('reset() brings a deactivated zombie fully back', () => {
        const group = makeGroup(scene, BasicZombie, 5);
        const zombie = group.create(0, 0);

        zombie.deactivate();
        zombie.reset(42, 43);

        expect(zombie.active).toBe(true);
        expect(zombie.visible).toBe(true);
        expect(zombie.body.enable).toBe(true);
        expect(zombie.x).toBe(42);
        expect(zombie.y).toBe(43);
        expect(zombie.health).toBe(zombie.maxHealth);
    });

    // Bullet and PowerUp had the opposite bug: destroy() was overridden
    // WITHOUT calling super, so they could never actually be freed.
    it('Bullet.deactivate() pools it while destroy() still really destroys', () => {
        const group = makeGroup(scene, Bullet, 5);
        const bullet = group.create(0, 0);

        bullet.fire(0, 0, 10, 10);
        expect(bullet.active).toBe(true);

        bullet.deactivate();
        expect(bullet.active).toBe(false);
        expect(bullet.destroyed).toBeUndefined();

        bullet.destroy();
        expect(bullet.destroyed).toBe(true);
    });
});

describe('GAME-3 · difficulty multipliers do not compound across reuse', () => {
    it('records pristine base stats on construction', () => {
        const zombie = new BasicZombie(scene, 0, 0);
        expect(zombie.baseSpeed).toBe(zombie.speed);
        expect(zombie.baseMaxHealth).toBe(zombie.maxHealth);
    });

    it('gives a recycled zombie the same stats as a fresh one', () => {
        const group = makeGroup(scene, BasicZombie, 1);
        const spawner = makeSpawner(scene, { speedMultiplier: 1.25, hpMultiplier: 1.5 });

        spawner._spawnZombieOfType(group);
        const zombie = group.children.entries[0];
        const firstSpeed = zombie.speed;
        const firstHealth = zombie.maxHealth;

        for (let i = 0; i < 30; i++) {
            zombie.deactivate();
            spawner._spawnZombieOfType(group);
        }

        expect(zombie.speed).toBe(firstSpeed);
        expect(zombie.maxHealth).toBe(firstHealth);
    });

    // The concrete scenario from the finding: at level 10 the speed multiplier
    // is 1.25, and 20 reuses under the old in-place mutation reached ~1.25^20,
    // roughly 86x base speed. Pin the ceiling hard.
    it('never lets 20 reuses at level 10 run away', () => {
        const group = makeGroup(scene, AnimatedZombie, 1);
        const spawner = makeSpawner(scene, { speedMultiplier: 1.25, hpMultiplier: 1.35 });

        spawner._spawnZombieOfType(group);
        const zombie = group.children.entries[0];

        for (let i = 0; i < 20; i++) {
            zombie.deactivate();
            spawner._spawnZombieOfType(group);
        }

        expect(zombie.speed).toBeCloseTo(zombie.baseSpeed * 1.25, 6);
        expect(zombie.speed).toBeLessThan(zombie.baseSpeed * 1.3);
        expect(zombie.maxHealth).toBe(Math.ceil(zombie.baseMaxHealth * 1.35));
    });

    it('scales down again when the multiplier drops (a fresh round)', () => {
        const group = makeGroup(scene, BasicZombie, 1);
        const hard = makeSpawner(scene, { speedMultiplier: 1.5, hpMultiplier: 2 });

        hard._spawnZombieOfType(group);
        const zombie = group.children.entries[0];
        expect(zombie.speed).toBeCloseTo(zombie.baseSpeed * 1.5, 6);

        zombie.deactivate();
        const fresh = makeSpawner(scene, { speedMultiplier: 1, hpMultiplier: 1 });
        fresh._spawnZombieOfType(group);

        expect(zombie.speed).toBe(zombie.baseSpeed);
        expect(zombie.maxHealth).toBe(zombie.baseMaxHealth);
    });

    it('never rounds max health below 1', () => {
        const group = makeGroup(scene, BasicZombie, 1);
        const spawner = makeSpawner(scene, { speedMultiplier: 1, hpMultiplier: 0 });

        spawner._spawnZombieOfType(group);

        expect(group.children.entries[0].maxHealth).toBeGreaterThanOrEqual(1);
    });
});
