import { BlockType, isSolid } from '@/data/blocks';

// ─────────────────────────────────────────────────────────────────────────────
// Hostile Mob State Types
// ─────────────────────────────────────────────────────────────────────────────

export type HostileMobState = 
  | 'idle'         // Default state, no target
  | 'wander'       // Random movement when not engaged
  | 'chase'        // Actively pursuing player
  | 'attack'       // In attack range, preparing/attacking
  | 'retreat'      // Backing off (low health, etc.)
  | 'stuck'        // Blocked by obstacles
  | 'dead';        // Dead, awaiting cleanup

export type CombatType = 'melee' | 'ranged' | 'explosive' | 'utility';

// ─────────────────────────────────────────────────────────────────────────────
// Combat Profiles
// ─────────────────────────────────────────────────────────────────────────────

export interface CombatProfile {
  type: CombatType;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  knockback: number;
  knockbackY: number;
  
  // Ranged specific
  projectileSpeed?: number;
  projectileDamage?: number;
  
  // Explosive specific
  fuseTime?: number;
  explosionRadius?: number;
  explosionPower?: number;
  destroysBlocks?: boolean;
  
  // Utility specific
  specialAbility?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement Profiles
// ─────────────────────────────────────────────────────────────────────────────

export interface MovementProfile {
  baseSpeed: number;
  sprintSpeed: number;
  swimSpeed: number;
  canJump: boolean;
  jumpVelocity: number;
  canSwim: boolean;
  canClimb: boolean;
  
