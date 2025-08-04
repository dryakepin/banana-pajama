import Phaser from 'phaser';

// Tile system configuration
export const TILE_SIZE = 64;
export const CHUNK_SIZE = 16; // 16x16 tiles per chunk (1024x1024 pixels)
export const RENDER_DISTANCE = 3; // Load 3 chunks in each direction

export const TILE_TYPES = {
    STREET: 'street',
    SIDEWALK: 'sidewalk',
    BUILDING: 'building',
    PARK: 'park',
    INTERSECTION: 'intersection'
};

export default class TileMap {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // Map of chunk coordinates to chunk data
        this.tileSprites = new Map(); // Map of tile positions to sprite objects
        this.lastPlayerChunk = { x: null, y: null }; // Force initial load
        
        // Create tile textures from graphics if not loaded
        this.createTileTextures();
        
        // Load initial chunks around origin (0, 0)
        this.loadInitialChunks();
    }
    
    createTileTextures() {
        // Create basic colored tile textures as placeholders
        const graphics = this.scene.add.graphics();
        
        // Street tile (dark gray)
        graphics.fillStyle(0x2a2a2a);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.generateTexture(TILE_TYPES.STREET, TILE_SIZE, TILE_SIZE);
        
        // Sidewalk tile (slightly lighter gray)
        graphics.clear();
        graphics.fillStyle(0x404040);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(2, 0x555555);
        graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.generateTexture(TILE_TYPES.SIDEWALK, TILE_SIZE, TILE_SIZE);
        
        // Building tile (dark blue-gray)
        graphics.clear();
        graphics.fillStyle(0x1a1a2e);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(1, 0x2a2a4e);
        graphics.strokeRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
        graphics.generateTexture(TILE_TYPES.BUILDING, TILE_SIZE, TILE_SIZE);
        
        // Park tile (dark green)
        graphics.clear();
        graphics.fillStyle(0x1a2e1a);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(0x2a4e2a);
        graphics.fillCircle(TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/3);
        graphics.generateTexture(TILE_TYPES.PARK, TILE_SIZE, TILE_SIZE);
        
        // Intersection tile (dark gray with lines)
        graphics.clear();
        graphics.fillStyle(0x2a2a2a);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(2, 0x404040);
        graphics.lineBetween(0, TILE_SIZE/2, TILE_SIZE, TILE_SIZE/2);
        graphics.lineBetween(TILE_SIZE/2, 0, TILE_SIZE/2, TILE_SIZE);
        graphics.generateTexture(TILE_TYPES.INTERSECTION, TILE_SIZE, TILE_SIZE);
        
        graphics.destroy();
    }
    
    // Load initial chunks around the starting position
    loadInitialChunks() {
        // Load chunks around origin (0, 0) where player starts
        for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
            for (let y = -RENDER_DISTANCE; y <= RENDER_DISTANCE; y++) {
                this.loadChunk(x, y);
            }
        }
    }
    
    // Convert world coordinates to chunk coordinates
    worldToChunk(worldX, worldY) {
        return {
            x: Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
            y: Math.floor(worldY / (CHUNK_SIZE * TILE_SIZE))
        };
    }
    
    // Convert world coordinates to tile coordinates
    worldToTile(worldX, worldY) {
        return {
            x: Math.floor(worldX / TILE_SIZE),
            y: Math.floor(worldY / TILE_SIZE)
        };
    }
    
    // Convert tile coordinates to world coordinates
    tileToWorld(tileX, tileY) {
        return {
            x: tileX * TILE_SIZE,
            y: tileY * TILE_SIZE
        };
    }
    
    // Generate tile type for a given tile coordinate (procedural)
    generateTileType(tileX, tileY) {
        // Simple procedural generation - create a basic city grid
        const absX = Math.abs(tileX);
        const absY = Math.abs(tileY);
        
        // Create street grid every 8 tiles
        const isStreetX = (absX % 8) < 2;
        const isStreetY = (absY % 8) < 2;
        
        if (isStreetX && isStreetY) {
            return TILE_TYPES.INTERSECTION;
        } else if (isStreetX || isStreetY) {
            return TILE_TYPES.STREET;
        } else {
            // Buildings and occasional parks
            const rand = Math.abs(Math.sin(tileX * 12.9898 + tileY * 78.233) * 43758.5453);
            const noise = rand - Math.floor(rand);
            
            if (noise < 0.1) {
                return TILE_TYPES.PARK;
            } else if (noise < 0.3) {
                return TILE_TYPES.SIDEWALK;
            } else {
                return TILE_TYPES.BUILDING;
            }
        }
    }
    
    // Generate a chunk of tiles
    generateChunk(chunkX, chunkY) {
        const chunk = {
            x: chunkX,
            y: chunkY,
            tiles: new Array(CHUNK_SIZE * CHUNK_SIZE),
            loaded: false
        };
        
        // Generate tiles for this chunk
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const tileX = chunkX * CHUNK_SIZE + x;
                const tileY = chunkY * CHUNK_SIZE + y;
                const index = y * CHUNK_SIZE + x;
                
                chunk.tiles[index] = {
                    type: this.generateTileType(tileX, tileY),
                    x: tileX,
                    y: tileY
                };
            }
        }
        
        return chunk;
    }
    
    // Load and render a chunk
    loadChunk(chunkX, chunkY) {
        const chunkKey = `${chunkX},${chunkY}`;
        
        if (this.chunks.has(chunkKey)) {
            return this.chunks.get(chunkKey);
        }
        
        const chunk = this.generateChunk(chunkX, chunkY);
        this.chunks.set(chunkKey, chunk);
        
        // Create sprite objects for visible tiles
        this.renderChunk(chunk);
        
        chunk.loaded = true;
        return chunk;
    }
    
    // Render tiles in a chunk
    renderChunk(chunk) {
        for (let i = 0; i < chunk.tiles.length; i++) {
            const tile = chunk.tiles[i];
            const worldPos = this.tileToWorld(tile.x, tile.y);
            const tileKey = `${tile.x},${tile.y}`;
            
            // Don't create sprite if already exists
            if (this.tileSprites.has(tileKey)) {
                continue;
            }
            
            // Create tile sprite
            const sprite = this.scene.add.image(worldPos.x, worldPos.y, tile.type);
            sprite.setOrigin(0, 0); // Top-left origin for tile alignment
            sprite.setDepth(-100); // Behind all game objects
            
            this.tileSprites.set(tileKey, sprite);
        }
    }
    
    // Unload a chunk (remove sprites)
    unloadChunk(chunkX, chunkY) {
        const chunkKey = `${chunkX},${chunkY}`;
        const chunk = this.chunks.get(chunkKey);
        
        if (!chunk) return;
        
        // Remove all tile sprites in this chunk
        for (let i = 0; i < chunk.tiles.length; i++) {
            const tile = chunk.tiles[i];
            const tileKey = `${tile.x},${tile.y}`;
            const sprite = this.tileSprites.get(tileKey);
            
            if (sprite) {
                sprite.destroy();
                this.tileSprites.delete(tileKey);
            }
        }
        
        this.chunks.delete(chunkKey);
    }
    
    // Update tile loading based on player position
    update(playerX, playerY) {
        const playerChunk = this.worldToChunk(playerX, playerY);
        
        // Only update if player moved to different chunk (or first update)
        if (this.lastPlayerChunk.x !== null && 
            playerChunk.x === this.lastPlayerChunk.x && 
            playerChunk.y === this.lastPlayerChunk.y) {
            return;
        }
        
        this.lastPlayerChunk = playerChunk;
        
        // Load chunks around player
        const chunksToLoad = [];
        const chunksToKeep = new Set();
        
        for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
            for (let y = -RENDER_DISTANCE; y <= RENDER_DISTANCE; y++) {
                const chunkX = playerChunk.x + x;
                const chunkY = playerChunk.y + y;
                const chunkKey = `${chunkX},${chunkY}`;
                
                chunksToKeep.add(chunkKey);
                
                if (!this.chunks.has(chunkKey)) {
                    chunksToLoad.push({ x: chunkX, y: chunkY });
                }
            }
        }
        
        // Load new chunks
        for (const chunk of chunksToLoad) {
            this.loadChunk(chunk.x, chunk.y);
        }
        
        // Unload distant chunks
        for (const [chunkKey, chunk] of this.chunks) {
            if (!chunksToKeep.has(chunkKey)) {
                this.unloadChunk(chunk.x, chunk.y);
            }
        }
    }
    
    // Get tile type at world position (for collision detection)
    getTileTypeAtPosition(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const chunk = this.worldToChunk(worldX, worldY);
        const chunkKey = `${chunk.x},${chunk.y}`;
        
        const chunkData = this.chunks.get(chunkKey);
        if (!chunkData) {
            // Generate tile type on-demand if chunk not loaded
            return this.generateTileType(tile.x, tile.y);
        }
        
        const localX = tile.x - chunk.x * CHUNK_SIZE;
        const localY = tile.y - chunk.y * CHUNK_SIZE;
        const index = localY * CHUNK_SIZE + localX;
        
        return chunkData.tiles[index]?.type || TILE_TYPES.STREET;
    }
    
    // Check if position is walkable (not a building)
    isWalkable(worldX, worldY) {
        const tileType = this.getTileTypeAtPosition(worldX, worldY);
        return tileType !== TILE_TYPES.BUILDING;
    }
    
    destroy() {
        // Clean up all sprites
        for (const sprite of this.tileSprites.values()) {
            sprite.destroy();
        }
        this.tileSprites.clear();
        this.chunks.clear();
    }
}