import { BlockType } from '@/data/blocks';
import { BiomeTag, StructureCategory, StructureTemplate, structureRegistry } from './StructureRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// Modded Structure Pack System (Simplified - uses available blocks only)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModdedStructurePack {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  
  // Theme
  theme: 'fantasy' | 'tech' | 'magical' | 'industrial' | 'nature' | 'ruined';
  
  // Allowed biomes for spawning
  allowedBiomes: BiomeTag[];
  
  // Spawn settings
  rarity: number;
  minSpacing: number;
  gridSize: number;
  
  // Loot table prefix
  lootTablePrefix: string;
  
  // Structure IDs in this pack
  structures: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pack Definitions - using only available blocks
// ─────────────────────────────────────────────────────────────────────────────

export const FANTASY_PACK: ModdedStructurePack = {
  id: 'fantasy',
  name: 'Fantasy Structures',
  description: 'Magical fantasy structures including castles and wizard towers',
  author: 'Minecraft Web',
  version: '1.0.0',
  theme: 'fantasy',
  allowedBiomes: [BiomeTag.FOREST, BiomeTag.PLAINS, BiomeTag.MOUNTAIN],
  rarity: 0.15,
  minSpacing: 12,
  gridSize: 10,
  lootTablePrefix: 'fantasy',
  structures: ['fantasy_castle', 'wizard_tower', 'druid_circle'],
};

export const RUINED_PACK: ModdedStructurePack = {
  id: 'ruined',
  name: 'Ruined Structures',
  description: 'Abandoned and decayed structures',
  author: 'Minecraft Web',
  version: '1.0.0',
  theme: 'ruined',
  allowedBiomes: [BiomeTag.FOREST, BiomeTag.PLAINS, BiomeTag.MOUNTAIN, BiomeTag.SWAMP],
  rarity: 0.18,
  minSpacing: 8,
  gridSize: 8,
  lootTablePrefix: 'ruined',
  structures: ['abandoned_shelter', 'ruined_tower', 'overgrown_cabin'],
};

