/**
 * TerrainGenerator.ts — Enhanced with:
 *  - Larger-scale, more distinct biomes (temperature/humidity noise at lower frequency)
 *  - Deep cave networks: tunnel caves + open caverns + lava lakes
 *  - Rare underground biomes: Crystal Caves, Mushroom Caverns, Lava Fields
 *  - Enriched ore distribution with depth-based rarity curves
 *  - New ore types: Amethyst, Copper, Tin (uses existing BlockType values, mapped below)
 *  - Cave decoration: stalactites, stalagmites, underground pools
 */

import { Chunk } from './Chunk';
import { BlockType } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '@/utils/constants';
import { NoiseGenerator, getWorldNoise, resetWorldNoise } from '@/utils/noise';

// ============================================
// BIOME SYSTEM
// ============================================

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

export { BiomeType as TerrainBiomeType };

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
    treeDensity: 0.025, minHeight: 63, maxHeight: 70, // Slightly increased for more variety
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
    surfaceBlock: BlockType.RED_SAND ?? BlockType.SAND, subSurfaceBlock: BlockType.TERRACOTTA ?? BlockType.SAND, underBlock: BlockType.STONE,
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
    treeDensity: 0.28, minHeight: 72, maxHeight: 88, // Increased from 0.12 to 0.28 (more than doubled)
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
    treeDensity: 0.005, minHeight: 85, maxHeight: 220, // 1.18-style tall mountains
    tempRange: [0.10, 0.50], humRange: [0.20, 0.60], treeType: 'none',
  },
  [BiomeType.MEGA_MOUNTAINS]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.001, minHeight: 120, maxHeight: 280, // Extremely tall peaks, near world ceiling
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
    surfaceBlock: BlockType.GRAVEL ?? BlockType.STONE, subSurfaceBlock: BlockType.STONE, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 5, maxHeight: 25, // Much deeper - near void, rarely see bottom
    tempRange: [0.15, 0.70], humRange: [0.25, 0.80], treeType: 'none',
  },
  [BiomeType.VOLCANIC]: {
    surfaceBlock: BlockType.OBSIDIAN ?? BlockType.STONE, subSurfaceBlock: BlockType.NETHERRACK ?? BlockType.STONE, underBlock: BlockType.STONE,
    treeDensity: 0.0, minHeight: 62, maxHeight: 90,
    tempRange: [0.85, 1.0], humRange: [0.60, 1.0], treeType: 'none',
  },
  [BiomeType.ORANGE_GROVE]: {
    surfaceBlock: BlockType.GRASS, subSurfaceBlock: BlockType.DIRT, underBlock: BlockType.STONE,
    treeDensity: 0.35, minHeight: 60, maxHeight: 72, // Increased from 0.15 to 0.35 (more than doubled)
    tempRange: [0.55, 0.80], humRange: [0.35, 0.60], treeType: 'orange',
  },
};

// ============================================
// UNDERGROUND BIOME TYPES
// ============================================

enum CaveBiome {
  NORMAL       = 0,  // standard stone cave
  CRYSTAL_CAVE = 1,  // glowstone veins + glass floor
  LAVA_FIELD   = 2,  // lava pools + netherrack patches
  MUSHROOM_CAVE= 3,  // mycelium + glowstone mushroom stumps
  AQUIFER      = 4,  // underground water rooms
}

// ============================================
// TERRAIN GENERATOR
// ============================================

export class TerrainGenerator {
  private noise: NoiseGenerator;

  constructor(seed: number = 12345) {
    resetWorldNoise();
    this.noise = getWorldNoise(seed);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk   = new Chunk(cx, cz);
    const worldX  = cx * CHUNK_SIZE;
    const worldZ  = cz * CHUNK_SIZE;

    const heightMap = this.buildHeightMap(worldX, worldZ);
    this.fillTerrain(chunk, worldX, worldZ, heightMap);
    this.carveCaves(chunk, worldX, worldZ, heightMap);
    this.addOres(chunk, worldX, worldZ, heightMap);
    this.decorateUnderground(chunk, worldX, worldZ, heightMap);
    this.decorateSurface(chunk, worldX, worldZ, heightMap);
    return chunk;
  }

  // ── Biome selection ────────────────────────────────────────────────────────

