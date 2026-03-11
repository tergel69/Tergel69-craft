import { create } from 'zustand';
import { BlockType } from '@/data/blocks';
import { BiomeType } from '@/data/biomes';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { chunkKey, getBlockIndex, worldToChunk, worldToLocal } from '@/utils/coordinates';

export interface ChunkData {
  x: number;
  z: number;
  blocks: Uint8Array; // Flat array of block IDs
  biomes: Uint8Array; // Biome data per column
  heightMap: Uint16Array; // Highest solid block per column
  lightMap: Uint8Array; // Light levels
  isDirty: boolean; // Needs mesh rebuild
  isGenerated: boolean;
  mesh?: unknown; // Three.js mesh reference
}

interface WorldStore {
  // Chunk storage
  chunks: Map<string, ChunkData>;
  loadedChunks: Set<string>;
  dirtyChunks: Set<string>;

  // World seed
  seed: number;

  // Block modifications (for saving)
  modifications: Map<string, Map<number, BlockType>>;

  // Actions
  setSeed: (seed: number) => void;
  getChunk: (x: number, z: number) => ChunkData | undefined;
  setChunk: (x: number, z: number, data: ChunkData) => void;
  removeChunk: (x: number, z: number) => void;
  getBlock: (x: number, y: number, z: number) => BlockType;
  setBlock: (x: number, y: number, z: number, block: BlockType) => void;
  markChunkDirty: (x: number, z: number) => void;
  clearDirtyChunks: () => string[];
  isChunkLoaded: (x: number, z: number) => boolean;
  getLoadedChunkCount: () => number;
  reset: () => void;
  loadChunkModifications: (chunkKey: string, modifications: { [index: string]: number }) => void;
  loadAllChunkModifications: (modifications: Map<string, { [index: string]: number }>) => void;
}

