import { create } from 'zustand';
import {
  MAX_HEALTH,
  MAX_HUNGER,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_SNEAK_MULTIPLIER,
  PLAYER_SWIM_SPEED,
  PLAYER_SWIM_VERTICAL_SPEED,
} from '@/utils/constants';

import { useWorldStore } from '@/stores/worldStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { BlockType } from '@/data/blocks';

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

export interface PlayerRotation {
  yaw: number; // Horizontal rotation
  pitch: number; // Vertical rotation
}

export interface PlayerVelocity {
  x: number;
  y: number;
  z: number;
}

interface PlayerStore {
  // Position and movement
  position: PlayerPosition;
  rotation: PlayerRotation;
  velocity: PlayerVelocity;

  // Movement state
  isOnGround: boolean;
  isInWater: boolean;
  isInLava: boolean;
  isSprinting: boolean;
  isSneaking: boolean;
  isFlying: boolean; // Creative mode only
  isSwimming: boolean; // Swimming state

  // Stats
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  saturation: number;
  armor: number;
  oxygen: number; // For underwater
  experience: number;
  experienceLevel: number;

  // Combat
  attackCooldown: number;
  invulnerabilityTime: number;

  // Selected hotbar slot
  selectedSlot: number;

  // Actions
  setPosition: (pos: Partial<PlayerPosition>) => void;
  setRotation: (rot: Partial<PlayerRotation>) => void;
  setVelocity: (vel: Partial<PlayerVelocity>) => void;
  setOnGround: (onGround: boolean) => void;
  setInWater: (inWater: boolean) => void;
  setInLava: (inLava: boolean) => void;
  setSprinting: (sprinting: boolean) => void;
  setSneaking: (sneaking: boolean) => void;
  setFlying: (flying: boolean) => void;
  setSwimming: (swimming: boolean) => void;
  setHealth: (health: number) => void;
  damage: (amount: number) => void;
  heal: (amount: number) => void;
  setHunger: (hunger: number) => void;
  consumeHunger: (amount: number) => void;
  feed: (food: number, saturation: number) => void;
  setSelectedSlot: (slot: number) => void;
  updateCooldowns: (delta: number) => void;
  addExperience: (amount: number) => void;
  respawn: () => void;
  getMovementSpeed: () => number;
  getVerticalSpeed: () => number;
  reset: () => void;
  setOxygen: (oxygen: number) => void;
}

const initialPosition = { x: 0, y: 100, z: 0 };
const initialRotation = { yaw: 0, pitch: 0 };
const initialVelocity = { x: 0, y: 0, z: 0 };

