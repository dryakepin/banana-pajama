# Tile Assets

This directory contains PNG tile assets for the game world. The asset loading system will automatically use these PNG files when available, falling back to procedurally generated tiles when files don't exist.

## Naming Convention

All tile PNG files should follow this naming pattern:
- `tile-[type].png`

Where `[type]` corresponds to the tile types defined in TileMap.js:

### Available Tile Types:
- `tile-street.png` - Street/road tiles (dark gray)
- `tile-sidewalk.png` - Sidewalk tiles (lighter gray with border)
- `tile-building.png` - Generic building tiles (dark blue-gray)
- `tile-park.png` - Park/grass tiles (dark green with circle)
- `tile-intersection.png` - Street intersection tiles (dark gray with lines)
- `tile-residential.png` - Residential building tiles (lighter blue-gray with window)
- `tile-commercial.png` - Commercial building tiles (dark gray with window grid)
- `tile-industrial.png` - Industrial building tiles (brown-gray with stripe)

### Specifications:
- **Size**: 64x64 pixels (matches TILE_SIZE constant)
- **Format**: PNG with transparency support
- **Style**: Should match the dystopian city theme

### Implementation:
The TileMap class automatically:
1. Attempts to load PNG assets for each tile type
2. Creates fallback procedural textures for missing assets
3. Uses PNG textures when available, falls back to generated textures otherwise
4. Logs loading status to console for debugging

### Testing:
Currently implemented test tiles:
- ✅ `tile-street.png` - Basic dark gray square
- ✅ `tile-sidewalk.png` - Basic lighter gray square

Missing tiles will use procedurally generated fallbacks automatically.