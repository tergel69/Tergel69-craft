import { Chunk } from './Chunk';
import { BlockType } from '@/data/blocks';
import {
  ABYSS_BAND_Y,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  DEEP_CAVE_BAND_Y,
  MAX_WORLD_Y,
  MIN_WORLD_Y,
  SEA_LEVEL,
  SURFACE_BAND_MAX_Y,
} from '@/utils/constants';
import { localYToWorldY, worldYToLocalY } from '@/utils/coordinates';
import { NoiseGenerator, getWorldNoise, resetWorldNoise } from '@/utils/noise';
import { BiomeType } from './TerrainGenerator';
import { DEFAULT_BIOME_CONFIGS_V2 } from '@/worldgen/preset';

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
  [BiomeType.DESERT]: { surface: BlockType.SAND, subsurface: BlockType.SANDSTONE, filler: BlockType.SANDSTONE },
  [BiomeType.BEACH]: { surface: BlockType.SAND, subsurface: BlockType.SAND, filler: BlockType.SANDSTONE },
  [BiomeType.BADLANDS]: { surface: BlockType.RED_SAND, subsurface: BlockType.TERRACOTTA, filler: BlockType.TERRACOTTA },
  [BiomeType.MEADOW]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.CHERRY_GROVE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MUSHROOM_ISLAND]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.SNOW]: { surface: BlockType.SNOW, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.ICE_SPIKES]: { surface: BlockType.SNOW, subsurface: BlockType.ICE, filler: BlockType.STONE },
  [BiomeType.JUNGLE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MOUNTAINS]: { surface: BlockType.STONE, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.MEGA_MOUNTAINS]: { surface: BlockType.STONE, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.SWAMP]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.CLAY ?? BlockType.DIRT },
  [BiomeType.TAIGA]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.SAVANNA]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.MUSHROOM]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
  [BiomeType.OCEAN]: { surface: BlockType.SAND, subsurface: BlockType.SAND, filler: BlockType.STONE },
  [BiomeType.DEEP_OCEAN]: { surface: BlockType.GRAVEL ?? BlockType.STONE, subsurface: BlockType.STONE, filler: BlockType.STONE },
  [BiomeType.VOLCANIC]: { surface: BlockType.BASALT, subsurface: BlockType.NETHERRACK, filler: BlockType.OBSIDIAN },
  [BiomeType.ORANGE_GROVE]: { surface: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
};

const MYTHIC_BIOME_BY_TERRAIN: Partial<Record<BiomeType, keyof typeof DEFAULT_BIOME_CONFIGS_V2>> = {
  [BiomeType.MEGA_MOUNTAINS]: 'stormpeak_highlands',
  [BiomeType.VOLCANIC]: 'ember_caldera',
  [BiomeType.FOREST]: 'skyroot_forest',
  [BiomeType.DARK_FOREST]: 'skyroot_forest',
  [BiomeType.BADLANDS]: 'shattered_badlands',
  [BiomeType.SAVANNA]: 'blooming_giantsteppe',
  [BiomeType.MEADOW]: 'blooming_giantsteppe',
  [BiomeType.ICE_SPIKES]: 'crystal_barrens',
  [BiomeType.SNOW]: 'moonfrost_tundra',
  [BiomeType.SWAMP]: 'sunken_hollow_basin',
  [BiomeType.OCEAN]: 'sunken_hollow_basin',
  [BiomeType.DEEP_OCEAN]: 'sunken_hollow_basin',
};

export class NewGenerationTerrainGenerator {
  private noise: NoiseGenerator;