  // Obstacle avoidance
  stepHeight: number;
  canBreakDoors: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection & AI Profiles
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectionProfile {
  detectionRange: number;
  followRange: number;
  attackRange: number;
  sightRange: number;
  
  // Target memory
  memoryTime: number;      // How long to remember player location
  searchRadius: number;    // How far to search for player
  
  // State transitions
  aggroCooldown: number;
  deaggroDelay: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environmental Profiles  
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvironmentalProfile {
  burnsInSun: boolean;
  burnDamagePerTick: number;
  burnTickRate: number;
  canDrown: boolean;
  canFall: boolean;
  fallDamageMultiplier: number;
  lavaDamage: number;
  fireDamage: number;
  
  // Biome preferences
  preferredBiomes: string[];
  avoidBiomes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawning Profiles
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnProfile {
  spawnWeight: number;
  minLight: number;
  maxLight: number;
  minDistance: number;
  maxDistance: number;
  minPlayerDistance: number;
  canSpawnInWater: boolean;
  canSpawnInlava: boolean;
  
  // Group spawning
  spawnsInGroups: boolean;
  minGroupSize: number;
  maxGroupSize: number;
  
  // Time-based
  spawnsAtNight: boolean;
  spawnsInRain: boolean;
  minWorldDay: number;
  
  // Biome preferences
  preferredBiomes: string[];
  avoidBiomes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mob Drop Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface MobDropConfig {
  item: number | string;  // BlockType or ItemType
  count: [number, number]; // [min, max]
  chance: number;
  scaleWithLooting?: boolean;
  scaleWithDifficulty?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete Mob Behavior Config
// ─────────────────────────────────────────────────────────────────────────────

export interface MobBehaviorConfig {
  // Identity
  id: string;
  displayName: string;
  
  // Base stats
  health: number;
  maxHealth: number;
  width: number;
  height: number;
  
  // Subsystems
  combat: CombatProfile;
  movement: MovementProfile;
  detection: DetectionProfile;
  environmental: EnvironmentalProfile;
  spawn: SpawnProfile;
  drops: MobDropConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mob Behavior Config Library
// ─────────────────────────────────────────────────────────────────────────────

export const MOB_CONFIGS: Record<string, MobBehaviorConfig> = {
  zombie: {
    id: 'zombie',
    displayName: 'Zombie',
    health: 20,
    maxHealth: 20,
    width: 0.6,
    height: 1.95,
    combat: {
      type: 'melee',
      damage: 3,
      attackRange: 2.2,
      attackCooldown: 0.8,
      knockback: 2.5,
      knockbackY: 3,
    },
    movement: {
      baseSpeed: 2.3,
      sprintSpeed: 3.2,
      swimSpeed: 1.5,
      canJump: true,
      jumpVelocity: 7,
      canSwim: true,
      canClimb: false,
      stepHeight: 0.6,
      canBreakDoors: true,
    },
    detection: {
      detectionRange: 40,
      followRange: 48,
      attackRange: 2.2,
      sightRange: 32,
      memoryTime: 8,
      searchRadius: 8,
      aggroCooldown: 0,
      deaggroDelay: 5,
    },
    environmental: {
      burnsInSun: true,
      burnDamagePerTick: 1,
      burnTickRate: 1,
      canDrown: true,
      canFall: true,
      fallDamageMultiplier: 1,
      lavaDamage: 5,
      fireDamage: 1,
      preferredBiomes: ['swamp', 'plains', 'forest'],
      avoidBiomes: ['desert', 'jungle'],
    },
    spawn: {
      spawnWeight: 100,
      minLight: 0,
      maxLight: 7,
      minDistance: 24,
      maxDistance: 64,
      minPlayerDistance: 8,
      canSpawnInWater: false,
      canSpawnInlava: false,
      spawnsInGroups: true,
      minGroupSize: 2,
      maxGroupSize: 4,
      spawnsAtNight: true,
      spawnsInRain: true,
      minWorldDay: 0,
      preferredBiomes: [],
      avoidBiomes: [],
    },
    drops: [
      { item: 'ROTTEN_FLESH', count: [0, 2], chance: 1 },
      { item: 'IRON_INGOT', count: [0, 1], chance: 0.025 },
      { item: 'CARROT', count: [0, 1], chance: 0.03 },
      { item: 'POTATO', count: [0, 1], chance: 0.03 },
    ],
  },
  
  skeleton: {
    id: 'skeleton',
    displayName: 'Skeleton',
    health: 20,
    maxHealth: 20,
    width: 0.6,
    height: 1.99,
    combat: {
      type: 'ranged',
      damage: 2,
      attackRange: 16,
      attackCooldown: 1.5,
      knockback: 0.5,
      knockbackY: 1,
      projectileSpeed: 15,
      projectileDamage: 2,
    },
    movement: {
      baseSpeed: 2.4,
      sprintSpeed: 3.3,
      swimSpeed: 1.5,
      canJump: true,
      jumpVelocity: 6,
      canSwim: true,
      canClimb: false,
      stepHeight: 0.6,
      canBreakDoors: false,
    },
    detection: {
      detectionRange: 24,
      followRange: 32,
      attackRange: 16,
      sightRange: 24,
      memoryTime: 10,
      searchRadius: 6,
      aggroCooldown: 0,
      deaggroDelay: 5,
    },
    environmental: {
      burnsInSun: true,
      burnDamagePerTick: 1,
      burnTickRate: 1,
      canDrown: true,
      canFall: true,
      fallDamageMultiplier: 1,
      lavaDamage: 5,
      fireDamage: 1,
      preferredBiomes: ['plains', 'forest', 'taiga'],
      avoidBiomes: [],
    },
    spawn: {
      spawnWeight: 80,
      minLight: 0,
      maxLight: 7,
      minDistance: 24,
      maxDistance: 64,
      minPlayerDistance: 8,
      canSpawnInWater: false,
      canSpawnInlava: false,
      spawnsInGroups: true,
      minGroupSize: 2,
      maxGroupSize: 4,
      spawnsAtNight: true,
      spawnsInRain: true,
      minWorldDay: 0,
      preferredBiomes: [],
      avoidBiomes: [],
    },
    drops: [
      { item: 'BONE', count: [0, 2], chance: 1 },
      { item: 'ARROW', count: [0, 2], chance: 1 },
      { item: 'BOW', count: [0, 1], chance: 0.085 },
    ],
  },
  
  creeper: {
    id: 'creeper',
    displayName: 'Creeper',
    health: 20,
    maxHealth: 20,
    width: 0.6,
    height: 1.7,
    combat: {
      type: 'explosive',
      damage: 0,
      attackRange: 3,
      attackCooldown: 0,
      knockback: 0,
      knockbackY: 0,
      fuseTime: 1.5,
      explosionRadius: 3,
      explosionPower: 6,
      destroysBlocks: true,
    },
    movement: {
      baseSpeed: 2.5,
      sprintSpeed: 3.5,
      swimSpeed: 1.5,
      canJump: true,
      jumpVelocity: 7,
      canSwim: true,
      canClimb: false,
      stepHeight: 0.6,
      canBreakDoors: false,
    },
    detection: {
      detectionRange: 16,
      followRange: 24,
      attackRange: 3,
      sightRange: 16,
      memoryTime: 5,
      searchRadius: 6,
      aggroCooldown: 0,
      deaggroDelay: 3,
    },
    environmental: {
      burnsInSun: false,
      burnDamagePerTick: 0,
      burnTickRate: 0,
      canDrown: true,
      canFall: true,
      fallDamageMultiplier: 1,
      lavaDamage: 5,
      fireDamage: 1,
      preferredBiomes: [],
      avoidBiomes: [],
    },
    spawn: {
      spawnWeight: 60,
      minLight: 0,
      maxLight: 7,
      minDistance: 24,
      maxDistance: 64,
      minPlayerDistance: 8,
      canSpawnInWater: false,
      canSpawnInlava: false,
      spawnsInGroups: false,
      minGroupSize: 1,
      maxGroupSize: 1,
      spawnsAtNight: true,
      spawnsInRain: true,
      minWorldDay: 0,
      preferredBiomes: [],
      avoidBiomes: [],
    },
    drops: [
      { item: 'GUNPOWDER', count: [0, 2], chance: 1 },
      { item: 'MUSIC_DISC_13', count: [1, 1], chance: 0.02 },
      { item: 'MUSIC_DISC_CAT', count: [1, 1], chance: 0.02 },
    ],
  },
  
  spider: {
    id: 'spider',
    displayName: 'Spider',
    health: 16,
    maxHealth: 16,
    width: 0.9,
    height: 0.85,
    combat: {
      type: 'melee',
      damage: 2,
      attackRange: 2,
      attackCooldown: 0.6,
      knockback: 2,
      knockbackY: 2.5,
    },
    movement: {
      baseSpeed: 3.2,
      sprintSpeed: 4.5,
      swimSpeed: 1.8,
      canJump: true,
      jumpVelocity: 6,
      canSwim: true,
      canClimb: true,
      stepHeight: 0.8,
      canBreakDoors: false,
    },
    detection: {
      detectionRange: 20,
      followRange: 32,
      attackRange: 2,
      sightRange: 16,
      memoryTime: 6,
      searchRadius: 6,
      aggroCooldown: 0,
      deaggroDelay: 4,
    },
    environmental: {
      burnsInSun: false,
      burnDamagePerTick: 0,
      burnTickRate: 0,
      canDrown: true,
      canFall: true,
      fallDamageMultiplier: 0.5,
      lavaDamage: 5,
      fireDamage: 1,
      preferredBiomes: ['plains', 'forest', 'dark_forest'],
      avoidBiomes: ['desert', 'ice_plains'],
    },
    spawn: {
      spawnWeight: 50,
      minLight: 0,
      maxLight: 7,
      minDistance: 16,
      maxDistance: 48,
      minPlayerDistance: 6,
      canSpawnInWater: false,
      canSpawnInlava: false,
      spawnsInGroups: true,
      minGroupSize: 1,
      maxGroupSize: 3,
      spawnsAtNight: true,
      spawnsInRain: true,
      minWorldDay: 0,
      preferredBiomes: [],
      avoidBiomes: [],
    },
    drops: [
      { item: 'STRING', count: [0, 1], chance: 0.33 },
      { item: 'SPIDER_EYE', count: [0, 1], chance: 0.1 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty Scaling
// ─────────────────────────────────────────────────────────────────────────────

export function getDifficultyMultiplier(dayCount: number): number {
  if (dayCount < 5) return 1;
  return Math.min(1 + (dayCount - 5) * 0.08, 3);
}

export function getNightIntensity(dayCount: number): number {
  if (dayCount < 3) return 0.75;
  if (dayCount < 8) return 1;
  return Math.min(1 + (dayCount - 8) * 0.12, 2.5);
}

// Apply difficulty scaling to a mob config
export function applyDifficultyScaling(config: MobBehaviorConfig, dayCount: number): MobBehaviorConfig {
  const multiplier = getDifficultyMultiplier(dayCount);
  
  return {
    ...config,
    health: Math.floor(config.health * multiplier),
    maxHealth: Math.floor(config.maxHealth * multiplier),
    combat: {
      ...config.combat,
      damage: Math.floor(config.combat.damage * multiplier),
      explosionRadius: config.combat.explosionRadius 
        ? Math.floor(config.combat.explosionRadius + multiplier * 0.5) 
        : undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawning Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnContext {
  x: number;
  y: number;
  z: number;
  biome: string;
  lightLevel: number;
  isNight: boolean;
  isRaining: boolean;
  dayCount: number;
  playerX: number;
  playerY: number;
  playerZ: number;
}

export function canMobSpawnHere(config: MobBehaviorConfig, ctx: SpawnContext): boolean {
  const spawn = config.spawn;
  const distToPlayer = Math.sqrt(
    Math.pow(ctx.x - ctx.playerX, 2) + 
    Math.pow(ctx.z - ctx.playerZ, 2)
  );
  
  // Distance check
  if (distToPlayer < spawn.minPlayerDistance) return false;
  if (distToPlayer < spawn.minDistance || distToPlayer > spawn.maxDistance) return false;
  
  // Light check
  if (ctx.lightLevel < spawn.minLight || ctx.lightLevel > spawn.maxLight) return false;
  
  // Time check
  if (spawn.spawnsAtNight && !ctx.isNight && ctx.lightLevel > 7) return false;

  // World day check
  if (ctx.dayCount < spawn.minWorldDay) return false;
  
  // Biome check (use environmental profile for biome preferences)
  const env = config.environmental;
  if (env.avoidBiomes.includes(ctx.biome)) return false;
  if (env.preferredBiomes.length > 0 && !env.preferredBiomes.includes(ctx.biome)) {
    // Mob prefers certain biomes - reduced spawn chance but not prevented
    if (Math.random() > 0.3) return false;
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pathfinding Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface PathNode {
  x: number;
  y: number;
  z: number;
  g: number;  // Cost from start
  h: number;  // Heuristic to goal
  f: number;  // Total cost
  parent: PathNode | null;
}

// Simple A* pathfinding for mobs (can be enhanced later)
export function findPath(
  startX: number, startY: number, startZ: number,
  goalX: number, goalY: number, goalZ: number,
  world: { getBlock: (x: number, y: number, z: number) => number },
  maxIterations: number = 200
): PathNode[] {
  const openSet: PathNode[] = [];
  const closedSet: Set<string> = new Set();
  
  const startNode: PathNode = {
    x: startX,
    y: startY,
    z: startZ,
    g: 0,
    h: Math.sqrt(Math.pow(goalX - startX, 2) + Math.pow(goalY - startY, 2) + Math.pow(goalZ - startZ, 2)),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);
  
  const directions = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  ];
  
  let iterations = 0;
  
  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    
    // Find node with lowest f
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }
    
    const current = openSet.splice(currentIndex, 1)[0];
    
    // Check if we reached the goal
    if (Math.abs(current.x - goalX) <= 1 && 
        Math.abs(current.z - goalZ) <= 1 &&
        Math.abs(current.y - goalY) <= 2) {
      // Reconstruct path
      const path: PathNode[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift(node);
        node = node.parent;
      }
      return path;
    }
    
    closedSet.add(`${current.x},${current.y},${current.z}`);
    
    // Explore neighbors
    for (const dir of directions) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nz = current.z + dir.z;
      const key = `${nx},${ny},${nz}`;
      
      if (closedSet.has(key)) continue;
      
      // Check if walkable
      const blockBelow = world.getBlock(nx, ny - 1, nz);
      const blockAt = world.getBlock(nx, ny, nz);
      const blockAbove = world.getBlock(nx, ny + 1, nz);
      
      if (!isSolid(blockBelow)) continue;
      if (isSolid(blockAt) && dir.y >= 0) continue;
      if (isSolid(blockAbove)) continue;
      
      const g = current.g + 1;
      const h = Math.sqrt(Math.pow(goalX - nx, 2) + Math.pow(goalY - ny, 2) + Math.pow(goalZ - nz, 2));
      
      const existingNode = openSet.find(n => n.x === nx && n.y === ny && n.z === nz);
      if (existingNode) {
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = g + h;
          existingNode.parent = current;
        }
      } else {
        openSet.push({
          x: nx, y: ny, z: nz,
          g, h, f: g + h,
          parent: current,
        });
      }
    }
  }
  
  return []; // No path found
}

// Line of sight check
export function hasLineOfSight(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  world: { getBlock: (x: number, y: number, z: number) => number },
  maxDistance: number = 32
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (distance > maxDistance) return false;
  
  const steps = Math.ceil(distance * 2);
  const stepX = dx / steps;
  const stepY = dy / steps;
  const stepZ = dz / steps;
  
  for (let i = 1; i < steps; i++) {
    const x = Math.floor(x1 + stepX * i);
    const y = Math.floor(y1 + stepY * i);
    const z = Math.floor(z1 + stepZ * i);
    
    const block = world.getBlock(x, y, z);
    if (isSolid(block)) return false;
  }
  
  return true;
}
