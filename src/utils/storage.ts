import { useWorldStore, ChunkData, BlockEntityData } from '@/stores/worldStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore, InventorySlot } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { BlockType } from '@/data/blocks';
import { chunkKey, parseChunkKey } from './coordinates';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants';

const STORAGE_PREFIX = 'minecraft_';
const WORLDS_KEY = `${STORAGE_PREFIX}worlds`;
const CURRENT_VERSION = 1;

export interface WorldSaveData {
  version: number;
  name: string;
  seed: number;
  generationMode?: 'classic' | 'new_generation';
  createdAt: number;
  lastPlayed: number;
  gameMode: 'survival' | 'creative' | 'spectator';
  worldTime: number;
  dayCount: number;
}

export interface PlayerSaveData {
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  health: number;
  hunger: number;
  saturation: number;
  experience: number;
  experienceLevel: number;
  selectedSlot: number;
}

export interface InventorySaveData {
  hotbar: InventorySlot[];
  inventory: InventorySlot[];
  armor: {
    helmet: InventorySlot;
    chestplate: InventorySlot;
    leggings: InventorySlot;
    boots: InventorySlot;
  };
}

export interface ChunkSaveData {
  x: number;
  z: number;
  modifications: Record<number, number>; // Packed block + state data
}

export interface FullSaveData {
  world: WorldSaveData;
  player: PlayerSaveData;
  inventory: InventorySaveData;
  chunks: ChunkSaveData[];
  blockEntities?: Array<{ key: string; data: BlockEntityData }>;
}

// Get list of saved worlds
export function getSavedWorlds(): WorldSaveData[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(WORLDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load worlds list:', e);
    return [];
  }
}

// Save world info to list
function updateWorldsList(worldData: WorldSaveData): void {
  const worlds = getSavedWorlds();
  const existingIndex = worlds.findIndex((w) => w.name === worldData.name && w.seed === worldData.seed);

  if (existingIndex >= 0) {
    worlds[existingIndex] = worldData;
  } else {
    worlds.push(worldData);
  }

  localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
}

// Remove world from list
function removeFromWorldsList(worldName: string, seed: number): void {
  const worlds = getSavedWorlds();
  const filtered = worlds.filter((w) => !(w.name === worldName && w.seed === seed));
  localStorage.setItem(WORLDS_KEY, JSON.stringify(filtered));
}

// Get save key for a specific world
function getWorldKey(worldName: string, seed: number): string {
  return `${STORAGE_PREFIX}world_${worldName}_${seed}`;
}

// Save the current game state
export function saveGame(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const gameStore = useGameStore.getState();
    const playerStore = usePlayerStore.getState();
    const inventoryStore = useInventoryStore.getState();
    const worldStore = useWorldStore.getState();

    const worldData: WorldSaveData = {
      version: CURRENT_VERSION,
      name: gameStore.worldName,
      seed: gameStore.worldSeed,
      generationMode: gameStore.worldGenerationMode,
      createdAt: Date.now(), // Should be stored initially
      lastPlayed: Date.now(),
      gameMode: gameStore.gameMode,
      worldTime: gameStore.worldTime,
      dayCount: gameStore.dayCount,
    };

    const playerData: PlayerSaveData = {
      position: { ...playerStore.position },
      rotation: { ...playerStore.rotation },
      health: playerStore.health,
      hunger: playerStore.hunger,
      saturation: playerStore.saturation,
      experience: playerStore.experience,
      experienceLevel: playerStore.experienceLevel,
      selectedSlot: playerStore.selectedSlot,
    };

    const inventoryData: InventorySaveData = {
      hotbar: inventoryStore.hotbar.map((slot) => ({ ...slot })),
      inventory: inventoryStore.inventory.map((slot) => ({ ...slot })),
      armor: {
        helmet: { ...inventoryStore.armor.helmet },
        chestplate: { ...inventoryStore.armor.chestplate },
        leggings: { ...inventoryStore.armor.leggings },
        boots: { ...inventoryStore.armor.boots },
      },
    };

    // Save chunk modifications
    const chunksData: ChunkSaveData[] = [];
    for (const [key, modifications] of Array.from(worldStore.modifications)) {
      if (modifications.size > 0) {
        const { x, z } = parseChunkKey(key);
        chunksData.push({
          x,
          z,
          modifications: Object.fromEntries(modifications),
        });
      }
    }

    const fullSave: FullSaveData = {
      world: worldData,
      player: playerData,
      inventory: inventoryData,
      chunks: chunksData,
      blockEntities: Array.from(worldStore.blockEntities.entries()).map(([key, data]) => ({ key, data })),
    };

    // Save to localStorage
    const worldKey = getWorldKey(worldData.name, worldData.seed);
    localStorage.setItem(worldKey, JSON.stringify(fullSave));

    // Update worlds list
    updateWorldsList(worldData);

    console.log('Game saved successfully!');
    return true;
  } catch (e) {
    console.error('Failed to save game:', e);
    return false;
  }
}

