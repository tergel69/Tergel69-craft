import * as THREE from 'three';
import { BlockType, BLOCKS, isTransparent } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { ChunkData, getBlockFromChunk } from '@/stores/worldStore';
import { decodeTerrainBiome } from '@/utils/biomeEncoding';
import { BiomeType as VisualBiomeType, getBiomeData } from '@/data/biomes';
import { simpleBlockColorSystem } from '@/data/simpleBlockColors';
import { textureManager } from '@/data/textureManager';
import { BiomeType as TerrainBiomeType } from './TerrainGenerator';

type Face = 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

// Get neighboring chunk blocks for boundary checks
interface NeighborChunks {
  north?: ChunkData;
  south?: ChunkData;
  east?: ChunkData;
  west?: ChunkData;
}

const biomeWaterColorCache = new Map<VisualBiomeType, THREE.Color>();

function getVisualBiomeType(encodedBiome: number): VisualBiomeType {
  const terrainBiome = decodeTerrainBiome(encodedBiome);
  switch (terrainBiome) {
    case TerrainBiomeType.SUNFLOWER_PLAINS:
      return VisualBiomeType.PLAINS;
    case TerrainBiomeType.BADLANDS:
    case TerrainBiomeType.VOLCANIC:
      return VisualBiomeType.MESA;
    case TerrainBiomeType.SNOW:
      return VisualBiomeType.SNOWY_PLAINS;
    case TerrainBiomeType.MUSHROOM:
      return VisualBiomeType.MUSHROOM_ISLAND;
    case TerrainBiomeType.MEGA_MOUNTAINS:
      return VisualBiomeType.MOUNTAINS;
    default:
      return terrainBiome as unknown as VisualBiomeType;
  }
}

// Corrected face vertices with proper counter-clockwise winding for front faces
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

const FACE_UVS = [
  [0, 1], [1, 1], [1, 0], [0, 0]
];

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

  // Same transparent blocks: skip only for liquids (water/lava), render for solids (leaves/glass)
  if (blockData.transparent && neighborData.transparent) {
    if (block === neighborBlock) {
      return blockData.solid && !blockData.liquid;
    }
    return true;
  }

  // Render face if neighbor is transparent
  return neighborData.transparent;
}

export function buildChunkMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  // Iterate through all blocks in the chunk, but cap the vertical traversal
  // to the useful range for each column using the precomputed height map.
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

          // Get block color from simple color system
          const blockColor = simpleBlockColorSystem.getBlockColor(block);
          
          // Apply some basic ambient occlusion simulation by darkening side/bottom faces
          let r = blockColor.r;
          let g = blockColor.g;
          let b = blockColor.b;
          
          if (face === 'BOTTOM') {
            r *= 0.5; g *= 0.5; b *= 0.5; // Darken bottom faces
          } else if (face !== 'TOP') {
            // Side faces get slight shading based on direction
            r *= 0.7; g *= 0.7; b *= 0.7; // Darken side faces
          }

          // Add vertices for this face
          const faceVertices = FACE_VERTICES[face];
          const faceNormals = FACE_NORMALS[face];

          for (let i = 0; i < 4; i++) {
            const [vx, vy, vz] = faceVertices[i];
            positions.push(x + vx, y + vy, z + vz);
            normals.push(faceNormals[0], faceNormals[1], faceNormals[2]);
            
            // Add texture coordinates for each vertex
            uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
            
            // Add color for each vertex
            colors.push(r, g, b);
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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();

  return geometry;
}

// Build water mesh separately (for transparency)
export function buildWaterMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const block = getBlockFromChunk(chunk, x, y, z);
        if (block !== BlockType.WATER && block !== BlockType.LAVA) continue;
        const columnIndex = z * CHUNK_SIZE + x;
        const biomeIndex = chunk.biomes[columnIndex] ?? 0;
        const visualBiome = getVisualBiomeType(biomeIndex);
        const biome = getBiomeData(visualBiome);
        const waterTint = block === BlockType.LAVA
          ? new THREE.Color('#D96415')
          : biomeWaterColorCache.get(visualBiome) || (() => {
              const color = new THREE.Color(biome.waterColor);
              biomeWaterColorCache.set(visualBiome, color);
              return color;
            })();

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

          // Only render water face if neighbor is air or different liquid
          if (neighborBlock !== BlockType.AIR && neighborBlock === block) continue;
          // Don't render faces against solid blocks
          if (neighborBlock !== BlockType.AIR && !BLOCKS[neighborBlock]?.transparent) continue;

          const faceVertices = FACE_VERTICES[face];
          const faceNormals = FACE_NORMALS[face];

          // Lower water surface slightly for top face
          const yOffset = face === 'TOP' ? -0.1 : 0;

          for (let i = 0; i < 4; i++) {
            const [vx, vy, vz] = faceVertices[i];
            positions.push(x + vx, y + vy + yOffset, z + vz);
            normals.push(faceNormals[0], faceNormals[1], faceNormals[2]);
            uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
            colors.push(waterTint.r, waterTint.g, waterTint.b);
          }

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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();

  return geometry;
}

// Create materials
export function createBlockMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true, // Use vertex colors for simple block colors
    side: THREE.FrontSide,
  });
}

export function createWaterMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: 0x3F76E4,
    vertexColors: true,
    transparent: true,
    opacity: 0.15, // Almost completely transparent
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createLavaMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xD96415,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
}
