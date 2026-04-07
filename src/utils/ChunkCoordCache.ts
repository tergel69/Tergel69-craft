/**
 * ChunkCoordCache - Numeric-first chunk coordinate representation for hot-path optimization
 * 
 * This module provides cached numeric chunk coordinates to avoid per-frame string parsing
 * in hot loops. The persistence format remains unchanged (string keys), but runtime
 * operations use numeric representations for better performance.
 */

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface ChunkKeyStruct {
  key: string;
  x: number;
  z: number;
  hash: number; // numeric hash for fast comparison
}

// Bit-shift constants for encoding/decoding
const CHUNK_KEY_SHIFT = 16;
const CHUNK_KEY_MASK = 0xFFFF;

/**
 * Create a numeric hash from chunk coordinates for fast comparison
 */
export function chunkCoordHash(x: number, z: number): number {
  // Use a simple but effective hash for chunk coords
  return ((x & CHUNK_KEY_MASK) << CHUNK_KEY_SHIFT) | (z & CHUNK_KEY_MASK);
}

/**
 * Create a chunk key struct with cached values
 */
export function createChunkKeyStruct(x: number, z: number): ChunkKeyStruct {
  return {
    key: `${x},${z}`,
    x,
    z,
    hash: chunkCoordHash(x, z),
  };
}

/**
 * Parse a chunk key string into coordinates (cached result)
 * Uses a weak cache to avoid repeated parsing of the same keys
 */
const keyParseCache = new Map<string, ChunkCoord>();
const MAX_CACHE_SIZE = 500;

export function parseChunkKey(key: string): ChunkCoord {
  const cached = keyParseCache.get(key);
  if (cached) return cached;
  
  const [x, z] = key.split(',').map(Number);
  const result = { x, z };
  
  // Prune cache if too large
  if (keyParseCache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(keyParseCache.keys());
    for (let i = 0; i < 100; i++) {
      keyParseCache.delete(keys[i]);
    }
  }
  
  keyParseCache.set(key, result);
  return result;
}

/**
 * Check if two chunk keys refer to the same chunk (fast path using hash)
 */
export function chunkKeysEqual(key1: string, key2: string): boolean {
  return key1 === key2;
}

/**
 * Get distance squared between two chunk keys (avoid sqrt for comparisons)
 */
export function chunkKeyDistanceSquared(key1: string, key2: string): number {
  const c1 = parseChunkKey(key1);
  const c2 = parseChunkKey(key2);
  const dx = c1.x - c2.x;
  const dz = c1.z - c2.z;
  return dx * dx + dz * dz;
}

/**
 * Clear the parse cache (useful on world reset)
 */
export function clearChunkKeyCache(): void {
  keyParseCache.clear();
}

/**
 * Generate adjacent chunk keys for a given chunk (for boundary updates)
 */
export function getAdjacentChunkKeys(x: number, z: number): string[] {
  return [
    `${x - 1},${z}`,
    `${x + 1},${z}`,
    `${x},${z - 1}`,
    `${x},${z + 1}`,
  ];
}

/**
 * Check if a coordinate is on a chunk boundary
 */
export function isOnChunkBoundary(localX: number, localZ: number, chunkSize: number): {
  negativeX: boolean;
  positiveX: boolean;
  negativeZ: boolean;
  positiveZ: boolean;
} {
  return {
    negativeX: localX === 0,
    positiveX: localX === chunkSize - 1,
    negativeZ: localZ === 0,
    positiveZ: localZ === chunkSize - 1,
  };
}
