/**
 * Coordinate maths and tile classification for the procedural city.
 *
 * TileMap's constructor immediately builds textures and loads chunks against a
 * live Phaser scene, so these tests bind the prototype methods to a bare object
 * instead of constructing one. Everything exercised here is deterministic:
 * the "noise" is sine-based, not Math.random, so the same tile always resolves
 * to the same type.
 */

import TileMap, {
    TILE_SIZE,
    TILE_TYPES,
    MAP_MIN_X,
    MAP_MIN_Y,
    MAP_MAX_X,
    MAP_MAX_Y,
} from '../src/world/TileMap.js';

/** A TileMap with the prototype but none of the constructor's side effects. */
function bareTileMap() {
    const map = Object.create(TileMap.prototype);
    map.chunks = new Map();   // empty, so lookups fall through to generateTileType
    return map;
}

describe('worldToTile', () => {
    const worldToTile = (x, y) => TileMap.prototype.worldToTile.call({}, x, y);

    it('maps the origin to tile 0,0', () => {
        expect(worldToTile(0, 0)).toEqual({ x: 0, y: 0 });
    });

    it('keeps every pixel within a tile on that tile', () => {
        expect(worldToTile(TILE_SIZE - 1, TILE_SIZE - 1)).toEqual({ x: 0, y: 0 });
        expect(worldToTile(TILE_SIZE, TILE_SIZE)).toEqual({ x: 1, y: 1 });
    });

    // Floor, not truncation. Math.trunc(-1/64) would give 0 and put everything
    // in the first tile left of the origin onto tile 0 instead of tile -1.
    it('floors negative coordinates rather than truncating toward zero', () => {
        expect(worldToTile(-1, -1)).toEqual({ x: -1, y: -1 });
        expect(worldToTile(-TILE_SIZE, -TILE_SIZE)).toEqual({ x: -1, y: -1 });
        expect(worldToTile(-TILE_SIZE - 1, -TILE_SIZE - 1)).toEqual({ x: -2, y: -2 });
    });
});

describe('tileToWorld', () => {
    const tileToWorld = (x, y) => TileMap.prototype.tileToWorld.call({}, x, y);
    const worldToTile = (x, y) => TileMap.prototype.worldToTile.call({}, x, y);

    it('returns the top-left pixel of the tile', () => {
        expect(tileToWorld(0, 0)).toEqual({ x: 0, y: 0 });
        expect(tileToWorld(2, 3)).toEqual({ x: 2 * TILE_SIZE, y: 3 * TILE_SIZE });
    });

    it('round-trips back through worldToTile, negatives included', () => {
        for (const [tx, ty] of [[0, 0], [5, 9], [-1, -1], [-40, 17], [31, -22]]) {
            const world = tileToWorld(tx, ty);
            expect(worldToTile(world.x, world.y)).toEqual({ x: tx, y: ty });
        }
    });
});

describe('generateTileType', () => {
    let map;
    beforeEach(() => { map = bareTileMap(); });

    it('is deterministic for a given tile', () => {
        for (const [x, y] of [[3, 7], [-12, 40], [0, 0], [99, -99]]) {
            expect(map.generateTileType(x, y)).toBe(map.generateTileType(x, y));
        }
    });

    it('only ever returns a known tile type', () => {
        const known = new Set(Object.values(TILE_TYPES));
        for (let x = -30; x <= 30; x += 3) {
            for (let y = -30; y <= 30; y += 3) {
                expect(known).toContain(map.generateTileType(x, y));
            }
        }
    });

    // The border ring is what stops the player walking off the edge of the
    // world. If it ever stops being solid, the map has no walls.
    it('walls the map edges with buildings', () => {
        const minTileX = Math.floor(MAP_MIN_X / TILE_SIZE);
        const minTileY = Math.floor(MAP_MIN_Y / TILE_SIZE);
        const maxTileX = Math.ceil(MAP_MAX_X / TILE_SIZE) - 1;
        const maxTileY = Math.ceil(MAP_MAX_Y / TILE_SIZE) - 1;

        expect(map.generateTileType(minTileX, 0)).toBe(TILE_TYPES.BUILDING);
        expect(map.generateTileType(maxTileX, 0)).toBe(TILE_TYPES.BUILDING);
        expect(map.generateTileType(0, minTileY)).toBe(TILE_TYPES.BUILDING);
        expect(map.generateTileType(0, maxTileY)).toBe(TILE_TYPES.BUILDING);
    });

    it('treats anything beyond the border as building too', () => {
        expect(map.generateTileType(100000, 0)).toBe(TILE_TYPES.BUILDING);
        expect(map.generateTileType(0, -100000)).toBe(TILE_TYPES.BUILDING);
    });
});

describe('isWalkable / isSolid', () => {
    /** Pins the classification without depending on where these types occur. */
    function walkableFor(tileType) {
        const map = Object.create(TileMap.prototype);
        map.getTileTypeAtPosition = () => tileType;
        return map.isWalkable(0, 0);
    }

    it.each([
        TILE_TYPES.STREET,
        TILE_TYPES.SIDEWALK,
        TILE_TYPES.PARK,
        TILE_TYPES.INTERSECTION,
    ])('treats %s as walkable', (tileType) => {
        expect(walkableFor(tileType)).toBe(true);
    });

    it.each([
        TILE_TYPES.BUILDING,
        TILE_TYPES.RESIDENTIAL,
        TILE_TYPES.COMMERCIAL,
        TILE_TYPES.INDUSTRIAL,
    ])('treats %s as blocking', (tileType) => {
        expect(walkableFor(tileType)).toBe(false);
    });

    it('classifies every declared tile type one way or the other', () => {
        // A new tile type added to TILE_TYPES but not to isWalkable's blocklist
        // defaults to walkable, which is how zombies end up inside buildings.
        // This asserts the current split so that change is at least visible.
        const walkable = Object.values(TILE_TYPES).filter(walkableFor);
        expect(walkable.sort()).toEqual([
            TILE_TYPES.INTERSECTION,
            TILE_TYPES.PARK,
            TILE_TYPES.SIDEWALK,
            TILE_TYPES.STREET,
        ].sort());
    });

    it('isSolid is the exact inverse of isWalkable', () => {
        for (const tileType of Object.values(TILE_TYPES)) {
            const map = Object.create(TileMap.prototype);
            map.getTileTypeAtPosition = () => tileType;
            expect(map.isSolid(0, 0)).toBe(!map.isWalkable(0, 0));
        }
    });
});

describe('getTileTypeAtPosition', () => {
    it('falls back to on-demand generation when the chunk is not loaded', () => {
        const map = bareTileMap();
        const type = map.getTileTypeAtPosition(500, 500);
        expect(Object.values(TILE_TYPES)).toContain(type);
    });

    it('agrees with generateTileType for the containing tile', () => {
        const map = bareTileMap();
        const tile = map.worldToTile(500, 500);
        expect(map.getTileTypeAtPosition(500, 500)).toBe(map.generateTileType(tile.x, tile.y));
    });
});