function createEmptyChunk(x: number, z: number): ChunkData {
  return {
    x,
    z,
    blocks: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
    biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
    heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
    lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15),
    isDirty: true,
    isGenerated: false,
  };
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  chunks: new Map(),
  loadedChunks: new Set(),
  dirtyChunks: new Set(),
  seed: Date.now(),
  modifications: new Map(),

  setSeed: (seed) => set({ seed }),

  getChunk: (x, z) => {
    return get().chunks.get(chunkKey(x, z));
  },

  setChunk: (x, z, data) => {
    const key = chunkKey(x, z);
    set((state) => {
      const newChunks = new Map(state.chunks);
      const newLoadedChunks = new Set(state.loadedChunks);
      newChunks.set(key, data);
      newLoadedChunks.add(key);
      return { chunks: newChunks, loadedChunks: newLoadedChunks };
    });
  },

  removeChunk: (x, z) => {
    const key = chunkKey(x, z);
    set((state) => {
      const newChunks = new Map(state.chunks);
      const newLoadedChunks = new Set(state.loadedChunks);
      const newDirtyChunks = new Set(state.dirtyChunks);
      newChunks.delete(key);
      newLoadedChunks.delete(key);
      newDirtyChunks.delete(key);
      return {
        chunks: newChunks,
        loadedChunks: newLoadedChunks,
        dirtyChunks: newDirtyChunks,
      };
    });
  },

  getBlock: (x, y, z) => {
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;

    const chunkCoord = worldToChunk(x, z);
    const chunk = get().chunks.get(chunkKey(chunkCoord.x, chunkCoord.z));

    if (!chunk || !chunk.isGenerated) return BlockType.AIR;

    const local = worldToLocal(x, y, z);
    const index = getBlockIndex(local.x, local.y, local.z);

    return chunk.blocks[index] as BlockType;
  },

  setBlock: (x, y, z, block) => {
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const chunkCoord = worldToChunk(x, z);
    const key = chunkKey(chunkCoord.x, chunkCoord.z);
    const { chunks, modifications } = get();
    const chunk = chunks.get(key);

    if (!chunk) return;

    const local = worldToLocal(x, y, z);
    const index = getBlockIndex(local.x, local.y, local.z);

    // Update block
    chunk.blocks[index] = block;
    chunk.isDirty = true;

    // Update height map
    const columnIndex = local.z * CHUNK_SIZE + local.x;
    if (block !== BlockType.AIR) {
      if (y > chunk.heightMap[columnIndex]) {
        chunk.heightMap[columnIndex] = y;
      }
    } else if (y === chunk.heightMap[columnIndex]) {
      // Find new highest block
      let newHeight = 0;
      for (let checkY = y - 1; checkY >= 0; checkY--) {
        const checkIndex = getBlockIndex(local.x, checkY, local.z);
        if (chunk.blocks[checkIndex] !== BlockType.AIR) {
          newHeight = checkY;
          break;
        }
      }
      chunk.heightMap[columnIndex] = newHeight;
    }

    // Store modification
    if (!modifications.has(key)) {
      modifications.set(key, new Map());
    }
    modifications.get(key)!.set(index, block);

    // Mark this chunk and adjacent chunks as dirty (for mesh updates)
    const dirtyChunks = new Set(get().dirtyChunks);
    dirtyChunks.add(key);

    // Check if block is on chunk boundary and mark neighbor chunks dirty
    if (local.x === 0) {
      dirtyChunks.add(chunkKey(chunkCoord.x - 1, chunkCoord.z));
    } else if (local.x === CHUNK_SIZE - 1) {
      dirtyChunks.add(chunkKey(chunkCoord.x + 1, chunkCoord.z));
    }
    if (local.z === 0) {
      dirtyChunks.add(chunkKey(chunkCoord.x, chunkCoord.z - 1));
    } else if (local.z === CHUNK_SIZE - 1) {
      dirtyChunks.add(chunkKey(chunkCoord.x, chunkCoord.z + 1));
    }

    set({ dirtyChunks });
  },

  markChunkDirty: (x, z) => {
    set((state) => {
      const newDirtyChunks = new Set(state.dirtyChunks);
      newDirtyChunks.add(chunkKey(x, z));
      return { dirtyChunks: newDirtyChunks };
    });
  },

  clearDirtyChunks: () => {
    const dirty = Array.from(get().dirtyChunks);
    set({ dirtyChunks: new Set() });
    return dirty;
  },

  isChunkLoaded: (x, z) => {
    return get().loadedChunks.has(chunkKey(x, z));
  },

  getLoadedChunkCount: () => {
    return get().loadedChunks.size;
  },

  reset: () => {
    set({
      chunks: new Map(),
      loadedChunks: new Set(),
      dirtyChunks: new Set(),
      modifications: new Map(),
    });
  },

  loadChunkModifications: (chunkKeyStr, blockChanges) => {
    const state = get();
    
    // Get or create the chunk
    let chunk = state.chunks.get(chunkKeyStr);
    if (!chunk) {
      // Extract chunk coordinates from key (format: "x,z")
      const [x, z] = chunkKeyStr.split(',').map(Number);
      chunk = createEmptyChunk(x, z);
      state.chunks.set(chunkKeyStr, chunk);
    }

    // Apply block changes
    const modificationsMap = new Map<number, BlockType>();
    
    for (const [indexStr, blockType] of Object.entries(blockChanges)) {
      const blockIndex = parseInt(indexStr);
      const type = blockType as BlockType;
      
      // Update block in chunk
      chunk.blocks[blockIndex] = type;
      modificationsMap.set(blockIndex, type);
      
      // Update height map if necessary
      const x = (blockIndex % (CHUNK_SIZE * CHUNK_HEIGHT)) % CHUNK_SIZE;
      const y = Math.floor((blockIndex % (CHUNK_SIZE * CHUNK_HEIGHT)) / CHUNK_SIZE);
      const z = Math.floor(blockIndex / (CHUNK_SIZE * CHUNK_HEIGHT));
      const columnIndex = z * CHUNK_SIZE + x;
      
      if (type !== BlockType.AIR) {
        if (y > chunk.heightMap[columnIndex]) {
          chunk.heightMap[columnIndex] = y;
        }
      } else if (y === chunk.heightMap[columnIndex]) {
        let newHeight = 0;
        for (let checkY = y - 1; checkY >= 0; checkY--) {
          const checkIndex = getBlockIndex(x, checkY, z);
          if (chunk.blocks[checkIndex] !== BlockType.AIR) {
            newHeight = checkY;
            break;
          }
        }
        chunk.heightMap[columnIndex] = newHeight;
      }
    }

    // Store modifications
    const newModifications = new Map(state.modifications);
    newModifications.set(chunkKeyStr, modificationsMap);

    // Mark chunk as dirty for mesh rebuild
    const newDirtyChunks = new Set(state.dirtyChunks);
    newDirtyChunks.add(chunkKeyStr);

    set({
      modifications: newModifications,
      dirtyChunks: newDirtyChunks,
    });
  },

  loadAllChunkModifications: (allModifications) => {
    for (const [chunkKeyStr, blockChanges] of allModifications) {
      get().loadChunkModifications(chunkKeyStr, blockChanges);
    }
  },
}));

// Helper to create chunk with blocks
export function createChunk(x: number, z: number): ChunkData {
  return createEmptyChunk(x, z);
}

// Get block from chunk data directly
export function getBlockFromChunk(chunk: ChunkData, localX: number, y: number, localZ: number): BlockType {
  if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;
  if (localX < 0 || localX >= CHUNK_SIZE) return BlockType.AIR;
  if (localZ < 0 || localZ >= CHUNK_SIZE) return BlockType.AIR;

  const index = getBlockIndex(localX, y, localZ);
  return chunk.blocks[index] as BlockType;
}

// Set block in chunk data directly
export function setBlockInChunk(chunk: ChunkData, localX: number, y: number, localZ: number, block: BlockType): void {
  if (y < 0 || y >= CHUNK_HEIGHT) return;
  if (localX < 0 || localX >= CHUNK_SIZE) return;
  if (localZ < 0 || localZ >= CHUNK_SIZE) return;

  const index = getBlockIndex(localX, y, localZ);
  chunk.blocks[index] = block;
}
