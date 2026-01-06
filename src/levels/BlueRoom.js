import { Level } from "../objects/Level/Level.js";
import { resources } from "../Resource.js";
import { TiledMap } from "../TiledMap.js";
import { TileLayerRenderer } from "../objects/TileLayerRenderer/TileLayerRenderer.js";
import { Exit } from "../objects/Exit/Exit.js";
import { Rod } from "../objects/Rod/Rod.js";
import { Npc } from "../objects/Npc/Npc.js";
import { Vector2 } from "../Vector2.js";
import { events } from "../Events.js";
import { gridCells } from "../helpers/grid.js";
import { MainMapLevel } from "./MainMapLevel.js";
import { UP } from "../Input.js";

export class BlueRoom extends Level {
    constructor(params = {}) {
        super({});
        this.levelId = "blue-room";
        this.multiplayerEnabled = false; // render remote players here
        this.cameraEnabled = false; // Disable camera for small rooms

        // Create TiledMap parser
        this.tiledMap = new TiledMap(
            resources.json.blueRoom,
            resources.images.blueRoomTileset
        );

        // this.tiledMap.parse();
        this.setupLevel(params);

        const npc1 = new Npc(gridCells(38), gridCells(20), {
            content: [
                {
                    string: "Hi",
                    requires: [],
                }
            ],
            portraitFrame: 1
        })
        this.addChild(npc1);

        const exit = new Exit(gridCells(37), gridCells(25))
        this.addChild(exit);
    }

    setupLevel(params) {
        // Add tile renderer
        const renderer = new TileLayerRenderer(this.tiledMap);
        this.addChild(renderer);

        // Use walls from Tiled
        this.walls = this.tiledMap.walls;

        // Spawn objects from Tiled object layer
        const spawns = this.tiledMap.getObjectsByType("spawn");
        const heroSpawn = spawns.find(s => s.name === "hero") || { x: 560, y: 400 };

        // Set hero start position (hero will be added by Main.setLevel)
        this.heroStartPosition = params.heroPosition || new Vector2(heroSpawn.x, heroSpawn.y);
        // Store facing direction for when hero enters this level
        this.heroStartFacing = UP;

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
            events.emit("CHANGE_LEVEL", new MainMapLevel({
                heroPosition: new Vector2(gridCells(25), gridCells(23))
            }))
        });
    }
}