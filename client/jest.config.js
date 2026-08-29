module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/**/*.test.js'],
    setupFiles: ['<rootDir>/test/setup/audio-context.js'],

    // The real Phaser is a browser engine: it touches canvas, WebGL and the DOM
    // at import time and would need jsdom plus a lot of shimming to load here.
    // Scene classes only need `Phaser.Scene` to extend, so a small stub is both
    // faster and more honest about what these tests cover -- see the note in
    // test/stubs/phaser.js about what this deliberately does NOT verify.
    moduleNameMapper: {
        '^phaser$': '<rootDir>/test/stubs/phaser.js',
    },

    // zzfx ships untranspiled ES modules, and jest skips node_modules when
    // transforming. SoundEffects imports it, so anything that reaches a sprite
    // pulls it in. Transform it rather than stubbing it out, so the import
    // graph under test stays the real one.
    transformIgnorePatterns: ['node_modules/(?!(zzfx)/)'],
};
