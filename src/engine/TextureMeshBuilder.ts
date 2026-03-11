import * as THREE from 'three';
import { BlockType, BLOCKS, isTransparent } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { ChunkData, getBlockFromChunk } from '@/stores/worldStore';
import { textureManager } from '@/data/textureManager';

type Face = 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

// Get neighboring chunk blocks for boundary checks
interface NeighborChunks {
  north?: ChunkData;
  south?: ChunkData;
  east?: ChunkData;
  west?: ChunkData;
}

// Face vertices with proper counter-clockwise winding
const FACE_VERTICES: Record<Face, number[][]> = {
  TOP: [
    [0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]
  ],
  BOTTOM: [
    [0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]
  ],
  NORTH: [
    [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]
  ],
  SOUTH: [
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
  ],
  EAST: [
    [1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]
  ],
  WEST: [
    [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]
  ],
};

const FACE_NORMALS: Record<Face, number[]> = {
  TOP: [0, 1, 0],
  BOTTOM: [0, -1, 0],
  NORTH: [0, 0, -1],
  SOUTH: [0, 0, 1],
  EAST: [1, 0, 0],
  WEST: [-1, 0, 0],
};

// Face UV coordinates for texture mapping
const FACE_UVS: Record<Face, number[][]> = {
  TOP: [[0, 1], [1, 1], [1, 0], [0, 0]],
  BOTTOM: [[0, 1], [1, 1], [1, 0], [0, 0]],
  NORTH: [[0, 1], [1, 1], [1, 0], [0, 0]],
  SOUTH: [[0, 1], [1, 1], [1, 0], [0, 0]],
  EAST: [[0, 1], [1, 1], [1, 0], [0, 0]],
  WEST: [[0, 1], [1, 1], [1, 0], [0, 0]],
};

function getNeighborBlock(
  chunk: ChunkData,
  neighbors: NeighborChunks,
  localX: number,
  y: number,
  localZ: number
): BlockType {
  if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;

  // Check if we need to look at neighbor chunks
  if (localX < 0) {
    if (neighbors.west) {
      return getBlockFromChunk(neighbors.west, CHUNK_SIZE - 1, y, localZ);
    }
    return BlockType.AIR;
  }
  if (localX >= CHUNK_SIZE) {
    if (neighbors.east) {
      return getBlockFromChunk(neighbors.east, 0, y, localZ);
    }
    return BlockType.AIR;
  }
  if (localZ < 0) {
    if (neighbors.north) {
      return getBlockFromChunk(neighbors.north, localX, y, CHUNK_SIZE - 1);
    }
    return BlockType.AIR;
  }
  if (localZ >= CHUNK_SIZE) {
    if (neighbors.south) {
      return getBlockFromChunk(neighbors.south, localX, y, 0);
    }
    return BlockType.AIR;
  }

  return getBlockFromChunk(chunk, localX, y, localZ);
}

function shouldRenderFace(
  block: BlockType,
  neighborBlock: BlockType
): boolean {
  if (block === BlockType.AIR) return false;
  if (neighborBlock === BlockType.AIR) return true;

  const blockData = BLOCKS[block];
  const neighborData = BLOCKS[neighborBlock];

  if (!blockData || !neighborData) return true;

  // Transparent blocks show faces against other blocks
  if (blockData.transparent && !neighborData.transparent) return true;

  // Don't render face between same transparent blocks (like water)
  if (blockData.transparent && neighborData.transparent) {
    return block !== neighborBlock;
  }

  // Render face if neighbor is transparent
  return neighborData.transparent;
}

// Create a texture atlas for all block types
export class BlockTextureAtlas {
  private textureCache = new Map<BlockType, THREE.Texture>();
  private currentTexture: THREE.Texture | null = null;

  getBlockTexture(blockType: BlockType, face: 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' = 'TOP'): THREE.Texture {
    const cacheKey = `${blockType}_${face}`;
    if (this.textureCache.has(cacheKey as any)) {
      return this.textureCache.get(cacheKey as any)!;
    }

    // Convert to lowercase to match texture manager expected type
    const normalizedFace = face.toLowerCase() as 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';
    const texture = textureManager.getBlockTexture(blockType, normalizedFace);
    this.textureCache.set(cacheKey as any, texture);
    return texture;
  }

  getDefaultTexture(): THREE.Texture {
    if (!this.currentTexture) {
      this.currentTexture = this.getBlockTexture(BlockType.STONE);
    }
    return this.currentTexture;
  }

  clearCache(): void {
    this.textureCache.clear();
    this.currentTexture = null;
  }
}

export const blockTextureAtlas = new BlockTextureAtlas();

export function buildChunkMeshWithTextures(
  chunk: ChunkData,
  neighbors: NeighborChunks
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  // Iterate through all blocks in the chunk
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const columnIndex = z * CHUNK_SIZE + x;
      // Add a small buffer above the height map to account for plants/structures
      const columnHeight = Math.min(
        CHUNK_HEIGHT,
        (chunk.heightMap[columnIndex] || 0) + 2
      );

      for (let y = 0; y < columnHeight; y++) {
        const block = getBlockFromChunk(chunk, x, y, z);
        if (block === BlockType.AIR) continue;

        // Skip water/lava - rendered separately
        if (block === BlockType.WATER || block === BlockType.LAVA) continue;

        const blockData = BLOCKS[block];
        if (!blockData) continue;

        // Check each face
        const faces: { face: Face; dx: number; dy: number; dz: number }[] = [
          { face: 'TOP', dx: 0, dy: 1, dz: 0 },
          { face: 'BOTTOM', dx: 0, dy: -1, dz: 0 },
          { face: 'NORTH', dx: 0, dy: 0, dz: -1 },
          { face: 'SOUTH', dx: 0, dy: 0, dz: 1 },
          { face: 'EAST', dx: 1, dy: 0, dz: 0 },
          { face: 'WEST', dx: -1, dy: 0, dz: 0 },
        ];

        for (const { face, dx, dy, dz } of faces) {
          const neighborBlock = getNeighborBlock(chunk, neighbors, x + dx, y + dy, z + dz);

          if (!shouldRenderFace(block, neighborBlock)) continue;

          // Get face UV coordinates
          const faceUVs = FACE_UVS[face];

          // Add vertices for this face
          const faceVertices = FACE_VERTICES[face];
          const faceNormals = FACE_NORMALS[face];

          for (let i = 0; i < 4; i++) {
            const [vx, vy, vz] = faceVertices[i];
            positions.push(x + vx, y + vy, z + vz);
            normals.push(faceNormals[0], faceNormals[1], faceNormals[2]);
            
            // Apply texture coordinates
            const [u, v] = faceUVs[i];
            uvs.push(u, v);
          }

          // Add indices for two triangles (counter-clockwise winding)
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();

  return geometry;
}

// Create materials that use our texture atlas
export function createTexturedBlockMaterial(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    side: THREE.FrontSide,
    vertexColors: false,
  });

  // Set the default texture
  const defaultTexture = blockTextureAtlas.getDefaultTexture();
  material.map = defaultTexture;
  material.needsUpdate = true;

  return material;
}

export function createTexturedWaterMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: 0x3F76E4,
    transparent: true,
    opacity: 0.0, // Completely transparent
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createTexturedLavaMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xD96415,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
}