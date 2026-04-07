import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';

// Minecraft-style 8x8 procedural texture system with detailed patterns
export class SimpleTextureSystem {
  private textureCache = new Map<string, THREE.Texture>();
  private readonly TEXTURE_SIZE = 8;

  // Get texture for a block face
  getBlockTexture(blockType: BlockType, face: 'top' | 'side' | 'bottom' = 'side'): THREE.Texture {
    const cacheKey = `${blockType}_${face}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const texture = this.generateBlockTexture(blockType, face);
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  generateBlockTexture(blockType: BlockType, face: 'top' | 'side' | 'bottom' = 'side'): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = this.TEXTURE_SIZE;
    canvas.height = this.TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    if (!ctx) {
      return this.createDefaultTexture();
    }

    // Generate the appropriate texture based on block type
    this.drawBlockTexture(ctx, blockType, face);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.format = THREE.RGBAFormat;
    texture.needsUpdate = true;

    return texture;
  }

  private drawBlockTexture(ctx: CanvasRenderingContext2D, blockType: BlockType, face: 'top' | 'side' | 'bottom'): void {
    const block = BLOCKS[blockType];
    if (!block) {
      this.drawDefaultTexture(ctx);
      return;
    }

    // Get appropriate color for face
    let baseColor = block.color;
    if (face === 'top' && block.colorTop) baseColor = block.colorTop;
    if (face === 'bottom' && block.colorBottom) baseColor = block.colorBottom;

    switch (blockType) {
      // Terrain blocks
      case BlockType.GRASS:
        if (face === 'top') this.drawGrassTop(ctx);
        else if (face === 'bottom') this.drawDirt(ctx);
        else this.drawGrassSide(ctx);
        break;
      case BlockType.DIRT:
        this.drawDirt(ctx);
        break;
      case BlockType.STONE:
        this.drawStone(ctx);
        break;
      case BlockType.COBBLESTONE:
        this.drawCobblestone(ctx);
        break;
      case BlockType.DEEPSLATE:
        this.drawDeepslate(ctx);
        break;
      case BlockType.COBBLED_DEEPSLATE:
        this.drawCobbledDeepslate(ctx);
        break;
      case BlockType.BEDROCK:
        this.drawBedrock(ctx);
        break;
      case BlockType.SAND:
        this.drawSand(ctx);
        break;
      case BlockType.GRAVEL:
        this.drawGravel(ctx);
        break;
      case BlockType.CLAY:
        this.drawSolidColor(ctx, '#9EA4B0', '#8A909C');
        break;
      case BlockType.SANDSTONE:
        if (face === 'top') this.drawSandstoneTop(ctx);
        else if (face === 'bottom') this.drawSandstoneBottom(ctx);
        else this.drawSandstoneSide(ctx);
        break;

      // Wood logs
      case BlockType.OAK_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#A08050', '#6B5839');
        else this.drawLogSide(ctx, '#6B5839', '#553D24');
        break;
      case BlockType.CHERRY_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#D9A1A0', '#B87F7C');
        else this.drawLogSide(ctx, '#C88486', '#9E5F61');
        break;
      case BlockType.BIRCH_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#C8B77C', '#A08050');
        else this.drawBirchLogSide(ctx);
        break;
      case BlockType.SPRUCE_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#6B5030', '#4A3520');
        else this.drawLogSide(ctx, '#3D2813', '#2A1A0A');
        break;
      case BlockType.JUNGLE_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#6B5A30', '#4A3A20');
        else this.drawLogSide(ctx, '#5B4525', '#3A2A15');
        break;
      case BlockType.ACACIA_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#7A5030', '#5A3520');
        else this.drawLogSide(ctx, '#6B6B6B', '#4A4A4A');
        break;
      case BlockType.DARK_OAK_LOG:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#4A3520', '#2A1A0A');
        else this.drawLogSide(ctx, '#3A2510', '#1A0A00');
        break;

      // Planks
      case BlockType.OAK_PLANKS:
        this.drawPlanks(ctx, '#BA945E', '#9A7A4E');
        break;
      case BlockType.OAK_SLAB:
      case BlockType.OAK_STAIRS:
      case BlockType.OAK_FENCE:
        this.drawPlanks(ctx, '#BA945E', '#9A7A4E');
        break;
      case BlockType.BIRCH_SLAB:
      case BlockType.BIRCH_STAIRS:
      case BlockType.BIRCH_FENCE:
        this.drawPlanks(ctx, '#D5C98E', '#C5B97E');
        break;
      case BlockType.BIRCH_PLANKS:
        this.drawPlanks(ctx, '#D5C98E', '#C5B97E');
        break;
      case BlockType.SPRUCE_PLANKS:
        this.drawPlanks(ctx, '#7A5A34', '#6A4A24');
        break;
      case BlockType.SPRUCE_SLAB:
      case BlockType.SPRUCE_STAIRS:
      case BlockType.SPRUCE_FENCE:
        this.drawPlanks(ctx, '#7A5A34', '#6A4A24');
        break;
      case BlockType.JUNGLE_PLANKS:
        this.drawPlanks(ctx, '#B08860', '#A07850');
        break;
      case BlockType.ACACIA_PLANKS:
        this.drawPlanks(ctx, '#C06030', '#A05020');
        break;
      case BlockType.DARK_OAK_PLANKS:
        this.drawPlanks(ctx, '#4A3520', '#3A2510');
        break;
      case BlockType.CRIMSON_PLANKS:
        this.drawPlanks(ctx, '#6B344A', '#5B2A3A');
        break;
      case BlockType.WARPED_PLANKS:
        this.drawPlanks(ctx, '#2B6B6B', '#1B5B5B');
        break;

      // Leaves
      case BlockType.OAK_LEAVES:
        this.drawLeaves(ctx, '#4A7A23', '#3A6A13');
        break;
      case BlockType.CHERRY_LEAVES:
        this.drawLeaves(ctx, '#F0B2CC', '#E188AE');
        break;
      case BlockType.BIRCH_LEAVES:
        this.drawLeaves(ctx, '#6B8E4E', '#5B7E3E');
        break;
      case BlockType.SPRUCE_LEAVES:
        this.drawLeaves(ctx, '#3A5A2A', '#2A4A1A');
        break;
      case BlockType.JUNGLE_LEAVES:
        this.drawLeaves(ctx, '#3A8A23', '#2A7A13');
        break;
      case BlockType.ACACIA_LEAVES:
        this.drawLeaves(ctx, '#5A9A33', '#4A8A23');
        break;
      case BlockType.DARK_OAK_LEAVES:
        this.drawLeaves(ctx, '#2A5A13', '#1A4A03');
        break;

      // Ores
      case BlockType.COAL_ORE:
        this.drawOre(ctx, '#8B8B8B', '#2A2A2A', false);
        break;
      case BlockType.IRON_ORE:
        this.drawOre(ctx, '#8B8B8B', '#C9A57C', false);
        break;
      case BlockType.COPPER_ORE:
        this.drawOre(ctx, '#8B8B8B', '#7F5840', false);
        break;
      case BlockType.GOLD_ORE:
        this.drawOre(ctx, '#8B8B8B', '#FCDB4A', false);
        break;
      case BlockType.REDSTONE_ORE:
        this.drawOre(ctx, '#8B8B8B', '#AA0000', false);
        break;
      case BlockType.LAPIS_ORE:
        this.drawOre(ctx, '#8B8B8B', '#2040A0', false);
        break;
      case BlockType.DIAMOND_ORE:
        this.drawOre(ctx, '#8B8B8B', '#5DECF5', false);
        break;
      case BlockType.EMERALD_ORE:
        this.drawOre(ctx, '#8B8B8B', '#17DD62', false);
        break;

      // Deepslate ores
      case BlockType.DEEPSLATE_COAL_ORE:
        this.drawOre(ctx, '#4A4A4F', '#2A2A2A', true);
        break;
      case BlockType.DEEPSLATE_IRON_ORE:
        this.drawOre(ctx, '#4A4A4F', '#C9A57C', true);
        break;
      case BlockType.DEEPSLATE_COPPER_ORE:
        this.drawOre(ctx, '#4A4A4F', '#7F5840', true);
        break;
      case BlockType.DEEPSLATE_GOLD_ORE:
        this.drawOre(ctx, '#4A4A4F', '#FCDB4A', true);
        break;
      case BlockType.DEEPSLATE_REDSTONE_ORE:
        this.drawOre(ctx, '#4A4A4F', '#AA0000', true);
        break;
      case BlockType.DEEPSLATE_LAPIS_ORE:
        this.drawOre(ctx, '#4A4A4F', '#2040A0', true);
        break;
      case BlockType.DEEPSLATE_DIAMOND_ORE:
        this.drawOre(ctx, '#4A4A4F', '#5DECF5', true);
        break;
      case BlockType.DEEPSLATE_EMERALD_ORE:
        this.drawOre(ctx, '#4A4A4F', '#17DD62', true);
        break;

      // Mineral blocks
      case BlockType.COAL_BLOCK:
        this.drawMineralBlock(ctx, '#2A2A2A', '#1A1A1A');
        break;
      case BlockType.IRON_BLOCK:
        this.drawMineralBlock(ctx, '#DADADA', '#C8C8C8');
        break;
      case BlockType.COPPER_BLOCK:
        this.drawMineralBlock(ctx, '#C07050', '#A06040');
        break;
      case BlockType.GOLD_BLOCK:
        this.drawMineralBlock(ctx, '#FCDB4A', '#DFC03A');
        break;
      case BlockType.REDSTONE_BLOCK:
        this.drawMineralBlock(ctx, '#AA0000', '#880000');
        break;
      case BlockType.LAPIS_BLOCK:
        this.drawMineralBlock(ctx, '#2050B0', '#1840A0');
        break;
      case BlockType.DIAMOND_BLOCK:
        this.drawMineralBlock(ctx, '#5DECF5', '#4ADCE5');
        break;
      case BlockType.EMERALD_BLOCK:
        this.drawMineralBlock(ctx, '#17DD62', '#10C050');
        break;
      case BlockType.NETHERITE_BLOCK:
        this.drawMineralBlock(ctx, '#44393A', '#34292A');
        break;

      // Glass
      case BlockType.GLASS:
        this.drawGlass(ctx);
        break;

      // Brick
      case BlockType.BRICK:
        this.drawBricks(ctx, '#9B4E3A', '#7A3A2A');
        break;
      case BlockType.NETHER_BRICK:
        this.drawBricks(ctx, '#3A1E1E', '#2A1010');
        break;
      case BlockType.STONEBRICK:
        this.drawStoneBricks(ctx, '#7A7A7A', '#6A6A6A');
        break;
      case BlockType.MOSSY_STONEBRICK:
        this.drawMossyStoneBricks(ctx);
        break;
      case BlockType.CRACKED_STONEBRICK:
        this.drawCrackedStoneBricks(ctx);
        break;

      // Wool colors
      case BlockType.WOOL_WHITE:
        this.drawWool(ctx, '#EBEBEB');
        break;
      case BlockType.WOOL_RED:
        this.drawWool(ctx, '#A12722');
        break;
      case BlockType.WOOL_BLUE:
        this.drawWool(ctx, '#2E388D');
        break;
      case BlockType.WOOL_GREEN:
        this.drawWool(ctx, '#54622E');
        break;
      case BlockType.WOOL_YELLOW:
        this.drawWool(ctx, '#F9C627');
        break;
      case BlockType.WOOL_BLACK:
        this.drawWool(ctx, '#1B1B1B');
        break;
      case BlockType.WOOL_ORANGE:
        this.drawWool(ctx, '#EA7E35');
        break;
      case BlockType.WOOL_MAGENTA:
        this.drawWool(ctx, '#BE49C9');
        break;
      case BlockType.WOOL_LIGHT_BLUE:
        this.drawWool(ctx, '#6B8AC9');
        break;
      case BlockType.WOOL_LIME:
        this.drawWool(ctx, '#41AE38');
        break;
      case BlockType.WOOL_PINK:
        this.drawWool(ctx, '#EA9E9E');
        break;
      case BlockType.WOOL_GRAY:
        this.drawWool(ctx, '#414141');
        break;
      case BlockType.WOOL_LIGHT_GRAY:
        this.drawWool(ctx, '#9D9D9D');
        break;
      case BlockType.WOOL_CYAN:
        this.drawWool(ctx, '#2E6E89');
        break;
      case BlockType.WOOL_PURPLE:
        this.drawWool(ctx, '#7E3DB5');
        break;
      case BlockType.WOOL_BROWN:
        this.drawWool(ctx, '#56331B');
        break;

      // Concrete
      case BlockType.CONCRETE_WHITE:
        this.drawConcrete(ctx, '#CFD5D6');
        break;
      case BlockType.CONCRETE_RED:
        this.drawConcrete(ctx, '#8E2121');
        break;
      case BlockType.CONCRETE_ORANGE:
        this.drawConcrete(ctx, '#E06101');
        break;
      case BlockType.CONCRETE_YELLOW:
        this.drawConcrete(ctx, '#F0AF15');
        break;
      case BlockType.CONCRETE_LIME:
        this.drawConcrete(ctx, '#5EA918');
        break;
      case BlockType.CONCRETE_BLUE:
        this.drawConcrete(ctx, '#2C2E8F');
        break;
      case BlockType.CONCRETE_CYAN:
        this.drawConcrete(ctx, '#157788');
        break;
      case BlockType.CONCRETE_PURPLE:
        this.drawConcrete(ctx, '#64209C');
        break;
      case BlockType.CONCRETE_MAGENTA:
        this.drawConcrete(ctx, '#A9309F');
        break;
      case BlockType.CONCRETE_PINK:
        this.drawConcrete(ctx, '#D5658E');
        break;
      case BlockType.CONCRETE_GRAY:
        this.drawConcrete(ctx, '#373A3E');
        break;
      case BlockType.CONCRETE_LIGHT_GRAY:
        this.drawConcrete(ctx, '#7D7D73');
        break;
      case BlockType.CONCRETE_BLACK:
        this.drawConcrete(ctx, '#080A0F');
        break;
      case BlockType.CONCRETE_BROWN:
        this.drawConcrete(ctx, '#60331B');
        break;
      case BlockType.CONCRETE_GREEN:
        this.drawConcrete(ctx, '#495B24');
        break;
      case BlockType.CONCRETE_LIGHT_BLUE:
        this.drawConcrete(ctx, '#2389C6');
        break;

      // Terracotta
      case BlockType.TERRACOTTA:
        this.drawConcrete(ctx, '#985F45');
        break;
      case BlockType.TERRACOTTA_WHITE:
        this.drawConcrete(ctx, '#D1B2A1');
        break;
      case BlockType.TERRACOTTA_RED:
        this.drawConcrete(ctx, '#8E3B2E');
        break;
      case BlockType.TERRACOTTA_ORANGE:
        this.drawConcrete(ctx, '#A15325');
        break;
      case BlockType.TERRACOTTA_YELLOW:
        this.drawConcrete(ctx, '#BA8523');
        break;
      case BlockType.TERRACOTTA_BROWN:
        this.drawConcrete(ctx, '#4D3223');
        break;
      case BlockType.TERRACOTTA_BLACK:
        this.drawConcrete(ctx, '#251610');
        break;

      // Stone variants
      case BlockType.GRANITE:
        this.drawGranite(ctx, false);
        break;
      case BlockType.POLISHED_GRANITE:
        this.drawGranite(ctx, true);
        break;
      case BlockType.DIORITE:
        this.drawDiorite(ctx, false);
        break;
      case BlockType.POLISHED_DIORITE:
        this.drawDiorite(ctx, true);
        break;
      case BlockType.ANDESITE:
        this.drawAndesite(ctx, false);
        break;
      case BlockType.POLISHED_ANDESITE:
        this.drawAndesite(ctx, true);
        break;

      // Nether blocks
      case BlockType.NETHERRACK:
        this.drawNetherrack(ctx);
        break;
      case BlockType.SOUL_SAND:
        this.drawSoulSand(ctx);
        break;
      case BlockType.GLOWSTONE:
        this.drawGlowstone(ctx);
        break;
      case BlockType.BASALT:
        if (face === 'top' || face === 'bottom') this.drawBasaltTop(ctx);
        else this.drawBasaltSide(ctx);
        break;
      case BlockType.BLACKSTONE:
        this.drawBlackstone(ctx);
        break;
      case BlockType.CRIMSON_STEM:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#6B344A', '#5B2A3A');
        else this.drawCrimsonStem(ctx);
        break;
      case BlockType.WARPED_STEM:
        if (face === 'top' || face === 'bottom') this.drawLogTop(ctx, '#2B6B6B', '#1B5B5B');
        else this.drawWarpedStem(ctx);
        break;
      case BlockType.NETHER_WART_BLOCK:
        this.drawNetherWartBlock(ctx);
        break;

      // End blocks
      case BlockType.END_STONE:
        this.drawEndStone(ctx);
        break;
      case BlockType.END_STONE_BRICKS:
        this.drawEndStoneBricks(ctx);
        break;
      case BlockType.PURPUR_BLOCK:
        this.drawPurpur(ctx);
        break;

      // Prismarine
      case BlockType.PRISMARINE:
        this.drawPrismarine(ctx);
        break;
      case BlockType.PRISMARINE_BRICKS:
        this.drawPrismarineBricks(ctx);
        break;
      case BlockType.DARK_PRISMARINE:
        this.drawDarkPrismarine(ctx);
        break;
      case BlockType.SEA_LANTERN:
        this.drawSeaLantern(ctx);
        break;

      // Special blocks
      case BlockType.OBSIDIAN:
        this.drawObsidian(ctx);
        break;
      case BlockType.CRYING_OBSIDIAN:
        this.drawCryingObsidian(ctx);
        break;
      case BlockType.TNT:
        if (face === 'top') this.drawTNTTop(ctx);
        else if (face === 'bottom') this.drawTNTBottom(ctx);
        else this.drawTNTSide(ctx);
        break;
      case BlockType.BOOKSHELF:
        if (face === 'top' || face === 'bottom') this.drawPlanks(ctx, '#BA945E', '#9A7A4E');
        else this.drawBookshelf(ctx);
        break;

      // Ice/Snow
      case BlockType.SNOW:
        this.drawSnow(ctx);
        break;
      case BlockType.ICE:
        this.drawIce(ctx);
        break;
      case BlockType.PACKED_ICE:
        this.drawPackedIce(ctx);
        break;
      case BlockType.BLUE_ICE:
        this.drawBlueIce(ctx);
        break;

      // Plants
      case BlockType.CACTUS:
        if (face === 'top') this.drawCactusTop(ctx);
        else this.drawCactusSide(ctx);
        break;
      case BlockType.DEAD_BUSH:
        this.drawDeadBush(ctx);
        break;
      case BlockType.TALL_GRASS:
        this.drawTallGrass(ctx);
        break;
      case BlockType.FLOWER_RED:
        this.drawFlower(ctx, '#FF0000');
        break;
      case BlockType.FLOWER_YELLOW:
        this.drawFlower(ctx, '#FFFF00');
        break;
      case BlockType.FLOWER_BLUE_ORCHID:
        this.drawFlower(ctx, '#00AAFF');
        break;
      case BlockType.FLOWER_ALLIUM:
        this.drawFlower(ctx, '#BB66FF');
        break;
      case BlockType.SUGAR_CANE:
        this.drawSugarCane(ctx);
        break;
      case BlockType.MUSHROOM_RED:
        this.drawMushroom(ctx, '#CC2020');
        break;
      case BlockType.MUSHROOM_BROWN:
        this.drawMushroom(ctx, '#9E7352');
        break;

      // Pumpkin/Melon
      case BlockType.PUMPKIN:
        if (face === 'top') this.drawPumpkinTop(ctx);
        else this.drawPumpkinSide(ctx);
        break;
      case BlockType.JACK_O_LANTERN:
        if (face === 'top') this.drawPumpkinTop(ctx);
        else this.drawJackOLantern(ctx);
        break;
      case BlockType.MELON:
        if (face === 'top') this.drawMelonTop(ctx);
        else this.drawMelonSide(ctx);
        break;

      // Utility blocks
      case BlockType.CRAFTING_TABLE:
        if (face === 'top') this.drawCraftingTableTop(ctx);
        else this.drawCraftingTableSide(ctx);
        break;
      case BlockType.FURNACE:
        if (face === 'top' || face === 'bottom') this.drawFurnaceTop(ctx);
        else this.drawFurnaceFront(ctx);
        break;
      case BlockType.CHEST:
        if (face === 'top' || face === 'bottom') this.drawChestTop(ctx);
        else this.drawChestFront(ctx);
        break;
      case BlockType.TORCH:
        this.drawTorch(ctx);
        break;
      case BlockType.LANTERN:
        this.drawLantern(ctx);
        break;

      // Liquids
      case BlockType.WATER:
        this.drawWater(ctx);
        break;
      case BlockType.LAVA:
        this.drawLava(ctx);
        break;

      // Moss and nature
      case BlockType.MOSS_BLOCK:
        this.drawMossBlock(ctx);
        break;
      case BlockType.MOSSY_COBBLESTONE:
        this.drawMossyCobblestone(ctx);
        break;
      case BlockType.MUD:
        this.drawMud(ctx);
        break;
      case BlockType.MUD_BRICKS:
        this.drawMudBricks(ctx);
        break;
      case BlockType.PACKED_MUD:
        this.drawPackedMud(ctx);
        break;

      // Amethyst
      case BlockType.AMETHYST_BLOCK:
        this.drawAmethystBlock(ctx);
        break;
      case BlockType.BUDDING_AMETHYST:
        this.drawBuddingAmethyst(ctx);
        break;

      // Sculk
      case BlockType.SCULK:
        this.drawSculk(ctx);
        break;
      case BlockType.SCULK_CATALYST:
        this.drawSculkCatalyst(ctx);
        break;

      // Dripstone
      case BlockType.DRIPSTONE_BLOCK:
        this.drawDripstoneBlock(ctx);
        break;
      case BlockType.CALCITE:
        this.drawCalcite(ctx);
        break;
      case BlockType.TUFF:
        this.drawTuff(ctx);
        break;

      // Froglights
      case BlockType.OCHRE_FROGLIGHT:
        this.drawFroglight(ctx, '#F5D76E');
        break;
      case BlockType.VERDANT_FROGLIGHT:
        this.drawFroglight(ctx, '#6EF5A2');
        break;
      case BlockType.PEARLESCENT_FROGLIGHT:
        this.drawFroglight(ctx, '#E56EF5');
        break;

      // Slime/Honey
      case BlockType.SLIME_BLOCK:
        this.drawSlimeBlock(ctx);
        break;
      case BlockType.HONEY_BLOCK:
        this.drawHoneyBlock(ctx);
        break;

      // Quartz
      case BlockType.QUARTZ_BLOCK:
        this.drawQuartzBlock(ctx);
        break;
      case BlockType.QUARTZ_ORE:
        this.drawQuartzOre(ctx);
        break;

      // Smooth stone
      case BlockType.SMOOTH_STONE:
        this.drawSmoothStone(ctx);
        break;

      // Sponge
      case BlockType.SPONGE:
        this.drawSponge(ctx, false);
        break;
      case BlockType.WET_SPONGE:
        this.drawSponge(ctx, true);
        break;

      // Other blocks
      case BlockType.HAY_BALE:
        if (face === 'top' || face === 'bottom') this.drawHayBaleTop(ctx);
        else this.drawHayBaleSide(ctx);
        break;
      case BlockType.BONE_BLOCK:
        if (face === 'top' || face === 'bottom') this.drawBoneBlockTop(ctx);
        else this.drawBoneBlockSide(ctx);
        break;

      // Ancient debris
      case BlockType.ANCIENT_DEBRIS:
        this.drawAncientDebris(ctx);
        break;

      default:
        // Use block color if no specific texture
        this.drawSolidColor(ctx, baseColor, this.adjustBrightness(baseColor, -20));
        break;
    }
  }

  // ============ 8x8 TEXTURE DRAWING METHODS ============

  private drawGrassTop(ctx: CanvasRenderingContext2D): void {
    // Base green
    ctx.fillStyle = '#7CBA3D';
    ctx.fillRect(0, 0, 8, 8);

    // Detailed grass pattern
    const pattern = [
      [0,0,1,0,1,0,0,1],
      [1,0,0,1,0,1,0,0],
      [0,1,0,0,1,0,1,0],
      [0,0,1,0,0,1,0,1],
      [1,0,0,1,0,0,1,0],
      [0,1,0,0,1,0,0,1],
      [0,0,1,0,0,1,0,0],
      [1,0,0,1,0,0,1,0]
    ];
    
    ctx.fillStyle = '#5D9A22';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    // Lighter highlights
    ctx.fillStyle = '#8BC84A';
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
  }

  private drawGrassSide(ctx: CanvasRenderingContext2D): void {
    // Dirt base
    this.drawDirt(ctx);

    // Green top strip with grass overhang
    ctx.fillStyle = '#7CBA3D';
    ctx.fillRect(0, 0, 8, 1);

    // Grass overhang effect - varied depths
    const overhang = [2, 1, 2, 1, 2, 1, 2, 1];
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < overhang[x]; y++) {
        ctx.fillStyle = y === 0 ? '#7CBA3D' : '#6AA82E';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private drawDirt(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0, 0, 8, 8);

    // Detailed dirt pattern
    const pattern = [
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,0,0,1],
      [0,0,1,0,1,0,0,0],
      [0,1,0,0,0,1,0,1],
      [1,0,0,1,0,0,1,0],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,0,1,0,1,0]
    ];
    
    ctx.fillStyle = '#6A3A0B';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    // Lighter spots
    ctx.fillStyle = '#9B6A3B';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 2, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(2, 6, 1, 1);
  }

  private drawStone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B8B8B';
    ctx.fillRect(0, 0, 8, 8);

    // Detailed stone pattern
    const darkPattern = [
      [0,0,1,0,0,1,0,0],
      [1,0,0,1,0,0,1,0],
      [0,1,0,0,1,0,0,1],
      [0,0,1,0,0,1,0,0],
      [1,0,0,1,0,0,1,0],
      [0,1,0,0,1,0,0,0],
      [0,0,1,0,0,0,1,0],
      [1,0,0,0,1,0,0,1]
    ];
    
    ctx.fillStyle = '#6B6B6B';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (darkPattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    // Lighter highlights
    ctx.fillStyle = '#9B9B9B';
    ctx.fillRect(2, 0, 1, 1);
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(6, 7, 1, 1);
  }

  private drawCobblestone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7A7A7A';
    ctx.fillRect(0, 0, 8, 8);

    // Stone shapes with varied colors
    const stones = [
      { x: 0, y: 0, w: 3, h: 2, c: '#6B6B6B' },
      { x: 3, y: 0, w: 3, h: 3, c: '#8A8A8A' },
      { x: 6, y: 0, w: 2, h: 2, c: '#5B5B5B' },
      { x: 0, y: 2, w: 2, h: 3, c: '#7B7B7B' },
      { x: 2, y: 3, w: 3, h: 2, c: '#9A9A9A' },
      { x: 5, y: 2, w: 3, h: 3, c: '#6A6A6A' },
      { x: 0, y: 5, w: 3, h: 3, c: '#8B8B8B' },
      { x: 3, y: 5, w: 2, h: 3, c: '#5A5A5A' },
      { x: 5, y: 5, w: 3, h: 3, c: '#7A7A7A' },
    ];

    for (const stone of stones) {
      ctx.fillStyle = stone.c;
      ctx.fillRect(stone.x, stone.y, stone.w, stone.h);
    }

    // Dark borders between stones
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(3, 0, 1, 2);
    ctx.fillRect(6, 0, 1, 2);
    ctx.fillRect(0, 2, 2, 1);
    ctx.fillRect(2, 3, 3, 1);
    ctx.fillRect(5, 2, 3, 1);
    ctx.fillRect(0, 5, 3, 1);
    ctx.fillRect(3, 5, 2, 1);
    ctx.fillRect(5, 5, 3, 1);
  }

  private drawDeepslate(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4A4A4F';
    ctx.fillRect(0, 0, 8, 8);

    // Vertical streaks
    const streaks = [0, 1, 0, 1, 0, 0, 1, 0];
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = streaks[x] ? '#3A3A3F' : '#5A5A5F';
      ctx.fillRect(x, 0, 1, 8);
    }

    // Horizontal lines
    ctx.fillStyle = '#3A3A3F';
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 5, 8, 1);
  }

  private drawCobbledDeepslate(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4A4A4F';
    ctx.fillRect(0, 0, 8, 8);

    const stones = [
      { x: 0, y: 0, w: 3, h: 2, c: '#3B3B40' },
      { x: 3, y: 0, w: 3, h: 3, c: '#5A5A5F' },
      { x: 6, y: 0, w: 2, h: 2, c: '#3A3A3F' },
      { x: 0, y: 2, w: 2, h: 3, c: '#4B4B50' },
      { x: 2, y: 3, w: 3, h: 2, c: '#5B5B60' },
      { x: 5, y: 2, w: 3, h: 3, c: '#3B3B40' },
      { x: 0, y: 5, w: 3, h: 3, c: '#4A4A4F' },
      { x: 3, y: 5, w: 2, h: 3, c: '#3A3A3F' },
      { x: 5, y: 5, w: 3, h: 3, c: '#4B4B50' },
    ];

    for (const stone of stones) {
      ctx.fillStyle = stone.c;
      ctx.fillRect(stone.x, stone.y, stone.w, stone.h);
    }
  }

  private drawBedrock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3D3D3D';
    ctx.fillRect(0, 0, 8, 8);

    // Chaotic pattern
    const pattern = [
      [1,0,1,1,0,1,0,1],
      [0,1,0,1,1,0,1,0],
      [1,1,0,0,1,1,0,1],
      [0,0,1,1,0,0,1,0],
      [1,0,1,0,1,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,1,1,1,0,1],
      [0,1,1,0,0,0,1,0]
    ];
    
    ctx.fillStyle = '#1D1D1D';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#5D5D5D';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(2, 7, 1, 1);
  }

  private drawSand(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E8D4A2';
    ctx.fillRect(0, 0, 8, 8);

    // Detailed sand texture
    const pattern = [
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,1,0,0],
      [0,0,1,0,0,0,1,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,0,1,0],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#C8B482';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#F8E4B2';
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(1, 6, 1, 1);
  }

  private drawGravel(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B8680';
    ctx.fillRect(0, 0, 8, 8);

    // Gravel stones
    const stones = [
      { x: 0, y: 0, w: 2, h: 2, c: '#7B7670' },
      { x: 2, y: 1, w: 2, h: 2, c: '#9B9690' },
      { x: 4, y: 0, w: 2, h: 2, c: '#6B6660' },
      { x: 6, y: 1, w: 2, h: 2, c: '#ABA6A0' },
      { x: 1, y: 3, w: 2, h: 2, c: '#9B9690' },
      { x: 3, y: 4, w: 2, h: 2, c: '#7B7670' },
      { x: 5, y: 3, w: 2, h: 2, c: '#ABA6A0' },
      { x: 0, y: 5, w: 2, h: 2, c: '#6B6660' },
      { x: 2, y: 6, w: 2, h: 2, c: '#9B9690' },
      { x: 5, y: 6, w: 3, h: 2, c: '#7B7670' },
    ];

    for (const stone of stones) {
      ctx.fillStyle = stone.c;
      ctx.fillRect(stone.x, stone.y, stone.w, stone.h);
    }
  }

  private drawSandstoneTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D8C896';
    ctx.fillRect(0, 0, 8, 8);

    // Smooth pattern
    ctx.fillStyle = '#C8B886';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 2, 1, 1);
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(5, 6, 1, 1);
    
    ctx.fillStyle = '#E8D8A6';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawSandstoneSide(ctx: CanvasRenderingContext2D): void {
    // Top band
    ctx.fillStyle = '#D8C896';
    ctx.fillRect(0, 0, 8, 2);

    // Main body
    ctx.fillStyle = '#C9B887';
    ctx.fillRect(0, 2, 8, 4);

    // Bottom band
    ctx.fillStyle = '#B9A877';
    ctx.fillRect(0, 6, 8, 2);

    // Horizontal lines
    ctx.fillStyle = '#A89867';
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 6, 8, 1);
  }

  private drawSandstoneBottom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C9B887';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#B9A877';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(6, 2, 1, 1);
  }

  private drawLogTop(ctx: CanvasRenderingContext2D, innerColor: string, outerColor: string): void {
    ctx.fillStyle = outerColor;
    ctx.fillRect(0, 0, 8, 8);

    // Rings
    ctx.fillStyle = innerColor;
    ctx.fillRect(1, 1, 6, 6);

    ctx.fillStyle = outerColor;
    ctx.fillRect(2, 2, 4, 4);

    ctx.fillStyle = innerColor;
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawLogSide(ctx: CanvasRenderingContext2D, barkColor: string, lineColor: string): void {
    ctx.fillStyle = barkColor;
    ctx.fillRect(0, 0, 8, 8);

    // Bark lines
    ctx.fillStyle = lineColor;
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 6, 8, 1);

    // Vertical variation
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);
  }

  private drawBirchLogSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E8E4D8';
    ctx.fillRect(0, 0, 8, 8);

    // Dark patches
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(1, 0, 2, 1);
    ctx.fillRect(5, 2, 2, 1);
    ctx.fillRect(0, 4, 1, 2);
    ctx.fillRect(3, 5, 2, 1);
    ctx.fillRect(6, 7, 2, 1);
  }

  private drawPlanks(ctx: CanvasRenderingContext2D, color1: string, color2: string): void {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 8, 8);

    // Plank lines
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 6, 8, 1);

    // Vertical divisions
    ctx.fillRect(3, 0, 1, 2);
    ctx.fillRect(1, 2, 1, 2);
    ctx.fillRect(5, 2, 1, 2);
    ctx.fillRect(3, 4, 1, 2);
    ctx.fillRect(6, 4, 1, 2);
    ctx.fillRect(2, 6, 1, 2);
    ctx.fillRect(5, 6, 1, 2);
  }

  private drawLeaves(ctx: CanvasRenderingContext2D, color1: string, color2: string): void {
    // Fill entire texture with base color - SOLID BLOCK
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 8, 8);

    // Create solid leaf pattern - no transparency, just solid color variations
    const leafColors = [color1, color2, this.adjustBrightness(color1, 20), this.adjustBrightness(color2, -15)];

    // Create a more solid, blocky leaf pattern
    const pattern = [
      [1,1,0,0,1,1,0,0],
      [1,1,0,0,1,1,0,0],
      [0,0,1,1,0,0,1,1],
      [0,0,1,1,0,0,1,1],
      [1,1,0,0,1,1,0,0],
      [1,1,0,0,1,1,0,0],
      [0,0,1,1,0,0,1,1],
      [0,0,1,1,0,0,1,1]
    ];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) {
          ctx.fillStyle = leafColors[(x + y) % 4];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Add some darker veins for texture
    ctx.fillStyle = this.adjustBrightness(color2, -30);
    ctx.fillRect(0, 1, 1, 1);
    ctx.fillRect(2, 3, 1, 1);
    ctx.fillRect(4, 5, 1, 1);
    ctx.fillRect(6, 7, 1, 1);
    ctx.fillRect(1, 6, 1, 1);
    ctx.fillRect(7, 2, 1, 1);
  }

  private drawOre(ctx: CanvasRenderingContext2D, stoneColor: string, oreColor: string, isDeepslate: boolean): void {
    // Base stone
    if (isDeepslate) {
      this.drawDeepslate(ctx);
    } else {
      this.drawStone(ctx);
    }

    // Ore spots - larger and more visible
    ctx.fillStyle = oreColor;
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(5, 0, 2, 2);
    ctx.fillRect(3, 3, 2, 2);
    ctx.fillRect(0, 5, 2, 2);
    ctx.fillRect(5, 5, 2, 2);
  }

  private drawMineralBlock(ctx: CanvasRenderingContext2D, color1: string, color2: string): void {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 8, 8);

    // Grid pattern
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 6, 8, 1);
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);

    // Highlights
    ctx.fillStyle = this.adjustBrightness(color1, 30);
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawGlass(ctx: CanvasRenderingContext2D): void {
    // Clear for transparency base
    ctx.clearRect(0, 0, 8, 8);

    // Very light tint with transparency
    ctx.fillStyle = 'rgba(192, 232, 248, 0.3)'; // Very transparent light blue
    ctx.fillRect(0, 0, 8, 8);

    // Border frame - slightly less transparent
    ctx.fillStyle = 'rgba(139, 168, 184, 0.5)';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(7, 0, 1, 8);

    // Shine - most transparent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(2, 2, 1, 1);
  }

  private drawBricks(ctx: CanvasRenderingContext2D, brickColor: string, mortarColor: string): void {
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = brickColor;
    // Row 1
    ctx.fillRect(0, 0, 3, 2);
    ctx.fillRect(4, 0, 4, 2);
    // Row 2
    ctx.fillRect(0, 3, 4, 2);
    ctx.fillRect(5, 3, 3, 2);
    // Row 3
    ctx.fillRect(0, 6, 3, 2);
    ctx.fillRect(4, 6, 4, 2);
  }

  private drawStoneBricks(ctx: CanvasRenderingContext2D, color1: string, color2: string): void {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 8, 8);

    // Brick pattern
    ctx.fillStyle = color2;
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 5, 8, 1);
    ctx.fillRect(3, 0, 1, 3);
    ctx.fillRect(1, 3, 1, 2);
    ctx.fillRect(5, 3, 1, 2);
    ctx.fillRect(3, 6, 1, 2);
  }

  private drawMossyStoneBricks(ctx: CanvasRenderingContext2D): void {
    this.drawStoneBricks(ctx, '#7A7A7A', '#6A6A6A');

    // Add moss
    ctx.fillStyle = '#4A7A23';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(1, 6, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawCrackedStoneBricks(ctx: CanvasRenderingContext2D): void {
    this.drawStoneBricks(ctx, '#7A7A7A', '#6A6A6A');

    // Add cracks
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(2, 0, 1, 2);
    ctx.fillRect(5, 3, 1, 2);
    ctx.fillRect(1, 5, 1, 2);
    ctx.fillRect(6, 6, 1, 2);
  }

  private drawWool(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, 8);

    // Fluffy texture
    const darkerColor = this.adjustBrightness(color, -20);
    ctx.fillStyle = darkerColor;
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(3, 1, 1, 1);
    ctx.fillRect(0, 2, 1, 1);
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(2, 4, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(4, 6, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawConcrete(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, 8);

    // Slight texture
    const lighterColor = this.adjustBrightness(color, 10);
    ctx.fillStyle = lighterColor;
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
  }

  private drawGranite(ctx: CanvasRenderingContext2D, polished: boolean): void {
    ctx.fillStyle = '#9A6B55';
    ctx.fillRect(0, 0, 8, 8);

    if (!polished) {
      const pattern = [
        [1,0,1,0,0,1,0,1],
        [0,1,0,1,0,0,1,0],
        [1,0,0,0,1,1,0,0],
        [0,0,1,0,0,0,1,1],
        [0,1,0,1,0,1,0,0],
        [1,0,0,0,1,0,0,1],
        [0,0,1,0,0,0,1,0],
        [1,1,0,1,0,1,0,0]
      ];
      
      ctx.fillStyle = '#7A4B35';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private drawDiorite(ctx: CanvasRenderingContext2D, polished: boolean): void {
    ctx.fillStyle = '#BFBFBF';
    ctx.fillRect(0, 0, 8, 8);

    if (!polished) {
      const pattern = [
        [1,0,0,1,0,1,0,0],
        [0,1,0,0,1,0,1,0],
        [0,0,1,0,0,1,0,1],
        [1,0,0,1,0,0,1,0],
        [0,1,0,0,1,0,0,1],
        [0,0,1,0,0,1,0,0],
        [1,0,0,1,0,0,1,0],
        [0,1,0,0,1,0,1,0]
      ];
      
      ctx.fillStyle = '#9F9F9F';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private drawAndesite(ctx: CanvasRenderingContext2D, polished: boolean): void {
    ctx.fillStyle = '#8B8B8B';
    ctx.fillRect(0, 0, 8, 8);

    if (!polished) {
      const pattern = [
        [0,1,0,0,1,0,1,0],
        [1,0,0,1,0,1,0,0],
        [0,0,1,0,0,0,0,1],
        [0,1,0,0,1,0,1,0],
        [1,0,0,1,0,0,0,1],
        [0,0,1,0,0,1,0,0],
        [0,1,0,0,1,0,0,1],
        [1,0,0,1,0,0,1,0]
      ];
      
      ctx.fillStyle = '#6B6B6B';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private drawNetherrack(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#6B2A2A';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#4B0A0A';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#7B3A3A';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawSoulSand(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5B4A35';
    ctx.fillRect(0, 0, 8, 8);

    // Face-like patterns
    ctx.fillStyle = '#3B2A15';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 1, 1, 1);
    ctx.fillRect(5, 1, 1, 1);
    ctx.fillRect(2, 3, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(3, 5, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
  }

  private drawGlowstone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B7340';
    ctx.fillRect(0, 0, 8, 8);

    // Glowing spots
    ctx.fillStyle = '#FCDB4A';
    ctx.fillRect(1, 0, 2, 2);
    ctx.fillRect(4, 2, 2, 2);
    ctx.fillRect(0, 4, 2, 2);
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillRect(2, 6, 2, 2);
    
    ctx.fillStyle = '#FFF080';
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
  }

  private drawBasaltTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(0, 0, 8, 8);

    // Concentric pattern
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillStyle = '#5A5A5A';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawBasaltSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(0, 0, 8, 8);

    // Vertical lines
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(1, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);
  }

  private drawBlackstone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2A2A2F';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#0A0A0F';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#3A3A3F';
    ctx.fillRect(2, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(1, 6, 1, 1);
  }

  private drawCrimsonStem(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#6B344A';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#5B2A3A';
    ctx.fillRect(0, 1, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
  }

  private drawWarpedStem(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2B6B6B';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#1B5B5B';
    ctx.fillRect(0, 1, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
  }

  private drawNetherWartBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7B1A1A';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#5B0000';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#8B2A2A';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawEndStone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D8D89C';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,1,0,0],
      [0,0,1,0,0,0,0,1],
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,0,0,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,0,1,0]
    ];
    
    ctx.fillStyle = '#B8B87C';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private drawEndStoneBricks(ctx: CanvasRenderingContext2D): void {
    this.drawStoneBricks(ctx, '#D8D89C', '#C8C88C');
  }

  private drawPurpur(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#A276A2';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#926692';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 6, 8, 1);
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);
  }

  private drawPrismarine(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5A9A9A';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,1,0,0],
      [0,0,1,0,0,0,0,1],
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,0,0,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,0,1,0]
    ];
    
    ctx.fillStyle = '#3A7A7A';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#6AAAAA';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawPrismarineBricks(ctx: CanvasRenderingContext2D): void {
    this.drawStoneBricks(ctx, '#5A9A9A', '#4A8A8A');
  }

  private drawDarkPrismarine(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#336A5A';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,1,0,0],
      [0,0,1,0,0,0,0,1],
      [0,1,0,0,1,0,1,0],
      [1,0,0,1,0,0,0,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,1,0,0,1],
      [1,0,0,1,0,0,1,0]
    ];
    
    ctx.fillStyle = '#1A4A3A';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private drawSeaLantern(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#AACCCC';
    ctx.fillRect(0, 0, 8, 8);

    // Glowing pattern
    ctx.fillStyle = '#DDEEFF';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(4, 1, 2, 2);
    ctx.fillRect(1, 4, 2, 2);
    ctx.fillRect(4, 4, 2, 2);
  }

  private drawObsidian(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1A0A2A';
    ctx.fillRect(0, 0, 8, 8);

    // Purple highlights
    ctx.fillStyle = '#3A2A5A';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(2, 6, 1, 1);
    ctx.fillRect(6, 7, 1, 1);
  }

  private drawCryingObsidian(ctx: CanvasRenderingContext2D): void {
    this.drawObsidian(ctx);

    // Crying effect (purple glow)
    ctx.fillStyle = '#9A4AFA';
    ctx.fillRect(0, 1, 1, 1);
    ctx.fillRect(2, 3, 1, 1);
    ctx.fillRect(4, 5, 1, 1);
    ctx.fillRect(6, 2, 1, 1);
    ctx.fillRect(7, 6, 1, 1);
  }

  private drawTNTTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 8, 8);

    // Fuse hole
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawTNTBottom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 8, 8);
  }

  private drawTNTSide(ctx: CanvasRenderingContext2D): void {
    // Red body
    ctx.fillStyle = '#CC2020';
    ctx.fillRect(0, 0, 8, 8);

    // White band
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 2, 8, 4);

    // TNT text (simplified)
    ctx.fillStyle = '#CC2020';
    ctx.fillRect(1, 3, 1, 2);
    ctx.fillRect(2, 3, 1, 1);
    ctx.fillRect(3, 3, 1, 2);
    ctx.fillRect(5, 3, 1, 2);
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(7, 3, 1, 2);
  }

  private drawBookshelf(ctx: CanvasRenderingContext2D): void {
    // Plank background
    this.drawPlanks(ctx, '#BA945E', '#9A7A4E');

    // Books
    const bookColors = ['#5A2A1A', '#1A2A5A', '#2A5A2A', '#5A1A4A'];
    ctx.fillStyle = bookColors[0];
    ctx.fillRect(0, 1, 2, 3);
    ctx.fillStyle = bookColors[1];
    ctx.fillRect(2, 1, 2, 3);
    ctx.fillStyle = bookColors[2];
    ctx.fillRect(4, 1, 2, 3);
    ctx.fillStyle = bookColors[3];
    ctx.fillRect(6, 1, 2, 3);
    
    ctx.fillStyle = bookColors[0];
    ctx.fillRect(0, 5, 2, 2);
    ctx.fillStyle = bookColors[1];
    ctx.fillRect(2, 5, 2, 2);
    ctx.fillStyle = bookColors[2];
    ctx.fillRect(4, 5, 2, 2);
    ctx.fillStyle = bookColors[3];
    ctx.fillRect(6, 5, 2, 2);
  }

  private drawSnow(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(0, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(2, 7, 1, 1);
  }

  private drawIce(ctx: CanvasRenderingContext2D): void {
    // Clear for transparency base
    ctx.clearRect(0, 0, 8, 8);

    // Semi-transparent ice base
    ctx.fillStyle = 'rgba(154, 188, 248, 0.6)'; // Light blue with transparency
    ctx.fillRect(0, 0, 8, 8);

    // Cracks - more transparent
    ctx.fillStyle = 'rgba(122, 156, 216, 0.4)';
    ctx.fillRect(1, 1, 1, 3);
    ctx.fillRect(2, 3, 2, 1);
    ctx.fillRect(5, 2, 1, 2);
    ctx.fillRect(6, 4, 1, 2);
    ctx.fillRect(3, 5, 3, 1);
  }

  private drawPackedIce(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8AACF8';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#7A9CE8';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
  }

  private drawBlueIce(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#6A8CF8';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#5A7CE8';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawCactusTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5B8B23';
    ctx.fillRect(0, 0, 8, 8);

    // Center pattern
    ctx.fillStyle = '#4B7B13';
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillStyle = '#3B6B03';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawCactusSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5B8B23';
    ctx.fillRect(0, 0, 8, 8);

    // Spines
    ctx.fillStyle = '#8BBB53';
    ctx.fillRect(0, 1, 1, 1);
    ctx.fillRect(7, 2, 1, 1);
    ctx.fillRect(0, 4, 1, 1);
    ctx.fillRect(7, 5, 1, 1);
    ctx.fillRect(0, 7, 1, 1);

    // Vertical lines
    ctx.fillStyle = '#4B7B13';
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);
  }

  private drawDeadBush(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    ctx.fillStyle = '#8E6A3A';
    ctx.fillRect(1, 5, 2, 1);
    ctx.fillRect(2, 3, 1, 3);
    ctx.fillRect(4, 4, 2, 1);
    ctx.fillRect(5, 2, 1, 4);
    ctx.fillRect(0, 4, 1, 2);
    ctx.fillRect(6, 5, 2, 1);
  }

  private drawTallGrass(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Grass blades
    ctx.fillStyle = '#5B8B23';
    ctx.fillRect(0, 2, 1, 6);
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(4, 1, 1, 7);
    ctx.fillRect(6, 3, 1, 5);
    ctx.fillRect(7, 0, 1, 8);
  }

  private drawFlower(ctx: CanvasRenderingContext2D, petalColor: string): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Stem
    ctx.fillStyle = '#5B8B23';
    ctx.fillRect(3, 4, 2, 4);

    // Flower center
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(3, 2, 2, 2);

    // Petals
    ctx.fillStyle = petalColor;
    ctx.fillRect(2, 2, 1, 2);
    ctx.fillRect(5, 2, 1, 2);
    ctx.fillRect(3, 1, 2, 1);
    ctx.fillRect(3, 4, 2, 1);
  }

  private drawSugarCane(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Cane stalks
    ctx.fillStyle = '#6BAB53';
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);

    // Joints
    ctx.fillStyle = '#5B9B43';
    ctx.fillRect(2, 2, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(5, 1, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(5, 7, 1, 1);
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, capColor: string): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Stem
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(3, 4, 2, 4);

    // Cap
    ctx.fillStyle = capColor;
    ctx.fillRect(2, 2, 4, 2);
    ctx.fillRect(1, 3, 6, 1);
  }

  private drawPumpkinTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C77520';
    ctx.fillRect(0, 0, 8, 8);

    // Stem
    ctx.fillStyle = '#5B4020';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawPumpkinSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C77520';
    ctx.fillRect(0, 0, 8, 8);

    // Vertical segments
    ctx.fillStyle = '#A76510';
    ctx.fillRect(1, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);
  }

  private drawJackOLantern(ctx: CanvasRenderingContext2D): void {
    this.drawPumpkinSide(ctx);

    // Face (glowing)
    ctx.fillStyle = '#FFCC00';
    // Eyes
    ctx.fillRect(1, 2, 2, 2);
    ctx.fillRect(5, 2, 2, 2);
    // Mouth
    ctx.fillRect(2, 5, 4, 1);
    ctx.fillRect(1, 6, 1, 1);
    ctx.fillRect(3, 6, 1, 1);
    ctx.fillRect(5, 6, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
  }

  private drawMelonTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8BAB53';
    ctx.fillRect(0, 0, 8, 8);

    // Segments
    ctx.fillStyle = '#6B8B33';
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(3, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);
  }

  private drawMelonSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8BAB53';
    ctx.fillRect(0, 0, 8, 8);

    // Stripes
    ctx.fillStyle = '#6B8B33';
    ctx.fillRect(1, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);
  }

  private drawCraftingTableTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#BA945E';
    ctx.fillRect(0, 0, 8, 8);

    // Grid
    ctx.fillStyle = '#6A4A2E';
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 5, 8, 1);
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);
  }

  private drawCraftingTableSide(ctx: CanvasRenderingContext2D): void {
    this.drawPlanks(ctx, '#BA945E', '#9A7A4E');

    // Tool designs
    ctx.fillStyle = '#8B8B8B';
    // Saw pattern
    ctx.fillRect(1, 2, 2, 1);
    ctx.fillRect(1, 3, 1, 2);

    // Hammer pattern
    ctx.fillRect(5, 1, 2, 1);
    ctx.fillRect(5, 2, 1, 3);
  }

  private drawFurnaceTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#6B6B6B';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#5B5B5B';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
  }

  private drawFurnaceFront(ctx: CanvasRenderingContext2D): void {
    this.drawStone(ctx);

    // Front face (darker)
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(2, 2, 4, 4);

    // Grate
    ctx.fillStyle = '#2A2A2A';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawChestTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#6B4A1B';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(7, 0, 1, 8);
  }

  private drawChestFront(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0, 0, 8, 8);

    // Lock
    ctx.fillStyle = '#2A2A2A';
    ctx.fillRect(3, 2, 2, 2);

    // Border
    ctx.fillStyle = '#6B4A1B';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(7, 0, 1, 8);
  }

  private drawTorch(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Stick
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(3, 3, 2, 5);

    // Flame
    ctx.fillStyle = '#FCDB4A';
    ctx.fillRect(2, 1, 4, 2);
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(3, 2, 2, 1);
  }

  private drawLantern(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 8, 8);

    // Frame
    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(2, 1, 4, 1);
    ctx.fillRect(2, 6, 4, 1);
    ctx.fillRect(2, 1, 1, 6);
    ctx.fillRect(5, 1, 1, 6);

    // Glass/light
    ctx.fillStyle = '#FCDB4A';
    ctx.fillRect(3, 2, 2, 4);

    // Handle
    ctx.fillRect(3, 0, 2, 1);
  }

  private drawWater(ctx: CanvasRenderingContext2D): void {
    // Clear for complete transparency
    ctx.clearRect(0, 0, 8, 8);

    // Very subtle water tint - almost completely transparent
    ctx.fillStyle = 'rgba(135, 206, 250, 0.15)'; // Very light sky blue, almost transparent
    ctx.fillRect(0, 0, 8, 8);

    // Minimal wave pattern - very subtle to prevent texture overriding
    ctx.fillStyle = 'rgba(70, 130, 180, 0.1)'; // Even more transparent steel blue
    
    // Simple horizontal wave pattern that connects across blocks
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 5, 8, 1);
    
    // Very subtle highlights
    ctx.fillStyle = 'rgba(173, 216, 230, 0.2)'; // Light blue highlights
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 7, 8, 1);
  }

  private drawLava(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D96415';
    ctx.fillRect(0, 0, 8, 8);

    // Bright spots
    ctx.fillStyle = '#FC9615';
    ctx.fillRect(1, 0, 2, 1);
    ctx.fillRect(4, 2, 2, 1);
    ctx.fillRect(0, 4, 2, 1);
    ctx.fillRect(5, 5, 2, 1);
    ctx.fillRect(2, 7, 2, 1);

    // Dark spots
    ctx.fillStyle = '#A94405';
    ctx.fillRect(3, 1, 1, 1);
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(4, 6, 1, 1);
  }

  private drawMossBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5B8B33';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#3B6B13';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#6B9B43';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawMossyCobblestone(ctx: CanvasRenderingContext2D): void {
    this.drawCobblestone(ctx);

    // Add moss
    ctx.fillStyle = '#4A7A23';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(1, 6, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawMud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3B3530';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#1B1510';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#4B4540';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawMudBricks(ctx: CanvasRenderingContext2D): void {
    this.drawBricks(ctx, '#5B5045', '#3B3025');
  }

  private drawPackedMud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B7560';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#7B6550';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawAmethystBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B5DBB';
    ctx.fillRect(0, 0, 8, 8);

    // Crystal facets
    ctx.fillStyle = '#AB7DDB';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(4, 2, 2, 2);
    ctx.fillRect(2, 4, 2, 2);
    ctx.fillRect(5, 5, 2, 2);
  }

  private drawBuddingAmethyst(ctx: CanvasRenderingContext2D): void {
    this.drawAmethystBlock(ctx);

    // Cross pattern
    ctx.fillStyle = '#2B1D3B';
    ctx.fillRect(3, 0, 2, 8);
    ctx.fillRect(0, 3, 8, 2);
  }

  private drawSculk(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0A1A1F';
    ctx.fillRect(0, 0, 8, 8);

    // Teal speckles
    ctx.fillStyle = '#0A4A5A';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(0, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(2, 7, 1, 1);
  }

  private drawSculkCatalyst(ctx: CanvasRenderingContext2D): void {
    this.drawSculk(ctx);

    // Bloom pattern
    ctx.fillStyle = '#2AAAAA';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawDripstoneBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B7B6B';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#6B5B4B';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    
    ctx.fillStyle = '#9B8B7B';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 3, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  }

  private drawCalcite(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E0E0D8';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#D0D0C8';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawTuff(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#6B6B60';
    ctx.fillRect(0, 0, 8, 8);

    const pattern = [
      [1,0,1,0,0,1,0,1],
      [0,1,0,1,0,0,1,0],
      [1,0,0,0,1,1,0,0],
      [0,0,1,0,0,0,1,1],
      [0,1,0,1,0,1,0,0],
      [1,0,0,0,1,0,0,1],
      [0,0,1,0,0,0,1,0],
      [1,1,0,1,0,1,0,0]
    ];
    
    ctx.fillStyle = '#4B4B40';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private drawFroglight(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, 8);

    // Lighter center glow
    ctx.fillStyle = this.adjustBrightness(color, 40);
    ctx.fillRect(2, 2, 4, 4);

    ctx.fillStyle = this.adjustBrightness(color, 60);
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawSlimeBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7EBD42';
    ctx.fillRect(0, 0, 8, 8);

    // Inner circle
    ctx.fillStyle = '#6EAD32';
    ctx.fillRect(2, 2, 4, 4);

    ctx.fillStyle = '#5E9D22';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawHoneyBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#EB9D34';
    ctx.fillRect(0, 0, 8, 8);

    // Inner pattern
    ctx.fillStyle = '#DB8D24';
    ctx.fillRect(2, 2, 4, 4);

    ctx.fillStyle = '#CB7D14';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawQuartzBlock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#EBE7E0';
    ctx.fillRect(0, 0, 8, 8);

    ctx.fillStyle = '#DBD7D0';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawQuartzOre(ctx: CanvasRenderingContext2D): void {
    this.drawNetherrack(ctx);

    // Quartz spots
    ctx.fillStyle = '#EBE7E0';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(5, 3, 2, 2);
    ctx.fillRect(2, 5, 2, 2);
    ctx.fillRect(0, 0, 2, 1);
  }

  private drawSmoothStone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#9A9A9A';
    ctx.fillRect(0, 0, 8, 8);

    // Horizontal line
    ctx.fillStyle = '#8A8A8A';
    ctx.fillRect(0, 3, 8, 2);
  }

  private drawSponge(ctx: CanvasRenderingContext2D, wet: boolean): void {
    const baseColor = wet ? '#A8A838' : '#C8C858';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 8, 8);

    // Holes
    ctx.fillStyle = wet ? '#585820' : '#989828';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 1, 1, 1);
    ctx.fillRect(0, 4, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(4, 4, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(1, 7, 1, 1);
    ctx.fillRect(5, 7, 1, 1);
    ctx.fillRect(7, 3, 1, 1);
  }

  private drawHayBaleTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#B89838';
    ctx.fillRect(0, 0, 8, 8);

    // Binding
    ctx.fillStyle = '#8B3030';
    ctx.fillRect(0, 3, 8, 2);
    ctx.fillRect(3, 0, 2, 8);
  }

  private drawHayBaleSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#B89838';
    ctx.fillRect(0, 0, 8, 8);

    // Straw texture
    ctx.fillStyle = '#A88828';
    ctx.fillRect(0, 0, 1, 8);
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(4, 0, 1, 8);
    ctx.fillRect(6, 0, 1, 8);

    // Binding
    ctx.fillStyle = '#8B3030';
    ctx.fillRect(0, 1, 8, 2);
    ctx.fillRect(0, 5, 8, 2);
  }

  private drawBoneBlockTop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E0DED0';
    ctx.fillRect(0, 0, 8, 8);

    // Concentric pattern
    ctx.fillStyle = '#C0BEB0';
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillStyle = '#E0DED0';
    ctx.fillRect(3, 3, 2, 2);
  }

  private drawBoneBlockSide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E0DED0';
    ctx.fillRect(0, 0, 8, 8);

    // Vertical stripes
    ctx.fillStyle = '#C0BEB0';
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);
  }

  private drawAncientDebris(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#5B4840';
    ctx.fillRect(0, 0, 8, 8);

    // Texture variation
    ctx.fillStyle = '#4B3830';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillRect(3, 2, 1, 1);
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(0, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(2, 7, 1, 1);

    // Highlight spots
    ctx.fillStyle = '#7B6860';
    ctx.fillRect(2, 1, 1, 1);
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(6, 7, 1, 1);
  }

  private drawSolidColor(ctx: CanvasRenderingContext2D, color1: string, color2: string): void {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 8, 8);

    // Slight texture
    ctx.fillStyle = color2;
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
  }

  private drawDefaultTexture(ctx: CanvasRenderingContext2D): void {
    // Magenta/black checkerboard (missing texture)
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 4, 4);
    ctx.fillRect(4, 4, 4, 4);
  }

  private createDefaultTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    this.drawDefaultTexture(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }

  // Utility functions
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return Math.floor((x - Math.floor(x)) * 8);
  }

  private adjustBrightness(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  clearCache(): void {
    this.textureCache.clear();
  }
}

export const simpleTextureSystem = new SimpleTextureSystem();
