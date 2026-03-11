import * as THREE from 'three';
import { BlockType, BLOCKS } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { ChunkData, getBlockFromChunk } from '@/stores/worldStore';
import { textureManager } from '@/data/textureManager';
import { AdvancedBlockShader, WaterShader, LeavesShader, GlassShader, LavaShader, OreShader } from './AdvancedShaders';

type Face = 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
type FaceType = 'top' | 'bottom' | 'side';

// Crossed quad vertices for plant-type blocks (X-shape)
const CROSS_VERTICES = [
  // First diagonal (SW to NE)
  [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
  // Second diagonal (NW to SE)
  [[0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1]],
  // Reverse of first (for double-sided rendering)
  [[1, 0, 1], [0, 0, 0], [0, 1, 0], [1, 1, 1]],
  // Reverse of second
  [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]],
];

const CROSS_UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Get neighboring chunk blocks for boundary checks
interface NeighborChunks {
  north?: ChunkData;
  south?: ChunkData;
  east?: ChunkData;
  west?: ChunkData;
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

// Hoisted face iteration array (avoids allocation per block)
const CUBE_FACES: { face: Face; dx: number; dy: number; dz: number }[] = [
  { face: 'TOP', dx: 0, dy: 1, dz: 0 },
  { face: 'BOTTOM', dx: 0, dy: -1, dz: 0 },
  { face: 'NORTH', dx: 0, dy: 0, dz: -1 },
  { face: 'SOUTH', dx: 0, dy: 0, dz: 1 },
  { face: 'EAST', dx: 1, dy: 0, dz: 0 },
  { face: 'WEST', dx: -1, dy: 0, dz: 0 },
];

// Map Face enum to texture face type
function getFaceType(face: Face): FaceType {
  switch (face) {
    case 'TOP':
      return 'top';
    case 'BOTTOM':
      return 'bottom';
    default:
      return 'side';
  }
}

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

// Interface for texture group data
interface TextureGroup {
  texture: THREE.Texture;
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  vertexCount: number;
  isTransparent: boolean; // For alpha-tested materials
}

// Get the appropriate shade multiplier for ambient occlusion simulation
function getFaceShade(face: Face): number {
  switch (face) {
    case 'TOP':
      return 1.0;
    case 'BOTTOM':
      return 0.5;
    case 'NORTH':
    case 'SOUTH':
      return 0.8;
    case 'EAST':
    case 'WEST':
      return 0.7;
    default:
      return 0.75;
  }
}

// AO constants hoisted to module scope (avoid allocation per face)
const AO_CURVE = [1.0, 0.75, 0.55, 0.4];
// Offsets: [edge1, edge2, corner] per vertex, matched to FACE_VERTICES winding order
const AO_OFFSETS: Record<Face, number[][][]> = {
  // TOP verts: (0,1,0), (0,1,1), (1,1,1), (1,1,0)
  TOP: [
    [[-1,1,0],[0,1,-1],[-1,1,-1]], [[-1,1,0],[0,1,1],[-1,1,1]],
    [[1,1,0],[0,1,1],[1,1,1]],     [[1,1,0],[0,1,-1],[1,1,-1]]
  ],
  // BOTTOM verts: (0,0,1), (0,0,0), (1,0,0), (1,0,1)
  BOTTOM: [
    [[-1,-1,0],[0,-1,1],[-1,-1,1]], [[-1,-1,0],[0,-1,-1],[-1,-1,-1]],
    [[1,-1,0],[0,-1,-1],[1,-1,-1]],  [[1,-1,0],[0,-1,1],[1,-1,1]]
  ],
  NORTH: [
    [[1,0,-1],[0,-1,-1],[1,-1,-1]], [[-1,0,-1],[0,-1,-1],[-1,-1,-1]],
    [[-1,0,-1],[0,1,-1],[-1,1,-1]], [[1,0,-1],[0,1,-1],[1,1,-1]]
  ],
  SOUTH: [
    [[-1,0,1],[0,-1,1],[-1,-1,1]], [[1,0,1],[0,-1,1],[1,-1,1]],
    [[1,0,1],[0,1,1],[1,1,1]],     [[-1,0,1],[0,1,1],[-1,1,1]]
  ],
  EAST: [
    [[1,0,1],[1,-1,0],[1,-1,1]], [[1,0,-1],[1,-1,0],[1,-1,-1]],
    [[1,0,-1],[1,1,0],[1,1,-1]], [[1,0,1],[1,1,0],[1,1,1]]
  ],
  WEST: [
    [[-1,0,-1],[-1,-1,0],[-1,-1,-1]], [[-1,0,1],[-1,-1,0],[-1,-1,1]],
    [[-1,0,1],[-1,1,0],[-1,1,1]],     [[-1,0,-1],[-1,1,0],[-1,1,-1]]
  ],
};

function getVertexAO(
  chunk: ChunkData, neighbors: NeighborChunks,
  x: number, y: number, z: number, face: Face
): [number, number, number, number] {
  const offsets = AO_OFFSETS[face];
  const result: [number, number, number, number] = [1, 1, 1, 1];
  for (let v = 0; v < 4; v++) {
    const [e1, e2, c] = offsets[v];
    const s1 = isSolidAt(chunk, neighbors, x + e1[0], y + e1[1], z + e1[2]) ? 1 : 0;
    const s2 = isSolidAt(chunk, neighbors, x + e2[0], y + e2[1], z + e2[2]) ? 1 : 0;
    const sc = (s1 && s2) ? 1 : (isSolidAt(chunk, neighbors, x + c[0], y + c[1], z + c[2]) ? 1 : 0);
    result[v] = AO_CURVE[s1 + s2 + sc];
  }
  return result;
}

function isSolidAt(chunk: ChunkData, neighbors: NeighborChunks, x: number, y: number, z: number): boolean {
  const block = getNeighborBlock(chunk, neighbors, x, y, z);
  return block !== BlockType.AIR && !!BLOCKS[block]?.solid && !BLOCKS[block]?.transparent;
}

// Helper to get or create texture group
function getOrCreateGroup(
  textureGroups: Map<THREE.Texture, TextureGroup>,
  texture: THREE.Texture,
  isTransparent: boolean
): TextureGroup {
  if (!textureGroups.has(texture)) {
    textureGroups.set(texture, {
      texture,
      positions: [],
      normals: [],
      uvs: [],
      colors: [],
      indices: [],
      vertexCount: 0,
      isTransparent,
    });
  }
  return textureGroups.get(texture)!;
}

// Add crossed quad mesh for plants/flowers
function addCrossMesh(
  group: TextureGroup,
  x: number,
  y: number,
  z: number
): void {
  const shade = 0.9; // Slightly bright for plants

  // Add all 4 crossed quads (2 diagonals, each double-sided)
  for (const quad of CROSS_VERTICES) {
    for (let i = 0; i < 4; i++) {
      const [vx, vy, vz] = quad[i];
      group.positions.push(x + vx, y + vy, z + vz);
      group.normals.push(0, 1, 0); // Up-facing normal for lighting
      group.uvs.push(CROSS_UVS[i][0], CROSS_UVS[i][1]);
      group.colors.push(shade, shade, shade);
    }

    group.indices.push(
      group.vertexCount, group.vertexCount + 1, group.vertexCount + 2,
      group.vertexCount, group.vertexCount + 2, group.vertexCount + 3
    );
    group.vertexCount += 4;
  }
}

export function buildMultiTextureChunkMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks
): { geometry: THREE.BufferGeometry; texture: THREE.Texture; isTransparent: boolean }[] | null {
  // Group blocks by texture
  const textureGroups = new Map<THREE.Texture, TextureGroup>();

  // Iterate through all blocks in the chunk
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const columnIndex = z * CHUNK_SIZE + x;
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

        // Check if this is a cross/plant type block
        const renderType = blockData.renderType || 'cube';
        if (renderType === 'cross' || renderType === 'plant') {
          // Render as crossed quads
          const texture = textureManager.getBlockTexture(block, 'side');
          const group = getOrCreateGroup(textureGroups, texture, true);
          addCrossMesh(group, x, y, z);
          continue;
        }

        for (const { face, dx, dy, dz } of CUBE_FACES) {
          const neighborBlock = getNeighborBlock(chunk, neighbors, x + dx, y + dy, z + dz);

          if (!shouldRenderFace(block, neighborBlock)) continue;

          // Get face-specific texture
          const faceType = getFaceType(face);
          const texture = textureManager.getBlockTexture(block, faceType);
          const group = getOrCreateGroup(textureGroups, texture, blockData.transparent);

          // Calculate face shade + per-vertex AO
          const faceShade = getFaceShade(face);
          const ao = getVertexAO(chunk, neighbors, x, y, z, face);

          // Add vertices for this face
          const faceVertices = FACE_VERTICES[face];
          const faceNormals = FACE_NORMALS[face];

          for (let i = 0; i < 4; i++) {
            const [vx, vy, vz] = faceVertices[i];
            group.positions.push(x + vx, y + vy, z + vz);
            group.normals.push(faceNormals[0], faceNormals[1], faceNormals[2]);
            group.uvs.push(FACE_UVS[i][0], FACE_UVS[i][1]);
            const shade = faceShade * ao[i];
            group.colors.push(shade, shade, shade);
          }

          // Add indices for two triangles (counter-clockwise winding)
          group.indices.push(
            group.vertexCount, group.vertexCount + 1, group.vertexCount + 2,
            group.vertexCount, group.vertexCount + 2, group.vertexCount + 3
          );
          group.vertexCount += 4;
        }
      }
    }
  }

  // Create geometries for each texture group
  const result: { geometry: THREE.BufferGeometry; texture: THREE.Texture; isTransparent: boolean }[] = [];

  for (const [texture, group] of textureGroups) {
    if (group.positions.length === 0) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(group.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(group.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(group.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(group.colors, 3));
    geometry.setIndex(group.indices);

    geometry.computeBoundingSphere();

    result.push({
      geometry,
      texture,
      isTransparent: group.isTransparent,
    });
  }

  return result.length > 0 ? result : null;
}

// Build water mesh separately (for transparency)
export function buildWaterMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const columnIndex = z * CHUNK_SIZE + x;
      const columnHeight = Math.min(CHUNK_HEIGHT, (chunk.heightMap[columnIndex] || 0) + 2);
      for (let y = 0; y < columnHeight; y++) {
        const block = getBlockFromChunk(chunk, x, y, z);
        if (block !== BlockType.WATER && block !== BlockType.LAVA) continue;

        for (const { face, dx, dy, dz } of CUBE_FACES) {
          const neighborBlock = getNeighborBlock(chunk, neighbors, x + dx, y + dy, z + dz);

          // Only skip water face if neighbor is same water block and not top face (to prevent texture overriding)
          if (neighborBlock === block && face !== 'TOP') continue;
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
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();

  return geometry;
}

// Create materials with advanced shaders
export function createBlockMaterial(): THREE.ShaderMaterial {
  // Create a dummy texture for the shader - will be replaced when actual texture is set
  const dummyTexture = new THREE.Texture();
  return AdvancedBlockShader.createMaterial(dummyTexture, {
    sunDirection: new THREE.Vector3(0.5, 1, 0.3).normalize(),
    sunColor: new THREE.Color(1, 0.98, 0.9),
    sunIntensity: 1.0,
    ambientColor: new THREE.Color(0.4, 0.45, 0.5),
    ambientIntensity: 0.4,
  });
}

export function createWaterMaterial(): THREE.ShaderMaterial {
  return WaterShader.createMaterial({
    waterColor: new THREE.Color(0.2, 0.5, 0.8),
    deepWaterColor: new THREE.Color(0.1, 0.2, 0.4),
    opacity: 0.15,
  });
}

export function createLavaMaterial(): THREE.ShaderMaterial {
  return LavaShader.createMaterial({
    lavaColor: new THREE.Color(0.8, 0.2, 0.0),
    glowColor: new THREE.Color(1.0, 0.6, 0.0),
  });
}

export function createLeavesMaterial(): THREE.ShaderMaterial {
  // Create a dummy texture for the shader - will be replaced when actual texture is set
  const dummyTexture = new THREE.Texture();
  return LeavesShader.createMaterial(dummyTexture, {
    leafColor: new THREE.Color(0.4, 0.7, 0.2),
    windStrength: 0.05,
    translucency: 0.3,
  });
}

export function createGlassMaterial(): THREE.ShaderMaterial {
  return GlassShader.createMaterial({
    glassColor: new THREE.Color(0.9, 0.95, 1.0),
    opacity: 0.3,
    reflectivity: 0.5,
  });
}

export function createOreMaterial(): THREE.ShaderMaterial {
  // Create a dummy texture for the shader - will be replaced when actual texture is set
  const dummyTexture = new THREE.Texture();
  return OreShader.createMaterial(dummyTexture, {
    oreColor: new THREE.Color(1, 1, 1),
    sparkleIntensity: 0.5,
  });
}
