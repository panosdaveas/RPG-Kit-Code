import { GameObject } from "../../GameObject.js";

/**
 * Manages time-of-day lighting effects using screen overlays.
 */
export class TimeOfDayEffect extends GameObject {
  constructor() {
    super({});
    this.drawLayer = "HUD"; // Render on HUD layer (screen-fixed)

    this.canvasWidth = 768;
    this.canvasHeight = 432;

    // Time of day states with overlay colors
    this.states = {
      day: null, // No overlay during day
      dusk: {
        color: 'rgba(255, 120, 80, 0.35)', // Warm orange/pink
        blendMode: 'multiply'
      },
      night: {
        // color: 'rgba(20, 20, 60, 0.55)', // Dark blue
        color: 'rgba(9, 9, 43, 0.55)', // Dark blue
        blendMode: 'multiply'
      }
    };

    this.currentState = null; // Start with no effect
  }

  setState(state) {
    if (this.states.hasOwnProperty(state)) {
      this.currentState = state;
    }
  }

  drawImage(ctx, drawPosX, drawPosY) {
    if (!this.currentState || this.currentState === 'day') return;

    const state = this.states[this.currentState];
    if (!state) return;

    ctx.save();
    ctx.globalCompositeOperation = state.blendMode;
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    ctx.restore();
  }
}
