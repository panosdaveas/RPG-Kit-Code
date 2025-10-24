export class TiledMap {
    constructor(jsonResource, tilesetResource) {
        this.jsonResource = jsonResource; // From resources.json.caveMap
        this.tilesetResource = tilesetResource; // From resources.images.caveTileset

        this.layers = [];
        this.objects = [];
        this.tileProperties = new Map(); // tileId -> {solid, action, etc}
        this.animations = new Map(); // tileId -> animation config
        this.walls = new Set(); // For collision

        this.tileWidth = 16;
        this.tileHeight = 16;
        this.mapWidth = 0;
        this.mapHeight = 0;
    }

    get isLoaded() {
        return this.jsonResource.isLoaded && this.tilesetResource.isLoaded;
    }

    // Call this once resources are loaded
    parse() {
        if (!this.isLoaded) {
            console.warn("TiledMap: Resources not loaded yet");
            return false;
        }

        const data = this.jsonResource.data;

        this.tileWidth = data.tilewidth;
        this.tileHeight = data.tileheight;
        this.mapWidth = data.width;
        this.mapHeight = data.height;

        // Parse tilesets for properties and animations
        if (data.tilesets && data.tilesets.length > 0) {
            this.parseTileset(data.tilesets[0]);
        }

        // Parse layers (in order from JSON)
        data.layers.forEach((layerData, index) => {
            if (layerData.type === "tilelayer") {
                this.parseTileLayer(layerData, index);
            } else if (layerData.type === "objectgroup") {
                this.parseObjectLayer(layerData);
            }
        });
    }

    parseTileset(tilesetData) {
        // Parse individual tile properties
        if (tilesetData.tiles) {
            tilesetData.tiles.forEach(tile => {
                const tileId = tile.id;

                // Store properties (solid, action, etc)
                if (tile.properties) {
                    const props = {};
                    tile.properties.forEach(prop => {
                        props[prop.name] = prop.value;
                    });
                    this.tileProperties.set(tileId, props);
                }

                // Store animation data
                if (tile.animation) {
                    this.animations.set(tileId, {
                        frames: tile.animation.map(frame => ({
                            tileId: frame.tileid,
                            duration: frame.duration
                        }))
                    });
                }
            });
        }
    }

    parseTileLayer(layerData, zIndex) {
        const layer = {
            name: layerData.name,
            zIndex: zIndex,
            visible: layerData.visible !== false,
            opacity: layerData.opacity ?? 1,
            tiles: []
        };

        // Parse tile data
        const data = layerData.data; // Array of tile GIDs
        for (let i = 0; i < data.length; i++) {
            const gid = data[i];
            if (gid === 0) continue; // Empty tile

            const tileId = gid - 1; // Tiled uses 1-based, we use 0-based
            const x = (i % this.mapWidth) * this.tileWidth;
            const y = Math.floor(i / this.mapWidth) * this.tileHeight;

            layer.tiles.push({
                tileId,
                x,
                y
            });

            // Check if this tile is solid (for collision)
            const props = this.tileProperties.get(tileId);
            if (props && props.collide) {
                this.walls.add(`${x},${y}`);
            }
        }

        this.layers.push(layer);
    }

    parseObjectLayer(layerData) {
        layerData.objects.forEach(obj => {
            const parsed = {
                name: obj.name,
                type: obj.type,
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
                properties: {}
            };

            // Parse custom properties
            if (obj.properties) {
                obj.properties.forEach(prop => {
                    parsed.properties[prop.name] = prop.value;
                });
            }

            this.objects.push(parsed);
        });
    }

    // Get tile properties by ID
    getTileProperties(tileId) {
        return this.tileProperties.get(tileId) || {};
    }

    // Get animation for a tile
    getAnimation(tileId) {
        return this.animations.get(tileId);
    }

    // Find objects by type
    getObjectsByType(type) {
        return this.objects.filter(obj => obj.type === type);
    }
}