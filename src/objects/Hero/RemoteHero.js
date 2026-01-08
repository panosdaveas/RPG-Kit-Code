import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { Sprite } from "../../Sprite.js";
import { resources } from "../../Resource.js";
import { Animations } from "../../Animations.js";
import { HeroAttributes } from "./HeroAttributes.js";
import { FrameIndexPattern } from "../../FrameIndexPattern.js";
import {
    STAND_DOWN,
    STAND_LEFT,
    STAND_RIGHT,
    STAND_UP,
    WALK_DOWN,
    WALK_LEFT,
    WALK_RIGHT,
    WALK_UP
} from "./heroAnimations.js";
import { Highlight } from "../Light/Highlight.js";
import { moveTowards } from "../../helpers/moveTowards.js";

export class RemoteHero extends GameObject {
    constructor(playerId, x, y) {
        super({
            position: new Vector2(x, y)
        });
        this.isDynamic = true;

        this.isSolid = true;
        this.sortingOffsetY = 1; // Match local Hero's sorting offset for consistent Y-sorting
        this.attributes = new HeroAttributes();
        this.playerId = playerId;
        this.currentLevelId = null;

        // Smooth movement interpolation (matches local Hero)
        this.destinationPosition = new Vector2(x, y);

        // Shadow
        const shadow = new Sprite({
            resource: resources.images.shadow,
            frameSize: new Vector2(32, 32),
            position: new Vector2(-8, -19),
        });
        this.addChild(shadow);

        // Body sprite with animations
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
            })
        });
        this.addChild(this.body);

        const light = new Highlight(6, 0.8); // 60px radius, 80% intensity
        light.position = new Vector2(8, -2.5); // Slightly above NPC's feet
        this.addChild(light);
    }

    step(delta, root) {
        // Smoothly move toward destination position (same speed as local Hero)
        const oldY = this.position.y;
        moveTowards(this, this.destinationPosition, 1);

        // Invalidate parent sorting if Y position changed
        if (oldY !== this.position.y) {
            this.invalidateParentSorting();
        }
    }

    // Update from network data
    updateFromNetwork(data) {
        // Update destination position (smooth interpolation happens in step())
        this.destinationPosition.x = data.x;
        this.destinationPosition.y = data.y;

        // Update animation if provided
        if (data.animation) {
            this.body.animations.play(data.animation);
        }

        // Store facing direction for future use
        if (data.facingDirection) {
            this.facingDirection = data.facingDirection;
        }

        if (data.attributes) {
            this.attributes.setMultiple(data.attributes);
        }

        if (data.levelId !== undefined) {
            this.currentLevelId = data.levelId; // ADD THIS
        }
    }
}