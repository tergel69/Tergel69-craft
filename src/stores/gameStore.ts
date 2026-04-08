import { create } from 'zustand';
import { DAY_LENGTH } from '@/utils/constants';
import { worldStorage, SavedWorld } from '@/engine/WorldStorage';
import { useWorldStore } from '@/stores/worldStore';
import {
  PerformanceProfile,
  DEFAULT_PERFORMANCE_PROFILE,
  PerformancePreset,
  getPerformanceProfileFromPreset,
} from '@/utils/PerformanceProfile';

export type GameMode = 'survival' | 'creative' | 'spectator';
export type GameState =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'inventory'
  | 'crafting'
  | 'chest'
  | 'furnace'
  | 'enchanting'
  | 'loading'
  | 'dead';
export type CameraMode = 'firstPerson' | 'thirdPerson';
export type WorldInitMode = 'new' | 'loaded';
export type WorldGenerationMode = 'classic' | 'new_generation';

const DEFAULT_MOUSE_SENSITIVITY = 0.002;

export function normalizeMouseSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MOUSE_SENSITIVITY;

  // Old saves/UI stored this as a large multiplier-like value. Convert those
  // legacy settings into the small raw delta scale used by pointer lock now.
  const normalized = value > 0.05 ? value / 1000 : value;
  return Math.max(0.0002, Math.min(0.01, normalized));
}

export interface BreakingBlock {
  x: number;
  y: number;
  z: number;
  progress: number; // 0 to 1
  // Face normal of the hit face, used by BlockBreakOverlay to orient the crack plane.
  nx?: number;
  ny?: number;
  nz?: number;
}

interface GameStore {
  // Game state
  gameState: GameState;
  gameMode: GameMode;
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;

  // Block breaking
  breakingBlock: BreakingBlock | null;

  // Time
  worldTime: number; // 0 to DAY_LENGTH
  dayCount: number;
  isPaused: boolean;

  // Settings
  renderDistance: number;
  fov: number;
  mouseSensitivity: number;
  musicVolume: number;
  soundVolume: number;
  showDebug: boolean;
  shadersEnabled: boolean;
  cameraMode: CameraMode;
  performanceProfile: PerformanceProfile;

  // World info
  worldId: string | null;
  worldName: string;
  worldSeed: number;
  worldGenerationMode: WorldGenerationMode;
  worldInitMode: WorldInitMode;
  activeContainer: { x: number; y: number; z: number; type: 'chest' | 'furnace' | 'enchanting' } | null;
  savedWorlds: SavedWorld[];

  // Actions
  setGameState: (state: GameState) => void;
  setGameMode: (mode: GameMode) => void;
  setLoading: (loading: boolean, progress?: number, message?: string) => void;
  setBreakingBlock: (block: BreakingBlock | null) => void;
  updateTime: (delta: number) => void;
  setWorldTime: (time: number) => void;
  togglePause: () => void;
  setRenderDistance: (distance: number) => void;
  setFov: (fov: number) => void;
  setMouseSensitivity: (sensitivity: number) => void;
  setMusicVolume: (volume: number) => void;
  setSoundVolume: (volume: number) => void;
  toggleDebug: () => void;
  setWorldInfo: (name: string, seed: number) => void;
  setWorldGenerationMode: (mode: WorldGenerationMode) => void;
  setWorldInitMode: (mode: WorldInitMode) => void;
  resetGame: () => void;
  setShadersEnabled: (enabled: boolean) => void;
  toggleCameraMode: () => void;
  setWorldId: (id: string | null) => void;
  openContainer: (container: { x: number; y: number; z: number; type: 'chest' | 'furnace' | 'enchanting' } | null) => void;
  loadSavedWorlds: () => Promise<void>;
  saveCurrentWorld: (
    playerPos: { x: number; y: number; z: number },
    playerRot: { yaw: number; pitch: number }
  ) => Promise<void>;
  loadWorld: (worldId: string) => Promise<SavedWorld | null>;
  deleteWorld: (worldId: string) => Promise<void>;
  setPerformanceProfile: (profile: PerformanceProfile | PerformancePreset) => void;
}

