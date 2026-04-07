import { ChunkData } from '@/stores/worldStore';
import { ChunkPool, DEFAULT_CHUNK_POOL_CONFIG } from './ChunkPool';
import { MeshPool, DEFAULT_MESH_POOL_CONFIG } from './MeshPool';
import { TerrainGenerator } from './TerrainGenerator';
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/utils/constants';
import { chunkKey, worldToChunk, getChunksInRadius } from '@/utils/coordinates';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore } from '@/stores/gameStore';

export interface ChunkLoadingConfig {
  batchSize: number;
  maxConcurrentLoads: number;
  usePooling: boolean;
  enableAsyncLoading: boolean;
  // New performance tuning options
  fastLoadEnabled: boolean;
  prioritizeNearbyChunks: boolean;
  pregenerationAhead: number;
}

export class ChunkLoadingSystem {
  private static readonly MIN_SAFE_RENDER_DISTANCE = 8;
  private chunkPool: ChunkPool;
  private meshPool: MeshPool;
  private terrainGenerator: TerrainGenerator;
  private config: ChunkLoadingConfig;
  private loadingQueue: Array<{ x: number; z: number; priority: number }> = [];
  private activeLoads: Set<string> = new Set();
  private isProcessing: boolean = false;
  private performanceMonitor: any;
  // Frame skip counter for load balancing
  private frameSkipCounter: number = 0;
  
  // Look-based chunk loading
  private lastLookDirection: { yaw: number; pitch: number } | null = null;
  private lookDirectionChanged: boolean = false;
  private readonly LOOK_DIRECTION_THRESHOLD = 0.1;
  private readonly LOOK_PRIORITY_BOOST = 0.4;
  private readonly LOOK_ANGLE_THRESHOLD = Math.PI / 4;

