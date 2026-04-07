import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore, BlockEntityData } from '@/stores/worldStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';

export interface WorldMetadata {
  id: string;
  name: string;
  seed: number;
  gameMode: 'survival' | 'creative';
  generationMode?: 'classic' | 'new_generation';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  creationDate: number;
  lastPlayed: number;
  playTime: number;
  thumbnail?: string; // Base64 encoded screenshot
  version: string;
}

export interface PlayerData {
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  saturation: number;
  armor: number;
  oxygen: number;
  experience: number;
  experienceLevel: number;
  selectedSlot: number;
  isFlying: boolean;
  isOnGround: boolean;
  isInWater: boolean;
  isInLava: boolean;
}

export interface InventorySlot {
  item: BlockType | ItemType | null;
  count: number;
  durability?: number;
}

export interface InventoryData {
  hotbar: InventorySlot[];
  inventory: InventorySlot[];
  armor: {
    helmet: InventorySlot;
    chestplate: InventorySlot;
    leggings: InventorySlot;
    boots: InventorySlot;
  };
  offhand: InventorySlot;
}

export interface ChunkData {
  x: number;
  y: number;
  z: number;
  blocks: number[]; // Flattened 16x256x16 array
  blockStates?: number[]; // Optional per-block state data
  light: number[]; // Light values
  loaded: boolean;
  lastModified: number;
}

export interface EntityData {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  state: any; // Entity-specific state
}

export interface WorldSaveData {
  metadata: WorldMetadata;
  player: PlayerData;
  inventory: InventoryData;
  chunks: ChunkData[];
  entities: EntityData[];
  blockEntities?: Array<{ key: string; data: BlockEntityData }>;
  gameTime: number;
  weather: {
    type: 'clear' | 'rain' | 'thunder';
    duration: number;
    timeUntilChange: number;
  };
}

export interface WorldList {
  worlds: WorldMetadata[];
  currentWorldId?: string;
  version: string;
}

class WorldDatabase {
  private readonly STORAGE_KEY = 'minecraft_worlds';
  private readonly MAX_WORLDS = 10;
  private readonly VERSION = '1.0.0';

  private getWorldList(): WorldList {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      return { worlds: [], version: this.VERSION };
    }

