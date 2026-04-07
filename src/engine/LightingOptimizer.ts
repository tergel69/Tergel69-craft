import { useWorldStore } from '@/stores/worldStore';
import { BlockType, BLOCKS } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { worldToChunk, worldToLocal, chunkKey } from '@/utils/coordinates';

// Light propagation constants
const MAX_LIGHT_LEVEL = 15;
const LIGHT_ATTENUATION = 1;
const SKY_LIGHT_SOURCE = 15;

interface LightData {
  sky: number;
  block: number;
}

interface LightUpdate {
  x: number;
  y: number;
  z: number;
  newSkyLight: number;
  newBlockLight: number;
}

export class LightingOptimizer {
  private worldStore = useWorldStore.getState();
  private lightQueue: LightUpdate[] = [];
  private processedPositions = new Set<string>();
  private isProcessing = false;

  // Initialize lighting for a newly generated chunk
  initializeChunkLighting(chunkX: number, chunkZ: number): void {
    const chunk = this.worldStore.getChunk(chunkX, chunkZ);
    if (!chunk || !chunk.isGenerated) return;

    // Initialize light arrays with a bright default so touched chunks never
    // briefly collapse to black while lighting propagates.
    chunk.lightMap = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(SKY_LIGHT_SOURCE);

    // Set sky light for surface blocks
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const columnIndex = z * CHUNK_SIZE + x;
        const surfaceY = chunk.heightMap[columnIndex];
        
        // Light from sky
        for (let y = surfaceY; y < CHUNK_HEIGHT; y++) {
          const index = this.getLightIndex(x, y, z);
          chunk.lightMap[index] = SKY_LIGHT_SOURCE;
        }
      }
    }

    // Propagate light from light-emitting blocks
    this.propagateBlockLightingForChunk(chunkX, chunkZ, chunk);
  }

  private propagateBlockLightingForChunk(chunkX: number, chunkZ: number, chunk: any): void {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldZ = chunkZ * CHUNK_SIZE + z;
          const lightLevel = this.getBlockLightLevel(worldX, y, worldZ);
          if (lightLevel > 0) {
            this.propagateLight(worldX, y, worldZ, lightLevel);
          }
        }
      }
    }
  }

  // Update lighting when a block is placed or removed
  updateLighting(x: number, y: number, z: number, oldBlock: BlockType, newBlock: BlockType): void {
    const chunkCoord = worldToChunk(x, z);
    const chunk = this.worldStore.getChunk(chunkCoord.x, chunkCoord.z);
    if (!chunk) return;

    // Add to processing queue
    this.addToQueue(x, y, z, 0, 0);

    // Process lighting updates
    this.processLightUpdates();
  }

  private addToQueue(x: number, y: number, z: number, newSkyLight: number, newBlockLight: number): void {
    const key = `${x},${y},${z}`;
    if (this.processedPositions.has(key)) return;

    this.lightQueue.push({
      x, y, z,
      newSkyLight,
      newBlockLight
    });
    this.processedPositions.add(key);
  }

  private processLightUpdates(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;

    while (this.lightQueue.length > 0 && iterations < maxIterations) {
      const update = this.lightQueue.shift()!;
      this.processLightUpdate(update);
      iterations++;
    }

    this.isProcessing = false;
    this.processedPositions.clear();
  }

  private processLightUpdate(update: LightUpdate): void {
    const { x, y, z, newSkyLight, newBlockLight } = update;
    
    // Update the block's light level
    const chunkCoord = worldToChunk(x, z);
    const chunk = this.worldStore.getChunk(chunkCoord.x, chunkCoord.z);
    if (!chunk) return;

    const local = worldToLocal(x, y, z);
    const index = this.getLightIndex(local.x, local.y, local.z);
    
    // Calculate new light level
    const blockLight = this.getBlockLightLevel(x, y, z);
    const skyLight = this.getSkyLightLevel(x, y, z);
    const newLight = Math.max(blockLight, skyLight);

    chunk.lightMap[index] = newLight;

    // Propagate light to neighbors if the light level increased
    if (newLight > 0) {
      this.propagateLight(x, y, z, newLight);
    }
  }

  private propagateLight(x: number, y: number, z: number, lightLevel: number): void {
    const newLevel = Math.max(0, lightLevel - LIGHT_ATTENUATION);

    if (newLevel <= 0) return;

    // Check all 6 neighbors
    const neighbors = [
      { x: x + 1, y, z },
      { x: x - 1, y, z },
      { x, y: y + 1, z },
      { x, y: y - 1, z },
      { x, y, z: z + 1 },
      { x, y, z: z - 1 }
    ];

    for (const neighbor of neighbors) {
      if (this.isValidPosition(neighbor.x, neighbor.y, neighbor.z)) {
        const neighborLight = this.getLightLevel(neighbor.x, neighbor.y, neighbor.z);
        
        // Only update if the new light level is higher
        if (newLevel > neighborLight) {
          this.addToQueue(neighbor.x, neighbor.y, neighbor.z, 0, newLevel);
        }
      }
    }
  }

  private getBlockLightLevel(x: number, y: number, z: number): number {
    const block = this.worldStore.getBlock(x, y, z);
    const blockData = BLOCKS[block];
    return blockData?.lightLevel ?? 0;
  }

  private getSkyLightLevel(x: number, y: number, z: number): number {
    // Check if there's a direct path to the sky
    const chunkCoord = worldToChunk(x, z);
    const chunk = this.worldStore.getChunk(chunkCoord.x, chunkCoord.z);
    
    if (!chunk) return 0;

    const local = worldToLocal(x, y, z);
    const columnIndex = local.z * CHUNK_SIZE + local.x;
    const surfaceY = chunk.heightMap[columnIndex];

    // If above surface, full sky light
    if (y >= surfaceY) {
      return SKY_LIGHT_SOURCE;
    }

    // Check if there's a clear path to the surface
    for (let checkY = y + 1; checkY <= surfaceY; checkY++) {
      const block = this.worldStore.getBlock(x, checkY, z);
      if (block !== BlockType.AIR && !BLOCKS[block]?.transparent) {
        return 0; // Blocked by solid block
      }
    }

    return SKY_LIGHT_SOURCE;
  }

  getLightLevel(x: number, y: number, z: number): number {
    if (!this.isValidPosition(x, y, z)) return 0;

    const chunkCoord = worldToChunk(x, z);
    const chunk = this.worldStore.getChunk(chunkCoord.x, chunkCoord.z);
    
    if (!chunk) return 0;

    const local = worldToLocal(x, y, z);
    const index = this.getLightIndex(local.x, local.y, local.z);
    
    return chunk.lightMap[index];
  }

  isValidPosition(x: number, y: number, z: number): boolean {
    return y >= 0 && y < CHUNK_HEIGHT;
  }

  private getLightIndex(x: number, y: number, z: number): number {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  // Batch lighting updates for performance
  batchLightUpdates(updates: Array<{ x: number; y: number; z: number; oldBlock: BlockType; newBlock: BlockType }>): void {
    // Sort updates by Y level (top to bottom) for optimal light propagation
    updates.sort((a, b) => b.y - a.y);

    for (const update of updates) {
      this.updateLighting(update.x, update.y, update.z, update.oldBlock, update.newBlock);
    }
  }

  // Clear lighting cache for a chunk
  clearChunkLighting(chunkX: number, chunkZ: number): void {
    const chunk = this.worldStore.getChunk(chunkX, chunkZ);
    if (chunk) {
      chunk.lightMap = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(SKY_LIGHT_SOURCE);
    }
  }

  // Get lighting statistics
  getLightingStats(): { queueSize: number; processedPositions: number } {
    return {
      queueSize: this.lightQueue.length,
      processedPositions: this.processedPositions.size
    };
  }

  // Optimize lighting for performance
  optimizeLighting(): void {
    // Clear processing state
    this.lightQueue = [];
    this.processedPositions.clear();
    this.isProcessing = false;
  }
}

// Singleton instance
export const lightingOptimizer = new LightingOptimizer();

// Lighting utilities
export class LightingUtils {
  // Calculate light color based on light level
  static getLightColor(lightLevel: number): number {
    const intensity = lightLevel / MAX_LIGHT_LEVEL;
    return Math.floor(0xffffff * intensity);
  }

  // Check if a position is dark enough for mob spawning
  static isDarkEnoughForSpawning(x: number, y: number, z: number): boolean {
    const lightLevel = lightingOptimizer.getLightLevel(x, y, z);
    return lightLevel <= 7;
  }

  // Get average light level in an area
  static getAverageLightLevel(x: number, y: number, z: number, radius: number = 5): number {
    let totalLight = 0;
    let count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          
          if (lightingOptimizer.isValidPosition(nx, ny, nz)) {
            totalLight += lightingOptimizer.getLightLevel(nx, ny, nz);
            count++;
          }
        }
      }
    }

    return count > 0 ? totalLight / count : 0;
  }

  // Optimize light updates by batching
  static batchLightUpdates(
    updates: Array<{ x: number; y: number; z: number; oldBlock: BlockType; newBlock: BlockType }>
  ): void {
    lightingOptimizer.batchLightUpdates(updates);
  }
}
