import { GameObject } from "./GameObject.js";
import { events } from "./Events.js";
import { Vector2 } from "./Vector2.js";

export class Camera extends GameObject {
  constructor() {
    super({});

    // Dead zone configuration
    this.deadZoneWidth = 40;  // How far left/right hero can move before camera follows - change to 0 for instant follow
    this.deadZoneHeight = 30; // How far up/down hero can move before camera follows - change to 0 for instant follow

    events.on("HERO_POSITION", this, heroPosition => {
      this.updateCameraWithDeadZone(heroPosition);
    })

    // Camera knows when a new level starts
    events.on("CHANGE_LEVEL", this, (newMap) => {
      this.centerPositionOnTarget(newMap.heroStartPosition);
    })
  }

  updateCameraWithDeadZone(heroPosition) {
    const canvasWidth = 320;
    const canvasHeight = 180;
    const personHalf = 8;

    // Calculate where hero appears on screen with current camera position
    const heroScreenX = heroPosition.x + this.position.x + personHalf;
    const heroScreenY = heroPosition.y + this.position.y + personHalf;

    // Dead zone boundaries (centered on screen)
    const deadZoneLeft = canvasWidth / 2 - this.deadZoneWidth;
    const deadZoneRight = canvasWidth / 2 + this.deadZoneWidth;
    const deadZoneTop = canvasHeight / 2 - this.deadZoneHeight;
    const deadZoneBottom = canvasHeight / 2 + this.deadZoneHeight;

    // Adjust camera if hero is outside dead zone
    if (heroScreenX < deadZoneLeft) {
      this.position.x += deadZoneLeft - heroScreenX;
    } else if (heroScreenX > deadZoneRight) {
      this.position.x -= heroScreenX - deadZoneRight;
    }

    if (heroScreenY < deadZoneTop) {
      this.position.y += deadZoneTop - heroScreenY;
    } else if (heroScreenY > deadZoneBottom) {
      this.position.y -= heroScreenY - deadZoneBottom;
    }
  }

  centerPositionOnTarget(pos) {
    // Create a new position based on the incoming position
    const personHalf = 8;
    const canvasWidth = 320;
    const canvasHeight = 180;
    const halfWidth = -personHalf + canvasWidth / 2;
    const halfHeight = -personHalf + canvasHeight / 2;
    this.position = new Vector2(
      -pos.x + halfWidth,
      -pos.y + halfHeight,
    )
  }
}