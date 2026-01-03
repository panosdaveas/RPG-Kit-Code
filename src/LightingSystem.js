/**
 * Handles rendering of the night overlay with pixelated light sources.
 * Punches holes in the darkness overlay where lights are positioned.
 */
export class LightingSystem {
  constructor() {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = 768;
    this.overlayCanvas.height = 432;
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
    overlayCtx.clearRect(0, 0, 768, 432);

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
    const pixelSize = 8;
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
    gradient.addColorStop(0.4, `rgba(0, 0, 0, ${light.intensity})`);
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${light.intensity * 0.5})`);
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
