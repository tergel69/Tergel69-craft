/**
 * Engine Module Index - Modern Minecraft Upgrade (Phase 0 Foundation)
 * 
 * This module exports all core engine systems for the modern Minecraft upgrade roadmap.
 * All systems are designed with MP-ready architecture boundaries.
 */

// Progression & Game Rules
export type {
  BossKillRecord,
  BossType,
  DimensionId,
  StructureDiscovery,
  StructureType,
  AdvancementFlag,
  CraftingTierUnlock,
  CraftingTier,
  GameRules,
  ProgressionStateData,
} from './ProgressionState';

export {
  DEFAULT_GAME_RULES,
  CURRENT_SCHEMA_VERSION,
  createInitialProgressionState,
  recordBossKill,
  discoverStructure,
  visitDimension,
  completeAdvancement,
  unlockCraftingTier,
  setGameRule,
  linkPortals,
  activateEndPortal,
  serializeProgressionState,
  deserializeProgressionState,
  migrateProgressionState,
} from './ProgressionState';

// Dimension Service
export type {
  DimensionConfig,
  PortalLink,
  DimensionState,
} from './DimensionService';

export {
  OVERWORLD_CONFIG,
  NETHER_CONFIG,
  END_CONFIG,
  DIMENSION_CONFIGS,
  DIMENSION_SCALE,
  calculatePortalLink,
  findOrCreatePortalLink,
  createInitialDimensionState,
  unlockDimension,
  registerPortalLink,
  setDimensionSpawnPoint,
  getCurrentSpawnPoint,
  setCurrentDimension,
  serializeDimensionState,
  deserializeDimensionState,
} from './DimensionService';

// Content Registry
export type {
  LootTableEntry,
  LootCondition,
  LootFunction,
  LootTable,
  PotionRecipe,
  TradeOffer,
  VillagerProfession,
  StructureConfig,
  StructureEntitySpawn,
  AdvancementConfig,
  AdvancementCriterion,
  BiomeDecoration,
  BiomeFeature,
  StructureType as RegistryStructureType,
} from './ContentRegistry';

export {
  LootTableRegistry,
  PotionRecipeRegistry,
  VillagerProfessionRegistry,
  StructureRegistry,
  AdvancementRegistry,
  BiomeDecorationRegistry,
  lootTableRegistry,
  potionRecipeRegistry,
  villagerProfessionRegistry,
  structureRegistry,
  advancementRegistry,
  biomeDecorationRegistry,
  registerDefaultContent,
} from './ContentRegistry';

// Tick Systems
export type {
  TickSchedulerConfig,
  ScheduledTick,
  TickResult,
  RedstoneTickData,
  LiquidTickData,
  RandomBlockTickData,
  StatusEffectTickData,
  VillagerTickData,
  MobEventTickData,
  TickContext,
  TickType,
  TickHandler,
} from './TickSystems';

export {
  DEFAULT_TICK_CONFIG,
  TickScheduler,
  createDefaultHandlers,
  globalTickScheduler,
} from './TickSystems';
