import { Entity } from './Entity';
import { Pig } from './mobs/Pig';
import { Cow } from './mobs/Cow';
import { Sheep } from './mobs/Sheep';
import { Zombie } from './mobs/Zombie';
import { Skeleton } from './mobs/Skeleton';
import { Creeper } from './mobs/Creeper';
import { Vector3 } from '@/utils/coordinates';
import { useGameStore } from '@/stores/gameStore';
import { useWorldStore } from '@/stores/worldStore';

export interface EntityPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
}

export class OptimizedEntityManager {
  private entities: Map<string, Entity> = new Map();
  private activeEntities: Set<string> = new Set();
  private entityPool: Entity[] = [];
  private config: EntityPoolConfig;
  private performanceMonitor: any;

  // Spatial partitioning for better performance
  private spatialGrid: Map<string, Set<string>> = new Map();
  private gridSize: number = 32; // Grid cell size

  constructor(config: EntityPoolConfig, performanceMonitor?: any) {
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.initializePool();
  }

  private initializePool(): void {
    console.log(`Initializing entity pool with ${this.config.initialSize} entities`);
    
    for (let i = 0; i < this.config.initialSize; i++) {
      const entity = this.createEntityInstance('pig'); // Default to pig for pool
      this.entityPool.push(entity);
    }
  }

  private createEntityInstance(type: string = 'pig'): Entity {
    // Create a concrete entity based on type
    switch (type) {
      case 'pig':
        return new Pig(0, 0, 0);
      case 'cow':
        return new Cow(0, 0, 0);
      case 'sheep':
        return new Sheep(0, 0, 0);
      case 'zombie':
        return new Zombie(0, 0, 0);
      case 'skeleton':
        return new Skeleton(0, 0, 0);
      case 'creeper':
        return new Creeper(0, 0, 0);
      default:
        // Default to pig for unknown types
        return new Pig(0, 0, 0);
    }
  }

  spawnEntity(type: string, x: number, y: number, z: number): Entity | null {
    // Check if we should spawn based on performance settings
    if (this.shouldThrottleSpawning()) {
      return null;
    }

    let entity: Entity;

    // Try to get from pool
    if (this.entityPool.length > 0) {
      entity = this.entityPool.pop()!;
      console.log(`Reusing entity from pool for ${type}`);
    } else {
      // Pool is empty, create new entity or grow pool
      if (this.activeEntities.size < this.config.maxSize) {
        entity = this.createEntityInstance(type);
        console.log(`Created new entity for ${type}`);
      } else {
        // Force reuse of oldest entity
        entity = this.evictOldestEntity();
        console.log(`Evicted oldest entity for ${type}`);
      }
    }

    // Initialize entity with new data
    entity.type = type;
    entity.position = { x, y, z };
    entity.velocity = { x: 0, y: 0, z: 0 };
    entity.isDead = false;
    entity.age = 0;

    const key = this.getEntityKey(entity);
    this.entities.set(key, entity);
    this.activeEntities.add(key);
    
    // Add to spatial grid
    this.addToSpatialGrid(entity);

    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordEntitySpawn(type, key);
    }

