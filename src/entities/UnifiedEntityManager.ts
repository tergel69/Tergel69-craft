import { Entity } from './Entity';
import { Mob } from './Mob';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore, getTimeOfDay } from '@/stores/gameStore';
import { MOB_SPAWN_RADIUS, MOB_DESPAWN_RADIUS, MAX_MOBS_PER_CHUNK, CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { useWorldStore } from '@/stores/worldStore';
import { worldToChunk, worldToLocal, chunkKey, Vector3 } from '@/utils/coordinates';
import { BlockType, isSolid } from '@/data/blocks';
import { BiomeType as TerrainBiomeType } from '@/engine/TerrainGenerator';
import { decodeTerrainBiome } from '@/utils/biomeEncoding';
import { LightingUtils } from '@/engine/LightingOptimizer';
import {
  EnhancedHostileMob,
  createEnhancedHostileMob,
  canSpawnAt,
  EntityData,
} from './EnhancedHostileMob';
import { MOB_CONFIGS, SpawnContext, getNightIntensity } from './MobBehaviorConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Unified Entity Manager - Consolidates regular and optimized systems
// ─────────────────────────────────────────────────────────────────────────────

export type MobSpawnType = 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'pig' | 'cow' | 'sheep' | 'chicken' | 'wolf' | 'ocelot';

export type EntityType = Entity | EnhancedHostileMob;

// ─────────────────────────────────────────────────────────────────────────────
// Passive Mob Factory (keeps existing classes working)
// ─────────────────────────────────────────────────────────────────────────────

function createPassiveMob(type: string, x: number, y: number, z: number): Entity | null {
  // Lazy import to avoid circular dependencies
  switch (type) {
    case 'pig':
      return new (require('./mobs/Pig').Pig)(x, y, z);
    case 'cow':
      return new (require('./mobs/Cow').Cow)(x, y, z);
    case 'sheep':
      return new (require('./mobs/Sheep').Sheep)(x, y, z);
    case 'chicken':
      return new (require('./mobs/Chicken').Chicken)(x, y, z);
    case 'wolf':
      return new (require('./mobs/Wolf').Wolf)(x, y, z);
    case 'ocelot':
      return new (require('./mobs/Ocelot').Ocelot)(x, y, z);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn Tables
// ─────────────────────────────────────────────────────────────────────────────

type SpawnWeight = { type: MobSpawnType; weight: number };

const PASSIVE_SPAWN_TABLE: Partial<Record<TerrainBiomeType, SpawnWeight[]>> = {
  [TerrainBiomeType.PLAINS]: [
    { type: 'cow', weight: 0.3 },
    { type: 'sheep', weight: 0.25 },
    { type: 'pig', weight: 0.25 },
    { type: 'chicken', weight: 0.2 },
  ],
  [TerrainBiomeType.SUNFLOWER_PLAINS]: [
    { type: 'cow', weight: 0.3 },
    { type: 'sheep', weight: 0.3 },
    { type: 'pig', weight: 0.2 },
    { type: 'chicken', weight: 0.2 },
  ],
  [TerrainBiomeType.FOREST]: [
    { type: 'cow', weight: 0.3 },
    { type: 'sheep', weight: 0.25 },
    { type: 'pig', weight: 0.2 },
    { type: 'chicken', weight: 0.25 },
  ],
  [TerrainBiomeType.DARK_FOREST]: [
    { type: 'cow', weight: 0.3 },
    { type: 'sheep', weight: 0.25 },
    { type: 'pig', weight: 0.25 },
    { type: 'chicken', weight: 0.2 },
  ],
  [TerrainBiomeType.JUNGLE]: [
    { type: 'chicken', weight: 0.4 },
    { type: 'pig', weight: 0.3 },
    { type: 'cow', weight: 0.2 },
    { type: 'sheep', weight: 0.1 },
    { type: 'ocelot', weight: 0.2 },
  ],
  [TerrainBiomeType.SAVANNA]: [
    { type: 'cow', weight: 0.4 },
    { type: 'sheep', weight: 0.25 },
    { type: 'pig', weight: 0.2 },
    { type: 'chicken', weight: 0.15 },
  ],
  [TerrainBiomeType.TAIGA]: [
    { type: 'sheep', weight: 0.35 },
    { type: 'cow', weight: 0.25 },
    { type: 'chicken', weight: 0.25 },
    { type: 'pig', weight: 0.15 },
    { type: 'wolf', weight: 0.25 },
  ],
  [TerrainBiomeType.SNOW]: [
    { type: 'sheep', weight: 0.4 },
    { type: 'cow', weight: 0.25 },
    { type: 'chicken', weight: 0.2 },
    { type: 'pig', weight: 0.15 },
    { type: 'wolf', weight: 0.18 },
  ],
  [TerrainBiomeType.MOUNTAINS]: [
    { type: 'sheep', weight: 0.45 },
    { type: 'cow', weight: 0.25 },
    { type: 'pig', weight: 0.15 },
    { type: 'chicken', weight: 0.15 },
  ],
  [TerrainBiomeType.MEGA_MOUNTAINS]: [
    { type: 'sheep', weight: 0.5 },
    { type: 'cow', weight: 0.2 },
    { type: 'pig', weight: 0.15 },
    { type: 'chicken', weight: 0.15 },
  ],
  [TerrainBiomeType.SWAMP]: [
    { type: 'pig', weight: 0.4 },
    { type: 'chicken', weight: 0.3 },
    { type: 'cow', weight: 0.2 },
    { type: 'sheep', weight: 0.1 },
  ],
};

// New enhanced hostile spawn table using behavior configs
const HOSTILE_SPAWN_TABLE: Partial<Record<TerrainBiomeType, MobSpawnType[]>> = {
  [TerrainBiomeType.SNOW]: ['skeleton', 'zombie', 'creeper', 'spider'],
  [TerrainBiomeType.TAIGA]: ['zombie', 'skeleton', 'creeper', 'spider'],
  [TerrainBiomeType.SWAMP]: ['zombie', 'skeleton', 'creeper', 'spider'],
  [TerrainBiomeType.DESERT]: ['skeleton', 'zombie', 'creeper'], // Desert has more skeletons due to lack of vegetation
  [TerrainBiomeType.PLAINS]: ['zombie', 'skeleton', 'creeper', 'spider'],
  [TerrainBiomeType.FOREST]: ['zombie', 'skeleton', 'creeper', 'spider'],
  [TerrainBiomeType.DARK_FOREST]: ['zombie', 'skeleton', 'creeper', 'spider'],
};

// Extended spawn tables for better biome variety - using only valid TerrainBiomeType values
const BIOME_PASSIVE_VARIANTS: Partial<Record<TerrainBiomeType, { mob: string; variant: string; spawnWeight: number }[]>> = {
  // Desert biome - more chickens, dusty pigs
  [TerrainBiomeType.DESERT]: [
    { mob: 'chicken', variant: 'wild', spawnWeight: 0.5 },
    { mob: 'pig', variant: 'dusty', spawnWeight: 0.3 },
    { mob: 'cow', variant: 'dry', spawnWeight: 0.2 },
  ],
  // Forest biome - more variety
  [TerrainBiomeType.FOREST]: [
    { mob: 'pig', variant: 'forest', spawnWeight: 0.3 },
    { mob: 'cow', variant: 'forest', spawnWeight: 0.25 },
    { mob: 'sheep', variant: 'forest', spawnWeight: 0.25 },
    { mob: 'chicken', variant: 'forest', spawnWeight: 0.2 },
  ],
  // Dark forest - darker variants
  [TerrainBiomeType.DARK_FOREST]: [
    { mob: 'pig', variant: 'dark', spawnWeight: 0.35 },
    { mob: 'cow', variant: 'dark', spawnWeight: 0.3 },
    { mob: 'sheep', variant: 'dark', spawnWeight: 0.2 },
    { mob: 'chicken', variant: 'dark', spawnWeight: 0.15 },
  ],
  // Taiga - colder climate animals
  [TerrainBiomeType.TAIGA]: [
    { mob: 'sheep', variant: 'white', spawnWeight: 0.4 },
    { mob: 'cow', variant: 'cold', spawnWeight: 0.3 },
    { mob: 'pig', variant: 'cold', spawnWeight: 0.2 },
    { mob: 'chicken', variant: 'cold', spawnWeight: 0.1 },
    { mob: 'wolf', variant: 'taiga', spawnWeight: 0.35 },
  ],
  // Savanna - more cattle
  [TerrainBiomeType.SAVANNA]: [
    { mob: 'cow', variant: 'savanna', spawnWeight: 0.45 },
    { mob: 'sheep', variant: 'golden', spawnWeight: 0.3 },
    { mob: 'pig', variant: 'savanna', spawnWeight: 0.15 },
    { mob: 'chicken', variant: 'savanna', spawnWeight: 0.1 },
  ],
  // Jungle - lots of chickens
  [TerrainBiomeType.JUNGLE]: [
    { mob: 'chicken', variant: 'tropical', spawnWeight: 0.5 },
    { mob: 'pig', variant: 'jungle', spawnWeight: 0.3 },
    { mob: 'cow', variant: 'tropical', spawnWeight: 0.2 },
    { mob: 'ocelot', variant: 'jungle', spawnWeight: 0.35 },
  ],
  // Swamp - muddy variants
  [TerrainBiomeType.SWAMP]: [
    { mob: 'pig', variant: 'swamp', spawnWeight: 0.4 },
    { mob: 'chicken', variant: 'swamp', spawnWeight: 0.3 },
    { mob: 'cow', variant: 'swamp', spawnWeight: 0.2 },
    { mob: 'sheep', variant: 'muddy', spawnWeight: 0.1 },
  ],
  // Snow biomes - white variants
  [TerrainBiomeType.SNOW]: [
    { mob: 'sheep', variant: 'white', spawnWeight: 0.5 },
    { mob: 'pig', variant: 'cold', spawnWeight: 0.25 },
    { mob: 'cow', variant: 'snow', spawnWeight: 0.15 },
    { mob: 'chicken', variant: 'snow', spawnWeight: 0.1 },
    { mob: 'wolf', variant: 'snow', spawnWeight: 0.18 },
  ],
  // Mountains - sheep are more common
  [TerrainBiomeType.MOUNTAINS]: [
    { mob: 'sheep', variant: 'mountain', spawnWeight: 0.6 },
    { mob: 'cow', variant: 'mountain', spawnWeight: 0.3 },
    { mob: 'pig', variant: 'mountain', spawnWeight: 0.1 },
  ],
  // Plains - default balanced
  [TerrainBiomeType.PLAINS]: [
    { mob: 'cow', variant: 'plains', spawnWeight: 0.3 },
    { mob: 'sheep', variant: 'plains', spawnWeight: 0.3 },
    { mob: 'pig', variant: 'plains', spawnWeight: 0.25 },
    { mob: 'chicken', variant: 'plains', spawnWeight: 0.15 },
  ],
};

const DEFAULT_PASSIVE_WEIGHTS: SpawnWeight[] = [
  { type: 'pig', weight: 0.25 },
  { type: 'cow', weight: 0.3 },
  { type: 'sheep', weight: 0.25 },
  { type: 'chicken', weight: 0.2 },
];

const DEFAULT_HOSTILE_TYPES: MobSpawnType[] = ['zombie', 'skeleton', 'creeper'];

function pickWeighted(types: SpawnWeight[]): MobSpawnType {
  const total = types.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of types) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return types[0].type;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Entity Manager Class
// ─────────────────────────────────────────────────────────────────────────────

class UnifiedEntityManager {
  // Core entity storage
  private entities: Map<string, EntityType> = new Map();
  
  // Spatial indexing for performance (borrowed from OptimizedEntityManager)
  private spatialGrid: Map<string, Set<string>> = new Map();
  private gridCellSize: number = 16;
  
  // Cooldowns
  private spawnCooldown: number = 0;
  private breedingCooldown: number = 0;
  private bootstrapDone: boolean = false;
  
  // Performance optimization
  private updateDistance: number = 48; // Only update entities within this range
  private maxActiveMobs: number = 50;
  
  // Hostile mob list for quick access
  private hostileMobs: Set<string> = new Set();
  private passiveMobs: Set<string> = new Set();

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Update Loop
  // ─────────────────────────────────────────────────────────────────────────────

  update(delta: number): void {
    const player = usePlayerStore.getState();
    const gameState = useGameStore.getState().gameState;

    if (gameState !== 'playing') return;

    // Bootstrap initial mobs
    if (!this.bootstrapDone) {
      this.populateAroundPlayer(player.position.x, player.position.z, 14);
      this.bootstrapDone = true;
    }

    // Update all entities
    this.updateEntities(delta, player.position);

    // Handle spawning
    this.spawnCooldown -= delta;
    if (this.spawnCooldown <= 0) {
      this.trySpawnMobs();
      this.spawnCooldown = 1.25;
    }

    // Handle passive breeding
    this.breedingCooldown -= delta;
    if (this.breedingCooldown <= 0) {
      this.tryBreedPassiveMobs();
      this.breedingCooldown = 8;
    }

    // Cleanup dead entities
    this.cleanupDeadEntities();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Entity Update with Spatial Optimization
  // ─────────────────────────────────────────────────────────────────────────────

  private updateEntities(delta: number, playerPos: { x: number; y: number; z: number }): void {
    const playerX = playerPos.x;
    const playerY = playerPos.y;
    const playerZ = playerPos.z;
    const updateDistSq = this.updateDistance * this.updateDistance;
    
    // Get nearby grid cells
    const playerGridKey = this.getSpatialGridKey({ x: playerX, y: playerY, z: playerZ });
    const [gx, gy, gz] = playerGridKey.split('_').map(Number);
    const cellsToCheck = 4; // Check 4 cells in each direction
    
    const nearbyEntityIds = new Set<string>();
    
    for (let x = -cellsToCheck; x <= cellsToCheck; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -cellsToCheck; z <= cellsToCheck; z++) {
          const key = `${gx + x}_${gy + y}_${gz + z}`;
          const cell = this.spatialGrid.get(key);
          if (cell) {
            cell.forEach(id => nearbyEntityIds.add(id));
          }
        }
      }
    }
    
    // Update entities
    for (const [id, entity] of Array.from(this.entities)) {
      if (entity.isDead) continue;
      
      // For hostile mobs, always update if near player
      if (this.hostileMobs.has(id)) {
        const distSq = this.getDistanceSquared(entity, playerX, playerY, playerZ);
        if (distSq > updateDistSq) {
          // Far from player - reduce AI tick rate (simple LOD)
          if (entity.age % 4 !== 0) continue;
        }
      }
      
      // Update entity
      if ('update' in entity) {
        entity.update(delta);
      }
      entity.age++;
      
      // Update spatial grid position
      this.updateSpatialGrid(id, entity);
      
      // Despawn if too far
      const distance = entity.distanceTo(playerX, playerY, playerZ);
      if (distance > MOB_DESPAWN_RADIUS) {
        this.remove(id);
      }
    }
  }

  private getDistanceSquared(entity: EntityType, px: number, py: number, pz: number): number {
    const dx = entity.position.x - px;
    const dy = entity.position.y - py;
    const dz = entity.position.z - pz;
    return dx * dx + dy * dy + dz * dz;
  }

  private cleanupDeadEntities(): void {
    const toRemove: string[] = [];
    
    for (const [id, entity] of this.entities) {
      if (entity.isDead) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.remove(id);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Spawning Logic
  // ─────────────────────────────────────────────────────────────────────────────

  private trySpawnMobs(): void {
    const worldTime = useGameStore.getState().worldTime;
    const dayCount = useGameStore.getState().dayCount;
    const timeOfDay = getTimeOfDay(worldTime);
    const player = usePlayerStore.getState();
    const isRaining = worldTime % 24000 > 12000 && worldTime % 24000 < 18000; // Simplified rain check
    const playerLight = LightingUtils.getAverageLightLevel(
      Math.floor(player.position.x),
      Math.floor(player.position.y),
      Math.floor(player.position.z),
      1
    );
    const hostileWindow = timeOfDay === 'night' || timeOfDay === 'sunset' || playerLight <= 7;

    // Don't spawn too many mobs
    if (this.entities.size >= this.maxActiveMobs) return;

    // Keep passive mobs at healthy level
    if (this.getPassiveMobCount() < 16) {
      this.spawnPassiveMob(player.position.x, player.position.z);
      if (Math.random() < 0.5) this.spawnPassiveMob(player.position.x, player.position.z);
    }

    // Spawn passive mobs during day
    if (timeOfDay === 'day' || timeOfDay === 'sunrise') {
      if (Math.random() < 0.5 || this.getPassiveMobCount() < 8) {
        this.spawnPassiveMob(player.position.x, player.position.z);
      }
    }

    // Spawn hostile mobs at night or while the player is exploring dark places.
    if (dayCount >= 1 && hostileWindow) {
      const nightIntensity = getNightIntensity(dayCount);
      const spawnChance = 0.25 * nightIntensity;
      
      if (Math.random() < spawnChance) {
        this.spawnHostileMob(player.position.x, player.position.z, dayCount);
      }
      
      // Spawn additional mobs based on intensity
      if (nightIntensity > 1 && Math.random() < (nightIntensity - 1) * 0.3) {
        this.spawnHostileMob(player.position.x, player.position.z, dayCount);
      }
    }
  }

  private spawnPassiveMob(playerX: number, playerZ: number): void {
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = MOB_SPAWN_RADIUS + Math.random() * 16;
    const x = playerX + Math.cos(angle) * distance;
    const z = playerZ + Math.sin(angle) * distance;

    const groundInfo = this.findGroundPosition(x, z);
    if (!groundInfo) return;

    // Prefer spawning passive mobs in friendlier biomes
    const biomeType = groundInfo.biome;
    if (
      biomeType === TerrainBiomeType.OCEAN ||
      biomeType === TerrainBiomeType.DEEP_OCEAN ||
      biomeType === TerrainBiomeType.VOLCANIC ||
      biomeType === TerrainBiomeType.MUSHROOM ||
      biomeType === TerrainBiomeType.BADLANDS ||
      biomeType === TerrainBiomeType.DESERT ||
      biomeType === TerrainBiomeType.ICE_SPIKES
    ) {
      return;
    }

    const y = groundInfo.y;
    const lightLevel = LightingUtils.getAverageLightLevel(Math.floor(x), Math.floor(y), Math.floor(z), 2);
    if (lightLevel < 9) return;

    const herdSize = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < herdSize; i++) {
      const variantTable = BIOME_PASSIVE_VARIANTS[biomeType];
      const type = variantTable && variantTable.length > 0
        ? (() => {
            const total = variantTable.reduce((sum, entry) => sum + entry.spawnWeight, 0);
            let roll = Math.random() * total;
            for (const entry of variantTable) {
              roll -= entry.spawnWeight;
              if (roll <= 0) return entry.mob as MobSpawnType;
            }
            return variantTable[0].mob as MobSpawnType;
          })()
        : pickWeighted(PASSIVE_SPAWN_TABLE[biomeType] ?? DEFAULT_PASSIVE_WEIGHTS);
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetZ = (Math.random() - 0.5) * 3;
      this.spawnPassive(type, x + offsetX, y, z + offsetZ);
    }
  }

  private spawnHostileMob(playerX: number, playerZ: number, dayCount: number): void {
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = MOB_SPAWN_RADIUS + Math.random() * 16;
    const x = playerX + Math.cos(angle) * distance;
    const z = playerZ + Math.sin(angle) * distance;

    const groundInfo = this.findGroundPosition(x, z);
    if (!groundInfo) return;
    if (Math.hypot(x - playerX, z - playerZ) < MOB_SPAWN_RADIUS + 2) return;

    const y = groundInfo.y;
    const worldTime = useGameStore.getState().worldTime;
    const timeOfDay = getTimeOfDay(worldTime);
    const isNight = timeOfDay === 'night' || timeOfDay === 'sunset';
    const isRaining = false; // Simplified

    // Build spawn context
    const ctx: SpawnContext = {
      x,
      y,
      z,
      biome: groundInfo.biome,
      lightLevel: LightingUtils.getAverageLightLevel(Math.floor(x), Math.floor(y), Math.floor(z), 1),
      isNight,
      isRaining,
      dayCount,
      playerX,
      playerY: usePlayerStore.getState().position.y,
      playerZ,
    };

    // Get biome name from enum
    const getBiomeName = (bt: TerrainBiomeType): string => {
      switch(bt) {
        case TerrainBiomeType.PLAINS: return 'plains';
        case TerrainBiomeType.FOREST: return 'forest';
        case TerrainBiomeType.DARK_FOREST: return 'dark_forest';
        case TerrainBiomeType.JUNGLE: return 'jungle';
        case TerrainBiomeType.SAVANNA: return 'savanna';
        case TerrainBiomeType.TAIGA: return 'taiga';
        case TerrainBiomeType.SNOW: return 'snow';
        case TerrainBiomeType.MOUNTAINS: return 'mountains';
        case TerrainBiomeType.DESERT: return 'desert';
        case TerrainBiomeType.SWAMP: return 'swamp';
        case TerrainBiomeType.OCEAN: return 'ocean';
        default: return 'plains';
      }
    };

    // Check spawn conditions for each hostile type
    const spawnTable = HOSTILE_SPAWN_TABLE[groundInfo.biome] ?? DEFAULT_HOSTILE_TYPES;
    const validMobTypes = spawnTable.filter(type => canSpawnAt(type, ctx));
    
    if (validMobTypes.length === 0) return;
    
    const type = validMobTypes[Math.floor(Math.random() * validMobTypes.length)];
    this.spawnHostile(type, x, y, z, dayCount);
    
    // Group spawning
    const config = MOB_CONFIGS[type];
    if (config && config.spawn.spawnsInGroups) {
      const groupSize = config.spawn.minGroupSize + Math.floor(Math.random() * (config.spawn.maxGroupSize - config.spawn.minGroupSize));
      for (let i = 1; i < groupSize; i++) {
        const offsetX = (Math.random() - 0.5) * 4;
        const offsetZ = (Math.random() - 0.5) * 4;
        this.spawnHostile(type, x + offsetX, y, z + offsetZ, dayCount);
      }
    }
  }

  private spawnPassive(type: MobSpawnType, x: number, y: number, z: number): void {
    if (this.isChunkAtMobCap(x, z)) return;

    const entity = createPassiveMob(type, x, y, z);
    if (!entity) return;

    this.addEntity(entity);
  }

  private spawnHostile(type: MobSpawnType, x: number, y: number, z: number, dayCount: number): void {
    if (this.isChunkAtMobCap(x, z)) return;

    const entity = createEnhancedHostileMob(type, x, y, z, dayCount);
    if (!entity) return;

    this.addEntity(entity);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Entity Management
  // ─────────────────────────────────────────────────────────────────────────────

  private addEntity(entity: EntityType): void {
    this.entities.set(entity.id, entity);
    this.updateSpatialGrid(entity.id, entity);
    
    if (entity.type === 'zombie' || entity.type === 'skeleton' || 
        entity.type === 'creeper' || entity.type === 'spider') {
      this.hostileMobs.add(entity.id);
    } else {
      this.passiveMobs.add(entity.id);
    }
  }

  remove(id: string): boolean {
    const entity = this.entities.get(id);
    if (entity) {
      this.removeFromSpatialGrid(id, entity);
      this.hostileMobs.delete(id);
      this.passiveMobs.delete(id);
    }
    return this.entities.delete(id);
  }

  spawn(type: MobSpawnType, x: number, y: number, z: number): EntityType | null {
    if (this.isChunkAtMobCap(x, z)) return null;

    let entity: EntityType | null;
    
    // Check if hostile or passive
    const hostileTypes = ['zombie', 'skeleton', 'creeper', 'spider'];
    if (hostileTypes.includes(type)) {
      entity = createEnhancedHostileMob(type, x, y, z);
    } else {
      entity = createPassiveMob(type, x, y, z);
    }

    if (entity) {
      this.addEntity(entity);
    }
    return entity;
  }

  getEntity(id: string): EntityType | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): EntityType[] {
    return Array.from(this.entities.values());
  }

  getEntitiesInRange(x: number, y: number, z: number, range: number): EntityType[] {
    const rangeSq = range * range;
    const result: EntityType[] = [];
    
    for (const entity of this.entities.values()) {
      const distSq = this.getDistanceSquared(entity, x, y, z);
      if (distSq <= rangeSq) {
        result.push(entity);
      }
    }
    
    return result;
  }

  getHostileMobs(): EnhancedHostileMob[] {
    const result: EnhancedHostileMob[] = [];
    for (const id of this.hostileMobs) {
      const entity = this.entities.get(id);
      if (entity && !entity.isDead && entity instanceof EnhancedHostileMob) {
        result.push(entity);
      }
    }
    return result;
  }

  clear(): void {
    this.entities.clear();
    this.spatialGrid.clear();
    this.hostileMobs.clear();
    this.passiveMobs.clear();
    this.bootstrapDone = false;
  }

  getCount(): number {
    return this.entities.size;
  }

  getHostileCount(): number {
    return this.hostileMobs.size;
  }

  getPassiveCount(): number {
    return this.passiveMobs.size;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Spatial Grid Operations
  // ─────────────────────────────────────────────────────────────────────────────

  private getSpatialGridKey(pos: { x: number; y: number; z: number }): string {
    const gx = Math.floor(pos.x / this.gridCellSize);
    const gy = Math.floor(pos.y / this.gridCellSize);
    const gz = Math.floor(pos.z / this.gridCellSize);
    return `${gx}_${gy}_${gz}`;
  }

  private updateSpatialGrid(id: string, entity: EntityType): void {
    const oldKey = this.getSpatialGridKey({ 
      x: entity.position.x, 
      y: entity.position.y, 
      z: entity.position.z 
    });
    
    // Remove from old cell
    const oldCell = this.spatialGrid.get(oldKey);
    if (oldCell) {
      oldCell.delete(id);
      if (oldCell.size === 0) {
        this.spatialGrid.delete(oldKey);
      }
    }
    
    // Add to new cell
    const newKey = this.getSpatialGridKey(entity.position);
    if (!this.spatialGrid.has(newKey)) {
      this.spatialGrid.set(newKey, new Set());
    }
    this.spatialGrid.get(newKey)!.add(id);
  }

  private removeFromSpatialGrid(id: string, entity: EntityType): void {
    const key = this.getSpatialGridKey(entity.position);
    const cell = this.spatialGrid.get(key);
    if (cell) {
      cell.delete(id);
      if (cell.size === 0) {
        this.spatialGrid.delete(key);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // World Operations
  // ─────────────────────────────────────────────────────────────────────────────

  private findGroundPosition(worldX: number, worldZ: number): { y: number; biome: TerrainBiomeType } | null {
    const worldStore = useWorldStore.getState();
    const fx = Math.floor(worldX);
    const fz = Math.floor(worldZ);
    const chunkCoord = worldToChunk(fx, fz);
    const chunk = worldStore.getChunk(chunkCoord.x, chunkCoord.z);

    if (!chunk || !chunk.isGenerated) return null;

    const local = worldToLocal(fx, 0, fz);
    const columnIndex = local.z * CHUNK_SIZE + local.x;
    let surfaceY = chunk.heightMap[columnIndex];

    if (surfaceY <= 0 || surfaceY >= CHUNK_HEIGHT) {
      return null;
    }

    // Walk down if height map points into non-solid material
    for (let y = Math.min(surfaceY, CHUNK_HEIGHT - 2); y >= 0; y--) {
      const block = worldStore.getBlock(fx, y, fz);
      if (block !== BlockType.AIR && isSolid(block)) {
        if (block === BlockType.WATER || block === BlockType.LAVA) {
          return null;
        }
        surfaceY = y + 1;
        break;
      }
    }

    const biomeIndex = chunk.biomes[columnIndex];
    const biomeType = decodeTerrainBiome(biomeIndex);

    return { y: surfaceY, biome: biomeType };
  }

  private getPassiveMobCount(): number {
    return this.passiveMobs.size;
  }

  private isChunkAtMobCap(worldX: number, worldZ: number): boolean {
    const targetChunk = worldToChunk(worldX, worldZ);
    const targetKey = chunkKey(targetChunk.x, targetChunk.z);

    let countInChunk = 0;
    for (const [id] of this.entities) {
      const entity = this.entities.get(id);
      if (!entity) continue;
      const entityChunk = worldToChunk(entity.position.x, entity.position.z);
      if (chunkKey(entityChunk.x, entityChunk.z) === targetKey) {
        countInChunk++;
        if (countInChunk >= MAX_MOBS_PER_CHUNK) {
          return true;
        }
      }
    }

    return false;
  }

  populateAroundPlayer(playerX: number, playerZ: number, desiredCount: number = 12): void {
    let passiveCount = this.getPassiveMobCount();
    if (passiveCount >= desiredCount) return;

    let attempts = 0;
    const maxAttempts = 120;
    while (passiveCount < desiredCount && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const distance = MOB_SPAWN_RADIUS + Math.random() * 28;
      const x = playerX + Math.cos(angle) * distance;
      const z = playerZ + Math.sin(angle) * distance;
      const info = this.findGroundPosition(x, z);
      if (!info) continue;
      if (
        info.biome === TerrainBiomeType.OCEAN ||
        info.biome === TerrainBiomeType.DEEP_OCEAN ||
        info.biome === TerrainBiomeType.VOLCANIC
      ) continue;

      const variantTable = BIOME_PASSIVE_VARIANTS[info.biome];
      const type = variantTable && variantTable.length > 0
        ? (() => {
            const total = variantTable.reduce((sum, entry) => sum + entry.spawnWeight, 0);
            let roll = Math.random() * total;
            for (const entry of variantTable) {
              roll -= entry.spawnWeight;
              if (roll <= 0) return entry.mob as MobSpawnType;
            }
            return variantTable[0].mob as MobSpawnType;
          })()
        : (['pig', 'cow', 'sheep', 'chicken'] as MobSpawnType[])[Math.floor(Math.random() * 4)];
      const spawned = this.spawn(type, x, info.y, z);
      if (spawned) passiveCount++;
    }
  }

  private tryBreedPassiveMobs(): void {
    if (this.entities.size >= 70) return;

    const passive = Array.from(this.passiveMobs).map(id => this.entities.get(id)).filter(
      (e): e is Mob =>
        e instanceof Mob &&
        (e.type === 'pig' || e.type === 'cow' || e.type === 'sheep' || e.type === 'chicken') &&
        'canBreed' in e &&
        (e as any).canBreed()
    );

    if (passive.length < 2) return;

    for (let i = 0; i < passive.length; i++) {
      const a = passive[i];
      for (let j = i + 1; j < passive.length; j++) {
        const b = passive[j];
        if (a.type !== b.type) continue;
        if (a.distanceTo(b.position.x, b.position.y, b.position.z) > 6) continue;
        if (Math.random() > 0.2) continue;

        const spawnX = (a.position.x + b.position.x) * 0.5 + (Math.random() - 0.5);
        const spawnZ = (a.position.z + b.position.z) * 0.5 + (Math.random() - 0.5);
        const ground = this.findGroundPosition(spawnX, spawnZ);
        if (!ground) continue;

        const baby = this.spawn(a.type as MobSpawnType, spawnX, ground.y, spawnZ);
        if (!baby) continue;

        if ('onBred' in a) {
          (a as any).onBred();
        }
        if ('onBred' in b) {
          (b as any).onBred();
        }
        return;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Save/Load
  // ─────────────────────────────────────────────────────────────────────────────

  serialize(): string {
    const data = Array.from(this.entities.values()).map(entity => {
      if ('serialize' in entity) {
        return entity.serialize();
      }
      return null;
    }).filter(Boolean);
    
    return JSON.stringify(data);
  }

  load(data: string): void {
    try {
      const entities = JSON.parse(data) as EntityData[];
      this.clear();
      
      for (const ed of entities) {
        const hostileTypes = ['zombie', 'skeleton', 'creeper', 'spider'];
        
        if (hostileTypes.includes(ed.type)) {
          const config = MOB_CONFIGS[ed.type];
          if (!config) continue;
          
          const mob = new EnhancedHostileMob(ed.type, ed.position.x, ed.position.y, ed.position.z, config);
          mob.health = ed.health;
          mob.maxHealth = ed.maxHealth;
          mob.rotation = ed.rotation;
          mob.velocity = ed.velocity;
          mob.isDead = ed.isDead;
          mob.age = ed.age;
          
          // Restore AI state if available
          if ('aiState' in ed) {
            mob.enhancedAiState = (ed as any).aiState;
          }
          
          this.addEntity(mob);
        } else {
          // Recreate passive mob
          const entity = createPassiveMob(ed.type, ed.position.x, ed.position.y, ed.position.z);
          if (entity) {
            entity.health = ed.health;
            entity.maxHealth = ed.maxHealth;
            entity.rotation = ed.rotation;
            entity.velocity = ed.velocity;
            entity.isDead = ed.isDead;
            entity.age = ed.age;
            this.addEntity(entity);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load entities:', e);
    }
  }
}

// Singleton instance
export const unifiedEntityManager = new UnifiedEntityManager();

// Re-export for backward compatibility
export const entityManager = unifiedEntityManager;
