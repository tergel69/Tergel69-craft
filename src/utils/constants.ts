// World constants
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const WORLD_HEIGHT = 256;
export const SEA_LEVEL = 62;
export const RENDER_DISTANCE = 16;

// Player constants
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_REACH = 5;
export const PLAYER_SPEED = 4.317; // blocks per second
export const PLAYER_SPRINT_MULTIPLIER = 1.3;
export const PLAYER_SNEAK_MULTIPLIER = 0.3;
export const PLAYER_SWIM_SPEED = 2.0; // blocks per second in water
export const PLAYER_SWIM_VERTICAL_SPEED = 1.5; // blocks per second up/down in water
export const JUMP_VELOCITY = 8;
export const SWIM_VELOCITY = 2.0;
export const GRAVITY = 28;
export const TERMINAL_VELOCITY = 78.4;

// Movement smoothing constants
export const MOVEMENT_ACCELERATION = 12; // How fast to reach target speed
export const MOVEMENT_DECELERATION = 8; // How fast to slow down
export const AIR_CONTROL = 0.5; // Air control factor
export const WATER_CONTROL = 0.8; // Water control factor
export const ROTATION_SMOOTHING = 0.15; // Camera smoothing factor (increased from 0.08 for more responsiveness)

// Game constants
export const TICK_RATE = 20; // ticks per second
export const DAY_LENGTH = 20 * 60 * 1000; // 20 minutes in milliseconds
export const NOON = DAY_LENGTH / 2;

// Block breaking
export const BASE_BREAK_TIME = 1.5; // seconds for hand

// Inventory
export const INVENTORY_ROWS = 3;
export const INVENTORY_COLS = 9;
export const HOTBAR_SLOTS = 9;
export const TOTAL_INVENTORY_SLOTS = INVENTORY_ROWS * INVENTORY_COLS + HOTBAR_SLOTS;

// Health and hunger
export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const MAX_ARMOR = 20;

// Mob constants
export const MOB_SPAWN_RADIUS = 24;
export const MOB_DESPAWN_RADIUS = 128;
export const MAX_MOBS_PER_CHUNK = 8;

// Directions for face culling
export const DIRECTIONS = {
  TOP: { x: 0, y: 1, z: 0 },
  BOTTOM: { x: 0, y: -1, z: 0 },
  NORTH: { x: 0, y: 0, z: -1 },
  SOUTH: { x: 0, y: 0, z: 1 },
  EAST: { x: 1, y: 0, z: 0 },
  WEST: { x: -1, y: 0, z: 0 },
} as const;

export const FACE_VERTICES = {
  TOP: [
    [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
  ],
  BOTTOM: [
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]
  ],
  NORTH: [
    [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]
  ],
  SOUTH: [
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
  ],
  EAST: [
    [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]
  ],
  WEST: [
    [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]
  ],
} as const;

export const FACE_NORMALS = {
  TOP: [0, 1, 0],
  BOTTOM: [0, -1, 0],
  NORTH: [0, 0, -1],
  SOUTH: [0, 0, 1],
  EAST: [1, 0, 0],
  WEST: [-1, 0, 0],
} as const;

export const FACE_UVS = [
  [0, 0], [1, 0], [1, 1], [0, 1]
] as const;
