import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { Light } from "../Light/Light.js";
import { DISPLAY, CULLING, LIGHTING } from "../../Constants.js";

/**
 * Lightweight sprite for depth-sorted tiles from Tiled object layers.
 * Participates in Y-sorting with GameObjects but has minimal overhead.
 */
export class TileSprite extends GameObject {
  constructor(tileId, x, y, tiledMap, properties = {}, name = null) {
    // Position at BOTTOM of tile for proper Y-sorting with hero
    super({ position: new Vector2(x, y + tiledMap.tileHeight) });

    this.tileId = tileId;
    this.name = name;
    this.properties = properties;
    this.tilesetImage = tiledMap.tilesetResource.image;
    this.tileWidth = tiledMap.tileWidth;
    this.tileHeight = tiledMap.tileHeight;
    this.spriteOffsetY = -tiledMap.tileHeight; // Draw sprite above the position

    // Calculate tileset dimensions
    this.tilesPerRow = Math.floor(
      this.tilesetImage.width / this.tileWidth
    );

    // Animation support
    const animData = tiledMap.getAnimation(tileId);
    if (animData) {
      this.animation = {
        frames: animData.frames,
        currentFrameIndex: 0,
        timeInFrame: 0
      };
    }

    this.updateSourceCoordinates();

    // this.addChild(this.sprite);
    if (this.properties.highlight) {
      const light = new Light(LIGHTING.HIGHLIGHT_RADIUS, LIGHTING.HIGHLIGHT_INTENSITY); // 60px radius, 80% intensity
      light.position = new Vector2(LIGHTING.LIGHT_OFFSET_X, LIGHTING.LIGHT_OFFSET_Y); // Slightly above NPC's feet
      this.addChild(light);
    }
  }

  updateSourceCoordinates() {
    const currentTileId = this.animation
      ? this.animation.frames[this.animation.currentFrameIndex].tileId
      : this.tileId;

    this.srcX = (currentTileId % this.tilesPerRow) * this.tileWidth;
    this.srcY = Math.floor(currentTileId / this.tilesPerRow) * this.tileHeight;
  }

  drawImage(ctx, drawPosX, drawPosY) {
    const padding = CULLING.SPRITE_PADDING;

    // Apply sprite offset (draw tile above the position)
    const adjustedDrawPosY = drawPosY + this.spriteOffsetY;

    // Off-screen culling
    if (drawPosX + this.tileWidth < -padding ||
        drawPosX > ctx.canvas.width + padding ||
        adjustedDrawPosY + this.tileHeight < -padding ||
        adjustedDrawPosY > ctx.canvas.height + padding) {
      return;
    }

    // Check if tileset is loaded
    if (!this.tilesetImage.complete) {
      return;
    }

    // Draw the tile
    ctx.drawImage(
      this.tilesetImage,
      this.srcX,
      this.srcY,
      this.tileWidth,
      this.tileHeight,
      drawPosX,
      adjustedDrawPosY,
      this.tileWidth,
      this.tileHeight
    );
  }

  // Update animation if tile is animated
  step(delta, root) {
    if (!this.animation) return;

    // Skip animation updates for off-screen tiles (performance optimization)
    // Get camera position from root (Main object)
    const camera = root?.camera;
    if (camera) {
      const canvasWidth = DISPLAY.CANVAS_WIDTH;
      const canvasHeight = DISPLAY.CANVAS_HEIGHT;
      const padding = CULLING.SPRITE_PADDING;

      const worldX = -camera.position.x;
      const worldY = -camera.position.y;

      // Check if tile is off-screen
      if (this.position.x + this.tileWidth < worldX - padding ||
          this.position.x > worldX + canvasWidth + padding ||
          this.position.y < worldY - padding ||
          this.position.y - this.tileHeight > worldY + canvasHeight + padding) {
        return; // Off-screen, skip animation update
      }
    }

    this.animation.timeInFrame += delta;
    const currentFrame = this.animation.frames[this.animation.currentFrameIndex];

    if (this.animation.timeInFrame >= currentFrame.duration) {
      this.animation.timeInFrame -= currentFrame.duration;
      this.animation.currentFrameIndex =
        (this.animation.currentFrameIndex + 1) % this.animation.frames.length;
      this.updateSourceCoordinates();
    }
  }

  // No initialization needed
  ready() {}
}