  getBiome(x: number, z: number): BiomeType {
    // Domain warping creates large, connected biome regions with smoother borders.
    const warpX = this.noise.fbm2D(x + 811, z - 377, 2, 0.5, 2.0, 0.0016) * 220;
    const warpZ = this.noise.fbm2D(x - 193, z + 547, 2, 0.5, 2.0, 0.0016) * 220;
    const temp = this.noise.getTemperature(x + warpX, z + warpZ);
    const hum  = this.noise.getHumidity(x - warpZ, z + warpX);
    // Continent scale
    const cont = this.noise.fbm2D(x, z, 3, 0.5, 2.0, 0.0006);

    if (cont < -0.42) return BiomeType.DEEP_OCEAN;
    if (cont < -0.12) return BiomeType.OCEAN;
    if (cont < 0.0) return BiomeType.BEACH;
    if (temp > 0.82 && hum < 0.12) return BiomeType.BADLANDS;
    if (temp > 0.32 && temp < 0.72 && hum > 0.48 && hum < 0.82 && cont > 0.15 && cont < 0.42) return BiomeType.MEADOW;
    if (temp > 0.28 && temp < 0.58 && hum > 0.48 && hum < 0.82 && cont > 0.42) return BiomeType.CHERRY_GROVE;
    if (temp > 0.55 && temp < 0.80 && hum > 0.35 && hum < 0.60 && cont > 0.18) return BiomeType.ORANGE_GROVE;
    if (hum > 0.9 && temp > 0.25 && temp < 0.7 && cont > 0.12) return BiomeType.MUSHROOM_ISLAND;

    // Match surface biomes — exclude extreme biomes from common selection
    // by weighting them lower (they need both temp AND humidity extremes)
    let best = BiomeType.PLAINS, bestScore = -1;
    for (const [type, cfg] of Object.entries(BIOMES) as [BiomeType, BiomeConfig][]) {
      if (type === BiomeType.OCEAN || type === BiomeType.DEEP_OCEAN) continue;
      const ts = rangeFit(temp, cfg.tempRange);
      const hs = rangeFit(hum,  cfg.humRange);
      const sc = ts * hs;
      if (sc > bestScore) { bestScore = sc; best = type; }
    }
    return best;
  }

  // ── Height map — biome-blended to prevent cliff walls ─────────────────────

  /** Compute the raw noise-driven height for a single world position within a biome */
  private rawHeight(wx: number, wz: number, biome: BiomeType): number {
    const cfg = BIOMES[biome];
    
    // 1.18-style multi-noise terrain system
    // Continentalness - determines land vs ocean (large scale)
    const continentalness = this.noise.fbm2D(wx, wz, 3, 0.5, 2.0, 0.0004) * 0.5 + 0.25;
    
    // Erosion - flat vs rough terrain (medium scale)
    const erosion = this.noise.fbm2D(wx, wz, 3, 0.5, 2.0, 0.003) * 0.5 + 0.25;
    
    // Weirdness - peaks vs valleys (affects mountain sharpness)
    const weirdness = this.noise.fbm2D(wx, wz, 4, 0.5, 2.0, 0.006) * 0.5;
    
    // Base terrain variation (small scale)
    let h = this.noise.fbm2D(wx, wz, 6, 0.5, 2.0, 0.006);
    
    // Combine continentalness with erosion for base height
    h = h * 0.4 + continentalness * 0.35 + erosion * 0.25;

    // Apply weirdness for 1.18-style mountains and valleys
    if (biome === BiomeType.MOUNTAINS || biome === BiomeType.MEGA_MOUNTAINS) {
      // Strong weirdness creates tall peaks
      const peakFactor = weirdness > 0 ? Math.pow(weirdness + 0.3, 1.5) * 1.8 : 0;
      const valleyFactor = weirdness < 0 ? Math.pow(Math.abs(weirdness) + 0.3, 1.3) * 0.5 : 0;
      
      // Add ridge noise for sharper peaks
      const ridge = Math.abs(this.noise.fbm2D(wx * 1.5, wz * 1.5, 4, 0.6, 2.0, 0.01));
      const peak = Math.pow(Math.max(0, this.noise.fbm2D(wx, wz, 5, 0.6, 2.0, 0.008)), 1.8);
      
      h += peakFactor + peak * (biome === BiomeType.MEGA_MOUNTAINS ? 0.8 : 0.5) + ridge * 0.3 - valleyFactor;
    }
    
    if (biome === BiomeType.VOLCANIC) {
      // Volcanic areas have sharp ridges
      const ridge = Math.abs(this.noise.fbm2D(wx, wz, 3, 0.6, 2.0, 0.018));
      h += ridge * 0.6 + weirdness * 0.4;
    }
    
    // Ocean gets deeper with weirdness
    if (biome === BiomeType.OCEAN || biome === BiomeType.DEEP_OCEAN) {
      h -= 0.3 - weirdness * 0.15;
    }
    
    // Swamp and beach are always low
    if (biome === BiomeType.SWAMP) h = h * 0.2 + weirdness * 0.1;
    if (biome === BiomeType.BEACH) h = h * 0.15 + weirdness * 0.05;
    
    // Meadow and cherry grove get elevation variation
    if (biome === BiomeType.MEADOW) h = h * 0.5 + weirdness * 0.15 + 0.1;
    if (biome === BiomeType.CHERRY_GROVE) h = h * 0.5 + weirdness * 0.1 + 0.05;
    if (biome === BiomeType.MUSHROOM_ISLAND) h = h * 0.25 + 0.15;
    
    // Extreme mountains can reach much higher
    const range = cfg.maxHeight - cfg.minHeight;
    const baseHeight = cfg.minHeight + (h * 0.5 + 0.5) * range;
    
    // Apply weirdness influence for mountain biomes
    if (biome === BiomeType.MOUNTAINS) {
      return baseHeight + Math.max(0, weirdness) * 100; // Tall peaks up to +100 blocks
    }
    
    if (biome === BiomeType.MEGA_MOUNTAINS) {
      // MEGA mountains have extreme peaks - up to 200 blocks higher
      return baseHeight + Math.max(0, weirdness) * 200; // Almost reach world ceiling
    }
    
    return baseHeight;
  }

