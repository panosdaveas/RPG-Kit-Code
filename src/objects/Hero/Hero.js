import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { DOWN, LEFT, RIGHT, UP } from "../../Input.js";
import { gridCells, isSpaceFree } from "../../helpers/grid.js";
import { Sprite } from "../../Sprite.js";
import { resources } from "../../Resource.js";
import { Animations } from "../../Animations.js";
import { HeroAttributes } from "./HeroAttributes.js";
import { FrameIndexPattern } from "../../FrameIndexPattern.js";
import {
  PICK_UP_DOWN,
  STAND_DOWN,
  STAND_LEFT,
  STAND_RIGHT,
  STAND_UP,
  WALK_DOWN,
  WALK_LEFT,
  WALK_RIGHT,
  WALK_UP
} from "./heroAnimations.js";
import { moveTowards } from "../../helpers/moveTowards.js";
import { events } from "../../Events.js";
import { Light } from "../Light/Light.js";

export class Hero extends GameObject {
  constructor(x, y) {
    super({
      position: new Vector2(x, y)
    });
    
    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-7, -19),
    })
    this.addChild(shadow);

    this.body = new Sprite({
      resource: resources.images.hero,
      frameSize: new Vector2(32, 32),
      hFrames: 3,
      vFrames: 8,
      frame: 1,
      position: new Vector2(-8, -20),
      animations: new Animations({
        walkDown: new FrameIndexPattern(WALK_DOWN),
        walkUp: new FrameIndexPattern(WALK_UP),
        walkLeft: new FrameIndexPattern(WALK_LEFT),
        walkRight: new FrameIndexPattern(WALK_RIGHT),
        standDown: new FrameIndexPattern(STAND_DOWN),
        standUp: new FrameIndexPattern(STAND_UP),
        standLeft: new FrameIndexPattern(STAND_LEFT),
        standRight: new FrameIndexPattern(STAND_RIGHT),
        pickUpDown: new FrameIndexPattern(PICK_UP_DOWN),
      })
    })
    this.addChild(this.body);

    // Add light source for night mode
    const light = new Light(144, 1); // 60px radius, 80% intensity
    light.position = new Vector2(16, -10); // Slightly above hero's feet
    this.addChild(light);

    this.facingDirection = DOWN;
    this.destinationPosition = this.position.duplicate();
    this.itemPickupTime = 0;
    this.itemPickupShell = null;
    this.isLocked = false;
    this.isSolid = true;
    this.sortingOffsetY = 1; // Offset hero's sorting position for y-sorting
    this.attributes = new HeroAttributes();
    this.currentLevelId = null;

    // Track current animation for multiplayer
    this.currentAnimation = 'standDown';
    // Direction hold tracking for turn-in-place mechanic
    this.directionHeldTime = 0;
    this.lastDirection = null;
    this.movementThreshold = 80; // ms - adjust this value to tune the feel

    // React to picking up an item
    events.on("HERO_PICKS_UP_ITEM", this, data => {
      this.onPickUpItem(data)
    })
  }

  ready() {
    events.on("START_TEXT_BOX", this, () => {
      this.isLocked = true;
    })
    events.on("END_TEXT_BOX", this, () => {
      this.isLocked = false;
    })
    events.on("UI_OPEN", this, () => {
      this.isLocked = true;
    })
    events.on("UI_CLOSED", this, () => {
      this.isLocked = false;
    })
    events.on("UPDATE_HERO", this, (attr) => {
      this.attributes.set(attr.name, attr.value);
      this.broadcastAttributes();
    })
  }

  step(delta, root) {

    // Don't do anything when locked
    if (this.isLocked) {
      return;
    }

    // Lock movement if celebrating an item pickup
    if (this.itemPickupTime > 0) {
      this.workOnItemPickup(delta);
      return;
    }

    // Check for input
    /** @type {Input} */
    const input = root.input;
    if (input?.getActionJustPressed("Space")) {
      // Get the position the hero is facing
      const facingPosition = this.position.toNeighbor(this.facingDirection);

      // Look for an object at the next space (according to where Hero is facing)
      const objAtPosition = this.parent.children.find(child => {
        return child.position.matches(facingPosition)
      })
      if (objAtPosition) {
        events.emit("HERO_REQUESTS_ACTION", objAtPosition);
        console.log(this.attributes.getAll());
        console.log(objAtPosition);
      }

      // Debug feat
      // Look for a tile at the facing position
      if (!objAtPosition) {
        const tiledMap = root.level?.tiledMap;
        if (tiledMap) {
          // Search through all tile layers
          tiledMap.layers.forEach(layer => {
            const tile = layer.tiles.find(t => t.x === facingPosition.x && t.y === facingPosition.y);
            if (tile) {
              const tileProps = tiledMap.getTileProperties(tile.tileId);
              console.log("Tile found:", {
                position: { x: tile.x / 16, y: tile.y / 16 },
                tileId: tile.tileId,
                layer: layer.name,
                properties: tileProps
              });
            }
          });
        }
      }

    }

    // Track how long direction is held
    if (input?.direction) {
      if (input.direction === this.lastDirection) {
        this.directionHeldTime += delta;
      } else {
        // Direction changed, reset timer
        this.directionHeldTime = 0;
        this.lastDirection = input.direction;
      }
    } else {
      // No direction held, reset
      this.directionHeldTime = 0;
      this.lastDirection = null;
    }

    const distance = moveTowards(this, this.destinationPosition, 1);
    const hasArrived = distance <= 1;
    // Attempt to move again if the hero is at his position
    if (hasArrived) {
      this.tryMove(root)
    }

    this.tryEmitPosition()
  }

  tryEmitPosition() {
    if (this.lastX === this.position.x && this.lastY === this.position.y) {
      return;
    }
    this.lastX = this.position.x;
    this.lastY = this.position.y;
    events.emit("HERO_POSITION", this.position);

    // Broadcast to multiplayer
    this.broadcastState();
  }

  tryMove(root) {
    const { input } = root;

    if (!input.direction) {

      if (this.facingDirection === LEFT) {
        this.body.animations.play("standLeft");
        this.currentAnimation = 'standLeft';
      }
      if (this.facingDirection === RIGHT) {
        this.body.animations.play("standRight");
        this.currentAnimation = 'standRight';
      }
      if (this.facingDirection === UP) {
        this.body.animations.play("standUp");
        this.currentAnimation = 'standUp';
      }
      if (this.facingDirection === DOWN) {
        this.body.animations.play("standDown");
        this.currentAnimation = 'standDown';
      }

      // Broadcast animation change
      this.broadcastState();

      return;
    }

    let nextX = this.destinationPosition.x;
    let nextY = this.destinationPosition.y;
    const gridSize = 16;
    let intendedDirection = input.direction;

    // Always update facing direction and animation immediately
    if (intendedDirection === DOWN) {
      this.body.animations.play("walkDown");
      this.currentAnimation = 'walkDown';
      this.facingDirection = DOWN;
      if (this.directionHeldTime >= this.movementThreshold) {
        nextY += gridSize;
      }
    }
    if (intendedDirection === UP) {
      this.body.animations.play("walkUp");
      this.currentAnimation = 'walkUp';
      this.facingDirection = UP;
      if (this.directionHeldTime >= this.movementThreshold) {
        nextY -= gridSize;
      }
    }
    if (intendedDirection === LEFT) {
      this.body.animations.play("walkLeft");
      this.currentAnimation = 'walkLeft';
      this.facingDirection = LEFT;
      if (this.directionHeldTime >= this.movementThreshold) {
        nextX -= gridSize;
      }
    }
    if (intendedDirection === RIGHT) {
      this.body.animations.play("walkRight");
      this.currentAnimation = 'walkRight';
      this.facingDirection = RIGHT;
      if (this.directionHeldTime >= this.movementThreshold) {
        nextX += gridSize;
      }
    }

    // Validating that the next destination is free
    const spaceIsFree = isSpaceFree(root.level?.walls, nextX, nextY);
    const solidBodyAtSpace = this.parent.children.find(c => {
      return c.isSolid && c.position.x === nextX && c.position.y === nextY
    })
    if (spaceIsFree && !solidBodyAtSpace) {
      this.destinationPosition.x = nextX;
      this.destinationPosition.y = nextY;
    }

    // Broadcast animation change immediately
    this.broadcastState();
  }

  onPickUpItem({ image, position }) {
    // Make sure we land right on the item
    this.destinationPosition = position.duplicate();

    // Start the pickup animation
    this.itemPickupTime = 500; // ms

    this.itemPickupShell = new GameObject({});
    this.itemPickupShell.addChild(new Sprite({
      resource: image,
      position: new Vector2(0, -18)
    }))
    this.addChild(this.itemPickupShell);

    // Test attributes transmition
    this.attributes.set('health', 100);
    this.broadcastAttributes(); // Send update to server
    // console.log(this.attributes.getAll());
  }

  workOnItemPickup(delta) {
    this.itemPickupTime -= delta;
    this.body.animations.play("pickUpDown")

    // Remove the item being held overhead
    if (this.itemPickupTime <= 0) {
      this.itemPickupShell.destroy();
    }
  }

  // Broadcast state to server
  broadcastState() {
    events.emit("HERO_STATE_UPDATE", {
      x: this.position.x,
      y: this.position.y,
      animation: this.currentAnimation,
      facingDirection: this.facingDirection,
      // attributes: this.attributes.getAll(),
      levelId: this.currentLevelId
    });
  }

  // Separate event for attributes only
  broadcastAttributes() {
    console.log(this.attributes.getAll());
    events.emit("HERO_ATTRIBUTES_UPDATE", {
      attributes: this.attributes.getAll()
    });
  }
}