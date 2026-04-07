/**
 * blockHardness.ts
 *
 * Per-block break times in seconds (bare-hand, no tool bonus).
 * These are tuned to feel realistic — harder than vanilla Minecraft
 * by default, matching the "make breaking slower" request.
 *
 * Usage:
 *   import { getBreakTime } from '@/data/blockHardness';
 *   const seconds = getBreakTime(BlockType.STONE); // → 4.0
 *
 * To wire tool speed bonuses later, multiply the return value by a
 * tool efficiency factor (e.g. 0.25 for the correct tool).
 */

import { BlockType } from '@/data/blocks';

// Break time in seconds, bare-hand
// Follows Minecraft hardness roughly but scaled up for realism
const BREAK_TIMES: Partial<Record<number, number>> = {
  // ── Instant break ──────────────────────────────────────────────────────────
  [BlockType.AIR]:           0,

  // ── Very fast (soft / loose) ───────────────────────────────────────────────
  [BlockType.SAND]:          0.75,
  [BlockType.GRAVEL]:        0.9,
  [BlockType.DIRT]:          0.75,
  [BlockType.GRASS]:         0.9,
  [BlockType.SNOW]:          0.4,
  [BlockType.ICE]:           0.5,
  [BlockType.PACKED_ICE]:    0.75,

  // ── Fast (wood / plants) ───────────────────────────────────────────────────
  [BlockType.OAK_LEAVES]:    0.35,
  [BlockType.CHERRY_LEAVES]: 0.35,
  [BlockType.BIRCH_LEAVES]:  0.35,
  [BlockType.JUNGLE_LEAVES]: 0.35,
  [BlockType.SPRUCE_LEAVES]: 0.35,
  [BlockType.ACACIA_LEAVES]: 0.35,
  [BlockType.DARK_OAK_LEAVES]: 0.35,
  [BlockType.TALL_GRASS]:    0.05,
  [BlockType.FLOWER_RED]:    0.05,
  [BlockType.FLOWER_YELLOW]: 0.05,
  [BlockType.MUSHROOM_RED]:  0.05,
  [BlockType.MUSHROOM_BROWN]: 0.05,
  [BlockType.PUMPKIN]:       1.0,
  [BlockType.MELON]:         1.0,
  [BlockType.CACTUS]:        0.4,
  [BlockType.DEAD_BUSH]:     0.05,
  [BlockType.SUGAR_CANE]:    0.05,
  [BlockType.SPONGE]:        0.9,
  [BlockType.WET_SPONGE]:    0.9,
  [BlockType.HAY_BALE]:      1.0,
  [BlockType.DRIED_KELP_BLOCK]: 0.5,
  [BlockType.BONE_BLOCK]:    1.5,
  [BlockType.SLIME_BLOCK]:   1.0,
  [BlockType.HONEY_BLOCK]:   1.0,
  [BlockType.TNT]:           0,

  // ── Medium (wood logs & planks) ────────────────────────────────────────────
  [BlockType.OAK_LOG]:       2.0,
  [BlockType.CHERRY_LOG]:    2.0,
  [BlockType.BIRCH_LOG]:     2.0,
  [BlockType.JUNGLE_LOG]:    2.0,
  [BlockType.SPRUCE_LOG]:    2.0,
  [BlockType.ACACIA_LOG]:    2.0,
  [BlockType.DARK_OAK_LOG]:  2.0,
  [BlockType.OAK_PLANKS]:    1.5,
  [BlockType.BIRCH_PLANKS]:  1.5,
  [BlockType.JUNGLE_PLANKS]: 1.5,
  [BlockType.SPRUCE_PLANKS]: 1.5,
  [BlockType.ACACIA_PLANKS]: 1.5,
  [BlockType.DARK_OAK_PLANKS]: 1.5,
  [BlockType.BOOKSHELF]:     1.5,
  [BlockType.CHEST]:         1.25,
  [BlockType.CRAFTING_TABLE]:1.5,
  [BlockType.FURNACE]:       3.25,

  // ── Medium-hard (stone-family) ─────────────────────────────────────────────
  [BlockType.STONE]:         4.0,
  [BlockType.COBBLESTONE]:   4.0,
  [BlockType.MOSSY_COBBLESTONE]: 4.0,
  [BlockType.STONEBRICK]:    4.0,
  [BlockType.CRACKED_STONEBRICK]: 4.0,
  [BlockType.CHISELED_STONEBRICK]: 4.0,
  [BlockType.SANDSTONE]:     3.5,
  [BlockType.CLAY]:          1.5,
  [BlockType.BRICK]:         4.0,
  [BlockType.NETHERRACK]:    1.5,
  [BlockType.SOUL_SAND]:     1.5,
  [BlockType.GLOWSTONE]:     1.5,
  [BlockType.NETHER_BRICK]:  3.0,
  [BlockType.COAL_ORE]:      6.0,
  [BlockType.IRON_ORE]:      6.0,
  [BlockType.GOLD_ORE]:      6.0,
  [BlockType.REDSTONE_ORE]:  6.0,
  [BlockType.LAPIS_ORE]:     6.0,
  [BlockType.DIAMOND_ORE]:   6.0,
  [BlockType.EMERALD_ORE]:   6.0,
  [BlockType.COPPER_ORE]:    6.0,

  // ── Hard (metal / gemstone blocks) ────────────────────────────────────────
  [BlockType.COAL_BLOCK]:    5.0,
  [BlockType.IRON_BLOCK]:    7.5,
  [BlockType.GOLD_BLOCK]:    7.5,
  [BlockType.DIAMOND_BLOCK]: 7.5,
  [BlockType.EMERALD_BLOCK]: 7.5,
  [BlockType.REDSTONE_BLOCK]:5.0,
  [BlockType.LAPIS_BLOCK]:   5.0,
  [BlockType.COPPER_BLOCK]:  5.0,
  [BlockType.QUARTZ_BLOCK]: 4.0,
  [BlockType.PRISMARINE]:    7.5,
  [BlockType.END_STONE]:     9.0,
  [BlockType.END_STONE_BRICKS]: 9.0,

  // ── Very hard ──────────────────────────────────────────────────────────────
  [BlockType.OBSIDIAN]:      50.0,
  [BlockType.CRYING_OBSIDIAN]: 50.0,
  [BlockType.ANCIENT_DEBRIS]: 30.0,
  [BlockType.NETHERITE_BLOCK]: 15.0,

  // ── Unbreakable ────────────────────────────────────────────────────────────
  [BlockType.BEDROCK]:       Infinity,

  // ── Liquids (instant — can't really break them) ───────────────────────────
  [BlockType.WATER]:         0,
  [BlockType.LAVA]:          0,

  // ── Glass (fragile but counts as instant with bare hand in MC, we slow it) ─
  [BlockType.GLASS]:         0.45,

  // ── Wool variants ───────────────────────────────────────────────────────────
  [BlockType.WOOL_WHITE]:    0.8,
  [BlockType.WOOL_RED]:      0.8,
  [BlockType.WOOL_BLUE]:     0.8,
  [BlockType.WOOL_GREEN]:    0.8,
  [BlockType.WOOL_YELLOW]:   0.8,
  [BlockType.WOOL_BLACK]:    0.8,
  [BlockType.WOOL_ORANGE]:   0.8,
  [BlockType.WOOL_MAGENTA]:  0.8,
  [BlockType.WOOL_LIGHT_BLUE]: 0.8,
  [BlockType.WOOL_LIME]:     0.8,
  [BlockType.WOOL_PINK]:     0.8,
  [BlockType.WOOL_GRAY]:     0.8,
  [BlockType.WOOL_LIGHT_GRAY]: 0.8,
  [BlockType.WOOL_CYAN]:     0.8,
  [BlockType.WOOL_PURPLE]:   0.8,
  [BlockType.WOOL_BROWN]:    0.8,

  // ── Stone variants ───────────────────────────────────────────────────────────
  [BlockType.GRANITE]:      4.0,
  [BlockType.POLISHED_GRANITE]: 4.0,
  [BlockType.DIORITE]:      4.0,
  [BlockType.POLISHED_DIORITE]: 4.0,
  [BlockType.ANDESITE]:     4.0,
  [BlockType.POLISHED_ANDESITE]: 4.0,
  [BlockType.SMOOTH_STONE]: 4.0,

  // ── Nether blocks ───────────────────────────────────────────────────────────
  [BlockType.QUARTZ_ORE]:   6.0,
  [BlockType.NETHER_WART_BLOCK]: 1.0,
  [BlockType.CRIMSON_STEM]: 2.0,
  [BlockType.CRIMSON_PLANKS]: 2.0,
  [BlockType.WARPED_STEM]: 2.0,
  [BlockType.WARPED_PLANKS]: 2.0,
  [BlockType.BASALT]:       4.0,
  [BlockType.BLACKSTONE]:    4.0,

  // ── Terracotta & Concrete ───────────────────────────────────────────────
  [BlockType.TERRACOTTA]:    1.5,
  [BlockType.TERRACOTTA_WHITE]: 1.5,
  [BlockType.TERRACOTTA_RED]: 1.5,
  [BlockType.TERRACOTTA_ORANGE]: 1.5,
  [BlockType.TERRACOTTA_YELLOW]: 1.5,
  [BlockType.TERRACOTTA_BROWN]: 1.5,
  [BlockType.TERRACOTTA_BLACK]: 1.5,
  [BlockType.CONCRETE_WHITE]: 1.5,
  [BlockType.CONCRETE_RED]: 1.5,
  [BlockType.CONCRETE_ORANGE]: 1.5,
  [BlockType.CONCRETE_YELLOW]: 1.5,
  [BlockType.CONCRETE_LIME]: 1.5,
  [BlockType.CONCRETE_BLUE]: 1.5,
  [BlockType.CONCRETE_CYAN]: 1.5,
  [BlockType.CONCRETE_PURPLE]: 1.5,
  [BlockType.CONCRETE_MAGENTA]: 1.5,
  [BlockType.CONCRETE_PINK]: 1.5,
  [BlockType.CONCRETE_GRAY]: 1.5,
  [BlockType.CONCRETE_LIGHT_GRAY]: 1.5,
  [BlockType.CONCRETE_BLACK]: 1.5,
  [BlockType.CONCRETE_BROWN]: 1.5,
  [BlockType.CONCRETE_GREEN]: 1.5,
  [BlockType.CONCRETE_LIGHT_BLUE]: 1.5,

  // ── Deepslate ───────────────────────────────────────────────────────────────
  [BlockType.DEEPSLATE]:      8.0,
  [BlockType.COBBLED_DEEPSLATE]: 8.0,
  [BlockType.DEEPSLATE_COAL_ORE]: 6.0,
  [BlockType.DEEPSLATE_IRON_ORE]: 6.0,
  [BlockType.DEEPSLATE_GOLD_ORE]: 6.0,
  [BlockType.DEEPSLATE_DIAMOND_ORE]: 6.0,
  [BlockType.DEEPSLATE_COPPER_ORE]: 6.0,
  [BlockType.DEEPSLATE_EMERALD_ORE]: 6.0,
  [BlockType.DEEPSLATE_LAPIS_ORE]: 6.0,
  [BlockType.DEEPSLATE_REDSTONE_ORE]: 6.0,

  // ── Amethyst ───────────────────────────────────────────────────────────────────
  [BlockType.AMETHYST_BLOCK]: 7.5,
  [BlockType.BUDDING_AMETHYST]: 1.0,

  // ── More decorative ───────────────────────────────────────────────────────
  [BlockType.PURPUR_BLOCK]: 7.5,
  [BlockType.PRISMARINE_BRICKS]: 7.5,
  [BlockType.DARK_PRISMARINE]: 7.5,
  [BlockType.SEA_LANTERN]: 1.5,
  [BlockType.BLUE_ICE]: 0.5,
  [BlockType.JACK_O_LANTERN]: 1.5,
  [BlockType.LANTERN]: 1.5,
  [BlockType.SOUL_LANTERN]: 1.5,
  [BlockType.RESPAWN_ANCHOR]: 1.5,
  [BlockType.LODESTONE]: 4.0,

  // ── Mud variants ───────────────────────────────────────────────────────────────
  [BlockType.MUD]: 1.0,
  [BlockType.PACKED_MUD]: 1.5,
  [BlockType.MUD_BRICKS]: 2.0,

  // ── Sculk ───────────────────────────────────────────────────────────────────
  [BlockType.SCULK]: 1.0,
  [BlockType.SCULK_CATALYST]: 2.0,

  // ── Moss & Dripstone ───────────────────────────────────────────────────
  [BlockType.MOSS_BLOCK]: 0.8,
  [BlockType.DRIPSTONE_BLOCK]: 2.0,
  [BlockType.CALCITE]: 3.5,
  [BlockType.TUFF]: 2.0,

  // ── Froglight ───────────────────────────────────────────────────────────────
  [BlockType.OCHRE_FROGLIGHT]: 0.5,
  [BlockType.VERDANT_FROGLIGHT]: 0.5,
  [BlockType.PEARLESCENT_FROGLIGHT]: 0.5,

  // ── More flowers ───────────────────────────────────────────────────────────
  [BlockType.FLOWER_BLUE_ORCHID]: 0.05,
  [BlockType.FLOWER_ALLIUM]: 0.05,
  [BlockType.FLOWER_AZURE_BLUET]: 0.05,
  [BlockType.FLOWER_TULIP_RED]: 0.05,
  [BlockType.FLOWER_TULIP_ORANGE]: 0.05,
  [BlockType.FLOWER_TULIP_WHITE]: 0.05,
  [BlockType.FLOWER_TULIP_PINK]: 0.05,
  [BlockType.FLOWER_OXEYE_DAISY]: 0.05,
  [BlockType.FLOWER_CORNFLOWER]: 0.05,
  [BlockType.FLOWER_LILY_OF_THE_VALLEY]: 0.05,
  [BlockType.FLOWER_WITHER_ROSE]: 0.05,
  [BlockType.SUNFLOWER]: 0.05,
  [BlockType.LILAC]: 0.05,
  [BlockType.ROSE_BUSH]: 0.05,
  [BlockType.PEONY]: 0.05,

  // ── Crops ───────────────────────────────────────────────────────────────────
  [BlockType.FARMLAND]: 0.5,
  [BlockType.WHEAT_CROP]: 0.05,
  [BlockType.CARROTS_CROP]: 0.05,
  [BlockType.POTATOES_CROP]: 0.05,
  [BlockType.BEETROOTS_CROP]: 0.05,

  // ── Coral blocks ───────────────────────────────────────────────────────────
  [BlockType.CORAL_BLOCK_TUBE]: 1.5,
  [BlockType.CORAL_BLOCK_BRAIN]: 1.5,
  [BlockType.CORAL_BLOCK_BUBBLE]: 1.5,
  [BlockType.CORAL_BLOCK_FIRE]: 1.5,
  [BlockType.CORAL_BLOCK_HORN]: 1.5,

  // ── Misc utility blocks ───────────────────────────────────────────────────
  [BlockType.LADDER]: 0.5,
  [BlockType.VINE]: 0.05,
  [BlockType.LILY_PAD]: 0.05,
  [BlockType.END_ROD]: 1.0,
  [BlockType.ENCHANTING_TABLE]: 2.5,
  [BlockType.ANVIL]: 5.0,
  [BlockType.BREWING_STAND]: 2.5,
  [BlockType.CAULDRON]: 2.0,
  [BlockType.BEACON]: 5.0,
  [BlockType.JUKEBOX]: 2.5,
  [BlockType.NOTE_BLOCK]: 1.0,
};

const DEFAULT_BREAK_TIME = 3.0; // fallback for any unmapped block

/**
 * Returns break time in seconds for the given block type (bare-hand).
 * Returns 0 for instant-break blocks, Infinity for bedrock.
 */
export function getBreakTime(blockType: number): number {
  const t = BREAK_TIMES[blockType];
  return t !== undefined ? t : DEFAULT_BREAK_TIME;
}

/**
 * Returns true if a block can never be broken.
 */
export function isUnbreakable(blockType: number): boolean {
  return getBreakTime(blockType) === Infinity;
}
