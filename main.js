import './style.css'
import {Vector2} from "./src/Vector2.js";
import {GameLoop} from "./src/GameLoop.js";
import {Main} from "./src/objects/Main/Main.js";
import { MainMapLevel } from './src/levels/MainMapLevel.js';
import { DISPLAY } from './src/constants.js';

// Grabbing the canvas to draw to
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

// Get the device's pixel ratio (usually 1 on desktop, 2+ on high-DPI displays)
const dpr = window.devicePixelRatio || 1;

// Set internal canvas resolution to match device pixels
canvas.width = DISPLAY.CANVAS_WIDTH * dpr;
canvas.height = DISPLAY.CANVAS_HEIGHT * dpr;

// Scale the drawing context to compensate
ctx.scale(dpr, dpr);

// Establish the root scene
const mainScene = new Main({
  position: new Vector2(0,0)
})
mainScene.setLevel(new MainMapLevel({
  effects: {
    timeOfDay: "night", // Set time of day: "day", "dusk", or "night"
    // rain: true,       // Example: add more effects
  }
}))

// Establish update and draw loops
const update = (delta) => {
  mainScene.stepEntry(delta, mainScene);
  mainScene.input?.update();
};

const draw = () => {
  // Reset draw counter
  window.drawnCount = 0;

  // Clear anything stale
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  // Draw objects in the mounted scene (camera offset is handled in drawObjects)
  mainScene.drawObjects(ctx);

  // Draw anything above the game world
  mainScene.drawForeground(ctx);

  // Log draw count (every ~60 frames to avoid spam)
  if (Math.random() < 0.016) {
    console.log('Objects drawn this frame:', window.drawnCount);
  }
}

// Start the game!
const gameLoop = new GameLoop(update, draw);
gameLoop.start();
