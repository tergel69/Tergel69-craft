import { BlockType } from '@/data/blocks';
import { BiomeType } from '@/data/biomes';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { Chunk } from '@/engine/Chunk';
import { 
  StructureTemplate, 
  StructureBlock, 
  structureRegistry,
  biomeMatchesRules,
  PlacementRules,
  BiomeTag
} from './StructureRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded RNG (copied from StructureGenerator for independence)
// ─────────────────────────────────────────────────────────────────────────────
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next(): number {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return (s >>> 0) / 0x100000000;
  }
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain Analysis
// ─────────────────────────────────────────────────────────────────────────────
export interface TerrainAnalysis {
  surfaceHeight: number;
  surfaceBlock: BlockType;
  biome: BiomeType;
  slope: number;           // 0 = flat, 1 = very steep
  isWater: boolean;
  isNearWater: boolean;
  isNearCliff: boolean;
  heightVariation: number; // Variation in nearby area
  isSolidGround: boolean;  // NEW: whether surface is solid (not air/water/lava)
  foundationBlock: BlockType; // NEW: block directly below surface
}

// ─────────────────────────────────────────────────────────────────────────────
// Solid Block Check Helper
// ─────────────────────────────────────────────────────────────────────────────
// Non-solid blocks that should NOT support structures - only use actual BlockType values
const NON_SOLID_BLOCKS = new Set<BlockType>([
  BlockType.AIR,
  BlockType.WATER,
  BlockType.LAVA,
  BlockType.GLASS,
]);

function isSolidBlock(block: BlockType): boolean {
  // A block is solid if it's not air, not water/lava, and not in the non-solid list
  if (block === undefined || block === null) return false;
  if (block === BlockType.AIR || block === BlockType.WATER || block === BlockType.LAVA) return false;
  return !NON_SOLID_BLOCKS.has(block);
}

function isLiquidBlock(block: BlockType): boolean {
  return block === BlockType.WATER || block === BlockType.LAVA;
}

