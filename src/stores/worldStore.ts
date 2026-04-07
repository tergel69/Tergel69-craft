import { create } from 'zustand';
import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { BiomeType } from '@/data/biomes';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { chunkKey, getBlockIndex, worldToChunk, worldToLocal } from '@/utils/coordinates';

export interface ChunkData {
  x: number;
  z: number;
  blocks: Uint8Array; // Flat array of block IDs
  blockStates: Uint8Array; // Extra per-block state data (stairs/slabs/etc.)
  biomes: Uint8Array; // Biome data per column
  heightMap: Uint16Array; // Highest solid block per column
  lightMap: Uint8Array; // Light levels
  isDirty: boolean; // Needs mesh rebuild
  isGenerated: boolean;
  mesh?: unknown; // Three.js mesh reference
}

export interface ContainerSlot {
  item: BlockType | ItemType | null;
  count: number;
  durability?: number;
  enchantments?: Record<string, number>;
}

export interface ChestBlockEntity {
  type: 'chest';
  slots: ContainerSlot[];
}

export interface FurnaceBlockEntity {
  type: 'furnace';
  input: ContainerSlot;
  fuel: ContainerSlot;
  output: ContainerSlot;
  burnTime: number;
  cookTime: number;
}

export type BlockEntityData = ChestBlockEntity | FurnaceBlockEntity;

interface WorldStore {
  // Chunk storage
  chunks: Map<string, ChunkData>;
  loadedChunks: Set<string>;
  dirtyChunks: Set<string>;
  blockEntities: Map<string, BlockEntityData>;
  loadedChunkVersion: number;
  dirtyChunkVersion: number;
  blockEntityVersion: number;

  // World seed
  seed: number;

  // Block modifications (for saving)
  modifications: Map<string, Map<number, number>>;

  // Actions
  setSeed: (seed: number) => void;
  getChunk: (x: number, z: number) => ChunkData | undefined;
  setChunk: (x: number, z: number, data: ChunkData) => void;
  removeChunk: (x: number, z: number) => void;
  getBlock: (x: number, y: number, z: number) => BlockType;
  setBlock: (x: number, y: number, z: number, block: BlockType, state?: number) => void;
  getBlockEntity: (x: number, y: number, z: number) => BlockEntityData | undefined;
  setBlockEntity: (x: number, y: number, z: number, entity: BlockEntityData) => void;
  removeBlockEntity: (x: number, y: number, z: number) => void;
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
    blockStates: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
    biomes: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
    heightMap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
    lightMap: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15),
    isDirty: true,
    isGenerated: false,
  };
}

function blockEntityKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function createEmptySlot(): ContainerSlot {
  return { item: null, count: 0 };
}

