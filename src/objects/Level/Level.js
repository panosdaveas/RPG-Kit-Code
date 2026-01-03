import {GameObject} from "../../GameObject.js";
import {TileSprite} from "../TileSprite/TileSprite.js";
import {Effects} from "../../Effects.js";

export class Level extends GameObject {
  constructor() {
    super({});
    this.background = null;
    this.dynamicTilesCreated = false;
    this.effects = new Effects(); // Visual/environmental effects for this level
  }

  step(delta, root) {
    // Create TileSprite objects for dynamic layers once tilemap is loaded
    if (!this.dynamicTilesCreated && this.tiledMap && this.tiledMap.isLoaded) {
      this.createDynamicTiles();
      this.dynamicTilesCreated = true;
    }

    super.step(delta, root);
  }

  createDynamicTiles() {
    if (!this.tiledMap) return;

    // Parse tilemap if not already parsed
    if (this.tiledMap.layers.length === 0) {
      this.tiledMap.parse();
    }

    // Track which tile positions have been promoted to TileSprites
    // This will be used by TileLayerRenderer to skip those tiles
    this.promotedTilePositions = new Set();

    let tileCount = 0;

    // Check all layers for tiles that need depth sorting
    for (const layer of this.tiledMap.layers) {
      if (!layer.visible) continue;

      for (const tile of layer.tiles) {
        // Check if this tile type has the 'depth' property
        const tileProps = this.tiledMap.tileProperties.get(tile.tileId);
        if (!tileProps || !tileProps.depth) continue; // Skip tiles without depth property

        // Include layer zIndex in key to only skip THIS layer's tile, not tiles below it
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
        this.promotedTilePositions.add(key); // Track to avoid duplicates
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