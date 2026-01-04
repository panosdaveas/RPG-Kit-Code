import { GameObject } from "../../GameObject.js";
import { DISPLAY, TIME_OF_DAY } from "../../constants.js";

/**
 * Manages time-of-day lighting effects using screen overlays.
 */
export class TimeOfDayEffect extends GameObject {
  constructor() {
    super({});
    this.drawLayer = "HUD"; // Render on HUD layer (screen-fixed)

    this.canvasWidth = DISPLAY.CANVAS_WIDTH;
    this.canvasHeight = DISPLAY.CANVAS_HEIGHT;

    // Time of day states with overlay colors
    this.states = {
      day: null, // No overlay during day
      dusk: {
        color: TIME_OF_DAY.DUSK.COLOR, // Warm orange/pink
        blendMode: TIME_OF_DAY.BLEND_MODE
      },
      night: {
        color: TIME_OF_DAY.NIGHT.COLOR, // Dark blue
        blendMode: TIME_OF_DAY.BLEND_MODE
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
