import { GameObject } from "../../GameObject.js";

export class TileLayerRenderer extends GameObject {
    constructor(tiledMap) {
        super({});
        this.tiledMap = tiledMap;
        this.tilesetImage = tiledMap.tilesetResource.image;
        this.tilesPerRow = 0; // Calculate from tileset
        this.isParsed = false;
    }

    // ready() {
    //     // Calculate tiles per row in tileset
    //     if (this.tiledMap.isLoaded) {
    //         this.tilesPerRow = Math.floor(
    //             this.tilesetImage.width / this.tiledMap.tileWidth
    //         );
    //     }
    // }
    step(delta, root) {
        // Keep checking until we successfully parse
        if (!this.isParsed && this.tiledMap.isLoaded) {
            this.tiledMap.parse();
            this.tilesetImage = this.tiledMap.tilesetResource.image;
            this.tilesPerRow = Math.floor(
                this.tilesetImage.width / this.tiledMap.tileWidth
            );
            this.isParsed = true;
        }
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
    }

    drawTile(ctx, tile, offsetX, offsetY) {
        const { tileId, x, y } = tile;

        // Calculate source position in tileset
        const srcX = (tileId % this.tilesPerRow) * this.tiledMap.tileWidth;
        const srcY = Math.floor(tileId / this.tilesPerRow) * this.tiledMap.tileHeight;

        // Draw the tile
        ctx.drawImage(
            this.tilesetImage,
            srcX,
            srcY,
            this.tiledMap.tileWidth,
            this.tiledMap.tileHeight,
            x + offsetX,
            y + offsetY,
            this.tiledMap.tileWidth,
            this.tiledMap.tileHeight
        );
    }
}