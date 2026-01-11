#!/usr/bin/env node

/**
 * Map Splitter Tool
 *
 * Splits a large Tiled JSON map into smaller chunks for efficient loading.
 *
 * Usage:
 *   node tools/splitMap.js <input-map.json> [options]
 *
 * Options:
 *   --chunk-width <number>   Chunk width in tiles (default: 64)
 *   --chunk-height <number>  Chunk height in tiles (default: 64)
 *   --output <path>          Output directory (default: public/maps/chunks/)
 *
 * Example:
 *   node tools/splitMap.js public/maps/mymap.json --output public/maps/chunks/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
Map Splitter Tool

Usage:
  node tools/splitMap.js <input-map.json> [options]

Options:
  --chunk-width <number>   Chunk width in tiles (default: 64)
  --chunk-height <number>  Chunk height in tiles (default: 64)
  --output <path>          Output directory (default: public/maps/chunks/)

Example:
  node tools/splitMap.js public/maps/mymap.json --output public/maps/chunks/
  `);
  process.exit(0);
}

const inputFile = args[0];

// Parse chunk dimensions
const widthIndex = args.indexOf('--chunk-width');
const chunkWidth = widthIndex !== -1 ? parseInt(args[widthIndex + 1]) : 64;

const heightIndex = args.indexOf('--chunk-height');
const chunkHeight = heightIndex !== -1 ? parseInt(args[heightIndex + 1]) : 64;

// Parse output directory
const outputIndex = args.indexOf('--output');
const outputDir = outputIndex !== -1 ? args[outputIndex + 1] : 'public/maps/chunks/';

// Validate input
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

console.log('🗺️  Map Splitter Tool');
console.log('═'.repeat(50));
console.log(`📂 Input:  ${inputFile}`);
console.log(`📦 Output: ${outputDir}`);
console.log(`📐 Chunk:  ${chunkWidth}×${chunkHeight} tiles`);
console.log('═'.repeat(50));

// Read input map
const mapData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Validate map structure
if (!mapData.layers || !mapData.tilesets) {
  console.error('❌ Error: Invalid Tiled JSON format');
  process.exit(1);
}

const mapWidth = mapData.width;
const mapHeight = mapData.height;
const tileWidth = mapData.tilewidth;
const tileHeight = mapData.tileheight;

const chunksX = Math.ceil(mapWidth / chunkWidth);
const chunksY = Math.ceil(mapHeight / chunkHeight);

console.log(`\n📊 Map Info:`);
console.log(`   Size: ${mapWidth}×${mapHeight} tiles (${mapWidth * tileWidth}×${mapHeight * tileHeight} px)`);
console.log(`   Tiles: ${tileWidth}×${tileHeight} px each`);
console.log(`   Chunks: ${chunksX}×${chunksY} = ${chunksX * chunksY} total\n`);

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create master file with metadata
const masterData = {
  version: '1.0',
  chunkWidth,
  chunkHeight,
  chunksX,
  chunksY,
  mapWidth,
  mapHeight,
  tileWidth,
  tileHeight,
  tilesets: mapData.tilesets, // Include tileset data in master file
  infinite: false,
};

// Split each layer into chunks
const chunks = new Map(); // Key: "x,y" -> chunk data

for (let cy = 0; cy < chunksY; cy++) {
  for (let cx = 0; cx < chunksX; cx++) {
    const chunkKey = `${cx},${cy}`;
    chunks.set(chunkKey, {
      x: cx,
      y: cy,
      layers: [],
    });
  }
}

// Process each layer
for (const layer of mapData.layers) {
  if (layer.type === 'tilelayer') {
    splitTileLayer(layer, chunks, chunksX, chunksY);
  } else if (layer.type === 'objectgroup') {
    splitObjectLayer(layer, chunks, chunksX, chunksY);
  }
}

// Write chunk files
let savedChunks = 0;
for (const [chunkKey, chunkData] of chunks) {
  // Skip empty chunks (no tiles in any layer)
  const isEmpty = chunkData.layers.every(layer => {
    if (layer.type === 'tilelayer') {
      return layer.data.every(gid => gid === 0);
    } else if (layer.type === 'objectgroup') {
      return layer.objects.length === 0;
    }
    return true;
  });

  if (isEmpty) {
    continue; // Don't save empty chunks
  }

  const filename = `chunk_${chunkData.x}_${chunkData.y}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(chunkData, null, 2));
  savedChunks++;
}

// Write master file
const masterPath = path.join(outputDir, 'master.json');
fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2));

console.log(`✅ Success!`);
console.log(`   ${savedChunks} chunk files created`);
console.log(`   1 master file created`);
console.log(`   Output: ${outputDir}\n`);

// Helper functions

function splitTileLayer(layer, chunks, chunksX, chunksY) {
  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkKey = `${cx},${cy}`;
      const chunk = chunks.get(chunkKey);

      // Create layer data for this chunk
      const chunkLayer = {
        name: layer.name,
        type: 'tilelayer',
        visible: layer.visible !== false,
        opacity: layer.opacity ?? 1,
        width: chunkWidth,
        height: chunkHeight,
        data: new Array(chunkWidth * chunkHeight).fill(0),
      };

      // Copy tiles from original layer to chunk layer
      for (let ty = 0; ty < chunkHeight; ty++) {
        for (let tx = 0; tx < chunkWidth; tx++) {
          const globalTileX = cx * chunkWidth + tx;
          const globalTileY = cy * chunkHeight + ty;

          // Skip if outside original map bounds
          if (globalTileX >= mapWidth || globalTileY >= mapHeight) {
            continue;
          }

          const globalIndex = globalTileY * mapWidth + globalTileX;
          const chunkIndex = ty * chunkWidth + tx;

          chunkLayer.data[chunkIndex] = layer.data[globalIndex];
        }
      }

      chunk.layers.push(chunkLayer);
    }
  }
}

function splitObjectLayer(layer, chunks, chunksX, chunksY) {
  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkKey = `${cx},${cy}`;
      const chunk = chunks.get(chunkKey);

      // Create object layer for this chunk
      const chunkLayer = {
        name: layer.name,
        type: 'objectgroup',
        visible: layer.visible !== false,
        opacity: layer.opacity ?? 1,
        objects: [],
      };

      // Chunk bounds in pixels
      const chunkLeft = cx * chunkWidth * tileWidth;
      const chunkTop = cy * chunkHeight * tileHeight;
      const chunkRight = chunkLeft + chunkWidth * tileWidth;
      const chunkBottom = chunkTop + chunkHeight * tileHeight;

      // Copy objects that fall within this chunk
      if (layer.objects) {
        for (const obj of layer.objects) {
          // Check if object is within chunk bounds
          if (obj.x >= chunkLeft && obj.x < chunkRight &&
              obj.y >= chunkTop && obj.y < chunkBottom) {
            // Clone object with position relative to chunk
            const chunkObj = {
              ...obj,
              x: obj.x - chunkLeft,
              y: obj.y - chunkTop,
            };
            chunkLayer.objects.push(chunkObj);
          }
        }
      }

      chunk.layers.push(chunkLayer);
    }
  }
}
