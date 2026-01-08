import {GameObject} from "../../GameObject.js";
import {Vector2} from "../../Vector2.js";
import {resources} from "../../Resource.js";
import {Sprite} from "../../Sprite.js";
import {storyFlags} from "../../StoryFlags.js";
import {Highlight} from "../Light/Highlight.js";

export class Npc extends GameObject {
  constructor(x, y, textConfig={}) {
    super({
      position: new Vector2(x, y)
    });
    this.isDynamic = true;

    // Opt into being solid
    this.isSolid = true;
    this.sortingOffsetY = 1; // Offset for proper Y-sorting (matches Hero)

    // Say something when talking
    this.textContent = textConfig.content;
    this.textPortraitFrame = textConfig.portraitFrame;

    // Shadow under feet
    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-8, -19),
    })
    this.addChild(shadow);

    // Body sprite
    const body = new Sprite({
      resource: resources.images.npcs,
      frameSize: new Vector2(32, 32),
      hFrames: 4,
      vFrames: 1,
      frame: Math.floor(Math.random() * 4 + 1),
      position: new Vector2(-8, -20),
    })
    this.addChild(body);

    // Add light source for night mode
    // const light = new Light(4, 0.7); // 60px radius, 80% intensity
    // light.position = new Vector2(8, 2); // Slightly above NPC's feet
    // this.addChild(light);

    const light = new Highlight(6, 0.8); // 60px radius, 80% intensity
    light.position = new Vector2(8, -2); // Slightly above NPC's feet
    this.addChild(light);
  }

  getContent() {

    // Maybe expand with story flag logic, etc
    const match = storyFlags.getRelevantScenario(this.textContent);
    if (!match) {
      console.warn("No matches found in this list!", this.textContent);
      return null;
    }

    return {
      portraitFrame: this.textPortraitFrame,
      string: match.string,
      addsFlag: match.addsFlag ?? null
    }
  }

}