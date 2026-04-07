import * as THREE from 'three';
import { BlockType, BLOCKS, BlockData } from '@/data/blocks';
import { BiomeType as VisualBiomeType, getBiomeData } from '@/data/biomes';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { ChunkData, getBlockFromChunk, getBlockStateFromChunk } from '@/stores/worldStore';
import { decodeTerrainBiome } from '@/utils/biomeEncoding';
import { textureManager } from '@/data/textureManager';
import { AdvancedBlockShader, WaterShader, LeavesShader, GlassShader, LavaShader, OreShader } from './AdvancedShaders';
import { BiomeType as TerrainBiomeType } from './TerrainGenerator';

type Face = 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
type FaceType = 'top' | 'bottom' | 'side';
type RenderMode = 'opaque' | 'cutout' | 'translucent';

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

const SHARED_DUMMY_TEXTURE = new THREE.Texture();
const textureRenderModeCache = new Map<string, RenderMode>();
const biomeDataCache = new Map<VisualBiomeType, ReturnType<typeof getBiomeData>>();
const biomeColorCache = new Map<VisualBiomeType, { grass: THREE.Color; foliage: THREE.Color }>();

function getTextureRenderMode(texture: THREE.Texture, fallback: RenderMode): RenderMode {
  const cached = textureRenderModeCache.get(texture.uuid);
  if (cached) return cached;

  const image = texture.image as
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageBitmap
    | OffscreenCanvas
    | undefined;

  if (image && 'width' in image && 'height' in image && image.width > 0 && image.height > 0 && 'getContext' in image) {
    const canvas = image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasTransparentPixels = false;
      let hasSemiTransparentPixels = false;

      for (let i = 3; i < pixels.length; i += 4) {
        const alpha = pixels[i];
        if (alpha === 0) {
          hasTransparentPixels = true;
          continue;
        }
        if (alpha < 255) {
          hasSemiTransparentPixels = true;
          break;
        }
      }

      const detectedMode: RenderMode = hasSemiTransparentPixels
        ? 'translucent'
        : hasTransparentPixels
          ? 'cutout'
          : fallback;

      textureRenderModeCache.set(texture.uuid, detectedMode);
      return detectedMode;
    }
  }

  textureRenderModeCache.set(texture.uuid, fallback);
  return fallback;
}

function getBlockRenderMode(block: BlockType, blockData: BlockData): RenderMode {
  const renderType = blockData.renderType || 'cube';
  const fallback: RenderMode =
    renderType === 'plant' || renderType === 'cross' || renderType === 'torch'
      ? 'cutout'
      : blockData.transparent
        ? 'translucent'
        : 'opaque';

  const texture = textureManager.getBlockTexture(block, 'side');
  return getTextureRenderMode(texture, fallback);
}

function getVisualBiomeType(biome: TerrainBiomeType): VisualBiomeType {
  switch (biome) {
    case TerrainBiomeType.SUNFLOWER_PLAINS:
      return VisualBiomeType.PLAINS;
    case TerrainBiomeType.BADLANDS:
      return VisualBiomeType.MESA;
    case TerrainBiomeType.SNOW:
      return VisualBiomeType.SNOWY_PLAINS;
    case TerrainBiomeType.MUSHROOM:
      return VisualBiomeType.MUSHROOM_ISLAND;
    case TerrainBiomeType.MEGA_MOUNTAINS:
      return VisualBiomeType.MOUNTAINS;
    case TerrainBiomeType.VOLCANIC:
      return VisualBiomeType.MESA;
    case TerrainBiomeType.ORANGE_GROVE:
      return VisualBiomeType.FOREST;
    default:
      return biome as unknown as VisualBiomeType;
  }
}

