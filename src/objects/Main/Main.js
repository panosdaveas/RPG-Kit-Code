import { GameObject } from "../../GameObject.js";
import { Input } from "../../Input.js";
import { Camera } from "../../Camera.js";
import { Inventory } from "../Inventory/Inventory.js";
import { events } from "../../Events.js";
import { SpriteTextString } from "../SpriteTextString/SpriteTextString.js";
import { storyFlags } from "../../StoryFlags.js";
import { MultiplayerManager } from "../../client/MultiplayerManager.js";
import { RemoteHero } from "../Hero/RemoteHero.js";

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

    // Initialize multiplayer
    this.setupMultiplayer();

    // Change Level handler
    events.on("CHANGE_LEVEL", this, newLevelInstance => {
      this.setLevel(newLevelInstance);
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

      // Add to level if it exists
      if (this.level) {
        this.level.addChild(remoteHero);
      }

      // Track it
      this.remotePlayers.set(playerData.id, remoteHero);
    });

    // When a remote player moves
    events.on("REMOTE_PLAYER_MOVED", this, (data) => {
      const remoteHero = this.remotePlayers.get(data.id);
      if (remoteHero) {
        remoteHero.updateFromNetwork(data);
      }
    });

    // When a remote player leaves
    events.on("REMOTE_PLAYER_LEFT", this, (playerId) => {
      console.log("Removing remote player:", playerId);
      const remoteHero = this.remotePlayers.get(playerId);
      if (remoteHero) {
        remoteHero.destroy();
        this.remotePlayers.delete(playerId);
      }
    });
  }

  setLevel(newLevelInstance) {
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

    // Re-add all remote players to the new level
    this.remotePlayers.forEach(remoteHero => {
      this.level.addChild(remoteHero);
    });

  }

  drawBackground(ctx) {
    this.level?.background.drawImage(ctx, 0, 0);
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