export const NATURE_PACK: ModdedStructurePack = {
  id: 'nature',
  name: 'Nature Structures',
  description: 'Organic and natural structures',
  author: 'Minecraft Web',
  version: '1.0.0',
  theme: 'nature',
  allowedBiomes: [BiomeTag.FOREST, BiomeTag.JUNGLE, BiomeTag.SWAMP],
  rarity: 0.20,
  minSpacing: 6,
  gridSize: 6,
  lootTablePrefix: 'nature',
  structures: ['giant_tree_house', 'forest_camp', 'mushroom_shelter'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pack Registry
// ─────────────────────────────────────────────────────────────────────────────
class ModPackRegistry {
  private packs: Map<string, ModdedStructurePack> = new Map();
  private activePacks: Set<string> = new Set();
  
  register(pack: ModdedStructurePack): void {
    this.packs.set(pack.id, pack);
    console.log(`Registered mod pack: ${pack.name}`);
  }
  
  get(id: string): ModdedStructurePack | undefined {
    return this.packs.get(id);
  }
  
  getAll(): ModdedStructurePack[] {
    return Array.from(this.packs.values());
  }
  
  getActive(): ModdedStructurePack[] {
    return Array.from(this.activePacks).map(id => this.packs.get(id)!).filter(Boolean);
  }
  
  enable(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) {
      console.warn(`Pack ${packId} not found`);
      return false;
    }
    this.activePacks.add(packId);
    console.log(`Enabled pack: ${pack.name}`);
    return true;
  }
  
  disable(packId: string): boolean {
    if (!this.activePacks.has(packId)) return false;
    this.activePacks.delete(packId);
    structureRegistry.clearPack(packId);
    return true;
  }
  
  isEnabled(packId: string): boolean {
    return this.activePacks.has(packId);
  }
  
  registerDefaultPacks(): void {
    this.register(FANTASY_PACK);
    this.register(RUINED_PACK);
    this.register(NATURE_PACK);
  }
}

export const modPackRegistry = new ModPackRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions using available blocks
// ─────────────────────────────────────────────────────────────────────────────
function fill(x: number, y: number, z: number, w: number, h: number, d: number, t: BlockType): any[] {
  const out: any[] = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      for (let dz = 0; dz < d; dz++)
        out.push({ dx: x + dx, dy: y + dy, dz: z + dz, type: t });
  return out;
}

function hollow(x: number, y: number, z: number, w: number, h: number, d: number, t: BlockType): any[] {
  const out: any[] = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      for (let dz = 0; dz < d; dz++)
        if (dx > 0 && dx < w - 1 && dy > 0 && dy < h - 1 && dz > 0 && dz < d - 1) continue;
        else out.push({ dx: x + dx, dy: y + dy, dz: z + dz, type: t });
  return out;
}

function clear(x: number, y: number, z: number, w: number, h: number, d: number): any[] {
  return fill(x, y, z, w, h, d, BlockType.AIR);
}

function b(x: number, y: number, z: number, t: BlockType): any {
  return { dx: x, dy: y, dz: z, type: t };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modded Structure Templates
// ─────────────────────────────────────────────────────────────────────────────

function createFantasyCastleBlocks(): any[] {
  const blocks: any[] = [];
  const P = BlockType.STONEBRICK;
  const C = BlockType.COBBLESTONE;
  const D = BlockType.OAK_LOG;
  const L = BlockType.OAK_PLANKS;
  const G = BlockType.GLASS;
  
  // Foundation
  blocks.push(...fill(0, -1, 0, 20, 1, 16, C));
  
  // Main walls
  blocks.push(...hollow(0, 0, 0, 20, 8, 16, P));
  
  // Corner towers
  for (const [tx, tz] of [[0, 0], [19, 0], [0, 15], [19, 15]]) {
    blocks.push(...fill(tx, 0, tz, 3, 10, 3, C));
  }
  
  // Gate
  blocks.push(...fill(8, 0, 0, 4, 5, 1, C));
  blocks.push(...clear(9, 0, 0, 2, 4, 1));
  
  // Windows
  for (let wx = 3; wx < 17; wx += 4) {
    blocks.push(b(wx, 4, 0, G));
    blocks.push(b(wx, 4, 15, G));
  }
  
  // Interior floor
  blocks.push(...fill(4, 1, 4, 12, 1, 8, L));
  
  return blocks;
}

function createWizardTowerBlocks(): any[] {
  const blocks: any[] = [];
  const S = BlockType.STONEBRICK;
  const C = BlockType.COBBLESTONE;
  const G = BlockType.GLASS;
  const L = BlockType.GLOWSTONE;
  
  // Base
  blocks.push(...fill(0, 0, 0, 8, 1, 8, C));
  blocks.push(...hollow(0, 1, 0, 8, 14, 8, S));
  
  // Windows
  blocks.push(b(1, 4, 0, G));
  blocks.push(b(6, 4, 0, G));
  blocks.push(b(1, 8, 0, G));
  blocks.push(b(6, 8, 0, G));
  
  // Interior
  blocks.push(...clear(1, 1, 1, 6, 12, 6));
  
  // Glowstone at top
  blocks.push(b(3, 15, 3, L));
  blocks.push(b(4, 15, 4, L));
  
  return blocks;
}

function createDruidCircleBlocks(): any[] {
  const blocks: any[] = [];
  const S = BlockType.STONE;
  
  // Stone circle
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * 5);
    const z = Math.round(Math.sin(angle) * 5);
    blocks.push(b(x, 0, z, S));
    blocks.push(b(x, 1, z, S));
  }
  
  // Central altar
  blocks.push(b(0, 0, 0, S));
  blocks.push(b(0, 1, 0, BlockType.GLOWSTONE));
  
  return blocks;
}

