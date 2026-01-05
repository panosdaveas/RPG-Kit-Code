import { GameObject } from "../../GameObject.js";

/**
 * Simple highlight effect with a small radial gradient circle.
 * Creates a subtle glow at a specific point.
 */
export class Highlight extends GameObject {
  constructor(radius = 4, intensity = 1.0) {
    super({});
    this.drawLayer = "LIGHTS"; // Render on same layer as lights
    this.radius = radius;
    this.intensity = intensity;
  }

  drawImage(ctx, x, y) {
    ctx.save();

    // Use 'screen' blend mode to brighten
    ctx.globalCompositeOperation = 'screen';

    // Draw simple circle
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.intensity})`;
    ctx.fill();

    ctx.restore();
  }
}
