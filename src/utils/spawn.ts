import { isLiquid, isSolid } from '@/data/blocks';
import { CHUNK_HEIGHT, SEA_LEVEL } from '@/utils/constants';
import { worldToChunk } from '@/utils/coordinates';
import { useWorldStore } from '@/stores/worldStore';

export type SpawnSource = 'surface' | 'fallback';

export interface SpawnPosition {
  x: number;
  y: number;
  z: number;
}

export interface SpawnResult {
  position: SpawnPosition;
  source: SpawnSource;
  reason: string;
  anchor: { x: number; z: number };
  checkedColumns: number;
  loadedColumns: number;
}

export interface SpawnSearchOptions {
  originX: number;
  originZ: number;
  searchRadius?: number;
  requireLoadedChunks?: boolean;
  minimumLoadedSamples?: number;
  allowFallback?: boolean;
  fallbackY?: number;
}

const DEFAULT_SEARCH_RADIUS = 64;
const DEFAULT_MINIMUM_LOADED_SAMPLES = 2; // Reduced from 3 for better spawn success
const DEFAULT_FALLBACK_Y = 180;
const COLUMN_CLEARANCE = 2;
const MIN_SURFACE_Y = SEA_LEVEL - 5; // Allow spawn near and slightly below water level

function seededOffset(seed: number, salt: number, spread: number): number {
  const n = Math.sin((seed + salt * 1013.37) * 12.9898 + salt * 78.233) * 43758.5453;
  const fraction = n - Math.floor(n);
  return Math.floor((fraction * 2 - 1) * spread);
}

export function getDeterministicSpawnAnchor(seed: number, spread: number = 256): { x: number; z: number } {
  return {
    x: seededOffset(seed, 1, spread),
    z: seededOffset(seed, 2, spread),
  };
}

function getLoadedChunkCoverage(worldX: number, worldZ: number, minimumLoadedSamples: number): number {
  const world = useWorldStore.getState();
  const samples: Array<[number, number]> = [
    [worldX, worldZ],
    [worldX + COLUMN_CLEARANCE * 4, worldZ],
    [worldX, worldZ + COLUMN_CLEARANCE * 4],
    [worldX - COLUMN_CLEARANCE * 4, worldZ - COLUMN_CLEARANCE * 4],
  ];

  let loaded = 0;
  for (const [sampleX, sampleZ] of samples) {
    const chunk = worldToChunk(sampleX, sampleZ);
    if (world.isChunkLoaded(chunk.x, chunk.z)) loaded++;
  }

  // Return loaded count even if less than minimum (will be used as coverage check)
  return loaded;
}

function findSurfaceY(worldX: number, worldZ: number): number | null {
  const world = useWorldStore.getState();
  const fx = Math.floor(worldX);
  const fz = Math.floor(worldZ);

  for (let y = CHUNK_HEIGHT - 3; y >= 1; y--) {
    const ground = world.getBlock(fx, y, fz);
    if (!isSolid(ground) || isLiquid(ground)) continue;

    const feet = world.getBlock(fx, y + 1, fz);
    const head = world.getBlock(fx, y + 2, fz);

    if (isSolid(feet) || isSolid(head)) continue;
    if (isLiquid(feet) || isLiquid(head)) continue;

    return y + 1;
  }

  return null;
}

function hasOpenSkyAbove(worldX: number, worldZ: number, surfaceY: number): boolean {
  const world = useWorldStore.getState();
  const fx = Math.floor(worldX);
  const fz = Math.floor(worldZ);

  for (let y = surfaceY + 1; y < CHUNK_HEIGHT; y++) {
    const block = world.getBlock(fx, y, fz);
    if (!isSolid(block) && !isLiquid(block)) continue;
    return false;
  }

  return true;
}

// Check if there's solid land nearby (not just water surface)
function hasNearbyLand(worldX: number, worldZ: number, searchRadius: number = 8): boolean {
  const world = useWorldStore.getState();
  const fx = Math.floor(worldX);
  const fz = Math.floor(worldZ);

  for (let dx = -searchRadius; dx <= searchRadius; dx++) {
    for (let dz = -searchRadius; dz <= searchRadius; dz++) {
      if (dx === 0 && dz === 0) continue;
      
      // Check if there's solid ground below the surface at this location
      for (let y = 1; y < SEA_LEVEL; y++) {
        const block = world.getBlock(fx + dx, y, fz + dz);
        if (isSolid(block) && !isLiquid(block)) {
          return true; // Found solid ground nearby
        }
      }
    }
  }
  return false;
}