// Abundant shelter
function createAbandonedShelterBlocks(): any[] {
  const blocks: any[] = [];
  const W = BlockType.OAK_PLANKS;
  const L = BlockType.OAK_LOG;
  const C = BlockType.COBBLESTONE;
  const V = BlockType.VINE;
  
  // Foundation
  blocks.push(...fill(0, 0, 0, 10, 1, 8, C));
  
  // Walls with gaps (decay)
  blocks.push(...fill(0, 1, 0, 1, 4, 8, W));
  blocks.push(...fill(9, 1, 0, 1, 4, 8, W));
  blocks.push(...fill(0, 1, 0, 10, 4, 1, W));
  blocks.push(...fill(0, 1, 7, 10, 4, 1, W));
  
  // Remove some walls (decay)
  blocks.push(...clear(2, 2, 0, 2, 2, 1));
  blocks.push(...clear(6, 3, 7, 2, 1, 1));
  
  // Roof
  blocks.push(...fill(-1, 5, -1, 12, 1, 10, L));
  
  // Vines
  blocks.push(b(0, 3, 2, V));
  blocks.push(b(9, 2, 5, V));
  
  return blocks;
}

// Ruined tower
function createRuinedTowerBlocks(): any[] {
  const blocks: any[] = [];
  const S = BlockType.STONE;
  const M = BlockType.MOSSY_COBBLESTONE;
  const V = BlockType.VINE;
  
  // Base - partial
  blocks.push(...fill(0, 0, 0, 6, 1, 6, M));
  
  // Walls - broken
  blocks.push(...fill(0, 1, 0, 6, 8, 1, S));
  blocks.push(...fill(0, 1, 5, 6, 5, 1, S)); // Lower on one side
  blocks.push(...fill(0, 1, 0, 1, 6, 6, S));
  blocks.push(...fill(5, 1, 0, 1, 4, 6, S)); // Lower on one side
  
  // Gaps in walls (ruined)
  blocks.push(...clear(2, 2, 0, 2, 2, 1));
  blocks.push(...clear(3, 4, 5, 2, 1, 1));
  
  // Vines growing
  for (let y = 1; y < 6; y++) {
    blocks.push(b(0, y, 2, V));
    blocks.push(b(5, y, 3, V));
  }
  
  return blocks;
}

// Overgrown cabin  
function createOvergrownCabinBlocks(): any[] {
  const blocks: any[] = [];
  const W = BlockType.OAK_PLANKS;
  const L = BlockType.OAK_LOG;
  const C = BlockType.COBBLESTONE;
  const V = BlockType.VINE;
  const G = BlockType.GRASS;
  
  // Foundation
  blocks.push(...fill(0, 0, 0, 8, 1, 6, C));
  
  // Walls
  blocks.push(...hollow(0, 1, 0, 8, 4, 6, W));
  
  // Door gap
  blocks.push(...clear(3, 1, 0, 2, 3, 1));
  
  // Window
  blocks.push(b(1, 2, 0, BlockType.GLASS));
  blocks.push(b(6, 2, 0, BlockType.GLASS));
  
  // Roof
  blocks.push(...fill(-1, 5, -1, 10, 1, 8, L));
  
  // Overgrown - grass inside
  blocks.push(...fill(1, 1, 1, 6, 1, 4, G));
  
  // Vines on walls
  blocks.push(b(0, 2, 2, V));
  blocks.push(b(7, 3, 3, V));
  
  return blocks;
}

// Giant tree house
function createGiantTreeHouseBlocks(): any[] {
  const blocks: any[] = [];
  const L = BlockType.OAK_LOG;
  const P = BlockType.OAK_PLANKS;
  const S = BlockType.OAK_LEAVES;
  
  // Platform
  blocks.push(...fill(-4, 0, -4, 12, 1, 12, P));
  
  // Walls
  blocks.push(...fill(-4, 1, -4, 12, 4, 1, P));
  blocks.push(...fill(-4, 1, 7, 12, 4, 1, P));
  blocks.push(...fill(-4, 1, -4, 1, 4, 12, P));
  blocks.push(...fill(7, 1, -4, 1, 4, 12, P));
  
  // Door
  blocks.push(...clear(2, 1, -4, 2, 3, 1));
  
  // Windows
  blocks.push(b(0, 2, -4, BlockType.GLASS));
  blocks.push(b(5, 2, -4, BlockType.GLASS));
  
  // Roof
  for (let i = 0; i < 3; i++) {
    const offset = i * 2;
    blocks.push(...fill(-5 - offset, 5 + i, -5 - offset, 14 + offset * 2, 1, 14 + offset * 2, L));
  }
  
  // Support logs
  for (const [lx, lz] of [[-2, -2], [5, -2], [-2, 5], [5, 5], [1, -2], [1, 5]]) {
    for (let y = -8; y < 0; y++) {
      blocks.push(b(lx, y, lz, L));
    }
  }
  
  // Leafy base
  blocks.push(...fill(-5, -1, -5, 14, 1, 14, S));
  
  return blocks;
}

