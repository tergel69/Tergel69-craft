import { Chunk } from './Chunk';
import { BlockType } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '@/utils/constants';
import { NoiseGenerator, getWorldNoise, resetWorldNoise } from '@/utils/noise';
import { BiomeType } from './TerrainGenerator';

type SurfaceBiomeConfig = {
  surface: BlockType;
  subsurface: BlockType;
  filler: BlockType;
};

const SURFACE_BIOMES: Record<BiomeType, SurfaceBiomeConfig> = {
  [BiomeType.PLAINS]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.SUNFLOWER_PLAINS]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.FOREST]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.DARK_FOREST]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.DESERT]: { surface: BlockType.SAND, subsurface: BlockType.SAND, filler: BlockType.SANDSTONE },
  [BiomeType.BEACH]: { surface: BlockType.SAND, subsurface: BlockType.SAND, filler: BlockType.SANDSTONE },
  [BiomeType.BADLANDS]: { surface: BlockType.RED_SAND, subsurface: BlockType.TERRACOTTA, filler: BlockType.STONE },
  [BiomeType.MEADOW]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.CHERRY_GROVE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.ORANGE_GROVE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MUSHROOM_ISLAND]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.SNOW]: { surface: BlockType.SNOW, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.ICE_SPIKES]: { surface: BlockType.SNOW, subsurface: BlockType.SNOW, filler: BlockType.STONE },
  [BiomeType.JUNGLE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MOUNTAINS]: { surface: BlockType.GRASS, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.MEGA_MOUNTAINS]: { surface: BlockType.STONE, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.SWAMP]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.CLAY },
  [BiomeType.TAIGA]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.SAVANNA]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MUSHROOM]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.OCEAN]: { surface: BlockType.SAND, subsurface: BlockType.SAND, filler: BlockType.SANDSTONE },
  [BiomeType.DEEP_OCEAN]: { surface: BlockType.GRAVEL, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.VOLCANIC]: { surface: BlockType.BASALT, subsurface: BlockType.NETHERRACK, filler: BlockType.STONE },
};

export class NewGenerationTerrainGenerator {
  private noise: NoiseGenerator;