export function analyzeTerrain(
  chunk: Chunk, 
  localX: number, 
  localZ: number,
  getBiomeAt: (x: number, z: number) => BiomeType
): TerrainAnalysis {
  // Find surface height
  let surfaceHeight = 64;
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const block = chunk.getBlock(localX, y, localZ);
    if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
      surfaceHeight = y;
      break;
    }
  }
  
  const surfaceBlock = chunk.getBlock(localX, surfaceHeight, localZ);
  const biome = getBiomeAt(
    chunk.cx * CHUNK_SIZE + localX,
    chunk.cz * CHUNK_SIZE + localZ
  );
  
  // Calculate slope by checking neighboring heights
  let totalDiff = 0;
  const offsets = [[-1,0], [1,0], [0,-1], [0,1]];
  for (const [dx, dz] of offsets) {
    const nx = localX + dx;
    const nz = localZ + dz;
    if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
      let nh = surfaceHeight;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const b = chunk.getBlock(nx, y, nz);
        if (b !== BlockType.AIR && b !== BlockType.WATER && b !== BlockType.LAVA) {
          nh = y;
          break;
        }
      }
      totalDiff += Math.abs(nh - surfaceHeight);
    }
  }
  const slope = totalDiff / 4;
  
  // Check water
  const isWater = surfaceBlock === BlockType.WATER;
  
  // Check if near water (within 8 blocks)
  let isNearWater = false;
  let isNearCliff = false;
  for (let r = 1; r <= 8 && !isNearWater; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r || Math.abs(dz) === r) {
          const nx = localX + dx;
          const nz = localZ + dz;
          if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
            const wb = chunk.getBlock(nx, surfaceHeight, nz);
            if (wb === BlockType.WATER) {
              isNearWater = true;
              break;
            }
          }
        }
      }
    }
  }
  
  // Check for cliff (sudden height drop)
  if (slope > 2) isNearCliff = true;
  
  // Height variation (roughness)
  const heightVariation = slope;
  
  // NEW: Check if surface is solid ground (not air, water, or lava)
  const isSolidGround = isSolidBlock(surfaceBlock);
  
  // NEW: Get the block directly below the surface
  let foundationBlock = BlockType.AIR;
  if (surfaceHeight > 0) {
    foundationBlock = chunk.getBlock(localX, surfaceHeight - 1, localZ);
  }
  
  return {
    surfaceHeight,
    surfaceBlock,
    biome,
    slope,
    isWater,
    isNearWater,
    isNearCliff,
    heightVariation,
    isSolidGround,
    foundationBlock
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Transformation (for rotation/mirroring)
// ─────────────────────────────────────────────────────────────────────────────
export enum Rotation {
  NONE = 0,
  ROTATE_90 = 1,
  ROTATE_180 = 2,
  ROTATE_270 = 3,
}

export enum Mirror {
  NONE = 0,
  HORIZONTAL = 1,  // Mirror along X axis
  VERTICAL = 2,    // Mirror along Z axis
}

export function transformBlock(
  block: StructureBlock,
  rotation: Rotation,
  mirror: Mirror,
  centerX: number,
  centerZ: number
): StructureBlock {
  let { dx, dy, dz } = block;
  
  // Apply mirror first
  if (mirror === Mirror.HORIZONTAL) {
    dx = centerX - dx;
  } else if (mirror === Mirror.VERTICAL) {
    dz = centerZ - dz;
  }
  
  // Apply rotation
  switch (rotation) {
    case Rotation.ROTATE_90:
      const oldX = dx;
      dx = dz;
      dz = centerX - oldX;
      break;
    case Rotation.ROTATE_180:
      dx = centerX - dx;
      dz = centerZ - dz;
      break;
    case Rotation.ROTATE_270:
      const oldX2 = dx;
      dx = centerZ - dz;
      dz = oldX2;
      break;
  }
  
  return { dx, dy, dz, type: block.type };
}

export function transformBlocks(
  blocks: StructureBlock[],
  rotation: Rotation,
  mirror: Mirror
): StructureBlock[] {
  if (rotation === Rotation.NONE && mirror === Mirror.NONE) {
    return blocks;
  }
  
  // Calculate center for transformation
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const block of blocks) {
    minX = Math.min(minX, block.dx);
    maxX = Math.max(maxX, block.dx);
    minZ = Math.min(minZ, block.dz);
    maxZ = Math.max(maxZ, block.dz);
  }
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  
  return blocks.map(block => transformBlock(block, rotation, mirror, centerX, centerZ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain Adaptation
// ─────────────────────────────────────────────────────────────────────────────
export interface TerrainAdaptation {
  yOffset: number;           // Additional Y offset
  foundation: StructureBlock[];  // Support blocks to add
  cutBlocks: StructureBlock[];   // Blocks to remove (for terracing)
  blendBlocks: StructureBlock[]; // Blocks to blend with terrain
}

export function calculateTerrainAdaptation(
  terrain: TerrainAnalysis,
  rules: PlacementRules
): TerrainAdaptation {
  const result: TerrainAdaptation = {
    yOffset: 0,
    foundation: [],
    cutBlocks: [],
    blendBlocks: [],
  };
  
  // Check terrain slope preference
  if (rules.terrainSlope === 'flat' && terrain.slope > 1) {
    // Need to flatten - add foundation
    const steps = Math.ceil(terrain.slope / 2);
    for (let i = 0; i < steps; i++) {
      result.foundation.push({
        dx: 0,
        dy: -i - 1,
        dz: 0,
        type: BlockType.COBBLESTONE
      });
    }
    result.yOffset = steps;
  } else if (rules.terrainSlope === 'steep' && terrain.slope < 0.5) {
    // Prefer steep but flat - add nothing
  }
  
  // Check height constraints
  if (rules.minHeight !== undefined && terrain.surfaceHeight < rules.minHeight) {
    result.yOffset = rules.minHeight - terrain.surfaceHeight;
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Placement Engine
// ─────────────────────────────────────────────────────────────────────────────
export interface PlacementResult {
  success: boolean;
  worldX: number;
  worldZ: number;
  placeY: number;
  blocks: StructureBlock[];
  variant: number;
  rotation: Rotation;
  mirror: Mirror;
}

export class StructurePlacementEngine {
  private worldSeed: number;
  private regionCache: Map<string, { structureId: string; x: number; z: number }[]> = new Map();
  
  constructor(worldSeed: number) {
    this.worldSeed = worldSeed;
  }
  
  // Generate deterministic seed for a grid cell
  private cellSeed(cellX: number, cellZ: number, structureId: string): number {
    let seed = this.worldSeed;
    seed = ((seed * 1103515245 + 12345) >>> 0);
    seed = ((seed + cellX * 0x9E3779B9) >>> 0);
    seed = ((seed + cellZ * 0x9E3779B9) >>> 0);
    const strHash = structureId.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) >>> 0, 0);
    return (seed + strHash) >>> 0;
  }
  
  // Get or create region cache
  private getRegionCache(regionX: number, regionZ: number): { structureId: string; x: number; z: number }[] {
    const key = `${regionX},${regionZ}`;
    if (!this.regionCache.has(key)) {
      this.regionCache.set(key, []);
    }
    return this.regionCache.get(key)!;
  }
  
  // Check spacing requirements
  private checkSpacing(
    structureId: string,
    worldX: number,
    worldZ: number,
    gridSize: number,
    minSpacing: number | undefined
  ): boolean {
    if (!minSpacing) return true;
    
    const spacingBlocks = minSpacing * CHUNK_SIZE;
    const regionX = Math.floor(worldX / (spacingBlocks * 4));
    const regionZ = Math.floor(worldZ / (spacingBlocks * 4));
    
    // Check nearby regions
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const cache = this.getRegionCache(regionX + dx, regionZ + dz);
        for (const entry of cache) {
          if (entry.structureId === structureId) {
            const dist = Math.sqrt(
              Math.pow(entry.x - worldX, 2) + 
              Math.pow(entry.z - worldZ, 2)
            );
            if (dist < spacingBlocks) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  }
  
  // Record placement
  private recordPlacement(
    structureId: string,
    worldX: number,
    worldZ: number
  ): void {
    const regionX = Math.floor(worldX / (CHUNK_SIZE * 32));
    const regionZ = Math.floor(worldZ / (CHUNK_SIZE * 32));
    const cache = this.getRegionCache(regionX, regionZ);
    cache.push({ structureId, x: worldX, z: worldZ });
  }
  
  // Try to place a structure in a chunk
  tryPlaceStructure(
    chunk: Chunk,
    template: StructureTemplate,
    getBiomeAt: (x: number, z: number) => BiomeType
  ): PlacementResult | null {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const G = template.gridSize;
    
    // Calculate footprint margin
    const fpX = template.footprintX || CHUNK_SIZE;
    const fpZ = template.footprintZ || CHUNK_SIZE;
    const marginX = Math.ceil(fpX / CHUNK_SIZE) + 1;
    const marginZ = Math.ceil(fpZ / CHUNK_SIZE) + 1;
    
    // Base cell for this chunk
    const baseCellX = Math.floor(cx / G);
    const baseCellZ = Math.floor(cz / G);
    
    // Check neighboring cells
    for (let dcx = -marginX; dcx <= marginX; dcx++) {
      for (let dcz = -marginZ; dcz <= marginZ; dcz++) {
        const gcx = baseCellX + dcx;
        const gcz = baseCellZ + dcz;
        
        // Cell seed for deterministic RNG
        const cellSeed = this.cellSeed(gcx, gcz, template.id);
        const rng = new SeededRandom(cellSeed);
        
        // Probability check
        if (rng.next() >= template.probability) continue;
        
        // Owner chunk for this cell
        const ownerCX = gcx * G + rng.nextInt(0, G - 1);
        const ownerCZ = gcz * G + rng.nextInt(0, G - 1);
        
        // Local position in owner chunk
        const localX = rng.nextInt(2, CHUNK_SIZE - 3);
        const localZ = rng.nextInt(2, CHUNK_SIZE - 3);
        
        // World position
        const worldOriginX = ownerCX * CHUNK_SIZE + localX;
        const worldOriginZ = ownerCZ * CHUNK_SIZE + localZ;
        
        // Check if this chunk is the owner or a neighbor
        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldZ = cz * CHUNK_SIZE;
        
        // Quick bounding box check
        if (worldOriginX + fpX < chunkWorldX || worldOriginX >= chunkWorldX + CHUNK_SIZE) continue;
        if (worldOriginZ + fpZ < chunkWorldZ || worldOriginZ >= chunkWorldZ + CHUNK_SIZE) continue;
        
        // Check spacing
        if (!this.checkSpacing(template.id, worldOriginX, worldOriginZ, G, template.placementRules.minSpacing)) {
          continue;
        }
        
        // Check if we own the origin (for surface height)
        const sampleLX = worldOriginX - chunkWorldX;
        const sampleLZ = worldOriginZ - chunkWorldZ;
        const originIsHere = sampleLX >= 0 && sampleLX < CHUNK_SIZE && 
                              sampleLZ >= 0 && sampleLZ < CHUNK_SIZE;
        
        // Analyze terrain
        const terrain = analyzeTerrain(chunk, localX, localZ, getBiomeAt);
        
        // Check placement rules
        if (!biomeMatchesRules(terrain.biome, template.placementRules)) {
          continue;
        }
        
        // Check terrain-specific rules
        const rules = template.placementRules;
        if (rules.requireLand && terrain.isWater) continue;
        if (rules.requireWater && !terrain.isNearWater) continue;
        if (rules.minHeight !== undefined && terrain.surfaceHeight < rules.minHeight) continue;
        if (rules.maxHeight !== undefined && terrain.surfaceHeight > rules.maxHeight) continue;
        if (rules.terrainSlope === 'flat' && terrain.slope > 2) continue;
        
        // NEW: Require structures to spawn on solid ground
        if (!terrain.isSolidGround) {
          // Skip placement on air, water, or lava
          continue;
        }
        
        // NEW: Require the foundation block to also be solid
        // This prevents structures from spawning with floating foundations
        if (!isSolidBlock(terrain.foundationBlock) && terrain.foundationBlock !== BlockType.GRASS) {
          // Allow GRASS as foundation (it's valid for structures to be on grass)
          continue;
        }
        
        // Calculate Y position
        let placeY = terrain.surfaceHeight + template.heightOffset;
        
        // Get variant, rotation, mirror
        const variant = template.variants ? rng.nextInt(0, template.variants - 1) : (template.defaultVariant || 0);
        const rotation = template.variants ? 
          (rng.nextInt(0, 3) as Rotation) : Rotation.NONE;
        const mirror = template.variants ?
          (rng.nextInt(0, 2) as Mirror) : Mirror.NONE;
        
        // Transform blocks
        let blocks = transformBlocks(template.blocks, rotation, mirror);
        
        // Apply terrain adaptation
        if (template.hasTerrainBlend) {
          const adaptation = calculateTerrainAdaptation(terrain, rules);
          placeY += adaptation.yOffset;
          blocks = [...blocks, ...adaptation.foundation];
        }
        
        // Record placement
        this.recordPlacement(template.id, worldOriginX, worldOriginZ);
        
        return {
          success: true,
          worldX: worldOriginX,
          worldZ: worldOriginZ,
          placeY,
          blocks,
          variant,
          rotation,
          mirror
        };
      }
    }
    
    return null;
  }
  
  // Clear cache (for world reset)
  reset(): void {
    this.regionCache.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Compatibility Wrapper
// ─────────────────────────────────────────────────────────────────────────────
// Convert old-style template to new format
import { ItemType, getAllItems } from '@/data/items';
import { ContainerSlot } from '@/stores/worldStore';

function buildUniversalLootPool(): any[] {
  return getAllItems().map((item) => {
    const id = item.id.toString();
    if (id.includes('spawn_egg')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.06 };
    }
    if (id.includes('music_disc')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.08 };
    }
    if (id.includes('netherite') || id.includes('elytra') || id.includes('trident')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.04 };
    }
    if (id.includes('bucket') || id.includes('boat') || id.includes('minecart')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.12 };
    }
    if (item.toolType || item.armorSlot) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.14 };
    }
    if (item.foodPoints !== undefined) {
      return { item: item.id, minCount: 1, maxCount: 3, weight: 0.55 };
    }
    if (item.stackSize > 1) {
      return { item: item.id, minCount: 2, maxCount: Math.min(8, item.stackSize), weight: 0.7 };
    }
    return { item: item.id, minCount: 1, maxCount: 2, weight: 0.3 };
  });
}

export function registerVanillaStructures(): void {
  // This function registers all the vanilla structures using the new system
  // It reads from existing templates and converts them
  
  // For now, we'll populate the registry with biome-aware templates
  // The actual templates from StructureGenerator will be converted
  // in a follow-up step
  
  // Example: Desert Pyramid with proper biome rules
  structureRegistry.register({
    id: 'desert_pyramid',
    name: 'Desert Pyramid',
    category: 'temple' as any,
    gridSize: 8,
    probability: 0.30,
    footprintX: 24,
    footprintZ: 24,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.SAND],
    placementRules: {
      requiredTags: [BiomeTag.DESERT],
      minSpacing: 8,
      dimension: 'overworld',
    },
    blocks: [], // Will be filled from existing buildDesertPyramid
  });
  
  // Ocean Monument
  structureRegistry.register({
    id: 'ocean_monument',
    name: 'Ocean Monument',
    category: 'monument' as any,
    gridSize: 16,
    probability: 0.25,
    footprintX: 62,
    footprintZ: 62,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.SAND, BlockType.GRAVEL],
    placementRules: {
      requiredTags: [BiomeTag.OCEAN],
      minSpacing: 16,
      dimension: 'overworld',
      requireWater: true,
    },
    blocks: [],
  });
  
  // Woodland Mansion
  structureRegistry.register({
    id: 'woodland_mansion',
    name: 'Woodland Mansion',
    category: 'fort' as any,
    gridSize: 16,
    probability: 0.30,
    footprintX: 32,
    footprintZ: 28,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST],
      excludedTags: [BiomeTag.SNOW],
      minSpacing: 16,
      dimension: 'overworld',
    },
    blocks: [],
  });
  
  // Village - more flexible with biome tags
  structureRegistry.register({
    id: 'village',
    name: 'Village',
    category: 'village' as any,
    gridSize: 12,
    probability: 0.35,
    footprintX: 64,
    footprintZ: 64,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.DIRT],
    placementRules: {
      requiredTags: [BiomeTag.PLAINS, BiomeTag.FOREST, BiomeTag.SAVANNA],
      excludedTags: [BiomeTag.SNOW, BiomeTag.DESERT, BiomeTag.JUNGLE, BiomeTag.OCEAN],
      minSpacing: 8,
      dimension: 'overworld',
      terrainSlope: 'flat',
    },
    blocks: [],
    hasTerrainBlend: true,
  });
  
  // Jungle Temple
  structureRegistry.register({
    id: 'jungle_temple',
    name: 'Jungle Temple',
    category: 'temple' as any,
    gridSize: 8,
    probability: 0.30,
    footprintX: 14,
    footprintZ: 18,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.JUNGLE],
      minSpacing: 6,
      dimension: 'overworld',
    },
    blocks: [],
  });
  
  // Pillager Outpost
  structureRegistry.register({
    id: 'pillager_outpost',
    name: 'Pillager Outpost',
    category: 'outpost' as any,
    gridSize: 8,
    probability: 0.28,
    footprintX: 22,
    footprintZ: 22,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.SAND],
    placementRules: {
      requiredTags: [BiomeTag.PLAINS, BiomeTag.FOREST],
      excludedTags: [BiomeTag.SNOW],
      minSpacing: 6,
      dimension: 'overworld',
      terrainSlope: 'flat',
    },
    blocks: [],
  });
  
  // Swamp Hut
  structureRegistry.register({
    id: 'swamp_hut',
    name: 'Swamp Hut',
    category: 'hut' as any,
    gridSize: 8,
    probability: 0.18,
    footprintX: 14,
    footprintZ: 14,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.DIRT],
    placementRules: {
      requiredTags: [BiomeTag.SWAMP],
      minSpacing: 4,
      dimension: 'overworld',
    },
    blocks: [],
  });
  
  // Ruined Portal - multiple biomes allowed
  structureRegistry.register({
    id: 'ruined_portal',
    name: 'Ruined Portal',
    category: 'ruin' as any,
    gridSize: 10,
    probability: 0.22,
    footprintX: 12,
    footprintZ: 12,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.SAND, BlockType.STONE, BlockType.GRAVEL],
    placementRules: {
      requiredTags: [BiomeTag.PLAINS, BiomeTag.FOREST, BiomeTag.DESERT, BiomeTag.MOUNTAIN],
      excludedTags: [BiomeTag.OCEAN],
      minSpacing: 6,
      dimension: 'overworld',
    },
    blocks: [],
    hasDecay: true,
  });
  
  // Stronghold (underground)
  structureRegistry.register({
    id: 'stronghold',
    name: 'Stronghold',
    category: 'dungeon' as any,
    gridSize: 12,
    probability: 0.28,
    footprintX: 50,
    footprintZ: 50,
    heightOffset: -12,
    underground: true,
    placementRules: {
      dimension: 'overworld',
      minSpacing: 16,
      minDepth: 10,
      maxDepth: 30,
    },
    blocks: [],
  });
  
  // Mineshaft (underground)
  structureRegistry.register({
    id: 'mineshaft',
    name: 'Mineshaft',
    category: 'mining' as any,
    gridSize: 4,
    probability: 0.35,
    footprintX: 35,
    footprintZ: 35,
    heightOffset: -8,
    underground: true,
    placementRules: {
      dimension: 'overworld',
      minSpacing: 2,
      minDepth: 5,
      maxDepth: 40,
    },
    blocks: [],
  });
  
  // Nether Fortress
  structureRegistry.register({
    id: 'nether_fortress',
    name: 'Nether Fortress',
    category: 'fort' as any,
    gridSize: 12,
    probability: 0.25,
    footprintX: 56,
    footprintZ: 30,
    heightOffset: 0,
    placementRules: {
      dimension: 'nether',
      minSpacing: 10,
    },
    blocks: [],
  });
  
  // Ancient City (deep underground)
  structureRegistry.register({
    id: 'ancient_city',
    name: 'Ancient City',
    category: 'ruin' as any,
    gridSize: 14,
    probability: 0.22,
    footprintX: 46,
    footprintZ: 50,
    heightOffset: -22,
    underground: true,
    placementRules: {
      dimension: 'overworld',
      minSpacing: 12,
      minDepth: 20,
      maxDepth: 40,
    },
    blocks: [],
  });
  
  // Trial Chamber
  structureRegistry.register({
    id: 'trial_chamber',
    name: 'Trial Chamber',
    category: 'dungeon' as any,
    gridSize: 8,
    probability: 0.28,
    footprintX: 36,
    footprintZ: 36,
    heightOffset: -14,
    underground: true,
    placementRules: {
      dimension: 'overworld',
      minSpacing: 6,
      minDepth: 10,
      maxDepth: 30,
    },
    blocks: [],
  });
  
  // Dungeon
  structureRegistry.register({
    id: 'dungeon',
    name: 'Dungeon',
    category: 'dungeon' as any,
    gridSize: 3,
    probability: 0.30,
    footprintX: 10,
    footprintZ: 10,
    heightOffset: -5,
    underground: true,
    placementRules: {
      dimension: 'overworld',
      minSpacing: 2,
      minDepth: 1,
      maxDepth: 20,
    },
    blocks: [],
  });
  
  // Meadow Shrine
  structureRegistry.register({
    id: 'meadow_shrine',
    name: 'Meadow Shrine',
    category: 'ruin' as any,
    gridSize: 10,
    probability: 0.20,
    footprintX: 14,
    footprintZ: 14,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.PLAINS],
      excludedTags: [BiomeTag.SNOW, BiomeTag.DESERT],
      minSpacing: 8,
      dimension: 'overworld',
    },
    blocks: [],
  });
  
  console.log('Registered', structureRegistry.getAll().length, 'structure templates');
}