// src/workers/generationWorker.ts
// Web Worker for chunk generation to move heavy computation off main thread

import { Chunk } from '../engine/Chunk';
import { BlockType } from '../data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../utils/constants';
import { NoiseGenerator, getWorldNoise, resetWorldNoise } from '../utils/noise';

// Copy biome system from TerrainGenerator
export enum BiomeType {
  PLAINS        = 'plains',
  SUNFLOWER_PLAINS = 'sunflower_plains',
  FOREST        = 'forest',
  DARK_FOREST   = 'dark_forest',
  DESERT        = 'desert',
  BADLANDS      = 'badlands',
  BEACH         = 'beach',
  MEADOW        = 'meadow',
  CHERRY_GROVE  = 'cherry_grove',
  MUSHROOM_ISLAND = 'mushroom_island',
  SNOW          = 'snow',
  ICE_SPIKES    = 'ice_spikes',
  JUNGLE        = 'jungle',
  MOUNTAINS     = 'mountains',
  MEGA_MOUNTAINS= 'mega_mountains',
  SWAMP         = 'swamp',
  TAIGA         = 'taiga',
  SAVANNA       = 'savanna',
  MUSHROOM      = 'mushroom',
  OCEAN         = 'ocean',
  DEEP_OCEAN    = 'deep_ocean',
  VOLCANIC      = 'volcanic',
  ORANGE_GROVE  = 'orange_grove',
}

interface BiomeConfig {
  surfaceBlock:    BlockType;
  subSurfaceBlock: BlockType;
  underBlock:      BlockType;
  treeDensity:     number;
  minHeight:       number;
  maxHeight:       number;
  tempRange:       [number, number];
  humRange:        [number, number];
  treeType:        'oak'|'birch'|'spruce'|'jungle'|'acacia'|'cactus'|'dark_oak'|'cherry'|'orange'|'none';
}

