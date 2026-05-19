import { Chunk } from '@/engine/Chunk';
import { TerrainGenerator, BiomeType } from '@/engine/TerrainGenerator';
import { NewGenerationTerrainGenerator } from '@/engine/NewGenerationTerrainGenerator';
import { BlockType } from '@/data/blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, MAX_WORLD_Y, MIN_WORLD_Y } from '@/utils/constants';
import { worldYToLocalY } from '@/utils/coordinates';
import { getWorldNoise, resetWorldNoise, NoiseGenerator } from '@/utils/noise';
import { DEFAULT_DIMENSION_GENERATOR_CONFIGS, type DimensionGeneratorConfig } from './preset';
import type { DimensionId } from '@/engine/ProgressionState';

export interface DimensionChunkGenerator {
  readonly dimension: DimensionId;
  readonly config: DimensionGeneratorConfig;
  generateChunk(chunkX: number, chunkZ: number): Chunk;
}

function setWorldBlock(chunk: Chunk, x: number, worldY: number, z: number, block: BlockType): void {
  if (worldY < MIN_WORLD_Y || worldY >= MAX_WORLD_Y) {
    return;
  }
  const localY = worldYToLocalY(worldY);
  if (localY < 0 || localY >= CHUNK_HEIGHT) {
    return;
  }
  chunk.setBlock(x, localY, z, block);
}

class OverworldDimensionGenerator implements DimensionChunkGenerator {
  readonly dimension = 'overworld' as const;
  readonly config = DEFAULT_DIMENSION_GENERATOR_CONFIGS.overworld;

  constructor(
    private readonly classicGenerator: TerrainGenerator,
    private readonly mythicGenerator: NewGenerationTerrainGenerator,
    private readonly mode: 'classic' | 'new_generation'
  ) {}

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    return this.mode === 'new_generation'
      ? this.mythicGenerator.generateChunk(chunkX, chunkZ)
      : this.classicGenerator.generateChunk(chunkX, chunkZ);
  }
}

class AetherDimensionGenerator implements DimensionChunkGenerator {
  readonly dimension = 'aether' as const;
  readonly config = DEFAULT_DIMENSION_GENERATOR_CONFIGS.aether;
  private readonly noise: NoiseGenerator;

  constructor(seed: number) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x0a3713e7);
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);
    const baseX = chunkX * CHUNK_SIZE;
    const baseZ = chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const continental = this.noise.fbm2D(wx, wz, 4, 0.5, 2, 0.0008);
        const bridgeMask = this.noise.fbm2D(wx + 4000, wz - 4000, 3, 0.55, 2, 0.0022);
        const islandHeight = 330 + continental * 160 + this.noise.fbm2D(wx - 8000, wz + 1200, 3, 0.5, 2, 0.002) * 90;
        const thickness = 18 + Math.max(0, continental) * 34;

        if (continental > -0.18 || bridgeMask > 0.7) {
          const topY = Math.floor(islandHeight);
          const bottomY = Math.floor(islandHeight - thickness);
          for (let y = bottomY; y <= topY; y++) {
            const shellDepth = topY - y;
            const block =
              shellDepth === 0
                ? BlockType.GRASS
                : shellDepth < 4
                  ? BlockType.DIRT
                  : BlockType.STONE;
            setWorldBlock(chunk, x, y, z, block);
          }

          if (bridgeMask > 0.82) {
            for (let y = topY + 1; y <= topY + 4; y++) {
              setWorldBlock(chunk, x, y, z, BlockType.GLASS);
            }
          }
        }
      }
    }

    return chunk;
  }
}

class UnderdeepDimensionGenerator implements DimensionChunkGenerator {
  readonly dimension = 'underdeep' as const;
  readonly config = DEFAULT_DIMENSION_GENERATOR_CONFIGS.underdeep;
  private readonly noise: NoiseGenerator;

  constructor(seed: number) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x55dd1142);
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);
    const baseX = chunkX * CHUNK_SIZE;
    const baseZ = chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const roof = -40 + this.noise.fbm2D(wx, wz, 4, 0.52, 2, 0.0012) * 120;
        const floor = -520 + this.noise.fbm2D(wx + 8000, wz - 3000, 4, 0.5, 2, 0.0013) * 170;

        for (let worldY = Math.floor(floor); worldY <= Math.floor(roof); worldY++) {
          const chasmNoise = this.noise.fbm3D(wx, worldY, wz, 3, 0.5, 2, 0.01);
          if (chasmNoise > 0.17 && worldY > floor + 8 && worldY < roof - 8) {
            continue;
          }

          const depth = roof - worldY;
          const block =
            worldY < -430
              ? BlockType.OBSIDIAN
              : depth < 4
                ? BlockType.DEEPSLATE
                : this.noise.fbm3D(wx * 0.6, worldY * 0.8, wz * 0.6, 2, 0.55, 2, 0.02) > 0.58
                  ? BlockType.AMETHYST_BLOCK
                  : BlockType.BLACKSTONE;

          setWorldBlock(chunk, x, worldY, z, block);
        }

        const lavaLevel = -340;
        if (floor < lavaLevel) {
          for (let y = Math.floor(floor); y <= lavaLevel; y++) {
            const existing = chunk.getBlock(x, worldYToLocalY(y), z);
            if (existing === BlockType.AIR) {
              setWorldBlock(chunk, x, y, z, BlockType.LAVA);
            }
          }
        }
      }
    }

    return chunk;
  }
}

