import { Chunk } from "./objects/Chunk/Chunk.js";
import { CHUNK, DISPLAY } from "./constants.js";

/**
 * ChunkManager - Manages loading and unloading of map chunks
 *
 * Loads chunks around the camera position and unloads chunks outside the load margin.
 * This allows for very large (potentially infinite) maps without loading everything into memory.
 */
export class ChunkManager {
  constructor(masterData, tilesetImage) {
    this.masterData = masterData;
    this.tilesetImage = tilesetImage;

    // Active chunks map: "x,y" -> Chunk instance
    this.activeChunks = new Map();

    // Cache chunk file paths for faster loading
    this.chunkBasePath = CHUNK.CHUNKS_PATH;

    // Track last camera chunk to avoid unnecessary updates
    this.lastCameraChunkX = null;
    this.lastCameraChunkY = null;

    // Loading state
    this.isLoading = false;
    this.loadQueue = [];
  }

  /**
   * Get chunk coordinates from world position
   */
  getChunkCoords(worldX, worldY) {
    const chunkPixelWidth =
      this.masterData.chunkWidth * this.masterData.tileWidth;
    const chunkPixelHeight =
      this.masterData.chunkHeight * this.masterData.tileHeight;

    const chunkX = Math.floor(worldX / chunkPixelWidth);
    const chunkY = Math.floor(worldY / chunkPixelHeight);

    return { chunkX, chunkY };
  }

  /**
   * Calculate which chunks should be loaded based on camera position
   */
  getRequiredChunks(cameraX, cameraY) {
    const viewportWidth = DISPLAY.CANVAS_WIDTH;
    const viewportHeight = DISPLAY.CANVAS_HEIGHT;
    const margin = CHUNK.LOAD_MARGIN;

    const chunkPixelWidth =
      this.masterData.chunkWidth * this.masterData.tileWidth;
    const chunkPixelHeight =
      this.masterData.chunkHeight * this.masterData.tileHeight;

    // Calculate chunk range based on viewport
    const minChunkX = Math.floor(
      (cameraX - margin * chunkPixelWidth) / chunkPixelWidth
    );
    const maxChunkX = Math.ceil(
      (cameraX + viewportWidth + margin * chunkPixelWidth) / chunkPixelWidth
    );
    const minChunkY = Math.floor(
      (cameraY - margin * chunkPixelHeight) / chunkPixelHeight
    );
    const maxChunkY = Math.ceil(
      (cameraY + viewportHeight + margin * chunkPixelHeight) / chunkPixelHeight
    );

    // Clamp to map bounds
    const clampedMinX = Math.max(0, minChunkX);
    const clampedMaxX = Math.min(this.masterData.chunksX - 1, maxChunkX);
    const clampedMinY = Math.max(0, minChunkY);
    const clampedMaxY = Math.min(this.masterData.chunksY - 1, maxChunkY);

    return {
      minChunkX: clampedMinX,
      maxChunkX: clampedMaxX,
      minChunkY: clampedMinY,
      maxChunkY: clampedMaxY,
    };
  }

  /**
   * Update chunks based on camera position
   */
  async update(cameraX, cameraY, levelObject) {
    const { chunkX, chunkY } = this.getChunkCoords(cameraX, cameraY);

    // Skip if camera hasn't moved to a different chunk
    if (chunkX === this.lastCameraChunkX && chunkY === this.lastCameraChunkY) {
      return;
    }

    this.lastCameraChunkX = chunkX;
    this.lastCameraChunkY = chunkY;

    const required = this.getRequiredChunks(cameraX, cameraY);

    // Unload chunks outside required range
    const chunksToUnload = [];
    for (const [key, chunk] of this.activeChunks) {
      const [cx, cy] = key.split(",").map(Number);

      if (
        cx < required.minChunkX ||
        cx > required.maxChunkX ||
        cy < required.minChunkY ||
        cy > required.maxChunkY
      ) {
        chunksToUnload.push({ key, chunk });
      }
    }

    for (const { key, chunk } of chunksToUnload) {
      this.unloadChunk(key, chunk, levelObject);
    }

    // Load new chunks
    for (let cy = required.minChunkY; cy <= required.maxChunkY; cy++) {
      for (let cx = required.minChunkX; cx <= required.maxChunkX; cx++) {
        const key = `${cx},${cy}`;
        if (!this.activeChunks.has(key)) {
          await this.loadChunk(cx, cy, levelObject);
        }
      }
    }
  }

