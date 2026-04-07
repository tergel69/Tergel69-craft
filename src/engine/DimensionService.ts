/**
 * DimensionService - Interface for dimension management and portal routing
 * 
 * This module provides the authoritative interface for dimension transitions,
 * per-dimension world state, and portal coordinate mapping. Designed to be
 * MP-ready with clear server authority boundaries.
 */

import { DimensionId } from './ProgressionState';
import { Vector3 } from '@/utils/coordinates';

export interface DimensionConfig {
  id: DimensionId;
  name: string;
  spawnPosition: Vector3;
  skyColor?: string;
  fogColor?: string;
  cloudHeight?: number;
  hasWeather: boolean;
  hasDaylightCycle: boolean;
  bedWorks: boolean;
  respawnAnchorWorks: boolean;
  ceilingHeight?: number; // For Nether (bedrock ceiling)
  floorHeight?: number;   // For Nether (bedrock floor)
}

export interface PortalLink {
  fromDimension: DimensionId;
  fromKey: string; // chunk key of portal location
  toDimension: DimensionId;
  toKey: string;
  position: Vector3;
}

export interface DimensionState {
  currentDimension: DimensionId;
  availableDimensions: DimensionId[];
  portalLinks: Map<string, PortalLink>; // unique key -> link
  dimensionSpawnPoints: Map<DimensionId, Vector3>;
}

export const OVERWORLD_CONFIG: DimensionConfig = {
  id: 'overworld',
  name: 'Overworld',
  spawnPosition: { x: 0, y: 64, z: 0 },
  skyColor: '#87CEEB',
  fogColor: '#C0D8F0',
  cloudHeight: 128,
  hasWeather: true,
  hasDaylightCycle: true,
  bedWorks: true,
  respawnAnchorWorks: false,
};

export const NETHER_CONFIG: DimensionConfig = {
  id: 'nether',
  name: 'The Nether',
  spawnPosition: { x: 0, y: 64, z: 0 },
  skyColor: '#3D0000',
  fogColor: '#6B1A0F',
  cloudHeight: undefined, // No clouds in Nether
  hasWeather: false,
  hasDaylightCycle: false,
  bedWorks: false, // Beds explode in Nether
  respawnAnchorWorks: true,
  ceilingHeight: 127,
  floorHeight: 0,
};

export const END_CONFIG: DimensionConfig = {
  id: 'end',
  name: 'The End',
  spawnPosition: { x: 0, y: 48, z: 0 },
  skyColor: '#000000',
  fogColor: '#0A0A0A',
  cloudHeight: undefined, // No clouds in End
  hasWeather: false,
  hasDaylightCycle: false,
  bedWorks: false, // Beds explode in End
  respawnAnchorWorks: false,
};

export const DIMENSION_CONFIGS: Record<DimensionId, DimensionConfig> = {
  overworld: OVERWORLD_CONFIG,
  nether: NETHER_CONFIG,
  end: END_CONFIG,
};

/**
 * Coordinate scaling between dimensions
 */
export const DIMENSION_SCALE: Record<DimensionId, number> = {
  overworld: 1,
  nether: 8, // 1 block in Nether = 8 blocks in Overworld
  end: 1,
};

/**
 * Calculate linked portal coordinates between dimensions
 */
export function calculatePortalLink(
  fromDimension: DimensionId,
  fromPosition: Vector3
): { targetDimension: DimensionId; targetPosition: Vector3 } {
  let targetDimension: DimensionId;
  let scale: number;
  
  if (fromDimension === 'overworld') {
    targetDimension = 'nether';
    scale = DIMENSION_SCALE.nether / DIMENSION_SCALE.overworld;
  } else if (fromDimension === 'nether') {
    targetDimension = 'overworld';
    scale = DIMENSION_SCALE.overworld / DIMENSION_SCALE.nether;
  } else {
    // End doesn't have coordinate scaling
    return {
      targetDimension: 'overworld',
      targetPosition: { ...fromPosition },
    };
  }
  
  return {
    targetDimension,
    targetPosition: {
      x: Math.floor(fromPosition.x * scale),
      y: fromPosition.y,
      z: Math.floor(fromPosition.z * scale),
    },
  };
}

