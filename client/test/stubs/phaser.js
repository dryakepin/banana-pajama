/**
 * Minimal stand-in for the `phaser` package.
 *
 * Scene classes in src/scenes/ use Phaser for one thing at module load:
 * `extends Phaser.Scene`. Sprite classes need `Phaser.Physics.Arcade.Sprite`.
 * Everything else they touch (this.add, this.input, this.time, this.cameras)
 * is injected by the engine at runtime, so tests supply those directly.
 *
 * WHAT THIS DOES AND DOES NOT COVER
 *
 * The Sprite base below is a behavioural stub: setters record state so tests
 * can assert on it, but there is no rendering, no real physics integration and
 * no display list.
 *
 * Crucially, this stub is NOT used for group semantics. `Group.add()` silently
 * dropping a child at maxSize is the entire mechanism behind GAME-1, and a
 * stub that reimplemented it would only prove the stub agrees with itself.
 * test/pooling.test.js therefore imports the REAL Phaser Group
 * (`phaser/src/gameobjects/group/Group.js`), which loads standalone under
 * jsdom, and drives it with these stub sprites.
 */

class EventEmitterish {
    constructor() { this._events = new Map(); }
    on(event, fn, ctx) {
        if (!this._events.has(event)) this._events.set(event, []);
        this._events.get(event).push({ fn, ctx });
        return this;
    }
    once(event, fn, ctx) { return this.on(event, fn, ctx); }
    off(event) { this._events.delete(event); return this; }
    removeAllListeners() { this._events.clear(); return this; }
    emit(event, ...args) {
        const handlers = this._events.get(event) || [];
        for (const { fn, ctx } of handlers.slice()) fn.apply(ctx, args);
        return this;
    }
}

class Sprite extends EventEmitterish {
    constructor(scene, x = 0, y = 0, texture = null) {
        super();
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.texture = texture;
        this.active = true;
        this.visible = true;
        this.alpha = 1;
        this.tint = 0xffffff;
        this.scale = 1;
        this.flipX = false;
        this.depth = 0;
        this.width = 100;
        this.height = 100;
        this.displayList = null;

        this.body = {
            enable: true,
            velocity: { x: 0, y: 0 },
            setSize() { return this; },
            setOffset() { return this; },
            setCircle() { return this; },
            setMass() { return this; },
            setDrag() { return this; },
            setMaxVelocity() { return this; },
            setAllowGravity() { return this; },
        };
    }

    setActive(v) { this.active = v; return this; }
    setVisible(v) { this.visible = v; return this; }
    setAlpha(v) { this.alpha = v; return this; }
    setTint(v) { this.tint = v; return this; }
    clearTint() { this.tint = 0xffffff; return this; }
    setScale(v) { this.scale = v; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setTexture(t) { this.texture = t; return this; }
    setFlipX(v) { this.flipX = v; return this; }
    setDepth(v) { this.depth = v; return this; }
    setOrigin() { return this; }
    setCollideWorldBounds() { return this; }
    setBounce() { return this; }
    setImmovable() { return this; }
    setAngle() { return this; }
    setRotation() { return this; }
    setVelocity(x = 0, y = 0) { this.body.velocity.x = x; this.body.velocity.y = y; return this; }
    setVelocityX(x) { this.body.velocity.x = x; return this; }
    setVelocityY(y) { this.body.velocity.y = y; return this; }
    play() { return this; }
    stop() { return this; }
    anims = { play: () => this, stop: () => this, currentAnim: null };

    // Called by the real Group.create(); both are no-ops here but must exist.
    addToDisplayList() { return this; }
    addToUpdateList() { return this; }
    removeFromDisplayList() { return this; }

    destroy() {
        this.destroyed = true;
        this.active = false;
        this.visible = false;
        this.emit('destroy', this);
        return this;
    }
}

const Phaser = {
    Scene: class Scene {
        constructor(config) { this.sys = { config }; }
    },
    Physics: { Arcade: { Sprite } },
    GameObjects: { Sprite },
    Math: {
        Between: (min, max) => Math.floor((min + max) / 2),
        FloatBetween: (min, max) => (min + max) / 2,
        Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) },
        Angle: { Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) },
        Clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
    },
};

module.exports = Phaser;
module.exports.default = Phaser;
module.exports.Scene = Phaser.Scene;
module.exports.Physics = Phaser.Physics;
