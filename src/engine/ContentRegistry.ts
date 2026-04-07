/**
 * ContentRegistry - Data-driven registry contract for game content
 * 
 * This module provides a centralized registry for structures, loot tables,
 * potion recipes, trades, advancements, and other data-driven content.
 * All content is registered as data rather than hardcoded in gameplay loops.
 */

export interface LootTableEntry {
  item: string;
  minCount: number;
  maxCount: number;
  weight: number;
  conditions?: LootCondition[];
  functions?: LootFunction[];
}

export interface LootCondition {
  condition: 'random_chance' | 'killed_by_player' | 'entity_properties' | string;
  [key: string]: any;
}

export interface LootFunction {
  function: 'set_count' | 'enchant_randomly' | 'set_damage' | string;
  [key: string]: any;
}

export interface LootTable {
  id: string;
  pools: {
    rolls: number | { min: number; max: number };
    entries: LootTableEntry[];
    bonusRolls?: number;
    conditions?: LootCondition[];
  }[];
}

export interface PotionRecipe {
  id: string;
  basePotion: string; // e.g., 'awkward', 'thick', 'mundane'
  ingredient: string; // item ID
  resultPotion: string;
  duration?: number; // optional custom duration
  amplifier?: number; // optional custom amplifier
}

export interface TradeOffer {
  buyPrimary: { item: string; count: number };
  buySecondary?: { item: string; count: number };
  sell: { item: string; count: number };
  maxUses: number;
  xp: number;
  priceMultiplier?: number;
  demand?: number;
  specialPrice?: number;
}

export interface VillagerProfession {
  id: string;
  displayName: string;
  workStation: string;
  trades: {
    level: number;
    offers: TradeOffer[];
  }[];
}

export interface StructureConfig {
  id: string;
  type: StructureType;
  biomeWhitelist?: string[];
  biomeBlacklist?: string[];
  spawnProbability: number;
  separation: number; // minimum chunks between structures
  spacing: number; // average chunks between structures
  lootTables: string[]; // IDs of loot tables used
  entitySpawns?: StructureEntitySpawn[];
}

export type StructureType =
  | 'nether_fortress'
  | 'bastion_remnant'
  | 'stronghold'
  | 'end_city'
  | 'dungeon'
  | 'desert_temple'
  | 'jungle_temple'
  | 'witch_hut'
  | 'ocean_monument'
  | 'mansion'
  | 'mineshaft'
  | 'shipwreck'
  | 'ruined_portal'
  | 'pillager_outpost'
  | 'ancient_city';

export interface StructureEntitySpawn {
  entityType: string;
  minCount: number;
  maxCount: number;
  spawnType: 'interior' | 'exterior' | 'patrol';
}

export interface AdvancementConfig {
  id: string;
  parentId?: string;
  display: {
    title: string;
    description: string;
    icon: { item: string; damage?: number };
    frame: 'task' | 'challenge' | 'goal';
    showToast: boolean;
    announceToChat: boolean;
    hidden: boolean;
  };
  criteria: Record<string, AdvancementCriterion>;
  rewards?: {
    loot?: string[];
    experience?: number;
    recipes?: string[];
    function?: string;
  };
}

export interface AdvancementCriterion {
  trigger: string;
  conditions?: Record<string, any>;
}

export interface BiomeDecoration {
  id: string;
  biome: string;
  features: BiomeFeature[];
}

export interface BiomeFeature {
  feature: 'tree' | 'flower' | 'ore' | 'lake' | 'structure';
  config: any;
  chance?: number;
  count?: number | { min: number; max: number };
}

// ============================================
// REGISTRY CLASSES
// ============================================

class Registry<T extends { id: string }> {
  protected entries: Map<string, T> = new Map();
  
  register(entry: T): void {
    if (this.entries.has(entry.id)) {
      console.warn(`Registry entry ${entry.id} already exists, overwriting`);
    }
    this.entries.set(entry.id, entry);
  }
  
  get(id: string): T | undefined {
    return this.entries.get(id);
  }
  
  has(id: string): boolean {
    return this.entries.has(id);
  }
  