  constructor(seed: number = Date.now()) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x5f3759df);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const featureMask = this.hash3(wx * 0.018, 0, wz * 0.018);
        const skyBridgeMask = this.hash3(wx * 0.006, 0, wz * 0.006);
        const height = this.getBlendedSurfaceHeight(wx, wz);
        const biome = this.getBiome(wx, wz);
        const caveBias = this.noise.fbm3D(wx, 48, wz, 3, 0.55, 2.0, 0.0045);
        const config = SURFACE_BIOMES[biome];
        const frozen = biome === BiomeType.SNOW || biome === BiomeType.ICE_SPIKES;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockType.AIR;

          if (y === 0) {
            block = BlockType.BEDROCK;
          } else if (y > height) {
            const skyIslandBase = 104 + Math.floor(skyBridgeMask * 10);
            const isRareSkyIsland =
              featureMask > 0.985 &&
              biome !== BiomeType.OCEAN &&
              biome !== BiomeType.DEEP_OCEAN &&
              biome !== BiomeType.SWAMP;

            if (isRareSkyIsland && y > skyIslandBase && y < skyIslandBase + 10) {
              const islandHeight = skyIslandBase + 10 - y;
              block = islandHeight <= 2 ? config.surface : BlockType.STONE;
            } else if (y <= SEA_LEVEL && height < SEA_LEVEL) {
              block = frozen ? BlockType.ICE : BlockType.WATER;
            }
          } else {
            const depth = height - y;
            const density = this.noise.fbm3D(wx, y, wz, 4, 0.5, 2.0, 0.018) - (y / CHUNK_HEIGHT) * 0.5 + caveBias * 0.22;
            const cave = this.noise.getCaveNoise(wx, y, wz);

            if (depth === 0) {
              block = config.surface;
            } else if (depth < 4) {
              block = config.subsurface;
            } else {
              block = config.filler;
            }

            if (cave > 0.58 && y < height - 5 && y > 5) {
              block = BlockType.AIR;
            } else if (density < -0.02 && y < height - 4 && y > 6) {
              block = BlockType.AIR;
            }

            if (biome === BiomeType.VOLCANIC && y < height - 1 && y > SEA_LEVEL - 6) {
              if (density > 0.2) block = BlockType.OBSIDIAN;
            }
            if (frozen && depth === 0 && height >= SEA_LEVEL - 1) {
              block = BlockType.SNOW;
            }
          }

          chunk.setBlock(x, y, z, block);
        }
      }
    }

    this.carveExtremeFeatures(chunk, worldX, worldZ);
    this.decorateSurface(chunk, worldX, worldZ);
    return chunk;
  }

  private carveExtremeFeatures(chunk: Chunk, worldX: number, worldZ: number): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const shaftMask = this.hash3(wx * 0.02, 0, wz * 0.02);
        const cavernMask = this.noise.fbm2D(wx * 0.018, wz * 0.018, 4, 0.55, 2.0, 0.0045);
        const ravineMask = Math.abs(this.noise.fbm2D(wx * 0.007 + 3000, wz * 0.007 - 3000, 4, 0.55, 2.0, 0.0025));

        for (let y = 1; y < CHUNK_HEIGHT - 1; y++) {
          const block = chunk.getBlock(x, y, z);
          if (block === BlockType.BEDROCK || block === BlockType.WATER || block === BlockType.LAVA) continue;

          const tunnelNoise = this.noise.getCaveNoise(wx, y, wz);
          const deepShaft = y > 18 && shaftMask > 0.955 && Math.abs(wx + wz) % 8 < 3;
          const megaCavern =
            y > 8 &&
            y < 96 &&
            cavernMask > 0.35 &&
            tunnelNoise > 0.28;
          const ravineCut =
            y > 12 &&
            y < 110 &&
            ravineMask > 0.58 &&
            Math.abs(wx - wz) % 13 < 4;

          if (deepShaft || megaCavern || ravineCut || tunnelNoise > 0.62) {
            chunk.setBlock(x, y, z, BlockType.AIR);

            if (y <= 14 && (deepShaft || tunnelNoise > 0.72)) {
              chunk.setBlock(x, y, z, BlockType.LAVA);
            }
          }
        }
      }
    }
  }

  decorateSurface(chunk: Chunk, worldX: number, worldZ: number): void {
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const biome = this.getClassicSurfaceBiome(wx, wz);
        const surfaceY = this.getSurfaceY(chunk, x, z);
        if (surfaceY <= SEA_LEVEL) continue;

        const surfaceBlock = chunk.getBlock(x, surfaceY, z);
        const isGrassSurface = surfaceBlock === BlockType.GRASS;
        const isSandSurface = surfaceBlock === BlockType.SAND;
        const isRedSandSurface = surfaceBlock === BlockType.RED_SAND;
        if (!isGrassSurface && !isSandSurface && !isRedSandSurface) continue;

        const coverN = this.hash3(wx * 3.1, 0, wz * 2.7);
        const typeN = this.hash3(wx * 5.3, 1, wz * 7.1);
        const spireN = this.hash3(wx * 0.013, 7, wz * 0.013);

        if ((biome === BiomeType.MOUNTAINS || biome === BiomeType.MEGA_MOUNTAINS) && spireN > 0.985) {
          const height = biome === BiomeType.MEGA_MOUNTAINS ? 10 + Math.floor(spireN * 14) : 6 + Math.floor(spireN * 10);
          for (let i = 1; i <= height && surfaceY + i < CHUNK_HEIGHT; i++) {
            const taper = Math.max(0, height - i);
            chunk.setBlock(x, surfaceY + i, z, taper > 2 ? BlockType.STONE : BlockType.GRASS);
          }
          continue;
        }

        if (biome === BiomeType.VOLCANIC && spireN > 0.975) {
          const height = 8 + Math.floor(spireN * 18);
          for (let i = 1; i <= height && surfaceY + i < CHUNK_HEIGHT; i++) {
            const block = i < height - 3 ? BlockType.BASALT : BlockType.OBSIDIAN;
            chunk.setBlock(x, surfaceY + i, z, block);
          }
          if (surfaceY + height < CHUNK_HEIGHT) {
            chunk.setBlock(x, surfaceY + height, z, BlockType.LAVA);
          }
          continue;
        }

        switch (biome) {
          case BiomeType.PLAINS:
          case BiomeType.SUNFLOWER_PLAINS: {
            if (isGrassSurface && coverN < 0.35) {
              const block = typeN < 0.65
                ? BlockType.TALL_GRASS
                : (this.hash3(wx * 7.3, 2, wz * 4.1) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW);
              chunk.setBlock(x, surfaceY + 1, z, block);
            }
            break;
          }
          case BiomeType.FOREST:
          case BiomeType.DARK_FOREST: {
            if (isGrassSurface && coverN < 0.30) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            } else if (isGrassSurface && coverN < 0.38) {
              const flowerType = this.hash3(wx * 8.1, 3, wz * 5.3) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, surfaceY + 1, z, flowerType);
            }
            break;
          }
          case BiomeType.JUNGLE: {
            if (coverN < 0.55 && isGrassSurface) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.70 && this.hash3(wx * 4.4, 1, wz * 4.2) < 0.35) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.VINE);
            }
            break;
          }
          case BiomeType.BADLANDS: {
            if (coverN < 0.18) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.DEAD_BUSH);
            } else if (coverN < 0.26) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.CACTUS);
            }
            break;
          }
          case BiomeType.SWAMP: {
            if (isGrassSurface && coverN < 0.25) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.TAIGA: {
            if (isGrassSurface && coverN < 0.18) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.24 && surfaceY > SEA_LEVEL + 8) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.SNOW);
            }
            break;
          }
          case BiomeType.SAVANNA: {
            if (isGrassSurface && coverN < 0.20) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.BEACH: {
            if (isSandSurface && coverN < 0.12) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.MEADOW: {
            if (isGrassSurface && coverN < 0.4) {
              const flowerType = this.hash3(wx * 11.4, 8, wz * 9.1) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, surfaceY + 1, z, flowerType);
            } else if (isGrassSurface && coverN < 0.62) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.CHERRY_GROVE: {
            if (coverN < 0.46 && isGrassSurface) {
              const flowerType = this.hash3(wx * 9.6, 6, wz * 8.2) < 0.5 ? BlockType.FLOWER_TULIP_PINK : BlockType.FLOWER_ALLIUM;
              chunk.setBlock(x, surfaceY + 1, z, flowerType);
            } else if (coverN < 0.70 && isGrassSurface) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.82 && this.hash3(wx * 7.7, 2, wz * 6.8) < 0.4) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.CHERRY_LEAVES);
            }
            break;
          }
          case BiomeType.SNOW:
          case BiomeType.ICE_SPIKES: {
            if (coverN < 0.22) {
              chunk.setBlock(x, surfaceY + 1, z, BlockType.SNOW);
            }
            break;
          }
          case BiomeType.MUSHROOM_ISLAND: {
            if (isGrassSurface && coverN < 0.32) {
              chunk.setBlock(x, surfaceY + 1, z, this.hash3(wx * 5.5, 2, wz * 6.2) < 0.5 ? BlockType.MUSHROOM_RED : BlockType.MUSHROOM_BROWN);
            }
            break;
          }
          case BiomeType.MOUNTAINS:
          case BiomeType.MEGA_MOUNTAINS: {
            if (isGrassSurface && surfaceY < 90 && coverN < 0.10) {
              const flowerType = this.hash3(wx * 9.2, 4, wz * 6.7) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, surfaceY + 1, z, flowerType);
            }
            break;
          }
          default:
            break;
        }
      }
    }
  }

  private getSurfaceY(chunk: Chunk, x: number, z: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (chunk.getBlock(x, y, z) !== BlockType.AIR) return y;
    }
    return 0;
  }

  getBiome(worldX: number, worldZ: number): BiomeType {
    const continental = this.noise.fbm2D(worldX, worldZ, 4, 0.5, 2.0, 0.0008);
    const erosion = this.noise.fbm2D(worldX + 1000, worldZ - 1000, 3, 0.5, 2.0, 0.0012);
    const weirdness = this.noise.fbm2D(worldX - 5000, worldZ + 5000, 3, 0.5, 2.0, 0.001);
    const temperature = this.noise.getTemperature(worldX, worldZ);
    const humidity = this.noise.getHumidity(worldX, worldZ);

    if (continental < -0.48) return BiomeType.DEEP_OCEAN;
    if (continental < -0.18) return BiomeType.OCEAN;
    if (continental < 0.0) return BiomeType.BEACH;
    if (temperature > 0.82 && humidity < 0.12) return BiomeType.BADLANDS;
    if (temperature > 0.82 && humidity < 0.18) return BiomeType.DESERT;
    if (temperature > 0.78 && humidity < 0.3) return BiomeType.SAVANNA;
    if (temperature > 0.72 && humidity > 0.72) return BiomeType.JUNGLE;
    if (temperature > 0.32 && temperature < 0.72 && humidity > 0.48 && humidity < 0.82 && continental > 0.15 && continental < 0.42) return BiomeType.MEADOW;
    if (temperature > 0.28 && temperature < 0.58 && humidity > 0.48 && humidity < 0.82 && continental > 0.42) return BiomeType.CHERRY_GROVE;
    if (humidity > 0.9 && temperature > 0.25 && temperature < 0.7 && continental > 0.12) return BiomeType.MUSHROOM_ISLAND;
    if (temperature < 0.2 && humidity > 0.55) return BiomeType.SNOW;
    if (temperature < 0.12 && humidity > 0.7) return BiomeType.ICE_SPIKES;
    if (weirdness > 0.45 && continental > 0.2) return BiomeType.MOUNTAINS;
    if (weirdness > 0.6 && continental > 0.45) return BiomeType.MEGA_MOUNTAINS;
    if (humidity > 0.78 && temperature > 0.45 && temperature < 0.75) return BiomeType.SWAMP;
    if (humidity > 0.68 && temperature < 0.45) return BiomeType.TAIGA;
    if (humidity > 0.58 && temperature < 0.65) return BiomeType.FOREST;
    if (erosion > 0.5 && temperature < 0.65) return BiomeType.DARK_FOREST;
    return BiomeType.PLAINS;
  }

  private getClassicSurfaceBiome(worldX: number, worldZ: number): BiomeType {
    const warpX = this.noise.fbm2D(worldX + 811, worldZ - 377, 2, 0.5, 2.0, 0.0016) * 220;
    const warpZ = this.noise.fbm2D(worldX - 193, worldZ + 547, 2, 0.5, 2.0, 0.0016) * 220;
    const temp = this.noise.getTemperature(worldX + warpX, worldZ + warpZ);
    const hum = this.noise.getHumidity(worldX - warpZ, worldZ + warpX);
    const cont = this.noise.fbm2D(worldX, worldZ, 3, 0.5, 2.0, 0.0006);

    if (cont < -0.3) return BiomeType.DEEP_OCEAN;
    if (cont < -0.05) return BiomeType.OCEAN;
    if (cont < 0.02) return BiomeType.BEACH;

    let best = BiomeType.PLAINS;
    let bestScore = -1;
    for (const [type, cfg] of Object.entries({
      [BiomeType.PLAINS]: { tempRange: [0.35, 0.65], humRange: [0.25, 0.55] },
      [BiomeType.SUNFLOWER_PLAINS]: { tempRange: [0.45, 0.70], humRange: [0.20, 0.45] },
      [BiomeType.FOREST]: { tempRange: [0.30, 0.60], humRange: [0.55, 0.90] },
      [BiomeType.DARK_FOREST]: { tempRange: [0.25, 0.55], humRange: [0.60, 0.95] },
      [BiomeType.DESERT]: { tempRange: [0.72, 1.0], humRange: [0.0, 0.20] },
      [BiomeType.BADLANDS]: { tempRange: [0.80, 1.0], humRange: [0.0, 0.15] },
      [BiomeType.BEACH]: { tempRange: [0.25, 0.85], humRange: [0.15, 0.85] },
      [BiomeType.SNOW]: { tempRange: [0.0, 0.22], humRange: [0.30, 0.70] },
      [BiomeType.ICE_SPIKES]: { tempRange: [0.0, 0.15], humRange: [0.60, 1.0] },
      [BiomeType.JUNGLE]: { tempRange: [0.65, 1.0], humRange: [0.72, 1.0] },
      [BiomeType.MOUNTAINS]: { tempRange: [0.10, 0.50], humRange: [0.20, 0.60] },
      [BiomeType.MEGA_MOUNTAINS]: { tempRange: [0.0, 0.30], humRange: [0.10, 0.50] },
      [BiomeType.SWAMP]: { tempRange: [0.40, 0.70], humRange: [0.80, 1.0] },
      [BiomeType.TAIGA]: { tempRange: [0.08, 0.30], humRange: [0.40, 0.70] },
      [BiomeType.SAVANNA]: { tempRange: [0.62, 0.88], humRange: [0.10, 0.38] },
      [BiomeType.MUSHROOM]: { tempRange: [0.30, 0.60], humRange: [0.90, 1.0] },
      [BiomeType.MEADOW]: { tempRange: [0.25, 0.70], humRange: [0.45, 0.85] },
      [BiomeType.CHERRY_GROVE]: { tempRange: [0.28, 0.58], humRange: [0.45, 0.78] },
      [BiomeType.ORANGE_GROVE]: { tempRange: [0.55, 0.80], humRange: [0.35, 0.60] },
      [BiomeType.MUSHROOM_ISLAND]: { tempRange: [0.30, 0.60], humRange: [0.88, 1.0] },
      [BiomeType.VOLCANIC]: { tempRange: [0.85, 1.0], humRange: [0.60, 1.0] },
    } as Record<BiomeType, { tempRange: [number, number]; humRange: [number, number] }>)) {
      const t0 = cfg.tempRange[0];
      const t1 = cfg.tempRange[1];
      const h0 = cfg.humRange[0];
      const h1 = cfg.humRange[1];
      const ts = Math.max(0, 1 - Math.abs(temp - (t0 + t1) / 2) / ((t1 - t0) / 2));
      const hs = Math.max(0, 1 - Math.abs(hum - (h0 + h1) / 2) / ((h1 - h0) / 2));
      const sc = ts * hs;
      if (sc > bestScore) {
        bestScore = sc;
        best = type as BiomeType;
      }
    }

    return best;
  }

  private getSurfaceHeight(worldX: number, worldZ: number, biome: BiomeType): number {
    const continent = this.noise.fbm2D(worldX, worldZ, 5, 0.5, 2.0, 0.00045);
    const hills = this.noise.fbm2D(worldX, worldZ, 5, 0.5, 2.0, 0.008);
    const detail = this.noise.fbm2D(worldX, worldZ, 4, 0.5, 2.0, 0.022);
    const ridges = 1 - Math.abs(this.noise.fbm2D(worldX + 240, worldZ - 240, 4, 0.55, 2.0, 0.008));
    const spikes = Math.max(0, this.noise.fbm2D(worldX - 1800, worldZ + 2200, 4, 0.55, 2.0, 0.014));
    const basin = Math.abs(this.noise.fbm2D(worldX + 8000, worldZ - 5000, 3, 0.5, 2.0, 0.0022));
    const terraces = Math.floor((64 + continent * 30 + hills * 16 + detail * 8) / 3) * 3;

    let base = terraces + ridges * 22 + spikes * 24 + 4;
    if (biome === BiomeType.MOUNTAINS) base += ridges * 30 + spikes * 18;
    if (biome === BiomeType.MEGA_MOUNTAINS) base += ridges * 52 + spikes * 24;
    if (biome === BiomeType.OCEAN) base -= 18;
    if (biome === BiomeType.DEEP_OCEAN) base -= 34;
    if (biome === BiomeType.BEACH) base -= 6;
    if (biome === BiomeType.SWAMP) base -= 5;
    if (biome === BiomeType.MEADOW) base += ridges * 4 + spikes * 3;
    if (biome === BiomeType.CHERRY_GROVE) base += ridges * 5 + spikes * 4;
    if (biome === BiomeType.MUSHROOM_ISLAND) base += 2;
    if (biome === BiomeType.VOLCANIC) base += ridges * 20 + spikes * 14;
    if (biome === BiomeType.DESERT || biome === BiomeType.BADLANDS) base += basin > 0.7 ? 8 : -2;

    const riverBand = this.noise.fbm2D(worldX * 0.0018 + 4100, worldZ * 0.0018 - 4100, 4, 0.55, 2.0, 0.0012);
    const river = 1 - Math.abs(riverBand);
    const pond = this.noise.fbm2D(worldX * 0.0105 - 900, worldZ * 0.0105 + 900, 3, 0.55, 2.0, 0.0085);
    if (biome !== BiomeType.DESERT && biome !== BiomeType.BADLANDS && biome !== BiomeType.VOLCANIC) {
      if (river > 0.86) base = Math.min(base, SEA_LEVEL - 1 - Math.floor((river - 0.86) * 16));
      else if (pond > 0.72) base = Math.min(base, SEA_LEVEL - 2 - Math.floor((pond - 0.72) * 10));
    }

    const sinkhole = Math.max(0, basin - 0.68) * 42;
    const rough = this.noise.fbm2D(worldX, worldZ, 3, 0.5, 2.0, 0.03) * 4;

    return Math.max(2, Math.min(CHUNK_HEIGHT - 4, Math.floor(base + rough - sinkhole)));
  }

  private getBlendedSurfaceHeight(worldX: number, worldZ: number): number {
    const BLEND_R = 18;
    let totalHeight = 0;
    let totalWeight = 0;

    for (let sx = -BLEND_R; sx <= BLEND_R; sx += 4) {
      for (let sz = -BLEND_R; sz <= BLEND_R; sz += 4) {
        const dist = Math.sqrt(sx * sx + sz * sz);
        const weight = Math.exp(-(dist * dist) / (BLEND_R * BLEND_R * 0.5));
        const sampleX = worldX + sx;
        const sampleZ = worldZ + sz;
        const biome = this.getBiome(sampleX, sampleZ);
        const baseHeight = this.getSurfaceHeight(sampleX, sampleZ, biome);
        const cliffMask = Math.abs(this.noise.fbm2D(sampleX, sampleZ, 4, 0.55, 2.0, 0.02));
        const dramaticBoost =
          biome === BiomeType.MOUNTAINS ? cliffMask * 10 :
          biome === BiomeType.MEGA_MOUNTAINS ? cliffMask * 18 :
          biome === BiomeType.VOLCANIC ? cliffMask * 8 :
          0;
        totalHeight += (baseHeight + dramaticBoost) * weight;
        totalWeight += weight;
      }
    }

    return Math.max(2, Math.min(CHUNK_HEIGHT - 4, Math.floor(totalHeight / totalWeight)));
  }

  private hash3(x: number, y: number, z: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.3) * 43758.5453;
    return n - Math.floor(n);
  }
}

let newGenerationTerrain: NewGenerationTerrainGenerator | null = null;

export function getNewGenerationTerrainGenerator(seed?: number): NewGenerationTerrainGenerator {
  if (!newGenerationTerrain || seed !== undefined) {
    newGenerationTerrain = new NewGenerationTerrainGenerator(seed ?? Date.now());
  }
  return newGenerationTerrain;
}
