import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ChunkCoord {
  x: number;
  z: number;
}

// Convert world coordinates to chunk coordinates
export function worldToChunk(x: number, z: number): ChunkCoord {
  return {
    x: Math.floor(x / CHUNK_SIZE),
    z: Math.floor(z / CHUNK_SIZE),
  };
}

// Convert world coordinates to local chunk coordinates
export function worldToLocal(x: number, y: number, z: number): Vector3 {
  return {
    x: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(y))),
    z: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  };
}

// Convert chunk + local coordinates to world coordinates
export function localToWorld(
  chunkX: number,
  chunkZ: number,
  localX: number,
  localY: number,
  localZ: number
): Vector3 {
  return {
    x: chunkX * CHUNK_SIZE + localX,
    y: localY,
    z: chunkZ * CHUNK_SIZE + localZ,
  };
}

// Get block index in flat array
export function getBlockIndex(x: number, y: number, z: number): number {
  return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
}

// Get coordinates from block index
export function getBlockCoords(index: number): Vector3 {
  const y = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
  const remainder = index % (CHUNK_SIZE * CHUNK_SIZE);
  const z = Math.floor(remainder / CHUNK_SIZE);
  const x = remainder % CHUNK_SIZE;
  return { x, y, z };
}

// Create a unique key for chunk coordinates
export function chunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

// Parse chunk key back to coordinates
export function parseChunkKey(key: string): ChunkCoord {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
}

// Calculate distance between two points
export function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Calculate horizontal distance (for chunk loading)
export function horizontalDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Check if a point is inside a chunk
export function isInChunk(chunkX: number, chunkZ: number, worldX: number, worldZ: number): boolean {
  const minX = chunkX * CHUNK_SIZE;
  const minZ = chunkZ * CHUNK_SIZE;
  return (
    worldX >= minX &&
    worldX < minX + CHUNK_SIZE &&
    worldZ >= minZ &&
    worldZ < minZ + CHUNK_SIZE
  );
}

// Get all chunk coordinates within render distance
export function getChunksInRadius(
  centerX: number,
  centerZ: number,
  radius: number
): ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  const centerChunk = worldToChunk(centerX, centerZ);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) {
        chunks.push({
          x: centerChunk.x + dx,
          z: centerChunk.z + dz,
        });
      }
    }
  }

  // Sort by distance from center for priority loading
  chunks.sort((a, b) => {
    const distA = (a.x - centerChunk.x) ** 2 + (a.z - centerChunk.z) ** 2;
    const distB = (b.x - centerChunk.x) ** 2 + (b.z - centerChunk.z) ** 2;
    return distA - distB;
  });

  return chunks;
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Round to nearest block
export function roundToBlock(value: number): number {
  return Math.floor(value);
}
