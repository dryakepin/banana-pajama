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

        const createAndPlay = () => {
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

        // If context is ready, play immediately
        if (!scene.sound.context || scene.sound.context.state !== 'suspended') {
            createAndPlay();
            return { get music() { return music; }, cleanup: () => AudioManager._cleanup(music, html5Fallback) };
        }

        // Context is suspended — wait for user interaction
        const unlock = () => {
            if (isiOS) {
                // iOS: resume context and play synchronously in the interaction handler
                if (scene.sound.context && scene.sound.context.state === 'suspended') {
                    scene.sound.context.resume().catch(() => {});
                }
                createAndPlay();

                // Verify after a tick and retry once if needed
                setTimeout(() => {
                    if (music && !music.isPlaying) {
                        try {
                            if (scene.sound.context && scene.sound.context.state === 'suspended') {
                                scene.sound.context.resume().then(() => music.play()).catch(() => {});
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

        scene.input.once('pointerdown', unlock);
        if (scene.input.keyboard) {
            scene.input.keyboard.once('keydown', unlock);
        }

        return {
            get music() { return music; },
            cleanup: () => AudioManager._cleanup(music, html5Fallback),
        };
    }

    static _tryHtml5Fallback(key, volume, loop) {
        if (!isiOS) return null;
        try {
            const audio = new Audio();
            // Derive path from key name — assets follow assets/<key>.mp3 convention
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