  constructor(
    seed: number,
    config: Partial<ChunkLoadingConfig> = {},
    performanceMonitor?: any
  ) {
    this.config = {
      batchSize: 8, // Increased from 4 for faster initial load
      maxConcurrentLoads: 4, // Increased from 2 for parallel processing
      usePooling: true,
      enableAsyncLoading: true,
      fastLoadEnabled: true,
      prioritizeNearbyChunks: true,
      pregenerationAhead: 2, // Load chunks slightly ahead of player movement
      ...config
    };

    this.chunkPool = new ChunkPool(
      DEFAULT_CHUNK_POOL_CONFIG,
      performanceMonitor
    );
    this.meshPool = new MeshPool(
      DEFAULT_MESH_POOL_CONFIG,
      performanceMonitor
    );
    this.terrainGenerator = new TerrainGenerator(seed);
    this.performanceMonitor = performanceMonitor;
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

  // Update chunks based on player position with optimized loading
  update(playerX: number, playerZ: number, renderDistance: number = RENDER_DISTANCE): void {
    const worldStore = useWorldStore.getState();
    const playerChunk = worldToChunk(playerX, playerZ);
    // Use actual render distance or default to 10, with minimum of 8
    const safeRenderDistance = Math.max(8, renderDistance || 10);
    
    const queueBacklog = this.loadingQueue.length;
    
    // Adaptive pre-generation buffer based on queue size
    const preGenBuffer = queueBacklog > 50 ? 1 : (queueBacklog > 20 ? 2 : 3);

    // Get chunks that should be loaded
    const chunksToLoad = getChunksInRadius(playerX, playerZ, safeRenderDistance + preGenBuffer);

    // Find chunks to unload (optimized with early exit)
    const loadedChunks = Array.from(worldStore.loadedChunks);
    const unloadRadius = safeRenderDistance + 4;
    
    for (const key of loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq > unloadRadius * unloadRadius) {
        this.unloadChunk(cx, cz);
      }
    }

    // Queue chunks for loading with priority - adaptive based on backlog
    let maxQueuedPerFrame: number;
    if (queueBacklog <= 15) {
      maxQueuedPerFrame = Math.min(10, safeRenderDistance);
    } else if (queueBacklog <= 40) {
      maxQueuedPerFrame = Math.min(6, Math.floor(safeRenderDistance * 0.7));
    } else {
      // High backlog - only queue critical nearby chunks
      maxQueuedPerFrame = Math.min(4, Math.floor(safeRenderDistance * 0.5));
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
    
    let queuedCount = 0;
    
    // Extended pre-generation buffer when looking in a direction
    const extendedPreGenBuffer = this.lookDirectionChanged ? 4 : preGenBuffer;
    this.lookDirectionChanged = false;
    
    for (const { x, z } of sortedChunks) {
      if (queuedCount >= maxQueuedPerFrame) break;
      
      const key = chunkKey(x, z);
      if (!worldStore.isChunkLoaded(x, z) && !this.activeLoads.has(key)) {
        // Calculate priority with look direction bonus
        const dx = x - playerChunk.x;
        const dz = z - playerChunk.z;
        const inView = this.isChunkInViewDirection(x, z, playerChunk.x, playerChunk.z);
        const distance = Math.sqrt(dx * dx + dz * dz);
        let priority = distance * 10;
        if (inView) {
          priority *= (1 - this.LOOK_PRIORITY_BOOST);
        }
        
        this.queueChunkForLoading(x, z, Math.floor(priority));
        queuedCount++;
      }
    }

    // Process loading queue based on backlog
    if (this.loadingQueue.length > 0) {
      this.processLoadingQueue();
    }
  }

  private queueChunkForLoading(x: number, z: number, priority: number): void {
    const key = chunkKey(x, z);
    
    // Check if already queued
    const existingIndex = this.loadingQueue.findIndex(item => item.x === x && item.z === z);
    if (existingIndex !== -1) {
      this.loadingQueue[existingIndex].priority = Math.min(this.loadingQueue[existingIndex].priority, priority);
      return;
    }

    // Add to queue
    this.loadingQueue.push({ x, z, priority });
    
    // Sort by priority (lower numbers = higher priority)
    this.loadingQueue.sort((a, b) => a.priority - b.priority);

    // Limit queue size
    if (this.loadingQueue.length > 100) {
      this.loadingQueue = this.loadingQueue.slice(0, 100);
    }
  }

  private async processLoadingQueue(): Promise<void> {
    if (this.isProcessing || this.loadingQueue.length === 0) return;

    this.isProcessing = true;

    // Process chunks in batches with time budget
    const batchSize = this.calculateBatchSize();
    const queueSize = this.loadingQueue.length;
    
    // Adaptive time budget based on backlog
    let timeBudgetMs: number;
    if (queueSize <= 15) {
      timeBudgetMs = 10; // 10ms when queue is small
    } else if (queueSize <= 40) {
      timeBudgetMs = 8; // 8ms when queue is medium
    } else {
      timeBudgetMs = 6; // 6ms when queue is large - prioritize frame smoothness
    }
    
    const start = performance.now();
    let processed = 0;

    while (processed < batchSize && this.loadingQueue.length > 0) {
      // Check time budget
      if (performance.now() - start > timeBudgetMs) break;
      
      const chunkData = this.loadingQueue.shift()!;
      const key = chunkKey(chunkData.x, chunkData.z);

      // Check if we can load this chunk
      if (this.activeLoads.size >= this.config.maxConcurrentLoads) {
        // Re-add to front of queue if we can't load it now
        this.loadingQueue.unshift(chunkData);
        break;
      }

      // Load chunk
      await this.loadChunk(chunkData.x, chunkData.z);
      processed++;
    }

    this.isProcessing = false;
  }

  private calculateBatchSize(): number {
    const currentRenderDistance = useGameStore.getState().renderDistance ?? RENDER_DISTANCE;
    const queueSize = this.loadingQueue.length;
    
    // Adaptive batch sizing based on queue backlog
    let baseBatchSize: number;
    if (queueSize <= 15) {
      // Low backlog - can process more
      baseBatchSize = Math.max(2, Math.min(6, Math.floor(currentRenderDistance / 3)));
    } else if (queueSize <= 40) {
      // Medium backlog - moderate processing
      baseBatchSize = Math.max(2, Math.min(4, Math.floor(currentRenderDistance / 4)));
    } else {
      // High backlog - be conservative to avoid frame drops
      baseBatchSize = Math.max(1, Math.min(3, Math.floor(currentRenderDistance / 6)));
    }
    
    // Adjust based on current load
    const loadFactor = 1 - (this.activeLoads.size / this.config.maxConcurrentLoads);
    return Math.max(1, Math.floor(baseBatchSize * loadFactor));
  }

  private async loadChunk(x: number, z: number): Promise<void> {
    const key = chunkKey(x, z);
    this.activeLoads.add(key);

    try {
      // Use chunk pooling if enabled
      let chunk: ChunkData;
      if (this.config.usePooling) {
        chunk = this.chunkPool.acquire(x, z);
      } else {
        chunk = this.createChunkInstance(x, z);
      }

      // Generate terrain
      const generatedChunk = this.terrainGenerator.generateChunk(x, z);
      
      // Copy generated terrain data to our chunk
      chunk.blocks.set(generatedChunk.blocks);

      // Store chunk
      useWorldStore.getState().setChunk(x, z, chunk);

      // Mark as generated
      chunk.isGenerated = true;
      chunk.isDirty = true;

      // Track performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordChunkLoad(key, Date.now());
      }

    } catch (error) {
      console.error(`Failed to load chunk ${key}:`, error);
    } finally {
      this.activeLoads.delete(key);
    }
  }

