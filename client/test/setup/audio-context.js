// zzfx (pulled in by src/utils/SoundEffects.js) constructs an AudioContext at
// module load. Neither node nor jsdom provides one, so anything that imports a
// sprite would fail on import alone. This stub exists purely to let the module
// graph load; no test asserts on audio behaviour.
class StubAudioContext {
    constructor() {
        this.sampleRate = 44100;
        this.currentTime = 0;
        this.destination = {};
        this.state = 'running';
    }
    createBuffer() { return { getChannelData: () => new Float32Array(0) }; }
    createBufferSource() {
        return { buffer: null, connect() {}, start() {}, stop() {}, addEventListener() {} };
    }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
}

global.AudioContext = StubAudioContext;
global.webkitAudioContext = StubAudioContext;

// Phaser's device/feature detection calls HTMLCanvasElement.getContext('2d')
// at import time. jsdom does not implement it without the native `canvas`
// package, so test/pooling.test.js (which loads the real Phaser Group) needs
// this shim. Guarded because the other suites run in the node environment,
// where there is no HTMLCanvasElement to patch.
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    require('jest-canvas-mock');
}
