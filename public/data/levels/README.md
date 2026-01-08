# Level Configuration Files

This directory contains JSON configuration files for game levels. These files define all entities, NPCs, items, and settings for each level in a data-driven way.

## Benefits of JSON-Based Levels

✅ **Separation of content from code** - Designers can edit levels without touching JavaScript
✅ **Easy maintenance** - All level data in one readable file
✅ **Future-proof** - Foundation for visual level editors
✅ **Hot-reload friendly** - Change JSON, refresh browser
✅ **Version control friendly** - Clear diffs show exactly what changed

## JSON Schema

### Basic Structure

```json
{
  "levelId": "unique-level-id",
  "className": "LevelClassName",
  "multiplayerEnabled": true,
  "cameraEnabled": true,
  "tiledMap": {
    "jsonResource": "resourceKey",
    "tilesetResource": "tilesetKey"
  },
  "heroStartPosition": { "x": 560, "y": 400 },
  "heroStartFacing": "DOWN",
  "effects": {
    "timeOfDay": "night",
    "rain": false
  },
  "npcs": [...],
  "items": [...],
  "exits": [...]
}
```

### NPCs

```json
{
  "id": "npc-identifier",
  "position": {
    "gridX": 49,
    "gridY": 20
  },
  "portraitFrame": 1,
  "content": [
    {
      "string": "Dialog text",
      "requires": ["STORY_FLAG"],
      "bypass": ["OTHER_FLAG"],
      "addsFlag": "NEW_FLAG"
    }
  ]
}
```

**Position formats:**
- `gridX`/`gridY` - Grid cell coordinates (multiplied by 16)
- `x`/`y` - Absolute pixel coordinates

### Items

```json
{
  "type": "Rod",
  "position": {
    "gridX": 37,
    "gridY": 25
  }
}
```

**Available types:**
- `Rod`
- `Chest`
- Add more in `LevelFactory.entityTypes`

### Exits

```json
{
  "position": {
    "gridX": 25,
    "gridY": 22.5
  },
  "targetLevel": "BlueRoom",
  "targetPosition": {
    "gridX": 37,
    "gridY": 24
  }
}
```

### Effects

```json
{
  "timeOfDay": "day" | "dusk" | "night",
  "rain": true | false
}
```

## Usage in Code

### Creating a new level from JSON

```javascript
// In Resource.js, register the JSON file:
this.toLoadJson = {
  myLevel: "/data/levels/MyLevel.json",
};

// Create level using factory:
import { LevelFactory } from "../LevelFactory.js";

const levelData = resources.json.myLevel.data;
const level = LevelFactory.createFromJSON(levelData);
```

### Using with existing level classes

```javascript
// In your level class:
export class MyLevel extends Level {
  static createFromJSON(params = {}) {
    const levelData = resources.json.myLevel.data;
    return LevelFactory.createFromJSON(levelData, params);
  }

  constructor(params = {}) {
    if (resources.json.myLevel?.isLoaded) {
      return MyLevel.createFromJSON(params);
    }
    super({});
  }
}
```

## Adding New Entity Types

Register new entity types in `LevelFactory.js`:

```javascript
import { MyNewItem } from "./objects/MyNewItem/MyNewItem.js";

LevelFactory.registerEntityType('MyNewItem', MyNewItem);
```

Then use in JSON:

```json
{
  "items": [
    {
      "type": "MyNewItem",
      "position": { "gridX": 10, "gridY": 15 }
    }
  ]
}
```

## Example: MainMapLevel.json

See `MainMapLevel.json` for a complete example with:
- Multiple NPCs with story flags
- Various items (Rod, Chest)
- Exit to another level
- Time of day effects

## Future Enhancements

🎯 **Visual Level Editor** - Drag-and-drop entity placement
🎯 **Schema Validation** - Catch errors before runtime
🎯 **Hot Reloading** - Edit JSON without refreshing
🎯 **Level Templates** - Reusable level configurations
