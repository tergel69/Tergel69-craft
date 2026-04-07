/**
 * Engine Module Index - Modern Minecraft Upgrade (Phase 0 Foundation)
 * 
 * This module exports all core engine systems for the modern Minecraft upgrade roadmap.
 * All systems are designed with MP-ready architecture boundaries.
 */

// Progression & Game Rules
export {
  // Types
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
  // Constants
  DEFAULT_GAME_RULES,
  CURRENT_SCHEMA_VERSION,
  // Functions
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
export {
  // Types
  DimensionConfig,
  PortalLink,
  DimensionState,
  // Constants
  OVERWORLD_CONFIG,
  NETHER_CONFIG,
  END_CONFIG,
  DIMENSION_CONFIGS,
  DIMENSION_SCALE,
  // Functions
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
export {
  // Interfaces
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
  // Classes
  LootTableRegistry,
  PotionRecipeRegistry,
  VillagerProfessionRegistry,
  StructureRegistry,
  AdvancementRegistry,
  BiomeDecorationRegistry,
  // Instances
  lootTableRegistry,
  potionRecipeRegistry,
  villagerProfessionRegistry,
  structureRegistry,
  advancementRegistry,
  biomeDecorationRegistry,
  // Functions
  registerDefaultContent,
} from './ContentRegistry';

// Tick Systems
export {
  // Interfaces
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
  // Types
  TickType,
  TickHandler,
  // Constants
  DEFAULT_TICK_CONFIG,
  // Classes
  TickScheduler,
  // Functions
  createDefaultHandlers,
  // Instance
  globalTickScheduler,
} from './TickSystems';
