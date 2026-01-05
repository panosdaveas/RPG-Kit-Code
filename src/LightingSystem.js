import { DISPLAY, LIGHTING } from './Constants.js';

/**
 * Handles rendering of the night overlay with pixelated light sources.
 * Punches holes in the darkness overlay where lights are positioned.
 */
export class LightingSystem {
  constructor() {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = DISPLAY.CANVAS_WIDTH;
    this.overlayCanvas.height = DISPLAY.CANVAS_HEIGHT;
    this.lightCanvas = document.createElement('canvas');
  }

  /**
   * Renders the dark overlay with light holes punched through
   * @param {CanvasRenderingContext2D} ctx - Main canvas context
   * @param {TimeOfDayEffect} timeOfDayEffect - The dark overlay effect
   * @param {Array} lights - Array of Light objects
   * @param {Camera} camera - Camera for world position offset
   */
  render(ctx, timeOfDayEffect, lights, camera) {
    if (!timeOfDayEffect) return;

    const overlayCtx = this.overlayCanvas.getContext('2d');
    overlayCtx.clearRect(0, 0, DISPLAY.CANVAS_WIDTH, DISPLAY.CANVAS_HEIGHT);

    // Draw dark overlay to offscreen canvas
    timeOfDayEffect.draw(overlayCtx, 0, 0);

    // Punch holes in the overlay using lights
    lights.forEach(light => {
      this.renderLight(overlayCtx, light, camera);
    });

    // Draw the masked overlay to main canvas
    ctx.drawImage(this.overlayCanvas, 0, 0);
  }

  /**
   * Renders a single pixelated light by punching a hole in the overlay
   */
  renderLight(overlayCtx, light, camera) {
    // Calculate world position by traversing parent chain
    let worldX = 0;
    let worldY = 0;
    let current = light;
    while (current) {
      worldX += current.position.x;
      worldY += current.position.y;
      current = current.parent;
    }

    // Create small canvas for pixelated effect
    let pixelSize = LIGHTING.PIXEL_SIZE;
    if (light.constructor.name === 'Highlight') {
      pixelSize = LIGHTING.HIGHLIGHT_PIXEL_SIZE;
    }
    const lightSizeInPixels = Math.ceil(light.radius * 2 / pixelSize);
    this.lightCanvas.width = lightSizeInPixels;
    this.lightCanvas.height = lightSizeInPixels;

    const lightCtx = this.lightCanvas.getContext('2d');
    lightCtx.clearRect(0, 0, lightSizeInPixels, lightSizeInPixels);

    // Draw gradient to small canvas
    const centerX = lightSizeInPixels / 2;
    const centerY = lightSizeInPixels / 2;
    const gradient = lightCtx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, lightSizeInPixels / 2
    );

    // Larger inner radius with full intensity
    gradient.addColorStop(0, `rgba(0, 0, 0, ${light.intensity})`);
    gradient.addColorStop(LIGHTING.GRADIENT_STOP_1, `rgba(0, 0, 0, ${light.intensity})`);
    gradient.addColorStop(LIGHTING.GRADIENT_STOP_2, `rgba(0, 0, 0, ${light.intensity * LIGHTING.GRADIENT_FALLOFF})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    lightCtx.fillStyle = gradient;
    lightCtx.fillRect(0, 0, lightSizeInPixels, lightSizeInPixels);

    // Draw scaled-up pixelated light to overlay with destination-out
    overlayCtx.save();
    overlayCtx.globalCompositeOperation = 'destination-out';
    overlayCtx.imageSmoothingEnabled = false;
    overlayCtx.drawImage(
      this.lightCanvas,
      worldX + camera.position.x - light.radius,
      worldY + camera.position.y - light.radius,
      light.radius * 2,
      light.radius * 2
    );
    overlayCtx.restore();
  }
}
