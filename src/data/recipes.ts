import { BlockType } from './blocks';
import { ItemType } from './items';

export interface Recipe {
  id: string;
  pattern: (string | null)[][]; // 2D array for shaped, or null for shapeless
  ingredients: Record<string, BlockType | ItemType>;
  result: {
    item: BlockType | ItemType;
    count: number;
  };
  shapeless?: boolean;
}

// Helper to create a shaped recipe
function shaped(
  id: string,
  pattern: string[],
  ingredients: Record<string, BlockType | ItemType>,
  result: BlockType | ItemType,
  count: number = 1
): Recipe {
  return {
    id,
    pattern: pattern.map(row => row.split('').map(char => char === ' ' ? null : char)),
    ingredients,
    result: { item: result, count },
  };
}

// Helper to create a shapeless recipe
function shapeless(
  id: string,
  ingredients: (BlockType | ItemType)[],
  result: BlockType | ItemType,
  count: number = 1
): Recipe {
  const ingredientMap: Record<string, BlockType | ItemType> = {};
  const pattern: (string | null)[][] = [[]];

  ingredients.forEach((ing, i) => {
    const key = String.fromCharCode(65 + i); // A, B, C, ...
    ingredientMap[key] = ing;
    pattern[0].push(key);
  });

  return {
    id,
    pattern,
    ingredients: ingredientMap,
    result: { item: result, count },
    shapeless: true,
  };
}

