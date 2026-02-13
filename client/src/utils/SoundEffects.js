import { ZZFX } from 'zzfx';

/**
 * Synthesized sound effects using ZZFX.
 * Shares Phaser's AudioContext so mobile unlock works automatically.
 */
export default class SoundEffects {
    static _initialized = false;
    static _activeSounds = {};
    static _limits = {
        gunshot: 3,     // rapid fire + dual shot can overlap
        zombieDeath: 5, // kill-all triggers many at once
        zombieAttack: 3,
        playerDamage: 1,
        playerDeath: 1,
        powerup: 2,
        explosion: 1
    };

    /**
     * Initialize with Phaser scene's AudioContext.
     * @param {Phaser.Scene} scene
     */
    static init(scene) {
        // Use Phaser's AudioContext so mobile unlock carries over
        if (scene.sound && scene.sound.context) {
            ZZFX.audioContext = scene.sound.context;
        }
        ZZFX.volume = 0.5;
        this._initialized = true;

        // Reset active sound counters
        for (const key of Object.keys(this._limits)) {
            this._activeSounds[key] = 0;
        }
    }

    /** Reset state when leaving the game scene. */
    static cleanup() {
        this._initialized = false;
        for (const key of Object.keys(this._limits)) {
            this._activeSounds[key] = 0;
        }
    }

    // --- Rate limiting helpers ---

    static _canPlay(category) {
        if (!this._initialized) return false;
        const limit = this._limits[category] || 3;
        return this._activeSounds[category] < limit;
    }

    static _track(category, durationMs) {
        this._activeSounds[category]++;
        setTimeout(() => {
            this._activeSounds[category] = Math.max(0, this._activeSounds[category] - 1);
        }, durationMs);
    }

    static _safePlay(...params) {
        try {
            ZZFX.play(...params);
        } catch (e) {
            // AudioContext may be suspended on mobile — silently ignore
        }
    }

    // --- Sound methods ---

    /** Short punchy gunshot with slight echo */
    static playGunshot() {
        if (!this._canPlay('gunshot')) return;
        this._track('gunshot', 150);
        this._safePlay(...[0.4, .05, 400, , .01, .04, 4, 1.5, -20, , , , , 1.5, , .2, .01]);
    }

    /** Zombie death sound - varies by type */
    static playZombieDeath(type = 'basic') {
        if (!this._canPlay('zombieDeath')) return;
        this._track('zombieDeath', 400);

        switch (type) {
            case 'tank':
                // Deep heavy thud
                this._safePlay(...[0.6, .05, 80, , .05, .3, 4, 1.8, -5, , , , , 2, , .1, , .5]);
                break;
            case 'fast':
                // Quick high-pitched splat
                this._safePlay(...[0.3, .05, 300, , .01, .12, 4, 1.2, -30, , , , , 1.5]);
                break;
            case 'animated':
                // Eerie warbled death
                this._safePlay(...[0.4, .05, 150, , .03, .25, 2, 1.5, -10, , , , , 1, 5]);
                break;
            default:
                // Basic wet splat
                this._safePlay(...[0.3, .05, 180, , .02, .18, 4, 1.4, -15, , , , , 2]);
                break;
        }
    }

    /** Short hit sound when player takes damage */
    static playPlayerDamage() {
        if (!this._canPlay('playerDamage')) return;
        this._track('playerDamage', 300);
        this._safePlay(...[0.5, .05, 250, , .01, .15, 4, 2, 10, , , , , 1.5, , , , .7]);
    }

    /** Dramatic death sound */
    static playPlayerDeath() {
        if (!this._canPlay('playerDeath')) return;
        this._track('playerDeath', 1000);
        this._safePlay(...[0.7, .05, 400, .01, .1, .5, 0, 1, -20, -1, , , , 1, , , .05, .4, .1]);
    }

    /** Bright positive chime for power-up pickup */
    static playPowerupPickup() {
        if (!this._canPlay('powerup')) return;
        this._track('powerup', 300);
        this._safePlay(...[0.4, .05, 600, , .05, .15, 0, 1.5, 15, , 200, .04]);
    }

    /** Big explosion for kill-all power-up */
    static playKillAllExplosion() {
        if (!this._canPlay('explosion')) return;
        this._track('explosion', 800);
        this._safePlay(...[0.8, .05, 60, .01, .15, .5, 4, 1, , , , , , 3, , .3, .1, .6, .05]);
    }

    /** Quick bite/slash when zombie attacks player */
    static playZombieAttack() {
        if (!this._canPlay('zombieAttack')) return;
        this._track('zombieAttack', 200);
        this._safePlay(...[0.3, .1, 200, , .01, .08, 4, 2, 15, , , , , .5]);
    }
}
