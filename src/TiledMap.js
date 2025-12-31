export class TiledMap {
    constructor(jsonResource, tilesetResource) {
        this.jsonResource = jsonResource; // From resources.json.caveMap
        this.tilesetResource = tilesetResource; // From resources.images.caveTileset

        this.layers = [];
        this.objects = [];
        this.tileObjects = []; // Tile objects from object layers (have gid)
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

            // Check collision properties - upper layer tiles always override lower layers
            const props = this.tileProperties.get(tileId);
            const posKey = `${x},${y}`;

            // If tile has collide=true, add to walls
            // Otherwise (no collide property or collide=false), remove from walls
            // This way upper layer tiles override lower layer collision
            if (props && props.collide) {
                this.walls.add(posKey);
            } else {
                // No collide property = treat as collide:false, override lower layers
                this.walls.delete(posKey);
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

            // If object has a gid, it's a tile object that should be rendered
            if (obj.gid) {
                const tileId = obj.gid - 1; // Tiled uses 1-based, we use 0-based
                const tileX = obj.x;
                const tileY = obj.y - obj.height; // Tiled places tile objects at bottom-left, we need top-left

                this.tileObjects.push({
                    tileId: tileId,
                    x: tileX,
                    y: tileY,
                    width: obj.width,
                    height: obj.height,
                    name: obj.name,
                    type: obj.type,
                    properties: parsed.properties
                });

                // Check collision properties from tile properties or object properties
                const tileProps = this.tileProperties.get(tileId) || {};
                const hasCollision = parsed.properties.collide || tileProps.collide;

                if (hasCollision) {
                    const posKey = `${tileX},${tileY}`;
                    this.walls.add(posKey);
                }
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