// Forest camp
function createForestCampBlocks(): any[] {
  const blocks: any[] = [];
  const C = BlockType.COBBLESTONE;
  const L = BlockType.OAK_LOG;
  const P = BlockType.OAK_PLANKS;
  const T = BlockType.TORCH;
  
  // Campfire (use coal block as placeholder)
  blocks.push(b(0, 0, 0, BlockType.COAL_BLOCK));
  blocks.push(b(0, 1, 0, BlockType.GLOWSTONE));
  
  // Logs around fire
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * 2);
    const z = Math.round(Math.sin(angle) * 2);
    blocks.push(b(x, 0, z, L));
  }
  
  // Tent structure
  blocks.push(...fill(-3, 0, -3, 1, 1, 6, P));
  blocks.push(...fill(3, 0, -3, 1, 1, 6, P));
  blocks.push(...fill(-3, 0, -3, 6, 1, 1, P));
  blocks.push(...fill(-3, 0, 3, 6, 1, 1, P));
  
  // Tent center pole
  blocks.push(b(0, 1, 0, L));
  blocks.push(b(0, 2, 0, L));
  
  // Torches
  blocks.push(b(-4, 1, -4, T));
  blocks.push(b(4, 1, -4, T));
  blocks.push(b(-4, 1, 4, T));
  blocks.push(b(4, 1, 4, T));
  
  return blocks;
}