    return entity;
  }

  despawnEntity(entity: Entity): void {
    if (!entity) return;

    const key = this.getEntityKey(entity);
    
    // Remove from active entities
    this.activeEntities.delete(key);
    this.entities.delete(key);

    // Remove from spatial grid
    this.removeFromSpatialGrid(entity);

    // Reset entity state for reuse
    entity.position = { x: 0, y: 0, z: 0 };
    entity.velocity = { x: 0, y: 0, z: 0 };
    entity.isDead = false;
    entity.age = 0;

    // Return to pool if not at max size
    if (this.entityPool.length < this.config.maxSize) {
      this.entityPool.push(entity);
    } else {
      // Pool is full, destroy entity
      this.destroyEntity(entity);
    }

    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordEntityDespawn(key);
    }
  }

  updateAll(deltaTime: number): void {
    // Update all active entities
    for (const key of this.activeEntities) {
      const entity = this.entities.get(key);
      if (!entity || entity.isDead) continue;

      // Update entity
      this.updateEntity(entity, deltaTime);
    }

    // Clean up dead entities
    this.cleanupDeadEntities();
  }

  private updateEntity(entity: Entity, deltaTime: number): void {
    // Only update if entity is not dead
    if (entity.isDead) return;

    // Apply physics
    entity.velocity.y -= 9.8 * deltaTime; // Gravity
    entity.position.y += entity.velocity.y * deltaTime;
    entity.position.x += entity.velocity.x * deltaTime;
    entity.position.z += entity.velocity.z * deltaTime;

    // Simple collision with ground
    if (entity.position.y < 0) {
      entity.position.y = 0;
      entity.velocity.y = 0;
    }

    entity.age++;
  }

  private cleanupDeadEntities(): void {
    for (const key of this.activeEntities) {
      const entity = this.entities.get(key);
      if (entity && entity.isDead) {
        this.despawnEntity(entity);
      }
    }
  }

  private shouldThrottleSpawning(): boolean {
    const activeCount = this.activeEntities.size;
    const maxEntities = this.config.maxSize;
    
    // Throttle spawning when we're at 80% capacity
    return activeCount > maxEntities * 0.8;
  }

  private evictOldestEntity(): Entity {
    // For now, just create a new entity since we don't have access time tracking
    // In a real implementation, we'd track last access time
    return this.createEntityInstance('pig');
  }

  private destroyEntity(entity: Entity): void {
    // Clean up any remaining resources
    entity.position = { x: 0, y: 0, z: 0 };
    entity.velocity = { x: 0, y: 0, z: 0 };
  }

  private getEntityKey(entity: Entity): string {
    return `${entity.type}_${entity.position.x}_${entity.position.y}_${entity.position.z}`;
  }

  private getPlayerPosition(): Vector3 | null {
    // This would need to be implemented based on your player system
    // For now, return null to disable distance-based culling
    return null;
  }

  private addToSpatialGrid(entity: Entity): void {
    const gridKey = this.getSpatialGridKey(entity.position);
    
    if (!this.spatialGrid.has(gridKey)) {
      this.spatialGrid.set(gridKey, new Set());
    }
    
    this.spatialGrid.get(gridKey)!.add(this.getEntityKey(entity));
  }

  private removeFromSpatialGrid(entity: Entity): void {
    const gridKey = this.getSpatialGridKey(entity.position);
    const entitiesInCell = this.spatialGrid.get(gridKey);
    
    if (entitiesInCell) {
      entitiesInCell.delete(this.getEntityKey(entity));
      if (entitiesInCell.size === 0) {
        this.spatialGrid.delete(gridKey);
      }
    }
  }

  private getSpatialGridKey(position: Vector3): string {
    const gridX = Math.floor(position.x / this.gridSize);
    const gridY = Math.floor(position.y / this.gridSize);
    const gridZ = Math.floor(position.z / this.gridSize);
    return `${gridX}_${gridY}_${gridZ}`;
  }

  getActiveEntityCount(): number {
    return this.activeEntities.size;
  }

  getPoolSize(): number {
    return this.entityPool.length;
  }

  getMemoryUsage(): { active: number; pooled: number; total: number } {
    const activeMemory = this.activeEntities.size * this.estimateEntityMemory();
    const pooledMemory = this.entityPool.length * this.estimateEntityMemory();
    
    return {
      active: activeMemory,
      pooled: pooledMemory,
      total: activeMemory + pooledMemory
    };
  }

  private estimateEntityMemory(): number {
    // Rough estimate of memory usage per entity
    return 1024; // ~1KB per entity estimate
  }

  clear(): void {
    // Despawn all active entities
    for (const entity of this.entities.values()) {
      this.despawnEntity(entity);
    }
    
    // Destroy all pooled entities
    this.entityPool.forEach(entity => this.destroyEntity(entity));
    this.entityPool = [];
    
    // Clear spatial grid
    this.spatialGrid.clear();
    
    console.log('Entity pool cleared');
  }

  resize(newSize: number): void {
    this.config.maxSize = newSize;
    
    // If shrinking, evict excess entities
    while (this.entityPool.length > newSize) {
      const entity = this.entityPool.pop();
      if (entity) {
        this.destroyEntity(entity);
      }
    }
    
    // If growing, add more entities to pool
    while (this.entityPool.length < this.config.initialSize && this.entityPool.length < newSize) {
      this.entityPool.push(this.createEntityInstance('pig'));
    }
  }

  getCount(): number {
    return this.activeEntities.size;
  }

  // Performance monitoring integration
  getStats(): {
    activeEntities: number;
    pooledEntities: number;
    totalEntities: number;
    memoryUsage: { active: number; pooled: number; total: number };
    spatialGridCells: number;
  } {
    return {
      activeEntities: this.getActiveEntityCount(),
      pooledEntities: this.getPoolSize(),
      totalEntities: this.getActiveEntityCount() + this.getPoolSize(),
      memoryUsage: this.getMemoryUsage(),
      spatialGridCells: this.spatialGrid.size
    };
  }

  // Get entities in a specific area (for spatial queries)
  getEntitiesInArea(position: Vector3, radius: number): Entity[] {
    const result: Entity[] = [];
    const centerGridKey = this.getSpatialGridKey(position);
    
    // Check nearby grid cells
    const radiusInGrids = Math.ceil(radius / this.gridSize);
    const [centerX, centerY, centerZ] = centerGridKey.split('_').map(Number);

    for (let x = -radiusInGrids; x <= radiusInGrids; x++) {
      for (let y = -radiusInGrids; y <= radiusInGrids; y++) {
        for (let z = -radiusInGrids; z <= radiusInGrids; z++) {
          const gridKey = `${centerX + x}_${centerY + y}_${centerZ + z}`;
          const entitiesInCell = this.spatialGrid.get(gridKey);
          
          if (entitiesInCell) {
            for (const entityKey of entitiesInCell) {
              const entity = this.entities.get(entityKey);
              if (entity) {
                // Calculate distance manually since Vector3 doesn't have distanceTo
                const dx = entity.position.x - position.x;
                const dy = entity.position.y - position.y;
                const dz = entity.position.z - position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance <= radius) {
                  result.push(entity);
                }
              }
            }
          }
        }
      }
    }

    return result;
  }

  // Pre-warm the pool with a specific number of entities
  preWarm(count: number): void {
    while (this.entityPool.length < count && this.entityPool.length < this.config.maxSize) {
      this.entityPool.push(this.createEntityInstance('pig'));
    }
  }
}

// Default configuration
export const DEFAULT_ENTITY_POOL_CONFIG: EntityPoolConfig = {
  initialSize: 10,
  maxSize: 50,
  growthFactor: 1.5
};

// Singleton instance for global access
export const optimizedEntityManager = new OptimizedEntityManager(DEFAULT_ENTITY_POOL_CONFIG);