import { Level } from "../objects/Level/Level.js";
import { resources } from "../Resource.js";
import { TiledMap } from "../TiledMap.js";
import { TileLayerRenderer } from "../objects/TileLayerRenderer/TileLayerRenderer.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Exit } from "../objects/Exit/Exit.js";
import { Rod } from "../objects/Rod/Rod.js";
import { Npc } from "../objects/Npc/Npc.js";
import { Vector2 } from "../Vector2.js";
import { events } from "../Events.js";
import { gridCells } from "../helpers/grid.js";
import { OutdoorLevel1 } from "./OutdoorLevel1.js";
import {TALKED_TO_A, TALKED_TO_B} from "../StoryFlags.js";

export class MainMapLevel extends Level {
    constructor(params = {}) {
        super({});
        // this.background = null; // Could set a background sprite here
        this.levelId = "cave";
        this.multiplayerEnabled = true; // render remote players here

        // Create TiledMap parser
        this.tiledMap = new TiledMap(
            resources.json.mainMap,
            resources.images.mainMapTileset
        );

        this.tiledMap.parse();
        this.setupLevel(params);
        // this.checkLoaded(params);

        const npc1 = new Npc(gridCells(38), gridCells(30), {
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

        const exit = new Exit(gridCells(40), gridCells(25))
        this.addChild(exit);
    }

    // checkLoaded(params) {
    //     const interval = setInterval(() => {
    //         if (this.tiledMap.isLoaded) {
    //             clearInterval(interval);
    //             this.tiledMap.parse();
    //             this.setupLevel(params);
    //         }
    //     }, 100);
    // }

    setupLevel(params) {
        // Add tile renderer
        const renderer = new TileLayerRenderer(this.tiledMap);
        this.addChild(renderer);

        // Use walls from Tiled
        this.walls = this.tiledMap.walls;

        // Spawn objects from Tiled object layer
        const spawns = this.tiledMap.getObjectsByType("spawn");
        const heroSpawn = spawns.find(s => s.name === "hero") || { x: 560, y: 400 };

        this.heroStartPosition = params.heroPosition || new Vector2(heroSpawn.x, heroSpawn.y);
        const hero = new Hero(this.heroStartPosition.x, this.heroStartPosition.y);
        this.addChild(hero);

        // Spawn items from object layer
        const items = this.tiledMap.getObjectsByType("item");
        items.forEach(item => {
            if (item.name === "rod") {
                const rod = new Rod(item.x, item.y);
                this.addChild(rod);
            }
        });
        

        // Spawn exits
        const exits = this.tiledMap.getObjectsByType("exit");
        exits.forEach(exitObj => {
            const exit = new Exit(exitObj.x, exitObj.y);
            console.log("Adding exit at", exitObj.x, exitObj.y);
            this.addChild(exit);
        });

        // Spawn NPCs
        const npcs = this.tiledMap.getObjectsByType("npc");
        npcs.forEach(npcObj => {
            const npc = new Npc(npcObj.x, npcObj.y, {
                content: npcObj.properties.dialogue || "Hello!",
                portraitFrame: npcObj.properties.portrait || 0
            });
            this.addChild(npc);
        });
    }

    ready() {
        events.on("HERO_EXITS", this, () => {
            // Handle level transitions
            events.emit("CHANGE_LEVEL", new OutdoorLevel1({
                heroPosition: new Vector2(gridCells(7), gridCells(3))
            }))
        });
    }
}