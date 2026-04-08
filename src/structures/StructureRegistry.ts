import { BlockType } from '@/data/blocks';
import { BiomeType } from '@/data/biomes';

// ─────────────────────────────────────────────────────────────────────────────
// Biome Tags - categorize biomes for structure spawning
// ─────────────────────────────────────────────────────────────────────────────
export enum BiomeTag {
  FOREST = 'forest',
  DESERT = 'desert',
  MOUNTAIN = 'mountain',
  OCEAN = 'ocean',
  SNOW = 'snow',
  SWAMP = 'swamp',
  JUNGLE = 'jungle',
  PLAINS = 'plains',
  SAVANNA = 'savanna',
  BADLANDS = 'badlands',
  CAVE = 'cave',
  NETHER = 'nether',
}

// Structure categories for organization
export enum StructureCategory {
  VILLAGE = 'village',
  TEMPLE = 'temple',
  FORT = 'fort',
  DUNGEON = 'dungeon',
  RUIN = 'ruin',
  TREE = 'tree',
  NATURAL = 'natural',
  MINING = 'mining',
  MONUMENT = 'monument',
  OUTPOST = 'outpost',
  SHIPWRECK = 'shipwreck',
  RARE = 'rare',
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Placement Rules
// ─────────────────────────────────────────────────────────────────────────────
export interface PlacementRules {
  // Biome requirements
  requiredBiomes?: BiomeType[];      // Must be in one of these biomes
  excludedBiomes?: BiomeType[];       // Must NOT be in any of these biomes
  requiredTags?: BiomeTag[];          // Must have at least one of these tags
  excludedTags?: BiomeTag[];          // Must NOT have any of these tags
  
  // Spacing control (in chunks)
  minSpacing?: number;                 // Minimum distance from same structure type
  maxPerRegion?: number;              // Maximum instances per region
  
  // Terrain requirements
  minHeight?: number;                  // Minimum surface height
  maxHeight?: number;                   // Maximum surface height
  requireWater?: boolean;              // Must be near water
  requireLand?: boolean;                // Must be on land (not water)
  terrainSlope?: 'flat' | 'any' | 'steep';  // Terrain preference
  
  // Depth (for underground structures)
  minDepth?: number;                   // Minimum underground depth
  maxDepth?: number;                   // Maximum underground depth
  
  // Dimension
  dimension?: 'overworld' | 'nether' | 'end';
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced Structure Template
// ─────────────────────────────────────────────────────────────────────────────
export interface StructureBlock {
  dx: number;
  dy: number;
  dz: number;
  type: BlockType;
}

export interface StructureTemplate {
  // Identification
  id: string;
  name: string;
  category: StructureCategory;
  
  // Size and placement
  gridSize: number;                    // Grid cell size in chunks
  probability: number;                 // Spawn probability (0-1)
  footprintX: number;
  footprintZ: number;
  heightOffset: number;
  
  // Surface/underground
  underground?: boolean;
  surfaceBlockTypes?: BlockType[];     // Allowed surface blocks
  
  // Biome and tag rules
  placementRules: PlacementRules;
  
  // Variants and rotation
  variants?: number;                    // Number of variants (for rotation/mirroring)
  defaultVariant?: number;
  
  // Content
  blocks: StructureBlock[];
  
  // Loot table ID (optional)
  lootTable?: string;
  
  // Modded structure pack ID
  packId?: string;
  
