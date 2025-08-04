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
    INTERSECTION: 'intersection',
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial'
};

// PNG asset naming scheme
export const TILE_ASSETS = {
    'street': 'assets/tiles/tile-street.png',
    'sidewalk': 'assets/tiles/tile-sidewalk.png',
    'building': 'assets/tiles/tile-building.png',
    'park': 'assets/tiles/tile-park.png',
    'intersection': 'assets/tiles/tile-intersection.png',
    'residential': 'assets/tiles/tile-residential.png',
    'commercial': 'assets/tiles/tile-commercial.png',
    'industrial': 'assets/tiles/tile-industrial.png'
};

export const DISTRICT_TYPES = {
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial',
    PARK: 'park'
};

export default class TileMap {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // Map of chunk coordinates to chunk data
        this.tileSprites = new Map(); // Map of tile positions to sprite objects
        this.lastPlayerChunk = { x: null, y: null }; // Force initial load
        this.loadedAssets = new Set(); // Track which PNG assets were successfully loaded
        
        // Initialize the tile system
        this.initializeTileSystem();
    }
    
    // Initialize the tile system
    initializeTileSystem() {
        // Create fallback textures first
        this.createFallbackTextures();
        
        // Check which PNG assets are available (already loaded by scene)
        this.checkAvailableAssets();
        
        // Load initial chunks
        this.loadInitialChunks();
    }
    
    // Check which PNG tile assets are available in the texture cache
    checkAvailableAssets() {
        for (const tileType of Object.keys(TILE_ASSETS)) {
            const pngKey = `${tileType}-png`;
            if (this.scene.textures.exists(pngKey)) {
                this.loadedAssets.add(tileType);
                console.log(`✅ Using PNG asset for ${tileType}: ${pngKey}`);
            } else {
                console.log(`⚠️  PNG asset not found for ${tileType}, using fallback`);
            }
        }
    }
    
    // Create fallback textures for tiles without PNG assets
    createFallbackTextures() {
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
        
        // Residential building (lighter blue-gray)
        graphics.clear();
        graphics.fillStyle(0x2a2a4e);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(1, 0x4a4a6e);
        graphics.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
        graphics.fillStyle(0x404060);
        graphics.fillRect(8, 8, 12, 12);
        graphics.generateTexture(TILE_TYPES.RESIDENTIAL, TILE_SIZE, TILE_SIZE);
        
        // Commercial building (dark gray with windows)
        graphics.clear();
        graphics.fillStyle(0x1a1a2e);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(0x3a3a5e);
        for (let x = 4; x < TILE_SIZE - 4; x += 8) {
            for (let y = 4; y < TILE_SIZE - 4; y += 8) {
                graphics.fillRect(x, y, 4, 4);
            }
        }
        graphics.generateTexture(TILE_TYPES.COMMERCIAL, TILE_SIZE, TILE_SIZE);
        
        // Industrial building (dark brown/gray)
        graphics.clear();
        graphics.fillStyle(0x2e2a1a);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(2, 0x4e4a3a);
        graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(0x3e3a2a);
        graphics.fillRect(4, 4, TILE_SIZE - 8, 8);
        graphics.generateTexture(TILE_TYPES.INDUSTRIAL, TILE_SIZE, TILE_SIZE);
        
        graphics.destroy();
    }
    
    // Get the appropriate texture key for a tile type
    getTileTextureKey(tileType) {
        // Use PNG asset if available and texture exists, otherwise use generated texture
        const pngKey = `${tileType}-png`;
        if (this.loadedAssets.has(tileType) && this.scene.textures.exists(pngKey)) {
            return pngKey;
        } else {
            return tileType;
        }
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
    
    // Determine district type based on location
    getDistrictType(tileX, tileY) {
        // Create districts based on distance from center and noise
        const distanceFromCenter = Math.sqrt(tileX * tileX + tileY * tileY);
        const rand = Math.abs(Math.sin(tileX * 7.1234 + tileY * 13.5678) * 43758.5453);
        const noise = rand - Math.floor(rand);
        
        // Center area tends to be commercial
        if (distanceFromCenter < 20 && noise < 0.7) {
            return DISTRICT_TYPES.COMMERCIAL;
        }
        
        // Industrial areas in outer regions
        if (distanceFromCenter > 50 && noise < 0.4) {
            return DISTRICT_TYPES.INDUSTRIAL;
        }
        
        // Parks scattered throughout
        if (noise < 0.15) {
            return DISTRICT_TYPES.PARK;
        }
        
        // Default to residential
        return DISTRICT_TYPES.RESIDENTIAL;
    }
    
    // Generate tile type for a given tile coordinate (procedural)
    generateTileType(tileX, tileY) {
        const absX = Math.abs(tileX);
        const absY = Math.abs(tileY);
        
        // Create street grid with varied spacing
        const blockSizeX = this.getBlockSize(tileX);
        const blockSizeY = this.getBlockSize(tileY);
        
        const isStreetX = (absX % blockSizeX) < 2;
        const isStreetY = (absY % blockSizeY) < 2;
        
        if (isStreetX && isStreetY) {
            return TILE_TYPES.INTERSECTION;
        } else if (isStreetX || isStreetY) {
            return TILE_TYPES.STREET;
        } else {
            return this.generateBuildingType(tileX, tileY);
        }
    }
    
    // Get block size for varied city layout
    getBlockSize(coordinate) {
        const noise = Math.abs(Math.sin(coordinate * 0.1) * 43758.5453);
        const normalized = noise - Math.floor(noise);
        
        if (normalized < 0.3) return 6;  // Small blocks
        if (normalized < 0.7) return 8;  // Medium blocks
        return 10; // Large blocks
    }
    
    // Generate building type based on district
    generateBuildingType(tileX, tileY) {
        const district = this.getDistrictType(tileX, tileY);
        const rand = Math.abs(Math.sin(tileX * 12.9898 + tileY * 78.233) * 43758.5453);
        const noise = rand - Math.floor(rand);
        
        switch (district) {
            case DISTRICT_TYPES.RESIDENTIAL:
                if (noise < 0.1) return TILE_TYPES.PARK;
                if (noise < 0.2) return TILE_TYPES.SIDEWALK;
                return TILE_TYPES.RESIDENTIAL;
                
            case DISTRICT_TYPES.COMMERCIAL:
                if (noise < 0.05) return TILE_TYPES.PARK;
                if (noise < 0.15) return TILE_TYPES.SIDEWALK;
                return TILE_TYPES.COMMERCIAL;
                
            case DISTRICT_TYPES.INDUSTRIAL:
                if (noise < 0.05) return TILE_TYPES.SIDEWALK;
                return TILE_TYPES.INDUSTRIAL;
                
            case DISTRICT_TYPES.PARK:
                if (noise < 0.7) return TILE_TYPES.PARK;
                return TILE_TYPES.SIDEWALK;
                
            default:
                return TILE_TYPES.BUILDING;
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
            
            // Create tile sprite using appropriate texture
            const textureKey = this.getTileTextureKey(tile.type);
            const sprite = this.scene.add.image(worldPos.x, worldPos.y, textureKey);
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
        return tileType !== TILE_TYPES.BUILDING && 
               tileType !== TILE_TYPES.RESIDENTIAL && 
               tileType !== TILE_TYPES.COMMERCIAL && 
               tileType !== TILE_TYPES.INDUSTRIAL;
    }
    
    // Check if position is a solid obstacle
    isSolid(worldX, worldY) {
        return !this.isWalkable(worldX, worldY);
    }
    
    // Get nearest walkable position
    getNearestWalkablePosition(worldX, worldY, maxDistance = 100) {
        if (this.isWalkable(worldX, worldY)) {
            return { x: worldX, y: worldY };
        }
        
        // Search in expanding circles
        for (let radius = TILE_SIZE; radius <= maxDistance; radius += TILE_SIZE) {
            const steps = Math.max(8, Math.floor(radius / 8));
            for (let i = 0; i < steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const testX = worldX + Math.cos(angle) * radius;
                const testY = worldY + Math.sin(angle) * radius;
                
                if (this.isWalkable(testX, testY)) {
                    return { x: testX, y: testY };
                }
            }
        }
        
        // Fallback to original position
        return { x: worldX, y: worldY };
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