/**
 * ProgressionState - Authoritative game rules and progression state module
 * 
 * This module tracks all progression-related flags and game rules in a single
 * source of truth, designed to be MP-ready with server authority boundaries.
 */

export interface BossKillRecord {
  bossType: BossType;
  killedAt: number; // timestamp
  dayCount: number;
}

export type BossType = 'ender_dragon' | 'wither';

export type DimensionId = 'overworld' | 'nether' | 'end';

export interface StructureDiscovery {
  structureType: StructureType;
  discoveredAt: number;
  position: { x: number; y: number; z: number };
  dimension: DimensionId;
}

export type StructureType = 
  | 'stronghold'
  | 'nether_fortress'
  | 'bastion_remnant'
  | 'ancient_city'
  | 'dungeon'
  | 'desert_temple'
  | 'jungle_temple'
  | 'witch_hut'
  | 'ocean_monument'
  | 'mansion'
  | 'mineshaft'
  | 'shipwreck'
  | 'ruined_portal'
  | 'pillager_outpost';

export interface AdvancementFlag {
  advancementId: string;
  completedAt: number;
  criteria: Record<string, boolean>;
}

export interface CraftingTierUnlock {
  tier: CraftingTier;
  unlockedAt: number;
}

export type CraftingTier = 'basic' | 'advanced' | 'magical' | 'late_game';

export interface GameRules {
  doDaylightCycle: boolean;
  doMobSpawning: boolean;
  doTileDrops: boolean;
  doEntityDrops: boolean;
  keepInventory: boolean;
  mobGriefing: boolean;
  naturalRegeneration: boolean;
  reducedDebugInfo: boolean;
  sendCommandFeedback: boolean;
  showDeathMessages: boolean;
  playersSleepingPercentage: number; // 0-100
  randomTickSpeed: number;
  spawnRadius: number;
}

export interface ProgressionStateData {
  // Boss progression
  bossKills: BossKillRecord[];
  
  // Exploration
  discoveredStructures: StructureDiscovery[];
  visitedDimensions: DimensionId[];
  
  // Advancements
  advancements: AdvancementFlag[];
  
  // Crafting progression
  unlockedCraftingTiers: CraftingTierUnlock[];
  
  // Game rules
  gameRules: GameRules;
  
  // Portal linkage (for Nether/End travel)
  netherPortalLink: Map<string, string>; // overworldKey -> netherKey
  endPortalActivated: boolean;
  
  // World events
  raidsTriggered: number;
  elderGuardiansDefeated: number;
  
  // Metadata
  createdAt: number;
  lastUpdatedAt: number;
  schemaVersion: number;
}

export const DEFAULT_GAME_RULES: GameRules = {
  doDaylightCycle: true,
  doMobSpawning: true,
  doTileDrops: true,
  doEntityDrops: true,
  keepInventory: false,
  mobGriefing: true,
  naturalRegeneration: true,
  reducedDebugInfo: false,
  sendCommandFeedback: true,
  showDeathMessages: true,
  playersSleepingPercentage: 100,
  randomTickSpeed: 3,
  spawnRadius: 10,
};

export const CURRENT_SCHEMA_VERSION = 1;

