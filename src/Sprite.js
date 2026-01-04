import { Vector2 } from "./Vector2.js";
import { GameObject } from "./GameObject.js";
import { SPRITE, CULLING } from "./constants.js";

export class Sprite extends GameObject {
  constructor({
    resource, // image we want to draw
    frameSize, // size of the crop of the image
    hFrames, // how the sprite arranged horizontally
    vFrames, // how the sprite arranged vertically
    frame, // which frame we want to show
    scale, // how large to draw this image
    position, // where to draw it (top left corner)
    animations,
  }) {
    super({
      name
    });
    this.resource = resource;
    this.frameSize = frameSize ?? new Vector2(SPRITE.DEFAULT_FRAME_SIZE, SPRITE.DEFAULT_FRAME_SIZE);
    this.hFrames = hFrames ?? SPRITE.DEFAULT_HORIZONTAL_FRAMES;
    this.vFrames = vFrames ?? SPRITE.DEFAULT_VERTICAL_FRAMES;
    this.frame = frame ?? SPRITE.DEFAULT_FRAME_INDEX;
    this.frameMap = new Map();
    this.scale = scale ?? SPRITE.DEFAULT_SCALE;
    this.position = position ?? new Vector2(0, 0);
    this.animations = animations ?? null;
    this.buildFrameMap();
  }

  buildFrameMap() {
    let frameCount = 0;
    for (let v = 0; v < this.vFrames; v++) {
      for (let h = 0; h < this.hFrames; h++) {
        this.frameMap.set(
          frameCount,
          new Vector2(this.frameSize.x * h, this.frameSize.y * v)
        )
        frameCount++;
      }
    }
  }

  step(delta) {
    if (!this.animations) {
      return;
    }
    this.animations.step(delta);
    this.frame = this.animations.frame;
  }

  drawImage(ctx, x, y) {
    if (!this.resource.isLoaded) {
      return;
    }

    // Off-screen culling: skip rendering if sprite is outside viewport
    const spriteWidth = this.frameSize.x * this.scale;
    const spriteHeight = this.frameSize.y * this.scale;
    const padding = CULLING.SPRITE_PADDING; // Buffer to account for sprites partially visible

    // Check if sprite is completely off-screen
    if (x + spriteWidth < -padding ||
      x > ctx.canvas.width + padding ||
      y + spriteHeight < -padding ||
      y > ctx.canvas.height + padding) {
      return; // Skip rendering
    }

    // Find the correct sprite sheet frame to use
    let frameCoordX = 0;
    let frameCoordY = 0;
    const frame = this.frameMap.get(this.frame);
    if (frame) {
      frameCoordX = frame.x;
      frameCoordY = frame.y;
    }

    const frameSizeX = this.frameSize.x;
    const frameSizeY = this.frameSize.y;

    ctx.drawImage(
      this.resource.image,
      frameCoordX,
      frameCoordY, // Top Y corner of frame
      frameSizeX, //How much to crop from the sprite sheet (X)
      frameSizeY, //How much to crop from the sprite sheet (Y)
      x, //Where to place this on canvas tag X (0)
      y, //Where to place this on canvas tag Y (0)
      frameSizeX * this.scale, //How large to scale it (X)
      frameSizeY * this.scale, //How large to scale it (Y)
    );
  }

}