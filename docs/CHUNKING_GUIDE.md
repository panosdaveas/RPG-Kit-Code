# Chunking System Guide

This guide explains how the **automatic** chunking system works in RPG-Kit.

## How It Works

**Chunking is automatic!** The Level class detects if your map is larger than 64×64 tiles and automatically enables chunking if chunk files exist.

**What happens:**
- Small maps (≤ 64×64 tiles): Uses traditional TileLayerRenderer
- Large maps (> 64×64 tiles) + chunks exist: Automatically uses chunking
- Large maps without chunks: Shows warning to run splitMap.js

## How Chunking Works

The chunking system splits your large map into smaller "chunks" (64×64 tiles by default). Only chunks near the player are loaded into memory, allowing for massive or even infinite worlds.

**Performance:**
- Only 9-16 chunks active at once (depending on `LOAD_MARGIN`)
- Each chunk maintains its own Y-sorting pool
- Static layers pre-rendered per chunk
- Automatic loading/unloading as player moves

## Usage (Super Simple!)

### Step 1: Split Your Large Map

If your map is larger than 64×64 tiles:

```bash
node tools/splitMap.js public/maps/your-large-map.json
```

That's it! Chunks will be created in `public/maps/chunks/`

### Step 2: Use Your Level Normally

**No code changes needed!** Your existing level code works as-is:

```javascript
import { Level } from "../objects/Level/Level.js";
import { TiledMap } from "../TiledMap.js";
import { TileLayerRenderer } from "../objects/TileLayerRenderer/TileLayerRenderer.js";
import { resources } from "../Resource.js";

export class MyLevel extends Level {
  constructor(params = {}) {
    super();

    // Same code as always - chunking auto-detected!
    this.tiledMap = new TiledMap(
      resources.json.myMap,
      resources.images.myTileset
    );

    const renderer = new TileLayerRenderer(this.tiledMap);
    this.addChild(renderer);

    this.walls = this.tiledMap.walls;
    this.heroStartPosition = new Vector2(560, 400);
  }
}
```

**The Level class automatically:**
- Detects if map > 64×64 tiles
- Checks if chunks exist
- Enables chunking if needed
- Falls back to traditional rendering if chunks don't exist

### Step 3: Configure Chunk Settings (Optional)

Edit `src/constants.js` to adjust chunk settings:

```javascript
export const CHUNK = {
  TILES_WIDTH: 64,    // Chunk width in tiles
  TILES_HEIGHT: 64,   // Chunk height in tiles
  LOAD_MARGIN: 1,     // Chunks to load beyond viewport (1 = 3×3 grid)
  CHUNKS_PATH: 'public/maps/chunks/',
  MASTER_FILE: 'master.json',
};
```

**LOAD_MARGIN values:**
- `1` = 3×3 chunk grid (9 chunks) - recommended
- `2` = 5×5 chunk grid (25 chunks) - smoother but more memory

## Console Output

When chunking is enabled, you'll see:

```
Map is 200×150 tiles - enabling chunking
Loading initial chunks around (560, 400)...
Loaded chunk 0,0
Loaded chunk 0,1
...
```

When a map is too large but chunks don't exist:

```
Map is large (200×150) but chunks not found. Run: node tools/splitMap.js
```

## How Depth Tiles Work with Chunks

Tiles with the `depth` property (for Y-sorting) work automatically:

1. **In Tiled:** Add custom property `depth: true` to tiles that need Y-sorting
2. **During chunk creation:** `Chunk` class promotes depth tiles to `TileSprite` objects
3. **During rendering:** Each chunk maintains its own static/dynamic Y-sorting pools
4. **Result:** Y-sorting pools stay small even with huge maps

## Collision Detection with Chunks

Collision walls are stored in the master data and loaded with each chunk. The `ChunkManager` handles this automatically - no changes needed to your collision code.

## Multiplayer Considerations

For multiplayer games, ensure chunks are loaded for all active players:

```javascript
step(delta, root) {
  if (this.useChunking && this.chunkManager) {
    // Load chunks around main hero
    const heroX = this.heroRef.x;
    const heroY = this.heroRef.y;
    this.chunkManager.update(heroX, heroY, this);

    // Also load chunks around remote players
    for (const player of this.remotePlayers) {
      this.chunkManager.update(player.x, player.y, this);
    }
  }

  super.step(delta, root);
}
```

## Debugging

**Check active chunks:**
```javascript
console.log("Active chunks:", this.chunkManager.getActiveChunkKeys());
console.log("Chunk count:", this.chunkManager.getActiveChunkCount());
```

**Monitor chunk loading:**
The `ChunkManager` logs chunk load/unload events to the console:
- `Loaded chunk 5,7` - Chunk at grid position (5, 7) loaded
- `Unloaded chunk 2,3` - Chunk at (2, 3) unloaded

## Performance Tips

1. **Chunk size:** 64×64 tiles is a good default. Smaller chunks = more granular loading but more files
2. **Load margin:** Start with `LOAD_MARGIN: 1` (3×3 grid). Increase if you see pop-in
3. **Empty chunks:** The splitter automatically skips empty chunks to save files
4. **Animation:** Animated tiles work in chunks but update only when chunk is loaded

## Troubleshooting

**Chunks not loading:**
- Check that `CHUNKS_PATH` in constants.js matches your chunk directory
- Verify master.json exists and is valid JSON
- Check browser console for fetch errors

**Chunks loading slowly:**
- Reduce `LOAD_MARGIN` to load fewer chunks
- Increase chunk size to have fewer total chunks
- Consider preloading chunks around spawn point

**Y-sorting issues:**
- Ensure tiles have `depth: true` property in Tiled
- Check that `sortingOffsetY` is set correctly on TileSprites
- Verify chunks are added to level scene graph

**Memory issues:**
- Reduce `LOAD_MARGIN` to keep fewer chunks active
- Check for chunk leaks (use `getActiveChunkCount()`)
- Ensure `destroy()` is called when level changes
