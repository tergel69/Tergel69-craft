import { useWorldStore, ChunkData, createChunk } from '@/stores/worldStore';
import { TerrainGenerator } from './TerrainGenerator';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '@/utils/constants';
import { chunkKey, worldToChunk, getChunksInRadius } from '@/utils/coordinates';
import { useGameStore } from '@/stores/gameStore';
import { BlockType } from '@/data/blocks';
import { encodeTerrainBiome } from '@/utils/biomeEncoding';

export class ChunkManager {
  private terrainGenerator: TerrainGenerator;
  private generationQueue: Set<string> = new Set();
  private isGenerating: boolean = false;
  private lastPlayerChunkX: number | null = null;
  private lastPlayerChunkZ: number | null = null;
  private lastRenderDistance: number | null = null;

  constructor(seed: number) {
    this.terrainGenerator = new TerrainGenerator(seed);
  }

  // Update chunks based on player position (optimized)
  update(playerX: number, playerZ: number, renderDistance: number = RENDER_DISTANCE): void {
    const worldStore = useWorldStore.getState();
    const playerChunk = worldToChunk(playerX, playerZ);
    const chunkChanged =
      this.lastPlayerChunkX !== playerChunk.x ||
      this.lastPlayerChunkZ !== playerChunk.z ||
      this.lastRenderDistance !== renderDistance;

    // If player stays in the same chunk and settings didn't change, avoid full load/unload scan.
    if (!chunkChanged) {
      this.processGenerationQueue();
      return;
    }

    this.lastPlayerChunkX = playerChunk.x;
    this.lastPlayerChunkZ = playerChunk.z;
    this.lastRenderDistance = renderDistance;

    // Get chunks that should be loaded
    const chunksToLoad = getChunksInRadius(playerX, playerZ, renderDistance);

    // Find chunks to unload (optimized with early exit)
    const loadedChunks = Array.from(worldStore.loadedChunks);
    const unloadRadiusSq = (renderDistance + 3) * (renderDistance + 3);
    for (const key of loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > unloadRadiusSq) {
        worldStore.removeChunk(cx, cz);
      }
    }

    // Queue chunks for generation (optimized with batch processing)
    for (const { x, z } of chunksToLoad) {
      const key = chunkKey(x, z);
      if (!worldStore.isChunkLoaded(x, z) && !this.generationQueue.has(key)) {
        this.generationQueue.add(key);
      }
    }

    // Process generation queue
    this.processGenerationQueue();
  }

  private processGenerationQueue(): void {
    if (this.isGenerating || this.generationQueue.size === 0) return;

    this.isGenerating = true;

    // Process a very small number of chunks and stop if we exceed time budget.
    const currentRenderDistance = useGameStore.getState().renderDistance ?? RENDER_DISTANCE;
    const queued = this.generationQueue.size;
    const chunksPerFrame = Math.max(1, Math.min(2, Math.floor(currentRenderDistance / 8) + Math.floor(queued / 180)));
    const timeBudgetMs = queued > 160 ? 3 : 2;
    const start = performance.now();
    let processed = 0;

    const iterator = this.generationQueue.values();
    while (processed < chunksPerFrame) {
      if (performance.now() - start > timeBudgetMs) break;
      const result = iterator.next();
      if (result.done) break;

      const key = result.value;
      this.generationQueue.delete(key);

      const [x, z] = key.split(',').map(Number);
      this.generateChunk(x, z);
      processed++;
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

    // Calculate height map and store biomes
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
        
        // Store biome for this column
        const worldX = x * CHUNK_SIZE + lx;
        const worldZ = z * CHUNK_SIZE + lz;
        const biome = this.terrainGenerator.getBiome(worldX, worldZ);
        chunkData.biomes[columnIndex] = encodeTerrainBiome(biome);
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

    // Calculate height map and store biomes
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
        
        // Store biome for this column
        const worldX = x * CHUNK_SIZE + lx;
        const worldZ = z * CHUNK_SIZE + lz;
        const biome = this.terrainGenerator.getBiome(worldX, worldZ);
        chunkData.biomes[columnIndex] = encodeTerrainBiome(biome);
      }
    }

    worldStore.setChunk(x, z, chunkData);

    return chunkData;
  }

  // Generate initial chunks around spawn
  generateInitialChunks(spawnX: number, spawnZ: number, radius: number = 4): void {
    const chunks = getChunksInRadius(spawnX, spawnZ, radius);

    for (const { x, z } of chunks) {
      this.forceGenerateChunk(x, z);
    }
  }

  // Get number of chunks waiting to be generated
  getQueueSize(): number {
    return this.generationQueue.size;
  }

  // Clear all chunks
  reset(): void {
    this.generationQueue.clear();
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkZ = null;
    this.lastRenderDistance = null;
    useWorldStore.getState().reset();
  }
}

// Singleton instance
let chunkManager: ChunkManager | null = null;

export function getChunkManager(seed?: number): ChunkManager {
  if (!chunkManager || seed !== undefined) {
    chunkManager = new ChunkManager(seed ?? Date.now());
  }
  return chunkManager;
}

export function resetChunkManager(): void {
  if (chunkManager) {
    chunkManager.reset();
  }
  chunkManager = null;
}
