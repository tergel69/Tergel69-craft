import { useWorldStore, ChunkData, createChunk } from '@/stores/worldStore';
import { TerrainGenerator } from './TerrainGenerator';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '@/utils/constants';
import { chunkKey, worldToChunk, getChunksInRadius } from '@/utils/coordinates';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { BlockType } from '@/data/blocks';

// Priority levels for chunk generation
enum ChunkPriority {
  IMMEDIATE = 0,    // Player's current chunk
  HIGH = 1,         // Nearby chunks (within render distance - 2)
  MEDIUM = 2,       // Mid-range chunks (within render distance)
  LOW = 3,          // Far chunks (just outside render distance)
  BACKGROUND = 4    // Chunks being pre-generated
}

interface ChunkTask {
  x: number;
  z: number;
  priority: ChunkPriority;
  timestamp: number;
}

export class OptimizedChunkManager {
  private terrainGenerator: TerrainGenerator;
  private generationQueue: Map<string, ChunkTask> = new Map();
  private isGenerating: boolean = false;
  private lastGenerationTime: number = 0;
  private generationBudget: number = 0; // Time budget for generation this frame
  private maxGenerationTime: number = 2; // Max ms per frame for generation
  private chunkPriorities: Map<string, ChunkPriority> = new Map();

  constructor(seed: number) {
    this.terrainGenerator = new TerrainGenerator(seed);
  }

  // Update chunks based on player position with optimized priority system
  update(playerX: number, playerZ: number, renderDistance: number = RENDER_DISTANCE): void {
    const worldStore = useWorldStore.getState();
    const playerChunk = worldToChunk(playerX, playerZ);

    // Calculate time budget for this frame based on performance
    this.calculateGenerationBudget();

    // Get chunks that should be loaded with priority
    const chunksToLoad = this.getChunksWithPriority(playerX, playerZ, renderDistance);

    // Find chunks to unload (optimized with early exit)
    const loadedChunks = Array.from(worldStore.loadedChunks);
    for (const key of loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > renderDistance + 3) {
        worldStore.removeChunk(cx, cz);
        this.generationQueue.delete(key);
        this.chunkPriorities.delete(key);
      }
    }

    // Queue chunks for generation with priority
    for (const { x, z, priority } of chunksToLoad) {
      const key = chunkKey(x, z);
      if (!worldStore.isChunkLoaded(x, z) && !this.generationQueue.has(key)) {
        this.generationQueue.set(key, {
          x, z, priority,
          timestamp: performance.now()
        });
        this.chunkPriorities.set(key, priority);
      } else if (this.chunkPriorities.get(key) !== priority) {
        // Update priority if changed
        this.chunkPriorities.set(key, priority);
        if (this.generationQueue.has(key)) {
          const task = this.generationQueue.get(key)!;
          task.priority = priority;
          task.timestamp = performance.now();
        }
      }
    }

