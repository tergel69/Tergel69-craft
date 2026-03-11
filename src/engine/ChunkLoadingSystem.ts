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
}

export class ChunkLoadingSystem {
  private chunkPool: ChunkPool;
  private meshPool: MeshPool;
  private terrainGenerator: TerrainGenerator;
  private config: ChunkLoadingConfig;
  private loadingQueue: Array<{ x: number; z: number; priority: number }> = [];
  private activeLoads: Set<string> = new Set();
  private isProcessing: boolean = false;
  private performanceMonitor: any;

  constructor(
    seed: number,
    config: Partial<ChunkLoadingConfig> = {},
    performanceMonitor?: any
  ) {
    this.config = {
      batchSize: 4,
      maxConcurrentLoads: 2,
      usePooling: true,
      enableAsyncLoading: true,
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

  // Update chunks based on player position with optimized loading
  update(playerX: number, playerZ: number, renderDistance: number = RENDER_DISTANCE): void {
    const worldStore = useWorldStore.getState();
    const playerChunk = worldToChunk(playerX, playerZ);

    // Get chunks that should be loaded
    const chunksToLoad = getChunksInRadius(playerX, playerZ, renderDistance);

    // Find chunks to unload (optimized with early exit)
    const loadedChunks = Array.from(worldStore.loadedChunks);
    for (const key of loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > renderDistance + 3) {
        this.unloadChunk(cx, cz);
      }
    }

    // Queue chunks for loading with priority
    for (const { x, z } of chunksToLoad) {
      const key = chunkKey(x, z);
      if (!worldStore.isChunkLoaded(x, z) && !this.activeLoads.has(key)) {
        // Calculate priority based on distance
        const dx = x - playerChunk.x;
        const dz = z - playerChunk.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const priority = Math.floor(distance * 10); // Closer chunks have lower priority numbers

        this.queueChunkForLoading(x, z, priority);
      }
    }

    // Process loading queue
    this.processLoadingQueue();
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

    // Process chunks in batches
    const batchSize = this.calculateBatchSize();
    let processed = 0;

    while (processed < batchSize && this.loadingQueue.length > 0) {
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
    const baseBatchSize = Math.max(1, Math.min(6, Math.floor(currentRenderDistance / 3)));
    
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

  // Generate initial chunks around spawn with optimized loading
  async generateInitialChunks(spawnX: number, spawnZ: number, radius: number = 4): Promise<void> {
    const chunks = getChunksInRadius(spawnX, spawnZ, radius);
    
    // Load chunks in batches for better performance
    const batchSize = 8;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(chunk => this.forceGenerateChunk(chunk.x, chunk.z))
      );
      
      // Small delay to prevent blocking the main thread
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 16)); // ~1 frame
      }
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
  batchSize: 4,
  maxConcurrentLoads: 2,
  usePooling: true,
  enableAsyncLoading: true,
};