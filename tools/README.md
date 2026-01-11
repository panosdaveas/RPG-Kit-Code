# Map Splitter Tool

This tool splits large Tiled JSON maps into smaller chunks for efficient loading in the game.

## Usage

### Basic Usage

```bash
node tools/splitMap.js <input-map.json>
```

This will:
- Split the map into 64×64 tile chunks
- Output chunks to `public/maps/chunks/`
- Create a `master.json` file with metadata

### Advanced Usage

```bash
node tools/splitMap.js public/maps/mymap.json --chunk-width 32 --chunk-height 32 --output public/maps/chunks/
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--chunk-width <n>` | Chunk width in tiles | 64 |
| `--chunk-height <n>` | Chunk height in tiles | 64 |
| `--output <path>` | Output directory | `public/maps/chunks/` |

## Example

**Split the main map into chunks:**

```bash
node tools/splitMap.js public/maps/mainmap.json
```

**Output:**
```
🗺️  Map Splitter Tool
══════════════════════════════════════════════════
📂 Input:  public/maps/mainmap.json
📦 Output: public/maps/chunks/
📐 Chunk:  64×64 tiles
══════════════════════════════════════════════════

📊 Map Info:
   Size: 200×150 tiles (3200×2400 px)
   Tiles: 16×16 px each
   Chunks: 4×3 = 12 total

✅ Success!
   11 chunk files created
   1 master file created
   Output: public/maps/chunks/
```

## Output Structure

The tool creates:

### master.json
Contains metadata about the chunked map:
```json
{
  "version": "1.0",
  "chunkWidth": 64,
  "chunkHeight": 64,
  "chunksX": 4,
  "chunksY": 3,
  "mapWidth": 200,
  "mapHeight": 150,
  "tileWidth": 16,
  "tileHeight": 16,
  "tilesets": [...]
}
```

### chunk_X_Y.json
Individual chunk files (e.g., `chunk_0_0.json`, `chunk_1_0.json`):
```json
{
  "x": 0,
  "y": 0,
  "layers": [
    {
      "name": "Ground",
      "type": "tilelayer",
      "width": 64,
      "height": 64,
      "data": [...]
    }
  ]
}
```

## How It Works

1. **Reads** the input Tiled JSON map
2. **Splits** each layer into chunks based on chunk dimensions
3. **Handles** both tile layers and object layers
4. **Skips** empty chunks (all tiles are 0)
5. **Outputs** individual chunk JSON files + master file

### Tile Layers
- Data array is split into chunk-sized grids
- Tile positions are converted to chunk-local coordinates
- Layer properties (opacity, visibility) are preserved

### Object Layers
- Objects are assigned to chunks based on their position
- Object positions are converted to chunk-local coordinates
- Only objects within chunk bounds are included

## Tips

- **Chunk size:** 64×64 is good for most games (1024×1024 px with 16px tiles)
- **Smaller chunks:** More granular loading, but more files (slower initial load)
- **Larger chunks:** Fewer files, but less granular (may load unnecessary areas)
- **Empty chunks:** Automatically skipped to save disk space

## Integration

After splitting, use the chunks in your game:

```javascript
import { Level } from "../objects/Level/Level.js";

export class HugeMapLevel extends Level {
  constructor() {
    super();

    this.useChunking = true;

    // Load master data
    fetch('public/maps/chunks/master.json')
      .then(res => res.json())
      .then(data => {
        this.chunkMasterData = data;
        this.chunkTilesetImage = yourTilesetImage;
        this.initializeChunking();
      });
  }
}
```

See `docs/CHUNKING_GUIDE.md` for full integration guide.