/**
 * Find or create a portal link
 */
export function findOrCreatePortalLink(
  state: DimensionState,
  fromDimension: DimensionId,
  fromPosition: Vector3,
  searchRadius: number = 128
): PortalLink | null {
  // First, check if there's an existing link nearby
  const fromChunkKey = `${Math.floor(fromPosition.x / 16)},${Math.floor(fromPosition.z / 16)}`;
  
  // Search for existing links in this area
  for (const [key, link] of state.portalLinks) {
    if (link.fromDimension === fromDimension && link.fromKey === fromChunkKey) {
      return link;
    }
  }
  
  // No existing link found - would need to create one
  // In a full implementation, this would search for existing portals
  // and potentially generate a new one if none exists
  
  return null;
}

/**
 * Create initial dimension state
 */
export function createInitialDimensionState(): DimensionState {
  return {
    currentDimension: 'overworld',
    availableDimensions: ['overworld'], // Start with only overworld
    portalLinks: new Map(),
    dimensionSpawnPoints: new Map([
      ['overworld', { ...OVERWORLD_CONFIG.spawnPosition }],
      ['nether', { ...NETHER_CONFIG.spawnPosition }],
      ['end', { ...END_CONFIG.spawnPosition }],
    ]),
  };
}

/**
 * Add a dimension to available dimensions (e.g., after unlocking Nether)
 */
export function unlockDimension(state: DimensionState, dimension: DimensionId): DimensionState {
  if (state.availableDimensions.includes(dimension)) {
    return state;
  }
  
  return {
    ...state,
    availableDimensions: [...state.availableDimensions, dimension],
  };
}

/**
 * Register a portal link
 */
export function registerPortalLink(
  state: DimensionState,
  link: PortalLink
): DimensionState {
  const uniqueKey = `${link.fromDimension}:${link.fromKey}->${link.toDimension}:${link.toKey}`;
  
  const newLinks = new Map(state.portalLinks);
  newLinks.set(uniqueKey, link);
  
  return {
    ...state,
    portalLinks: newLinks,
  };
}

/**
 * Set spawn point for a dimension
 */
export function setDimensionSpawnPoint(
  state: DimensionState,
  dimension: DimensionId,
  position: Vector3
): DimensionState {
  const newSpawns = new Map(state.dimensionSpawnPoints);
  newSpawns.set(dimension, position);
  
  return {
    ...state,
    dimensionSpawnPoints: newSpawns,
  };
}

/**
 * Get spawn point for current dimension
 */
export function getCurrentSpawnPoint(state: DimensionState): Vector3 {
  return state.dimensionSpawnPoints.get(state.currentDimension) 
    || DIMENSION_CONFIGS[state.currentDimension].spawnPosition;
}

/**
 * Change current dimension
 */
export function setCurrentDimension(
  state: DimensionState,
  dimension: DimensionId
): DimensionState {
  if (!state.availableDimensions.includes(dimension)) {
    throw new Error(`Dimension ${dimension} is not yet unlocked`);
  }
  
  return {
    ...state,
    currentDimension: dimension,
  };
}

/**
 * Serialize dimension state for storage
 */
export function serializeDimensionState(state: DimensionState): any {
  return {
    ...state,
    portalLinks: Array.from(state.portalLinks.entries()),
    dimensionSpawnPoints: Array.from(state.dimensionSpawnPoints.entries()),
  };
}

/**
 * Deserialize dimension state from storage
 */
export function deserializeDimensionState(data: any): DimensionState {
  return {
    ...data,
    portalLinks: new Map(data.portalLinks || []),
    dimensionSpawnPoints: new Map(data.dimensionSpawnPoints || []),
  };
}