// Load a saved game
export function loadGame(worldName: string, seed: number): FullSaveData | null {
  if (typeof window === 'undefined') return null;

  try {
    const worldKey = getWorldKey(worldName, seed);
    const data = localStorage.getItem(worldKey);

    if (!data) {
      console.error('No save data found for world:', worldName);
      return null;
    }

    const saveData: FullSaveData = JSON.parse(data);

    // Version migration if needed
    if (saveData.world.version < CURRENT_VERSION) {
      migrateSaveData(saveData);
    }

    return saveData;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

// Apply loaded save data to stores
export function applySaveData(saveData: FullSaveData): void {
  const gameStore = useGameStore.getState();
  const playerStore = usePlayerStore.getState();
  const inventoryStore = useInventoryStore.getState();
  const worldStore = useWorldStore.getState();

  // Apply game state
  gameStore.setWorldInfo(saveData.world.name, saveData.world.seed);
  gameStore.setGameMode(saveData.world.gameMode);
  gameStore.setWorldGenerationMode(saveData.world.generationMode ?? 'classic');
  gameStore.setWorldInitMode('loaded');
  gameStore.setWorldTime(saveData.world.worldTime);

  // Apply player state
  playerStore.setPosition(saveData.player.position);
  playerStore.setRotation(saveData.player.rotation);
  playerStore.setHealth(saveData.player.health);
  playerStore.setHunger(saveData.player.hunger);
  playerStore.setSelectedSlot(saveData.player.selectedSlot);

  // Apply inventory
  saveData.inventory.hotbar.forEach((slot, i) => {
    inventoryStore.setHotbarSlot(i, slot);
  });

  // Apply chunk modifications
  worldStore.setSeed(saveData.world.seed);
  for (const chunkSave of saveData.chunks) {
    const key = chunkKey(chunkSave.x, chunkSave.z);
    const modifications = new Map(Object.entries(chunkSave.modifications).map(
      ([k, v]) => [parseInt(k), v]
    ));
    worldStore.modifications.set(key, modifications);
  }

  if (saveData.blockEntities) {
    for (const { key, data } of saveData.blockEntities) {
      const [x, y, z] = key.split(',').map(Number);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        worldStore.setBlockEntity(x, y, z, data);
      }
    }
  }
}

// Delete a saved world
export function deleteWorld(worldName: string, seed: number): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const worldKey = getWorldKey(worldName, seed);
    localStorage.removeItem(worldKey);
    removeFromWorldsList(worldName, seed);
    console.log('World deleted:', worldName);
    return true;
  } catch (e) {
    console.error('Failed to delete world:', e);
    return false;
  }
}

// Migrate old save data to new format
function migrateSaveData(saveData: FullSaveData): void {
  // Add migration logic here as versions change
  saveData.world.version = CURRENT_VERSION;
}

// Auto-save functionality
let autoSaveInterval: NodeJS.Timeout | null = null;

export function startAutoSave(intervalMs: number = 60000): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  autoSaveInterval = setInterval(() => {
    const gameState = useGameStore.getState().gameState;
    if (gameState === 'playing') {
      saveGame();
    }
  }, intervalMs);
}

export function stopAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// Export world as downloadable file
export function exportWorld(worldName: string, seed: number): void {
  const saveData = loadGame(worldName, seed);
  if (!saveData) return;

  const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${worldName}_${seed}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// Import world from file
export function importWorld(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const saveData: FullSaveData = JSON.parse(e.target?.result as string);

        // Validate save data
        if (!saveData.world || !saveData.player || !saveData.inventory) {
          console.error('Invalid save file format');
          resolve(false);
          return;
        }

        // Save to localStorage
        const worldKey = getWorldKey(saveData.world.name, saveData.world.seed);
        localStorage.setItem(worldKey, JSON.stringify(saveData));
        updateWorldsList(saveData.world);

        console.log('World imported successfully!');
        resolve(true);
      } catch (e) {
        console.error('Failed to import world:', e);
        resolve(false);
      }
    };

    reader.onerror = () => {
      console.error('Failed to read file');
      resolve(false);
    };

    reader.readAsText(file);
  });
}

// Get storage usage info
export function getStorageInfo(): { used: number; available: number } {
  if (typeof window === 'undefined') return { used: 0, available: 0 };

  let used = 0;
  for (const key in localStorage) {
    if (key.startsWith(STORAGE_PREFIX)) {
      used += localStorage.getItem(key)?.length || 0;
    }
  }

  // localStorage typically has ~5MB limit
  const available = 5 * 1024 * 1024 - used;

  return { used, available };
}
