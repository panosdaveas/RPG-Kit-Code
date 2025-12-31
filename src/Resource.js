class Resources {
  constructor() {
    // Everything we plan to download
    this.toLoad = {
      hero: "/sprites/hero.png",
      shadow: "/sprites/shadow.png",
      rod: "/sprites/rod.png",
      exit: "/sprites/exit.png",
      // Outdoor
      sky: "/sprites/sky.png",
      ground: "/sprites/ground.png",
      // Cave
      cave: "/sprites/cave.png",
      caveGround: "/sprites/cave-ground.png",
      // NPCs
      knight: "/sprites/knight-sheet-1.png",
      // HUD
      textBox: "/sprites/text-box.png",
      fontWhite: "/sprites/sprite-font-white.png",
      portraits: "/sprites/portraits-sheet.png",
      mainMapTileset: "/tilesets/outdoor_tileset_16_x_16.png",
      blueRoomTileset: "/tilesets/public_indoor_tileset.png"
    };

    // JSON maps to download
    this.toLoadJson = {
      mainMap: "/maps/main_map_16x16.json",
      blueRoom: "/maps/room_blue.json",
    };

    // A bucket to keep all of our images
    this.images = {};
    this.json = {};

    // Load each image
    Object.keys(this.toLoad).forEach(key => {
      const img = new Image();
      img.src = this.toLoad[key];
      this.images[key] = {
        image: img,
        isLoaded: false
      }
      img.onload = () => {
        this.images[key].isLoaded = true;
      }
    });

    // Load JSON files
    Object.keys(this.toLoadJson).forEach(key => {
      this.json[key] = {
        data: null,
        isLoaded: false
      };

      fetch(this.toLoadJson[key])
        .then(response => response.json())
        .then(data => {
          this.json[key].data = data;
          this.json[key].isLoaded = true;
        })
        .catch(err => {
          console.error(`Failed to load JSON: ${key}`, err);
        });
    });
  }
}

// Create one instance for the whole app to use
export const resources = new Resources();