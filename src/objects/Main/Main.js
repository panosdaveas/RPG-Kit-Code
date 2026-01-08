import { GameObject } from "../../GameObject.js";
import { Input } from "../../Input.js";
import { Camera } from "../../Camera.js";
import { Inventory } from "../Inventory/Inventory.js";
import { events } from "../../Events.js";
import { SpriteTextString } from "../SpriteTextString/SpriteTextString.js";
import { storyFlags } from "../../StoryFlags.js";
import { MultiplayerManager } from "../../client/MultiplayerManager.js";
import { RemoteHero } from "../Hero/RemoteHero.js";
import { Hero } from "../Hero/Hero.js";
import { DebugHud } from "../DebugHud/DebugHud.js";
import { ChatUI } from "../../client/ChatUI.js";
import { ScreenRainEffect } from "../Effects/ScreenRainEffect.js";
import { TimeOfDayEffect } from "../Effects/TimeOfDayEffect.js";
import { LightingSystem } from "../../LightingSystem.js";
import { Effects } from "../../Effects.js";
import { TimeOfDayToggle } from "../TimeOfDayToggle/TimeOfDayToggle.js";


export class Main extends GameObject {
  constructor() {
    super({});
    this.level = null;
    this.input = new Input();
    this.camera = new Camera();
    this.lightingSystem = new LightingSystem();
    this.effects = new Effects(); // Store effects across level changes

    // Create the hero once - it will persist across all level changes
    this.hero = new Hero(0, 0);

    // Multiplayer
    this.multiplayerManager = new MultiplayerManager();
    this.remotePlayers = new Map(); // playerId -> RemoteHero instance

    // Performance optimization: cache collections by drawLayer
    // Map<layerName, array of objects>
    this._layerCache = new Map();
    this._layerCacheDirty = true;
  }

  // Method to invalidate layer cache (called when scene graph changes)
  invalidateLayerCache() {
    this._layerCacheDirty = true;
  }

  ready() {

    const inventory = new Inventory();
    this.addChild(inventory);

    const debugHud = new DebugHud();
    this.addChild(debugHud);

    // Initialize time of day toggle (DOM element, not a GameObject)
    const timeOfDayToggle = new TimeOfDayToggle();
    timeOfDayToggle.initialize();
    this.timeOfDayToggle = timeOfDayToggle;

    this.rainEffect = new ScreenRainEffect();
    // this.addChild(this.rainEffect);

    // Enable rain effect if current level has it
    if (this.level && this.level.effects.get('rain')) {
      this.rainEffect.enable();
    }

    this.timeOfDayEffect = new TimeOfDayEffect();
    this.addChild(this.timeOfDayEffect);

    // Set time of day if current level has it
    if (this.level && this.level.effects.has('timeOfDay')) {
      this.timeOfDayEffect.setState(this.level.effects.get('timeOfDay'));
    }

    // Initialize multiplayer
    this.setupMultiplayer();

    // Initialize chat UI and pass the multiplayerManager and remotePlayers reference
    const chatUI = new ChatUI(this.multiplayerManager, this.remotePlayers);
    chatUI.initialize();
    this.chatUI = chatUI;

    // Set the current player ID once the multiplayer connection is established
    events.on('MULTIPLAYER_CONNECTED', this, (playerId) => {
      this.chatUI.currentPlayerId = playerId;
    });

    // Handle time of day changes from toggle button
    events.on('TIME_OF_DAY_CHANGED', this, (newMode) => {
      // Update level effects
      if (this.level) {
        this.level.effects.set('timeOfDay', newMode);
        this.effects.set('timeOfDay', newMode);
      }

      // Update TimeOfDayEffect
      if (this.timeOfDayEffect) {
        this.timeOfDayEffect.setState(newMode);
      }
    });

    // Change Level handler
    events.on("CHANGE_LEVEL", this, newLevelInstance => {
      // Apply stored effects to outdoor levels that should preserve them
      if (newLevelInstance.constructor.name === 'MainMapLevel') {
        // Merge Main's stored effects with level's effects (level takes priority)
        const storedEffects = new Effects(this.effects.getAll());
        storedEffects.mergeWith(newLevelInstance.effects);
        newLevelInstance.effects = storedEffects;
      }

      this.setLevel(newLevelInstance);
      // Notify chat system of level change
      const levelId = newLevelInstance.levelId;
      this.multiplayerManager.onLevelChanged(levelId);
    });

    // Launch Text Box handler
    events.on("HERO_REQUESTS_ACTION", this, (withObject) => {
      if (typeof withObject.getContent === "function") {
        const content = withObject.getContent();

        if (!content) {
          return;
        }

        console.log(content);
        // Potentially add a story flag
        if (content.addsFlag) {
          console.log("ADD FLAG", content.addsFlag);
          storyFlags.add(content.addsFlag);
        }

        // Show the textbox
        const textbox = new SpriteTextString({
          portraitFrame: content.portraitFrame,
          string: content.string
        });
        this.addChild(textbox);
        events.emit("START_TEXT_BOX");

        // Unsubscribe from this text box after it's destroyed
        const endingSub = events.on("END_TEXT_BOX", this, () => {
          textbox.destroy();
          events.off(endingSub);
        });
      }

      if (withObject instanceof RemoteHero) {
        console.log("Interacting with remote player:", withObject);
        // Handle remote player interaction here
        // For example, show their name, stats, trade menu, etc.
        return;
      }
    });
  }

