import { Level } from "../objects/Level/Level.js";
import { resources } from "../Resource.js";
import { TiledMap } from "../TiledMap.js";
import { TileLayerRenderer } from "../objects/TileLayerRenderer/TileLayerRenderer.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Exit } from "../objects/Exit/Exit.js";
import { Rod } from "../objects/Rod/Rod.js";
import { Chest } from "../objects/Chest/Chest.js";
import { Npc } from "../objects/Npc/Npc.js";
import { Vector2 } from "../Vector2.js";
import { events } from "../Events.js";
import { gridCells } from "../helpers/grid.js";
import { BlueRoom } from "./BlueRoom.js";
import { TALKED_TO_A, TALKED_TO_B } from "../StoryFlags.js";
import { Effects } from "../Effects.js";

export class MainMapLevel extends Level {
    constructor(params = {}) {
        super({});
        this.levelId = "cave";
        this.multiplayerEnabled = true; // render remote players here

        // Initialize effects from params
        this.effects = new Effects(params.effects || {});

        // Create TiledMap parser
        this.tiledMap = new TiledMap(
            resources.json.mainMap,
            resources.images.mainMapTileset
        );

        // this.tiledMap.parse();
        this.setupLevel(params);

        const npc1 = new Npc(gridCells(49), gridCells(20), {
            //content: "I am the first NPC!",
            content: [
                {
                    string: "I just can't stand that guy.",
                    requires: [TALKED_TO_B],
                    bypass: [TALKED_TO_A],
                    addsFlag: TALKED_TO_A,
                },
                {
                    string: "He is just the worst!",
                    requires: [TALKED_TO_A],
                },
                {
                    string: "Grumble grumble. Another day at work.",
                    requires: [],
                }
            ],
            portraitFrame: 1
        })
        this.addChild(npc1);

        const npc2 = new Npc(gridCells(38), gridCells(28), {
            content: [
                {
                    string: "What a wonderful day at work in the cave!",
                    requires: [],
                    addsFlag: TALKED_TO_B
                }
            ],
            portraitFrame: 0
        })
        this.addChild(npc2);

        const rod = new Rod(gridCells(37), gridCells(25))
        this.addChild(rod);

        const chest = new Chest(gridCells(34), gridCells(25))
        this.addChild(chest);

        const exit = new Exit(gridCells(11), gridCells(27))
        this.addChild(exit);
    }

    setupLevel(params) {
        // Add tile renderer
        const renderer = new TileLayerRenderer(this.tiledMap);
        this.addChild(renderer);

        // Use walls from Tiled
        this.walls = this.tiledMap.walls;

        this.heroStartPosition = params.heroPosition || new Vector2(560, 400);
        const hero = new Hero(this.heroStartPosition.x, this.heroStartPosition.y);
        this.addChild(hero);
    }

    ready() {
        events.on("HERO_EXITS", this, () => {
            // Handle level transitions
            events.emit("CHANGE_LEVEL", new BlueRoom({
                heroPosition: new Vector2(gridCells(37), gridCells(24))
            }))
        });
    }
}