    try {
      const parsed = JSON.parse(data) as WorldList;
      // Validate version compatibility
      if (parsed.version !== this.VERSION) {
        console.warn('World database version mismatch, may need migration');
      }
      return parsed;
    } catch (error) {
      console.error('Failed to parse world list:', error);
      return { worlds: [], version: this.VERSION };
    }
  }

  private saveWorldList(worldList: WorldList): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(worldList));
    } catch (error) {
      console.error('Failed to save world list:', error);
      throw new Error('Failed to save world list to database');
    }
  }

  private getWorldData(worldId: string): WorldSaveData | null {
    const key = `world_${worldId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as WorldSaveData;
    } catch (error) {
      console.error(`Failed to parse world data for ${worldId}:`, error);
      return null;
    }
  }

  private saveWorldData(worldId: string, data: WorldSaveData): void {
    const key = `world_${worldId}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save world data for ${worldId}:`, error);
      throw new Error('Failed to save world data');
    }
  }

  // Public API

  getWorlds(): WorldMetadata[] {
    return this.getWorldList().worlds;
  }

  getCurrentWorldId(): string | undefined {
    return this.getWorldList().currentWorldId;
  }

  setCurrentWorldId(worldId: string | undefined): void {
    const worldList = this.getWorldList();
    worldList.currentWorldId = worldId;
    this.saveWorldList(worldList);
  }

  createWorld(name: string, seed: number, gameMode: 'survival' | 'creative', generationMode: 'classic' | 'new_generation' = 'classic'): string {
    const worldList = this.getWorldList();
    
    // Check if world name already exists
    if (worldList.worlds.some(world => world.name === name)) {
      throw new Error('A world with this name already exists');
    }

    // Check world limit
    if (worldList.worlds.length >= this.MAX_WORLDS) {
      throw new Error('Maximum number of worlds reached (10)');
    }

    const id = this.generateWorldId();
    const now = Date.now();
    
    const metadata: WorldMetadata = {
      id,
      name,
      seed,
      gameMode,
      generationMode,
      difficulty: 'normal',
      creationDate: now,
      lastPlayed: now,
      playTime: 0,
      version: this.VERSION,
    };

    worldList.worlds.push(metadata);
    this.saveWorldList(worldList);

    // Create empty world data
    const emptyData: WorldSaveData = {
      metadata,
      player: this.createEmptyPlayerData(),
      inventory: this.createEmptyInventoryData(),
      chunks: [],
      entities: [],
      blockEntities: [],
      gameTime: 0,
      weather: {
        type: 'clear',
        duration: 0,
        timeUntilChange: 6000,
      },
    };

    this.saveWorldData(id, emptyData);

    return id;
  }

  loadWorld(worldId: string): WorldSaveData | null {
    const worldList = this.getWorldList();
    const world = worldList.worlds.find(w => w.id === worldId);
    
    if (!world) {
      throw new Error('World not found');
    }

    const data = this.getWorldData(worldId);
    if (!data) {
      throw new Error('World data corrupted or missing');
    }

    // Update last played time
    world.lastPlayed = Date.now();
    this.saveWorldList(worldList);

    return data;
  }

  saveWorld(worldId: string, data: Partial<WorldSaveData>): void {
    const existingData = this.getWorldData(worldId);
    if (!existingData) {
      throw new Error('World not found');
    }

    const updatedData: WorldSaveData = {
      ...existingData,
      ...data,
      metadata: {
        ...existingData.metadata,
        ...data.metadata,
        lastPlayed: Date.now(),
      },
    };

    this.saveWorldData(worldId, updatedData);
  }

  deleteWorld(worldId: string): void {
    const worldList = this.getWorldList();
    const index = worldList.worlds.findIndex(w => w.id === worldId);
    
    if (index === -1) {
      throw new Error('World not found');
    }

    // Remove from list
    worldList.worlds.splice(index, 1);
    
    // Clear current world if it's being deleted
    if (worldList.currentWorldId === worldId) {
      worldList.currentWorldId = worldList.worlds.length > 0 ? worldList.worlds[0].id : undefined;
    }

    this.saveWorldList(worldList);

    // Remove world data
    const key = `world_${worldId}`;
    localStorage.removeItem(key);
  }

  updateWorldThumbnail(worldId: string, thumbnail: string): void {
    const worldList = this.getWorldList();
    const world = worldList.worlds.find(w => w.id === worldId);
    
    if (world) {
      world.thumbnail = thumbnail;
      this.saveWorldList(worldList);
    }
  }

  updatePlayTime(worldId: string, playTime: number): void {
    const worldList = this.getWorldList();
    const world = worldList.worlds.find(w => w.id === worldId);
    
    if (world) {
      world.playTime = playTime;
      this.saveWorldList(worldList);
    }
  }

  // Data conversion utilities

  private createEmptyPlayerData(): PlayerData {
    return {
      position: { x: 0, y: 80, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      health: 20,
      maxHealth: 20,
      hunger: 20,
      maxHunger: 20,
      saturation: 5,
      armor: 0,
      oxygen: 300,
      experience: 0,
      experienceLevel: 0,
      selectedSlot: 0,
      isFlying: false,
      isOnGround: false,
      isInWater: false,
      isInLava: false,
    };
  }

  private createEmptyInventoryData(): InventoryData {
    const emptySlot: InventorySlot = { item: null, count: 0 };
    
    return {
      hotbar: Array(9).fill(emptySlot),
      inventory: Array(27).fill(emptySlot),
      armor: {
        helmet: emptySlot,
        chestplate: emptySlot,
        leggings: emptySlot,
        boots: emptySlot,
      },
      offhand: emptySlot,
    };
  }

  private generateWorldId(): string {
    return 'world_' + Math.random().toString(36).substr(2, 9);
  }

  // Bulk operations

  exportWorld(worldId: string): string {
    const data = this.getWorldData(worldId);
    if (!data) {
      throw new Error('World not found');
    }
    return JSON.stringify(data, null, 2);
  }

  importWorld(name: string, dataString: string): string {
    const worldList = this.getWorldList();
    
    if (worldList.worlds.length >= this.MAX_WORLDS) {
      throw new Error('Maximum number of worlds reached (10)');
    }

    try {
      const data = JSON.parse(dataString) as WorldSaveData;
      
      // Validate data structure
      if (!data.metadata || !data.player || !data.inventory) {
        throw new Error('Invalid world data format');
      }

      // Generate new ID and update metadata
      const newId = this.generateWorldId();
      data.metadata.id = newId;
      data.metadata.name = name;
      data.metadata.creationDate = Date.now();
      data.metadata.lastPlayed = Date.now();
      data.metadata.playTime = 0;

      // Save to database
      worldList.worlds.push(data.metadata);
      this.saveWorldList(worldList);
      this.saveWorldData(newId, data);

      return newId;
    } catch (error) {
      throw new Error('Failed to import world: ' + error);
    }
  }

  // Cleanup and maintenance

  cleanupOrphanedData(): void {
    const worldList = this.getWorldList();
    const existingIds = new Set(worldList.worlds.map(w => w.id));
    
    // Remove orphaned world data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('world_') && key !== this.STORAGE_KEY) {
        const worldId = key.substring(6);
        if (!existingIds.has(worldId)) {
          localStorage.removeItem(key);
        }
      }
    });
  }

  clearAllData(): void {
    const worldList = this.getWorldList();
    
    // Remove all world data
    worldList.worlds.forEach(world => {
      localStorage.removeItem(`world_${world.id}`);
    });
    
    // Clear world list
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const worldDatabase = new WorldDatabase();