  constructor(seed: number = Date.now()) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed ^ 0x7f4a7c15);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    const surfaceHeights: number[][] = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(SEA_LEVEL));
    const biomes: BiomeType[][] = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(BiomeType.PLAINS));

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const biome = this.getBiome(wx, wz);
        const surfaceY = this.getSurfaceHeight(wx, wz, biome);
        biomes[x][z] = biome;
        surfaceHeights[x][z] = surfaceY;

        for (let localY = 0; localY < CHUNK_HEIGHT; localY++) {
          const worldY = localYToWorldY(localY);
          const block = this.getBlockForPoint(wx, worldY, wz, surfaceY, biome);
          chunk.setBlock(x, localY, z, block);
        }
      }
    }

    this.decorateSurface(chunk, worldX, worldZ, surfaceHeights, biomes);
    this.generateOres(chunk, worldX, worldZ);
    return chunk;
  }

  private generateOres(chunk: Chunk, worldX: number, worldZ: number): void {
    const ores = [
      { block: BlockType.COAL_ORE, minY: -64, maxY: 192, size: 8, count: 20, threshold: 0.68 },
      { block: BlockType.IRON_ORE, minY: -128, maxY: 64, size: 7, count: 15, threshold: 0.72 },
      { block: BlockType.GOLD_ORE, minY: -256, maxY: 32, size: 5, count: 9, threshold: 0.78 },
      { block: BlockType.DIAMOND_ORE, minY: -480, maxY: -128, size: 4, count: 5, threshold: 0.86 },
      { block: BlockType.EMERALD_ORE, minY: -320, maxY: -64, size: 3, count: 3, threshold: 0.92 },
      { block: BlockType.LAPIS_ORE, minY: -192, maxY: 64, size: 6, count: 7, threshold: 0.76 },
      { block: BlockType.REDSTONE_ORE, minY: -384, maxY: 0, size: 7, count: 12, threshold: 0.74 },
      { block: BlockType.COPPER_ORE, minY: -64, maxY: 128, size: 9, count: 16, threshold: 0.70 },
    ];

    for (const ore of ores) {
      for (let i = 0; i < ore.count; i++) {
        const rx = Math.floor(this.noise.fbm2D(worldX + i * 17, worldZ + i * 23, 1, 0.5, 2.0, 0.05) * CHUNK_SIZE);
        const rz = Math.floor(this.noise.fbm2D(worldX + i * 31, worldZ + i * 41, 1, 0.5, 2.0, 0.05) * CHUNK_SIZE);
        const ry = ore.minY + Math.floor(this.noise.fbm2D(worldX + i * 53, worldZ + i * 61, 1, 0.5, 2.0, 0.05) * (ore.maxY - ore.minY));

        if (rx < 1 || rx >= CHUNK_SIZE - 1 || rz < 1 || rz >= CHUNK_SIZE - 1) continue;

        const localY = worldYToLocalY(ry);
        if (localY < 0 || localY >= CHUNK_HEIGHT) continue;

        if (this.noise.fbm3D(worldX + rx, ry, worldZ + rz, 2, 0.5, 2.0, 0.1) > ore.threshold) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dz = -1; dz <= 1; dz++) {
                const lx = rx + dx;
                const ly = localY + dy;
                const lz = rz + dz;
                if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
                  if (this.noise.fbm3D(lx + i, ly, lz + i, 1, 0.5, 2.0, 0.2) < 0.65) {
                    const current = chunk.getBlock(lx, ly, lz);
                    if (current === BlockType.STONE || current === BlockType.DEEPSLATE || current === BlockType.TUFF) {
                      chunk.setBlock(lx, ly, lz, ore.block);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private getBlockForPoint(wx: number, worldY: number, wz: number, surfaceY: number, biome: BiomeType): BlockType {
    if (worldY === MIN_WORLD_Y) return BlockType.BEDROCK;

    if (worldY > surfaceY) {
      return worldY <= SEA_LEVEL && surfaceY < SEA_LEVEL
        ? this.isFrozen(biome) && worldY === SEA_LEVEL ? BlockType.ICE : BlockType.WATER
        : BlockType.AIR;
    }

    const config = this.getSurfaceConfig(biome);
    const depth = surfaceY - worldY;

    if (this.isCarvedCave(wx, worldY, wz, surfaceY, biome)) {
      if (worldY <= MIN_WORLD_Y + 18) return BlockType.LAVA;
      if (worldY < ABYSS_BAND_Y && this.noise.fbm3D(wx, worldY, wz, 2, 0.5, 2.0, 0.02) > 0.35) return BlockType.LAVA;
      if (worldY <= SEA_LEVEL - 10 && worldY > DEEP_CAVE_BAND_Y && this.noise.fbm3D(wx, worldY, wz, 2, 0.5, 2.0, 0.015) > 0.48) return BlockType.WATER;
      return BlockType.AIR;
    }

    if (depth === 0) {
      if (biome === BiomeType.MEGA_MOUNTAINS && worldY > 520) return BlockType.SNOW;
      if (biome === BiomeType.VOLCANIC && worldY > SEA_LEVEL + 40) return BlockType.OBSIDIAN;
      return config.surface;
    }

    if (depth < 4) return config.subsurface;

    if (worldY < DEEP_CAVE_BAND_Y) {
      return biome === BiomeType.VOLCANIC ? BlockType.BASALT : (BlockType.DEEPSLATE ?? BlockType.STONE);
    }

    if (worldY < -96 && this.noise.fbm3D(wx, worldY, wz, 3, 0.55, 2.0, 0.025) > 0.62) {
      return BlockType.TUFF ?? config.filler;
    }

    return config.filler;
  }

  private isCarvedCave(wx: number, worldY: number, wz: number, surfaceY: number, biome: BiomeType): boolean {
    if (worldY >= surfaceY - 3) return false;

    const tunnel = this.noise.getCaveNoise(wx, worldY, wz);
    const cathedral = this.noise.fbm3D(wx * 0.6, worldY * 0.8, wz * 0.6, 4, 0.52, 2.0, 0.01);
    const shafts = this.noise.fbm2D(wx * 0.004, wz * 0.004, 3, 0.55, 2.0, 0.002);
    const abyss = this.noise.fbm3D(wx * 0.35, worldY * 0.6, wz * 0.35, 3, 0.5, 2.0, 0.008);
    const river = 1 - Math.abs(this.noise.fbm2D(wx * 0.002 + 1400, wz * 0.002 - 1400, 3, 0.55, 2.0, 0.0015));

    // Get cave thresholds from mythic biome config if available
    let caveThresholds = { upper: 0.63, cathedral: 0.22, deep: 0.56, abyss: 0.12 };
    const mythicId = MYTHIC_BIOME_BY_TERRAIN[biome];
    if (mythicId && DEFAULT_BIOME_CONFIGS_V2[mythicId]) {
      const biomeConfig = DEFAULT_BIOME_CONFIGS_V2[mythicId];
      // Adjust thresholds based on biome erosion resistance
      const erosionFactor = 1 - biomeConfig.terrain.erosionResistance;
      caveThresholds.upper = 0.63 - (erosionFactor * 0.08);
      caveThresholds.cathedral = 0.22 - (erosionFactor * 0.06);
      caveThresholds.deep = 0.56 - (erosionFactor * 0.1);
      caveThresholds.abyss = 0.12 - (erosionFactor * 0.04);
    }

    const upperCaves = worldY > -80 && tunnel > caveThresholds.upper;
    const midCathedrals = worldY <= -80 && worldY > DEEP_CAVE_BAND_Y && cathedral > caveThresholds.cathedral;
    const deepFaults = worldY <= DEEP_CAVE_BAND_Y && worldY > ABYSS_BAND_Y && (tunnel > caveThresholds.deep || cathedral > caveThresholds.cathedral * 0.45);
    const abyssCaverns = worldY <= ABYSS_BAND_Y && abyss > caveThresholds.abyss;
    const heroShaft = shafts > 0.7 && Math.abs((wx + wz) % 19) < 3;
    const riverChasm = river > 0.88 && worldY > SEA_LEVEL - 120 && worldY < surfaceY - 8;

    if (biome === BiomeType.VOLCANIC && worldY < SEA_LEVEL + 40 && tunnel > 0.52) return true;

    return upperCaves || midCathedrals || deepFaults || abyssCaverns || heroShaft || riverChasm;
  }

  getBiome(worldX: number, worldZ: number): BiomeType {
    const temperature = this.noise.getTemperature(worldX, worldZ);
    const humidity = this.noise.getHumidity(worldX, worldZ);
    const continentalness = this.noise.fbm2D(worldX, worldZ, 4, 0.5, 2.0, 0.00055);
    const weirdness = this.noise.fbm2D(worldX + 2800, worldZ - 1800, 4, 0.5, 2.0, 0.0014);
    const volcanic = this.noise.fbm2D(worldX - 7200, worldZ + 5100, 3, 0.55, 2.0, 0.0018);

    if (continentalness < -0.55) return BiomeType.DEEP_OCEAN;
    if (continentalness < -0.18) return BiomeType.OCEAN;
    if (continentalness < -0.08) return BiomeType.BEACH;
    if (volcanic > 0.62 && temperature > 0.7) return BiomeType.VOLCANIC;
    if (weirdness > 0.56 && continentalness > 0.2) return BiomeType.MEGA_MOUNTAINS;
    if (weirdness > 0.32 && continentalness > 0.08) return BiomeType.MOUNTAINS;
    if (temperature < 0.18 && humidity > 0.58) return BiomeType.SNOW;
    if (temperature > 0.8 && humidity < 0.2) return BiomeType.BADLANDS;
    if (temperature > 0.72 && humidity < 0.28) return BiomeType.DESERT;
    if (temperature > 0.66 && humidity > 0.72) return BiomeType.JUNGLE;
    if (humidity > 0.78 && temperature > 0.35 && temperature < 0.7) return BiomeType.SWAMP;
    if (temperature < 0.32 && humidity > 0.45) return BiomeType.TAIGA;
    if (humidity > 0.62 && continentalness > 0.18) return BiomeType.FOREST;
    if (continentalness > 0.38 && temperature > 0.22 && temperature < 0.62) return BiomeType.MEADOW;
    return BiomeType.PLAINS;
  }

  private getSurfaceHeight(worldX: number, worldZ: number, biome: BiomeType): number {
    const continentalness = this.noise.fbm2D(worldX, worldZ, 5, 0.5, 2.0, 0.00042);
    const erosion = this.noise.fbm2D(worldX + 4100, worldZ - 1700, 4, 0.5, 2.0, 0.0011);
    const peaksValleys = this.noise.fbm2D(worldX - 5100, worldZ + 3300, 4, 0.5, 2.0, 0.0016);
    const ridgeSharpness = 1 - Math.abs(this.noise.fbm2D(worldX * 0.8, worldZ * 0.8, 4, 0.55, 2.0, 0.003));
    const weirdness = this.noise.fbm2D(worldX + 9000, worldZ - 9000, 3, 0.5, 2.0, 0.0038);
    const volcanic = this.noise.fbm2D(worldX - 7200, worldZ + 5100, 3, 0.55, 2.0, 0.0018);
    const ancientDepth = this.noise.fbm2D(worldX + 13000, worldZ + 8000, 3, 0.5, 2.0, 0.0009);

    let base = SEA_LEVEL + continentalness * 180;

    // Apply BiomeConfigV2 terrain parameters
    const mythicId = MYTHIC_BIOME_BY_TERRAIN[biome];
    if (mythicId && DEFAULT_BIOME_CONFIGS_V2[mythicId]) {
      const biomeConfig = DEFAULT_BIOME_CONFIGS_V2[mythicId];
      const { terrain } = biomeConfig;

      base += terrain.baseHeight;
      base += peaksValleys * terrain.heightVariance;
      base += Math.max(0, peaksValleys) * terrain.mountainBoost;
      base += ridgeSharpness * ridgeSharpness * terrain.cliffBias * 134;
      base += erosion * (52 * (1 - terrain.erosionResistance));
      base += weirdness * 28;
    } else {
      // Fallback for biomes without mythic config
      base += erosion * 52;
      base += peaksValleys * 34;
      base += ridgeSharpness * ridgeSharpness * 110;
      base += weirdness * 28;

      if (biome === BiomeType.MOUNTAINS) {
        base += 180 + Math.max(0, peaksValleys) * 160 + ridgeSharpness * 90;
      } else if (biome === BiomeType.MEGA_MOUNTAINS) {
        base += 290 + Math.max(0, peaksValleys) * 240 + ridgeSharpness * 150;
      } else if (biome === BiomeType.VOLCANIC) {
        base += 120 + volcanic * 180 + ridgeSharpness * 70;
      } else if (biome === BiomeType.DEEP_OCEAN) {
        base -= 240 + ancientDepth * 120;
      } else if (biome === BiomeType.OCEAN) {
        base -= 120;
      } else if (biome === BiomeType.BEACH || biome === BiomeType.SWAMP) {
        base -= 32;
      } else if (biome === BiomeType.MEADOW) {
        base += 48;
      }
    }

    const heroZone = this.noise.fbm2D(worldX - 15000, worldZ + 11000, 2, 0.55, 2.0, 0.00035);
    if (heroZone > 0.72) {
      base += 80 + ridgeSharpness * 140;
    } else if (heroZone < -0.74) {
      base -= 120;
    }

    return Math.max(MIN_WORLD_Y + 8, Math.min(MAX_WORLD_Y - 8, Math.floor(base)));
  }

  private decorateSurface(
    chunk: Chunk,
    worldX: number,
    worldZ: number,
    surfaceHeights: number[][],
    biomes: BiomeType[][]
  ): void {
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      for (let z = 1; z < CHUNK_SIZE - 1; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const surfaceY = surfaceHeights[x][z];
        const biome = biomes[x][z];
        if (surfaceY <= SEA_LEVEL || surfaceY >= SURFACE_BAND_MAX_Y + 220) continue;

        const localSurfaceY = worldYToLocalY(surfaceY);
        const placeY = localSurfaceY + 1;
        if (placeY >= CHUNK_HEIGHT) continue;

        const coverNoise = this.noise.fbm2D(wx * 0.03, wz * 0.03, 2, 0.5, 2.0, 0.02);
        const spireNoise = this.noise.fbm2D(wx * 0.009, wz * 0.009, 2, 0.5, 2.0, 0.006);
        const treeNoise = this.noise.fbm2D(wx * 0.008, wz * 0.008, 3, 0.5, 2.0, 0.007);

        if ((biome === BiomeType.MOUNTAINS || biome === BiomeType.MEGA_MOUNTAINS) && spireNoise > 0.76) {
          const height = biome === BiomeType.MEGA_MOUNTAINS ? 20 : 12;
          for (let i = 1; i <= height && placeY + i < CHUNK_HEIGHT; i++) {
            chunk.setBlock(x, placeY + i - 1, z, i < height - 2 ? BlockType.STONE : BlockType.SNOW);
          }
          continue;
        }

        if (biome === BiomeType.VOLCANIC && spireNoise > 0.7) {
          const height = 16;
          for (let i = 1; i <= height && placeY + i < CHUNK_HEIGHT; i++) {
            chunk.setBlock(x, placeY + i - 1, z, i < height - 3 ? BlockType.BASALT : BlockType.OBSIDIAN);
          }
          continue;
        }

        // Tree placement
        let treeType: string | null = null;
        if (treeNoise > 0.78) {
          switch (biome) {
            case BiomeType.FOREST: treeType = 'oak'; break;
            case BiomeType.DARK_FOREST: treeType = 'dark_oak'; break;
            case BiomeType.JUNGLE: treeType = 'jungle'; break;
            case BiomeType.TAIGA: treeType = 'spruce'; break;
            case BiomeType.MEADOW: treeType = this.noise.fbm2D(wx, wz, 1, 0.5, 2.0, 0.1) > 0.5 ? 'birch' : 'oak'; break;
            case BiomeType.CHERRY_GROVE: treeType = 'cherry'; break;
            case BiomeType.DESERT: treeType = 'cactus'; break;
            case BiomeType.SAVANNA: treeType = 'acacia'; break;
            case BiomeType.ORANGE_GROVE: treeType = 'orange'; break;
          }
        }

        if (treeType && x >= 2 && x <= CHUNK_SIZE - 3 && z >= 2 && z <= CHUNK_SIZE - 3) {
          this.placeTree(chunk, x, placeY, z, treeType, wx, wz);
          continue;
        }

        if (coverNoise > 0.42 && coverNoise < 0.52) {
          chunk.setBlock(x, placeY, z, biome === BiomeType.SNOW ? BlockType.SNOW : BlockType.TALL_GRASS);
        } else if (coverNoise > 0.6 && biome !== BiomeType.DESERT && biome !== BiomeType.BADLANDS) {
          chunk.setBlock(x, placeY, z, coverNoise > 0.72 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW);
        }
      }
    }
  }

  private hash3(x: number, y: number, z: number): number {
    let h = x * 12.9898 + y * 78.233 + z * 37.719;
    h = Math.sin(h) * 43758.5453;
    return h - Math.floor(h);
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number, type: string, wx: number, wz: number): void {
    if (x < 2 || x >= CHUNK_SIZE - 2 || z < 2 || z >= CHUNK_SIZE - 2) return;
    if (y >= CHUNK_HEIGHT - 12) return;
    const seed = this.hash3(wx * 0.91, y * 0.13, wz * 0.73);
    switch (type) {
      case 'oak': this.oakTree(chunk, x, y, z, seed); break;
      case 'birch': this.birchTree(chunk, x, y, z, seed); break;
      case 'spruce': this.spruceTree(chunk, x, y, z, seed); break;
      case 'jungle': this.jungleTree(chunk, x, y, z, seed); break;
      case 'acacia': this.acaciaTree(chunk, x, y, z, seed); break;
      case 'dark_oak': this.darkOakTree(chunk, x, y, z, seed); break;
      case 'cherry': this.cherryTree(chunk, x, y, z, seed); break;
      case 'orange': this.orangeTree(chunk, x, y, z, seed); break;
      case 'cactus': this.cactus(chunk, x, y, z, seed); break;
    }
  }

  private leaf(chunk: Chunk, lx: number, ly: number, lz: number, type: BlockType): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    if (ly < 0 || ly >= CHUNK_HEIGHT) return;
    if (chunk.getBlock(lx, ly, lz) === BlockType.AIR) chunk.setBlock(lx, ly, lz, type);
  }

  private leafSphere(
    chunk: Chunk, cx: number, cy: number, cz: number,
    rx: number, ry: number, rz: number, type: BlockType, seed: number
  ): void {
    const sx = 0.9 + this.hash3(seed * 17.1, cy, cx) * 0.35;
    const sy = 0.8 + this.hash3(seed * 31.7, cz, cy) * 0.4;
    const sz = 0.9 + this.hash3(seed * 47.3, cx, cz) * 0.35;
    const trim = 0.18 + this.hash3(seed * 59.9, cx + cy, cz) * 0.2;

    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        for (let dz = -rz; dz <= rz; dz++) {
          const d = (dx * dx) / (rx * rx * sx) + (dy * dy) / (ry * ry * sy) + (dz * dz) / (rz * rz * sz);
          if (d > 1.0) continue;
          if (d > 0.72 && this.hash3(cx + dx + seed, cy + dy, cz + dz) < trim) continue;
          this.leaf(chunk, cx + dx, cy + dy, cz + dz, type);
        }
      }
    }
  }

  private drapeLeaves(
    chunk: Chunk, cx: number, cy: number, cz: number,
    radius: number, maxDrop: number, type: BlockType, seed: number
  ): void {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) < radius) continue;
        if (this.hash3(seed * 13.1, cx + dx, cz + dz) < 0.45) continue;
        const dropLen = 1 + Math.floor(this.hash3(seed * 29.3, cy, cz + dz) * maxDrop);
        for (let d = 0; d < dropLen; d++) {
          this.leaf(chunk, cx + dx, cy - d, cz + dz, type);
        }
      }
    }
  }

  private oakTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 5 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.OAK_LOG);
    const cy = y + h;
    const r = 2 + (seed > 0.4 ? 1 : 0);
    this.leafSphere(chunk, x, cy - 1, z, r, 2, r, BlockType.OAK_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy, z, r + 1, 2, r + 1, BlockType.OAK_LEAVES, seed * 1231);
    this.leafSphere(chunk, x, cy + 1, z, 2, 1, 2, BlockType.OAK_LEAVES, seed * 1459);
    this.drapeLeaves(chunk, x, cy, z, r + 1, 2, BlockType.OAK_LEAVES, seed * 1777);
  }

  private birchTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 6 + Math.floor(seed * 4);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.BIRCH_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy - 2, z, 2, 2, 2, BlockType.BIRCH_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy, z, 2, 2, 2, BlockType.BIRCH_LEAVES, seed * 1231);
    this.drapeLeaves(chunk, x, cy, z, 2, 3, BlockType.BIRCH_LEAVES, seed * 1777);
  }

  private spruceTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 7 + Math.floor(seed * 6);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.SPRUCE_LOG);
    for (let layer = 0; layer < 5; layer++) {
      const ly = y + h - 4 + layer;
      const r = Math.max(1, 3 - layer);
      this.leafSphere(chunk, x, ly, z, r, 1, r, BlockType.SPRUCE_LEAVES, seed * (1000 + layer * 100));
    }
    chunk.setBlock(x, y + h, z, BlockType.SPRUCE_LEAVES);
  }

  private jungleTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 9 + Math.floor(seed * 5);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.JUNGLE_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy - 2, z, 3, 2, 3, BlockType.JUNGLE_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy, z, 2, 2, 2, BlockType.JUNGLE_LEAVES, seed * 1231);
  }

  private acaciaTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 4 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.ACACIA_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy, z, 3, 2, 3, BlockType.ACACIA_LEAVES, seed * 997);
  }

  private darkOakTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 6 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.DARK_OAK_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy - 1, z, 3, 2, 3, BlockType.DARK_OAK_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy + 1, z, 2, 1, 2, BlockType.DARK_OAK_LEAVES, seed * 1231);
  }

  private cherryTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 5 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.CHERRY_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy - 1, z, 3, 2, 3, BlockType.CHERRY_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy, z, 2, 2, 2, BlockType.CHERRY_LEAVES, seed * 1231);
    this.drapeLeaves(chunk, x, cy, z, 3, 2, BlockType.CHERRY_LEAVES, seed * 1777);
  }

  private orangeTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 5 + Math.floor(seed * 2);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.OAK_LOG);
    const cy = y + h;
    this.leafSphere(chunk, x, cy - 1, z, 3, 2, 3, BlockType.OAK_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy, z, 2, 1, 2, BlockType.OAK_LEAVES, seed * 1231);
  }

  private cactus(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 2 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) {
      chunk.setBlock(x, y + i, z, BlockType.CACTUS);
    }
  }

  private isFrozen(biome: BiomeType): boolean {
    return biome === BiomeType.SNOW || biome === BiomeType.ICE_SPIKES;
  }

  private getSurfaceConfig(biome: BiomeType): SurfaceBiomeConfig {
    const mythicId = MYTHIC_BIOME_BY_TERRAIN[biome];
    if (!mythicId) {
      return SURFACE_BIOMES[biome];
    }

    const mythic = DEFAULT_BIOME_CONFIGS_V2[mythicId];
    if (!mythic) {
      return SURFACE_BIOMES[biome];
    }

    return {
      surface: mythic.surface.top,
      subsurface: mythic.surface.subsurface,
      filler: mythic.surface.filler,
    };
  }
}

let newGenerationTerrain: NewGenerationTerrainGenerator | null = null;

export function getNewGenerationTerrainGenerator(seed?: number): NewGenerationTerrainGenerator {
  if (!newGenerationTerrain || seed !== undefined) {
    newGenerationTerrain = new NewGenerationTerrainGenerator(seed ?? Date.now());
  }
  return newGenerationTerrain;
}