class NetherDimensionGenerator implements DimensionChunkGenerator {
  readonly dimension = 'nether' as const;
  readonly config = DEFAULT_DIMENSION_GENERATOR_CONFIGS.nether;
  private readonly noise: NoiseGenerator;

  constructor(seed: number) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x6e657468);
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);
    const baseX = chunkX * CHUNK_SIZE;
    const baseZ = chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;

        const ceilingHeight = 352 + this.noise.fbm2D(wx * 1.2, wz * 1.2, 4, 0.55, 2, 0.004) * 32;
        const floorHeight = 16 + this.noise.fbm2D(wx + 2000, wz + 2000, 5, 0.5, 2, 0.003) * 64;

        // Ceiling netherrack
        for (let y = 320; y <= ceilingHeight; y++) {
          setWorldBlock(chunk, x, y, z, BlockType.NETHERRACK);
        }

        // Ground netherrack
        for (let y = floorHeight; y >= 0; y--) {
          const depth = floorHeight - y;
          const block = depth === 0
            ? (this.noise.fbm2D(wx * 0.1, wz * 0.1, 2, 0.5, 2, 0.1) > 0.6 ? BlockType.SOUL_SAND : BlockType.NETHERRACK)
            : depth < 5 ? BlockType.NETHERRACK
            : this.noise.fbm3D(wx, y, wz, 3, 0.55, 2, 0.03) > 0.58 ? BlockType.BASALT
            : BlockType.NETHERRACK;

          setWorldBlock(chunk, x, y, z, block);
        }

        // Lava ocean
        if (floorHeight < 32) {
          for (let y = Math.floor(floorHeight) + 1; y <= 32; y++) {
            setWorldBlock(chunk, x, y, z, BlockType.LAVA);
          }
        }

        // Nether glowstone patches
        const glowstoneNoise = this.noise.fbm3D(wx * 0.5, 128, wz * 0.5, 3, 0.5, 2, 0.008);
        if (glowstoneNoise > 0.7) {
          const patchY = 160 + Math.floor(glowstoneNoise * 120);
          for (let py = patchY; py <= patchY + 2; py++) {
            for (let dx = -1; dx <= 1; dx++) {
              for (let dz = -1; dz <= 1; dz++) {
                if (x + dx >= 0 && x + dx < CHUNK_SIZE && z + dz >= 0 && z + dz < CHUNK_SIZE) {
                  if (this.noise.fbm2D(wx + dx, wz + dz, 1, 0.5, 2, 0.2) > 0.4) {
                    setWorldBlock(chunk, x + dx, py, z + dz, BlockType.GLOWSTONE);
                  }
                }
              }
            }
          }
        }
      }
    }

    return chunk;
  }
}

class EndDimensionGenerator implements DimensionChunkGenerator {
  readonly dimension = 'end' as const;
  readonly config = DEFAULT_DIMENSION_GENERATOR_CONFIGS.end;
  private readonly noise: NoiseGenerator;

  constructor(seed: number) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x656e6421);
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);
    const baseX = chunkX * CHUNK_SIZE;
    const baseZ = chunkZ * CHUNK_SIZE;

    const islandDensity = this.noise.fbm2D(baseX * 0.0012, baseZ * 0.0012, 4, 0.55, 2, 0.0001);

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;

        if (islandDensity > -0.22) {
          const heightMap = this.noise.fbm2D(wx * 0.006, wz * 0.006, 5, 0.5, 2, 0.003) * 40;
          const centerDist = Math.sqrt(Math.pow(chunkX, 2) + Math.pow(chunkZ, 2));
          const falloff = Math.max(0, 1 - centerDist / 64);

          const surfaceY = 64 + Math.floor(heightMap * falloff);
          const thickness = Math.floor(12 + heightMap * falloff * 0.5);

          for (let y = surfaceY - thickness; y <= surfaceY; y++) {
            const depth = surfaceY - y;
            const block = depth === 0
              ? BlockType.END_STONE
              : depth < 3 ? BlockType.END_STONE
              : this.noise.fbm3D(wx, y, wz, 2, 0.55, 2, 0.04) > 0.45 ? BlockType.OBSIDIAN
              : BlockType.END_STONE;

            setWorldBlock(chunk, x, y, z, block);
          }

          // End crystal spires
          const spireNoise = this.noise.fbm2D(wx * 0.02, wz * 0.02, 3, 0.5, 2, 0.005);
          if (spireNoise > 0.85 && centerDist > 12 && centerDist < 48) {
            const spireHeight = 12 + Math.floor(spireNoise * 24);
            for (let i = 0; i < spireHeight; i++) {
              setWorldBlock(chunk, x, surfaceY + i, z, BlockType.OBSIDIAN);
            }
            setWorldBlock(chunk, x, surfaceY + spireHeight, z, BlockType.GLOWSTONE);
          }
        }
      }
    }

    return chunk;
  }
}

export function createDimensionChunkGenerator(
  dimension: DimensionId,
  seed: number,
  mode: 'classic' | 'new_generation' = 'new_generation'
): DimensionChunkGenerator {
  switch (dimension) {
    case 'aether':
      return new AetherDimensionGenerator(seed);
    case 'underdeep':
      return new UnderdeepDimensionGenerator(seed);
    case 'nether':
      return new NetherDimensionGenerator(seed);
    case 'end':
      return new EndDimensionGenerator(seed);
    case 'overworld':
    default:
      return new OverworldDimensionGenerator(new TerrainGenerator(seed), new NewGenerationTerrainGenerator(seed), mode);
  }
}