  setupMultiplayer() {
    // Connect to server
    this.multiplayerManager.connect();

    // Listen for local hero state updates and send to server
    events.on("HERO_STATE_UPDATE", this, (data) => {
      this.multiplayerManager.sendPlayerUpdate(data);
    });

    // listener for attributes
    events.on("HERO_ATTRIBUTES_UPDATE", this, (data) => {
      this.multiplayerManager.sendAttributeUpdate(data);
    });

    events.on("REMOTE_PLAYER_ATTRIBUTES_CHANGED", this, (data) => {
      const remoteHero = this.remotePlayers.get(data.id);
      if (remoteHero) {
        remoteHero.attributes.setMultiple(data.attributes);
      }
    });

    // When a remote player joins
    events.on("REMOTE_PLAYER_JOINED", this, (playerData) => {
      console.log("Adding remote player:", playerData.id);

      const remoteHero = new RemoteHero(
        playerData.id,
        playerData.x,
        playerData.y
      );

      remoteHero.currentLevelId = playerData.levelId;
      remoteHero.playerName = playerData.playerName || `Player_${playerData.id.substring(0, 6)}`;
      this.remotePlayers.set(playerData.id, remoteHero);

      this.updateRemoteHeroVisibility(remoteHero); // USE HELPER

      // Update chat UI dropdown
      if (this.chatUI) {
        this.chatUI.updatePlayerDropdown();
      }
    });

    // When a remote player moves
    events.on("REMOTE_PLAYER_MOVED", this, (data) => {
      const remoteHero = this.remotePlayers.get(data.id);
      if (remoteHero) {
        remoteHero.updateFromNetwork(data);
        this.updateRemoteHeroVisibility(remoteHero); // USE HELPER
      }
    });

    // When a remote player leaves
    events.on("REMOTE_PLAYER_LEFT", this, (playerId) => {
      console.log("Removing remote player:", playerId);
      const remoteHero = this.remotePlayers.get(playerId);
      if (remoteHero) {
        // Only destroy if it has a parent
        if (remoteHero.parent) {
          remoteHero.destroy();
        }
        // Always remove from the map
        this.remotePlayers.delete(playerId);

        // Update chat UI dropdown
        if (this.chatUI) {
          this.chatUI.updatePlayerDropdown();
        }
      }
    });
  }

  setLevel(newLevelInstance) {
    // Remove hero and remote players from old level
    if (this.level) {
      // Remove hero from old level
      if (this.hero.parent === this.level) {
        this.level.removeChild(this.hero);
      }

      // Remove remote players from old level
      this.remotePlayers.forEach(remoteHero => {
        if (remoteHero.parent === this.level) {
          this.level.removeChild(remoteHero);
        }
      });
      this.level.destroy();
    }

    // Invalidate layer cache when level changes
    this._layerCacheDirty = true;

    // Store effects from the new level
    if (newLevelInstance.effects.has('timeOfDay')) {
      this.effects.set('timeOfDay', newLevelInstance.effects.get('timeOfDay'));
    }
    // Note: Indoor rooms don't set timeOfDay effect, so they won't have lighting effects

    this.level = newLevelInstance;
    this.addChild(this.level);

    // Position the hero at the new level's start position
    if (newLevelInstance.heroStartPosition) {
      this.hero.position.x = newLevelInstance.heroStartPosition.x;
      this.hero.position.y = newLevelInstance.heroStartPosition.y;
      this.hero.destinationPosition = this.hero.position.duplicate();
      this.camera.centerPositionOnTarget(newLevelInstance.heroStartPosition);
    }

    // Set hero's facing direction if specified by the level
    if (newLevelInstance.heroStartFacing) {
      this.hero.facingDirection = newLevelInstance.heroStartFacing;
      // Set appropriate standing animation based on direction
      const directionToAnim = {
        'DOWN': 'standDown',
        'UP': 'standUp',
        'LEFT': 'standLeft',
        'RIGHT': 'standRight'
      };
      const animName = directionToAnim[newLevelInstance.heroStartFacing];
      if (animName) {
        this.hero.body.animations.play(animName);
        this.hero.currentAnimation = animName;
      }
    }

    // Add the hero to the new level
    this.level.addChild(this.hero);

    // Update local hero's current level and broadcast it
    this.hero.currentLevelId = this.level.levelId;
    this.hero.broadcastState();

    // Update visibility for all remote players
    this.remotePlayers.forEach(remoteHero => {
      this.updateRemoteHeroVisibility(remoteHero); // USE HELPER
    });

    // Enable/disable rain effect based on level settings
    if (this.rainEffect) {
      if (newLevelInstance.effects.get('rain')) {
        this.rainEffect.enable();
      } else {
        this.rainEffect.disable();
      }
    }

    // Set time of day based on level settings
    if (this.timeOfDayEffect) {
      if (newLevelInstance.effects.has('timeOfDay')) {
        this.timeOfDayEffect.setState(newLevelInstance.effects.get('timeOfDay'));
      } else {
        this.timeOfDayEffect.setState('day'); // Default to day (no overlay)
      }
    }
  }

