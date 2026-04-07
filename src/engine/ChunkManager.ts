import { useWorldStore, ChunkData } from '@/stores/worldStore';
import { TerrainGenerator } from './TerrainGenerator';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '@/utils/constants';
import { chunkKey, worldToChunk, getChunksInRadius } from '@/utils/coordinates';
import { useGameStore, WorldGenerationMode } from '@/stores/gameStore';
import { BlockType } from '@/data/blocks';
import { encodeTerrainBiome } from '@/utils/biomeEncoding';
import { StructureGenerator } from '@/structures/StructureGenerator';
import { getNewGenerationTerrainGenerator } from './NewGenerationTerrainGenerator';
import { textureManager } from '@/data/textureManager';
import { clearMaterialCache as clearChunkMaterialCache } from '@/components/Chunk';
import { clearMaterialCache as clearOptimizedChunkMaterialCache } from '@/components/OptimizedChunk';
import MemoryManager from '@/utils/MemoryManager';

export class ChunkManager {
  private static readonly MIN_SAFE_RENDER_DISTANCE = 6;
  private terrainGenerator: TerrainGenerator;
  private newGenerationTerrainGenerator: ReturnType<typeof getNewGenerationTerrainGenerator>;
  private generationQueue: Set<string> = new Set();
  private isGenerating: boolean = false;
  private lastPlayerChunkX: number | null = null;
  private lastPlayerChunkZ: number | null = null;
  private lastRenderDistance: number | null = null;
  private generationMode: WorldGenerationMode;
  private seed: number; // Store seed
  
  // Look-based chunk loading
  private lastLookDirection: { yaw: number; pitch: number } | null = null;
  private lookDirectionChanged: boolean = false;
  private readonly LOOK_DIRECTION_THRESHOLD = 0.1; // Radians change threshold
  private readonly LOOK_PRIORITY_BOOST = 0.4; // 40% priority reduction for in-view chunks
  private readonly LOOK_ANGLE_THRESHOLD = Math.PI / 4; // 45 degrees

  constructor(seed: number, generationMode: WorldGenerationMode = 'classic') {
    this.seed = seed; // Store seed
    this.generationMode = generationMode;
    this.terrainGenerator = new TerrainGenerator(seed);
    this.newGenerationTerrainGenerator = getNewGenerationTerrainGenerator(seed);
  }

  // Update look direction for chunk prioritization
  updateLookDirection(yaw: number, pitch: number): void {
    if (!this.lastLookDirection) {
      this.lastLookDirection = { yaw, pitch };
      return;
    }
    
    const yawDiff = Math.abs(yaw - this.lastLookDirection.yaw);
    const pitchDiff = Math.abs(pitch - this.lastLookDirection.pitch);
    
    // Normalize yaw difference to [0, PI]
    const normalizedYawDiff = Math.min(yawDiff, Math.PI * 2 - yawDiff);
    
    if (normalizedYawDiff > this.LOOK_DIRECTION_THRESHOLD || 
        pitchDiff > this.LOOK_DIRECTION_THRESHOLD) {
      this.lastLookDirection = { yaw, pitch };
      this.lookDirectionChanged = true;
    }
  }

