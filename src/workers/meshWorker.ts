// src/workers/meshWorker.ts
// Web Worker for mesh building to move heavy computation off main thread

// Copy necessary types and constants from main codebase
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 256;
const SEA_LEVEL = 64;

enum BlockType {
  AIR = 0,
  STONE = 1,
  GRASS = 2,
  DIRT = 3,
  // ... add more as needed
}

type Face = 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
type RenderMode = 'opaque' | 'cutout' | 'translucent';

interface ChunkData {
  x: number;
  z: number;
  blocks: Uint8Array;
  blockStates: Uint8Array;
  biomes: Uint8Array;
  heightMap: Int16Array;
  lightMap: Uint8Array;
  isDirty: boolean;
  isGenerated: boolean;
}

interface NeighborChunks {
  north?: ChunkData;
  south?: ChunkData;
  east?: ChunkData;
  west?: ChunkData;
}

interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

interface TextureGroupData {
  textureUuid: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  vertexCount: number;
  renderMode: RenderMode;
}

interface MeshWorkerMessage {
  type: 'build_mesh';
  chunk: ChunkData;
  neighbors: NeighborChunks;
}

interface MeshWorkerResponse {
  type: 'mesh_built';
  chunkX: number;
  chunkZ: number;
  meshes: TextureGroupData[];
  waterMesh?: MeshData;
}

// Worker message handler
self.onmessage = (e: MessageEvent<MeshWorkerMessage>) => {
  const { type, chunk, neighbors } = e.data;

  if (type === 'build_mesh') {
    const result = buildMultiTextureChunkMesh(chunk, neighbors);
    const response: MeshWorkerResponse = {
      type: 'mesh_built',
      chunkX: chunk.x,
      chunkZ: chunk.z,
      meshes: result.meshes,
      waterMesh: result.waterMesh,
    };
    self.postMessage(response);
  }
};

// Simplified mesh building logic (copied from MultiTextureMeshBuilder)
function buildMultiTextureChunkMesh(chunk: ChunkData, neighbors: NeighborChunks): { meshes: TextureGroupData[]; waterMesh?: MeshData } {
  const textureGroups = new Map<string, TextureGroupData>();

  // Build solid blocks mesh
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const columnIndex = z * CHUNK_SIZE + x;
      const columnHeight = Math.min(CHUNK_HEIGHT, chunk.heightMap[columnIndex] + 2);

      for (let y = 0; y < columnHeight; y++) {
        const block = getBlockFromChunk(chunk, x, y, z);
        if (block === BlockType.AIR) continue;

        // Simplified: assume all blocks are cube with basic faces
        for (const face of ['TOP', 'BOTTOM', 'NORTH', 'SOUTH', 'EAST', 'WEST'] as Face[]) {
          const neighborBlock = getNeighborBlock(chunk, neighbors, x + getDx(face), y + getDy(face), z + getDz(face));
          if (!shouldRenderFace(block, neighborBlock)) continue;

          // Create geometry data for this face
          const textureUuid = `block_${block}_${face}`;
          const group = getOrCreateGroup(textureGroups, textureUuid, 'opaque');

          addFaceToGroup(group, x, y, z, face);
        }
      }
    }
  }

  const meshes: TextureGroupData[] = Array.from(textureGroups.values());

  return { meshes };
}

// Helper functions
function getBlockFromChunk(chunk: ChunkData, x: number, y: number, z: number): BlockType {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return BlockType.AIR;
  }
  const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
  return chunk.blocks[index];
}

function getNeighborBlock(chunk: ChunkData, neighbors: NeighborChunks, x: number, y: number, z: number): BlockType {
  if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;

  if (x < 0) return neighbors.west ? getBlockFromChunk(neighbors.west, CHUNK_SIZE - 1, y, z) : BlockType.AIR;
  if (x >= CHUNK_SIZE) return neighbors.east ? getBlockFromChunk(neighbors.east, 0, y, z) : BlockType.AIR;
  if (z < 0) return neighbors.north ? getBlockFromChunk(neighbors.north, x, y, CHUNK_SIZE - 1) : BlockType.AIR;
  if (z >= CHUNK_SIZE) return neighbors.south ? getBlockFromChunk(neighbors.south, x, y, 0) : BlockType.AIR;

  return getBlockFromChunk(chunk, x, y, z);
}

function shouldRenderFace(block: BlockType, neighborBlock: BlockType): boolean {
  if (block === BlockType.AIR) return false;
  if (neighborBlock === BlockType.AIR) return true;
  return block !== neighborBlock;
}

function getDx(face: Face): number {
  switch (face) {
    case 'EAST': return 1;
    case 'WEST': return -1;
    default: return 0;
  }
}

function getDy(face: Face): number {
  switch (face) {
    case 'TOP': return 1;
    case 'BOTTOM': return -1;
    default: return 0;
  }
}

function getDz(face: Face): number {
  switch (face) {
    case 'SOUTH': return 1;
    case 'NORTH': return -1;
    default: return 0;
  }
}

function getOrCreateGroup(textureGroups: Map<string, TextureGroupData>, textureUuid: string, renderMode: RenderMode): TextureGroupData {
  if (!textureGroups.has(textureUuid)) {
    textureGroups.set(textureUuid, {
      textureUuid,
      positions: [],
      normals: [],
      uvs: [],
      colors: [],
      indices: [],
      vertexCount: 0,
      renderMode,
    });
  }
  return textureGroups.get(textureUuid)!;
}

function addFaceToGroup(group: TextureGroupData, x: number, y: number, z: number, face: Face): void {
  const vertices = getFaceVertices(face, x, y, z);
  const normals = getFaceNormals(face);
  const uvs = [0, 1, 1, 1, 1, 0, 0, 0]; // Basic UVs

  for (let i = 0; i < 4; i++) {
    group.positions.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
    group.normals.push(normals[0], normals[1], normals[2]);
    group.uvs.push(uvs[i * 2], uvs[i * 2 + 1]);
    group.colors.push(1, 1, 1); // White tint
  }

  group.indices.push(
    group.vertexCount,
    group.vertexCount + 1,
    group.vertexCount + 2,
    group.vertexCount,
    group.vertexCount + 2,
    group.vertexCount + 3
  );
  group.vertexCount += 4;
}

function getFaceVertices(face: Face, x: number, y: number, z: number): number[] {
  switch (face) {
    case 'TOP': return [x, y + 1, z, x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z];
    case 'BOTTOM': return [x, y, z + 1, x, y, z, x + 1, y, z, x + 1, y, z + 1];
    case 'NORTH': return [x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z];
    case 'SOUTH': return [x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1];
    case 'EAST': return [x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1];
    case 'WEST': return [x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z];
  }
}

function getFaceNormals(face: Face): number[] {
  switch (face) {
    case 'TOP': return [0, 1, 0];
    case 'BOTTOM': return [0, -1, 0];
    case 'NORTH': return [0, 0, -1];
    case 'SOUTH': return [0, 0, 1];
    case 'EAST': return [1, 0, 0];
    case 'WEST': return [-1, 0, 0];
  }
}