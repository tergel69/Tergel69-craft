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
import { useGameStore } from '@/stores/gameStore';
import { getEnchantmentLevel } from '@/data/enchantments';
import { BlockType } from '@/data/blocks';
import { findSafeSpawnPosition } from '@/engine/Physics';

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
  consumeExperienceLevels: (amount: number) => boolean;
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
    const armorSlots = useInventoryStore.getState().armor;
    const protectionLevel =
      getEnchantmentLevel(armorSlots.helmet, 'protection') +
      getEnchantmentLevel(armorSlots.chestplate, 'protection') +
      getEnchantmentLevel(armorSlots.leggings, 'protection') +
      getEnchantmentLevel(armorSlots.boots, 'protection');
    const protectionReduction = Math.min(protectionLevel * 0.03, 0.24);
    const actualDamage = amount * (1 - reduction) * (1 - protectionReduction);

    const newHealth = Math.max(0, health - actualDamage);
    set({
      health: newHealth,
      invulnerabilityTime: 0.5, // 0.5 seconds of invulnerability
    });

    if (newHealth <= 0) {
      useGameStore.getState().setGameState('dead');
    }
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

  consumeExperienceLevels: (amount) => {
    if (amount <= 0) return true;
    const { experienceLevel } = get();
    if (experienceLevel < amount) return false;
    set({ experienceLevel: experienceLevel - amount });
    return true;
  },

  setOxygen: (oxygen: number) => set({ oxygen: Math.max(0, Math.min(300, oxygen)) }),

  respawn: () => {
    // Respawn near the current position so the player returns to the nearest surface.
    const { position } = get();
    const spawn = findSafeSpawnPosition(position.x, position.z, 64, true);

    set({
      position: spawn,
      velocity: initialVelocity,
      health: MAX_HEALTH,
      hunger: MAX_HUNGER,
      saturation: 5,
      isOnGround: false,
      isInWater: false,
      isInLava: false,
    });
    useGameStore.getState().setGameState('playing');
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
