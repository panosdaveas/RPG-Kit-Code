import { GameObject } from "../../GameObject.js";
import { CULLING } from "../../Constants.js";

export class TileLayerRenderer extends GameObject {
    constructor(tiledMap) {
        super({});
        this.tiledMap = tiledMap;
        this.tilesetImage = tiledMap.tilesetResource.image;
        this.tilesPerRow = 0; // Calculate from tileset
        this.isParsed = false;
        this.animationTime = 0; // Track time for animations
        this.tileAnimationStates = new Map(); // tileId -> current frame info

        // Performance optimization: pre-rendered static layers
        this.staticLayersCanvas = null;
        this.animatedLayers = [];
        this.staticLayers = [];
    }

    step(delta, root) {
        // Keep checking until we successfully parse
        if (!this.isParsed && this.tiledMap.isLoaded) {
            this.tiledMap.parse();
            this.tilesetImage = this.tiledMap.tilesetResource.image;
            this.tilesPerRow = Math.floor(
                this.tilesetImage.width / this.tiledMap.tileWidth
            );
            this.isParsed = true;

            // Initialize animation states
            this.tiledMap.animations.forEach((animData, tileId) => {
                this.tileAnimationStates.set(tileId, {
                    currentFrameIndex: 0,
                    timeInFrame: 0
                });
            });

            // Separate static and animated layers
            this.separateStaticAndAnimatedLayers();

            // Pre-render static layers to offscreen canvas
            if (this.staticLayers.length > 0) {
                this.prerenderStaticLayers();
            }
        }

        // Update animations
        if (this.isParsed) {
            this.animationTime += delta;
            this.updateAnimations(delta);
        }
    }

    updateAnimations(delta) {
        this.tileAnimationStates.forEach((state, tileId) => {
            const animData = this.tiledMap.getAnimation(tileId);
            if (!animData) return;

            state.timeInFrame += delta;
            const currentFrame = animData.frames[state.currentFrameIndex];

            if (state.timeInFrame >= currentFrame.duration) {
                state.timeInFrame -= currentFrame.duration;
                state.currentFrameIndex = (state.currentFrameIndex + 1) % animData.frames.length;
            }
        });
    }

    separateStaticAndAnimatedLayers() {
        this.tiledMap.layers.forEach(layer => {
            // Check if this layer has any animated tiles
            const hasAnimatedTiles = layer.tiles.some(tile => {
                return this.tileAnimationStates.has(tile.tileId);
            });

            if (hasAnimatedTiles) {
                this.animatedLayers.push(layer);
            } else {
                this.staticLayers.push(layer);
            }
        });
    }

    prerenderStaticLayers() {
        // Create offscreen canvas for static layers
        const mapWidth = this.tiledMap.mapWidth * this.tiledMap.tileWidth;
        const mapHeight = this.tiledMap.mapHeight * this.tiledMap.tileHeight;

        // Validate dimensions
        if (mapWidth <= 0 || mapHeight <= 0) {
            console.warn('TileLayerRenderer: Invalid map dimensions', mapWidth, mapHeight);
            return;
        }

        this.staticLayersCanvas = document.createElement('canvas');
        this.staticLayersCanvas.width = mapWidth;
        this.staticLayersCanvas.height = mapHeight;
        const ctx = this.staticLayersCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Sort static layers by zIndex
        const sortedStaticLayers = [...this.staticLayers].sort((a, b) => a.zIndex - b.zIndex);

        // Draw all static tiles to the offscreen canvas
        sortedStaticLayers.forEach(layer => {
            if (!layer.visible) return;

            ctx.save();
            ctx.globalAlpha = layer.opacity;

            layer.tiles.forEach(tile => {
                // Skip tiles with depth property (rendered as TileSprites)
                const tileProps = this.tiledMap.tileProperties.get(tile.tileId);
                if (tileProps && tileProps.depth) {
                    return;
                }

                // Draw tile directly to offscreen canvas
                const { tileId, x, y } = tile;
                const tileWidth = this.tiledMap.tileWidth;
                const tileHeight = this.tiledMap.tileHeight;

                // Calculate source position in tileset
                const srcX = (tileId % this.tilesPerRow) * tileWidth;
                const srcY = Math.floor(tileId / this.tilesPerRow) * tileHeight;

                ctx.drawImage(
                    this.tilesetImage,
                    srcX,
                    srcY,
                    tileWidth,
                    tileHeight,
                    x,
                    y,
                    tileWidth,
                    tileHeight
                );
            });

            ctx.restore();
        });
    }

