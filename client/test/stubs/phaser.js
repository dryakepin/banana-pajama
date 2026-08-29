/**
 * Minimal stand-in for the `phaser` package.
 *
 * Scene classes in src/scenes/ use Phaser for exactly one thing at module load:
 * `extends Phaser.Scene`. Everything else they touch (this.add, this.input,
 * this.time, this.cameras) is injected by the engine at runtime, so tests
 * supply those directly as plain objects.
 *
 * IMPORTANT -- what this does NOT cover:
 * Because the engine is stubbed out, these tests cannot catch bugs that live in
 * Phaser's own semantics. GAME-1 in CODEBASE_REVIEW.md is exactly such a bug:
 * `Group.add()` silently rejects a sprite once the group is at maxSize, which
 * only a real Phaser group would demonstrate. Do not read a green client suite
 * as evidence that the gameplay layer is correct.
 */

class Scene {
    constructor(config) {
        this.sys = { config };
    }
}

const Phaser = {
    Scene,
    // Present so `new Phaser.Math.Vector2()` style calls do not explode if a
    // future test pulls in a module that uses them at import time.
    Math: {
        Between: (min, max) => Math.floor((min + max) / 2),
        Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) },
    },
};

module.exports = Phaser;
module.exports.default = Phaser;
module.exports.Scene = Scene;