// Check if position is in deep water (all nearby blocks are below a certain level)
function isInDeepWater(worldX: number, worldZ: number): boolean {
  const world = useWorldStore.getState();
  const fx = Math.floor(worldX);
  const fz = Math.floor(worldZ);
  const checkRadius = 6;
  let waterCount = 0;
  let totalChecks = 0;

  for (let dx = -checkRadius; dx <= checkRadius; dx++) {
    for (let dz = -checkRadius; dz <= checkRadius; dz++) {
      totalChecks++;
      // Check if the column is mostly water (no solid blocks above seabed)
      let hasSolidAboveSea = false;
      for (let y = SEA_LEVEL - 2; y >= 1; y--) {
        const block = world.getBlock(fx + dx, y, fz + dz);
        if (isSolid(block) && !isLiquid(block)) {
          hasSolidAboveSea = true;
          break;
        }
      }
      if (!hasSolidAboveSea) waterCount++;
    }
  }
  
  // If more than 70% of nearby area is water, this is deep ocean
  return waterCount / totalChecks > 0.7;
}

function buildCandidateList(originX: number, originZ: number, searchRadius: number): Array<{ x: number; z: number }> {
  const baseX = Math.floor(originX);
  const baseZ = Math.floor(originZ);
  const candidates: Array<{ x: number; z: number }> = [{ x: baseX, z: baseZ }];
  const step = 4;

  for (let r = step; r <= searchRadius; r += step) {
    for (let d = -r; d <= r; d += step) {
      candidates.push({ x: baseX + d, z: baseZ - r });
      candidates.push({ x: baseX + d, z: baseZ + r });
      candidates.push({ x: baseX - r, z: baseZ + d });
      candidates.push({ x: baseX + r, z: baseZ + d });
    }
  }

  return candidates;
}

export function resolveSpawnLocation(options: SpawnSearchOptions): SpawnResult | null {
  const originX = options.originX;
  const originZ = options.originZ;
  const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
  const requireLoadedChunks = options.requireLoadedChunks ?? true;
  const minimumLoadedSamples = options.minimumLoadedSamples ?? DEFAULT_MINIMUM_LOADED_SAMPLES;
  const allowFallback = options.allowFallback ?? true;
  const fallbackY = options.fallbackY ?? DEFAULT_FALLBACK_Y;

  const candidates = buildCandidateList(originX, originZ, searchRadius);
  let checkedColumns = 0;
  let loadedColumns = 0;

  for (const candidate of candidates) {
    checkedColumns++;

    const coverage = requireLoadedChunks
      ? getLoadedChunkCoverage(candidate.x, candidate.z, minimumLoadedSamples)
      : minimumLoadedSamples;

    const loadedCount = getLoadedChunkCoverage(candidate.x, candidate.z, minimumLoadedSamples);
    // Be more lenient - only require at least 1 loaded sample
    if (requireLoadedChunks && loadedCount < 1) continue;
    if (loadedCount > 0) loadedColumns++;

    const surfaceY = findSurfaceY(candidate.x, candidate.z);
    if (surfaceY === null) continue;
    if (surfaceY <= 4 || surfaceY >= CHUNK_HEIGHT - 2) continue;
    if (surfaceY < MIN_SURFACE_Y) continue;
    if (!hasOpenSkyAbove(candidate.x, candidate.z, surfaceY)) continue;

    return {
      position: {
        x: candidate.x + 0.5,
        y: surfaceY,
        z: candidate.z + 0.5,
      },
      source: 'surface',
      reason: 'Found a dry surface column with open sky and headroom',
      anchor: { x: originX, z: originZ },
      checkedColumns,
      loadedColumns,
    };
  }

  if (!allowFallback) return null;

  return {
    position: {
      x: Math.floor(originX) + 0.5,
      y: fallbackY,
      z: Math.floor(originZ) + 0.5,
    },
    source: 'fallback',
    reason: requireLoadedChunks
      ? 'No loaded and safe surface column was available yet'
      : 'No safe surface column was available in the search radius',
    anchor: { x: originX, z: originZ },
    checkedColumns,
    loadedColumns,
  };
}