  private getHydrology(wx: number, wz: number): { river: number; pond: number } {
    const riverBand = this.noise.fbm2D(wx * 0.0018 + 4100, wz * 0.0018 - 4100, 4, 0.55, 2.0, 0.0012);
    const river = 1 - Math.abs(riverBand);
    const pond = this.noise.fbm2D(wx * 0.0105 - 900, wz * 0.0105 + 900, 3, 0.55, 2.0, 0.0085);
    return { river, pond };
  }

  private isFrozenBiome(biome: BiomeType): boolean {
    return biome === BiomeType.SNOW || biome === BiomeType.ICE_SPIKES;
  }

  private getBiomeBlendData(wx: number, wz: number): { primary: BiomeType; secondary: BiomeType; mix: number } {
    const BLEND_R = 16;
    const biomeWeights = new Map<BiomeType, number>();

    for (let sx = -BLEND_R; sx <= BLEND_R; sx += 4) {
      for (let sz = -BLEND_R; sz <= BLEND_R; sz += 4) {
        const dist = Math.sqrt(sx * sx + sz * sz);
        const weight = Math.exp(-(dist * dist) / (BLEND_R * BLEND_R * 0.5));
        const biome = this.getBiome(wx + sx, wz + sz);
        biomeWeights.set(biome, (biomeWeights.get(biome) ?? 0) + weight);
      }
    }

    const sorted = Array.from(biomeWeights.entries()).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0]?.[0] ?? BiomeType.PLAINS;
    const secondary = sorted[1]?.[0] ?? primary;
    const primaryW = sorted[0]?.[1] ?? 1;
    const secondaryW = sorted[1]?.[1] ?? 0;
    const total = primaryW + secondaryW;
    const mix = total > 0 ? Math.max(0, Math.min(1, secondaryW / total)) : 0;

