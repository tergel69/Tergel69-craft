/**
 * Greedy Mesher - Optimizes mesh generation by merging adjacent faces
 * Reduces polygon count significantly for flat surfaces
 */
import { BlockType, BLOCKS } from '../data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../utils/constants';
import { ChunkData, getBlockFromChunk } from '../stores/worldStore';

interface NeighborChunks {
  north?: ChunkData;
  south?: ChunkData;
  east?: ChunkData;
  west?: ChunkData;
}

interface GreedyQuad {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  face: number; // 0-5 for cube faces
  block: BlockType;
}

// Face directions: [dx, dy, dz] for each of 6 faces
const FACE_DIRECTIONS = [
  [0, 1, 0],  // TOP
  [0, -1, 0], // BOTTOM
  [0, 0, -1], // NORTH
  [0, 0, 1],  // SOUTH
  [1, 0, 0],  // EAST
  [-1, 0, 0], // WEST
];

// Perpendicular axes for each face (for 2D greedy meshing)
const FACE_AXES = [
  [0, 2], // TOP: x, z
  [0, 2], // BOTTOM: x, z
  [0, 1], // NORTH: x, y
  [0, 1], // SOUTH: x, y
  [1, 2], // EAST: y, z
  [1, 2], // WEST: y, z
];

export class GreedyMesher {
  private static readonly MAX_MERGE_SIZE = 16;

  /**
   * Generate optimized quads using greedy meshing algorithm
   */
  public generateQuads(chunk: ChunkData, neighbors: NeighborChunks): GreedyQuad[] {
    const quads: GreedyQuad[] = [];
    const visited = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    for (let face = 0; face < 6; face++) {
      this.processFace(chunk, neighbors, face, visited, quads);
    }

    return quads;
  }

  private processFace(
    chunk: ChunkData,
    neighbors: NeighborChunks,
    face: number,
    visited: Uint8Array,
    quads: GreedyQuad[]
  ): void {
    const [uAxis, vAxis] = FACE_AXES[face];
    const direction = FACE_DIRECTIONS[face];

    // Iterate through each position on the face axis
    for (let depth = 0; depth < CHUNK_HEIGHT; depth++) {
      this.processDepthLayer(chunk, neighbors, face, depth, direction, uAxis, vAxis, visited, quads);
    }
  }

  private processDepthLayer(
    chunk: ChunkData,
    neighbors: NeighborChunks,
    face: number,
    depth: number,
    direction: number[],
    uAxis: number,
    vAxis: number,
    visited: Uint8Array,
    quads: GreedyQuad[]
  ): void {
    const mask: (BlockType | null)[][] = this.createFaceMask(
      chunk, neighbors, face, depth, direction
    );

    let u = 0;
    while (u < CHUNK_SIZE) {
      let v = 0;
      while (v < CHUNK_SIZE) {
        if (!mask[u][v] || this.isVisited(visited, u, depth, v, face)) {
          v++;
          continue;
        }

        // Find maximum width we can expand
        let width = 1;
        const currentBlock = mask[u][v]!;

        while (
          u + width < CHUNK_SIZE &&
          mask[u + width][v] === currentBlock &&
          !this.isVisited(visited, u + width, depth, v, face)
        ) {
          width++;
          if (width >= GreedyMesher.MAX_MERGE_SIZE) break;
        }

        // Find maximum height we can expand for this width
        let height = 1;
        let canExpand = true;

        while (canExpand && v + height < CHUNK_SIZE) {
          for (let i = 0; i < width; i++) {
            if (
              mask[u + i][v + height] !== currentBlock ||
              this.isVisited(visited, u + i, depth, v + height, face)
            ) {
              canExpand = false;
              break;
            }
          }

          if (canExpand) {
            height++;
            if (height >= GreedyMesher.MAX_MERGE_SIZE) break;
          }
        }

        // Mark all merged blocks as visited
        for (let i = 0; i < width; i++) {
          for (let j = 0; j < height; j++) {
            this.markVisited(visited, u + i, depth, v + j, face);
          }
        }

        // Add the merged quad
        quads.push({
          x: u,
          y: depth,
          z: v,
          width,
          height,
          face,
          block: currentBlock,
        });

        v += height;
      }
      u++;
    }
  }

  private createFaceMask(
    chunk: ChunkData,
    neighbors: NeighborChunks,
    face: number,
    depth: number,
    direction: number[]
  ): (BlockType | null)[][] {
    const mask: (BlockType | null)[][] = Array(CHUNK_SIZE)
      .fill(null)
      .map(() => Array(CHUNK_SIZE).fill(null));

    for (let u = 0; u < CHUNK_SIZE; u++) {
      for (let v = 0; v < CHUNK_SIZE; v++) {
        const [x, y, z] = this.getWorldCoordinates(u, depth, v, face);

        const currentBlock = getBlockFromChunk(chunk, x, y, z);
        if (currentBlock === BlockType.AIR) continue;

        // Check neighbor in face direction
        const neighborBlock = this.getNeighborBlock(
          chunk, neighbors,
          x + direction[0],
          y + direction[1],
          z + direction[2]
        );

        // Only render face if neighbor is not occluding
        if (!this.isOccluding(neighborBlock)) {
          mask[u][v] = currentBlock;
        }
      }
    }

    return mask;
  }

  private getWorldCoordinates(u: number, depth: number, v: number, face: number): [number, number, number] {
    switch (face) {
      case 0: case 1: return [u, depth, v];
      case 2: case 3: return [u, v, depth];
      case 4: case 5: return [depth, u, v];
      default: return [u, depth, v];
    }
  }

  private getNeighborBlock(
    chunk: ChunkData,
    neighbors: NeighborChunks,
    x: number, y: number, z: number
  ): BlockType {
    // Handle chunk boundaries
    if (x < 0 && neighbors.west) {
      return getBlockFromChunk(neighbors.west, CHUNK_SIZE - 1, y, z);
    }
    if (x >= CHUNK_SIZE && neighbors.east) {
      return getBlockFromChunk(neighbors.east, 0, y, z);
    }
    if (z < 0 && neighbors.north) {
      return getBlockFromChunk(neighbors.north, x, y, CHUNK_SIZE - 1);
    }
    if (z >= CHUNK_SIZE && neighbors.south) {
      return getBlockFromChunk(neighbors.south, x, y, 0);
    }

    if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return BlockType.AIR;

    return getBlockFromChunk(chunk, x, y, z);
  }

  private isOccluding(block: BlockType): boolean {
    if (block === BlockType.AIR) return false;
    const blockData = BLOCKS[block];
    return blockData?.solid && !blockData?.transparent;
  }

  private isVisited(visited: Uint8Array, x: number, y: number, z: number, face: number): boolean {
    const index = (y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x);
    return (visited[index] & (1 << face)) !== 0;
  }

  private markVisited(visited: Uint8Array, x: number, y: number, z: number, face: number): void {
    const index = (y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x);
    visited[index] |= (1 << face);
  }
}

export const greedyMesher = new GreedyMesher();