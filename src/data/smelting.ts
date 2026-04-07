import { BlockType } from './blocks';
import { ItemType } from './items';

export interface SmeltingRecipe {
  input: BlockType | ItemType;
  output: BlockType | ItemType;
  count?: number;
  cookTime: number;
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { input: BlockType.COBBLESTONE, output: BlockType.STONE, cookTime: 3 },
  { input: BlockType.SAND, output: BlockType.GLASS, cookTime: 3 },
  { input: ItemType.CLAY_BALL, output: ItemType.BRICK, cookTime: 3 },
  { input: BlockType.STONE, output: BlockType.SMOOTH_STONE, cookTime: 3 },
  { input: ItemType.RAW_IRON, output: ItemType.IRON_INGOT, cookTime: 4 },
  { input: ItemType.RAW_GOLD, output: ItemType.GOLD_INGOT, cookTime: 4 },
  { input: ItemType.RAW_COPPER, output: ItemType.COPPER_INGOT, cookTime: 4 },
  { input: ItemType.RAW_PORKCHOP, output: ItemType.COOKED_PORKCHOP, cookTime: 4 },
  { input: ItemType.RAW_BEEF, output: ItemType.COOKED_BEEF, cookTime: 4 },
  { input: ItemType.RAW_CHICKEN, output: ItemType.COOKED_CHICKEN, cookTime: 4 },
  { input: ItemType.RAW_MUTTON, output: ItemType.COOKED_MUTTON, cookTime: 4 },
  { input: ItemType.RAW_RABBIT, output: ItemType.COOKED_RABBIT, cookTime: 4 },
  { input: ItemType.RAW_COD, output: ItemType.COOKED_COD, cookTime: 4 },
  { input: ItemType.RAW_SALMON, output: ItemType.COOKED_SALMON, cookTime: 4 },
  { input: ItemType.POTATO, output: ItemType.BAKED_POTATO, cookTime: 4 },
  { input: BlockType.OAK_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
  { input: BlockType.BIRCH_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
  { input: BlockType.SPRUCE_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
  { input: BlockType.JUNGLE_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
  { input: BlockType.ACACIA_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
  { input: BlockType.DARK_OAK_LOG, output: ItemType.CHARCOAL, cookTime: 4 },
];

export const FUEL_VALUES: Partial<Record<BlockType | ItemType, number>> = {
  [ItemType.COAL]: 80,
  [ItemType.CHARCOAL]: 80,
  [BlockType.OAK_LOG]: 15,
  [BlockType.BIRCH_LOG]: 15,
  [BlockType.SPRUCE_LOG]: 15,
  [BlockType.JUNGLE_LOG]: 15,
  [BlockType.ACACIA_LOG]: 15,
  [BlockType.DARK_OAK_LOG]: 15,
  [BlockType.OAK_PLANKS]: 15,
  [BlockType.BIRCH_PLANKS]: 15,
  [BlockType.SPRUCE_PLANKS]: 15,
  [BlockType.JUNGLE_PLANKS]: 15,
  [BlockType.ACACIA_PLANKS]: 15,
  [BlockType.DARK_OAK_PLANKS]: 15,
  [ItemType.STICK]: 5,
};

export function getSmeltingRecipe(input: BlockType | ItemType | null | undefined): SmeltingRecipe | null {
  if (input == null) return null;
  return SMELTING_RECIPES.find((recipe) => recipe.input === input) ?? null;
}