  // Realism features
  hasSupportBlocks?: boolean;           // Has foundation/support logic
  hasDecay?: boolean;                   // Has broken/decayed edges
  hasTerrainBlend?: boolean;            // Blends with terrain
}

// ─────────────────────────────────────────────────────────────────────────────
// Biome to Tag Mapping
// ─────────────────────────────────────────────────────────────────────────────
const BIOME_TO_TAGS: Record<BiomeType, BiomeTag[]> = {
  [BiomeType.PLAINS]: [BiomeTag.PLAINS, BiomeTag.FOREST],
  [BiomeType.FOREST]: [BiomeTag.FOREST],
  [BiomeType.BIRCH_FOREST]: [BiomeTag.FOREST],
  [BiomeType.TAIGA]: [BiomeTag.FOREST, BiomeTag.MOUNTAIN],
  [BiomeType.DESERT]: [BiomeTag.DESERT],
  [BiomeType.MOUNTAINS]: [BiomeTag.MOUNTAIN],
  [BiomeType.OCEAN]: [BiomeTag.OCEAN],
  [BiomeType.BEACH]: [BiomeTag.PLAINS, BiomeTag.OCEAN],
  [BiomeType.SWAMP]: [BiomeTag.SWAMP],
  [BiomeType.JUNGLE]: [BiomeTag.JUNGLE, BiomeTag.FOREST],
  [BiomeType.SNOWY_PLAINS]: [BiomeTag.SNOW, BiomeTag.PLAINS],
  [BiomeType.SNOWY_TAIGA]: [BiomeTag.SNOW, BiomeTag.FOREST],
  [BiomeType.MESA]: [BiomeTag.BADLANDS, BiomeTag.DESERT],
  [BiomeType.SAVANNA]: [BiomeTag.SAVANNA, BiomeTag.PLAINS],
  [BiomeType.ICE_SPIKES]: [BiomeTag.SNOW],
  [BiomeType.MUSHROOM_ISLAND]: [BiomeTag.FOREST],
  [BiomeType.DARK_FOREST]: [BiomeTag.FOREST, BiomeTag.SWAMP],
  [BiomeType.FLOWER_FOREST]: [BiomeTag.FOREST, BiomeTag.PLAINS],
  [BiomeType.CHERRY_GROVE]: [BiomeTag.FOREST, BiomeTag.PLAINS],
  [BiomeType.ORANGE_GROVE]: [BiomeTag.FOREST, BiomeTag.PLAINS],
  [BiomeType.MEADOW]: [BiomeTag.PLAINS],
  [BiomeType.DEEP_OCEAN]: [BiomeTag.OCEAN],
  [BiomeType.FROZEN_OCEAN]: [BiomeTag.OCEAN, BiomeTag.SNOW],
  [BiomeType.RIVER]: [BiomeTag.OCEAN, BiomeTag.PLAINS],
  [BiomeType.BAMBOO_JUNGLE]: [BiomeTag.JUNGLE, BiomeTag.FOREST],
  [BiomeType.SPARSE_JUNGLE]: [BiomeTag.JUNGLE, BiomeTag.FOREST],
  [BiomeType.WINDSWEPT_HILLS]: [BiomeTag.MOUNTAIN, BiomeTag.PLAINS],
  [BiomeType.STONY_PEAKS]: [BiomeTag.MOUNTAIN],
  [BiomeType.SNOWY_SLOPES]: [BiomeTag.SNOW, BiomeTag.MOUNTAIN],
};

export function getBiomeTags(biome: BiomeType): BiomeTag[] {
  return BIOME_TO_TAGS[biome] || [];
}

export function biomeMatchesRules(biome: BiomeType, rules: PlacementRules): boolean {
  // Check excluded biomes
  if (rules.excludedBiomes?.includes(biome)) {
    return false;
  }
  
  // Check required biomes
  if (rules.requiredBiomes && rules.requiredBiomes.length > 0) {
    if (!rules.requiredBiomes.includes(biome)) {
      return false;
    }
  }
  
  // Check excluded tags
  const biomeTags = getBiomeTags(biome);
  if (rules.excludedTags) {
    for (const tag of rules.excludedTags) {
      if (biomeTags.includes(tag)) {
        return false;
      }
    }
  }
  
  // Check required tags
  if (rules.requiredTags && rules.requiredTags.length > 0) {
    const hasRequiredTag = rules.requiredTags.some(tag => biomeTags.includes(tag));
    if (!hasRequiredTag) {
      return false;
    }
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Registry
// ─────────────────────────────────────────────────────────────────────────────
class StructureRegistry {
  private structures: Map<string, StructureTemplate> = new Map();
  private categories: Map<StructureCategory, Set<string>> = new Map();
  private packs: Map<string, Set<string>> = new Map();
  
  register(template: StructureTemplate): void {
    // Validate
    if (this.structures.has(template.id)) {
      console.warn(`Structure ${template.id} already registered, overwriting`);
    }
    
    this.structures.set(template.id, template);
    
    // Track by category
    if (!this.categories.has(template.category)) {
      this.categories.set(template.category, new Set());
    }
    this.categories.get(template.category)!.add(template.id);
    
    // Track by pack
    if (template.packId) {
      if (!this.packs.has(template.packId)) {
        this.packs.set(template.packId, new Set());
      }
      this.packs.get(template.packId)!.add(template.id);
    }
  }
  
  get(id: string): StructureTemplate | undefined {
    return this.structures.get(id);
  }
  
  getByCategory(category: StructureCategory): StructureTemplate[] {
    const ids = this.categories.get(category);
    if (!ids) return [];
    return Array.from(ids).map(id => this.structures.get(id)!).filter(Boolean);
  }
  
  getByPack(packId: string): StructureTemplate[] {
    const ids = this.packs.get(packId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.structures.get(id)!).filter(Boolean);
  }
  
  getAll(): StructureTemplate[] {
    return Array.from(this.structures.values());
  }
  
  getVanilla(): StructureTemplate[] {
    return this.getAll().filter(s => !s.packId);
  }
  
  getModded(): StructureTemplate[] {
    return this.getAll().filter(s => s.packId);
  }
  
  clear(): void {
    this.structures.clear();
    this.categories.clear();
    this.packs.clear();
  }
  
  clearPack(packId: string): void {
    const ids = this.packs.get(packId);
    if (ids) {
      for (const id of ids) {
        this.structures.delete(id);
      }
      this.categories.forEach(set => {
        ids.forEach(id => set.delete(id));
      });
      this.packs.delete(packId);
    }
  }
}

export const structureRegistry = new StructureRegistry();