function getBiomeColors(chunk: ChunkData, x: number, z: number): { grass: THREE.Color; foliage: THREE.Color } {
  const index = z * CHUNK_SIZE + x;
  const biomeIndex = chunk.biomes[index] ?? 0;
  const terrainBiome = decodeTerrainBiome(biomeIndex);
  const visualBiome = getVisualBiomeType(terrainBiome);
  const cachedColors = biomeColorCache.get(visualBiome);
  if (cachedColors) return cachedColors;

  let biomeData = biomeDataCache.get(visualBiome);

  if (!biomeData) {
    biomeData = getBiomeData(visualBiome);
    biomeDataCache.set(visualBiome, biomeData);
  }

  const colors = {
    grass: new THREE.Color(biomeData.grassColor),
    foliage: new THREE.Color(biomeData.foliageColor),
  };
  biomeColorCache.set(visualBiome, colors);
  return colors;
}

function getTextureRotation(block: BlockType, face: Face, x: number, y: number, z: number): 0 | 1 | 2 | 3 {
  const blockData = BLOCKS[block];
  if (!blockData) return 0;

  const faceType = getFaceType(face);
  if (faceType !== 'side') return 0;
  if (blockData.renderType === 'plant' || blockData.renderType === 'cross' || blockData.renderType === 'torch') return 0;

  const hash = ((x * 73428767) ^ (y * 912271) ^ (z * 42317861) ^ (block * 19349663)) >>> 0;
  return (hash % 4) as 0 | 1 | 2 | 3;
}

function getRotatedFaceUvs(rotation: 0 | 1 | 2 | 3): number[][] {
  switch (rotation) {
    case 1:
      return [[1, 1], [1, 0], [0, 0], [0, 1]];
    case 2:
      return [[1, 0], [0, 0], [0, 1], [1, 1]];
    case 3:
      return [[0, 0], [0, 1], [1, 1], [1, 0]];
    default:
      return FACE_UVS;
  }
}

type BoxBounds = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

function getBoxFaceVertices(face: Face, bounds: BoxBounds): number[][] {
  const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
  switch (face) {
    case 'TOP':
      return [
        [minX, maxY, minZ],
        [minX, maxY, maxZ],
        [maxX, maxY, maxZ],
        [maxX, maxY, minZ],
      ];
    case 'BOTTOM':
      return [
        [minX, minY, maxZ],
        [minX, minY, minZ],
        [maxX, minY, minZ],
        [maxX, minY, maxZ],
      ];
    case 'NORTH':
      return [
        [maxX, minY, minZ],
        [minX, minY, minZ],
        [minX, maxY, minZ],
        [maxX, maxY, minZ],
      ];
    case 'SOUTH':
      return [
        [minX, minY, maxZ],
        [maxX, minY, maxZ],
        [maxX, maxY, maxZ],
        [minX, maxY, maxZ],
      ];
    case 'EAST':
      return [
        [maxX, minY, maxZ],
        [maxX, minY, minZ],
        [maxX, maxY, minZ],
        [maxX, maxY, maxZ],
      ];
    case 'WEST':
      return [
        [minX, minY, minZ],
        [minX, minY, maxZ],
        [minX, maxY, maxZ],
        [minX, maxY, minZ],
      ];
  }
}

