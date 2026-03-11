import { useWorldStore } from '@/stores/worldStore';
import { BlockType, isSolid } from '@/data/blocks';
import { PLAYER_REACH } from '@/utils/constants';

export interface RaycastHit {
  hit: boolean;
  block: BlockType;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  distance: number;
}

// Cast a ray and find the first solid block
export function raycast(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDistance: number = PLAYER_REACH
): RaycastHit {
  const worldStore = useWorldStore.getState();

  // Normalize direction
  const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
  dirX /= length;
  dirY /= length;
  dirZ /= length;

  // DDA algorithm for voxel traversal
  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dirX >= 0 ? 1 : -1;
  const stepY = dirY >= 0 ? 1 : -1;
  const stepZ = dirZ >= 0 ? 1 : -1;

  const tDeltaX = Math.abs(1 / dirX);
  const tDeltaY = Math.abs(1 / dirY);
  const tDeltaZ = Math.abs(1 / dirZ);

  let tMaxX = dirX >= 0
    ? (Math.floor(originX) + 1 - originX) * tDeltaX
    : (originX - Math.floor(originX)) * tDeltaX;
  let tMaxY = dirY >= 0
    ? (Math.floor(originY) + 1 - originY) * tDeltaY
    : (originY - Math.floor(originY)) * tDeltaY;
  let tMaxZ = dirZ >= 0
    ? (Math.floor(originZ) + 1 - originZ) * tDeltaZ
    : (originZ - Math.floor(originZ)) * tDeltaZ;

  let normal = { x: 0, y: 0, z: 0 };
  let distance = 0;

  while (distance < maxDistance) {
    // Check current block
    const block = worldStore.getBlock(x, y, z);
    if (block !== BlockType.AIR && isSolid(block)) {
      return {
        hit: true,
        block,
        position: { x, y, z },
        normal,
        distance,
      };
    }

    // Advance to next voxel
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
  }

  return {
    hit: false,
    block: BlockType.AIR,
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    distance: maxDistance,
  };
}

// Get the block position to place a new block
export function getPlacementPosition(hit: RaycastHit): { x: number; y: number; z: number } | null {
  if (!hit.hit) return null;

  // Place block in the direction of the normal (adjacent to hit block)
  return {
    x: hit.position.x + hit.normal.x,
    y: hit.position.y + hit.normal.y,
    z: hit.position.z + hit.normal.z,
  };
}

// Check if placement position is valid (not inside player)
export function isValidPlacement(
  placeX: number,
  placeY: number,
  placeZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerHeight: number = 1.8
): boolean {
  // Check if block would intersect with player
  const playerMinX = playerX - 0.3;
  const playerMaxX = playerX + 0.3;
  const playerMinY = playerY;
  const playerMaxY = playerY + playerHeight;
  const playerMinZ = playerZ - 0.3;
  const playerMaxZ = playerZ + 0.3;

  const blockMinX = placeX;
  const blockMaxX = placeX + 1;
  const blockMinY = placeY;
  const blockMaxY = placeY + 1;
  const blockMinZ = placeZ;
  const blockMaxZ = placeZ + 1;

  // Check intersection
  if (
    playerMaxX > blockMinX &&
    playerMinX < blockMaxX &&
    playerMaxY > blockMinY &&
    playerMinY < blockMaxY &&
    playerMaxZ > blockMinZ &&
    playerMinZ < blockMaxZ
  ) {
    return false;
  }

  return true;
}

// Get look direction from rotation
// Camera uses: rotation.y = -yaw, rotation.x = -pitch with YXZ order
// Three.js camera looks down local -Z axis, so we calculate the direction it's facing
export function getLookDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
