import { GameObject } from "../../GameObject.js";
import { resources } from "../../Resource.js";

/**
 * Screen-fixed rain effect that doesn't move with the camera.
 * Renders on HUD layer to stay fixed to the screen.
 * Uses sprite animation for realistic rain effect.
 */
export class ScreenRainEffect extends GameObject {
  constructor() {
    super({});
    this.drawLayer = "HUD"; // Render on HUD layer (screen-fixed)

    this.canvasWidth = 768;
    this.canvasHeight = 432;
    this.spriteWidth = 256;
    this.spriteHeight = 240;

    // Animation
    this.frames = [
      resources.images.rain1,
      resources.images.rain2,
      resources.images.rain3,
      resources.images.rain4
    ];
    this.currentFrameIndex = 0;
    this.frameDuration = 100; // milliseconds per frame
    this.timeInFrame = 0;

    this.isEnabled = false; // Start disabled
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  step(delta, root) {
    if (!this.isEnabled) return;

    // Animate through frames
    this.timeInFrame += delta;
    if (this.timeInFrame >= this.frameDuration) {
      this.timeInFrame -= this.frameDuration;
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
    }
  }

  drawImage(ctx, drawPosX, drawPosY) {
    if (!this.isEnabled) return;

    const currentFrame = this.frames[this.currentFrameIndex];
    if (!currentFrame || !currentFrame.isLoaded) return;

    const image = currentFrame.image;

    // Calculate how many tiles we need to cover the screen
    const tilesX = Math.ceil(this.canvasWidth / this.spriteWidth) + 1;
    const tilesY = Math.ceil(this.canvasHeight / this.spriteHeight) + 1;

    ctx.save();
    ctx.globalAlpha = 0.3; // Make rain semi-transparent

    // Tile the sprite across the screen
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        ctx.drawImage(
          image,
          x * this.spriteWidth,
          y * this.spriteHeight,
          this.spriteWidth,
          this.spriteHeight
        );
      }
    }

    ctx.restore();
  }
}
