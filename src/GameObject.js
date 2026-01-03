import {Vector2} from "./Vector2.js";
import {events} from "./Events.js";

export class GameObject {
  constructor({ position }) {
    this.position = position ?? new Vector2(0, 0);
    this.children = [];
    this.parent = null;
    this.hasReadyBeenCalled = false;
    this.isSolid = false;
    this.drawLayer = null;
  }

  // First entry point of the loop
  stepEntry(delta, root) {
    // Call updates on all children first
    this.children.forEach((child) => child.stepEntry(delta, root));

    // Call ready on the first frame
    if (!this.hasReadyBeenCalled) {
      this.hasReadyBeenCalled = true;
      this.ready();
    }

    // Call any implemented Step code
    this.step(delta, root);
  }

  // Called before the first `step`
  ready() {
    // ...
  }

  // Called once every frame
  step(_delta) {
    // ...
  }

  /* draw entry */
  draw(ctx, x, y) {
    const drawPosX = x + this.position.x;
    const drawPosY = y + this.position.y;

    // Do the actual rendering for Images
    this.drawImage(ctx, drawPosX, drawPosY);

    // Pass on to children (skip children with special draw layers like HUD or LIGHTS)
    this.getDrawChildrenOrdered().forEach((child) => {
      // Skip children with HUD or LIGHTS drawLayer (they render in separate passes)
      if (child.drawLayer === "HUD" || child.drawLayer === "LIGHTS") {
        return;
      }
      child.draw(ctx, drawPosX, drawPosY);
    });
  }

  getDrawChildrenOrdered() {
    return [...this.children].sort((a,b) => {

      if (b.drawLayer === "FLOOR") {
        return 1;
      }

      // Use sortingOffsetY if defined, otherwise default to 0
      const aSortY = a.position.y + (a.sortingOffsetY ?? 0);
      const bSortY = b.position.y + (b.sortingOffsetY ?? 0);

      return aSortY > bSortY ? 1 : -1
    })
  }

  drawImage(ctx, drawPosX, drawPosY) {
    //...
  }

  // Remove from the tree
  destroy() {
    this.children.forEach(child => {
      child.destroy();
    })
    this.parent.removeChild(this)
  }

  /* Other Game Objects are nestable inside this one */
  addChild(gameObject) {
    gameObject.parent = this;
    this.children.push(gameObject);
  }

  removeChild(gameObject) {
    events.unsubscribe(gameObject);
    this.children = this.children.filter(g => {
      return gameObject !== g;
    })
  }
}