/**
 * Shared audio management utility for Phaser scenes.
 * Handles iOS audio unlock quirks, context resume, and HTML5 Audio fallback.
 */

const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

export default class AudioManager {
    /**
     * Initialize and play background music for a scene.
     * Handles suspended AudioContext by deferring playback to first user interaction.
     *
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {string} key - Audio cache key (e.g. 'zombie-theme')
     * @param {object} options - { loop, volume }
     * @returns {{ music: Phaser.Sound.BaseSound|null, cleanup: Function }}
     */
    static playMusic(scene, key, { loop = true, volume = 0.5 } = {}) {
        let music = null;
        let html5Fallback = null;
        let cleaned = false;

        const createAndPlay = () => {
            if (cleaned) return;
            try {
                if (music) {
                    music.stop();
                    music.destroy();
                }
                music = scene.sound.add(key, { loop, volume });
                music.play();
            } catch (err) {
                console.error(`AudioManager: Failed to play ${key}:`, err.message);
                html5Fallback = AudioManager._tryHtml5Fallback(key, volume, loop);
            }
        };

        // Define unlock handler before cleanup so cleanup can reference it
        const unlock = () => {
            if (cleaned) return;
            if (isiOS) {
                if (scene.sound.context && scene.sound.context.state === 'suspended') {
                    scene.sound.context.resume().catch(() => {});
                }
                createAndPlay();

                setTimeout(() => {
                    if (!cleaned && music && !music.isPlaying) {
                        try {
                            if (scene.sound.context && scene.sound.context.state === 'suspended') {
                                scene.sound.context.resume().then(() => { if (!cleaned) music.play(); }).catch(() => {});
                            } else {
                                music.play();
                            }
                        } catch (_) { /* best effort */ }
                    }
                }, 150);
            } else {
                const resume = scene.sound.context
                    ? scene.sound.context.resume()
                    : Promise.resolve();
                resume.then(() => createAndPlay()).catch(() => createAndPlay());
            }

            scene.input.off('pointerdown', unlock);
            scene.input.keyboard?.off('keydown', unlock);
        };

        const cleanup = () => {
            cleaned = true;
            scene.input.off('pointerdown', unlock);
            scene.input.keyboard?.off('keydown', unlock);
            AudioManager._cleanup(music, html5Fallback);
            music = null;
            html5Fallback = null;
        };

        // Determine if we need to wait for user interaction:
        // - iOS always needs it (WebAudio context starts suspended)
        // - Any browser with suspended WebAudio context needs it
        const contextSuspended = scene.sound.context && scene.sound.context.state === 'suspended';
        const needsUnlock = isiOS || contextSuspended;

        if (!needsUnlock) {
            createAndPlay();
            return { get music() { return music; }, cleanup };
        }

        // Wait for user interaction to unlock audio
        scene.input.once('pointerdown', unlock);
        if (scene.input.keyboard) {
            scene.input.keyboard.once('keydown', unlock);
        }

        return { get music() { return music; }, cleanup };
    }

    static _tryHtml5Fallback(key, volume, loop) {
        if (!isiOS) return null;
        try {
            const audio = new Audio();
            audio.src = `assets/${key}.mp3`;
            audio.loop = loop;
            audio.volume = volume;
            const p = audio.play();
            if (p) p.catch(() => {});
            return audio;
        } catch (_) {
            return null;
        }
    }

    static _cleanup(music, html5Fallback) {
        if (music) {
            try { music.stop(); } catch (_) {}
            try { music.destroy(); } catch (_) {}
        }
        if (html5Fallback) {
            try { html5Fallback.pause(); } catch (_) {}
        }
    }
}
