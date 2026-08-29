module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/**/*.test.js'],

    // The real Phaser is a browser engine: it touches canvas, WebGL and the DOM
    // at import time and would need jsdom plus a lot of shimming to load here.
    // Scene classes only need `Phaser.Scene` to extend, so a small stub is both
    // faster and more honest about what these tests cover -- see the note in
    // test/stubs/phaser.js about what this deliberately does NOT verify.
    moduleNameMapper: {
        '^phaser$': '<rootDir>/test/stubs/phaser.js',
    },
};
