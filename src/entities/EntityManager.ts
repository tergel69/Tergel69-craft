import { Entity } from './Entity';
import { Mob } from './Mob';
import { Zombie } from './mobs/Zombie';
import { Skeleton } from './mobs/Skeleton';
import { Creeper } from './mobs/Creeper';
import { Pig } from './mobs/Pig';
import { Cow } from './mobs/Cow';
import { Sheep } from './mobs/Sheep';
import { Chicken } from './mobs/Chicken';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore, getTimeOfDay } from '@/stores/gameStore';
import { MOB_SPAWN_RADIUS, MOB_DESPAWN_RADIUS, MAX_MOBS_PER_CHUNK, CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { useWorldStore } from '@/stores/worldStore';
import { worldToChunk, worldToLocal, chunkKey } from '@/utils/coordinates';
import { BlockType, isSolid } from '@/data/blocks';
import { BiomeType as TerrainBiomeType } from '@/engine/TerrainGenerator';
import { decodeTerrainBiome } from '@/utils/biomeEncoding';

export type MobSpawnType = 'zombie' | 'skeleton' | 'creeper' | 'pig' | 'cow' | 'sheep' | 'chicken';

class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private spawnCooldown: number = 0;
  private breedingCooldown: number = 0;
  private bootstrapDone: boolean = false;

  update(delta: number): void {
    const player = usePlayerStore.getState();
    const gameState = useGameStore.getState().gameState;

    if (gameState !== 'playing') return;

    if (!this.bootstrapDone) {
      this.populateAroundPlayer(player.position.x, player.position.z, 14);
      this.bootstrapDone = true;
    }

    // Update all entities
    for (const [id, entity] of Array.from(this.entities)) {
      if (entity.isDead) {
        this.entities.delete(id);
        continue;
      }

      entity.update(delta);
      entity.tick();

      // Despawn if too far from player
      const distance = entity.distanceTo(player.position.x, player.position.y, player.position.z);
      if (distance > MOB_DESPAWN_RADIUS) {
        this.entities.delete(id);
      }
    }

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
  }

  private trySpawnMobs(): void {
    const worldTime = useGameStore.getState().worldTime;
    const dayCount = useGameStore.getState().dayCount;
    const timeOfDay = getTimeOfDay(worldTime);
    const player = usePlayerStore.getState();

    // Don't spawn too many mobs
    if (this.entities.size >= 50) return;

    // Keep a healthy passive baseline so the world feels alive.
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

    // Spawn hostile mobs at night
    if (dayCount >= 2 && (timeOfDay === 'night' || timeOfDay === 'sunset')) {
      if (Math.random() < 0.25) {
        this.spawnHostileMob(player.position.x, player.position.z);
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
      biomeType === TerrainBiomeType.VOLCANIC
    ) {
      return;
    }

    const y = groundInfo.y;
    const mobTypes: MobSpawnType[] = ['pig', 'cow', 'sheep', 'chicken'];
    const herdSize = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < herdSize; i++) {
      const type = mobTypes[Math.floor(Math.random() * mobTypes.length)];
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetZ = (Math.random() - 0.5) * 3;
      this.spawn(type, x + offsetX, y, z + offsetZ);
    }
  }

  private spawnHostileMob(playerX: number, playerZ: number): void {
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = MOB_SPAWN_RADIUS + Math.random() * 16;
    const x = playerX + Math.cos(angle) * distance;
    const z = playerZ + Math.sin(angle) * distance;

    const groundInfo = this.findGroundPosition(x, z);
    if (!groundInfo) return;
    if (Math.hypot(x - playerX, z - playerZ) < MOB_SPAWN_RADIUS + 2) return;

    const y = groundInfo.y;

    const mobTypes: MobSpawnType[] = ['zombie', 'skeleton', 'creeper'];
    const weights = [0.5, 0.3, 0.2]; // Zombies most common

    let roll = Math.random();
    let type: MobSpawnType = 'zombie';
    for (let i = 0; i < mobTypes.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        type = mobTypes[i];
        break;
      }
    }

    this.spawn(type, x, y, z);
  }

  spawn(type: MobSpawnType, x: number, y: number, z: number): Entity | null {
    // Enforce per-chunk mob limits
    if (this.isChunkAtMobCap(x, z)) {
      return null;
    }

    let entity: Entity;

    switch (type) {
      case 'zombie':
        entity = new Zombie(x, y, z);
        break;
      case 'skeleton':
        entity = new Skeleton(x, y, z);
        break;
      case 'creeper':
        entity = new Creeper(x, y, z);
        break;
      case 'pig':
        entity = new Pig(x, y, z);
        break;
      case 'cow':
        entity = new Cow(x, y, z);
        break;
      case 'sheep':
        entity = new Sheep(x, y, z);
        break;
      case 'chicken':
        entity = new Chicken(x, y, z);
        break;
      default:
        return null;
    }

    this.entities.set(entity.id, entity);
    return entity;
  }

  remove(id: string): boolean {
    return this.entities.delete(id);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getEntitiesInRange(x: number, y: number, z: number, range: number): Entity[] {
    return this.getAllEntities().filter((entity) => {
      return entity.distanceTo(x, y, z) <= range;
    });
  }

  getEntitiesByType(type: string): Entity[] {
    return this.getAllEntities().filter((entity) => entity.type === type);
  }

  clear(): void {
    this.entities.clear();
    this.bootstrapDone = false;
  }

  getCount(): number {
    return this.entities.size;
  }

  // Find the top solid surface at a given X/Z, returning a safe spawn Y and biome
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

    // Walk down a little if the height map points into non-solid material
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
    let count = 0;
    for (const entity of this.entities.values()) {
      if (entity.type === 'pig' || entity.type === 'cow' || entity.type === 'sheep' || entity.type === 'chicken') {
        count++;
      }
    }
    return count;
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

      const types: MobSpawnType[] = ['pig', 'cow', 'sheep', 'chicken'];
      const type = types[Math.floor(Math.random() * types.length)];
      const spawned = this.spawn(type, x, info.y, z);
      if (spawned) passiveCount++;
    }
  }

  private tryBreedPassiveMobs(): void {
    if (this.entities.size >= 70) return;

    const passive = Array.from(this.entities.values()).filter(
      (e): e is Mob =>
        e instanceof Mob &&
        (e.type === 'pig' || e.type === 'cow' || e.type === 'sheep' || e.type === 'chicken') &&
        e.canBreed()
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

        a.onBred();
        b.onBred();
        return;
      }
    }
  }

  // Check if the target chunk already has too many mobs
  private isChunkAtMobCap(worldX: number, worldZ: number): boolean {
    const targetChunk = worldToChunk(worldX, worldZ);
    const targetKey = chunkKey(targetChunk.x, targetChunk.z);

    let countInChunk = 0;
    for (const entity of this.entities.values()) {
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
}

// Singleton instance
export const entityManager = new EntityManager();