    // Process generation queue with time budgeting
    this.processGenerationQueue();
  }

  private calculateGenerationBudget(): void {
    // Use a fixed target frame time of 16.67ms (60 FPS)
    const targetFrameTime = 16.67;
    
    // Allocate 5% of frame time to chunk generation (reduced from 10%)
    this.maxGenerationTime = Math.min(3, targetFrameTime * 0.05);
    
    // Adjust budget based on recent performance
    const now = performance.now();
    const frameTime = now - this.lastGenerationTime;
    
    if (frameTime > targetFrameTime * 1.5) {
      // Frame took too long, reduce budget more aggressively
      this.generationBudget = Math.max(0, this.generationBudget - 1);
    } else if (frameTime < targetFrameTime * 0.8) {
      // Frame was fast, increase budget slightly
      this.generationBudget = Math.min(3, this.generationBudget + 0.05);
    } else {
      // Frame time was good, maintain budget
      this.generationBudget = Math.min(this.maxGenerationTime, this.generationBudget + 0.1);
    }
    
    this.lastGenerationTime = now;
  }

  private getChunksWithPriority(playerX: number, playerZ: number, renderDistance: number): Array<{x: number, z: number, priority: ChunkPriority}> {
    const playerChunk = worldToChunk(playerX, playerZ);
    const chunks = getChunksInRadius(playerX, playerZ, renderDistance + 2);
    
    return chunks.map(({ x, z }) => {
      const dx = x - playerChunk.x;
      const dz = z - playerChunk.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      let priority: ChunkPriority;
      if (distance <= 1) priority = ChunkPriority.IMMEDIATE;
      else if (distance <= renderDistance - 2) priority = ChunkPriority.HIGH;
      else if (distance <= renderDistance) priority = ChunkPriority.MEDIUM;
      else priority = ChunkPriority.LOW;
      
      return { x, z, priority };
    });
  }

  private processGenerationQueue(): void {
    if (this.isGenerating || this.generationQueue.size === 0) return;

    this.isGenerating = true;
    const startTime = performance.now();
    let processed = 0;

    // Sort queue by priority and timestamp
    const sortedTasks = Array.from(this.generationQueue.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.timestamp - b.timestamp;
      });

    for (const task of sortedTasks) {
      const now = performance.now();
      const timeSpent = now - startTime;
      
      // Check time budget
      if (timeSpent >= this.generationBudget) break;
      
      // Check if chunk is still needed
      if (useWorldStore.getState().isChunkLoaded(task.x, task.z)) {
        this.generationQueue.delete(chunkKey(task.x, task.z));
        continue;
      }

      // Generate chunk
      this.generateChunk(task.x, task.z);
      this.generationQueue.delete(chunkKey(task.x, task.z));
      processed++;

      // Limit processed chunks per frame to prevent spikes
      if (processed >= 1) break;
    }

    this.isGenerating = false;
  }

  private generateChunk(x: number, z: number): void {
    const worldStore = useWorldStore.getState();

    // Generate terrain (includes structures like trees)
    const generatedChunk = this.terrainGenerator.generateChunk(x, z);

    // Convert Chunk to ChunkData format
    const chunkData: ChunkData = {
      x: generatedChunk.cx,
      z: generatedChunk.cz,
      blocks: generatedChunk.blocks,
      biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE), // Initialize empty biomes
      heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE), // Initialize empty height map
      lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15), // Full light
      isDirty: true,
      isGenerated: true,
    };

    // Calculate height map
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const columnIndex = z * CHUNK_SIZE + x;
        let highestBlock = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (generatedChunk.getBlock(x, y, z) !== BlockType.AIR) {
            highestBlock = y;
            break;
          }
        }
        chunkData.heightMap[columnIndex] = highestBlock;
      }
    }

    // Store chunk
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

    // Generate terrain (includes structures like trees)
    const generatedChunk = this.terrainGenerator.generateChunk(x, z);

    // Convert Chunk to ChunkData format
    const chunkData: ChunkData = {
      x: generatedChunk.cx,
      z: generatedChunk.cz,
      blocks: generatedChunk.blocks,
      biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE), // Initialize empty biomes
      heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE), // Initialize empty height map
      lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15), // Full light
      isDirty: true,
      isGenerated: true,
    };

    // Calculate height map
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const columnIndex = z * CHUNK_SIZE + x;
        let highestBlock = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (generatedChunk.getBlock(x, y, z) !== BlockType.AIR) {
            highestBlock = y;
            break;
          }
        }
        chunkData.heightMap[columnIndex] = highestBlock;
      }
    }

    worldStore.setChunk(x, z, chunkData);

    return chunkData;
  }

  // Generate initial chunks around spawn with priority
  generateInitialChunks(spawnX: number, spawnZ: number, radius: number = 4): void {
    const chunks = getChunksInRadius(spawnX, spawnZ, radius);

    // Sort by distance for priority loading
    chunks.sort((a, b) => {
      const da = Math.sqrt((a.x - spawnX) ** 2 + (a.z - spawnZ) ** 2);
      const db = Math.sqrt((b.x - spawnX) ** 2 + (b.z - spawnZ) ** 2);
      return da - db;
    });

    // Generate closest chunks first
    for (let i = 0; i < chunks.length; i++) {
      const { x, z } = chunks[i];
      this.forceGenerateChunk(x, z);
      
      // Add to generation queue for background processing
      if (i >= radius * 2) {
        this.generationQueue.set(chunkKey(x, z), {
          x, z, priority: ChunkPriority.BACKGROUND,
          timestamp: performance.now()
        });
      }
    }
  }

  // Get number of chunks waiting to be generated
  getQueueSize(): number {
    return this.generationQueue.size;
  }

  // Get generation performance stats
  getGenerationStats(): { queueSize: number; isGenerating: boolean; budget: number } {
    return {
      queueSize: this.generationQueue.size,
      isGenerating: this.isGenerating,
      budget: this.generationBudget
    };
  }

  // Clear all chunks
  reset(): void {
    this.generationQueue.clear();
    this.chunkPriorities.clear();
    useWorldStore.getState().reset();
  }
}

// Singleton instance
let optimizedChunkManager: OptimizedChunkManager | null = null;

export function getOptimizedChunkManager(seed?: number): OptimizedChunkManager {
  if (!optimizedChunkManager || seed !== undefined) {
    optimizedChunkManager = new OptimizedChunkManager(seed ?? Date.now());
  }
  return optimizedChunkManager;
}

export function resetOptimizedChunkManager(): void {
  if (optimizedChunkManager) {
    optimizedChunkManager.reset();
  }
  optimizedChunkManager = null;
}