  // Check if a chunk position is in the player's viewing direction
  private isChunkInViewDirection(chunkX: number, chunkZ: number, playerChunkX: number, playerChunkZ: number): boolean {
    if (!this.lastLookDirection) return false;
    
    // Calculate angle to chunk from player
    const dx = chunkX - playerChunkX;
    const dz = chunkZ - playerChunkZ;
    
    if (dx === 0 && dz === 0) return true; // Same chunk
    
    const angleToChunk = Math.atan2(dz, dx);
    const viewAngle = this.lastLookDirection.yaw;
    
    // Calculate angular difference
    let angleDiff = Math.abs(angleToChunk - viewAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
    
    return angleDiff <= this.LOOK_ANGLE_THRESHOLD;
  }

  // Calculate priority with look direction bonus
  private calculateChunkPriority(dx: number, dz: number, inViewDirection: boolean): number {
    const distance = Math.sqrt(dx * dx + dz * dz);
    let priority = distance * 10;
    
    // Apply look direction boost (lower priority = higher priority)
    if (inViewDirection) {
      priority *= (1 - this.LOOK_PRIORITY_BOOST);
    }
    
    return Math.floor(priority);
  }

  // Update chunks based on player position (optimized)
  update(playerX: number, playerZ: number, renderDistance: number = RENDER_DISTANCE): void {
    const worldStore = useWorldStore.getState();
    const playerChunk = worldToChunk(playerX, playerZ);
    const safeRenderDistance = Math.max(ChunkManager.MIN_SAFE_RENDER_DISTANCE, renderDistance);
    
    // Process generation queue every frame to keep chunks loading
    if (this.generationQueue.size > 0) {
      this.processGenerationQueue();
    }
    
    const chunkChanged =
      this.lastPlayerChunkX !== playerChunk.x ||
      this.lastPlayerChunkZ !== playerChunk.z ||
      this.lastRenderDistance !== safeRenderDistance;

    // Always process queue even if player hasn't moved much
    if (!chunkChanged) {
      this.processGenerationQueue();
      return;
    }

    this.lastPlayerChunkX = playerChunk.x;
    this.lastPlayerChunkZ = playerChunk.z;
    this.lastRenderDistance = safeRenderDistance;

    // Get chunks that should be loaded - use a dynamic buffer based on queue size
    const queueBacklog = this.generationQueue.size;
    const preGenBuffer = queueBacklog > 50 ? 1 : (queueBacklog > 20 ? 2 : 3);
    const chunksToLoad = getChunksInRadius(playerX, playerZ, safeRenderDistance + preGenBuffer);

    // Find chunks to unload (optimized with early exit) - increased margin
    const loadedChunks = Array.from(worldStore.loadedChunks);
    const unloadRadiusSq = (safeRenderDistance + 6) * (safeRenderDistance + 6); // Increased buffer
    for (const key of loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > unloadRadiusSq) {
        worldStore.removeChunk(cx, cz);
      }
    }

    // Queue chunks for generation - increased to load world faster
    let queuedCount = 0;
    let maxQueuedPerFrame: number;
    
    if (queueBacklog <= 5) {
      // Very low backlog - queue 8 chunks
      maxQueuedPerFrame = 8;
    } else if (queueBacklog <= 15) {
      // Low backlog - queue 6 chunks
      maxQueuedPerFrame = 6;
    } else if (queueBacklog <= 30) {
      // Medium backlog - queue 4 chunks
      maxQueuedPerFrame = 4;
    } else {
      // High backlog - still queue 2 chunks
      maxQueuedPerFrame = 2;
    }
    
    // Sort chunks by priority - distance AND look direction
    const sortedChunks = [...chunksToLoad].sort((a, b) => {
      const dxA = a.x - playerChunk.x;
      const dzA = a.z - playerChunk.z;
      const dxB = b.x - playerChunk.x;
      const dzB = b.z - playerChunk.z;
      
      // Check if in view direction
      const inViewA = this.isChunkInViewDirection(a.x, a.z, playerChunk.x, playerChunk.z);
      const inViewB = this.isChunkInViewDirection(b.x, b.z, playerChunk.x, playerChunk.z);
      
      // Chunks in view direction get priority boost
      if (inViewA !== inViewB) {
        return inViewB ? -1 : 1; // inViewB comes first
      }
      
      // Same view direction - sort by distance
      const distA = dxA * dxA + dzA * dzA;
      const distB = dxB * dxB + dzB * dzB;
      return distA - distB;
    });
    
    // Extended pre-generation buffer for look-ahead
    const extendedPreGenBuffer = this.lookDirectionChanged ? 4 : preGenBuffer;
    this.lookDirectionChanged = false;
    
    for (const { x, z } of sortedChunks) {
      if (queuedCount >= maxQueuedPerFrame) break;
      
      const key = chunkKey(x, z);
      if (!worldStore.isChunkLoaded(x, z) && !this.generationQueue.has(key)) {
        // Check if chunk is in view direction for priority logging
        const inView = this.isChunkInViewDirection(x, z, playerChunk.x, playerChunk.z);
        if (inView && Math.random() < 0.05) { // Log 5% of in-view loads
          console.log(`[ChunkManager] Prioritizing chunk in view: ${key}`);
        }
        this.generationQueue.add(key);
        queuedCount++;
      }
    }
    
    // Trigger queue processing if there's work to do - always process when needed
    if (this.generationQueue.size > 0) {
      this.processGenerationQueue();
    }
  }

  private processGenerationQueue(): void {
    if (this.isGenerating || this.generationQueue.size === 0) return;

    this.isGenerating = true;

    // Adaptive time slicing - much more aggressive to load world faster
    const currentRenderDistance = useGameStore.getState().renderDistance ?? RENDER_DISTANCE;
    const queued = this.generationQueue.size;
    
    // Calculate chunks per frame - more aggressive for faster world loading
    let chunksPerFrame: number;
    let timeBudgetMs: number;
    
    if (queued <= 20) {
      // Low backlog - process up to 8 chunks
      chunksPerFrame = 8;
      timeBudgetMs = 14; // 14ms budget
    } else if (queued <= 60) {
      // Medium backlog - process up to 6 chunks
      chunksPerFrame = 6;
      timeBudgetMs = 16; // 16ms
    } else {
      // Heavy backlog - max 4 chunks but use full frame budget
      chunksPerFrame = 4;
      timeBudgetMs = 20; // 20ms - still leave some time for other work
    }
    
    const start = performance.now();
    let processed = 0;
    const keysToProcess: string[] = [];
    
    // Collect keys to process first (allows better error handling)
    for (const key of this.generationQueue) {
      if (processed >= chunksPerFrame) break;
      if (performance.now() - start > timeBudgetMs) break;
      keysToProcess.push(key);
      processed++;
    }
    
    // Process collected chunks
    for (const key of keysToProcess) {
      if (performance.now() - start > timeBudgetMs) break;
      this.generationQueue.delete(key);
      const [x, z] = key.split(',').map(Number);
      this.generateChunk(x, z);
    }

    this.isGenerating = false;
  }