  private unloadChunk(x: number, z: number): void {
    const key = chunkKey(x, z);
    const worldStore = useWorldStore.getState();
    const chunk = worldStore.getChunk(x, z);

    if (chunk) {
      // Dispose of mesh if it exists
      if (chunk.mesh) {
        if (this.config.usePooling) {
          this.meshPool.release(chunk.mesh as any);
        } else {
          this.disposeMesh(chunk.mesh);
        }
        chunk.mesh = null;
      }

      // Remove from world store
      worldStore.removeChunk(x, z);

      // Return to pool if using pooling
      if (this.config.usePooling) {
        this.chunkPool.release(chunk);
      }

      // Track performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordChunkUnload(key, Date.now());
      }
    }
  }

  private createChunkInstance(x: number, z: number): ChunkData {
    // Create chunk without pooling
    const chunk = {
      x,
      z,
      blocks: new Uint8Array(CHUNK_SIZE * 32 * CHUNK_SIZE), // Assuming CHUNK_HEIGHT = 32
      blockStates: new Uint8Array(CHUNK_SIZE * 32 * CHUNK_SIZE),
      biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
      lightMap: new Uint8Array(CHUNK_SIZE * 32 * CHUNK_SIZE).fill(15),
      isDirty: false,
      isGenerated: false,
      mesh: null,
    };
    return chunk;
  }

  private disposeMesh(mesh: any): void {
    if (mesh && mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh && mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat: any) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }

  // Force generate a specific chunk (for initial load)
  async forceGenerateChunk(x: number, z: number): Promise<ChunkData> {
    const worldStore = useWorldStore.getState();
    const key = chunkKey(x, z);

    // Check if already loaded
    let chunk = worldStore.getChunk(x, z);
    if (chunk && chunk.isGenerated) {
      return chunk;
    }

    // Load chunk
    await this.loadChunk(x, z);
    chunk = worldStore.getChunk(x, z)!;

    return chunk;
  }

  // Generate initial chunks around spawn with smooth loading
  async generateInitialChunks(spawnX: number, spawnZ: number, radius: number = 4): Promise<void> {
    const chunks = getChunksInRadius(spawnX, spawnZ, radius);
    const startTime = performance.now();
    const maxTimePerBatch = 10; // 10ms max per batch for smooth initial load
    let currentBatchTime = startTime;
    const batchSize = 4;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      // Check if we're taking too long and yield
      if (i > 0 && performance.now() - currentBatchTime > maxTimePerBatch) {
        await new Promise(resolve => setTimeout(resolve, 0));
        currentBatchTime = performance.now();
      }
      
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      
      await Promise.all(
        batch.map(chunk => this.forceGenerateChunk(chunk.x, chunk.z))
      );
    }
  }

  // Get loading statistics
  getStats(): {
    queuedChunks: number;
    activeLoads: number;
    chunkPoolStats: any;
    meshPoolStats: any;
  } {
    return {
      queuedChunks: this.loadingQueue.length,
      activeLoads: this.activeLoads.size,
      chunkPoolStats: this.chunkPool.getStats(),
      meshPoolStats: this.meshPool.getStats(),
    };
  }

  // Clear all loaded chunks and reset system
  reset(): void {
    // Clear loading queue
    this.loadingQueue = [];
    this.activeLoads.clear();

    // Clear world store
    useWorldStore.getState().reset();

    // Clear pools if using pooling
    if (this.config.usePooling) {
      this.chunkPool.clear();
      this.meshPool.clear();
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<ChunkLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Update chunk manager with camera look direction for look-based loading
  updateWithLookDirection(playerX: number, playerZ: number, yaw: number, pitch: number, renderDistance: number = RENDER_DISTANCE): void {
    this.updateLookDirection(yaw, pitch);
    this.update(playerX, playerZ, renderDistance);
  }

  // Get current queue size
  getQueueSize(): number {
    return this.loadingQueue.length;
  }

  // Get number of active loads
  getActiveLoadCount(): number {
    return this.activeLoads.size;
  }

  // Pre-warm pools for better performance
  preWarm(): void {
    if (this.config.usePooling) {
      this.chunkPool.preWarm(16);
      this.meshPool.preWarm(8);
    }
  }
}

// Default configuration
export const DEFAULT_CHUNK_LOADING_CONFIG: ChunkLoadingConfig = {
  batchSize: 8,
  maxConcurrentLoads: 4,
  usePooling: true,
  enableAsyncLoading: true,
  fastLoadEnabled: true,
  prioritizeNearbyChunks: true,
  pregenerationAhead: 2,
};
