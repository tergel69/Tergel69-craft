import { BlockType } from '@/data/blocks';
import { ItemType, ITEMS } from '@/data/items';

export interface FoodInfo {
  foodPoints: number;
  saturation: number;
  isPoisonous?: boolean;
  poisonDuration?: number;
}

/**
 * Check if an item is edible food
 */
export function isFood(item: BlockType | ItemType | null | undefined): boolean {
  if (!item || typeof item === 'number') {
    return false;
  }

  const itemData = ITEMS[item];
  return itemData?.foodPoints !== undefined && itemData.foodPoints > 0;
}

/**
 * Get food information for an item
 */
export function getFoodInfo(item: BlockType | ItemType | null | undefined): FoodInfo | null {
  if (!item || typeof item === 'number') {
    return null;
  }

  const itemData = ITEMS[item];
  if (!itemData || itemData.foodPoints === undefined) {
    return null;
  }

  // Check for poisonous food
  const isPoisonous = item === ItemType.SPIDER_EYE ||
                      item === ItemType.POISONOUS_POTATO ||
                      item === ItemType.PUFFERFISH ||
                      item === ItemType.ROTTEN_FLESH;

  return {
    foodPoints: itemData.foodPoints,
    saturation: itemData.saturation || itemData.foodPoints * 0.6,
    isPoisonous,
    poisonDuration: isPoisonous ? (item === ItemType.PUFFERFISH ? 15 : 5) : undefined,
  };
}

/**
 * Check if player can eat (hunger not full)
 */
export function canEat(currentHunger: number, maxHunger: number, foodItem: BlockType | ItemType | null | undefined): boolean {
  // Can always eat golden apples and chorus fruit regardless of hunger
  if (foodItem === ItemType.GOLDEN_APPLE ||
      foodItem === ItemType.ENCHANTED_GOLDEN_APPLE ||
      foodItem === ItemType.CHORUS_FRUIT) {
    return true;
  }

  // Can only eat if not at max hunger
  return currentHunger < maxHunger && isFood(foodItem);
}

/**
 * Food-related effects
 */
export interface FoodEffect {
  type: 'heal' | 'damage' | 'poison' | 'regeneration' | 'absorption' | 'saturation_boost';
  value: number;
  duration?: number;
}

/**
 * Get special effects from eating certain foods
 */
export function getFoodEffects(item: ItemType): FoodEffect[] {
  const effects: FoodEffect[] = [];

  switch (item) {
    case ItemType.GOLDEN_APPLE:
      effects.push({ type: 'regeneration', value: 2, duration: 5 });
      effects.push({ type: 'absorption', value: 4, duration: 120 });
      break;

    case ItemType.ENCHANTED_GOLDEN_APPLE:
      effects.push({ type: 'regeneration', value: 5, duration: 20 });
      effects.push({ type: 'absorption', value: 4, duration: 120 });
      break;

    case ItemType.GOLDEN_CARROT:
      // Just a good food, no special effects
      break;

    case ItemType.SPIDER_EYE:
      effects.push({ type: 'poison', value: 1, duration: 4 });
      break;

    case ItemType.POISONOUS_POTATO:
      effects.push({ type: 'poison', value: 1, duration: 5 });
      break;

    case ItemType.ROTTEN_FLESH:
      effects.push({ type: 'poison', value: 1, duration: 8 }); // Hunger effect in MC, using poison here
      break;

    case ItemType.PUFFERFISH:
      effects.push({ type: 'poison', value: 4, duration: 60 });
      break;

    case ItemType.HONEY_BOTTLE:
      // Clears poison effect in MC
      break;

    case ItemType.MILK_BUCKET:
      // Clears all effects in MC
      break;
  }

  return effects;
}

/**
 * List of all food items for reference
 */
export const FOOD_ITEMS: ItemType[] = [
  ItemType.APPLE,
  ItemType.GOLDEN_APPLE,
  ItemType.ENCHANTED_GOLDEN_APPLE,
  ItemType.BREAD,
  ItemType.RAW_PORKCHOP,
  ItemType.COOKED_PORKCHOP,
  ItemType.RAW_BEEF,
  ItemType.COOKED_BEEF,
  ItemType.RAW_CHICKEN,
  ItemType.COOKED_CHICKEN,
  ItemType.RAW_MUTTON,
  ItemType.COOKED_MUTTON,
  ItemType.RAW_RABBIT,
  ItemType.COOKED_RABBIT,
  ItemType.RAW_COD,
  ItemType.COOKED_COD,
  ItemType.RAW_SALMON,
  ItemType.COOKED_SALMON,
  ItemType.TROPICAL_FISH,
  ItemType.PUFFERFISH,
  ItemType.MELON_SLICE,
  ItemType.COOKIE,
  ItemType.PUMPKIN_PIE,
  ItemType.CARROT,
  ItemType.GOLDEN_CARROT,
  ItemType.POTATO,
  ItemType.BAKED_POTATO,
  ItemType.POISONOUS_POTATO,
  ItemType.MUSHROOM_STEW,
  ItemType.RABBIT_STEW,
  ItemType.BEETROOT_SOUP,
  ItemType.SUSPICIOUS_STEW,
  ItemType.SPIDER_EYE,
  ItemType.ROTTEN_FLESH,
  ItemType.SWEET_BERRIES,
  ItemType.GLOW_BERRIES,
  ItemType.HONEY_BOTTLE,
  ItemType.DRIED_KELP,
  ItemType.CHORUS_FRUIT,
  ItemType.BEETROOT,
];
