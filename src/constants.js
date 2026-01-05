/**
 * Central constants file for RPG-Kit
 * All hardcoded magic numbers should be defined here for easy maintenance
 */

// ============================================================================
// DISPLAY CONSTANTS
// ============================================================================

export const DISPLAY = {
  CANVAS_WIDTH: 836,
  CANVAS_HEIGHT: 470,
  // Device pixel ratio is dynamic, accessed via window.devicePixelRatio
};

// ============================================================================
// GAME LOOP & TIMING
// ============================================================================

export const GAME_LOOP = {
  TARGET_FPS: 60,
  get TIME_STEP() {
    return 1000 / this.TARGET_FPS; // 16.666... ms per frame
  },
  MILLISECONDS_PER_SECOND: 1000,
};

// ============================================================================
// RENDERING & CULLING
// ============================================================================

export const CULLING = {
  SPRITE_PADDING: 32,  // Extra pixels for sprite visibility checks
  TILE_PADDING: 16,    // Extra pixels for tile visibility checks
};

// ============================================================================
// CAMERA SYSTEM
// ============================================================================

export const CAMERA = {
  DEAD_ZONE_WIDTH: 40,   // Horizontal dead zone (0 for instant follow)
  DEAD_ZONE_HEIGHT: 30,  // Vertical dead zone (0 for instant follow)

  // Default map dimensions (should ideally come from level data)
  DEFAULT_MAP_WIDTH: 1120,
  DEFAULT_MAP_HEIGHT: 640,
};

// ============================================================================
// SPRITE & ANIMATION DEFAULTS
// ============================================================================

export const SPRITE = {
  DEFAULT_FRAME_SIZE: 16,
  DEFAULT_SCALE: 1,
  DEFAULT_HORIZONTAL_FRAMES: 1,
  DEFAULT_VERTICAL_FRAMES: 1,
  DEFAULT_FRAME_INDEX: 0,

  // Hero-specific
  HERO_HALF_SIZE: 8,  // Half of 16x16 hero sprite
};

// ============================================================================
// RAIN EFFECT
// ============================================================================

export const RAIN = {
  SPRITE_WIDTH: 256,
  SPRITE_HEIGHT: 240,
  FRAME_DURATION: 100,  // Milliseconds per frame (10 FPS)
  ALPHA: 0.3,           // Transparency (30% opaque)
  FRAME_COUNT: 4,       // Number of animation frames
};

// ============================================================================
// LIGHTING SYSTEM
// ============================================================================

export const LIGHTING = {
  PIXEL_SIZE: 8,  // Pixel size for gradient downscaling (pixelated effect)
  HIGHLIGHT_PIXEL_SIZE: 1,  // Pixel size for gradient downscaling (pixelated effect)

  // Default highlight values
  HIGHLIGHT_RADIUS: 4,        // Radius multiplier (4 * 16 = 64px)
  HIGHLIGHT_INTENSITY: 0.8,   // 80% brightness

  // Light positioning offsets
  LIGHT_OFFSET_X: 8,
  LIGHT_OFFSET_Y: 2,  // Slightly above feet

  // Gradient configuration
  GRADIENT_STOP_1: 0.4,         // First transition at 40% radius
  GRADIENT_STOP_2: 0.7,         // Second transition at 70% radius
  GRADIENT_FALLOFF: 0.5,        // 50% intensity at second stop
};

// ============================================================================
// TIME OF DAY EFFECTS
// ============================================================================

export const TIME_OF_DAY = {
  BLEND_MODE: 'multiply',

  DUSK: {
    COLOR: 'rgba(116, 30, 4, 0.35)',  // Warm orange/pink at 35% opacity
    OPACITY: 0.35,
  },

  NIGHT: {
    COLOR: 'rgba(9, 9, 43, 0.55)',    // Dark blue at 55% opacity
    OPACITY: 0.55,
  },
};

// ============================================================================
// TILE SYSTEM
// ============================================================================

export const TILE = {
  WIDTH: 16,   // Standard tile width
  HEIGHT: 16,  // Standard tile height
};

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

export const PERFORMANCE = {
  // Maximum expected children before considering spatial partitioning
  MAX_CHILDREN_PER_OBJECT: 100,

  // Maximum lights before considering canvas pooling
  MAX_LIGHTS_BEFORE_POOLING: 10,
};
