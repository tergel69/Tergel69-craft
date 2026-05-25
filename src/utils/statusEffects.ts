/**
 * statusEffects.ts — Status effect system for potions, food, and environmental effects
 *
 * Types of effects:
 *   - SPEED: Increases movement speed
 *   - SLOWNESS: Decreases movement speed
 *   - HASTE: Increases mining speed
 *   - MINING_FATIGUE: Decreases mining speed
 *   - STRENGTH: Increases melee damage
 *   - JUMP_BOOST: Increases jump height
 *   - REGENERATION: Heals over time
 *   - FIRE_RESISTANCE: Immunity to fire/lava damage
 *   - WATER_BREATHING: No drowning
 *   - NIGHT_VISION: Full brightness
 *   - INVISIBILITY: Become invisible (not rendered)
 *   - POISON: Damage over time (doesn't kill)
 *   - WITHER: Damage over time (can kill)
 *   - RESISTANCE: Damage reduction
 *   - ABSORPTION: Extra health that doesn't regenerate
 *   - GLOWING: Outlined (visual only)
 *   - LEVITATION: Float upward
 *   - SLOW_FALLING: No fall damage
 *   - DARKNESS: Reduced vision
 *   - BAD_OMEN: Triggers raid
 *   - HERO_OF_THE_VILLAGE: Discount on trades
 */

import { usePlayerStore } from '@/stores/playerStore';

export type StatusEffectType =
  | 'speed'
  | 'slowness'
  | 'haste'
  | 'mining_fatigue'
  | 'strength'
  | 'jump_boost'
  | 'regeneration'
  | 'fire_resistance'
  | 'water_breathing'
  | 'night_vision'
  | 'invisibility'
  | 'poison'
  | 'wither'
  | 'resistance'
  | 'absorption'
  | 'glowing'
  | 'levitation'
  | 'slow_falling'
  | 'darkness'
  | 'bad_omen'
  | 'hero_of_the_village'
  | 'weakness';

export interface StatusEffect {
  type: StatusEffectType;
  amplifier: number; // 0 = level I, 1 = level II, etc.
  duration: number; // seconds remaining
  ambient: boolean; // from beacon vs from potion
}

// ─── Active effects store (embedded in playerStore-like zustand store) ───

import { create } from 'zustand';

interface EffectStore {
  effects: Map<StatusEffectType, StatusEffect>;
  applyEffect: (effect: StatusEffect) => void;
  removeEffect: (type: StatusEffectType) => void;
  clearEffects: () => void;
  tickEffects: (delta: number) => void;
  getEffect: (type: StatusEffectType) => StatusEffect | undefined;
  hasEffect: (type: StatusEffectType) => boolean;
}

export const useEffectStore = create<EffectStore>((set, get) => ({
  effects: new Map(),

  applyEffect(effect) {
    set((state) => {
      const existing = state.effects.get(effect.type);
      // If same or lower tier, keep the longer duration
      if (existing) {
        if (existing.amplifier > effect.amplifier) return state;
        if (existing.amplifier === effect.amplifier && existing.duration > effect.duration) return state;
      }
      const next = new Map(state.effects);
      next.set(effect.type, effect);
      return { effects: next };
    });
  },

  removeEffect(type) {
    set((state) => {
      const next = new Map(state.effects);
      next.delete(type);
      return { effects: next };
    });
  },

  clearEffects() {
    set({ effects: new Map() });
  },

  tickEffects(delta) {
    set((state) => {
      const next = new Map(state.effects);
      let changed = false;
      for (const [type, effect] of next) {
        const newDuration = effect.duration - delta;
        if (newDuration <= 0) {
          next.delete(type);
          changed = true;
        } else if (newDuration !== effect.duration) {
          next.set(type, { ...effect, duration: newDuration });
          changed = true;
        }
      }
      if (!changed) return state;
      return { effects: next };
    });

    // Continuous effects applied in Player.tsx useFrame
  },

  getEffect(type) {
    return get().effects.get(type);
  },

  hasEffect(type) {
    return get().effects.has(type);
  },
}));

// ─── Effect names / colors / display ───

