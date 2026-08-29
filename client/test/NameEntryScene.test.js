/**
 * Regression tests for DATA-1: duplicate high score submissions.
 *
 * Seven groups of duplicate rows (eight redundant rows out of 41) reached the
 * production leaderboard, each written within 0.7-2.8 seconds of its twin. The
 * cause was that submitScore() had no in-flight guard, and the
 * `this.input.keyboard.removeAllListeners()` call it did make silences only the
 * Phaser keyboard -- the SUBMIT button kept its pointerdown handler for the
 * whole network round-trip.
 *
 * The load-bearing assertion in this file is "exactly one POST". If it ever
 * fails, duplicate rows are reaching the leaderboard again.
 */

import NameEntryScene from '../src/scenes/NameEntryScene.js';

/** A Phaser game object stub that records whether it is currently interactive. */
function stubGameObject() {
    const obj = {
        interactive: true,
        alpha: 1,
        active: true,
        setOrigin: () => obj,
        setText: (t) => { obj.text = t; return obj; },
        setColor: (c) => { obj.color = c; return obj; },
        setStyle: () => obj,
        setVisible: () => obj,
        setAlpha: (a) => { obj.alpha = a; return obj; },
        setInteractive: () => { obj.interactive = true; return obj; },
        disableInteractive: () => { obj.interactive = false; return obj; },
        destroy: () => { obj.active = false; },
        on: () => obj,
    };
    return obj;
}

/**
 * Builds a scene with the engine-supplied plumbing faked out, wired the way
 * create() would leave it. Pending time.delayedCall callbacks are collected so
 * a test can fire them deliberately instead of waiting two real seconds.
 */
function buildScene() {
    const scene = new NameEntryScene();
    const timers = [];

    scene.cameras = { main: { width: 1280, height: 900 } };
    scene.add = { text: stubGameObject, rectangle: stubGameObject };
    scene.input = {
        keyboard: {
            enabled: true,
            on() {},
            removeAllListeners() {},
        },
    };
    scene.time = {
        delayedCall: (ms, fn) => { timers.push(fn); return {}; },
        addEvent: () => ({}),
    };

    scene.nameText = stubGameObject();
    scene.characterCountText = stubGameObject();
    scene.submitBtn = stubGameObject();
    scene.skipBtn = stubGameObject();
    scene.mobileInput = null;

    // Stubs for collaborators these tests are not exercising.
    scene.proceedToMenu = jest.fn();
    scene.showErrorMessage = jest.fn();
    scene.setupKeyboardInput = jest.fn();

    scene.init({ score: 500, time: 60, zombiesKilled: 40 });
    scene.playerName = 'Kaare';

    return { scene, timers, runTimers: () => timers.splice(0).forEach((fn) => fn()) };
}

/** Resolves only when the test calls release(), so a request can be held open. */
function pendingFetch() {
    let release;
    const fn = jest.fn(() => new Promise((resolve) => {
        release = () => resolve({
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { rank: 3 } }),
        });
    }));
    return { fn, release: () => release() };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

let logSpy;
let errorSpy;

beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    delete global.fetch;
});

describe('submitScore — one submission per score (DATA-1)', () => {
    it('posts exactly once when SUBMIT is clicked twice during the request', async () => {
        const { scene } = buildScene();
        const { fn, release } = pendingFetch();
        global.fetch = fn;

        scene.submitScore();
        await flush();
        scene.submitScore();   // the second click, while the first is still open
        await flush();

        expect(fn).toHaveBeenCalledTimes(1);
        release();
    });

    it('posts exactly once for ENTER followed by a SUBMIT click', async () => {
        const { scene } = buildScene();
        const { fn, release } = pendingFetch();
        global.fetch = fn;

        scene.submitScore();   // ENTER
        await flush();
        scene.submitScore();   // then the button
        await flush();

        expect(fn).toHaveBeenCalledTimes(1);
        release();
    });

    it('disables both buttons for the duration of the request', async () => {
        const { scene } = buildScene();
        const { fn, release } = pendingFetch();
        global.fetch = fn;

        expect(scene.submitBtn.interactive).toBe(true);

        scene.submitScore();
        await flush();

        expect(scene.submitBtn.interactive).toBe(false);
        expect(scene.skipBtn.interactive).toBe(false);
        // Dimmed as well, so the disabled state is visible and not just enforced.
        expect(scene.submitBtn.alpha).toBe(0.5);
        release();
    });

    it('ignores SKIP while a submission is in flight', async () => {
        const { scene } = buildScene();
        const { fn, release } = pendingFetch();
        global.fetch = fn;

        scene.submitScore();
        await flush();
        scene.skipScore();

        expect(scene.proceedToMenu).not.toHaveBeenCalled();
        release();
    });

    it('rejects an empty name without posting', async () => {
        const { scene } = buildScene();
        global.fetch = jest.fn();
        scene.playerName = '   ';

        await scene.submitScore();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(scene.showErrorMessage).toHaveBeenCalled();
        // The guard must not latch on a rejected attempt, or the player could
        // never submit again after one slip.
        expect(scene.isSubmitting).toBe(false);
    });
});

describe('submitScore — recovery after failure', () => {
    it('re-enables input and allows a retry that reaches the network', async () => {
        const { scene, runTimers } = buildScene();
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ success: true, data: { rank: 3 } }),
            });

        await scene.submitScore();
        await flush();

        // Still latched until the recovery timer fires.
        expect(scene.isSubmitting).toBe(true);
        expect(scene.submitBtn.interactive).toBe(false);

        runTimers();

        expect(scene.isSubmitting).toBe(false);
        expect(scene.submitBtn.interactive).toBe(true);
        expect(scene.submitBtn.alpha).toBe(1);

        await scene.submitScore();
        await flush();

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('treats a non-2xx response as a failure and allows a retry', async () => {
        const { scene, runTimers } = buildScene();
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

        await scene.submitScore();
        await flush();
        runTimers();

        expect(scene.isSubmitting).toBe(false);
        expect(scene.submitBtn.interactive).toBe(true);
    });
});

describe('init resets state between rounds', () => {
    // Phaser reuses one scene instance for every round. A guard left set by the
    // previous game would silently block every later submission.
    it('clears a stale isSubmitting flag', () => {
        const { scene } = buildScene();
        scene.isSubmitting = true;

        scene.init({ score: 10, time: 5, zombiesKilled: 1 });

        expect(scene.isSubmitting).toBe(false);
    });

    it('stores the score data it was handed', () => {
        const { scene } = buildScene();
        scene.init({ score: 999, time: 123, zombiesKilled: 45 });
        expect(scene.scoreData).toEqual({ score: 999, time: 123, zombiesKilled: 45 });
    });
});