const initialState = {
  gameState: 'menu' as GameState,
  gameMode: 'survival' as GameMode,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  breakingBlock: null as BreakingBlock | null,
  worldTime: DAY_LENGTH / 4, // Start at sunrise (6:00)
  dayCount: 1,
  isPaused: false,
  // Slightly lower default render distance for better performance; players
  // can increase this in the pause menu if their hardware can handle it.
  renderDistance: 6,
  fov: 70,
  mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  musicVolume: 0.5,
  soundVolume: 1.0,
  showDebug: false,
  shadersEnabled: true,
  cameraMode: 'firstPerson' as CameraMode,
  worldId: null as string | null,
  worldName: 'New World',
  worldSeed: Date.now(),
  worldGenerationMode: 'classic' as WorldGenerationMode,
  worldInitMode: 'new' as WorldInitMode,
  activeContainer: null as { x: number; y: number; z: number; type: 'chest' | 'furnace' | 'enchanting' } | null,
  savedWorlds: [] as SavedWorld[],
  performanceProfile: DEFAULT_PERFORMANCE_PROFILE,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setGameState: (state) => set({ gameState: state }),

  setGameMode: (mode) => set({ gameMode: mode }),

  setLoading: (loading, progress = 0, message = '') =>
    set({
      isLoading: loading,
      loadingProgress: progress,
      loadingMessage: message,
    }),

  setBreakingBlock: (block) => set({ breakingBlock: block }),

  updateTime: (delta) => {
    const { worldTime, dayCount, isPaused, gameState } = get();
    if (isPaused || gameState !== 'playing') return;

    let newTime = worldTime + delta;
    let newDayCount = dayCount;

    if (newTime >= DAY_LENGTH) {
      newTime = newTime % DAY_LENGTH;
      newDayCount += 1;
    }

    set({ worldTime: newTime, dayCount: newDayCount });
  },

  setWorldTime: (time) => set({ worldTime: time % DAY_LENGTH }),

  togglePause: () => {
    const { isPaused, gameState } = get();
    if (gameState === 'playing') {
      set({ isPaused: !isPaused, gameState: isPaused ? 'playing' : 'paused' });
    } else if (gameState === 'paused') {
      set({ isPaused: false, gameState: 'playing' });
    }
  },

  setRenderDistance: (distance) =>
    set({ renderDistance: Math.max(2, Math.min(16, distance)) }),

  setFov: (fov) => set({ fov: Math.max(30, Math.min(110, fov)) }),

  setMouseSensitivity: (sensitivity) =>
    set({ mouseSensitivity: normalizeMouseSensitivity(sensitivity) }),

  setMusicVolume: (volume) =>
    set({ musicVolume: Math.max(0, Math.min(1, volume)) }),

  setSoundVolume: (volume) =>
    set({ soundVolume: Math.max(0, Math.min(1, volume)) }),

  toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),

  setShadersEnabled: (enabled) => set({ shadersEnabled: enabled }),

  toggleCameraMode: () =>
    set((state) => ({
      cameraMode: state.cameraMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson',
    })),

  setWorldInfo: (name, seed) => set({ worldName: name, worldSeed: seed }),

  setWorldGenerationMode: (mode) => set({ worldGenerationMode: mode }),

  setWorldInitMode: (mode) => set({ worldInitMode: mode }),

  resetGame: () => set(initialState),

  setWorldId: (id) => set({ worldId: id }),

  openContainer: (container) => set({ activeContainer: container }),

  loadSavedWorlds: async () => {
    try {
      const worlds = await worldStorage.listWorlds();
      set({ savedWorlds: worlds });
    } catch (e) {
      console.error('Failed to load saved worlds:', e);
    }
  },

  saveCurrentWorld: async (playerPos, playerRot) => {
    const state = get();
    let worldId = state.worldId;

    // Create new world ID if this is a new world
    if (!worldId) {
      worldId = worldStorage.generateWorldId();
      set({ worldId });
    }

    const savedWorld: SavedWorld = {
      id: worldId,
      name: state.worldName,
      seed: state.worldSeed,
      generationMode: state.worldGenerationMode,
      createdAt: Date.now(),
      lastPlayed: Date.now(),
      playerPosition: playerPos,
      playerRotation: playerRot,
      worldTime: state.worldTime,
      dayCount: state.dayCount,
      gameMode: state.gameMode,
    };

    try {
      await worldStorage.saveWorld(savedWorld);
      // Refresh saved worlds list
      const worlds = await worldStorage.listWorlds();
      set({ savedWorlds: worlds });
    } catch (e) {
      console.error('Failed to save world:', e);
    }
  },

  loadWorld: async (worldId) => {
    try {
      const world = await worldStorage.loadWorld(worldId);
      if (world) {
        set({
          worldId: world.id,
          worldName: world.name,
          worldSeed: world.seed,
          worldGenerationMode: world.generationMode ?? 'classic',
          worldInitMode: 'loaded',
          worldTime: world.worldTime,
          dayCount: world.dayCount,
          gameMode: world.gameMode as GameMode,
        });

        // Load chunk modifications
        const chunkModifications = await worldStorage.loadAllChunkModifications(worldId);
        useWorldStore.getState().loadAllChunkModifications(chunkModifications);
      }
      return world;
    } catch (e) {
      console.error('Failed to load world:', e);
      return null;
    }
  },

  deleteWorld: async (worldId) => {
    try {
      await worldStorage.deleteWorld(worldId);
      const worlds = await worldStorage.listWorlds();
      set({ savedWorlds: worlds });
    } catch (e) {
      console.error('Failed to delete world:', e);
    }
  },

  setPerformanceProfile: (profile) => {
    const newProfile = typeof profile === 'string'
      ? getPerformanceProfileFromPreset(profile)
      : profile;
    set({ performanceProfile: newProfile });
  },
}));

// Helper functions for time
export function getTimeOfDay(worldTime: number): 'day' | 'sunset' | 'night' | 'sunrise' {
  const normalizedTime = worldTime / DAY_LENGTH;

  if (normalizedTime < 0.25) return 'sunrise';
  if (normalizedTime < 0.5) return 'day';
  if (normalizedTime < 0.75) return 'sunset';
  return 'night';
}

export function getSunAngle(worldTime: number): number {
  return (worldTime / DAY_LENGTH) * Math.PI * 2 - Math.PI / 2;
}

export function getLightLevel(worldTime: number): number {
  const timeOfDay = getTimeOfDay(worldTime);
  const normalizedTime = worldTime / DAY_LENGTH;

  switch (timeOfDay) {
    case 'day':
      return 15;
    case 'night':
      return 4;
    case 'sunrise':
      return Math.floor(4 + (normalizedTime / 0.25) * 11);
    case 'sunset':
      return Math.floor(15 - ((normalizedTime - 0.5) / 0.25) * 11);
    default:
      return 15;
  }
}
