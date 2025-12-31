import { GameObject } from "../../GameObject.js";

export class TileLayerRenderer extends GameObject {
    constructor(tiledMap) {
        super({});
        this.tiledMap = tiledMap;
        this.tilesetImage = tiledMap.tilesetResource.image;
        this.tilesPerRow = 0; // Calculate from tileset
        this.isParsed = false;
        this.animationTime = 0; // Track time for animations
        this.tileAnimationStates = new Map(); // tileId -> current frame info
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

    drawImage(ctx, drawPosX, drawPosY) {
        if (!this.tiledMap.isLoaded) {
            return;
        }

        // Sort layers by zIndex
        const sortedLayers = [...this.tiledMap.layers].sort((a, b) => a.zIndex - b.zIndex);

        // Draw each layer
        sortedLayers.forEach(layer => {
            if (!layer.visible) return;

            ctx.save();
            ctx.globalAlpha = layer.opacity;
            // ctx.globalAlpha = 0;

            layer.tiles.forEach(tile => {
                this.drawTile(ctx, tile, drawPosX, drawPosY);
            });

            ctx.restore();
        });

        // Draw tile objects from object layers
        this.tiledMap.tileObjects.forEach(tileObj => {
            this.drawTile(ctx, tileObj, drawPosX, drawPosY);
        });
    }

    drawTile(ctx, tile, offsetX, offsetY) {
        let { tileId, x, y } = tile;
        const tileDrawX = x + offsetX;
        const tileDrawY = y + offsetY;
        const tileWidth = this.tiledMap.tileWidth;
        const tileHeight = this.tiledMap.tileHeight;
        const padding = 16; // Buffer for tile edges

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