import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { worldDatabase, WorldSaveData, PlayerData, InventoryData, ChunkData, EntityData } from './WorldDatabase';
import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { resolveSpawnLocation } from '@/utils/spawn';

export class WorldManager {
  private saveInterval: NodeJS.Timeout | null = null;
  private lastSaveTime = 0;
  private saveCooldown = 0;

  // Initialize auto-save system
  startAutoSave(intervalMs: number = 30000): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    this.saveInterval = setInterval(() => {
      this.autoSave();
    }, intervalMs);
  }

  stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  // Auto-save logic with cooldown
  private autoSave(): void {
    const now = Date.now();
    if (now - this.lastSaveTime < 5000) {
      return; // Don't save more than once every 5 seconds
    }

    try {
      this.saveCurrentWorld();
      this.lastSaveTime = now;
      console.log('Auto-save completed');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  // Save current world
  async saveCurrentWorld(): Promise<void> {
    const currentWorldId = worldDatabase.getCurrentWorldId();
    if (!currentWorldId) {
      throw new Error('No active world to save');
    }

    const saveData = this.createSaveData();
    worldDatabase.saveWorld(currentWorldId, saveData);

    // Update play time (using world time as play time approximation)
    const playTime = useGameStore.getState().worldTime;
    worldDatabase.updatePlayTime(currentWorldId, Math.floor(playTime / 1000)); // Convert to seconds
  }

  // Load world
  async loadWorld(worldId: string): Promise<void> {
    const saveData = worldDatabase.loadWorld(worldId);
    if (!saveData) {
      throw new Error('Failed to load world data');
    }

    // Set current world
    worldDatabase.setCurrentWorldId(worldId);

    // Restore game state
    this.restoreSaveData(saveData);

    // Start auto-save for loaded world
    this.startAutoSave();
  }

  // Create new world
  async createNewWorld(name: string, seed: number, gameMode: 'survival' | 'creative', generationMode: 'classic' | 'new_generation' = 'classic'): Promise<string> {
    const worldId = worldDatabase.createWorld(name, seed, gameMode, generationMode);
    
    // Set as current world
    worldDatabase.setCurrentWorldId(worldId);

    // Initialize game state for new world
    this.initializeNewWorld(seed, gameMode, generationMode);

    // Start auto-save
    this.startAutoSave();

    return worldId;
  }

  // Delete world
  async deleteWorld(worldId: string): Promise<void> {
    const currentWorldId = worldDatabase.getCurrentWorldId();
    
    worldDatabase.deleteWorld(worldId);

    // If we deleted the current world, clear it
    if (currentWorldId === worldId) {
      worldDatabase.setCurrentWorldId(undefined);
      this.stopAutoSave();
    }
  }

  // Export world
  exportWorld(worldId: string): string {
    return worldDatabase.exportWorld(worldId);
  }

  // Import world
  importWorld(name: string, dataString: string): string {
    return worldDatabase.importWorld(name, dataString);
  }

  // Create save data from current game state
  private createSaveData(): Partial<WorldSaveData> {
    const playerStore = usePlayerStore.getState();
    const worldStore = useWorldStore.getState();
    const inventoryStore = useInventoryStore.getState();
    const gameStore = useGameStore.getState();

    return {
      player: this.createPlayerData(playerStore),
      inventory: this.createInventoryData(inventoryStore),
      chunks: this.createChunkData(worldStore),
      entities: this.createEntityData(),
      blockEntities: Array.from(worldStore.blockEntities.entries()).map(([key, data]) => ({ key, data })),
      gameTime: gameStore.worldTime,
      weather: {
        type: 'clear', // Simplified weather system
        duration: 0,
        timeUntilChange: 6000,
      },
    };
  }

  // Restore game state from save data
  private restoreSaveData(saveData: WorldSaveData): void {
    // Restore player state
    if (saveData.player) {
      usePlayerStore.setState({
        position: saveData.player.position,
        rotation: saveData.player.rotation,
        velocity: saveData.player.velocity,
        health: saveData.player.health,
        maxHealth: saveData.player.maxHealth,
        hunger: saveData.player.hunger,
        maxHunger: saveData.player.maxHunger,
        saturation: saveData.player.saturation,
        armor: saveData.player.armor,
        oxygen: saveData.player.oxygen,
        experience: saveData.player.experience,
        experienceLevel: saveData.player.experienceLevel,
        selectedSlot: saveData.player.selectedSlot,
        isFlying: saveData.player.isFlying,
        isOnGround: saveData.player.isOnGround,
        isInWater: saveData.player.isInWater,
        isInLava: saveData.player.isInLava,
      });
    }

    // Restore inventory
    if (saveData.inventory) {
      this.restoreInventoryData(saveData.inventory);
    }

    // Restore world state
    if (saveData.chunks) {
      this.restoreChunkData(saveData.chunks);
    }

    // Restore game state
    if (saveData.gameTime !== undefined) {
      useGameStore.getState().setWorldTime(saveData.gameTime);
    }

    if (saveData.metadata?.generationMode) {
      useGameStore.getState().setWorldGenerationMode(saveData.metadata.generationMode);
    }

    useGameStore.getState().setWorldInitMode('loaded');

    // Restore entities
    if (saveData.entities) {
      this.restoreEntityData(saveData.entities);
    }

    if (saveData.blockEntities) {
      for (const { key, data } of saveData.blockEntities) {
        const [x, y, z] = key.split(',').map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        useWorldStore.getState().setBlockEntity(x, y, z, data);
      }
    }
  }

  // Initialize new world
  private initializeNewWorld(seed: number, gameMode: 'survival' | 'creative', generationMode: 'classic' | 'new_generation'): void {
    const playerStore = usePlayerStore.getState();
    const inventoryStore = useInventoryStore.getState();
    const gameStore = useGameStore.getState();

    // Reset player state
    playerStore.reset();

    // Set game mode
    gameStore.setGameMode(gameMode);
    gameStore.setWorldGenerationMode(generationMode);

    // Initialize starting inventory based on game mode
    if (gameMode === 'creative') {
      this.initializeCreativeInventory(inventoryStore);
    } else {
      this.initializeSurvivalInventory(inventoryStore);
    }

    // Set world seed
    useWorldStore.getState().setSeed(seed);
    gameStore.setWorldInitMode('new');
  }

  private findSpawnPosition(seed: number): { x: number; y: number; z: number } {
    // Simple spawn position calculation
    // In a real implementation, this would use the terrain generator
    return { x: 0, y: 80, z: 0 };
  }

  private spawnPlayerSafely(spawnX: number = 0, spawnZ: number = 0) {
    const resolved = resolveSpawnLocation({
      originX: spawnX,
      originZ: spawnZ,
      searchRadius: 64,
      requireLoadedChunks: true,
      allowFallback: true,
      fallbackY: 180,
    });

    const fallback = resolved?.position ?? { x: spawnX + 0.5, y: 180, z: spawnZ + 0.5 };
    usePlayerStore.getState().setPosition(fallback);
    console.warn('Used fallback spawn position - no safe ground found near origin');
    return fallback;
  }

  // Data conversion methods

  private createPlayerData(playerStore: any): PlayerData {
    return {
      position: playerStore.position,
      rotation: playerStore.rotation,
      velocity: playerStore.velocity,
      health: playerStore.health,
      maxHealth: playerStore.maxHealth,
      hunger: playerStore.hunger,
      maxHunger: playerStore.maxHunger,
      saturation: playerStore.saturation,
      armor: playerStore.armor,
      oxygen: playerStore.oxygen,
      experience: playerStore.experience,
      experienceLevel: playerStore.experienceLevel,
      selectedSlot: playerStore.selectedSlot,
      isFlying: playerStore.isFlying,
      isOnGround: playerStore.isOnGround,
      isInWater: playerStore.isInWater,
      isInLava: playerStore.isInLava,
    };
  }

  private createInventoryData(inventoryStore: any): InventoryData {
    return {
      hotbar: inventoryStore.hotbar.map((slot: any) => ({
        item: slot.item,
        count: slot.count,
        durability: slot.durability,
      })),
      inventory: inventoryStore.inventory.map((slot: any) => ({
        item: slot.item,
        count: slot.count,
        durability: slot.durability,
      })),
      armor: {
        helmet: inventoryStore.armor.helmet,
        chestplate: inventoryStore.armor.chestplate,
        leggings: inventoryStore.armor.leggings,
        boots: inventoryStore.armor.boots,
      },
      offhand: { item: null, count: 0 }, // Simplified offhand
    };
  }

  private createChunkData(worldStore: any): ChunkData[] {
    const chunks: ChunkData[] = [];
    
    // Get all loaded chunks
    worldStore.chunks.forEach((chunk: any, key: any) => {
      if (chunk.loaded) {
        const chunkData: ChunkData = {
          x: chunk.x,
          y: chunk.y,
          z: chunk.z,
          blocks: this.flattenChunkBlocks(chunk),
          blockStates: this.flattenChunkBlockStates(chunk),
          light: this.flattenChunkLight(chunk),
          loaded: true,
          lastModified: Date.now(),
        };
        chunks.push(chunkData);
      }
    });

    return chunks;
  }

  private createEntityData(): EntityData[] {
    // This would need to be implemented based on your entity system
    // For now, return empty array
    return [];
  }

  private restoreInventoryData(inventoryData: InventoryData): void {
    const inventoryStore = useInventoryStore.getState();
    
    // Restore hotbar
    inventoryData.hotbar.forEach((slot, index) => {
      inventoryStore.setHotbarSlot(index, slot);
    });

    // Restore inventory
    inventoryData.inventory.forEach((slot, index) => {
      // Use addItem for inventory slots to handle stacking properly
      if (slot.item !== null) {
        inventoryStore.addItem(slot.item, slot.count);
      }
    });

    // Restore armor
    inventoryStore.setArmorSlot('helmet', inventoryData.armor.helmet);
    inventoryStore.setArmorSlot('chestplate', inventoryData.armor.chestplate);
    inventoryStore.setArmorSlot('leggings', inventoryData.armor.leggings);
    inventoryStore.setArmorSlot('boots', inventoryData.armor.boots);
  }

  private restoreChunkData(chunks: ChunkData[]): void {
    const worldStore = useWorldStore.getState();
    
    chunks.forEach(chunkData => {
      // This would need to be implemented based on your chunk system
      // For now, just log the chunk data
      console.log('Restoring chunk:', chunkData);
    });
  }

  private restoreEntityData(entities: EntityData[]): void {
    // This would need to be implemented based on your entity system
    console.log('Restoring entities:', entities);
  }

  private flattenChunkBlocks(chunk: any): number[] {
    // Convert 3D chunk data to 1D array
    const blocks: number[] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          blocks.push(chunk.getBlock(x, y, z) || 0);
        }
      }
    }
    return blocks;
  }

  private flattenChunkLight(chunk: any): number[] {
    // Convert 3D light data to 1D array
    const light: number[] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          light.push(chunk.getLight(x, y, z) || 0);
        }
      }
    }
    return light;
  }

  private flattenChunkBlockStates(chunk: any): number[] {
    const states: number[] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          states.push(chunk.blockStates?.[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] || 0);
        }
      }
    }
    return states;
  }

  private initializeCreativeInventory(inventoryStore: any): void {
    // Give creative mode starting items
    inventoryStore.addItem(BlockType.DIRT, 64);
    inventoryStore.addItem(BlockType.COBBLESTONE, 64);
    inventoryStore.addItem(ItemType.WOODEN_PICKAXE, 1);
    inventoryStore.addItem(ItemType.WOODEN_AXE, 1);
    inventoryStore.addItem(ItemType.WOODEN_SWORD, 1);
  }

  private initializeSurvivalInventory(inventoryStore: any): void {
    // Give survival mode starting items
    inventoryStore.addItem(ItemType.WOODEN_PICKAXE, 1);
    inventoryStore.addItem(ItemType.WOODEN_AXE, 1);
    inventoryStore.addItem(ItemType.WOODEN_SWORD, 1);
  }

  // Utility methods

  getCurrentWorldId(): string | undefined {
    return worldDatabase.getCurrentWorldId();
  }

  getWorlds(): any[] {
    return worldDatabase.getWorlds();
  }

  isWorldLoaded(): boolean {
    return this.getCurrentWorldId() !== undefined;
  }

  // Manual save with cooldown
  async manualSave(): Promise<void> {
    const now = Date.now();
    if (now - this.saveCooldown < 2000) {
      throw new Error('Save on cooldown. Please wait before saving again.');
    }

    await this.saveCurrentWorld();
    this.saveCooldown = now;
  }
}

export const worldManager = new WorldManager();
