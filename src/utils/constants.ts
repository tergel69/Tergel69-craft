// World constants
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const WORLD_HEIGHT = 256;
export const SEA_LEVEL = 62;
export const RENDER_DISTANCE = 32; // Increased from 16 for better visibility

// Player constants - IMPROVED for better Minecraft feel
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_REACH = 5;

// Movement - Tuned for responsiveness and consistency
export const PLAYER_SPEED = 4.317; // Base walking speed
export const PLAYER_SPRINT_MULTIPLIER = 1.3; // Reduced from 1.6 for more control
export const PLAYER_SNEAK_MULTIPLIER = 0.3;

// Swimming - Improved water feel
export const PLAYER_SWIM_SPEED = 3.0; // Increased from 2.0 for less frustration
export const PLAYER_SWIM_VERTICAL_SPEED = 2.0; // Increased from 1.5

// Jumping - Tuned for consistent height
export const JUMP_VELOCITY = 9.0; // Increased from 8 for more satisfying jumps
export const SWIM_VELOCITY = 3.0;

// Physics - Smoother gravity feel
export const GRAVITY = 30; // Slightly increased for snappier falling
export const TERMINAL_VELOCITY = 78.4;

// Movement smoothing - Tighter controls
export const MOVEMENT_ACCELERATION = 18; // Increased for snappier response
export const MOVEMENT_DECELERATION = 12; // Increased for quicker stops
export const AIR_CONTROL = 0.6; // Increased from 0.5 for better air control
export const WATER_CONTROL = 0.9; // Increased from 0.8 for better swimming
export const ROTATION_SMOOTHING = 0.15;

// Game constants
export const TICK_RATE = 20; // ticks per second
export const DAY_LENGTH = 20 * 60 * 1000; // 20 minutes in milliseconds
export const NOON = DAY_LENGTH / 2;

// Block breaking - Faster for better feel
export const BASE_BREAK_TIME = 0.8; // Reduced from 1.5 for quicker feedback

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

// Combat - Tuned for readability and fairness
export const PLAYER_ATTACK_COOLDOWN = 0.25; // Faster attacks for responsive feel
export const PLAYER_KNOCKBACK_STRENGTH = 2.5; // Stronger knockback for impact
export const PLAYER_INVULNERABILITY_TIME = 0.5; // Standard Minecraft invulnerability

// Damage - Balanced for difficulty
export const BASE_MELEE_DAMAGE = 3; // Player base melee damage
export const ARMOR_DAMAGE_REDUCTION_PER_LEVEL = 0.04; // 4% per armor level
export const ENCHANTMENT_DAMAGE_REDUCTION_PER_LEVEL = 0.03; // 3% per protection level

// Fall damage - Tuned to be forgiving but present
export const FALL_DAMAGE_THRESHOLD = 3; // Blocks before damage starts
export const FALL_DAMAGE_PER_BLOCK = 1; // Damage per block above threshold
export const MAX_FALL_DAMAGE = 20; // Cap fall damage

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