function addFaceToGroup(
  group: TextureGroup,
  vertices: number[][],
  normal: number[],
  faceUvs: number[][],
  tint: THREE.Color,
  shade: number
): void {
  for (let i = 0; i < 4; i++) {
    const [vx, vy, vz] = vertices[i];
    group.positions.push(vx, vy, vz);
    group.normals.push(normal[0], normal[1], normal[2]);
    group.uvs.push(faceUvs[i][0], faceUvs[i][1]);
    group.colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
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

function isFenceConnectable(block: BlockType): boolean {
  if (block === BlockType.AIR) return false;
  const blockData = BLOCKS[block];
  if (!blockData) return false;
  if (blockData.liquid) return false;
  if (blockData.renderType === 'fence') return true;
  return blockData.solid && blockData.renderType !== 'cross' && blockData.renderType !== 'plant' && blockData.renderType !== 'torch';
}

function getStairsOrientation(block: BlockType, x: number, y: number, z: number): 0 | 1 | 2 | 3 {
  const hash = ((x * 1103515245) ^ (y * 12345) ^ (z * 2654435761) ^ (block * 97)) >>> 0;
  return (hash % 4) as 0 | 1 | 2 | 3;
}

function getStairBoundsFromState(state: number): BoxBounds[] {
  const facing = state & 3;
  const topHalf = (state & 4) !== 0;
  const lowerHalf: BoxBounds = topHalf
    ? { minX: 0, minY: 0.5, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
    : { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.5, maxZ: 1 };

  const upperStep: BoxBounds = (() => {
    switch (facing) {
      case 1:
        return { minX: 0.5, minY: topHalf ? 0 : 0.5, minZ: 0, maxX: 1, maxY: topHalf ? 0.5 : 1, maxZ: 1 };
      case 2:
        return { minX: 0, minY: topHalf ? 0 : 0.5, minZ: 0, maxX: 1, maxY: topHalf ? 0.5 : 1, maxZ: 0.5 };
      case 3:
        return { minX: 0, minY: topHalf ? 0 : 0.5, minZ: 0, maxX: 0.5, maxY: topHalf ? 0.5 : 1, maxZ: 1 };
      default:
        return { minX: 0, minY: topHalf ? 0 : 0.5, minZ: 0.5, maxX: 0.5, maxY: topHalf ? 0.5 : 1, maxZ: 1 };
    }
  })();

  return [lowerHalf, upperStep];
}

function applyBiomeTint(
  block: BlockType,
  blockData: BlockData,
  biomeColors: { grass: THREE.Color; foliage: THREE.Color },
  face: Face
): THREE.Color {
  const tint = new THREE.Color(1, 1, 1);

  if (block === BlockType.GRASS || block === BlockType.FARMLAND) {
    tint.copy(biomeColors.grass);
    if (face === 'TOP') {
      tint.lerp(new THREE.Color(1, 1, 1), 0.15);
    }
    return tint;
  }

  if (
    blockData.renderType === 'plant' ||
    blockData.renderType === 'cross' ||
    block === BlockType.OAK_LEAVES ||
    block === BlockType.BIRCH_LEAVES ||
    block === BlockType.SPRUCE_LEAVES ||
    block === BlockType.JUNGLE_LEAVES ||
    block === BlockType.ACACIA_LEAVES ||
    block === BlockType.DARK_OAK_LEAVES ||
    block === BlockType.VINE ||
    block === BlockType.SUGAR_CANE ||
    block === BlockType.TALL_GRASS
  ) {
    tint.copy(biomeColors.foliage);
    return tint;
  }

  return tint;
}

function isOccludingBlock(block: BlockType): boolean {
  const blockData = BLOCKS[block];
  if (!blockData) return false;
  if (block === BlockType.AIR || blockData.liquid) return false;
  return getBlockRenderMode(block, blockData) === 'opaque' && blockData.solid;
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

  const blockRenderMode = getBlockRenderMode(block, blockData);
  const neighborRenderMode = getBlockRenderMode(neighborBlock, neighborData);

  if (blockRenderMode === 'opaque' && neighborRenderMode === 'opaque') {
    return false;
  }

  if (block === neighborBlock) {
    return false;
  }

  if (blockData.liquid && neighborData.liquid) {
    return false;
  }

  return true;
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
  renderMode: RenderMode;
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
      return 0.82;
    case 'EAST':
    case 'WEST':
      return 0.72;
    default:
      return 0.78;
  }
}

// AO constants hoisted to module scope (avoid allocation per face)
const AO_CURVE = [1.0, 0.88, 0.74, 0.6];
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
    const s1 = isOccludingAt(chunk, neighbors, x + e1[0], y + e1[1], z + e1[2]) ? 1 : 0;
    const s2 = isOccludingAt(chunk, neighbors, x + e2[0], y + e2[1], z + e2[2]) ? 1 : 0;
    const sc = (s1 && s2) ? 1 : (isOccludingAt(chunk, neighbors, x + c[0], y + c[1], z + c[2]) ? 1 : 0);
    result[v] = AO_CURVE[s1 + s2 + sc];
  }
  return result;
}

function isOccludingAt(chunk: ChunkData, neighbors: NeighborChunks, x: number, y: number, z: number): boolean {
  const block = getNeighborBlock(chunk, neighbors, x, y, z);
  return isOccludingBlock(block);
}