    return { primary, secondary, mix };
  }

  private buildHeightMap(worldX: number, worldZ: number): number[][] {
    const map: number[][] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      map[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x, wz = worldZ + z;
        const blend = this.getBiomeBlendData(wx, wz);
        const primaryHeight = this.rawHeight(wx, wz, blend.primary);
        const secondaryHeight = blend.secondary === blend.primary ? primaryHeight : this.rawHeight(wx, wz, blend.secondary);
        const mix = blend.secondary === blend.primary ? 0 : Math.min(0.75, Math.max(0.15, blend.mix));
        const blendedH = primaryHeight * (1 - mix) + secondaryHeight * mix;
        const biome = mix > 0.5 ? blend.secondary : blend.primary;
        const hydrology = this.getHydrology(wx, wz);
        let adjusted = blendedH;
        
        // ENHANCED: Rivers carve deeper into terrain for more dramatic effect
        if (hydrology.river > 0.82 && biome !== BiomeType.DESERT && biome !== BiomeType.BADLANDS && biome !== BiomeType.VOLCANIC) {
          // Deeper river carving - rivers go 3-6 blocks below surface
          const riverDepth = 3 + Math.floor((hydrology.river - 0.82) * 25);
          adjusted = Math.min(adjusted, SEA_LEVEL - riverDepth);
        }
        
        // ENHANCED: Ponds carve into terrain for small lakes
        if (hydrology.pond > 0.68 && biome !== BiomeType.DESERT && biome !== BiomeType.BADLANDS && biome !== BiomeType.VOLCANIC) {
          // Pond depth varies based on pond noise
          const pondDepth = 2 + Math.floor((hydrology.pond - 0.68) * 12);
          adjusted = Math.min(adjusted, SEA_LEVEL - pondDepth);
        }
        map[x][z] = clamp(Math.floor(adjusted), 2, CHUNK_HEIGHT - 4);
      }
    }
    return map;
  }

  // ── Terrain fill ───────────────────────────────────────────────────────────

  private fillTerrain(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h   = hm[x][z];
        const wx  = worldX + x, wz = worldZ + z;
        const blend = this.getBiomeBlendData(wx, wz);
        const bio = blend.mix > 0.45 ? blend.secondary : blend.primary;
        const cfg = BIOMES[bio];
        const frozen = this.isFrozenBiome(bio);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockType.AIR;

          if (y === 0) {
            block = BlockType.BEDROCK;
          } else if (y > h) {
            block = (y <= SEA_LEVEL && h < SEA_LEVEL)
              ? (frozen ? BlockType.ICE : BlockType.WATER)
              : BlockType.AIR;
          } else if (y === h) {
            block = cfg.surfaceBlock;
            if (bio === BiomeType.MOUNTAINS || bio === BiomeType.MEGA_MOUNTAINS) {
              const rocky = h > 92 || this.hash3(wx * 0.17, h * 0.11, wz * 0.17) > 0.62;
              block = rocky ? BlockType.STONE : BlockType.GRASS;
            }
            // Snow cap on high mountains regardless of biome
            if (h > 100 && bio !== BiomeType.DESERT && bio !== BiomeType.BADLANDS) block = BlockType.SNOW;
            if (frozen && h >= SEA_LEVEL - 1) block = BlockType.SNOW;
            // Obsidian eruption tip for volcanic
            if (bio === BiomeType.VOLCANIC && h > 80) block = BlockType.OBSIDIAN ?? block;
          } else if (y >= h - 4) {
            block = cfg.subSurfaceBlock;
            if ((bio === BiomeType.MOUNTAINS || bio === BiomeType.MEGA_MOUNTAINS) && h > 95) {
              block = BlockType.STONE;
            }
          } else if (y >= h - 10) {
            block = cfg.underBlock;
          } else {
            block = BlockType.STONE;
          }

          chunk.setBlock(x, y, z, block);
        }
      }
    }
  }

  // ── Cave carving ───────────────────────────────────────────────────────────
  // Three cave types:
  //  A) Tunnel caves — classic worm-like passages (3D noise threshold)
  //  B) Open caverns — large hollow voids (domain-warped noise)
  //  C) Flooded caves / lava lakes at deep levels

  private carveCaves(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx  = worldX + x;
        const wz  = worldZ + z;
        const surface = hm[x][z];
        const cutoff  = Math.min(surface - 4, CHUNK_HEIGHT - 1);

        for (let y = 1; y < cutoff; y++) {
          const bt = chunk.getBlock(x, y, z);
          if (bt === BlockType.BEDROCK) continue;

          // ── A: Tunnel caves (classic worm noise) ──
          const tunnel = this.noise.isCave(wx, y, wz);

          // ── B: Open caverns (large voids) ──
          // Use two layers of fbm with domain warping for huge chambers
          const dwx = wx + this.noise.fbm2D(wx * 0.3, wz * 0.3, 2, 0.5, 2.0, 0.05) * 12;
          const dwz = wz + this.noise.fbm2D(wx * 0.3 + 100, wz * 0.3, 2, 0.5, 2.0, 0.05) * 12;
          const cavern1 = this.noise.fbm2D(dwx, y * 1.2, 4, 0.5, 2.0, 0.022);
          const cavern2 = this.noise.fbm2D(dwz + 500, y * 1.2 + 100, 4, 0.5, 2.0, 0.022);
          // Large cavern when BOTH noise layers exceed threshold — creates open voids
          const openCavern = cavern1 > 0.38 && cavern2 > 0.38 && y < surface - 8 && y > 5;

          // ── C: Deep spaghetti tunnels (very thin, deep) ──
          const deepTunnel = y < 30 && this.noise.isCave(wx * 1.5, y * 0.8, wz * 1.5);

          if (tunnel || openCavern || deepTunnel) {
            chunk.setBlock(x, y, z, BlockType.AIR);

            // Lava fills very deep carved blocks
            if (y <= 10 && (tunnel || deepTunnel)) {
              chunk.setBlock(x, y, z, BlockType.LAVA);
            }
          }
        }
      }
    }

    // ── Lava lakes at low depth ──────────────────────────────────────────────
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      for (let z = 1; z < CHUNK_SIZE - 1; z++) {
        const wx = worldX + x, wz = worldZ + z;
        for (let y = 4; y <= 16; y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.AIR) continue;
          if (chunk.getBlock(x, y - 1, z) === BlockType.AIR) continue; // need floor
          const lavaPool = this.hash3(wx, y, wz);
          if (lavaPool < 0.04) {
            chunk.setBlock(x, y, z, BlockType.LAVA);
          }
        }
      }
    }
  }

  // ── Underground decoration ─────────────────────────────────────────────────
  // Stalactites, stalagmites, crystal clusters, mushroom columns

  private decorateUnderground(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x, wz = worldZ + z;

        // Determine local cave biome by depth signature
        const caveBiomeNoise = this.hash3(wx * 0.1, 0, wz * 0.1);
        let caveBiome: CaveBiome;
        if      (caveBiomeNoise < 0.08)  caveBiome = CaveBiome.CRYSTAL_CAVE;
        else if (caveBiomeNoise < 0.16)  caveBiome = CaveBiome.LAVA_FIELD;
        else if (caveBiomeNoise < 0.22)  caveBiome = CaveBiome.MUSHROOM_CAVE;
        else if (caveBiomeNoise < 0.27)  caveBiome = CaveBiome.AQUIFER;
        else                             caveBiome = CaveBiome.NORMAL;

        for (let y = 2; y < hm[x][z] - 4; y++) {
          const block = chunk.getBlock(x, y, z);
          if (block !== BlockType.AIR) continue;

          const floorBlock = chunk.getBlock(x, y - 1, z);
          const ceilBlock  = chunk.getBlock(x, y + 1, z);
          const onFloor    = floorBlock !== BlockType.AIR && floorBlock !== BlockType.LAVA;
          const onCeil     = ceilBlock  !== BlockType.AIR;

          switch (caveBiome) {
            case CaveBiome.CRYSTAL_CAVE: {
              // Glowstone clusters on floor and ceiling
              if (onFloor && this.hash3(wx, y, wz + 10) < 0.04) {
                chunk.setBlock(x, y, z, BlockType.GLOWSTONE);
              }
              if (onCeil && this.hash3(wx, y, wz + 20) < 0.04) {
                chunk.setBlock(x, y, z, BlockType.GLOWSTONE);
              }
              break;
            }
            case CaveBiome.LAVA_FIELD: {
              // Netherrack patches on floor
              if (onFloor && this.hash3(wx, y, wz + 30) < 0.12) {
                chunk.setBlock(x, y - 1, z, BlockType.NETHERRACK ?? BlockType.STONE);
              }
              break;
            }
            case CaveBiome.MUSHROOM_CAVE: {
              // Glowstone "mushroom stumps" (just a single block — short)
              if (onFloor && y > 15 && this.hash3(wx, y, wz + 40) < 0.025) {
                chunk.setBlock(x, y, z, BlockType.GLOWSTONE);
              }
              break;
            }
            case CaveBiome.AQUIFER: {
              // Underground water pools
              if (onFloor && y > 20 && y < 50 && this.hash3(wx, y, wz + 50) < 0.08) {
                chunk.setBlock(x, y, z, BlockType.WATER);
              }
              break;
            }
            default: {
              // Stalactite (hanging from ceiling)
              if (onCeil && y > 10 && this.hash3(wx, y, wz) < 0.018) {
                const len = 1 + Math.floor(this.hash3(wx + 5, y, wz) * 3);
                for (let i = 0; i < len && y - i > 1; i++) {
                  if (chunk.getBlock(x, y - i, z) !== BlockType.AIR) break;
                  chunk.setBlock(x, y - i, z, BlockType.STONE);
                }
              }
              // Stalagmite (rising from floor)
              if (onFloor && y > 10 && this.hash3(wx + 99, y, wz + 99) < 0.015) {
                const len = 1 + Math.floor(this.hash3(wx + 200, y, wz) * 3);
                for (let i = 0; i < len && y + i < CHUNK_HEIGHT - 1; i++) {
                  if (chunk.getBlock(x, y + i, z) !== BlockType.AIR) break;
                  chunk.setBlock(x, y + i, z, BlockType.STONE);
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  // ── Ore distribution ───────────────────────────────────────────────────────
  // Ores use triangular distribution curves to match Minecraft 1.18+ style

  private addOres(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    // [blockType, peakY, spreadY, baseChance, requiresStone]
    const oreTable: [BlockType, number, number, number, boolean][] = [
      [BlockType.COAL_ORE,     96,  80,  0.022, true],
      [BlockType.COAL_ORE,     48,  40,  0.010, true],  // second coal vein deeper
      [BlockType.IRON_ORE,     16,  16,  0.016, true],
      [BlockType.IRON_ORE,     72,  24,  0.012, true],  // upper iron seam
      [BlockType.COPPER_ORE ?? BlockType.IRON_ORE, 48, 32, 0.010, true],
      [BlockType.GOLD_ORE,     16,  16,  0.005, true],
      [BlockType.GOLD_ORE,     -6,   6,  0.010, true],  // deep gold
      [BlockType.REDSTONE_ORE,  6,   8,  0.009, true],
      [BlockType.LAPIS_ORE,    32,  30,  0.005, true],
      [BlockType.DIAMOND_ORE,   6,   8,  0.002, true],
      [BlockType.DIAMOND_ORE,  -9,   5,  0.004, true],  // buried diamonds at Y-9
      [BlockType.EMERALD_ORE,  64,  32,  0.0015,true],  // mountains only (checked below)
    ];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x, wz = worldZ + z;
        const surface = hm[x][z];
        const isMountain = surface > 90;

        for (const [oreType, peakY, spreadY, chance, needsStone] of oreTable) {
          // Emerald only in mountains
          if (oreType === BlockType.EMERALD_ORE && !isMountain) continue;

          for (let y = 1; y < surface - 3; y++) {
            const bt = chunk.getBlock(x, y, z);
            if (needsStone && bt !== BlockType.STONE) continue;

            // Triangular distribution around peakY
            const dist = Math.abs(y - peakY);
            if (dist > spreadY) continue;

            const prob = chance * (1.0 - dist / spreadY);
            const n = this.noise.getOreNoise(wx, y, wz, oreType);
            if (n > 1.0 - prob) {
              chunk.setBlock(x, y, z, oreType);
            }
          }
        }
      }
    }
  }

  // ── Surface decoration ─────────────────────────────────────────────────────

  private decorateSurface(chunk: Chunk, worldX: number, worldZ: number, hm: number[][]): void {
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx  = worldX + x, wz = worldZ + z;
        const h   = hm[x][z];
        if (h <= SEA_LEVEL) continue;

        const bio = this.getBiome(wx, wz);
        const cfg = BIOMES[bio];
        const sf  = chunk.getBlock(x, h, z);
        // Surface vegetation depends on the surface type.
        const isGrassSurface = sf === BlockType.GRASS;
        const isSandSurface  = sf === BlockType.SAND;
        const isRedSandSurface = sf === BlockType.RED_SAND;

        // ── Trees ──────────────────────────────────────────────────────────
        const treeN = this.noise.getTreeNoise(wx, wz);
        if (treeN < cfg.treeDensity && cfg.treeType !== 'none') {
          if (cfg.treeType === 'cactus' && isSandSurface) {
            this.placeTree(chunk, x, h + 1, z, 'cactus', wx, wz);
          } else if (cfg.treeType === 'cherry' && isGrassSurface) {
            this.placeTree(chunk, x, h + 1, z, 'cherry', wx, wz);
          } else if (isGrassSurface) {
            this.placeTree(chunk, x, h + 1, z, cfg.treeType, wx, wz);
          }
          continue; // don't add ground cover where a tree was placed
        }

        // ── Ground cover — only on grass surfaces above sea level ──────────
        if (!isGrassSurface && !isSandSurface && !isRedSandSurface) continue;

        const coverN = this.hash3(wx * 3.1, 0, wz * 2.7);
        const typeN  = this.hash3(wx * 5.3, 1, wz * 7.1);

        // Biome-specific ground cover densities & types
        switch (bio) {
          case BiomeType.PLAINS:
          case BiomeType.SUNFLOWER_PLAINS: {
            if (coverN < 0.35) {
              // Lots of tall grass and flowers on plains
              const block = typeN < 0.65 ? BlockType.TALL_GRASS : (this.hash3(wx * 7.3, 2, wz * 4.1) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW);
              chunk.setBlock(x, h + 1, z, block);
            }
            break;
          }
          case BiomeType.FOREST:
          case BiomeType.DARK_FOREST: {
            if (coverN < 0.30) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.38) {
              const flowerType = this.hash3(wx * 8.1, 3, wz * 5.3) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, h + 1, z, flowerType);
            }
            break;
          }
          case BiomeType.JUNGLE: {
            // Very dense ground cover
            if (coverN < 0.55) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.70 && this.hash3(wx * 4.2, 2, wz * 4.9) < 0.35) {
              chunk.setBlock(x, h + 1, z, BlockType.VINE);
            }
            break;
          }
          case BiomeType.DESERT:
          case BiomeType.BADLANDS: {
            if (coverN < 0.18) {
              chunk.setBlock(x, h + 1, z, BlockType.DEAD_BUSH);
            } else if (coverN < 0.26 && bio === BiomeType.DESERT) {
              chunk.setBlock(x, h + 1, z, BlockType.CACTUS);
            }
            break;
          }
          case BiomeType.SWAMP: {
            if (coverN < 0.25) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.TAIGA: {
            if (coverN < 0.18) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.24 && h > SEA_LEVEL + 8) {
              chunk.setBlock(x, h + 1, z, BlockType.SNOW);
            }
            break;
          }
          case BiomeType.SAVANNA: {
            if (coverN < 0.20) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.BEACH: {
            if (coverN < 0.08) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.MEADOW: {
            if (coverN < 0.35) {
              const flowerType = this.hash3(wx * 11.1, 7, wz * 9.7) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, h + 1, z, flowerType);
            } else if (coverN < 0.58) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            }
            break;
          }
          case BiomeType.CHERRY_GROVE: {
            if (coverN < 0.38) {
              const flowerType = this.hash3(wx * 9.7, 8, wz * 8.3) < 0.5 ? BlockType.FLOWER_TULIP_PINK : BlockType.FLOWER_ALLIUM;
              chunk.setBlock(x, h + 1, z, flowerType);
            } else if (coverN < 0.60) {
              chunk.setBlock(x, h + 1, z, BlockType.TALL_GRASS);
            } else if (coverN < 0.75 && this.hash3(wx * 6.7, 5, wz * 6.1) < 0.35) {
              chunk.setBlock(x, h + 1, z, BlockType.CHERRY_LEAVES);
            }
            break;
          }
          case BiomeType.BADLANDS: {
            if (coverN < 0.20) {
              chunk.setBlock(x, h + 1, z, BlockType.DEAD_BUSH);
            } else if (coverN < 0.28) {
              chunk.setBlock(x, h + 1, z, BlockType.CACTUS);
            }
            break;
          }
          case BiomeType.SNOW:
          case BiomeType.ICE_SPIKES: {
            if (coverN < 0.22) {
              chunk.setBlock(x, h + 1, z, BlockType.SNOW);
            }
            break;
          }
          case BiomeType.MUSHROOM_ISLAND: {
            if (coverN < 0.28) {
              chunk.setBlock(x, h + 1, z, this.hash3(wx * 5.5, 2, wz * 6.2) < 0.5 ? BlockType.MUSHROOM_RED : BlockType.MUSHROOM_BROWN);
            }
            break;
          }
          case BiomeType.MOUNTAINS:
          case BiomeType.MEGA_MOUNTAINS: {
            // Sparse flowers at lower mountain heights only
            if (h < 90 && coverN < 0.10) {
              const flowerType = this.hash3(wx * 9.2, 4, wz * 6.7) < 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
              chunk.setBlock(x, h + 1, z, flowerType);
            }
            break;
          }
          default:
            break;
        }
      }
    }
  }

  // ── Tree generators ────────────────────────────────────────────────────────

  private placeTree(chunk: Chunk, x: number, y: number, z: number, type: string, wx: number, wz: number): void {
    if (x < 2 || x >= CHUNK_SIZE-2 || z < 2 || z >= CHUNK_SIZE-2) return;
    if (y >= CHUNK_HEIGHT - 12) return;
    const seed = this.hash3(wx * 0.91, y * 0.13, wz * 0.73);
    switch(type) {
      case 'oak':      this.oakTree(chunk, x, y, z, seed); break;
      case 'birch':    this.birchTree(chunk, x, y, z, seed); break;
      case 'spruce':   this.spruceTree(chunk, x, y, z, seed); break;
      case 'jungle':   this.jungleTree(chunk, x, y, z, seed); break;
      case 'acacia':   this.acaciaTree(chunk, x, y, z, seed); break;
      case 'dark_oak': this.darkOakTree(chunk, x, y, z, seed); break;
      case 'cherry':   this.cherryTree(chunk, x, y, z, seed); break;
      case 'orange':   this.orangeTree(chunk, x, y, z, seed); break;
      case 'cactus':   this.cactus(chunk, x, y, z, seed); break;
    }
  }

  // Helper: place a leaf block only if air (never overwrite logs or other leaves)
  private leaf(chunk: Chunk, lx: number, ly: number, lz: number, type: BlockType): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    if (ly < 0 || ly >= CHUNK_HEIGHT) return;
    if (chunk.getBlock(lx, ly, lz) === BlockType.AIR) chunk.setBlock(lx, ly, lz, type);
  }

  // Helper: spherical leaf blob centered at (cx,cy,cz) with given radius
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
    chunk: Chunk,
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    maxDrop: number,
    type: BlockType,
    seed: number
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
    const cy = y + h - 1;
    this.leafSphere(chunk, x, cy - 1, z, 2, 2, 2, BlockType.BIRCH_LEAVES, seed * 719);
    this.leafSphere(chunk, x, cy, z, 2, 2, 2, BlockType.BIRCH_LEAVES, seed * 1601);
    this.leafSphere(chunk, x, cy + 1, z, 1, 1, 1, BlockType.BIRCH_LEAVES, seed * 1951);
  }

  private spruceTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 8 + Math.floor(seed * 5);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.SPRUCE_LOG);
    const layers = h - 1;
    for (let li = 0; li < layers; li++) {
      const ly = y + 2 + li;
      if (ly >= CHUNK_HEIGHT) break;
      const r = Math.max(1, Math.floor((layers - li) / (2.0 + seed * 0.5)));
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          this.leaf(chunk, x + dx, ly, z + dz, BlockType.SPRUCE_LEAVES);
        }
      }
    }
    this.leaf(chunk, x, y + h + 1, z, BlockType.SPRUCE_LEAVES);
  }

  private jungleTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 10 + Math.floor(seed * 6);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.JUNGLE_LOG);
    const cy = y + h;
    const mainRadius = 3 + (seed > 0.55 ? 1 : 0);
    this.leafSphere(chunk, x, cy - 1, z, mainRadius, 2, mainRadius, BlockType.JUNGLE_LEAVES, seed * 2113);
    this.leafSphere(chunk, x, cy, z, mainRadius + 1, 2, mainRadius + 1, BlockType.JUNGLE_LEAVES, seed * 4001);
    this.leafSphere(chunk, x, cy + 1, z, 2, 1, 2, BlockType.JUNGLE_LEAVES, seed * 4337);
    this.drapeLeaves(chunk, x, cy, z, mainRadius + 1, 3, BlockType.JUNGLE_LEAVES, seed * 5003);
    this.drapeVines(chunk, x, cy, z, mainRadius + 1, seed * 5557);
  }

  private acaciaTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 5 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.ACACIA_LOG);
    const cy = y + h;
    const r = 3 + (seed > 0.65 ? 1 : 0);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > (r * r + 3)) continue;
        this.leaf(chunk, x + dx, cy, z + dz, BlockType.ACACIA_LEAVES);
        this.leaf(chunk, x + dx, cy + 1, z + dz, BlockType.ACACIA_LEAVES);
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        this.leaf(chunk, x + dx, cy + 2, z + dz, BlockType.ACACIA_LEAVES);
      }
    }
  }

  private darkOakTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 6 + Math.floor(seed * 4);
    for (let i = 0; i < h; i++) {
      for (let tx = 0; tx <= 1; tx++) {
        for (let tz = 0; tz <= 1; tz++) {
          const bx = x + tx;
          const bz = z + tz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) {
            chunk.setBlock(bx, y + i, bz, BlockType.DARK_OAK_LOG);
          }
        }
      }
    }
    const cy = y + h;
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy <= 0 ? (3 + (seed > 0.7 ? 1 : 0)) : dy === 1 ? 2 : 1;
      for (let dx = -r; dx <= r + 1; dx++) {
        for (let dz = -r; dz <= r + 1; dz++) {
          if (dx * dx + dz * dz > (r + 0.8) * (r + 0.8)) continue;
          this.leaf(chunk, x + dx, cy + dy, z + dz, BlockType.DARK_OAK_LEAVES);
        }
      }
    }
    this.drapeLeaves(chunk, x + 1, cy, z + 1, 4, 2, BlockType.DARK_OAK_LEAVES, seed * 6121);
  }

  private cherryTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 5 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.CHERRY_LOG);
    const cy = y + h;
    const r = 2 + (seed > 0.55 ? 1 : 0);
    this.leafSphere(chunk, x, cy - 1, z, r, 2, r, BlockType.CHERRY_LEAVES, seed * 811);
    this.leafSphere(chunk, x, cy, z, r + 1, 2, r + 1, BlockType.CHERRY_LEAVES, seed * 1009);
    this.leafSphere(chunk, x, cy + 1, z, 2, 1, 2, BlockType.CHERRY_LEAVES, seed * 1451);
    this.drapeLeaves(chunk, x, cy, z, r + 1, 2, BlockType.CHERRY_LEAVES, seed * 1777);

    if (this.hash3(seed * 13.7, cy, seed * 17.9) > 0.35) {
      this.leaf(chunk, x + 1, cy - 1, z, BlockType.FLOWER_TULIP_PINK);
      this.leaf(chunk, x - 1, cy - 1, z, BlockType.FLOWER_TULIP_PINK);
      this.leaf(chunk, x, cy - 1, z + 1, BlockType.FLOWER_ALLIUM);
      this.leaf(chunk, x, cy - 1, z - 1, BlockType.FLOWER_ALLIUM);
    }
  }

  private orangeTree(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    // Orange trees similar to cherry but with orange coloring
    const h = 4 + Math.floor(seed * 4);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.ORANGE_LOG);
    const cy = y + h;
    const r = 2 + (seed > 0.5 ? 1 : 0);
    // Leaf spheres for bushy crown
    this.leafSphere(chunk, x, cy - 1, z, r, 2, r, BlockType.ORANGE_LEAVES, seed * 777);
    this.leafSphere(chunk, x, cy, z, r + 1, 2, r + 1, BlockType.ORANGE_LEAVES, seed * 997);
    this.leafSphere(chunk, x, cy + 1, z, 2, 1, 2, BlockType.ORANGE_LEAVES, seed * 1234);
    this.drapeLeaves(chunk, x, cy, z, r + 1, 2, BlockType.ORANGE_LEAVES, seed * 1555);
  }

  private drapeVines(chunk: Chunk, cx: number, cy: number, cz: number, radius: number, seed: number): void {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) < radius) continue;
        if (this.hash3(seed * 7.1, cx + dx, cz + dz) < 0.55) continue;
        const len = 1 + Math.floor(this.hash3(seed * 11.3, cy, cz + dz) * 3);
        for (let d = 0; d < len; d++) {
          this.leaf(chunk, cx + dx, cy - d, cz + dz, BlockType.VINE);
        }
      }
    }
  }

  private cactus(chunk: Chunk, x: number, y: number, z: number, seed: number): void {
    const h = 2 + Math.floor(seed * 3);
    for (let i = 0; i < h; i++) chunk.setBlock(x, y + i, z, BlockType.CACTUS);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private hash3(x: number, y: number, z: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.3) * 43758.5453;
    return n - Math.floor(n);
  }
}

// ── Utility functions ──────────────────────────────────────────────────────────

function rangeFit(v: number, r: [number, number]): number {
  const center = (r[0] + r[1]) / 2;
  const half   = (r[1] - r[0]) / 2;
  return Math.max(0, 1 - Math.abs(v - center) / half);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let instance: TerrainGenerator | null = null;

export function getTerrainGenerator(seed?: number): TerrainGenerator {
  if (!instance || seed !== undefined) instance = new TerrainGenerator(seed ?? Date.now());
  return instance;
}

export function resetTerrainGenerator(): void {
  instance = null;
  resetWorldNoise();
}

export const terrainGenerator = new TerrainGenerator();
