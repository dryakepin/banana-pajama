/**
 * The progressive difficulty curve.
 *
 * These formulas compound every 30 seconds of play and are invisible in review
 * -- a wrong cap or an off-by-one in the grace period makes the game
 * unwinnable several minutes in, long after anyone is still watching. Related:
 * GAME-3, where these multipliers are re-applied to pooled zombies on reuse and
 * compound geometrically. That bug is in the *application* of these values, not
 * in the values themselves, and is not fixed here.
 */

import {
    spawnDelay,
    spawnDelays,
    speedMultiplier,
    hpMultiplier,
    SPAWN_RATES,
    SPEED_MULTIPLIER_CAP,
    HP_MULTIPLIER_CAP,
    HP_GRACE_LEVELS,
} from '../src/world/difficulty.js';

describe('spawnDelay', () => {
    it('returns the base delay at level 0', () => {
        expect(spawnDelay(2000, 500, 0)).toBe(2000);
    });

    it('decays by 10% per level', () => {
        expect(spawnDelay(2000, 500, 1)).toBe(1800);
        expect(spawnDelay(2000, 500, 2)).toBe(1620);
    });

    it('floors fractional results rather than rounding', () => {
        // 2000 * 0.9^3 = 1458.0000000000002 -> 1458
        expect(spawnDelay(2000, 500, 3)).toBe(1458);
    });

    it('never drops below the floor, however high the level', () => {
        expect(spawnDelay(2000, 500, 100)).toBe(500);
        expect(spawnDelay(2000, 500, 10000)).toBe(500);
    });

    it('is monotonically non-increasing across the first 60 levels', () => {
        for (let level = 1; level <= 60; level++) {
            expect(spawnDelay(2000, 500, level)).toBeLessThanOrEqual(spawnDelay(2000, 500, level - 1));
        }
    });
});

describe('spawnDelays', () => {
    it('covers every configured zombie type', () => {
        expect(Object.keys(spawnDelays(0)).sort()).toEqual(Object.keys(SPAWN_RATES).sort());
    });

    it('returns each type at its base delay for level 0', () => {
        expect(spawnDelays(0)).toEqual({ basic: 2000, fast: 3000, tank: 8000, animated: 6000 });
    });

    it('clamps every type to its own floor at high levels', () => {
        expect(spawnDelays(500)).toEqual({ basic: 500, fast: 700, tank: 2000, animated: 1500 });
    });

    it('keeps tanks rarer than basics at every level', () => {
        for (let level = 0; level <= 80; level++) {
            const d = spawnDelays(level);
            expect(d.tank).toBeGreaterThan(d.basic);
        }
    });
});

describe('speedMultiplier', () => {
    it('starts at 1x', () => {
        expect(speedMultiplier(0)).toBe(1);
    });

    it('adds 2.5% per level', () => {
        expect(speedMultiplier(4)).toBeCloseTo(1.1, 10);
    });

    it('caps at 1.5x', () => {
        // 1 + 20 * 0.025 = 1.5 exactly; beyond that the cap holds.
        expect(speedMultiplier(20)).toBe(SPEED_MULTIPLIER_CAP);
        expect(speedMultiplier(21)).toBe(SPEED_MULTIPLIER_CAP);
        expect(speedMultiplier(9999)).toBe(SPEED_MULTIPLIER_CAP);
    });

    it('never exceeds the cap at any level', () => {
        for (let level = 0; level <= 200; level++) {
            expect(speedMultiplier(level)).toBeLessThanOrEqual(SPEED_MULTIPLIER_CAP);
        }
    });
});

describe('hpMultiplier', () => {
    it('stays at 1x through the grace period', () => {
        for (let level = 0; level <= HP_GRACE_LEVELS; level++) {
            expect(hpMultiplier(level)).toBe(1);
        }
    });

    it('starts scaling on the level after the grace period', () => {
        expect(hpMultiplier(HP_GRACE_LEVELS + 1)).toBeCloseTo(1.05, 10);
    });

    it('caps at 2x', () => {
        expect(hpMultiplier(23)).toBe(HP_MULTIPLIER_CAP);
        expect(hpMultiplier(9999)).toBe(HP_MULTIPLIER_CAP);
    });

    it('never exceeds the cap at any level', () => {
        for (let level = 0; level <= 200; level++) {
            expect(hpMultiplier(level)).toBeLessThanOrEqual(HP_MULTIPLIER_CAP);
        }
    });

    it('ramps more slowly than speed for the first several levels', () => {
        expect(hpMultiplier(2)).toBeLessThan(speedMultiplier(2));
    });
});
