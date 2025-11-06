import './style.css'
import {Vector2} from "./src/Vector2.js";
import {GameLoop} from "./src/GameLoop.js";
import {Main} from "./src/objects/Main/Main.js";
import { MainMapLevel } from './src/levels/MainMapLevel.js';

// Grabbing the canvas to draw to
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

// Get the device's pixel ratio (usually 1 on desktop, 2+ on high-DPI displays)
const dpr = window.devicePixelRatio || 1;

// Set internal canvas resolution to match device pixels
canvas.width = 768 * dpr;
canvas.height = 432 * dpr;

// Scale the drawing context to compensate
ctx.scale(dpr, dpr);

// Establish the root scene
const mainScene = new Main({
  position: new Vector2(0,0)
})
mainScene.setLevel(new MainMapLevel())

// Establish update and draw loops
const update = (delta) => {
  mainScene.stepEntry(delta, mainScene);
  mainScene.input?.update();
};

const draw = () => {

  // Clear anything stale
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  // Draw objects in the mounted scene (camera offset is handled in drawObjects)
  mainScene.drawObjects(ctx);

  // Draw anything above the game world
  mainScene.drawForeground(ctx);

}

// Start the game!
const gameLoop = new GameLoop(update, draw);
gameLoop.start();
