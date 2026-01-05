// src/objects/DebugHud/DebugHud.js
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { DISPLAY } from "../../Constants.js";

export class DebugHud extends GameObject {
    constructor() {
        super({
            position: new Vector2(0, 0)
        });

        this.drawLayer = "HUD";

        // FPS calculation
        this.fps = 60;
        this.frameCount = 0;
        this.elapsedTime = 0;
        this.updateInterval = 1000; // Update display every 250ms

        // Cached data
        this.playerId = "Connecting...";
        this.connectedPlayers = 0;
        this.multiplayerEnabled = false;
        this.heroPosition = { x: 0, y: 0 };
    }

    step(delta, root) {
        // Update FPS calculation
        this.elapsedTime += delta;
        this.frameCount++;

        if (this.elapsedTime >= this.updateInterval) {
            this.fps = Math.round((this.frameCount * 1000) / this.elapsedTime);
            this.frameCount = 0;
            this.elapsedTime = 0;
        }

        // Cache multiplayer data
        if (root.multiplayerManager) {
            this.playerId = root.multiplayerManager.playerId || "Not connected";
            this.connectedPlayers = root.remotePlayers ? root.remotePlayers.size : 0;
        }

        // Cache level data
        if (root.level) {
            this.multiplayerEnabled = root.level.multiplayerEnabled !== false;
        }

        // Cache hero position
        if (root.level && root.level.children) {
            const hero = root.level.children.find(child => child.constructor.name === "Hero");
            if (hero) {
                this.heroPosition = {
                    x: Math.round(hero.position.x / 16),
                    y: Math.round(hero.position.y / 16)
                };
            }
        }
    }

    drawImage(ctx, drawPosX, drawPosY) {
        const padding = 6;
        const lineHeight = 10;
        const rightEdge = DISPLAY.CANVAS_WIDTH; // Canvas width
        const boxWidth = 140;
        const x = rightEdge - boxWidth - padding;
        const y = padding;

        // Draw semi-transparent background
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x - padding, y - padding, boxWidth + padding * 2, (lineHeight * 5) + padding * 2);

        // Set text style
        ctx.textRendering = "geometricPrecision";
        ctx.font = "8px fontRetroGaming";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#fff";

        // Draw info lines
        let currentY = y;

        ctx.fillText(`Player: ${this.playerId.substring(0, 12)}...`, Math.floor(x), Math.floor(currentY));
        currentY += lineHeight;

        ctx.fillText(`Connected Players: ${this.connectedPlayers}`, Math.floor(x), Math.floor(currentY));
        currentY += lineHeight;

        ctx.fillText(`Multiplayer: ${this.multiplayerEnabled ? "ON" : "OFF"}`, Math.floor(x), Math.floor(currentY));
        currentY += lineHeight;

        ctx.fillStyle = "#fff";
        ctx.fillText(`Pos: (${this.heroPosition.x}, ${this.heroPosition.y})`, Math.floor(x), Math.floor(currentY));
        currentY += lineHeight;

        // Color-coded FPS
        if (this.fps >= 55) {
            ctx.fillStyle = "#fff";
        } else if (this.fps >= 30) {
            ctx.fillStyle = "#ff0";
        } else {
            ctx.fillStyle = "#f00";
        }
        ctx.fillText(`FPS: ${this.fps}`, x, currentY);
    }
}