// Mushroom shelter
function createMushroomShelterBlocks(): any[] {
  const blocks: any[] = [];
  const M = BlockType.MUSHROOM_RED;
  const S = BlockType.MUSHROOM_BROWN;
  const P = BlockType.MUSHROOM_RED;
  
  // Stem
  blocks.push(...fill(0, 0, 0, 6, 8, 6, S));
  
  // Cap
  blocks.push(...fill(-2, 8, -2, 10, 1, 10, M));
  blocks.push(...fill(-1, 9, -1, 8, 1, 8, P));
  
  // Doorway
  blocks.push(...clear(2, 0, 0, 2, 3, 1));
  
  // Windows (glowing spots)
  blocks.push(b(0, 4, 0, BlockType.GLOWSTONE));
  blocks.push(b(5, 4, 5, BlockType.GLOWSTONE));
  
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Register Modded Structures
// ─────────────────────────────────────────────────────────────────────────────
export function registerModdedStructures(): void {
  // Fantasy pack
  structureRegistry.register({
    id: 'fantasy_castle',
    name: 'Fantasy Castle',
    category: StructureCategory.VILLAGE,
    gridSize: 10,
    probability: 0.12,
    footprintX: 24,
    footprintZ: 20,
    heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.STONE],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.PLAINS],
      excludedTags: [BiomeTag.SNOW, BiomeTag.OCEAN, BiomeTag.DESERT],
      minSpacing: 12,
      dimension: 'overworld',
      terrainSlope: 'flat',
    },
    blocks: createFantasyCastleBlocks(),
    variants: 3,
    packId: 'fantasy',
    hasTerrainBlend: true,
    hasDecay: false,
  });
  
  structureRegistry.register({
    id: 'wizard_tower',
    name: 'Wizard Tower',
    category: StructureCategory.TEMPLE,
    gridSize: 12,
    probability: 0.10,
    footprintX: 10,
    footprintZ: 10,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.MOUNTAIN],
      minSpacing: 10,
      dimension: 'overworld',
    },
    blocks: createWizardTowerBlocks(),
    variants: 2,
    packId: 'fantasy',
    hasDecay: true,
  });
  
  structureRegistry.register({
    id: 'druid_circle',
    name: 'Druid Stone Circle',
    category: StructureCategory.RUIN,
    gridSize: 8,
    probability: 0.15,
    footprintX: 14,
    footprintZ: 14,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST],
      minSpacing: 6,
      dimension: 'overworld',
    },
    blocks: createDruidCircleBlocks(),
    packId: 'fantasy',
    hasDecay: false,
  });
  
  // Ruined pack
  structureRegistry.register({
    id: 'abandoned_shelter',
    name: 'Abandoned Shelter',
    category: StructureCategory.RUIN,
    gridSize: 8,
    probability: 0.15,
    footprintX: 12,
    footprintZ: 10,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.PLAINS],
      minSpacing: 6,
      dimension: 'overworld',
    },
    blocks: createAbandonedShelterBlocks(),
    packId: 'ruined',
    hasDecay: true,
  });
  
  structureRegistry.register({
    id: 'ruined_tower',
    name: 'Ruined Tower',
    category: StructureCategory.RUIN,
    gridSize: 10,
    probability: 0.12,
    footprintX: 8,
    footprintZ: 8,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.STONE],
    placementRules: {
      requiredTags: [BiomeTag.MOUNTAIN, BiomeTag.FOREST],
      minSpacing: 8,
      dimension: 'overworld',
    },
    blocks: createRuinedTowerBlocks(),
    packId: 'ruined',
    hasDecay: true,
  });
  
  structureRegistry.register({
    id: 'overgrown_cabin',
    name: 'Overgrown Cabin',
    category: StructureCategory.RUIN,
    gridSize: 8,
    probability: 0.14,
    footprintX: 10,
    footprintZ: 8,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.SWAMP],
      minSpacing: 6,
      dimension: 'overworld',
    },
    blocks: createOvergrownCabinBlocks(),
    packId: 'ruined',
    hasDecay: true,
    hasTerrainBlend: true,
  });
  
  // Nature pack
  structureRegistry.register({
    id: 'giant_tree_house',
    name: 'Giant Tree House',
    category: StructureCategory.NATURAL,
    gridSize: 6,
    probability: 0.18,
    footprintX: 14,
    footprintZ: 14,
    heightOffset: 8,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST],
      minSpacing: 4,
      dimension: 'overworld',
    },
    blocks: createGiantTreeHouseBlocks(),
    variants: 2,
    packId: 'nature',
    hasTerrainBlend: true,
  });
  
  structureRegistry.register({
    id: 'forest_camp',
    name: 'Forest Camp',
    category: StructureCategory.NATURAL,
    gridSize: 4,
    probability: 0.25,
    footprintX: 10,
    footprintZ: 10,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.PLAINS],
      minSpacing: 3,
      dimension: 'overworld',
    },
    blocks: createForestCampBlocks(),
    packId: 'nature',
  });
  
  structureRegistry.register({
    id: 'mushroom_shelter',
    name: 'Mushroom Shelter',
    category: StructureCategory.NATURAL,
    gridSize: 5,
    probability: 0.15,
    footprintX: 8,
    footprintZ: 8,
    heightOffset: 0,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.DIRT],
    placementRules: {
      requiredTags: [BiomeTag.FOREST, BiomeTag.SWAMP],
      minSpacing: 4,
      dimension: 'overworld',
    },
    blocks: createMushroomShelterBlocks(),
    packId: 'nature',
  });
  
  console.log('Registered modded structures');
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────────────────────────────────────
export function initializeStructurePacks(): void {
  modPackRegistry.registerDefaultPacks();
  registerModdedStructures();
  
  // Enable packs by default (can be toggled)
  modPackRegistry.enable('fantasy');
  modPackRegistry.enable('ruined');
  modPackRegistry.enable('nature');
  
  console.log('Structure packs initialized');
}