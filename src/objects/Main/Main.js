import { GameObject } from "../../GameObject.js";
import { Input } from "../../Input.js";
import { Camera } from "../../Camera.js";
import { Inventory } from "../Inventory/Inventory.js";
import { events } from "../../Events.js";
import { SpriteTextString } from "../SpriteTextString/SpriteTextString.js";
import { storyFlags } from "../../StoryFlags.js";
import { MultiplayerManager } from "../../client/MultiplayerManager.js";
import { RemoteHero } from "../Hero/RemoteHero.js";
import { DebugHud } from "../DebugHud/DebugHud.js";
import { ChatUI } from "../../client/ChatUI.js";


export class Main extends GameObject {
  constructor() {
    super({});
    this.level = null;
    this.input = new Input();
    this.camera = new Camera();

    // Multiplayer
    this.multiplayerManager = new MultiplayerManager();
    this.remotePlayers = new Map(); // playerId -> RemoteHero instance
  }

  ready() {

    const inventory = new Inventory();
    this.addChild(inventory);

    const debugHud = new DebugHud();
    this.addChild(debugHud);

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

    // Change Level handler
    events.on("CHANGE_LEVEL", this, newLevelInstance => {
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
        console.log("Interacting with remote player:", withObject.playerId);
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
    // Remove remote players from old level first
    if (this.level) {
      this.remotePlayers.forEach(remoteHero => {
        if (remoteHero.parent === this.level) {
          this.level.children = this.level.children.filter(c => c !== remoteHero);
          remoteHero.parent = null;
        }
      });
      this.level.destroy();
    }

    this.level = newLevelInstance;
    this.addChild(this.level);

    // Update local hero's current level and broadcast it
    const hero = this.level.children.find(c => c.constructor.name === 'Hero');
    if (hero) {
      hero.currentLevelId = this.level.levelId;
      hero.broadcastState();
    }

    // Update visibility for all remote players
    this.remotePlayers.forEach(remoteHero => {
      this.updateRemoteHeroVisibility(remoteHero); // USE HELPER
    });
  }

  // Add this new helper method in the Main class (after setupMultiplayer or wherever you prefer):
  updateRemoteHeroVisibility(remoteHero) {
    // Check if multiplayer is disabled on this level
    const levelAllowsMultiplayer = this.level.multiplayerEnabled !== false;

    const shouldBeInLevel = levelAllowsMultiplayer &&
      (remoteHero.currentLevelId === this.level.levelId);
    const isInLevel = (remoteHero.parent === this.level);

    if (shouldBeInLevel && !isInLevel) {
      this.level.addChild(remoteHero);
    } else if (!shouldBeInLevel && isInLevel) {
      this.level.children = this.level.children.filter(c => c !== remoteHero);
      remoteHero.parent = null;
    }
  }

  drawObjects(ctx) {
    this.children.forEach(child => {
      if (child.drawLayer !== "HUD") {
        child.draw(ctx, 0, 0);
      }
    });
  }

  drawForeground(ctx) {
    this.children.forEach(child => {
      if (child.drawLayer === "HUD") {
        child.draw(ctx, 0, 0);
      }
    });
  }
}