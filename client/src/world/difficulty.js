/**
 * Progressive difficulty curve.
 *
 * Extracted from GameScene.increaseDifficulty() so the formulas can be tested
 * without standing up a scene and its four spawn timers. The scene keeps
 * ownership of the timers; this module owns only the arithmetic.
 */

/** Base delay (ms) and hard floor for each zombie type's spawn timer. */
export const SPAWN_RATES = {
    basic: { base: 2000, floor: 500 },
    fast: { base: 3000, floor: 700 },
    tank: { base: 8000, floor: 2000 },
    animated: { base: 6000, floor: 1500 },
};

export const SPEED_MULTIPLIER_CAP = 1.5;
export const HP_MULTIPLIER_CAP = 2.0;

/** HP scaling stays at 1 until this level, giving players a grace period. */
export const HP_GRACE_LEVELS = 3;

/**
 * Spawn delay for a given level: max(floor, floor(base * 0.9^level)).
 * Decays geometrically, then clamps so spawns never become instant.
 */
export function spawnDelay(base, floor, level) {
    return Math.max(floor, Math.floor(base * Math.pow(0.9, level)));
}

/** Every spawn delay for a level, keyed the same way as SPAWN_RATES. */
export function spawnDelays(level) {
    const delays = {};
    for (const [type, { base, floor }] of Object.entries(SPAWN_RATES)) {
        delays[type] = spawnDelay(base, floor, level);
    }
    return delays;
}

/** Zombie speed scaling: +2.5% per level, capped at 1.5x. */
export function speedMultiplier(level) {
    return Math.min(SPEED_MULTIPLIER_CAP, 1 + level * 0.025);
}

/** Zombie HP scaling: +5% per level past the grace period, capped at 2x. */
export function hpMultiplier(level) {
    return Math.min(HP_MULTIPLIER_CAP, 1 + Math.max(0, level - HP_GRACE_LEVELS) * 0.05);
}
