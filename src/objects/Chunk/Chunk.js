import { GameObject } from "../../GameObject.js";
import { TileSprite } from "../TileSprite/TileSprite.js";
import { CULLING, TILE } from "../../Constants.js";

/**
 * Chunk - Represents a single chunk of the game world
 *
 * Each chunk is a self-contained piece of the map that can be loaded/unloaded independently.
 * Contains its own static layer pre-rendering and manages TileSprites for depth-sorted tiles.
 */
export class Chunk extends GameObject {
  constructor(chunkX, chunkY, chunkData, masterData, tilesetImage) {
    super({});

    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkData = chunkData;
    this.masterData = masterData;
    this.tilesetImage = tilesetImage;

    // Calculate chunk position in pixels (world coordinates)
    this.worldX = chunkX * masterData.chunkWidth * masterData.tileWidth;
    this.worldY = chunkY * masterData.chunkHeight * masterData.tileHeight;

    // Rendering properties
    this.tilesPerRow = 0; // Calculated from tileset
    this.staticLayersCanvas = null;
    this.animatedLayers = [];
    this.staticLayers = [];
    this.isInitialized = false;

    // Animation state
    this.animationTime = 0;
    this.tileAnimationStates = new Map();

    // Tile properties from master data
    this.tileProperties = new Map();
    this.animations = new Map();

    // Collision walls for this chunk
    this.walls = new Set();

    // Parse tileset properties
    this.parseTilesetProperties();

    // Initialize the chunk
    this.initialize();
  }

  parseTilesetProperties() {
    if (!this.masterData.tilesets || this.masterData.tilesets.length === 0) {
      return;
    }

    const tileset = this.masterData.tilesets[0];

    // Parse tile properties
    if (tileset.tiles) {
      tileset.tiles.forEach((tile) => {
        const tileId = tile.id;

        // Store properties
        if (tile.properties) {
          const props = {};
          tile.properties.forEach((prop) => {
            props[prop.name] = prop.value;
          });
          this.tileProperties.set(tileId, props);
        }

        // Store animation data
        if (tile.animation) {
          this.animations.set(tileId, {
            frames: tile.animation.map((frame) => ({
              tileId: frame.tileid,
              duration: frame.duration,
            })),
          });

          // Initialize animation state
          this.tileAnimationStates.set(tileId, {
            currentFrameIndex: 0,
            timeInFrame: 0,
          });
        }
      });
    }
  }

  initialize() {
    // Calculate tiles per row in tileset
    this.tilesPerRow = Math.floor(
      this.tilesetImage.width / this.masterData.tileWidth
    );

    // Separate static and animated layers
    this.separateStaticAndAnimatedLayers();

    // Pre-render static layers
    if (this.staticLayers.length > 0) {
      this.prerenderStaticLayers();
    }

    // Create TileSprites for tiles with depth property
    this.createDepthTiles();

    this.isInitialized = true;
  }

