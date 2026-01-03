import { GameObject } from "../../GameObject.js";

/**
 * Light source that creates a radial glow effect.
 * Used to illuminate objects in dark environments.
 */
export class Light extends GameObject {
  constructor(radius = 50, intensity = 1.0) {
    super({});
    this.drawLayer = "LIGHTS"; // Render after HUD (on top of dark overlay)
    this.radius = radius;
    this.intensity = intensity;
  }

  drawImage(ctx, x, y) {
    ctx.save();

    // Use 'screen' blend mode to brighten (counteract darkness)
    ctx.globalCompositeOperation = 'screen';

    // Create radial gradient with pure WHITE to brighten without adding color
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, this.radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${this.intensity})`); // Pure white center
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${this.intensity * 0.5})`); // Medium
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Fade to nothing

    ctx.fillStyle = gradient;
    ctx.fillRect(x - this.radius, y - this.radius, this.radius * 2, this.radius * 2);

    ctx.restore();
  }
}
