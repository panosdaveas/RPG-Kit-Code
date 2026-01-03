import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { Sprite } from "../../Sprite.js";
import { resources } from "../../Resource.js";
import { events } from "../../Events.js";
import { Animations } from "../../Animations.js";
import { FrameIndexPattern } from "../../FrameIndexPattern.js";
import { Light } from "../Light/Light.js";

export class Chest extends GameObject {
    constructor(x, y) {
        super({
            name: "Chest",
            position: new Vector2(x, y)
        });
        this.isSolid = true;
        this.isOpened = false;

        // Animation configs
        const CLOSED = {
            duration: 400,
            frames: [{ time: 0, frame: 2 }] // Frame 2 - closed chest
        };

        const OPEN = {
            duration: 400,
            frames: [{ time: 0, frame: 1 }] // Frame 1 - open chest
        };

        // Set up animations for different states
        const animations = new Animations({
            closed: new FrameIndexPattern(CLOSED),
            open: new FrameIndexPattern(OPEN),
            // Future: add opening animation if needed
            // opening: new FrameIndexPattern({
            //   duration: 200,
            //   frames: [
            //     { time: 0, frame: 2 },
            //     { time: 100, frame: 1 }
            //   ]
            // })
        });

        this.sprite = new Sprite({
            resource: resources.images.chest,
            frameSize: new Vector2(16, 16),
            hFrames: 2,
            vFrames: 1,
            animations: animations,
            position: new Vector2(0, -4),
        });

        // Start with closed state
        this.sprite.animations.play("closed");

        this.addChild(this.sprite);
        const light = new Light(4, 1); // 60px radius, 80% intensity
        light.position = new Vector2(8, 4); // Slightly above NPC's feet
        this.addChild(light);
    }

    ready() {
        events.on("HERO_REQUESTS_ACTION", this, (withObject) => {
            // Only respond if the hero is interacting with THIS chest
            if (withObject === this) {
                this.onInteractWithHero();
            }
        })
    }

    onInteractWithHero(){
        if (this.isOpened) return;

        this.isOpened = true;
        events.emit("UPDATE_HERO", ({name: 'health', value: 100}));

        // Play open animation
        this.sprite.animations.play("open");
    }
}