  getAll(): T[] {
    return Array.from(this.entries.values());
  }
  
  getIds(): string[] {
    return Array.from(this.entries.keys());
  }
  
  clear(): void {
    this.entries.clear();
  }
}

export class LootTableRegistry extends Registry<LootTable> {
  getLootTable(id: string): LootTable | undefined {
    return this.get(id);
  }
}

export class PotionRecipeRegistry extends Registry<PotionRecipe> {
  getRecipeById(id: string): PotionRecipe | undefined {
    return this.get(id);
  }
  
  getRecipesByIngredient(ingredient: string): PotionRecipe[] {
    return this.getAll().filter(r => r.ingredient === ingredient);
  }
  
  getRecipesByBase(basePotion: string): PotionRecipe[] {
    return this.getAll().filter(r => r.basePotion === basePotion);
  }
}

export class VillagerProfessionRegistry extends Registry<VillagerProfession> {
  getProfession(id: string): VillagerProfession | undefined {
    return this.get(id);
  }
  
  getTradesForLevel(professionId: string, level: number): TradeOffer[] {
    const profession = this.get(professionId);
    if (!profession) return [];
    
    const levelData = profession.trades.find(t => t.level === level);
    return levelData?.offers || [];
  }
}

export class StructureRegistry extends Registry<StructureConfig> {
  getStructure(id: string): StructureConfig | undefined {
    return this.get(id);
  }
  
  getStructuresForBiome(biome: string): StructureConfig[] {
    return this.getAll().filter(s => {
      if (s.biomeBlacklist?.includes(biome)) return false;
      if (s.biomeWhitelist && !s.biomeWhitelist.includes(biome)) return false;
      return true;
    });
  }
}

export class AdvancementRegistry extends Registry<AdvancementConfig> {
  getAdvancement(id: string): AdvancementConfig | undefined {
    return this.get(id);
  }
  
  getRootAdvancements(): AdvancementConfig[] {
    return this.getAll().filter(a => !a.parentId);
  }
  
  getChildAdvancements(parentId: string): AdvancementConfig[] {
    return this.getAll().filter(a => a.parentId === parentId);
  }
  
  getAdvancementTree(): AdvancementConfig[] {
    // Return all advancements sorted by parent-child relationship
    const all = this.getAll();
    const root = all.filter(a => !a.parentId);
    const withChildren = [...root];
    
    let added = true;
    while (added) {
      added = false;
      for (const adv of all) {
        if (adv.parentId && withChildren.some(a => a.id === adv.parentId) && !withChildren.some(a => a.id === adv.id)) {
          withChildren.push(adv);
          added = true;
        }
      }
    }
    
    return withChildren;
  }
}

export class BiomeDecorationRegistry extends Registry<BiomeDecoration> {
  getDecorationsForBiome(biome: string): BiomeDecoration | undefined {
    return this.get(biome);
  }
}

// ============================================
// GLOBAL REGISTRY INSTANCES
// ============================================

export const lootTableRegistry = new LootTableRegistry();
export const potionRecipeRegistry = new PotionRecipeRegistry();
export const villagerProfessionRegistry = new VillagerProfessionRegistry();
export const structureRegistry = new StructureRegistry();
export const advancementRegistry = new AdvancementRegistry();
export const biomeDecorationRegistry = new BiomeDecorationRegistry();

// ============================================
// DEFAULT CONTENT REGISTRATION
// ============================================

export function registerDefaultContent(): void {
  registerDefaultLootTables();
  registerDefaultPotionRecipes();
  registerDefaultStructures();
  registerDefaultAdvancements();
}

