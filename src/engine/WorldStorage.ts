// World save/load functionality using IndexedDB

const DB_NAME = 'MinecraftCloneDB';
const DB_VERSION = 1;
const WORLDS_STORE = 'worlds';
const CHUNKS_STORE = 'chunks';

export interface SavedWorld {
  id: string;
  name: string;
  seed: number;
  createdAt: number;
  lastPlayed: number;
  playerPosition: { x: number; y: number; z: number };
  playerRotation: { yaw: number; pitch: number };
  worldTime: number;
  dayCount: number;
  gameMode: string;
}

export interface SavedChunk {
  worldId: string;
  key: string; // "chunkX,chunkZ"
  modifiedBlocks: { [blockIndex: string]: number }; // blockIndex -> blockType
}

class WorldStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Worlds store
        if (!db.objectStoreNames.contains(WORLDS_STORE)) {
          const worldsStore = db.createObjectStore(WORLDS_STORE, { keyPath: 'id' });
          worldsStore.createIndex('name', 'name', { unique: false });
          worldsStore.createIndex('lastPlayed', 'lastPlayed', { unique: false });
        }

        // Chunks store (for modified blocks)
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: ['worldId', 'key'] });
          chunksStore.createIndex('worldId', 'worldId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async saveWorld(world: SavedWorld): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([WORLDS_STORE], 'readwrite');
      const store = transaction.objectStore(WORLDS_STORE);
      const request = store.put(world);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadWorld(worldId: string): Promise<SavedWorld | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([WORLDS_STORE], 'readonly');
      const store = transaction.objectStore(WORLDS_STORE);
      const request = store.get(worldId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listWorlds(): Promise<SavedWorld[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([WORLDS_STORE], 'readonly');
      const store = transaction.objectStore(WORLDS_STORE);
      const index = store.index('lastPlayed');
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by lastPlayed descending
        const worlds = (request.result as SavedWorld[]).sort((a, b) => b.lastPlayed - a.lastPlayed);
        resolve(worlds);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteWorld(worldId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Delete world and its chunks
    const transaction = this.db.transaction([WORLDS_STORE, CHUNKS_STORE], 'readwrite');

    // Delete world
    transaction.objectStore(WORLDS_STORE).delete(worldId);

    // Delete all chunks for this world
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    const chunksIndex = chunksStore.index('worldId');
    const chunksRequest = chunksIndex.getAllKeys(worldId);

    return new Promise((resolve, reject) => {
      chunksRequest.onsuccess = () => {
        for (const key of chunksRequest.result) {
          chunksStore.delete(key);
        }
        resolve();
      };
      chunksRequest.onerror = () => reject(chunksRequest.error);
    });
  }

  async saveChunkModifications(worldId: string, chunkKey: string, modifiedBlocks: { [key: string]: number }): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const chunk: SavedChunk = { worldId, key: chunkKey, modifiedBlocks };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.put(chunk);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadChunkModifications(worldId: string, chunkKey: string): Promise<{ [key: string]: number } | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.get([worldId, chunkKey]);
      request.onsuccess = () => {
        const chunk = request.result as SavedChunk | undefined;
        resolve(chunk?.modifiedBlocks || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async loadAllChunkModifications(worldId: string): Promise<Map<string, { [key: string]: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const index = store.index('worldId');
      const request = index.getAll(worldId);

      request.onsuccess = () => {
        const chunks = request.result as SavedChunk[];
        const result = new Map<string, { [key: string]: number }>();
        for (const chunk of chunks) {
          result.set(chunk.key, chunk.modifiedBlocks);
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  generateWorldId(): string {
    return `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const worldStorage = new WorldStorage();