// Helper to get or create texture group
function getOrCreateGroup(
  textureGroups: Map<THREE.Texture, TextureGroup>,
  texture: THREE.Texture,
  renderMode: RenderMode
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
      renderMode,
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

function addBoxModel(
  chunk: ChunkData,
  neighbors: NeighborChunks,
  facesByKey: Map<THREE.Texture, TextureGroup>,
  block: BlockType,
  blockData: BlockData,
  x: number,
  y: number,
  z: number,
  bounds: BoxBounds,
  biomeColors: { grass: THREE.Color; foliage: THREE.Color },
  faces: typeof CUBE_FACES = CUBE_FACES
): void {
  const renderMode = getBlockRenderMode(block, blockData);
  const tint = applyBiomeTint(block, blockData, biomeColors, 'TOP');

  for (const { face, dx, dy, dz } of faces) {
    const neighborBlock = getNeighborBlock(chunk, neighbors, x + dx, y + dy, z + dz);
    if (!shouldRenderFace(block, neighborBlock)) continue;

    const faceType = getFaceType(face);
    const texture = textureManager.getBlockTexture(block, faceType);
    const group = getOrCreateGroup(facesByKey, texture, renderMode);
    const rotation = getTextureRotation(block, face, x, y, z);
    const faceUvs = getRotatedFaceUvs(rotation);
    const faceShade = getFaceShade(face);
    const vertices = getBoxFaceVertices(face, {
      minX: x + bounds.minX,
      minY: y + bounds.minY,
      minZ: z + bounds.minZ,
      maxX: x + bounds.maxX,
      maxY: y + bounds.maxY,
      maxZ: z + bounds.maxZ,
    });
    const faceTint = face === 'TOP' ? tint.clone().lerp(new THREE.Color(1, 1, 1), 0.1) : tint;
    addFaceToGroup(group, vertices, FACE_NORMALS[face], faceUvs, faceTint, faceShade);
  }
}

export function buildMultiTextureChunkMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks
): { geometry: THREE.BufferGeometry; texture: THREE.Texture; renderMode: RenderMode }[] | null {
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
      const biomeColors = getBiomeColors(chunk, x, z);

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
          const group = getOrCreateGroup(textureGroups, texture, 'cutout');
          addCrossMesh(group, x, y, z);
          continue;
        }

        if (renderType === 'slab') {
          const state = getBlockStateFromChunk(chunk, x, y, z);
          const topHalf = (state & 1) !== 0;
          addBoxModel(
            chunk,
            neighbors,
            textureGroups,
            block,
            blockData,
            x,
            y,
            z,
            topHalf
              ? { minX: 0, minY: 0.5, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
              : { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.5, maxZ: 1 },
            biomeColors
          );
          continue;
        }

        if (renderType === 'stairs') {
          const state = getBlockStateFromChunk(chunk, x, y, z);
          const stairBounds = state > 0 ? getStairBoundsFromState(state) : getStairBoundsFromState(getStairsOrientation(block, x, y, z));

          for (const bounds of stairBounds) {
            addBoxModel(chunk, neighbors, textureGroups, block, blockData, x, y, z, bounds, biomeColors);
          }
          continue;
        }

        if (renderType === 'fence') {
          addBoxModel(
            chunk,
            neighbors,
            textureGroups,
            block,
            blockData,
            x,
            y,
            z,
            { minX: 0.375, minY: 0, minZ: 0.375, maxX: 0.625, maxY: 1, maxZ: 0.625 },
            biomeColors
          );

          const connectNorth = isFenceConnectable(getNeighborBlock(chunk, neighbors, x, y, z - 1));
          const connectSouth = isFenceConnectable(getNeighborBlock(chunk, neighbors, x, y, z + 1));
          const connectWest = isFenceConnectable(getNeighborBlock(chunk, neighbors, x - 1, y, z));
          const connectEast = isFenceConnectable(getNeighborBlock(chunk, neighbors, x + 1, y, z));

          const railYMin = 0.375;
          const railYMax = 0.75;
          if (connectNorth) {
            addBoxModel(chunk, neighbors, textureGroups, block, blockData, x, y, z, { minX: 0.4375, minY: railYMin, minZ: 0, maxX: 0.5625, maxY: railYMax, maxZ: 0.4375 }, biomeColors);
          }
          if (connectSouth) {
            addBoxModel(chunk, neighbors, textureGroups, block, blockData, x, y, z, { minX: 0.4375, minY: railYMin, minZ: 0.5625, maxX: 0.5625, maxY: railYMax, maxZ: 1 }, biomeColors);
          }
          if (connectWest) {
            addBoxModel(chunk, neighbors, textureGroups, block, blockData, x, y, z, { minX: 0, minY: railYMin, minZ: 0.4375, maxX: 0.4375, maxY: railYMax, maxZ: 0.5625 }, biomeColors);
          }
          if (connectEast) {
            addBoxModel(chunk, neighbors, textureGroups, block, blockData, x, y, z, { minX: 0.5625, minY: railYMin, minZ: 0.4375, maxX: 1, maxY: railYMax, maxZ: 0.5625 }, biomeColors);
          }
          continue;
        }

        const renderMode = getBlockRenderMode(block, blockData);

        for (const { face, dx, dy, dz } of CUBE_FACES) {
          const neighborBlock = getNeighborBlock(chunk, neighbors, x + dx, y + dy, z + dz);

          if (!shouldRenderFace(block, neighborBlock)) continue;

          // Get face-specific texture
          const faceType = getFaceType(face);
          const texture = textureManager.getBlockTexture(block, faceType);
          const group = getOrCreateGroup(textureGroups, texture, renderMode);
          const rotation = getTextureRotation(block, face, x, y, z);
          const faceUvs = getRotatedFaceUvs(rotation);

          // Calculate face shade + per-vertex AO
          const faceShade = getFaceShade(face);
          const ao = getVertexAO(chunk, neighbors, x, y, z, face);
          const tint = applyBiomeTint(block, blockData, biomeColors, face);

          // Add vertices for this face
          const faceVertices = FACE_VERTICES[face];
          const faceNormals = FACE_NORMALS[face];

          for (let i = 0; i < 4; i++) {
            const [vx, vy, vz] = faceVertices[i];
            group.positions.push(x + vx, y + vy, z + vz);
            group.normals.push(faceNormals[0], faceNormals[1], faceNormals[2]);
            group.uvs.push(faceUvs[i][0], faceUvs[i][1]);
            const shade = faceShade * ao[i];
            group.colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
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
  const result: { geometry: THREE.BufferGeometry; texture: THREE.Texture; renderMode: RenderMode }[] = [];

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
      renderMode: group.renderMode,
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
  return AdvancedBlockShader.createMaterial(SHARED_DUMMY_TEXTURE, {
    sunDirection: new THREE.Vector3(0.5, 1, 0.3).normalize(),
    sunColor: new THREE.Color(1, 0.98, 0.9),
    sunIntensity: 1.0,
    ambientColor: new THREE.Color(0.4, 0.45, 0.5),
    ambientIntensity: 0.4,
  });
}

export function createWaterMaterial(): THREE.ShaderMaterial {
  return WaterShader.createMaterial({
    shallowColor: new THREE.Color(0.2, 0.5, 0.8),
    deepColor: new THREE.Color(0.1, 0.2, 0.4),
    opacity: 0.15,
  });
}

export function createLavaMaterial(): THREE.ShaderMaterial {
  return LavaShader.createMaterial({
    lavaCoolColor: new THREE.Color(0.10, 0.03, 0.02),  // Dark basalt
    lavaMidColor: new THREE.Color(0.85, 0.24, 0.02),   // Orange flow
    lavaHotColor: new THREE.Color(1.00, 0.74, 0.10),   // Bright yellow-white
    emissiveStrength: 2.5,
  });
}

export function createLeavesMaterial(): THREE.ShaderMaterial {
  // Create a dummy texture for the shader - will be replaced when actual texture is set
  return LeavesShader.createMaterial(SHARED_DUMMY_TEXTURE, {
    leafTint: new THREE.Color(0.4, 0.7, 0.2),
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
  return OreShader.createMaterial(SHARED_DUMMY_TEXTURE, {
    oreColor: new THREE.Color(1, 1, 1),
    sparkleIntensity: 0.5,
  });
}
