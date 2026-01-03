import { events } from "../../Events.js";

export class TimeOfDayToggle {
    constructor() {
        // Button state
        this.modes = ["day", "dusk", "night"];
        this.currentModeIndex = 2; // Start with night
        this.button = null;
        this.isInitialized = false;
    }

    initialize() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.warn('TimeOfDayToggle already initialized. Skipping duplicate initialization.');
            return;
        }

        // Get the canvas to position relative to it
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.warn('Canvas with id "game-canvas" not found. TimeOfDayToggle will not be initialized.');
            return;
        }

        this.canvas = canvas;
        this.isInitialized = true;

        // Get the actual rendered dimensions of the canvas
        const canvasRect = canvas.getBoundingClientRect();

        // Create toggle button
        this.button = document.createElement('button');
        this.button.style.position = 'fixed';
        this.button.style.top = canvasRect.top + 'px';
        this.button.style.left = '30px'; // Position next to chat button
        this.button.style.width = '30px';
        this.button.style.height = '30px';
        this.button.style.zIndex = '1001';
        this.button.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
        this.button.style.color = '#fff';
        this.button.style.border = '1px solid rgba(100, 100, 100, 0.5)';
        this.button.style.borderRadius = '0px';
        this.button.style.fontSize = '16px';
        this.button.style.padding = '0';
        this.button.style.display = 'flex';
        this.button.style.alignItems = 'center';
        this.button.style.justifyContent = 'center';
        this.button.addEventListener('click', () => this.cycleMode());

        // Set initial icon
        this.updateButtonIcon();

        // Append to body
        document.body.appendChild(this.button);

        this.setupResizeListener();
    }

    setupResizeListener() {
        // Update button position on window resize
        const handleResize = () => {
            if (!this.canvas || !this.button) return;

            const canvasRect = this.canvas.getBoundingClientRect();
            this.button.style.top = canvasRect.top + 'px';
        };

        window.addEventListener('resize', handleResize);
    }

    cycleMode() {
        // Cycle to next mode
        this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
        const newMode = this.modes[this.currentModeIndex];

        // Update button icon
        this.updateButtonIcon();

        // Emit event to update time of day
        events.emit("TIME_OF_DAY_CHANGED", newMode);
    }

    updateButtonIcon() {
        if (!this.button) return;

        const currentMode = this.modes[this.currentModeIndex];
        if (currentMode === 'day') {
            this.button.textContent = '☀︎';
        } else if (currentMode === 'dusk') {
            this.button.textContent = '✿';
        } else {
            this.button.textContent = '⏾';
        }
    }

    destroy() {
        if (this.button) {
            this.button.remove();
        }
    }
}
