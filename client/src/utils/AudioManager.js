/**
 * Shared audio management utility for Phaser scenes.
 * Uses Phaser's built-in sound.locked / 'unlocked' event for iOS compatibility.
 */

export default class AudioManager {
    /**
     * Initialize and play background music for a scene.
     * If the sound system is locked (iOS, or any browser before user interaction),
     * defers playback until Phaser's own unlock fires.
     *
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {string} key - Audio cache key (e.g. 'zombie-theme')
     * @param {object} options - { loop, volume }
     * @returns {{ music: Phaser.Sound.BaseSound|null, cleanup: Function }}
     */
    static playMusic(scene, key, { loop = true, volume = 0.5 } = {}) {
        let music = null;
        let cleaned = false;

        const startMusic = () => {
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
            }
        };

        const cleanup = () => {
            cleaned = true;
            scene.sound.off('unlocked', startMusic);
            if (music) {
                try { music.stop(); } catch (_) {}
                try { music.destroy(); } catch (_) {}
            }
            music = null;
        };

        if (!scene.sound.locked) {
            // Audio system already unlocked — play immediately
            startMusic();
        } else {
            // Audio locked (iOS, or first load) — wait for Phaser's unlock event
            scene.sound.once('unlocked', startMusic);
        }

        return { get music() { return music; }, cleanup };
    }
}
