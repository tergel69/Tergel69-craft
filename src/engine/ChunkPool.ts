import * as THREE from 'three';
import { ChunkData, createChunk } from '@/stores/worldStore';

export interface ChunkPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
}

export class ChunkPool {
  private pool: ChunkData[] = [];
  private activeChunks: Map<string, ChunkData> = new Map();
  private config: ChunkPoolConfig;
  private performanceMonitor: any;

  constructor(config: ChunkPoolConfig, performanceMonitor?: any) {
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.initializePool();
  }

  private initializePool(): void {
    console.log(`Initializing chunk pool with ${this.config.initialSize} chunks`);
    
    for (let i = 0; i < this.config.initialSize; i++) {
      const chunk = this.createChunkInstance();
      this.pool.push(chunk);
    }
  }

  private createChunkInstance(): ChunkData {
    // Create a new chunk with minimal initialization
    const chunk = createChunk(0, 0);
    
    // Initialize with empty data structures
    chunk.blocks = new Uint8Array(32768); // CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE
    chunk.biomes = new Uint8Array(256); // CHUNK_SIZE * CHUNK_SIZE
    chunk.heightMap = new Uint16Array(256); // CHUNK_SIZE * CHUNK_SIZE
    chunk.lightMap = new Uint8Array(32768).fill(15);
    chunk.isDirty = false;
    chunk.isGenerated = false;
    chunk.mesh = null;
    
    return chunk;
  }

  acquire(x: number, z: number, y: number = 0): ChunkData {
    const key = `${x}_${y}_${z}`;
    
    // Check if chunk is already active
    if (this.activeChunks.has(key)) {
      const chunk = this.activeChunks.get(key)!;
      return chunk;
    }

    let chunk: ChunkData;

    // Try to get from pool
    if (this.pool.length > 0) {
      chunk = this.pool.pop()!;
      console.log(`Reusing chunk from pool for ${key}`);
    } else {
      // Pool is empty, create new chunk or grow pool
      if (this.activeChunks.size < this.config.maxSize) {
        chunk = this.createChunkInstance();
        console.log(`Created new chunk for ${key}`);
      } else {
        // Force reuse of oldest chunk
        chunk = this.evictOldestChunk();
        console.log(`Evicted oldest chunk for ${key}`);
      }
    }

    // Initialize chunk with new coordinates
    chunk.x = x;
    chunk.z = z;
    chunk.isDirty = true;
    chunk.isGenerated = false;
    chunk.mesh = null;

    this.activeChunks.set(key, chunk);
    
    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordChunkPoolOperation('acquire', key);
    }

    return chunk;
  }

  release(chunk: ChunkData): void {
    if (!chunk) return;

    const key = `${chunk.x}_${chunk.z}`;
    
    // Remove from active chunks
    this.activeChunks.delete(key);

    // Reset chunk state for reuse
    chunk.blocks.fill(0);
    chunk.biomes.fill(0);
    chunk.heightMap.fill(0);
    chunk.lightMap.fill(15);
    if (chunk.mesh) {
      this.disposeMesh(chunk.mesh);
      chunk.mesh = null;
    }
    chunk.isDirty = false;
    chunk.isGenerated = false;

    // Return to pool if not at max size
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(chunk);
    } else {
      // Pool is full, destroy chunk
      this.destroyChunk(chunk);
    }

    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordChunkPoolOperation('release', key);
    }
  }

  private evictOldestChunk(): ChunkData {
    // For now, just create a new chunk since we don't have access time tracking
    // In a real implementation, we'd track last access time
    return this.createChunkInstance();
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

  private destroyChunk(chunk: ChunkData): void {
    // Clean up any remaining resources
    if (chunk.mesh) {
      this.disposeMesh(chunk.mesh);
    }
    chunk.blocks = new Uint8Array(32768);
    chunk.biomes = new Uint8Array(256);
    chunk.heightMap = new Uint16Array(256);
    chunk.lightMap = new Uint8Array(32768).fill(15);
  }

  getActiveChunkCount(): number {
    return this.activeChunks.size;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getMemoryUsage(): { active: number; pooled: number; total: number } {
    const activeMemory = this.activeChunks.size * this.estimateChunkMemory();
    const pooledMemory = this.pool.length * this.estimateChunkMemory();
    
    return {
      active: activeMemory,
      pooled: pooledMemory,
      total: activeMemory + pooledMemory
    };
  }

  private estimateChunkMemory(): number {
    // Rough estimate of memory usage per chunk
    // This is a simplified calculation
    return 1024 * 1024; // ~1MB per chunk estimate
  }

  clear(): void {
    // Release all active chunks
    for (const chunk of this.activeChunks.values()) {
      this.release(chunk);
    }
    
    // Destroy all pooled chunks
    this.pool.forEach(chunk => this.destroyChunk(chunk));
    this.pool = [];
    
    console.log('Chunk pool cleared');
  }

  resize(newSize: number): void {
    this.config.maxSize = newSize;
    
    // If shrinking, evict excess chunks
    while (this.pool.length > newSize) {
      const chunk = this.pool.pop();
      if (chunk) {
        this.destroyChunk(chunk);
      }
    }
    
    // If growing, add more chunks to pool
    while (this.pool.length < this.config.initialSize && this.pool.length < newSize) {
      this.pool.push(this.createChunkInstance());
    }
  }

  // Performance monitoring integration
  getStats(): {
    activeChunks: number;
    pooledChunks: number;
    totalChunks: number;
    memoryUsage: { active: number; pooled: number; total: number };
  } {
    return {
      activeChunks: this.getActiveChunkCount(),
      pooledChunks: this.getPoolSize(),
      totalChunks: this.getActiveChunkCount() + this.getPoolSize(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Pre-warm the pool with a specific number of chunks
  preWarm(count: number): void {
    while (this.pool.length < count && this.pool.length < this.config.maxSize) {
      this.pool.push(this.createChunkInstance());
    }
  }
}

// Default configuration
export const DEFAULT_CHUNK_POOL_CONFIG: ChunkPoolConfig = {
  initialSize: 16,
  maxSize: 64,
  growthFactor: 1.5
};