  // Add this new helper method in the Main class (after setupMultiplayer or wherever you prefer):
  updateRemoteHeroVisibility(remoteHero) {
    // Check if multiplayer is disabled on this level
    const levelAllowsMultiplayer = this.level.multiplayerEnabled !== false;

    const shouldBeInLevel = levelAllowsMultiplayer &&
      (remoteHero.currentLevelId === this.level.levelId);
    const isInLevel = (remoteHero.parent === this.level);

    if (shouldBeInLevel && !isInLevel) {
      // Clean remove from any stale parent first
      if (remoteHero.parent) {
        remoteHero.parent.removeChild(remoteHero);
      }
      this.level.addChild(remoteHero);
    } else if (!shouldBeInLevel && isInLevel) {
      this.level.removeChild(remoteHero);
    }
  }

  // Override addChild to invalidate layer cache
  addChild(gameObject) {
    super.addChild(gameObject);
    this._layerCacheDirty = true;
  }

  // Override removeChild to invalidate layer cache
  removeChild(gameObject) {
    super.removeChild(gameObject);
    this._layerCacheDirty = true;
  }

  drawObjects(ctx) {
    // const hero = this.level.children.find(c => c.constructor.name === 'Hero');
    this.children.forEach(child => {
      if (child.drawLayer !== "HUD") {
        child.draw(ctx, this.camera.position.x, this.camera.position.y);
      }
    });
  }

  // Recursively collect all objects with a specific drawLayer
  collectObjectsWithDrawLayer(obj, layer, collected = []) {
    if (obj.drawLayer === layer) {
      collected.push(obj);
    }
    if (obj.children) {
      obj.children.forEach(child => {
        this.collectObjectsWithDrawLayer(child, layer, collected);
      });
    }
    return collected;
  }

  /**
   * Get all objects with a specific drawLayer (cached for performance)
   * @param {string} layer - The drawLayer to collect (e.g., "LIGHTS", "HUD", "FLOOR")
   * @returns {Array} Array of GameObjects with the specified drawLayer
   */
  getObjectsWithDrawLayer(layer) {
    // If cache is dirty, clear all cached layers
    if (this._layerCacheDirty) {
      this._layerCache.clear();
      this._layerCacheDirty = false;
    }

    // Return cached layer if available
    if (this._layerCache.has(layer)) {
      return this._layerCache.get(layer);
    }

    // Collect and cache the layer
    const objects = this.collectObjectsWithDrawLayer(this, layer);
    this._layerCache.set(layer, objects);
    return objects;
  }

  drawForeground(ctx) {
    // Handle TimeOfDayEffect first (render behind HUD)
    const timeOfDayEffect = this.children.find(c => c.constructor.name === 'TimeOfDayEffect');
    if (timeOfDayEffect) {
      // Use lighting system for night and dusk modes
      if (timeOfDayEffect.currentState === 'night' || timeOfDayEffect.currentState === 'dusk') {
        // Use cached lights collection for performance
        const lights = this.getObjectsWithDrawLayer("LIGHTS");
        this.lightingSystem.render(ctx, timeOfDayEffect, lights, this.camera);
      } else {
        // For day, render TimeOfDayEffect normally (or no overlay)
        timeOfDayEffect.draw(ctx, 0, 0);
      }
    }

    // Draw HUD layer on top (UI, etc.) but NOT TimeOfDayEffect
    this.children.forEach(child => {
      if (child.drawLayer === "HUD" && child.constructor.name !== 'TimeOfDayEffect') {
        child.draw(ctx, 0, 0);
      }
    });
  }
}