  private generateChunk(x: number, z: number): void {
    const worldStore = useWorldStore.getState();

    const generatedChunk = this.createGeneratedChunk(x, z);

    // 3. Convert to ChunkData and Calculate Heightmaps
    const chunkData: ChunkData = {
      x: generatedChunk.cx,
      z: generatedChunk.cz,
      blocks: generatedChunk.blocks,
      blockStates: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
      biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
      lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15),
      isDirty: true,
      isGenerated: true,
    };

    // Calculate height map (must happen AFTER structures are placed)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const columnIndex = lz * CHUNK_SIZE + lx;
        let highestBlock = 0;
        // Iterate from top down to find highest solid block
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          // Note: We check the MODIFIED chunk data
          if (generatedChunk.getBlock(lx, y, lz) !== BlockType.AIR) {
            highestBlock = y;
            break;
          }
        }
        chunkData.heightMap[columnIndex] = highestBlock;
        // ... biome encoding ...
        const worldX = x * CHUNK_SIZE + lx;
        const worldZ = z * CHUNK_SIZE + lz;
        const biome = this.terrainGenerator.getBiome(worldX, worldZ);
        chunkData.biomes[columnIndex] = encodeTerrainBiome(biome);
      }
    }

    worldStore.setChunk(x, z, chunkData);
  }

  // Force generate a specific chunk (for initial load)
  forceGenerateChunk(x: number, z: number): ChunkData {
    const worldStore = useWorldStore.getState();

    // Check if already loaded
    let chunk = worldStore.getChunk(x, z);
    if (chunk && chunk.isGenerated) {
      return chunk;
    }

    const generatedChunk = this.createGeneratedChunk(x, z);
    const chunkData = this.convertGeneratedChunk(generatedChunk, x, z);

    worldStore.setChunk(x, z, chunkData);

    return chunkData;
  }

  private createGeneratedChunk(x: number, z: number) {
    const generatedChunk = this.generationMode === 'new_generation'
      ? this.newGenerationTerrainGenerator.generateChunk(x, z)
      : this.terrainGenerator.generateChunk(x, z);
    StructureGenerator.populateChunk(generatedChunk, this.seed);

    return generatedChunk;
  }

  private convertGeneratedChunk(generatedChunk: any, x: number, z: number): ChunkData {
    const chunkData: ChunkData = {
      x: generatedChunk.cx,
      z: generatedChunk.cz,
      blocks: generatedChunk.blocks,
      blockStates: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
      biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
      lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15),
      isDirty: true,
      isGenerated: true,
    };

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const columnIndex = lz * CHUNK_SIZE + lx;
        let highestBlock = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (generatedChunk.getBlock(lx, y, lz) !== BlockType.AIR) {
            highestBlock = y;
            break;
          }
        }
        chunkData.heightMap[columnIndex] = highestBlock;

        const worldX = x * CHUNK_SIZE + lx;
        const worldZ = z * CHUNK_SIZE + lz;
        const biome = this.generationMode === 'new_generation'
          ? this.newGenerationTerrainGenerator.getBiome(worldX, worldZ)
          : this.terrainGenerator.getBiome(worldX, worldZ);
        chunkData.biomes[columnIndex] = encodeTerrainBiome(biome);
      }
    }

    return chunkData;
  }

  // Generate initial chunks around spawn - ensure all are loaded before player spawns
  generateInitialChunks(spawnX: number, spawnZ: number, radius: number = 4): void {
    const chunks = getChunksInRadius(spawnX, spawnZ, radius);
    // Force synchronous generation for ALL initial chunks to avoid spawn issues
    for (const { x, z } of chunks) {
      this.forceGenerateChunk(x, z);
    }
  }

  // Get number of chunks waiting to be generated
  getQueueSize(): number {
    return this.generationQueue.size;
  }

  // Clear all chunks
  reset(clearWorldStore: boolean = true): void {
    this.generationQueue.clear();
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkZ = null;
    this.lastRenderDistance = null;
    StructureGenerator.reset();
    textureManager.clearCache();
    clearChunkMaterialCache();
    clearOptimizedChunkMaterialCache();
    MemoryManager.emergencyCleanup();
    if (clearWorldStore) {
      useWorldStore.getState().reset();
    }
  }
}

// Singleton instance
let chunkManager: ChunkManager | null = null;

export function getChunkManager(seed?: number, generationMode?: WorldGenerationMode): ChunkManager {
  if (!chunkManager || seed !== undefined || generationMode !== undefined) {
    chunkManager = new ChunkManager(seed ?? Date.now(), generationMode ?? useGameStore.getState().worldGenerationMode);
  }
  return chunkManager;
}

export function resetChunkManager(options: { clearWorldStore?: boolean } = {}): void {
  if (chunkManager) {
    chunkManager.reset(options.clearWorldStore ?? true);
  }
  chunkManager = null;
}