    drawImage(ctx, drawPosX, drawPosY) {
        if (!this.tiledMap.isLoaded) {
            return;
        }

        // Draw pre-rendered static layers (single draw call)
        if (this.staticLayersCanvas && this.staticLayersCanvas.width > 0 && this.staticLayersCanvas.height > 0) {
            window.drawnCount = (window.drawnCount || 0) + 1;
            ctx.drawImage(
                this.staticLayersCanvas,
                drawPosX,
                drawPosY
            );
        }

        // Sort animated layers by zIndex
        const sortedAnimatedLayers = [...this.animatedLayers].sort((a, b) => a.zIndex - b.zIndex);

        // Draw animated layers with culling
        sortedAnimatedLayers.forEach(layer => {
            if (!layer.visible) return;

            ctx.save();
            ctx.globalAlpha = layer.opacity;

            layer.tiles.forEach(tile => {
                // Skip tiles that have the 'depth' property - they're rendered as TileSprites
                const tileProps = this.tiledMap.tileProperties.get(tile.tileId);
                if (tileProps && tileProps.depth) {
                    return; // This tile has depth property, skip it (rendered as TileSprite)
                }
                this.drawTile(ctx, tile, drawPosX, drawPosY);
            });

            ctx.restore();
        });

        // Draw tile objects from object layers (only those without 'depth' property)
        // Tiles with 'depth' property are rendered as TileSprites for Y-sorting
        this.tiledMap.tileObjects.forEach(tileObj => {
            const tileProps = this.tiledMap.tileProperties.get(tileObj.tileId);
            // Only render if it doesn't have the depth property (otherwise it's a TileSprite)
            if (!tileProps || !tileProps.depth) {
                this.drawTile(ctx, tileObj, drawPosX, drawPosY);
            }
        });
    }

    drawTile(ctx, tile, offsetX, offsetY) {
        let { tileId, x, y } = tile;

        const tileDrawX = x + offsetX;
        const tileDrawY = y + offsetY;
        const tileWidth = this.tiledMap.tileWidth;
        const tileHeight = this.tiledMap.tileHeight;
        const padding = CULLING.TILE_PADDING; // Buffer for tile edges

        // Off-screen culling: skip tiles outside viewport
        if (tileDrawX + tileWidth < -padding ||
            tileDrawX > ctx.canvas.width + padding ||
            tileDrawY + tileHeight < -padding ||
            tileDrawY > ctx.canvas.height + padding) {
            return; // Skip rendering
        }

        // Check if this tile has an animation
        const animState = this.tileAnimationStates.get(tileId);
        if (animState) {
            const animData = this.tiledMap.getAnimation(tileId);
            const currentFrame = animData.frames[animState.currentFrameIndex];
            tileId = currentFrame.tileId; // Use the animated frame's tileId
        }

        // Calculate source position in tileset
        const srcX = (tileId % this.tilesPerRow) * tileWidth;
        const srcY = Math.floor(tileId / this.tilesPerRow) * tileHeight;

        // Debug: count actual draws
        window.drawnCount = (window.drawnCount || 0) + 1;

        // Draw the tile
        ctx.drawImage(
            this.tilesetImage,
            srcX,
            srcY,
            tileWidth,
            tileHeight,
            tileDrawX,
            tileDrawY,
            tileWidth,
            tileHeight
        );
    }
}