export const RECIPES: Recipe[] = [
  // ====== PLANKS FROM LOGS ======
  shapeless('oak_planks', [BlockType.OAK_LOG], BlockType.OAK_PLANKS, 4),
  shapeless('birch_planks', [BlockType.BIRCH_LOG], BlockType.BIRCH_PLANKS, 4),
  shapeless('spruce_planks', [BlockType.SPRUCE_LOG], BlockType.SPRUCE_PLANKS, 4),
  shapeless('jungle_planks', [BlockType.JUNGLE_LOG], BlockType.JUNGLE_PLANKS, 4),
  shapeless('acacia_planks', [BlockType.ACACIA_LOG], BlockType.ACACIA_PLANKS, 4),
  shapeless('dark_oak_planks', [BlockType.DARK_OAK_LOG], BlockType.DARK_OAK_PLANKS, 4),

  // Sticks from different planks
  shaped('sticks', ['P', 'P'], { P: BlockType.OAK_PLANKS }, ItemType.STICK, 4),
  shaped('sticks_birch', ['P', 'P'], { P: BlockType.BIRCH_PLANKS }, ItemType.STICK, 4),
  shaped('sticks_spruce', ['P', 'P'], { P: BlockType.SPRUCE_PLANKS }, ItemType.STICK, 4),
  shaped('sticks_jungle', ['P', 'P'], { P: BlockType.JUNGLE_PLANKS }, ItemType.STICK, 4),
  shaped('sticks_acacia', ['P', 'P'], { P: BlockType.ACACIA_PLANKS }, ItemType.STICK, 4),
  shaped('sticks_dark_oak', ['P', 'P'], { P: BlockType.DARK_OAK_PLANKS }, ItemType.STICK, 4),

  // ====== BASIC CRAFTING BLOCKS ======
  shaped('crafting_table', ['PP', 'PP'], { P: BlockType.OAK_PLANKS }, BlockType.CRAFTING_TABLE),
  shaped('furnace', ['CCC', 'C C', 'CCC'], { C: BlockType.COBBLESTONE }, BlockType.FURNACE),
  shaped('chest', ['PPP', 'P P', 'PPP'], { P: BlockType.OAK_PLANKS }, BlockType.CHEST),
  shaped('torch', ['C', 'S'], { C: ItemType.COAL, S: ItemType.STICK }, BlockType.TORCH, 4),
  shaped('bookshelf', ['PPP', 'BBB', 'PPP'], { P: BlockType.OAK_PLANKS, B: ItemType.BOOK }, BlockType.BOOKSHELF),
  shaped('tnt', ['GSG', 'SGS', 'GSG'], { G: ItemType.GUNPOWDER, S: BlockType.SAND }, BlockType.TNT),

  // ====== WOODEN TOOLS ======
  shaped('wooden_pickaxe', ['PPP', ' S ', ' S '], { P: BlockType.OAK_PLANKS, S: ItemType.STICK }, ItemType.WOODEN_PICKAXE),
  shaped('wooden_axe', ['PP', 'PS', ' S'], { P: BlockType.OAK_PLANKS, S: ItemType.STICK }, ItemType.WOODEN_AXE),
  shaped('wooden_shovel', ['P', 'S', 'S'], { P: BlockType.OAK_PLANKS, S: ItemType.STICK }, ItemType.WOODEN_SHOVEL),
  shaped('wooden_hoe', ['PP', ' S', ' S'], { P: BlockType.OAK_PLANKS, S: ItemType.STICK }, ItemType.WOODEN_HOE),
  shaped('wooden_sword', ['P', 'P', 'S'], { P: BlockType.OAK_PLANKS, S: ItemType.STICK }, ItemType.WOODEN_SWORD),

  // ====== STONE TOOLS ======
  shaped('stone_pickaxe', ['CCC', ' S ', ' S '], { C: BlockType.COBBLESTONE, S: ItemType.STICK }, ItemType.STONE_PICKAXE),
  shaped('stone_axe', ['CC', 'CS', ' S'], { C: BlockType.COBBLESTONE, S: ItemType.STICK }, ItemType.STONE_AXE),
  shaped('stone_shovel', ['C', 'S', 'S'], { C: BlockType.COBBLESTONE, S: ItemType.STICK }, ItemType.STONE_SHOVEL),
  shaped('stone_hoe', ['CC', ' S', ' S'], { C: BlockType.COBBLESTONE, S: ItemType.STICK }, ItemType.STONE_HOE),
  shaped('stone_sword', ['C', 'C', 'S'], { C: BlockType.COBBLESTONE, S: ItemType.STICK }, ItemType.STONE_SWORD),

  // ====== IRON TOOLS ======
  shaped('iron_pickaxe', ['III', ' S ', ' S '], { I: ItemType.IRON_INGOT, S: ItemType.STICK }, ItemType.IRON_PICKAXE),
  shaped('iron_axe', ['II', 'IS', ' S'], { I: ItemType.IRON_INGOT, S: ItemType.STICK }, ItemType.IRON_AXE),
  shaped('iron_shovel', ['I', 'S', 'S'], { I: ItemType.IRON_INGOT, S: ItemType.STICK }, ItemType.IRON_SHOVEL),
  shaped('iron_hoe', ['II', ' S', ' S'], { I: ItemType.IRON_INGOT, S: ItemType.STICK }, ItemType.IRON_HOE),
  shaped('iron_sword', ['I', 'I', 'S'], { I: ItemType.IRON_INGOT, S: ItemType.STICK }, ItemType.IRON_SWORD),

  // ====== DIAMOND TOOLS ======
  shaped('diamond_pickaxe', ['DDD', ' S ', ' S '], { D: ItemType.DIAMOND, S: ItemType.STICK }, ItemType.DIAMOND_PICKAXE),
  shaped('diamond_axe', ['DD', 'DS', ' S'], { D: ItemType.DIAMOND, S: ItemType.STICK }, ItemType.DIAMOND_AXE),
  shaped('diamond_shovel', ['D', 'S', 'S'], { D: ItemType.DIAMOND, S: ItemType.STICK }, ItemType.DIAMOND_SHOVEL),
  shaped('diamond_hoe', ['DD', ' S', ' S'], { D: ItemType.DIAMOND, S: ItemType.STICK }, ItemType.DIAMOND_HOE),
  shaped('diamond_sword', ['D', 'D', 'S'], { D: ItemType.DIAMOND, S: ItemType.STICK }, ItemType.DIAMOND_SWORD),

  // ====== GOLD TOOLS ======
  shaped('gold_pickaxe', ['GGG', ' S ', ' S '], { G: ItemType.GOLD_INGOT, S: ItemType.STICK }, ItemType.GOLD_PICKAXE),
  shaped('gold_axe', ['GG', 'GS', ' S'], { G: ItemType.GOLD_INGOT, S: ItemType.STICK }, ItemType.GOLD_AXE),
  shaped('gold_shovel', ['G', 'S', 'S'], { G: ItemType.GOLD_INGOT, S: ItemType.STICK }, ItemType.GOLD_SHOVEL),
  shaped('gold_hoe', ['GG', ' S', ' S'], { G: ItemType.GOLD_INGOT, S: ItemType.STICK }, ItemType.GOLD_HOE),
  shaped('gold_sword', ['G', 'G', 'S'], { G: ItemType.GOLD_INGOT, S: ItemType.STICK }, ItemType.GOLD_SWORD),

  // ====== NETHERITE UPGRADES ======
  shapeless('netherite_sword', [ItemType.DIAMOND_SWORD, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_SWORD),
  shapeless('netherite_pickaxe', [ItemType.DIAMOND_PICKAXE, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_PICKAXE),
  shapeless('netherite_axe', [ItemType.DIAMOND_AXE, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_AXE),
  shapeless('netherite_shovel', [ItemType.DIAMOND_SHOVEL, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_SHOVEL),
  shapeless('netherite_hoe', [ItemType.DIAMOND_HOE, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_HOE),

  // ====== LEATHER ARMOR ======
  shaped('leather_helmet', ['LLL', 'L L'], { L: ItemType.LEATHER }, ItemType.LEATHER_HELMET),
  shaped('leather_chestplate', ['L L', 'LLL', 'LLL'], { L: ItemType.LEATHER }, ItemType.LEATHER_CHESTPLATE),
  shaped('leather_leggings', ['LLL', 'L L', 'L L'], { L: ItemType.LEATHER }, ItemType.LEATHER_LEGGINGS),
  shaped('leather_boots', ['L L', 'L L'], { L: ItemType.LEATHER }, ItemType.LEATHER_BOOTS),

  // ====== IRON ARMOR ======
  shaped('iron_helmet', ['III', 'I I'], { I: ItemType.IRON_INGOT }, ItemType.IRON_HELMET),
  shaped('iron_chestplate', ['I I', 'III', 'III'], { I: ItemType.IRON_INGOT }, ItemType.IRON_CHESTPLATE),
  shaped('iron_leggings', ['III', 'I I', 'I I'], { I: ItemType.IRON_INGOT }, ItemType.IRON_LEGGINGS),
  shaped('iron_boots', ['I I', 'I I'], { I: ItemType.IRON_INGOT }, ItemType.IRON_BOOTS),

  // ====== GOLD ARMOR ======
  shaped('gold_helmet', ['GGG', 'G G'], { G: ItemType.GOLD_INGOT }, ItemType.GOLD_HELMET),
  shaped('gold_chestplate', ['G G', 'GGG', 'GGG'], { G: ItemType.GOLD_INGOT }, ItemType.GOLD_CHESTPLATE),
  shaped('gold_leggings', ['GGG', 'G G', 'G G'], { G: ItemType.GOLD_INGOT }, ItemType.GOLD_LEGGINGS),
  shaped('gold_boots', ['G G', 'G G'], { G: ItemType.GOLD_INGOT }, ItemType.GOLD_BOOTS),

  // ====== DIAMOND ARMOR ======
  shaped('diamond_helmet', ['DDD', 'D D'], { D: ItemType.DIAMOND }, ItemType.DIAMOND_HELMET),
  shaped('diamond_chestplate', ['D D', 'DDD', 'DDD'], { D: ItemType.DIAMOND }, ItemType.DIAMOND_CHESTPLATE),
  shaped('diamond_leggings', ['DDD', 'D D', 'D D'], { D: ItemType.DIAMOND }, ItemType.DIAMOND_LEGGINGS),
  shaped('diamond_boots', ['D D', 'D D'], { D: ItemType.DIAMOND }, ItemType.DIAMOND_BOOTS),

  // ====== NETHERITE ARMOR UPGRADES ======
  shapeless('netherite_helmet', [ItemType.DIAMOND_HELMET, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_HELMET),
  shapeless('netherite_chestplate', [ItemType.DIAMOND_CHESTPLATE, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_CHESTPLATE),
  shapeless('netherite_leggings', [ItemType.DIAMOND_LEGGINGS, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_LEGGINGS),
  shapeless('netherite_boots', [ItemType.DIAMOND_BOOTS, ItemType.NETHERITE_INGOT], ItemType.NETHERITE_BOOTS),

  // ====== WOOL DYEING ======
  shapeless('wool_orange', [BlockType.WOOL_WHITE, ItemType.DYE_ORANGE], BlockType.WOOL_ORANGE),
  shapeless('wool_magenta', [BlockType.WOOL_WHITE, ItemType.DYE_MAGENTA], BlockType.WOOL_MAGENTA),
  shapeless('wool_light_blue', [BlockType.WOOL_WHITE, ItemType.DYE_LIGHT_BLUE], BlockType.WOOL_LIGHT_BLUE),
  shapeless('wool_yellow', [BlockType.WOOL_WHITE, ItemType.DYE_YELLOW], BlockType.WOOL_YELLOW),
  shapeless('wool_lime', [BlockType.WOOL_WHITE, ItemType.DYE_LIME], BlockType.WOOL_LIME),
  shapeless('wool_pink', [BlockType.WOOL_WHITE, ItemType.DYE_PINK], BlockType.WOOL_PINK),
  shapeless('wool_gray', [BlockType.WOOL_WHITE, ItemType.DYE_GRAY], BlockType.WOOL_GRAY),
  shapeless('wool_light_gray', [BlockType.WOOL_WHITE, ItemType.DYE_LIGHT_GRAY], BlockType.WOOL_LIGHT_GRAY),
  shapeless('wool_cyan', [BlockType.WOOL_WHITE, ItemType.DYE_CYAN], BlockType.WOOL_CYAN),
  shapeless('wool_purple', [BlockType.WOOL_WHITE, ItemType.DYE_PURPLE], BlockType.WOOL_PURPLE),
  shapeless('wool_blue', [BlockType.WOOL_WHITE, ItemType.DYE_BLUE], BlockType.WOOL_BLUE),
  shapeless('wool_brown', [BlockType.WOOL_WHITE, ItemType.DYE_BROWN], BlockType.WOOL_BROWN),
  shapeless('wool_green', [BlockType.WOOL_WHITE, ItemType.DYE_GREEN], BlockType.WOOL_GREEN),
  shapeless('wool_red', [BlockType.WOOL_WHITE, ItemType.DYE_RED], BlockType.WOOL_RED),
  shapeless('wool_black', [BlockType.WOOL_WHITE, ItemType.DYE_BLACK], BlockType.WOOL_BLACK),

  // ====== DYE CRAFTING ======
  shapeless('white_dye', [ItemType.BONE_MEAL], ItemType.DYE_WHITE),
  shapeless('red_dye', [BlockType.FLOWER_RED], ItemType.DYE_RED),
  shapeless('yellow_dye', [BlockType.FLOWER_YELLOW], ItemType.DYE_YELLOW),
  shapeless('blue_dye', [ItemType.LAPIS_LAZULI], ItemType.DYE_BLUE),
  shapeless('orange_dye', [ItemType.DYE_RED, ItemType.DYE_YELLOW], ItemType.DYE_ORANGE),
  shapeless('magenta_dye', [ItemType.DYE_PURPLE, ItemType.DYE_PINK], ItemType.DYE_MAGENTA),
  shapeless('light_blue_dye', [ItemType.DYE_BLUE, ItemType.DYE_WHITE], ItemType.DYE_LIGHT_BLUE),
  shapeless('lime_dye', [ItemType.DYE_GREEN, ItemType.DYE_WHITE], ItemType.DYE_LIME),
  shapeless('pink_dye', [ItemType.DYE_RED, ItemType.DYE_WHITE], ItemType.DYE_PINK),
  shapeless('gray_dye', [ItemType.DYE_BLACK, ItemType.DYE_WHITE], ItemType.DYE_GRAY),
  shapeless('light_gray_dye', [ItemType.DYE_GRAY, ItemType.DYE_WHITE], ItemType.DYE_LIGHT_GRAY),
  shapeless('cyan_dye', [ItemType.DYE_BLUE, ItemType.DYE_GREEN], ItemType.DYE_CYAN),
  shapeless('purple_dye', [ItemType.DYE_RED, ItemType.DYE_BLUE], ItemType.DYE_PURPLE),

  // ====== BEDS ======
  shaped('bed_white', ['WWW', 'PPP'], { W: BlockType.WOOL_WHITE, P: BlockType.OAK_PLANKS }, ItemType.BED),

  // ====== FOOD ======
  shaped('bread', ['WWW'], { W: ItemType.WHEAT }, ItemType.BREAD),
  shaped('golden_apple', ['GGG', 'GAG', 'GGG'], { G: ItemType.GOLD_INGOT, A: ItemType.APPLE }, ItemType.GOLDEN_APPLE),
  shaped('golden_carrot', ['GGG', 'GCG', 'GGG'], { G: ItemType.GOLD_NUGGET, C: ItemType.CARROT }, ItemType.GOLDEN_CARROT),
  shaped('cookie', ['WCW'], { W: ItemType.WHEAT, C: ItemType.COCOA_BEANS }, ItemType.COOKIE, 8),
  shapeless('pumpkin_pie', [BlockType.PUMPKIN, ItemType.SUGAR, ItemType.EGG], ItemType.PUMPKIN_PIE),

  // ====== MISC ITEMS ======
  shaped('bucket', ['I I', ' I '], { I: ItemType.IRON_INGOT }, ItemType.BUCKET),
  shaped('shears', [' I', 'I '], { I: ItemType.IRON_INGOT }, ItemType.SHEARS),
  shapeless('bone_meal', [ItemType.BONE], ItemType.BONE_MEAL, 3),
  shaped('paper', ['SSS'], { S: BlockType.SUGAR_CANE }, ItemType.PAPER, 3),
  shaped('book', ['PP', 'PL'], { P: ItemType.PAPER, L: ItemType.LEATHER }, ItemType.BOOK),
  shaped('arrows', ['F', 'S', 'E'], { F: ItemType.FLINT, S: ItemType.STICK, E: ItemType.FEATHER }, ItemType.ARROW, 4),
  shaped('bow', [' ST', 'S T', ' ST'], { S: ItemType.STICK, T: ItemType.STRING }, ItemType.BOW),
  shaped('fishing_rod', ['  S', ' ST', 'S T'], { S: ItemType.STICK, T: ItemType.STRING }, ItemType.FISHING_ROD),
  shaped('compass', [' I ', 'IRI', ' I '], { I: ItemType.IRON_INGOT, R: ItemType.REDSTONE }, ItemType.COMPASS),
  shaped('clock', [' G ', 'GRG', ' G '], { G: ItemType.GOLD_INGOT, R: ItemType.REDSTONE }, ItemType.CLOCK),
  shaped('map', ['PPP', 'PCP', 'PPP'], { P: ItemType.PAPER, C: ItemType.COMPASS }, ItemType.MAP),
  shaped('lead', ['SS ', 'SB ', '  S'], { S: ItemType.STRING, B: ItemType.SLIME_BALL }, ItemType.LEAD, 2),
  shaped('shield', ['PIP', 'PPP', ' P '], { P: BlockType.OAK_PLANKS, I: ItemType.IRON_INGOT }, ItemType.SHIELD),

  // ====== DECORATIVE BLOCKS ======
  shaped('sandstone', ['SS', 'SS'], { S: BlockType.SAND }, BlockType.SANDSTONE),
  shaped('stone_bricks', ['SS', 'SS'], { S: BlockType.STONE }, BlockType.STONEBRICK, 4),
  shaped('bricks', ['BB', 'BB'], { B: ItemType.BRICK }, BlockType.BRICK),
  shaped('snow_block', ['SS', 'SS'], { S: ItemType.SNOWBALL }, BlockType.SNOW),
  shaped('glowstone', ['GG', 'GG'], { G: ItemType.GLOWSTONE_DUST }, BlockType.GLOWSTONE),
  shaped('clay_block', ['CC', 'CC'], { C: ItemType.CLAY_BALL }, BlockType.CLAY),
  shaped('quartz_block', ['QQ', 'QQ'], { Q: ItemType.QUARTZ }, BlockType.QUARTZ_BLOCK),
  shaped('jack_o_lantern', ['P', 'T'], { P: BlockType.PUMPKIN, T: BlockType.TORCH }, BlockType.JACK_O_LANTERN),
  shaped('melon_block', ['MMM', 'MMM', 'MMM'], { M: ItemType.MELON_SLICE }, BlockType.MELON),
  shaped('polished_granite', ['GG', 'GG'], { G: BlockType.GRANITE }, BlockType.POLISHED_GRANITE, 4),
  shaped('polished_diorite', ['DD', 'DD'], { D: BlockType.DIORITE }, BlockType.POLISHED_DIORITE, 4),
  shaped('polished_andesite', ['AA', 'AA'], { A: BlockType.ANDESITE }, BlockType.POLISHED_ANDESITE, 4),
  shaped('nether_bricks', ['NN', 'NN'], { N: ItemType.BRICK }, BlockType.NETHER_BRICK),
  shaped('lantern', ['NNN', 'NTN', 'NNN'], { N: ItemType.IRON_NUGGET, T: BlockType.TORCH }, BlockType.LANTERN),
  shaped('ladder', ['S S', 'SSS', 'S S'], { S: ItemType.STICK }, BlockType.LADDER, 3),

  // ====== STORAGE BLOCKS ======
  shaped('iron_block', ['III', 'III', 'III'], { I: ItemType.IRON_INGOT }, BlockType.IRON_BLOCK),
  shaped('gold_block', ['GGG', 'GGG', 'GGG'], { G: ItemType.GOLD_INGOT }, BlockType.GOLD_BLOCK),
  shaped('diamond_block', ['DDD', 'DDD', 'DDD'], { D: ItemType.DIAMOND }, BlockType.DIAMOND_BLOCK),
  shaped('emerald_block', ['EEE', 'EEE', 'EEE'], { E: ItemType.EMERALD }, BlockType.EMERALD_BLOCK),
  shaped('lapis_block', ['LLL', 'LLL', 'LLL'], { L: ItemType.LAPIS_LAZULI }, BlockType.LAPIS_BLOCK),
  shaped('redstone_block', ['RRR', 'RRR', 'RRR'], { R: ItemType.REDSTONE }, BlockType.REDSTONE_BLOCK),
  shaped('coal_block', ['CCC', 'CCC', 'CCC'], { C: ItemType.COAL }, BlockType.COAL_BLOCK),
  shaped('netherite_block', ['NNN', 'NNN', 'NNN'], { N: ItemType.NETHERITE_INGOT }, BlockType.NETHERITE_BLOCK),
  shaped('copper_block', ['CCC', 'CCC', 'CCC'], { C: ItemType.COPPER_INGOT }, BlockType.COPPER_BLOCK),

  // ====== INGOTS/ITEMS FROM BLOCKS ======
  shapeless('iron_from_block', [BlockType.IRON_BLOCK], ItemType.IRON_INGOT, 9),
  shapeless('gold_from_block', [BlockType.GOLD_BLOCK], ItemType.GOLD_INGOT, 9),
  shapeless('diamond_from_block', [BlockType.DIAMOND_BLOCK], ItemType.DIAMOND, 9),
  shapeless('emerald_from_block', [BlockType.EMERALD_BLOCK], ItemType.EMERALD, 9),
  shapeless('lapis_from_block', [BlockType.LAPIS_BLOCK], ItemType.LAPIS_LAZULI, 9),
  shapeless('redstone_from_block', [BlockType.REDSTONE_BLOCK], ItemType.REDSTONE, 9),
  shapeless('coal_from_block', [BlockType.COAL_BLOCK], ItemType.COAL, 9),
  shapeless('netherite_from_block', [BlockType.NETHERITE_BLOCK], ItemType.NETHERITE_INGOT, 9),
  shapeless('copper_from_block', [BlockType.COPPER_BLOCK], ItemType.COPPER_INGOT, 9),

  // ====== NUGGETS ======
  shapeless('iron_nuggets', [ItemType.IRON_INGOT], ItemType.IRON_NUGGET, 9),
  shapeless('gold_nuggets', [ItemType.GOLD_INGOT], ItemType.GOLD_NUGGET, 9),
  shaped('iron_from_nuggets', ['NNN', 'NNN', 'NNN'], { N: ItemType.IRON_NUGGET }, ItemType.IRON_INGOT),
  shaped('gold_from_nuggets', ['NNN', 'NNN', 'NNN'], { N: ItemType.GOLD_NUGGET }, ItemType.GOLD_INGOT),

  // ====== CONCRETE ======
  shapeless('white_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_WHITE], BlockType.CONCRETE_WHITE, 8),
  shapeless('orange_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_ORANGE], BlockType.CONCRETE_ORANGE, 8),
  shapeless('magenta_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_MAGENTA], BlockType.CONCRETE_MAGENTA, 8),
  shapeless('light_blue_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_LIGHT_BLUE], BlockType.CONCRETE_LIGHT_BLUE, 8),
  shapeless('yellow_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_YELLOW], BlockType.CONCRETE_YELLOW, 8),
  shapeless('lime_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_LIME], BlockType.CONCRETE_LIME, 8),
  shapeless('pink_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_PINK], BlockType.CONCRETE_PINK, 8),
  shapeless('gray_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_GRAY], BlockType.CONCRETE_GRAY, 8),
  shapeless('light_gray_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_LIGHT_GRAY], BlockType.CONCRETE_LIGHT_GRAY, 8),
  shapeless('cyan_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_CYAN], BlockType.CONCRETE_CYAN, 8),
  shapeless('purple_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_PURPLE], BlockType.CONCRETE_PURPLE, 8),
  shapeless('blue_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_BLUE], BlockType.CONCRETE_BLUE, 8),
  shapeless('brown_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_BROWN], BlockType.CONCRETE_BROWN, 8),
  shapeless('green_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_GREEN], BlockType.CONCRETE_GREEN, 8),
  shapeless('red_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_RED], BlockType.CONCRETE_RED, 8),
  shapeless('black_concrete', [BlockType.SAND, BlockType.GRAVEL, ItemType.DYE_BLACK], BlockType.CONCRETE_BLACK, 8),

  // ====== ENCHANTING & BREWING ======
  shaped('enchanting_table', [' B ', 'DOD', 'OOO'], { B: ItemType.BOOK, D: ItemType.DIAMOND, O: BlockType.OBSIDIAN }, BlockType.ENCHANTING_TABLE),
  shaped('anvil', ['III', ' I ', 'III'], { I: BlockType.IRON_BLOCK }, BlockType.ANVIL),
  shaped('brewing_stand', [' B ', 'CCC'], { B: ItemType.BLAZE_ROD, C: BlockType.COBBLESTONE }, BlockType.BREWING_STAND),
  shaped('cauldron', ['I I', 'I I', 'III'], { I: ItemType.IRON_INGOT }, BlockType.CAULDRON),

  // ====== BOATS ======
  shaped('oak_boat', ['P P', 'PPP'], { P: BlockType.OAK_PLANKS }, ItemType.OAK_BOAT),
  shaped('birch_boat', ['P P', 'PPP'], { P: BlockType.BIRCH_PLANKS }, ItemType.BIRCH_BOAT),
  shaped('spruce_boat', ['P P', 'PPP'], { P: BlockType.SPRUCE_PLANKS }, ItemType.SPRUCE_BOAT),
  shaped('jungle_boat', ['P P', 'PPP'], { P: BlockType.JUNGLE_PLANKS }, ItemType.JUNGLE_BOAT),
  shaped('acacia_boat', ['P P', 'PPP'], { P: BlockType.ACACIA_PLANKS }, ItemType.ACACIA_BOAT),
  shaped('dark_oak_boat', ['P P', 'PPP'], { P: BlockType.DARK_OAK_PLANKS }, ItemType.DARK_OAK_BOAT),

  // ====== MINECARTS ======
  shaped('minecart', ['I I', 'III'], { I: ItemType.IRON_INGOT }, ItemType.MINECART),
  shapeless('chest_minecart', [ItemType.MINECART, BlockType.CHEST], ItemType.CHEST_MINECART),
  shapeless('furnace_minecart', [ItemType.MINECART, BlockType.FURNACE], ItemType.FURNACE_MINECART),
  shapeless('tnt_minecart', [ItemType.MINECART, BlockType.TNT], ItemType.TNT_MINECART),
];

// Function to find matching recipe
export function findRecipe(grid: (BlockType | ItemType | null)[][]): Recipe | null {
  const gridHeight = grid.length;
  const gridWidth = grid[0]?.length || 0;

  for (const recipe of RECIPES) {
    if (recipe.shapeless) {
      // Check shapeless recipe
      const flatGrid = grid.flat().filter(item => item !== null);
      const flatPattern = recipe.pattern.flat().filter(item => item !== null);

      if (flatGrid.length !== flatPattern.length) continue;

      const requiredItems = flatPattern.map(key => recipe.ingredients[key!]);
      const availableItems = [...flatGrid];

      let match = true;
      for (const required of requiredItems) {
        const index = availableItems.indexOf(required);
        if (index === -1) {
          match = false;
          break;
        }
        availableItems.splice(index, 1);
      }

      if (match) return recipe;
    } else {
      // Check shaped recipe
      const patternHeight = recipe.pattern.length;
      const patternWidth = Math.max(...recipe.pattern.map(row => row.length));

      // Try all possible positions in the grid
      for (let offsetY = 0; offsetY <= gridHeight - patternHeight; offsetY++) {
        for (let offsetX = 0; offsetX <= gridWidth - patternWidth; offsetX++) {
          let match = true;

          // Check if pattern matches at this position
          for (let y = 0; y < gridHeight && match; y++) {
            for (let x = 0; x < gridWidth && match; x++) {
              const gridItem = grid[y][x];
              const patternY = y - offsetY;
              const patternX = x - offsetX;

              if (patternY >= 0 && patternY < patternHeight &&
                  patternX >= 0 && patternX < recipe.pattern[patternY].length) {
                const patternKey = recipe.pattern[patternY][patternX];
                const expectedItem = patternKey ? recipe.ingredients[patternKey] : null;

                if (gridItem !== expectedItem) {
                  match = false;
                }
              } else {
                // Outside pattern area should be empty
                if (gridItem !== null) {
                  match = false;
                }
              }
            }
          }

          if (match) return recipe;
        }
      }
    }
  }

  return null;
}

// Like `findRecipe`, but also returns which grid slots should be consumed.
export function findRecipeMatch(
  grid: (BlockType | ItemType | null)[][]
): { recipe: Recipe; consumeMask: boolean[][] } | null {
  const gridHeight = grid.length;
  const gridWidth = grid[0]?.length || 0;

  for (const recipe of RECIPES) {
    if (recipe.shapeless) {
      const flatGrid = grid.flat().filter((item) => item !== null);
      const flatPattern = recipe.pattern.flat().filter((item) => item !== null);

      if (flatGrid.length !== flatPattern.length) continue;

      const requiredItems = flatPattern.map((key) => recipe.ingredients[key!]);
      const availableItems = [...flatGrid];

      let match = true;
      for (const required of requiredItems) {
        const index = availableItems.indexOf(required);
        if (index === -1) {
          match = false;
          break;
        }
        availableItems.splice(index, 1);
      }

      if (match) {
        const consumeMask = grid.map((row) => row.map((cell) => cell !== null));
        return { recipe, consumeMask };
      }
    } else {
      const patternHeight = recipe.pattern.length;
      const patternWidth = Math.max(...recipe.pattern.map((row) => row.length));

      for (let offsetY = 0; offsetY <= gridHeight - patternHeight; offsetY++) {
        for (let offsetX = 0; offsetX <= gridWidth - patternWidth; offsetX++) {
          let match = true;
          const consumeMask = Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => false));

          for (let y = 0; y < gridHeight && match; y++) {
            for (let x = 0; x < gridWidth && match; x++) {
              const gridItem = grid[y][x];
              const patternY = y - offsetY;
              const patternX = x - offsetX;

              if (
                patternY >= 0 &&
                patternY < patternHeight &&
                patternX >= 0 &&
                patternX < recipe.pattern[patternY].length
              ) {
                const patternKey = recipe.pattern[patternY][patternX];
                const expectedItem = patternKey ? recipe.ingredients[patternKey] : null;

                if (gridItem !== expectedItem) {
                  match = false;
                } else if (gridItem !== null) {
                  consumeMask[y][x] = true;
                }
              } else {
                if (gridItem !== null) {
                  match = false;
                }
              }
            }
          }

          if (match) return { recipe, consumeMask };
        }
      }
    }
  }

  return null;
}

// Get all recipes that produce a specific item
export function getRecipesFor(item: BlockType | ItemType): Recipe[] {
  return RECIPES.filter(recipe => recipe.result.item === item);
}

// Get all recipes that use a specific item as ingredient
export function getRecipesUsing(item: BlockType | ItemType): Recipe[] {
  return RECIPES.filter(recipe =>
    Object.values(recipe.ingredients).includes(item)
  );
}