export function createInitialProgressionState(): ProgressionStateData {
  return {
    bossKills: [],
    discoveredStructures: [],
    visitedDimensions: ['overworld'],
    advancements: [],
    unlockedCraftingTiers: [{ tier: 'basic', unlockedAt: Date.now() }],
    gameRules: { ...DEFAULT_GAME_RULES },
    netherPortalLink: new Map(),
    endPortalActivated: false,
    raidsTriggered: 0,
    elderGuardiansDefeated: 0,
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function recordBossKill(state: ProgressionStateData, bossType: BossType, position: { x: number; y: number; z: number }, dayCount: number): ProgressionStateData {
  const newRecord: BossKillRecord = {
    bossType,
    killedAt: Date.now(),
    dayCount,
  };
  
  return {
    ...state,
    bossKills: [...state.bossKills, newRecord],
    lastUpdatedAt: Date.now(),
  };
}

export function discoverStructure(
  state: ProgressionStateData, 
  structureType: StructureType, 
  position: { x: number; y: number; z: number },
  dimension: DimensionId
): ProgressionStateData {
  // Check if already discovered
  const alreadyDiscovered = state.discoveredStructures.some(
    s => s.structureType === structureType && s.dimension === dimension
  );
  
  if (alreadyDiscovered) {
    return state;
  }
  
  const newDiscovery: StructureDiscovery = {
    structureType,
    discoveredAt: Date.now(),
    position,
    dimension,
  };
  
  return {
    ...state,
    discoveredStructures: [...state.discoveredStructures, newDiscovery],
    lastUpdatedAt: Date.now(),
  };
}

export function visitDimension(state: ProgressionStateData, dimension: DimensionId): ProgressionStateData {
  if (state.visitedDimensions.includes(dimension)) {
    return state;
  }
  
  return {
    ...state,
    visitedDimensions: [...state.visitedDimensions, dimension],
    lastUpdatedAt: Date.now(),
  };
}

export function completeAdvancement(
  state: ProgressionStateData,
  advancementId: string,
  criteria: Record<string, boolean> = {}
): ProgressionStateData {
  const existing = state.advancements.find(a => a.advancementId === advancementId);
  
  if (existing) {
    return state;
  }
  
  const newAdvancement: AdvancementFlag = {
    advancementId,
    completedAt: Date.now(),
    criteria,
  };
  
  return {
    ...state,
    advancements: [...state.advancements, newAdvancement],
    lastUpdatedAt: Date.now(),
  };
}

export function unlockCraftingTier(state: ProgressionStateData, tier: CraftingTier): ProgressionStateData {
  const alreadyUnlocked = state.unlockedCraftingTiers.some(u => u.tier === tier);
  
  if (alreadyUnlocked) {
    return state;
  }
  
  const newUnlock: CraftingTierUnlock = {
    tier,
    unlockedAt: Date.now(),
  };
  
  return {
    ...state,
    unlockedCraftingTiers: [...state.unlockedCraftingTiers, newUnlock],
    lastUpdatedAt: Date.now(),
  };
}

export function setGameRule<K extends keyof GameRules>(
  state: ProgressionStateData,
  rule: K,
  value: GameRules[K]
): ProgressionStateData {
  return {
    ...state,
    gameRules: {
      ...state.gameRules,
      [rule]: value,
    },
    lastUpdatedAt: Date.now(),
  };
}

export function linkPortals(
  state: ProgressionStateData,
  overworldKey: string,
  netherKey: string
): ProgressionStateData {
  const newMap = new Map(state.netherPortalLink);
  newMap.set(overworldKey, netherKey);
  
  return {
    ...state,
    netherPortalLink: newMap,
    lastUpdatedAt: Date.now(),
  };
}

export function activateEndPortal(state: ProgressionStateData): ProgressionStateData {
  if (state.endPortalActivated) {
    return state;
  }
  
  return {
    ...state,
    endPortalActivated: true,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Serialize progression state for storage (converts Map to object)
 */
export function serializeProgressionState(state: ProgressionStateData): any {
  return {
    ...state,
    netherPortalLink: Array.from(state.netherPortalLink.entries()),
  };
}

/**
 * Deserialize progression state from storage (converts object back to Map)
 */
export function deserializeProgressionState(data: any): ProgressionStateData {
  return {
    ...data,
    netherPortalLink: new Map(data.netherPortalLink || []),
  };
}

/**
 * Migration pipeline for schema version upgrades
 */
export function migrateProgressionState(data: any, fromVersion: number, toVersion: number = CURRENT_SCHEMA_VERSION): ProgressionStateData {
  let currentState = deserializeProgressionState(data);
  
  for (let version = fromVersion; version < toVersion; version++) {
    currentState = migrateToNextVersion(currentState, version);
  }
  
  currentState.schemaVersion = toVersion;
  return currentState;
}

function migrateToNextVersion(state: ProgressionStateData, fromVersion: number): ProgressionStateData {
  switch (fromVersion) {
    case 0:
      // Initial migration: add default game rules if missing
      return {
        ...state,
        gameRules: state.gameRules || { ...DEFAULT_GAME_RULES },
      };
    default:
      return state;
  }
}
