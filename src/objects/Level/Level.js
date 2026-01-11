import { GameObject } from "../../GameObject.js";
import { TileSprite } from "../TileSprite/TileSprite.js";
import { Effects } from "../../Effects.js";
import { ChunkManager } from "../../ChunkManager.js";
import { CHUNK } from "../../Constants.js";

/**
 * #architecture #engine #performance
 * WORLD ARCHITECTURE STRATEGY:
 *
 * OPTION 1 - Zone-Based Architecture (default):
 * Design the world as multiple connected zones (Pokemon-style) rather than one massive map.
 * Each Level instance represents a discrete zone that loads/unloads independently.
 *
 * Recommended zone sizes:
 * - Open areas: 2,500 - 3,500 px per side
 * - Towns/villages: 1,500 - 2,000 px per side
 * - Indoor spaces: 500 - 800 px per side
 * - Dungeons/caves: 2,000 - 3,000 px per side
 *
 * Benefits:
 * - Pre-rendered layers stay manageable (~100-150 MB per zone)
 * - Y-sorting pool stays small (100-200 objects per zone)
 * - Natural loading points at zone boundaries
 * - Easy content authoring (edit one zone at a time)
 *
 * OPTION 2 - Chunk-Based Architecture (for huge maps):
 * Use chunking for continuous spaces larger than 5,000 × 5,000 px.
 * Enable by setting `useChunking = true` in your Level subclass.
 *
 * How to use chunking:
 * 1. Run tools/splitMap.js to convert your Tiled map to chunks
 * 2. Set `useChunking = true` in your Level subclass constructor
 * 3. Set `chunkMasterData` and `chunkTilesetImage` properties
 *
 * Benefits:
 * - Support for massive/infinite maps
 * - Only load chunks around player (9-16 chunks typically)
 * - Automatic loading/unloading as player moves
 * - Y-sorting pools remain small (per-chunk)
 *
 * #future #client #polish
 * FUTURE ENHANCEMENT - Smart Zone Transitions:
 * TODO: Add polished transition effects when changing levels:
 * - Fade out/in effect between zones
 * - Slide transition for seamless feel
 * - Directional awareness (position hero on correct edge of new zone)
 * - Transition sound effects
 * - Optional: Loading indicator for larger zones
 * - Consider: Brief pause for ambience change (music, lighting)
 */
export class Level extends GameObject {
  constructor() {
    super({});
    this.background = null;
    this.dynamicTilesCreated = false;
    this.effects = new Effects(); // Visual/environmental effects for this level
    this.walls = new Set(); // Collision walls

    // Chunking (automatically enabled for large maps)
    this.useChunking = false;
    this.chunkManager = null;
  }

  step(delta, root) {
    // Auto-detect if chunking should be used (only check once when tilemap loads)
    if (!this.dynamicTilesCreated && this.tiledMap && this.tiledMap.isLoaded && !this.useChunking) {
      this.autoDetectChunking();
    }

    // Non-chunked mode: Create TileSprite objects for dynamic layers once tilemap is loaded
    if (!this.useChunking && !this.dynamicTilesCreated && this.tiledMap && this.tiledMap.isLoaded) {
      this.createDynamicTiles();
      this.dynamicTilesCreated = true;
      this.walls = this.tiledMap.walls; // Use walls from TiledMap
    }

    // Chunked mode: Update chunks based on camera position
    if (this.useChunking && this.chunkManager && this.heroRef) {
      const cameraX = root.camera?.transformedPosition?.x || this.heroRef.x;
      const cameraY = root.camera?.transformedPosition?.y || this.heroRef.y;
      this.chunkManager.update(cameraX, cameraY, this);
    }

    super.step(delta, root);
  }