const BIOMES: Record<BiomeType, BiomeConfig> = {
  [BiomeType.PLAINS]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.025, minHeight: 63, maxHeight: 70,
    tempRange: [0.35, 0.65], humRange: [0.25, 0.55], treeType: 'oak',
  },
  [BiomeType.SUNFLOWER_PLAINS]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.01, minHeight: 63, maxHeight: 70,
    tempRange: [0.45, 0.70], humRange: [0.20, 0.45], treeType: 'oak',
  },
  [BiomeType.FOREST]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.2, minHeight: 63, maxHeight: 75,
    tempRange: [0.30, 0.60], humRange: [0.55, 0.90], treeType: 'oak',
  },
  [BiomeType.DARK_FOREST]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.25, minHeight: 63, maxHeight: 72,
    tempRange: [0.25, 0.55], humRange: [0.60, 0.95], treeType: 'dark_oak',
  },
  [BiomeType.DESERT]: {
    surfaceBlock: BlockType.SAND, subSurfaceBlock: BlockType.SAND, underBlock: BlockType.SANDSTONE,
    treeDensity: 0.002, minHeight: 60, maxHeight: 68,
    tempRange: [0.72, 1.0], humRange: [0.0, 0.20], treeType: 'cactus',
  },
  [BiomeType.BEACH]: {
    surfaceBlock: BlockType.SAND, subSurfaceBlock: BlockType.SAND, underBlock: BlockType.SANDSTONE,
    treeDensity: 0.0, minHeight: 58, maxHeight: 64,
    tempRange: [0.25, 0.85], humRange: [0.15, 0.85], treeType: 'none',
  },
  [BiomeType.BADLANDS]: {
    surfaceBlock: BlockType.SAND, subSurfaceBlock: BlockType.SAND, underBlock: BlockType.STONE,
    treeDensity: 0.001, minHeight: 70, maxHeight: 95,
    tempRange: [0.80, 1.0], humRange: [0.0, 0.15], treeType: 'none',
  },
  [BiomeType.MEADOW]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.08, minHeight: 66, maxHeight: 82,
    tempRange: [0.25, 0.70], humRange: [0.45, 0.85], treeType: 'birch',
  },
  [BiomeType.CHERRY_GROVE]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.28, minHeight: 72, maxHeight: 88,
    tempRange: [0.28, 0.58], humRange: [0.45, 0.78], treeType: 'cherry',
  },
  [BiomeType.MUSHROOM_ISLAND]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 62, maxHeight: 70,
    tempRange: [0.30, 0.60], humRange: [0.88, 1.0], treeType: 'none',
  },
  [BiomeType.SNOW]: {
    surfaceBlock: BlockType.SNOW, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.015, minHeight: 64, maxHeight: 80,
    tempRange: [0.0, 0.22], humRange: [0.30, 0.70], treeType: 'spruce',
  },
  [BiomeType.ICE_SPIKES]: {
    surfaceBlock: BlockType.SNOW, subSurfaceBlock: BlockType.SNOW, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 63, maxHeight: 70,
    tempRange: [0.0, 0.15], humRange: [0.60, 1.0], treeType: 'none',
  },
  [BiomeType.JUNGLE]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.25, minHeight: 62, maxHeight: 75,
    tempRange: [0.65, 1.0], humRange: [0.72, 1.0], treeType: 'jungle',
  },
  [BiomeType.MOUNTAINS]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.005, minHeight: 85, maxHeight: 220,
    tempRange: [0.10, 0.50], humRange: [0.20, 0.60], treeType: 'none',
  },
  [BiomeType.MEGA_MOUNTAINS]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.001, minHeight: 120, maxHeight: 280,
    tempRange: [0.0, 0.30], humRange: [0.10, 0.50], treeType: 'none',
  },
  [BiomeType.SWAMP]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.075, minHeight: 56, maxHeight: 62,
    tempRange: [0.40, 0.70], humRange: [0.80, 1.0], treeType: 'oak',
  },
  [BiomeType.TAIGA]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.12, minHeight: 62, maxHeight: 76,
    tempRange: [0.08, 0.30], humRange: [0.40, 0.70], treeType: 'spruce',
  },
  [BiomeType.SAVANNA]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.03, minHeight: 60, maxHeight: 70,
    tempRange: [0.62, 0.88], humRange: [0.10, 0.38], treeType: 'acacia',
  },
  [BiomeType.MUSHROOM]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 63, maxHeight: 68,
    tempRange: [0.30, 0.60], humRange: [0.90, 1.0], treeType: 'none',
  },
  [BiomeType.OCEAN]: {
    surfaceBlock: BlockType.SAND, subSurfaceBlock: BlockType.SAND, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 38, maxHeight: 58,
    tempRange: [0.20, 0.75], humRange: [0.30, 0.85], treeType: 'none',
  },
  [BiomeType.DEEP_OCEAN]: {
    surfaceBlock: BlockType.STONE, subSurfaceBlock: BlockType.STONE, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 5, maxHeight: 25,
    tempRange: [0.15, 0.70], humRange: [0.25, 0.80], treeType: 'none',
  },
  [BiomeType.VOLCANIC]: {
    surfaceBlock: BlockType.STONE, subSurfaceBlock: BlockType.STONE, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 62, maxHeight: 90,
    tempRange: [0.85, 1.0], humRange: [0.60, 1.0], treeType: 'none',
  },
  [BiomeType.ORANGE_GROVE]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.35, minHeight: 60, maxHeight: 72,
    tempRange: [0.55, 0.80], humRange: [0.35, 0.60], treeType: 'orange',
  },
};

// Worker message types
interface GenerateChunkMessage {
  type: 'generate';
  chunkX: number;
  chunkZ: number;
  seed: number;
  generationMode: 'classic' | 'new_generation';
}

interface WorkerResponse {
  type: 'chunk_generated';
  chunkX: number;
  chunkZ: number;
  blocks: Uint16Array;
}

// Simple terrain generator for worker
class WorkerTerrainGenerator {
  seed: number;
  private noise: NoiseGenerator;

  constructor(seed: number) {
    this.seed = seed;
    resetWorldNoise();
    this.noise = getWorldNoise(seed);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    const heightMap = this.buildHeightMap(worldX, worldZ);
    this.fillTerrain(chunk, worldX, worldZ, heightMap);
    this.carveCaves(chunk, worldX, worldZ, heightMap);
    this.addOres(chunk, worldX, worldZ, heightMap);

    return chunk;
  }

  private getBiome(x: number, z: number): BiomeType {
    const temp = this.noise.getTemperature(x, z);
    const hum = this.noise.getHumidity(x, z);
    const cont = this.noise.fbm2D(x, z, 3, 0.5, 2.0, 0.0006);

    if (cont < -0.42) return BiomeType.DEEP_OCEAN;
    if (cont < -0.12) return BiomeType.OCEAN;
    if (cont < 0.0) return BiomeType.BEACH;

    let best = BiomeType.PLAINS, bestScore = -1;
    for (const [type, cfg] of Object.entries(BIOMES) as [BiomeType, BiomeConfig][]) {
      if (type === BiomeType.OCEAN || type === BiomeType.DEEP_OCEAN) continue;
      const ts = this.rangeFit(temp, cfg.tempRange);
      const hs = this.rangeFit(hum, cfg.humRange);
      const sc = ts * hs;
      if (sc > bestScore) { bestScore = sc; best = type; }
    }
    return best;
  }