  separateStaticAndAnimatedLayers() {
    this.chunkData.layers.forEach((layer, index) => {
      if (layer.type !== "tilelayer") return;

      // Convert layer data to tile array
      const tiles = [];
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0) continue; // Empty tile

        const tileId = gid - 1; // Tiled uses 1-based, we use 0-based
        const localTileX = i % this.masterData.chunkWidth;
        const localTileY = Math.floor(i / this.masterData.chunkWidth);

        // World position (chunk offset + local position)
        const x = this.worldX + localTileX * this.masterData.tileWidth;
        const y = this.worldY + localTileY * this.masterData.tileHeight;

        tiles.push({ tileId, x, y });

        // Check collision properties
        const props = this.tileProperties.get(tileId);
        const posKey = `${x},${y}`;

        // If tile has collide=true, add to walls
        // Otherwise remove from walls (upper layers override lower layers)
        if (props && props.collide) {
          this.walls.add(posKey);
        } else {
          // No collide property = treat as collide:false, override lower layers
          this.walls.delete(posKey);
        }
      }

      const processedLayer = {
        name: layer.name,
        zIndex: index,
        visible: layer.visible !== false,
        opacity: layer.opacity ?? 1,
        tiles,
      };

      // Check if layer has animated tiles
      const hasAnimatedTiles = tiles.some((tile) =>
        this.tileAnimationStates.has(tile.tileId)
      );

      if (hasAnimatedTiles) {
        this.animatedLayers.push(processedLayer);
      } else {
        this.staticLayers.push(processedLayer);
      }
    });
  }

  prerenderStaticLayers() {
    const chunkPixelWidth =
      this.masterData.chunkWidth * this.masterData.tileWidth;
    const chunkPixelHeight =
      this.masterData.chunkHeight * this.masterData.tileHeight;

    this.staticLayersCanvas = document.createElement("canvas");
    this.staticLayersCanvas.width = chunkPixelWidth;
    this.staticLayersCanvas.height = chunkPixelHeight;

    const ctx = this.staticLayersCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Sort static layers by zIndex
    const sortedStaticLayers = [...this.staticLayers].sort(
      (a, b) => a.zIndex - b.zIndex
    );

    // Draw all static tiles to offscreen canvas
    sortedStaticLayers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      layer.tiles.forEach((tile) => {
        // Skip tiles with depth property (rendered as TileSprites)
        const tileProps = this.tileProperties.get(tile.tileId);
        if (tileProps && tileProps.depth) return;

        // Draw tile (using local coordinates within chunk)
        const localX = tile.x - this.worldX;
        const localY = tile.y - this.worldY;

        const srcX =
          (tile.tileId % this.tilesPerRow) * this.masterData.tileWidth;
        const srcY =
          Math.floor(tile.tileId / this.tilesPerRow) *
          this.masterData.tileHeight;

        ctx.drawImage(
          this.tilesetImage,
          srcX,
          srcY,
          this.masterData.tileWidth,
          this.masterData.tileHeight,
          localX,
          localY,
          this.masterData.tileWidth,
          this.masterData.tileHeight
        );
      });

      ctx.restore();
    });
  }

  createDepthTiles() {
    const promotedPositions = new Set();

    // Process tile layers
    this.chunkData.layers.forEach((layer, zIndex) => {
      if (layer.type !== "tilelayer") return;

      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0) continue;

        const tileId = gid - 1;
        const tileProps = this.tileProperties.get(tileId);

        if (!tileProps || !tileProps.depth) continue;

        const localTileX = i % this.masterData.chunkWidth;
        const localTileY = Math.floor(i / this.masterData.chunkWidth);
        const worldX = this.worldX + localTileX * this.masterData.tileWidth;
        const worldY = this.worldY + localTileY * this.masterData.tileHeight;

        const key = `${zIndex},${worldX},${worldY}`;
        if (promotedPositions.has(key)) continue;

        // Check if this depth tile has collision
        if (tileProps.collide) {
          const posKey = `${worldX},${worldY}`;
          this.walls.add(posKey);
        }

        // Create a mini TiledMap-like object for TileSprite compatibility
        const miniMap = {
          tilesetResource: { image: this.tilesetImage },
          tileWidth: this.masterData.tileWidth,
          tileHeight: this.masterData.tileHeight,
          tileProperties: this.tileProperties,
          animations: this.animations,
          getAnimation: (id) => this.animations.get(id),
        };

        const tileSprite = new TileSprite(
          tileId,
          worldX,
          worldY,
          miniMap,
          tileProps,
          null
        );

        this.addChild(tileSprite);
        promotedPositions.add(key);
      }
    });

    // Process object layers
    this.chunkData.layers.forEach((layer) => {
      if (layer.type !== "objectgroup") return;
      if (!layer.objects) return;

      layer.objects.forEach((obj) => {
        if (!obj.gid) return;

        const tileId = obj.gid - 1;
        const tileProps = this.tileProperties.get(tileId);

        if (!tileProps || !tileProps.depth) return;

        // Convert object position to world coordinates
        const worldX = this.worldX + obj.x;
        const worldY = this.worldY + obj.y - obj.height; // Tiled bottom-left to top-left

        // Parse object properties
        const objProps = { ...tileProps };
        if (obj.properties) {
          obj.properties.forEach((prop) => {
            objProps[prop.name] = prop.value;
          });
        }

        // Check collision for tile objects
        const hasCollision = objProps.collide;
        if (hasCollision) {
          const posKey = `${worldX},${worldY}`;
          this.walls.add(posKey);
        }

        const miniMap = {
          tilesetResource: { image: this.tilesetImage },
          tileWidth: this.masterData.tileWidth,
          tileHeight: this.masterData.tileHeight,
          tileProperties: this.tileProperties,
          animations: this.animations,
          getAnimation: (id) => this.animations.get(id),
        };

        const tileSprite = new TileSprite(
          tileId,
          worldX,
          worldY,
          miniMap,
          objProps,
          obj.name
        );

        this.addChild(tileSprite);
      });
    });
  }

  step(delta, root) {
    // Update animations
    if (this.isInitialized) {
      this.animationTime += delta;
      this.updateAnimations(delta);
    }

    super.step(delta, root);
  }

  updateAnimations(delta) {
    this.tileAnimationStates.forEach((state, tileId) => {
      const animData = this.animations.get(tileId);
      if (!animData) return;

      state.timeInFrame += delta;
      const currentFrame = animData.frames[state.currentFrameIndex];

      if (state.timeInFrame >= currentFrame.duration) {
        state.timeInFrame -= currentFrame.duration;
        state.currentFrameIndex =
          (state.currentFrameIndex + 1) % animData.frames.length;
      }
    });
  }

  drawImage(ctx, drawPosX, drawPosY) {
    if (!this.isInitialized) return;

    // Calculate draw position for this chunk
    const chunkDrawX = drawPosX + this.worldX;
    const chunkDrawY = drawPosY + this.worldY;

    // Draw pre-rendered static layers
    if (this.staticLayersCanvas) {
      ctx.drawImage(this.staticLayersCanvas, chunkDrawX, chunkDrawY);
    }

    // Sort animated layers by zIndex
    const sortedAnimatedLayers = [...this.animatedLayers].sort(
      (a, b) => a.zIndex - b.zIndex
    );

    // Draw animated layers with culling
    sortedAnimatedLayers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      layer.tiles.forEach((tile) => {
        const tileProps = this.tileProperties.get(tile.tileId);
        if (tileProps && tileProps.depth) return;

        this.drawTile(ctx, tile, drawPosX, drawPosY);
      });

      ctx.restore();
    });
  }

  drawTile(ctx, tile, offsetX, offsetY) {
    let { tileId, x, y } = tile;

    const tileDrawX = x + offsetX;
    const tileDrawY = y + offsetY;
    const tileWidth = this.masterData.tileWidth;
    const tileHeight = this.masterData.tileHeight;
    const padding = CULLING.TILE_PADDING;

    // Off-screen culling
    if (
      tileDrawX + tileWidth < -padding ||
      tileDrawX > ctx.canvas.width + padding ||
      tileDrawY + tileHeight < -padding ||
      tileDrawY > ctx.canvas.height + padding
    ) {
      return;
    }

    // Check animation
    const animState = this.tileAnimationStates.get(tileId);
    if (animState) {
      const animData = this.animations.get(tileId);
      const currentFrame = animData.frames[animState.currentFrameIndex];
      tileId = currentFrame.tileId;
    }

    // Draw tile
    const srcX = (tileId % this.tilesPerRow) * tileWidth;
    const srcY = Math.floor(tileId / this.tilesPerRow) * tileHeight;

    ctx.drawImage(
      this.tilesetImage,
      srcX,
      srcY,
      tileWidth,
      tileHeight,
      tileDrawX,
      tileDrawY,
      tileWidth,
      tileHeight
    );
  }

  /**
   * Cleanup method to destroy this chunk and free resources
   */
  destroy() {
    // Remove all children (TileSprites)
    while (this.children.length > 0) {
      this.removeChild(this.children[0]);
    }

    // Clear canvas
    if (this.staticLayersCanvas) {
      this.staticLayersCanvas.width = 0;
      this.staticLayersCanvas.height = 0;
      this.staticLayersCanvas = null;
    }

    // Clear references
    this.chunkData = null;
    this.tilesetImage = null;
    this.animatedLayers = [];
    this.staticLayers = [];
    this.tileAnimationStates.clear();
    this.tileProperties.clear();
    this.animations.clear();
    this.walls.clear();

    this.isInitialized = false;
  }
}