function registerDefaultLootTables(): void {
  // Nether Fortress Loot
  lootTableRegistry.register({
    id: 'nether_fortress_corridor',
    pools: [{
      rolls: { min: 2, max: 4 },
      entries: [
        { item: 'gold_ingot', minCount: 1, maxCount: 3, weight: 5 },
        { item: 'iron_ingot', minCount: 1, maxCount: 5, weight: 5 },
        { item: 'redstone', minCount: 2, maxCount: 8, weight: 4 },
        { item: 'blaze_rod', minCount: 1, maxCount: 2, weight: 2 },
        { item: 'golden_sword', minCount: 1, maxCount: 1, weight: 1, functions: [{ function: 'enchant_randomly' }] },
      ],
    }],
  });
  
  // Bastion Remnant Loot
  lootTableRegistry.register({
    id: 'bastion_treasure',
    pools: [{
      rolls: { min: 3, max: 6 },
      entries: [
        { item: 'gold_block', minCount: 2, maxCount: 5, weight: 3 },
        { item: 'ancient_debris', minCount: 1, maxCount: 2, weight: 1 },
        { item: 'diamond', minCount: 1, maxCount: 3, weight: 2 },
        { item: 'netherite_scrap', minCount: 1, maxCount: 1, weight: 1 },
        { item: 'piglin_banner_pattern', minCount: 1, maxCount: 1, weight: 1 },
      ],
    }],
  });
  
  // Dungeon Loot
  lootTableRegistry.register({
    id: 'simple_dungeon',
    pools: [{
      rolls: { min: 2, max: 4 },
      entries: [
        { item: 'bread', minCount: 1, maxCount: 3, weight: 5 },
        { item: 'apple', minCount: 1, maxCount: 3, weight: 5 },
        { item: 'iron_ingot', minCount: 1, maxCount: 5, weight: 4 },
        { item: 'golden_apple', minCount: 1, maxCount: 1, weight: 1 },
        { item: 'saddle', minCount: 1, maxCount: 1, weight: 2 },
      ],
    }],
  });
}

function registerDefaultPotionRecipes(): void {
  // Base potions
  potionRecipeRegistry.register({
    id: 'awkward',
    basePotion: 'water_bottle',
    ingredient: 'nether_wart',
    resultPotion: 'awkward',
  });
  
  // Strength potion
  potionRecipeRegistry.register({
    id: 'strength',
    basePotion: 'awkward',
    ingredient: 'blaze_powder',
    resultPotion: 'strength',
  });
  
  // Fire Resistance
  potionRecipeRegistry.register({
    id: 'fire_resistance',
    basePotion: 'awkward',
    ingredient: 'magma_cream',
    resultPotion: 'fire_resistance',
  });
  
  // Swiftness
  potionRecipeRegistry.register({
    id: 'swiftness',
    basePotion: 'awkward',
    ingredient: 'sugar',
    resultPotion: 'swiftness',
  });
  
  // Healing
  potionRecipeRegistry.register({
    id: 'healing',
    basePotion: 'awkward',
    ingredient: 'glistering_melon',
    resultPotion: 'healing',
  });
  
  // Poison
  potionRecipeRegistry.register({
    id: 'poison',
    basePotion: 'awkward',
    ingredient: 'spider_eye',
    resultPotion: 'poison',
  });
  
  // Night Vision
  potionRecipeRegistry.register({
    id: 'night_vision',
    basePotion: 'awkward',
    ingredient: 'golden_carrot',
    resultPotion: 'night_vision',
  });
  
  // Weakness
  potionRecipeRegistry.register({
    id: 'weakness',
    basePotion: 'water_bottle',
    ingredient: 'fermented_spider_eye',
    resultPotion: 'weakness',
  });
}

