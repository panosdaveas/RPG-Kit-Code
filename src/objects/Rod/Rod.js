import {GameObject} from "../../GameObject.js";
import {Vector2} from "../../Vector2.js";
import {Sprite} from "../../Sprite.js";
import {resources} from "../../Resource.js";
import {events} from "../../Events.js";
import { Light } from "../Light/Light.js";

export class Rod extends GameObject {
  constructor(x,y) {
    super({
      name: "Rod",
      position: new Vector2(x,y)
    });
    const sprite = new Sprite({
      resource: resources.images.rod,
      position: new Vector2(0, -5) // nudge upwards visually
    })
    this.addChild(sprite);
    const light = new Light(3, 1); // 60px radius, 80% intensity
    light.position = new Vector2(8, 0); // Slightly above NPC's feet
    this.addChild(light);

  }

  ready() {
    events.on("HERO_POSITION", this, pos => {
      // detect overlap...
      const roundedHeroX = Math.round(pos.x);
      const roundedHeroY = Math.round(pos.y);
      if (roundedHeroX === this.position.x && roundedHeroY === this.position.y) {
        this.onCollideWithHero();
      }
    })
  }

  onCollideWithHero() {
    // Remove this instance from the scene
    this.destroy();

    // Alert other things that we picked up a rod
    events.emit("HERO_PICKS_UP_ITEM", {
      type: "ROD",
      image: resources.images.rod,
      position: this.position
    })
  }



}