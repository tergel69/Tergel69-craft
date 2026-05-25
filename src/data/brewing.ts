/**
 * brewing.ts — Potion brewing recipes and data
 *
 * Brewing follows Minecraft rules:
 * 1. Glass Bottle → Water Bottle (from water source)
 * 2. Water Bottle + Nether Wart → Awkward Potion (base)
 * 3. Awkward Potion + ingredient → Effect Potion
 * 4. Effect Potion + Redstone → Extended duration
 * 5. Effect Potion + Glowstone → Amplified (II)
 * 6. Effect Potion + Gunpowder → Splash Potion
 * 7. Splash Potion + Dragon's Breath → Lingering Potion
 * 8. Effect Potion + Fermented Spider Eye → Corrupted version
 */

import { ItemType } from './items';
import { BlockType } from './blocks';
import type { StatusEffectType } from '@/utils/statusEffects';
import { StatusEffect } from '@/utils/statusEffects';

export interface BrewingRecipe {
  input: ItemType | BlockType;
  ingredient: ItemType | BlockType;
  output: ItemType | BlockType;
  effect?: StatusEffect;
}

export const BREWING_RECIPES: BrewingRecipe[] = [
  // Water bottle + Nether Wart → Awkward Potion (base for all effect potions)
  { input: ItemType.GLASS_BOTTLE, ingredient: BlockType.NETHER_WART_BLOCK, output: ItemType.POTION },

  // Positive effects from Awkward Potion
  { input: ItemType.POTION, ingredient: ItemType.BLAZE_POWDER, output: ItemType.POTION, effect: { type: 'strength', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.MAGMA_CREAM, output: ItemType.POTION, effect: { type: 'fire_resistance', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.GHAST_TEAR, output: ItemType.POTION, effect: { type: 'regeneration', amplifier: 0, duration: 45, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.SUGAR, output: ItemType.POTION, effect: { type: 'speed', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.RABBIT_FOOT, output: ItemType.POTION, effect: { type: 'jump_boost', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.GOLDEN_CARROT, output: ItemType.POTION, effect: { type: 'night_vision', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.SPIDER_EYE, output: ItemType.POTION, effect: { type: 'poison', amplifier: 0, duration: 45, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.PUFFERFISH, output: ItemType.POTION, effect: { type: 'water_breathing', amplifier: 0, duration: 180, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.PHANTOM_MEMBRANE, output: ItemType.POTION, effect: { type: 'slow_falling', amplifier: 0, duration: 90, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.SLIME_BALL, output: ItemType.POTION, effect: { type: 'slowness', amplifier: 0, duration: 90, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.TURTLE_HELMET, output: ItemType.POTION, effect: { type: 'resistance', amplifier: 0, duration: 180, ambient: false } },

  // Corruption via Fermented Spider Eye
  { input: ItemType.POTION, ingredient: ItemType.FERMENTED_SPIDER_EYE, output: ItemType.POTION, effect: { type: 'weakness', amplifier: 0, duration: 90, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.FERMENTED_SPIDER_EYE, output: ItemType.POTION, effect: { type: 'slowness', amplifier: 0, duration: 90, ambient: false } },

  // Extended duration with Redstone
  { input: ItemType.POTION, ingredient: ItemType.REDSTONE, output: ItemType.POTION, effect: { type: 'speed', amplifier: 0, duration: 480, ambient: false } },

  // Amplified with Glowstone Dust
  { input: ItemType.POTION, ingredient: ItemType.GLOWSTONE_DUST, output: ItemType.POTION, effect: { type: 'speed', amplifier: 1, duration: 90, ambient: false } },
  { input: ItemType.POTION, ingredient: ItemType.GLOWSTONE_DUST, output: ItemType.POTION, effect: { type: 'strength', amplifier: 1, duration: 90, ambient: false } },

  // Splash conversion with Gunpowder
  { input: ItemType.POTION, ingredient: ItemType.GUNPOWDER, output: ItemType.SPLASH_POTION, effect: undefined },
];

// Effect name lookup for potion items
export const POTION_EFFECTS: Record<ItemType | string, StatusEffect> = {
  [ItemType.POTION]: { type: 'regeneration', amplifier: 0, duration: 45, ambient: false },
};

export function getBrewingRecipe(input: ItemType | BlockType, ingredient: ItemType | BlockType): BrewingRecipe | null {
  for (const recipe of BREWING_RECIPES) {
    if (recipe.input === input && recipe.ingredient === ingredient) return recipe;
  }
  return null;
}

export function getEffectFromPotion(potionType: ItemType | BlockType): StatusEffect | null {
  // Map potion type to effect via recipe lookup
  for (const recipe of BREWING_RECIPES) {
    if (recipe.output === potionType && recipe.effect) {
      return recipe.effect;
    }
  }
  return null;
}