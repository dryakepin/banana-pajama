/**
 * GAME-4 -- per-round state must not survive into the next round.
 *
 * Phaser reuses the same Scene instance across scene.start('GameScene'), so
 * anything initialised in the constructor persists for the lifetime of the
 * page, not the lifetime of a round. create() reset only score, gameTime and
 * hp; everything else carried over.
 *
 * The visible harm is that zombiesKilled accumulates across rounds and is then
 * submitted to the leaderboard -- the same class of bad data as DATA-1.
 */

const GameScene = require('../src/scenes/GameScene.js').default;

// Every constructor-initialised field that describes "this round" rather than
// "this scene". Deliberately an explicit list: a new field added to the
// constructor should be a conscious decision about which side it falls on.
const PER_ROUND_FIELDS = [
    'score',
    'gameTime',
    'hp',
    'zombiesKilled',
    'lastShotTime',
    'difficultyLevel',
    'zombieSpeedMultiplier',
    'zombieHpMultiplier',
    'isInvincible',
    'invincibilityEndTime',
    'rapidFireActive',
    'rapidFireEndTime',
    'dualShotActive',
    'dualShotEndTime',
    'isPaused',
    'powerUpIndicators',
    'joystickPointerId',
    'aimingPointerId',
];

// Values a real round leaves behind: 37 kills, difficulty level 5, an active
// power-up, and paused at the moment of death.
function playARound(scene) {
    for (let i = 0; i < 37; i++) scene.addZombieKill();
    scene.addScore(1250);
    scene.gameTime = 152;
    scene.hp = 15;
    scene.lastShotTime = 98765;
    scene.difficultyLevel = 5;
    scene.zombieSpeedMultiplier = 1.5;
    scene.zombieHpMultiplier = 1.8;
    scene.isInvincible = true;
    scene.invincibilityEndTime = 99999;
    scene.rapidFireActive = true;
    scene.rapidFireEndTime = 99999;
    scene.dualShotActive = true;
    scene.dualShotEndTime = 99999;
    scene.isPaused = true;
    scene.powerUpIndicators = { rapidFire: {}, dualShot: {} };
    scene.joystickPointerId = 3;
    scene.aimingPointerId = 4;
}

// gameOver() reaches for the engine on its way to scene.start. None of that is
// what we are testing, so it is stubbed just enough to run.
function stubEngine(scene) {
    const started = [];
    scene.input = { setDefaultCursor() {} };
    scene.sound = { stopAll() {} };
    scene.scene = { start: (key, data) => started.push({ key, data }) };
    scene.tileMap = null;
    scene.virtualJoystick = null;
    scene._audio = null;
    scene.zombieSpawnTimer = null;
    scene.tankZombieSpawnTimer = null;
    scene.fastZombieSpawnTimer = null;
    scene.animatedZombieSpawnTimer = null;
    return started;
}

describe('GAME-4: state reset between rounds', () => {
    test('a second round does not inherit the first round kill count', () => {
        const scene = new GameScene();
        const started = stubEngine(scene);

        for (let i = 0; i < 37; i++) scene.addZombieKill();
        scene.gameOver();
        expect(started[0].data.zombiesKilled).toBe(37);

        // Simulate what Phaser does on scene.start('GameScene'): call the
        // scene's init() hook if it has one. Written with ?. on purpose --
        // before the fix there is no hook, so this is a no-op and the test
        // fails on the accumulated count rather than on a missing method.
        scene.init?.();

        for (let i = 0; i < 5; i++) scene.addZombieKill();
        scene.gameOver();

        // Without a reset this is 42, and 42 is what reaches the leaderboard.
        expect(started[1].data.zombiesKilled).toBe(5);
    });

    test('every per-round field returns to its initial value', () => {
        const pristine = new GameScene();
        const baseline = {};
        for (const field of PER_ROUND_FIELDS) baseline[field] = pristine[field];

        const scene = new GameScene();
        playARound(scene);

        // Guard against a vacuous test: the round must actually have changed
        // every field, or "it was reset" proves nothing.
        for (const field of PER_ROUND_FIELDS) {
            expect(scene[field]).not.toEqual(baseline[field]);
        }

        scene.init();

        for (const field of PER_ROUND_FIELDS) {
            expect({ [field]: scene[field] }).toEqual({ [field]: baseline[field] });
        }
    });

    test('a new round starts at difficulty level 0 with no multipliers', () => {
        const scene = new GameScene();
        scene.difficultyLevel = 9;
        scene.zombieSpeedMultiplier = 1.8;
        scene.zombieHpMultiplier = 2.2;

        scene.init();

        // GAME-3 fixed multipliers compounding on pooled reuse within a round.
        // Carrying them across rounds compounds them again, one round later.
        expect(scene.difficultyLevel).toBe(0);
        expect(scene.zombieSpeedMultiplier).toBe(1);
        expect(scene.zombieHpMultiplier).toBe(1);
    });

    test('a round that ended while paused does not start paused', () => {
        const scene = new GameScene();
        scene.isPaused = true;

        scene.init();

        expect(scene.isPaused).toBe(false);
    });
});