function registerDefaultStructures(): void {
  // Nether Fortress
  structureRegistry.register({
    id: 'nether_fortress',
    type: 'nether_fortress',
    biomeWhitelist: ['nether_wastes', 'soul_sand_valley', 'warped_forest', 'crimson_forest'],
    spawnProbability: 0.5,
    separation: 10,
    spacing: 20,
    lootTables: ['nether_fortress_corridor'],
    entitySpawns: [
      { entityType: 'blaze', minCount: 1, maxCount: 2, spawnType: 'interior' },
      { entityType: 'wither_skeleton', minCount: 2, maxCount: 4, spawnType: 'interior' },
    ],
  });
  
  // Bastion Remnant
  structureRegistry.register({
    id: 'bastion_remnant',
    type: 'bastion_remnant',
    biomeWhitelist: ['crimson_forest', 'warped_forest', 'nether_wastes', 'soul_sand_valley'],
    spawnProbability: 0.3,
    separation: 15,
    spacing: 27,
    lootTables: ['bastion_treasure'],
    entitySpawns: [
      { entityType: 'piglin', minCount: 3, maxCount: 6, spawnType: 'exterior' },
      { entityType: 'piglin_brute', minCount: 1, maxCount: 2, spawnType: 'interior' },
    ],
  });
  
  // Stronghold
  structureRegistry.register({
    id: 'stronghold',
    type: 'stronghold',
    biomeBlacklist: ['ocean', 'deep_ocean', 'river'],
    spawnProbability: 1.0,
    separation: 20,
    spacing: 32,
    lootTables: ['simple_dungeon'],
  });
  
  // Dungeon
  structureRegistry.register({
    id: 'dungeon',
    type: 'dungeon',
    spawnProbability: 0.8,
    separation: 4,
    spacing: 8,
    lootTables: ['simple_dungeon'],
    entitySpawns: [
      { entityType: 'skeleton', minCount: 1, maxCount: 2, spawnType: 'interior' },
      { entityType: 'zombie', minCount: 2, maxCount: 4, spawnType: 'interior' },
      { entityType: 'spider', minCount: 1, maxCount: 2, spawnType: 'interior' },
    ],
  });
}

function registerDefaultAdvancements(): void {
  // Root advancement
  advancementRegistry.register({
    id: 'minecraft_root',
    display: {
      title: 'Minecraft',
      description: 'The heart and story of the game',
      icon: { item: 'grass_block' },
      frame: 'task',
      showToast: false,
      announceToChat: false,
      hidden: false,
    },
    criteria: {
      killed_by_something: {
        trigger: 'entity_killed_player',
      },
    },
  });
  
  // Getting Wood
  advancementRegistry.register({
    id: 'getting_wood',
    parentId: 'minecraft_root',
    display: {
      title: 'Getting Wood',
      description: ' Punch a tree until a block of wood pops out',
      icon: { item: 'oak_log' },
      frame: 'task',
      showToast: true,
      announceToChat: false,
      hidden: false,
    },
    criteria: {
      log: {
        trigger: 'inventory_changed',
        conditions: {
          items: [{ items: ['#logs'] }],
        },
      },
    },
  });
  
  // Enter the Nether
  advancementRegistry.register({
    id: 'enter_nether',
    parentId: 'getting_wood',
    display: {
      title: 'We Need to Go Deeper',
      description: 'Build, light and enter a Nether Portal',
      icon: { item: 'obsidian' },
      frame: 'task',
      showToast: true,
      announceToChat: true,
      hidden: false,
    },
    criteria: {
      entered_nether: {
        trigger: 'changed_dimension',
        conditions: {
          to: 'the_nether',
        },
      },
    },
  });
  
  // Kill Ender Dragon
  advancementRegistry.register({
    id: 'kill_dragon',
    parentId: 'enter_nether',
    display: {
      title: 'Free the End',
      description: 'Good luck',
      icon: { item: 'dragon_head' },
      frame: 'goal',
      showToast: true,
      announceToChat: true,
      hidden: false,
    },
    criteria: {
      dragon_killed: {
        trigger: 'player_killed_entity',
        conditions: {
          entity: { type: 'ender_dragon' },
        },
      },
    },
    rewards: {
      experience: 12000,
    },
  });
  
  // Kill Wither
  advancementRegistry.register({
    id: 'kill_wither',
    parentId: 'enter_nether',
    display: {
      title: 'Withering Heights',
      description: 'Summon the Wither, then kill it',
      icon: { item: 'nether_star' },
      frame: 'goal',
      showToast: true,
      announceToChat: true,
      hidden: false,
    },
    criteria: {
      wither_killed: {
        trigger: 'player_killed_entity',
        conditions: {
          entity: { type: 'wither' },
        },
      },
    },
    rewards: {
      experience: 5000,
    },
  });
}