  /**
   * Load initial chunks around spawn position
   */
  async loadInitialChunks(spawnX, spawnY, levelObject) {
    const { chunkX, chunkY } = this.getChunkCoords(spawnX, spawnY);
    const required = this.getRequiredChunks(spawnX, spawnY);

    console.log(
      `Loading initial chunks around (${chunkX}, ${chunkY})...`
    );

    for (let cy = required.minChunkY; cy <= required.maxChunkY; cy++) {
      for (let cx = required.minChunkX; cx <= required.maxChunkX; cx++) {
        await this.loadChunk(cx, cy, levelObject);
      }
    }

    console.log(`Loaded ${this.activeChunks.size} initial chunks`);
  }

  /**
   * Load a single chunk
   */
  async loadChunk(chunkX, chunkY, levelObject) {
    const key = `${chunkX},${chunkY}`;

    // Skip if already loaded
    if (this.activeChunks.has(key)) {
      return;
    }

    try {
      // Load chunk JSON
      const chunkPath = `${this.chunkBasePath}chunk_${chunkX}_${chunkY}.json`;
      const response = await fetch(chunkPath);

      if (!response.ok) {
        // Chunk file doesn't exist (empty chunk)
        console.log(`Chunk ${key} not found (empty), skipping`);
        return;
      }

      const chunkData = await response.json();

      // Create chunk instance
      const chunk = new Chunk(
        chunkX,
        chunkY,
        chunkData,
        this.masterData,
        this.tilesetImage
      );

      // Add chunk to active chunks
      this.activeChunks.set(key, chunk);

      // Add chunk to level scene graph
      if (levelObject) {
        levelObject.addChild(chunk);

        // Update level walls
        this.updateLevelWalls(levelObject);
      }

      console.log(`Loaded chunk ${key}`);
    } catch (error) {
      console.error(`Error loading chunk ${key}:`, error);
    }
  }

  /**
   * Unload a single chunk
   */
  unloadChunk(key, chunk, levelObject) {
    // Remove from level scene graph
    if (levelObject) {
      levelObject.removeChild(chunk);
    }

    // Destroy chunk and free resources
    chunk.destroy();

    // Remove from active chunks
    this.activeChunks.delete(key);

    // Update level walls
    if (levelObject) {
      this.updateLevelWalls(levelObject);
    }

    console.log(`Unloaded chunk ${key}`);
  }

  /**
   * Update level's walls Set by aggregating all active chunk walls
   */
  updateLevelWalls(levelObject) {
    if (!levelObject) return;

    // Create new walls Set by combining all chunk walls
    const combinedWalls = new Set();

    for (const chunk of this.activeChunks.values()) {
      // Add all walls from this chunk to combined set
      for (const wall of chunk.walls) {
        combinedWalls.add(wall);
      }
    }

    // Update level's walls
    levelObject.walls = combinedWalls;
  }

  /**
   * Unload all chunks
   */
  unloadAll(levelObject) {
    // Collect all chunks first to avoid modifying map while iterating
    const chunksToUnload = Array.from(this.activeChunks.entries());

    for (const [key, chunk] of chunksToUnload) {
      // Remove from level scene graph
      if (levelObject) {
        levelObject.removeChild(chunk);
      }

      // Destroy chunk and free resources
      chunk.destroy();

      console.log(`Unloaded chunk ${key}`);
    }

    // Clear all chunks
    this.activeChunks.clear();

    // Clear level walls
    if (levelObject) {
      levelObject.walls = new Set();
    }

    console.log("All chunks unloaded and memory freed");
  }

  /**
   * Get all active chunks (for debugging)
   */
  getActiveChunkKeys() {
    return Array.from(this.activeChunks.keys());
  }

  /**
   * Get number of active chunks
   */
  getActiveChunkCount() {
    return this.activeChunks.size;
  }

  /**
   * Check if chunks are available for a given world position
   */
  hasChunksAt(worldX, worldY) {
    const { chunkX, chunkY } = this.getChunkCoords(worldX, worldY);
    return this.activeChunks.has(`${chunkX},${chunkY}`);
  }
}