function bumpVersions(
  state: WorldStore,
  patch: Partial<Pick<WorldStore, 'loadedChunkVersion' | 'dirtyChunkVersion' | 'blockEntityVersion'>>
): Partial<WorldStore> {
  return {
    loadedChunkVersion: patch.loadedChunkVersion ?? state.loadedChunkVersion,
    dirtyChunkVersion: patch.dirtyChunkVersion ?? state.dirtyChunkVersion,
    blockEntityVersion: patch.blockEntityVersion ?? state.blockEntityVersion,
  };
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  chunks: new Map(),
  loadedChunks: new Set(),
  dirtyChunks: new Set(),
  blockEntities: new Map(),
  loadedChunkVersion: 0,
  dirtyChunkVersion: 0,
  blockEntityVersion: 0,
  seed: Date.now(),
  modifications: new Map(),

  setSeed: (seed) => set({ seed }),

  getChunk: (x, z) => {
    return get().chunks.get(chunkKey(x, z));
  },

  setChunk: (x, z, data) => {
    const state = get();
    const key = chunkKey(x, z);
    state.chunks.set(key, data);
    state.loadedChunks.add(key);
    set(bumpVersions(state, { loadedChunkVersion: state.loadedChunkVersion + 1 }));
  },

  removeChunk: (x, z) => {
    const state = get();
    const key = chunkKey(x, z);
    state.chunks.delete(key);
    state.loadedChunks.delete(key);
    state.dirtyChunks.delete(key);

    let removedBlockEntities = false;
    for (const entityKey of Array.from(state.blockEntities.keys())) {
      const [ex, , ez] = entityKey.split(',').map(Number);
      const chunkCoord = worldToChunk(ex, ez);
      if (chunkCoord.x === x && chunkCoord.z === z) {
        state.blockEntities.delete(entityKey);
        removedBlockEntities = true;
      }
    }

    set(
      bumpVersions(state, {
        loadedChunkVersion: state.loadedChunkVersion + 1,
        dirtyChunkVersion: state.dirtyChunkVersion + 1,
        blockEntityVersion: removedBlockEntities ? state.blockEntityVersion + 1 : state.blockEntityVersion,
      })
    );
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

  setBlock: (x, y, z, block, stateBits = 0) => {
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const store = get();
    const chunkCoord = worldToChunk(x, z);
    const key = chunkKey(chunkCoord.x, chunkCoord.z);
    const chunk = store.chunks.get(key);

    if (!chunk) return;

    const local = worldToLocal(x, y, z);
    const index = getBlockIndex(local.x, local.y, local.z);

    chunk.blocks[index] = block;
    chunk.blockStates[index] = stateBits & 0xff;
    chunk.isDirty = true;

    const entityKey = blockEntityKey(x, y, z);
    let blockEntityChanged = false;
    if (block === BlockType.CHEST) {
      const existing = store.blockEntities.get(entityKey);
      if (!existing || existing.type !== 'chest') {
        store.blockEntities.set(entityKey, { type: 'chest', slots: Array.from({ length: 27 }, createEmptySlot) });
        blockEntityChanged = true;
      }
    } else if (block === BlockType.FURNACE) {
      const existing = store.blockEntities.get(entityKey);
      if (!existing || existing.type !== 'furnace') {
        store.blockEntities.set(entityKey, {
          type: 'furnace',
          input: createEmptySlot(),
          fuel: createEmptySlot(),
          output: createEmptySlot(),
          burnTime: 0,
          cookTime: 0,
        });
        blockEntityChanged = true;
      }
    } else if (store.blockEntities.delete(entityKey)) {
      blockEntityChanged = true;
    }

    const columnIndex = local.z * CHUNK_SIZE + local.x;
    if (block !== BlockType.AIR) {
      if (y > chunk.heightMap[columnIndex]) {
        chunk.heightMap[columnIndex] = y;
      }
    } else if (y === chunk.heightMap[columnIndex]) {
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

    let chunkModifications = store.modifications.get(key);
    if (!chunkModifications) {
      chunkModifications = new Map();
      store.modifications.set(key, chunkModifications);
    }
    chunkModifications.set(index, block | ((stateBits & 0xff) << 8));

    store.dirtyChunks.add(key);
    if (local.x === 0) {
      store.dirtyChunks.add(chunkKey(chunkCoord.x - 1, chunkCoord.z));
    } else if (local.x === CHUNK_SIZE - 1) {
      store.dirtyChunks.add(chunkKey(chunkCoord.x + 1, chunkCoord.z));
    }
    if (local.z === 0) {
      store.dirtyChunks.add(chunkKey(chunkCoord.x, chunkCoord.z - 1));
    } else if (local.z === CHUNK_SIZE - 1) {
      store.dirtyChunks.add(chunkKey(chunkCoord.x, chunkCoord.z + 1));
    }

    set(
      bumpVersions(store, {
        dirtyChunkVersion: store.dirtyChunkVersion + 1,
        blockEntityVersion: blockEntityChanged ? store.blockEntityVersion + 1 : store.blockEntityVersion,
      })
    );
  },

  getBlockEntity: (x, y, z) => {
    return get().blockEntities.get(blockEntityKey(x, y, z));
  },

  setBlockEntity: (x, y, z, entity) => {
    const state = get();
    state.blockEntities.set(blockEntityKey(x, y, z), entity);
    set(bumpVersions(state, { blockEntityVersion: state.blockEntityVersion + 1 }));
  },

  removeBlockEntity: (x, y, z) => {
    const state = get();
    if (state.blockEntities.delete(blockEntityKey(x, y, z))) {
      set(bumpVersions(state, { blockEntityVersion: state.blockEntityVersion + 1 }));
    }
  },

  markChunkDirty: (x, z) => {
    const state = get();
    state.dirtyChunks.add(chunkKey(x, z));
    set(bumpVersions(state, { dirtyChunkVersion: state.dirtyChunkVersion + 1 }));
  },

  clearDirtyChunks: () => {
    const state = get();
    const dirty = Array.from(state.dirtyChunks);
    if (dirty.length === 0) return dirty;

    state.dirtyChunks.clear();
    set(bumpVersions(state, { dirtyChunkVersion: state.dirtyChunkVersion + 1 }));
    return dirty;
  },

  isChunkLoaded: (x, z) => {
    return get().loadedChunks.has(chunkKey(x, z));
  },

  getLoadedChunkCount: () => {
    return get().loadedChunks.size;
  },

  reset: () => {
    const state = get();
    state.chunks.clear();
    state.loadedChunks.clear();
    state.dirtyChunks.clear();
    state.blockEntities.clear();
    state.modifications.clear();
    set({
      loadedChunkVersion: 0,
      dirtyChunkVersion: 0,
      blockEntityVersion: 0,
      seed: state.seed,
    });
  },

  loadChunkModifications: (chunkKeyStr, blockChanges) => {
    const state = get();

    let chunk = state.chunks.get(chunkKeyStr);
    if (!chunk) {
      const [x, z] = chunkKeyStr.split(',').map(Number);
      chunk = createEmptyChunk(x, z);
      state.chunks.set(chunkKeyStr, chunk);
    }

    const modificationsMap = new Map<number, number>();

    for (const [indexStr, blockType] of Object.entries(blockChanges)) {
      const blockIndex = parseInt(indexStr);
      const type = blockType as number;

      const blockId = type & 0xff;
      const blockState = (type >>> 8) & 0xff;
      chunk.blocks[blockIndex] = blockId as BlockType;
      chunk.blockStates[blockIndex] = blockState;
      modificationsMap.set(blockIndex, type);

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

    state.modifications.set(chunkKeyStr, modificationsMap);
    state.dirtyChunks.add(chunkKeyStr);

    set(bumpVersions(state, { dirtyChunkVersion: state.dirtyChunkVersion + 1 }));
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
  chunk.blockStates[index] = 0;
}

export function setBlockStateInChunk(chunk: ChunkData, localX: number, y: number, localZ: number, state: number): void {
  if (y < 0 || y >= CHUNK_HEIGHT) return;
  if (localX < 0 || localX >= CHUNK_SIZE) return;
  if (localZ < 0 || localZ >= CHUNK_SIZE) return;

  const index = getBlockIndex(localX, y, localZ);
  chunk.blockStates[index] = state & 0xff;
}

export function getBlockStateFromChunk(chunk: ChunkData, localX: number, y: number, localZ: number): number {
  if (y < 0 || y >= CHUNK_HEIGHT) return 0;
  if (localX < 0 || localX >= CHUNK_SIZE) return 0;
  if (localZ < 0 || localZ >= CHUNK_SIZE) return 0;

  const index = getBlockIndex(localX, y, localZ);
  return chunk.blockStates[index] ?? 0;
}