const initialState = {
  position: initialPosition,
  rotation: initialRotation,
  velocity: initialVelocity,
  isOnGround: false,
  isInWater: false,
  isInLava: false,
  isSprinting: false,
  isSneaking: false,
  isFlying: false,
  isSwimming: false,
  health: MAX_HEALTH,
  maxHealth: MAX_HEALTH,
  hunger: MAX_HUNGER,
  maxHunger: MAX_HUNGER,
  saturation: 5,
  armor: 0,
  oxygen: 300, // 15 seconds worth
  experience: 0,
  experienceLevel: 0,
  attackCooldown: 0,
  invulnerabilityTime: 0,
  selectedSlot: 0,
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialState,

  setPosition: (pos) =>
    set((state) => ({
      position: { ...state.position, ...pos },
    })),

  setRotation: (rot) =>
    set((state) => ({
      rotation: { ...state.rotation, ...rot },
    })),

  setVelocity: (vel) =>
    set((state) => ({
      velocity: { ...state.velocity, ...vel },
    })),

  setOnGround: (onGround) => set({ isOnGround: onGround }),

  setInWater: (inWater) => set({ isInWater: inWater }),

  setInLava: (inLava) => set({ isInLava: inLava }),

  setSprinting: (sprinting) => {
    const { hunger, isSwimming } = get();
    // Can only sprint if hunger > 6 and not swimming
    if (sprinting && (hunger <= 6 || isSwimming)) return;
    set({ isSprinting: sprinting, isSneaking: sprinting ? false : get().isSneaking });
  },

  setSneaking: (sneaking) => set({ 
    isSneaking: sneaking, 
    isSprinting: sneaking ? false : get().isSprinting 
  }),

  setFlying: (flying) => set({ isFlying: flying }),

  setSwimming: (swimming) => set({ 
    isSwimming: swimming,
    isSprinting: swimming ? false : get().isSprinting // Stop sprinting when swimming
  }),

  setHealth: (health) =>
    set({ health: Math.max(0, Math.min(get().maxHealth, health)) }),

  damage: (amount) => {
    const { invulnerabilityTime, health, armor } = get();
    if (invulnerabilityTime > 0) return;

    // Apply armor reduction (simple version)
    const reduction = Math.min(armor * 0.04, 0.8);
    const actualDamage = amount * (1 - reduction);

    const newHealth = Math.max(0, health - actualDamage);
    set({
      health: newHealth,
      invulnerabilityTime: 0.5, // 0.5 seconds of invulnerability
    });
  },

  heal: (amount) => {
    const { health, maxHealth } = get();
    set({ health: Math.min(maxHealth, health + amount) });
  },

  setHunger: (hunger) =>
    set({ hunger: Math.max(0, Math.min(get().maxHunger, hunger)) }),

  consumeHunger: (amount) => {
    const { hunger, saturation } = get();
    // First consume saturation, then hunger
    if (saturation >= amount) {
      set({ saturation: saturation - amount });
    } else {
      const remaining = amount - saturation;
      set({
        saturation: 0,
        hunger: Math.max(0, hunger - remaining),
      });
    }
  },

  feed: (food, sat) => {
    const { hunger, maxHunger, saturation } = get();
    const newHunger = Math.min(maxHunger, hunger + food);
    const newSaturation = Math.min(newHunger, saturation + sat);
    set({ hunger: newHunger, saturation: newSaturation });
  },

  setSelectedSlot: (slot) =>
    set({ selectedSlot: Math.max(0, Math.min(8, slot)) }),

  updateCooldowns: (delta) => {
    const { attackCooldown, invulnerabilityTime } = get();
    set({
      attackCooldown: Math.max(0, attackCooldown - delta),
      invulnerabilityTime: Math.max(0, invulnerabilityTime - delta),
    });
  },

  addExperience: (amount) => {
    let { experience, experienceLevel } = get();
    experience += amount;

    // Level up calculation (simplified)
    const xpForLevel = (level: number) => {
      if (level < 16) return 2 * level + 7;
      if (level < 31) return 5 * level - 38;
      return 9 * level - 158;
    };

    while (experience >= xpForLevel(experienceLevel)) {
      experience -= xpForLevel(experienceLevel);
      experienceLevel++;
    }

    set({ experience, experienceLevel });
  },

  setOxygen: (oxygen: number) => set({ oxygen: Math.max(0, Math.min(300, oxygen)) }),

  respawn: () => {
    // Find a safe spawn position - IMPROVED TO AVOID WATER SPAWNING
    const worldStore = useWorldStore.getState();
    let spawnX = 0;
    let spawnY = 100;
    let spawnZ = 0;
    
    // Search for solid ground in a 30-block radius (wider search for better results)
    let foundSafeSpawn = false;
    let bestSpawnY = 100; // Keep track of highest safe spawn
    
    for (let searchRadius = 0; searchRadius <= 30 && !foundSafeSpawn; searchRadius++) {
      for (let offsetX = -searchRadius; offsetX <= searchRadius && !foundSafeSpawn; offsetX++) {
        for (let offsetZ = -searchRadius; offsetZ <= searchRadius && !foundSafeSpawn; offsetZ++) {
          // Skip the center if we're not in the first iteration
          if (searchRadius === 0 && (offsetX !== 0 || offsetZ !== 0)) continue;
          
          const checkX = 0 + offsetX;
          const checkZ = 0 + offsetZ;
          
          // Find the highest solid block at this position
          for (let y = 120; y >= 50; y--) {
            const block = worldStore.getBlock(checkX, y, checkZ);
            
            // Check if this is a solid block (not water, lava, or air)
            if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
              // Check if the space above is clear for spawning (3 blocks high)
              const spawnCheckY = y + 3;
              const blockAbove1 = worldStore.getBlock(checkX, spawnCheckY, checkZ);
              const blockAbove2 = worldStore.getBlock(checkX, spawnCheckY + 1, checkZ);
              const blockAbove3 = worldStore.getBlock(checkX, spawnCheckY + 2, checkZ);
              
              // Ensure spawn position is clear of water, lava, and solid blocks
              const isClearSpace = blockAbove1 === BlockType.AIR && 
                                  blockAbove2 === BlockType.AIR && 
                                  blockAbove3 === BlockType.AIR;
              
              // Check surrounding blocks to avoid spawning near water
              const surroundingClear = 
                worldStore.getBlock(checkX - 1, spawnCheckY, checkZ) !== BlockType.WATER &&
                worldStore.getBlock(checkX + 1, spawnCheckY, checkZ) !== BlockType.WATER &&
                worldStore.getBlock(checkX, spawnCheckY, checkZ - 1) !== BlockType.WATER &&
                worldStore.getBlock(checkX, spawnCheckY, checkZ + 1) !== BlockType.WATER;
              
              if (isClearSpace && surroundingClear) {
                spawnX = checkX;
                spawnY = spawnCheckY;
                spawnZ = checkZ;
                foundSafeSpawn = true;
                
                // Prefer higher spawn points for better visibility
                if (spawnCheckY > bestSpawnY) {
                  bestSpawnY = spawnCheckY;
                }
                break;
              }
            }
          }
        }
      }
    }
    
    // If no safe spawn found, use default elevated position
    if (!foundSafeSpawn) {
      console.warn('No safe spawn position found, using default elevated spawn');
      spawnY = 120; // Spawn higher to avoid water
    }
    
    set({
      position: { x: spawnX + 0.5, y: spawnY, z: spawnZ + 0.5 }, // Center in block
      velocity: initialVelocity,
      health: MAX_HEALTH,
      hunger: MAX_HUNGER,
      saturation: 5,
      isOnGround: false,
      isInWater: false,
      isInLava: false,
    });
  },

  getMovementSpeed: () => {
    const { isSprinting, isSneaking, isInWater, isSwimming } = get();
    let speed = PLAYER_SPEED;

    if (isSwimming) {
      return PLAYER_SWIM_SPEED;
    }

    if (isSprinting) speed *= PLAYER_SPRINT_MULTIPLIER;
    if (isSneaking) speed *= PLAYER_SNEAK_MULTIPLIER;
    if (isInWater) speed *= 0.5;

    return speed;
  },

  getVerticalSpeed: () => {
    const { isInWater, isSwimming } = get();
    if (isSwimming) {
      return PLAYER_SWIM_VERTICAL_SPEED;
    }
    return 1.0; // Normal jump/swim speed
  },

  applyPhysics: (x: number, y: number, z: number, vx: number, vy: number, vz: number, delta: number, isFlying: boolean) => {
    // This will be implemented by importing and using the physics function
    return { x, y, z, vx, vy, vz, onGround: false, inWater: false, inLava: false, hitHead: false };
  },

  reset: () => set(initialState),
}));

// Calculate eye position
export function getEyePosition(position: PlayerPosition): PlayerPosition {
  return {
    x: position.x,
    y: position.y + PLAYER_HEIGHT - 0.18, // Eye height
    z: position.z,
  };
}

// Get look direction vector from rotation
export function getLookDirection(rotation: PlayerRotation): PlayerPosition {
  const { yaw, pitch } = rotation;
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}

// Get the currently selected block type from hotbar
export function getSelectedBlockType(): BlockType | null {
  const selectedSlot = usePlayerStore.getState().selectedSlot;
  const hotbarSlot = useInventoryStore.getState().getHotbarSlot(selectedSlot);
  return hotbarSlot.item && typeof hotbarSlot.item === 'number' ? hotbarSlot.item : null;
}

// Get the currently selected item type from hotbar
export function getSelectedItem(): BlockType | string | null {
  const selectedSlot = usePlayerStore.getState().selectedSlot;
  const hotbarSlot = useInventoryStore.getState().getHotbarSlot(selectedSlot);
  return hotbarSlot.item;
}
