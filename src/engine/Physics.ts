import { useWorldStore } from '@/stores/worldStore';
import { BlockType, BLOCKS, isSolid, isLiquid } from '@/data/blocks';
import {
  GRAVITY,
  TERMINAL_VELOCITY,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  JUMP_VELOCITY,
} from '@/utils/constants';

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface CollisionResult {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  inWater: boolean;
  inLava: boolean;
  hitHead: boolean;
}

export function getPlayerAABB(x: number, y: number, z: number): AABB {
  const halfWidth = PLAYER_WIDTH / 2;
  return {
    minX: x - halfWidth,
    minY: y,
    minZ: z - halfWidth,
    maxX: x + halfWidth,
    maxY: y + PLAYER_HEIGHT,
    maxZ: z + halfWidth,
  };
}

export function intersectsSolid(aabb: AABB): boolean {
  const worldStore = useWorldStore.getState();
  const minX = Math.floor(aabb.minX);
  const maxX = Math.floor(aabb.maxX);
  const minY = Math.floor(aabb.minY);
  const maxY = Math.floor(aabb.maxY);
  const minZ = Math.floor(aabb.minZ);
  const maxZ = Math.floor(aabb.maxZ);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = worldStore.getBlock(x, y, z);
        if (isSolid(block)) {
          const blockAABB: AABB = {
            minX: x, minY: y, minZ: z,
            maxX: x + 1, maxY: y + 1, maxZ: z + 1,
          };
          if (aabbIntersects(aabb, blockAABB)) return true;
        }
      }
    }
  }
  return false;
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

export function applyPhysics(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  delta: number,
  isFlying: boolean = false
): CollisionResult {
  const worldStore = useWorldStore.getState();
  let onGround = false;
  let hitHead = false;
  let inWater = false;
  let inLava = false;

  const feetBlock = worldStore.getBlock(Math.floor(x), Math.floor(y + 0.1), Math.floor(z));
  const centerBlock = worldStore.getBlock(Math.floor(x), Math.floor(y + PLAYER_HEIGHT / 2), Math.floor(z));
  inWater = feetBlock === BlockType.WATER || centerBlock === BlockType.WATER;
  inLava  = feetBlock === BlockType.LAVA  || centerBlock === BlockType.LAVA;

  if (!isFlying) {
    if (inWater || inLava) {
      vy -= GRAVITY * 0.2 * delta;
      const drag = Math.pow(0.02, delta);
      vx *= drag; vy *= drag; vz *= drag;
    } else {
      vy -= GRAVITY * delta;
    }
  }

  vy = Math.max(-TERMINAL_VELOCITY, Math.min(TERMINAL_VELOCITY, vy));

  // Y axis
  const newY = y + vy * delta;
  if (intersectsSolid(getPlayerAABB(x, newY, z))) {
    if (vy < 0) { y = Math.floor(y) + 0.001; onGround = true; vy = 0; }
    else { y = Math.ceil(y + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001; hitHead = true; vy = 0; }
  } else { y = newY; }

  // X axis
  const newX = x + vx * delta;
  if (intersectsSolid(getPlayerAABB(newX, y, z))) {
    x = vx > 0
      ? Math.floor(newX + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2 - 0.001
      : Math.ceil(newX - PLAYER_WIDTH / 2) + PLAYER_WIDTH / 2 + 0.001;
    vx = 0;
  } else { x = newX; }

  // Z axis
  const newZ = z + vz * delta;
  if (intersectsSolid(getPlayerAABB(x, y, newZ))) {
    z = vz > 0
      ? Math.floor(newZ + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2 - 0.001
      : Math.ceil(newZ - PLAYER_WIDTH / 2) + PLAYER_WIDTH / 2 + 0.001;
    vz = 0;
  } else { z = newZ; }

  if (!onGround) {
    onGround = intersectsSolid(getPlayerAABB(x, y - 0.05, z));
  }

  return { x, y, z, vx, vy, vz, onGround, inWater, inLava, hitHead };
}

export function canJump(x: number, y: number, z: number, isOnGround: boolean, isInWater: boolean): boolean {
  if (isInWater) return true;
  if (!isOnGround) return false;
  return !intersectsSolid(getPlayerAABB(x, y + 0.1, z));
}

export function getJumpVelocity(isInWater: boolean): number {
  return isInWater ? JUMP_VELOCITY * 0.4 : JUMP_VELOCITY;
}

export function isValidPosition(x: number, y: number, z: number): boolean {
  return !intersectsSolid(getPlayerAABB(x, y, z));
}

// ✅ FIXED: Find the highest Y that has solid ground with no liquid above it
export function findSpawnPosition(x: number, z: number): number {
  const worldStore = useWorldStore.getState();
  const fx = Math.floor(x);
  const fz = Math.floor(z);

  for (let y = 255; y >= 1; y--) {
    const block = worldStore.getBlock(fx, y, fz);

    // Must be solid and not a liquid itself
    if (!isSolid(block) || isLiquid(block)) continue;

    // Check the two blocks above where the player would stand — both must be non-solid and non-liquid
    const above1 = worldStore.getBlock(fx, y + 1, fz);
    const above2 = worldStore.getBlock(fx, y + 2, fz);

    if (isLiquid(above1) || isLiquid(above2)) continue; // underwater surface — skip
    if (isSolid(above1) || isSolid(above2)) continue;   // not enough headroom — skip

    return y + 1; // Stand on top of this block
  }

  return 64;
}

// ✅ FIXED: Search radius for a guaranteed dry land spawn
export function findSafeSpawnPosition(
  x: number,
  z: number,
  searchRadius: number = 64  // Increased search radius for better surface finding
): { x: number; y: number; z: number } {
  // Try the exact position first
  const spawnY = findSpawnPosition(x, z);
  if (isSpawnDry(Math.floor(x), spawnY, Math.floor(z))) {
    return { x: Math.floor(x) + 0.5, y: spawnY, z: Math.floor(z) + 0.5 };
  }

  // Spiral outward to find dry land
  for (let r = 1; r <= searchRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // Only check ring edge
        const checkX = Math.floor(x) + dx;
        const checkZ = Math.floor(z) + dz;
        const checkY = findSpawnPosition(checkX, checkZ);
        if (isSpawnDry(checkX, checkY, checkZ)) {
          return { x: checkX + 0.5, y: checkY, z: checkZ + 0.5 };
        }
      }
    }
  }

  // Last resort: use the original position but ensure it's on solid ground
  console.warn('No suitable ground spawn found, using original position with ground check');
  const fallbackY = findSpawnPosition(x, z);
  return { x: Math.floor(x) + 0.5, y: fallbackY, z: Math.floor(z) + 0.5 };
}

// Helper: checks that a spawn column is fully dry (no liquid at feet, body, or ground)
function isSpawnDry(x: number, y: number, z: number): boolean {
  const worldStore = useWorldStore.getState();
  const ground  = worldStore.getBlock(x, y - 1, z);
  const feet    = worldStore.getBlock(x, y,     z);
  const body    = worldStore.getBlock(x, y + 1, z);

  return (
    isSolid(ground) &&
    !isLiquid(ground) &&
    !isLiquid(feet) &&
    !isLiquid(body) &&
    !isSolid(feet) &&   // spawn space must be clear
    !isSolid(body)
  );
}
