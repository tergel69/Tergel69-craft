import { useWorldStore, getBlockStateFromChunk } from '@/stores/worldStore';
import { BlockType, BLOCKS, isSolid, isLiquid } from '@/data/blocks';
import { worldToChunk, worldToLocal } from '@/utils/coordinates';
import { resolveSpawnLocation } from '@/utils/spawn';
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
          const boxes = getBlockCollisionBoxes(x, y, z, block);
          for (const blockAABB of boxes) {
            if (aabbIntersects(aabb, blockAABB)) return true;
          }
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

function canFenceConnectTo(block: BlockType): boolean {
  if (block === BlockType.AIR) return false;
  const blockData = BLOCKS[block];
  if (!blockData) return false;
  if (blockData.liquid) return false;
  if (blockData.renderType === 'fence') return true;
  return blockData.solid && blockData.renderType !== 'cross' && blockData.renderType !== 'plant' && blockData.renderType !== 'torch';
}

function getBlockCollisionBoxes(x: number, y: number, z: number, block: BlockType): AABB[] {
  const blockData = BLOCKS[block];
  if (!blockData || block === BlockType.AIR) return [];
  const worldStore = useWorldStore.getState();
  const chunkCoord = worldToChunk(x, z);
  const chunk = worldStore.getChunk(chunkCoord.x, chunkCoord.z);
  const local = worldToLocal(x, y, z);
  const state = chunk ? getBlockStateFromChunk(chunk, local.x, local.y, local.z) : 0;

  if (blockData.renderType === 'slab') {
    const topHalf = (state & 1) !== 0;
    return [{
      minX: x, minY: y + (topHalf ? 0.5 : 0), minZ: z,
      maxX: x + 1, maxY: y + (topHalf ? 1 : 0.5), maxZ: z + 1,
    }];
  }

  if (blockData.renderType === 'stairs') {
    const facing = state & 3;
    const topHalf = (state & 4) !== 0;
    const baseY = topHalf ? 0.5 : 0;
    const topY = topHalf ? 1 : 0.5;
    const boxes: AABB[] = [{
      minX: x, minY: y + baseY, minZ: z,
      maxX: x + 1, maxY: y + topY, maxZ: z + 1,
    }];

    switch (facing) {
      case 1:
        boxes.push({ minX: x + 0.5, minY: y + baseY, minZ: z, maxX: x + 1, maxY: y + topY, maxZ: z + 1 });
        break;
      case 2:
        boxes.push({ minX: x, minY: y + baseY, minZ: z, maxX: x + 1, maxY: y + topY, maxZ: z + 0.5 });
        break;
      case 3:
        boxes.push({ minX: x, minY: y + baseY, minZ: z, maxX: x + 0.5, maxY: y + topY, maxZ: z + 1 });
        break;
      default:
        boxes.push({ minX: x, minY: y + baseY, minZ: z + 0.5, maxX: x + 0.5, maxY: y + topY, maxZ: z + 1 });
        break;
    }
    return boxes;
  }

  if (blockData.renderType === 'fence') {
    const boxes: AABB[] = [
      {
        minX: x + 0.375, minY: y, minZ: z + 0.375,
        maxX: x + 0.625, maxY: y + 1, maxZ: z + 0.625,
      },
    ];

    if (canFenceConnectTo(worldStore.getBlock(x, y, z - 1))) {
      boxes.push({
        minX: x + 0.4375, minY: y + 0.375, minZ: z,
        maxX: x + 0.5625, maxY: y + 0.75, maxZ: z + 0.4375,
      });
    }
    if (canFenceConnectTo(worldStore.getBlock(x, y, z + 1))) {
      boxes.push({
        minX: x + 0.4375, minY: y + 0.375, minZ: z + 0.5625,
        maxX: x + 0.5625, maxY: y + 0.75, maxZ: z + 1,
      });
    }
    if (canFenceConnectTo(worldStore.getBlock(x - 1, y, z))) {
      boxes.push({
        minX: x, minY: y + 0.375, minZ: z + 0.4375,
        maxX: x + 0.4375, maxY: y + 0.75, maxZ: z + 0.5625,
      });
    }
    if (canFenceConnectTo(worldStore.getBlock(x + 1, y, z))) {
      boxes.push({
        minX: x + 0.5625, minY: y + 0.375, minZ: z + 0.4375,
        maxX: x + 1, maxY: y + 0.75, maxZ: z + 0.5625,
      });
    }

    return boxes;
  }

  if (blockData.collisionBoxes && blockData.collisionBoxes.length > 0) {
    return blockData.collisionBoxes.map((box) => ({
      minX: x + box.x,
      minY: y + box.y,
      minZ: z + box.z,
      maxX: x + box.x + box.width,
      maxY: y + box.y + box.height,
      maxZ: z + box.z + box.depth,
    }));
  }

  if (blockData.hitbox) {
    const box = blockData.hitbox;
    return [{
      minX: x + box.x,
      minY: y + box.y,
      minZ: z + box.z,
      maxX: x + box.x + box.width,
      maxY: y + box.y + box.height,
      maxZ: z + box.z + box.depth,
    }];
  }

  if (blockData.solid) {
    return [{
      minX: x, minY: y, minZ: z,
      maxX: x + 1, maxY: y + 1, maxZ: z + 1,
    }];
  }

  return [];
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
  const resolved = resolveSpawnLocation({
    originX: x,
    originZ: z,
    searchRadius: 0,
    requireLoadedChunks: false,
    allowFallback: false,
  });

  return resolved ? resolved.position.y : 64;
}

// Search radius for a guaranteed dry land spawn
export function findSafeSpawnPosition(
  x: number,
  z: number,
  searchRadius: number = 64,
  requireLoadedChunks: boolean = false
): { x: number; y: number; z: number } {
  const resolved = resolveSpawnLocation({
    originX: x,
    originZ: z,
    searchRadius,
    requireLoadedChunks,
    allowFallback: true,
    fallbackY: 180,
  });

  return resolved?.position ?? { x: Math.floor(x) + 0.5, y: 180, z: Math.floor(z) + 0.5 };
}