  /**
   * Auto-detect if chunking should be used based on map size
   */
  async autoDetectChunking() {
    if (!this.tiledMap || !this.tiledMap.isLoaded) return;

    const mapWidth = this.tiledMap.mapWidth;
    const mapHeight = this.tiledMap.mapHeight;
    const chunkWidth = CHUNK.TILES_WIDTH;
    const chunkHeight = CHUNK.TILES_HEIGHT;

    // If map is larger than one chunk, try to use chunking
    if (mapWidth > chunkWidth || mapHeight > chunkHeight) {
      // Check if chunks exist
      const chunksExist = await this.checkChunksExist();

      if (chunksExist) {
        console.log(`Map is ${mapWidth}×${mapHeight} tiles - enabling chunking`);
        this.useChunking = true;
        this.dynamicTilesCreated = true; // Skip normal tile creation

        // Load master file and initialize chunking
        fetch(`${CHUNK.CHUNKS_PATH}master.json`)
          .then(res => res.json())
          .then(masterData => {
            this.chunkManager = new ChunkManager(masterData, this.tiledMap.tilesetResource.image);

            // Load initial chunks around spawn point
            if (this.heroStartPosition) {
              this.chunkManager.loadInitialChunks(
                this.heroStartPosition.x,
                this.heroStartPosition.y,
                this
              );
            }
          })
          .catch(err => {
            console.warn('Chunks not found, using traditional rendering:', err);
            this.useChunking = false;
            this.dynamicTilesCreated = false;
          });
      } else {
        console.warn(`Map is large (${mapWidth}×${mapHeight}) but chunks not found. Run: node tools/splitMap.js`);
      }
    }
  }

  /**
   * Check if chunk files exist
   */
  async checkChunksExist() {
    try {
      const response = await fetch(`${CHUNK.CHUNKS_PATH}master.json`);
      return response.ok;
    } catch {
      return false;
    }
  }


  /**
   * Clean up level resources when changing levels
   */
  destroy() {
    // Clean up chunks if chunking is enabled
    if (this.useChunking && this.chunkManager) {
      console.log('Unloading all chunks...');
      this.chunkManager.unloadAll(this);
      this.chunkManager = null;
    }

    // Clear walls
    if (this.walls) {
      this.walls.clear();
    }

    // Call parent destroy (cleans up children and removes from parent)
    super.destroy();

    console.log('Level destroyed and memory freed');
  }

  createDynamicTiles() {
    if (!this.tiledMap) return;

    // Parse tilemap if not already parsed
    if (this.tiledMap.layers.length === 0) {
      this.tiledMap.parse();
    }

    // Track which tile positions have been promoted to TileSprites (for future use)
    this.promotedTilePositions = new Set();

    let tileCount = 0;

    // Check all layers for tiles that need depth sorting
    for (const layer of this.tiledMap.layers) {
      if (!layer.visible) continue;

      for (const tile of layer.tiles) {
        // Check if this tile type has the 'depth' property
        const tileProps = this.tiledMap.tileProperties.get(tile.tileId);
        if (!tileProps || !tileProps.depth) continue; // Skip tiles without depth property

        // Include layer zIndex in key for future layer-specific logic
        const key = `${layer.zIndex},${tile.x},${tile.y}`;

        // Only create one TileSprite per position (skip if already promoted)
        if (this.promotedTilePositions.has(key)) continue;

        const tileSprite = new TileSprite(
          tile.tileId,
          tile.x,
          tile.y,
          this.tiledMap,
          tileProps,
          null // Regular layer tiles don't have names
        );
        this.addChild(tileSprite);
        this.promotedTilePositions.add(key); // Track for future use
        tileCount++;
      }
    }

    // Also check tileObjects from object layers (same logic - only if depth property)
    // Note: Object layer tiles sit ON TOP of layer tiles, so we DON'T add them
    // to promotedTilePositions (the layer tiles underneath should still render)
    for (const tileObj of this.tiledMap.tileObjects) {
      // Check if this tile type has the 'depth' property
      const tileProps = this.tiledMap.tileProperties.get(tileObj.tileId);
      if (!tileProps || !tileProps.depth) continue; // Skip tiles without depth property

      // Merge tile properties with object properties (object properties override)
      const mergedProps = { ...tileProps, ...tileObj.properties };

      const tileSprite = new TileSprite(
        tileObj.tileId,
        tileObj.x,
        tileObj.y,
        this.tiledMap,
        mergedProps,
        tileObj.name // Object layer tiles have names
      );
      this.addChild(tileSprite);
      tileCount++;
    }
  }
}