  private rangeFit(value: number, range: [number, number]): number {
    const [min, max] = range;
    if (value < min) return 0;
    if (value > max) return 0;
    return (value - min) / (max - min);
  }

  private buildHeightMap(worldX: number, worldZ: number): number[][] {
    const map: number[][] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      map[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x, wz = worldZ + z;
        const biome = this.getBiome(wx, wz);
        const cfg = BIOMES[biome];

        const continentalness = this.noise.fbm2D(wx, wz, 3, 0.5, 2.0, 0.0004) * 0.5 + 0.25;
        const erosion = this.noise.fbm2D(wx, wz, 3, 0.5, 2.0, 0.003) * 0.5 + 0.25;
        const weirdness = this.noise.fbm2D(wx, wz, 4, 0.5, 2.0, 0.006) * 0.5;

        let h = this.noise.fbm2D(wx, wz, 6, 0.5, 2.0, 0.006);
        h = h * 0.4 + continentalness * 0.35 + erosion * 0.25;

        if (biome === BiomeType.MOUNTAINS || biome === BiomeType.MEGA_MOUNTAINS) {
          const peakFactor = weirdness > 0 ? Math.pow(weirdness + 0.3, 1.5) * 1.8 : 0;
          h += peakFactor + Math.pow(Math.max(0, this.noise.fbm2D(wx, wz, 5, 0.6, 2.0, 0.008)), 1.8) * 0.5;
        }

        const range = cfg.maxHeight - cfg.minHeight;
        const baseHeight = cfg.minHeight + (h * 0.5 + 0.5) * range;

        map[x][z] = Math.max(2, Math.min(CHUNK_HEIGHT - 4, Math.floor(baseHeight)));
      }
    }
    return map;
  }

  private fillTerrain(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = hm[x][z];
        const wx = worldX + x, wz = worldZ + z;
        const biome = this.getBiome(wx, wz);
        const cfg = BIOMES[biome];

        for (let y = 0; y < h; y++) {
          let block = BlockType.STONE;
          if (y === h - 1) {
            block = cfg.surfaceBlock;
          } else if (y >= h - 4) {
            block = cfg.subSurfaceBlock;
          }
          chunk.setBlock(x, y, z, block);
        }

        // Fill below with under block
        for (let y = 0; y < h - 4; y++) {
          chunk.setBlock(x, y, z, cfg.underBlock);
        }
      }
    }
  }

  private carveCaves(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    // Simplified cave carving
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const wx = worldX + x, wy = y, wz = worldZ + z;
          const caveNoise = this.noise.fbm3D(wx * 0.02, wy * 0.02, wz * 0.02, 4, 0.5, 2.0);
          if (caveNoise > 0.3 && chunk.getBlock(x, y, z) !== BlockType.AIR) {
            chunk.setBlock(x, y, z, BlockType.AIR);
          }
        }
      }
    }
  }

  private addOres(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    // Simplified ore generation
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.STONE) {
            const wx = worldX + x, wy = y, wz = worldZ + z;
            const coalNoise = this.noise.fbm3D(wx * 0.05, wy * 0.05, wz * 0.05, 3, 0.5, 2.0);
            if (coalNoise > 0.7) {
              chunk.setBlock(x, y, z, BlockType.COAL_ORE);
            }
          }
        }
      }
    }
  }
}

// Worker instance
let generator: WorkerTerrainGenerator | null = null;

self.onmessage = (e: MessageEvent<GenerateChunkMessage>) => {
  const { type, chunkX, chunkZ, seed, generationMode } = e.data;

  if (type === 'generate') {
    if (!generator || generator.seed !== seed) {
      generator = new WorkerTerrainGenerator(seed);
    }

    const chunk = generator.generateChunk(chunkX, chunkZ);

    // Serialize chunk data
    const response: WorkerResponse = {
      type: 'chunk_generated',
      chunkX,
      chunkZ,
      blocks: chunk.blocks,
    };

    self.postMessage(response);
  }
};