import { Level } from "./objects/Level/Level.js";
import { resources } from "./Resource.js";
import { TiledMap } from "./TiledMap.js";
import { TileLayerRenderer } from "./objects/TileLayerRenderer/TileLayerRenderer.js";
import { Vector2 } from "./Vector2.js";
import { gridCells } from "./helpers/grid.js";
import { Npc } from "./objects/Npc/Npc.js";
import { Rod } from "./objects/Rod/Rod.js";
import { Chest } from "./objects/Chest/Chest.js";
import { Exit } from "./objects/Exit/Exit.js";
import { Effects } from "./Effects.js";

/**
 * #architecture #engine #data-driven
 * LevelFactory - Creates game levels from JSON configuration files
 *
 * This factory enables data-driven level design:
 * - Separates content (JSON) from code (classes)
 * - Makes levels easier to author and maintain
 * - Enables future visual level editors
 * - Supports hot-reloading of level data
 *
 * Usage:
 *   const levelData = resources.json.mainMapLevel.data;
 *   const level = LevelFactory.createFromJSON(levelData);
 *
 * JSON Schema: See /public/data/levels/MainMapLevel.json for example
 */
export class LevelFactory {

  /**
   * Entity type registry - maps string types to constructor classes
   * Add new entity types here to make them available in JSON
   */
  static entityTypes = {
    'Npc': Npc,
    'Rod': Rod,
    'Chest': Chest,
    'Exit': Exit,
  };

  /**
   * Create a Level instance from JSON configuration
   * @param {Object} data - Level configuration from JSON file
   * @param {Object} params - Runtime parameters (e.g., heroPosition override)
   * @returns {Level} Configured level instance
   */
  static createFromJSON(data, params = {}) {
    // Create base level
    const level = new Level();

    // Apply basic properties
    level.levelId = data.levelId || "unnamed-level";
    level.multiplayerEnabled = data.multiplayerEnabled ?? true;
    level.cameraEnabled = data.cameraEnabled ?? true;

    // Initialize effects
    level.effects = new Effects(data.effects || {});

    // Setup TiledMap if specified
    if (data.tiledMap) {
      const mapResource = resources.json[data.tiledMap.jsonResource];
      const tilesetResource = resources.images[data.tiledMap.tilesetResource];

      if (!mapResource || !tilesetResource) {
        console.error(`LevelFactory: Missing resources for level ${level.levelId}`);
        console.error(`  Map: ${data.tiledMap.jsonResource} (${!!mapResource})`);
        console.error(`  Tileset: ${data.tiledMap.tilesetResource} (${!!tilesetResource})`);
      } else {
        level.tiledMap = new TiledMap(mapResource, tilesetResource);

        // Add tile renderer
        const renderer = new TileLayerRenderer(level.tiledMap);
        level.addChild(renderer);

        // Use walls from Tiled
        level.walls = level.tiledMap.walls;
      }
    }

    // Set hero start position
    if (data.heroStartPosition) {
      level.heroStartPosition = new Vector2(
        data.heroStartPosition.x,
        data.heroStartPosition.y
      );
    }

    // Set hero facing direction
    if (data.heroStartFacing) {
      level.heroStartFacing = data.heroStartFacing;
    }

    // Create NPCs
    if (data.npcs) {
      data.npcs.forEach(npcData => {
        const npc = this.createNpc(npcData);
        level.addChild(npc);
      });
    }

    // Create items
    if (data.items) {
      data.items.forEach(itemData => {
        const item = this.createItem(itemData);
        if (item) {
          level.addChild(item);
        }
      });
    }

    // Create exits
    if (data.exits) {
      data.exits.forEach(exitData => {
        const exit = this.createExit(exitData);
        level.addChild(exit);
      });
    }

    return level;
  }

  /**
   * Create an NPC from JSON data
   */
  static createNpc(data) {
    const x = data.position.gridX !== undefined
      ? gridCells(data.position.gridX)
      : data.position.x;
    const y = data.position.gridY !== undefined
      ? gridCells(data.position.gridY)
      : data.position.y;

    return new Npc(x, y, {
      content: data.content,
      portraitFrame: data.portraitFrame || 0
    });
  }

  /**
   * Create an item from JSON data
   */
  static createItem(data) {
    const EntityClass = this.entityTypes[data.type];

    if (!EntityClass) {
      console.warn(`LevelFactory: Unknown item type '${data.type}'`);
      return null;
    }

    const x = data.position.gridX !== undefined
      ? gridCells(data.position.gridX)
      : data.position.x;
    const y = data.position.gridY !== undefined
      ? gridCells(data.position.gridY)
      : data.position.y;

    return new EntityClass(x, y);
  }

  /**
   * Create an exit from JSON data
   */
  static createExit(data) {
    const x = data.position.gridX !== undefined
      ? gridCells(data.position.gridX)
      : data.position.x;
    const y = data.position.gridY !== undefined
      ? gridCells(data.position.gridY)
      : data.position.y;

    const exit = new Exit(x, y);

    // Store target level info for transition handling
    if (data.targetLevel) {
      exit.targetLevel = data.targetLevel;
    }
    if (data.targetPosition) {
      exit.targetPosition = data.targetPosition;
    }

    return exit;
  }

  /**
   * Register a new entity type for use in JSON
   * @param {string} typeName - Name to use in JSON (e.g., "Sword")
   * @param {Class} EntityClass - Constructor class
   */
  static registerEntityType(typeName, EntityClass) {
    this.entityTypes[typeName] = EntityClass;
  }
}