export const EFFECT_META: Record<StatusEffectType, { name: string; color: string }> = {
  speed:             { name: 'Speed',             color: '#7CFC00' },
  slowness:          { name: 'Slowness',          color: '#8B8B8B' },
  haste:             { name: 'Haste',             color: '#FFD700' },
  mining_fatigue:    { name: 'Mining Fatigue',    color: '#4A4A4A' },
  strength:          { name: 'Strength',          color: '#FF4444' },
  jump_boost:        { name: 'Jump Boost',        color: '#22FF22' },
  regeneration:      { name: 'Regeneration',      color: '#FF69B4' },
  fire_resistance:   { name: 'Fire Resistance',   color: '#FF8C00' },
  water_breathing:   { name: 'Water Breathing',   color: '#4444FF' },
  night_vision:      { name: 'Night Vision',      color: '#1E1E9E' },
  invisibility:      { name: 'Invisibility',      color: '#7F7F7F' },
  poison:            { name: 'Poison',            color: '#4F794F' },
  wither:            { name: 'Wither',            color: '#2D2D2D' },
  resistance:        { name: 'Resistance',        color: '#CCCCCC' },
  absorption:        { name: 'Absorption',        color: '#FFD700' },
  glowing:           { name: 'Glowing',           color: '#FFFF00' },
  levitation:        { name: 'Levitation',        color: '#CC88FF' },
  slow_falling:      { name: 'Slow Falling',      color: '#88BBFF' },
  darkness:          { name: 'Darkness',          color: '#000022' },
  bad_omen:          { name: 'Bad Omen',          color: '#758282' },
  hero_of_the_village: { name: 'Hero of the Village', color: '#44FF44' },
  weakness:            { name: 'Weakness',          color: '#7F7F7F' },
};

// ─── Continuous effect application ───

function applyContinuousEffects(): void {
  const effects = useEffectStore.getState().effects;
  const playerState = usePlayerStore.getState();

  // Regeneration: heal every 50 ticks (2.5s) per amplifier
  const regen = effects.get('regeneration');
  if (regen) {
    // Handled in Player.tsx useFrame loop
  }

  // Poison: damage every 25 ticks (1.25s) per amplifier (doesn't kill)
  // Handled in Player.tsx

  // Wither: damage every 25 ticks per amplifier (can kill)
  // Handled in Player.tsx
}

// ─── Movement speed modifier ───

export function getMovementSpeedModifier(effects: Map<StatusEffectType, StatusEffect>): number {
  let modifier = 1.0;
  const speed = effects.get('speed');
  if (speed) modifier += 0.2 * (speed.amplifier + 1);
  const slowness = effects.get('slowness');
  if (slowness) modifier -= 0.15 * (slowness.amplifier + 1);
  return Math.max(0.1, modifier);
}

// ─── Jump modifier ───

export function getJumpModifier(effects: Map<StatusEffectType, StatusEffect>): number {
  const jump = effects.get('jump_boost');
  if (jump) return 1 + 0.5 * (jump.amplifier + 1);
  return 1.0;
}

// ─── Fall damage modifier ───

export function getFallDamageModifier(effects: Map<StatusEffectType, StatusEffect>): number {
  if (effects.has('slow_falling')) return 0;
  if (effects.has('jump_boost')) return 0; // Jump Boost negates fall damage (Minecraft mechanic)
  return 1.0;
}

// ─── Melee damage modifier ───

export function getMeleeDamageModifier(effects: Map<StatusEffectType, StatusEffect>): number {
  let modifier = 1.0;
  const strength = effects.get('strength');
  if (strength) modifier += 3 * (strength.amplifier + 1);
  return modifier;
}

// ─── Mining speed modifier ───

export function getMiningSpeedModifier(effects: Map<StatusEffectType, StatusEffect>): number {
  let modifier = 1.0;
  const haste = effects.get('haste');
  if (haste) modifier += 0.1 * (haste.amplifier + 1);
  const fatigue = effects.get('mining_fatigue');
  if (fatigue) modifier -= 0.3 * (fatigue.amplifier + 1);
  return Math.max(0.1, modifier);
}

// ─── Absorption health ───

export function getAbsorptionHealth(effects: Map<StatusEffectType, StatusEffect>): number {
  const abs = effects.get('absorption');
  if (abs) return 4 * (abs.amplifier + 1);
  return 0;
}