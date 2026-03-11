import * as THREE from 'three';
import { ItemType, ITEMS } from './items';
import { BlockType, BLOCKS } from './blocks';
import { simpleTextureSystem } from './simpleTextures';

export interface ItemTexture {
  texture: THREE.Texture;
  canvas: HTMLCanvasElement;
}

// Improved Minecraft-style item texture generator with WebGL state preservation
export class ItemTextureGenerator {
  private textureCache = new Map<string, ItemTexture>();
  private readonly SIZE = 64;
  private canvasContexts: Map<string, CanvasRenderingContext2D> = new Map();

  generateItemTexture(item: BlockType | ItemType): ItemTexture {
    const cacheKey = typeof item === 'number' ? `block_${item}` : `item_${item}`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    // Create canvas with preserved WebGL context
    const canvas = document.createElement('canvas');
    canvas.width = this.SIZE;
    canvas.height = this.SIZE;
    
    // Get or create 2D context with WebGL state preservation
    const contextKey = `${cacheKey}_ctx`;
    let ctx = this.canvasContexts.get(contextKey);
    
    if (!ctx) {
      ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true, // Better performance for frequent updates
        willReadFrequently: false
      })!;
      this.canvasContexts.set(contextKey, ctx);
    }

    // Clear canvas before drawing
    ctx.clearRect(0, 0, this.SIZE, this.SIZE);
    
    // Draw the item texture
    this.drawItem(ctx, item);

    // Create texture with proper WebGL state management
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    
    // Preserve WebGL state by setting proper texture parameters
    texture.anisotropy = 1; // Disable anisotropy for UI textures
    texture.premultiplyAlpha = false;
    texture.flipY = false;

    const itemTexture: ItemTexture = { texture, canvas };
    this.textureCache.set(cacheKey, itemTexture);
    return itemTexture;
  }

  private drawItem(ctx: CanvasRenderingContext2D, item: BlockType | ItemType): void {
    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.SIZE, this.SIZE);

    // Draw item-specific texture
    if (typeof item === 'number') {
      this.drawBlockItem(ctx, item);
    } else {
      this.drawItemType(ctx, item);
    }
  }

  private drawBlockItem(ctx: CanvasRenderingContext2D, blockType: BlockType): void {
    // Use the simple texture system for consistency
    const blockTexture = simpleTextureSystem.getBlockTexture(blockType, 'side');
    
    // Draw the block texture scaled to item size
    const patternCanvas = (blockTexture.image as HTMLCanvasElement);
    if (patternCanvas) {
      ctx.drawImage(patternCanvas, 0, 0, this.SIZE, this.SIZE);
    } else {
      // Fallback solid color
      const color = this.getBlockColor(blockType);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, this.SIZE, this.SIZE);
    }
  }

  private drawItemType(ctx: CanvasRenderingContext2D, itemType: ItemType): void {
    // Draw item-specific textures
    switch (itemType) {
      case ItemType.WOODEN_PICKAXE:
      case ItemType.STONE_PICKAXE:
      case ItemType.IRON_PICKAXE:
      case ItemType.DIAMOND_PICKAXE:
        this.drawTool(ctx, itemType, '#8B4513');
        break;
      case ItemType.WOODEN_AXE:
      case ItemType.STONE_AXE:
      case ItemType.IRON_AXE:
      case ItemType.DIAMOND_AXE:
        this.drawTool(ctx, itemType, '#8B4513');
        break;
      case ItemType.WOODEN_SWORD:
      case ItemType.STONE_SWORD:
      case ItemType.IRON_SWORD:
      case ItemType.DIAMOND_SWORD:
        this.drawSword(ctx, itemType);
        break;
      case ItemType.APPLE:
        this.drawApple(ctx);
        break;
      case ItemType.BREAD:
        this.drawBread(ctx);
        break;
      case ItemType.COOKED_BEEF:
        this.drawCookedBeef(ctx);
        break;
      case ItemType.COOKED_PORKCHOP:
        this.drawCookedPorkchop(ctx);
        break;
      case ItemType.COOKED_CHICKEN:
        this.drawCookedChicken(ctx);
        break;
      case ItemType.COOKED_MUTTON:
        this.drawCookedMutton(ctx);
        break;
      case ItemType.COOKED_RABBIT:
        this.drawCookedRabbit(ctx);
        break;
      case ItemType.COOKED_SALMON:
        this.drawCookedSalmon(ctx);
        break;
      case ItemType.RAW_COD:
        this.drawRawFish(ctx);
        break;
      case ItemType.COOKED_COD:
        this.drawCookedFish(ctx);
        break;
      case ItemType.TROPICAL_FISH:
        this.drawTropicalFish(ctx);
        break;
      case ItemType.PUFFERFISH:
        this.drawPufferfish(ctx);
        break;
      case ItemType.MELON_SLICE:
        this.drawMelonSlice(ctx);
        break;
      case ItemType.COOKIE:
        this.drawCookie(ctx);
        break;
      case ItemType.CAKE:
        this.drawCake(ctx);
        break;
      case ItemType.PUMPKIN_PIE:
        this.drawPumpkinPie(ctx);
        break;
      case ItemType.GOLDEN_CARROT:
        this.drawGoldenCarrot(ctx);
        break;
      case ItemType.SWEET_BERRIES:
        this.drawSweetBerries(ctx);
        break;
      case ItemType.GLOW_BERRIES:
        this.drawGlowBerries(ctx);
        break;
      case ItemType.HONEY_BOTTLE:
        this.drawHoneyBottle(ctx);
        break;
      case ItemType.DRIED_KELP:
        this.drawDriedKelp(ctx);
        break;
      case ItemType.CHORUS_FRUIT:
        this.drawChorusFruit(ctx);
        break;
      case ItemType.BOW:
        this.drawBow(ctx);
        break;
      case ItemType.ARROW:
        this.drawArrow(ctx);
        break;
      case ItemType.BUCKET:
        this.drawBucket(ctx);
        break;
      case ItemType.WATER_BUCKET:
        this.drawWaterBucket(ctx);
        break;
      case ItemType.LAVA_BUCKET:
        this.drawLavaBucket(ctx);
        break;
      case ItemType.MILK_BUCKET:
        this.drawMilkBucket(ctx);
        break;
      case ItemType.BOOK:
        this.drawBook(ctx);
        break;
      case ItemType.ENCHANTED_BOOK:
        this.drawEnchantedBook(ctx);
        break;
      case ItemType.BED:
        this.drawBed(ctx);
        break;
      case ItemType.COAL:
        this.drawCoal(ctx);
        break;
      case ItemType.IRON_INGOT:
        this.drawIronIngot(ctx);
        break;
      case ItemType.GOLD_INGOT:
        this.drawGoldIngot(ctx);
        break;
      case ItemType.DIAMOND:
        this.drawDiamond(ctx);
        break;
      case ItemType.EMERALD:
        this.drawEmerald(ctx);
        break;
      case ItemType.REDSTONE:
        this.drawRedstone(ctx);
        break;
      case ItemType.LAPIS_LAZULI:
        this.drawLapisLazuli(ctx);
        break;
      case ItemType.QUARTZ:
        this.drawQuartz(ctx);
        break;
      case ItemType.NETHER_STAR:
        this.drawNetherStar(ctx);
        break;
      case ItemType.POTION:
        this.drawPotion(ctx);
        break;
      case ItemType.GLASS_BOTTLE:
        this.drawGlassBottle(ctx);
        break;
      case ItemType.PAPER:
        this.drawPaper(ctx);
        break;
      case ItemType.BOOK_AND_QUILL:
        this.drawBookAndQuill(ctx);
        break;
      case ItemType.MAP:
        this.drawMap(ctx);
        break;
      case ItemType.COMPASS:
        this.drawCompass(ctx);
        break;
      case ItemType.CLOCK:
        this.drawClock(ctx);
        break;
      case ItemType.FIREWORK_ROCKET:
        this.drawFireworkRocket(ctx);
        break;
      case ItemType.FIREWORK_STAR:
        this.drawFireworkStar(ctx);
        break;
      case ItemType.NAME_TAG:
        this.drawNameTag(ctx);
        break;
      case ItemType.LEAD:
        this.drawLead(ctx);
        break;
      case ItemType.FISHING_ROD:
        this.drawFishingRod(ctx);
        break;
      case ItemType.SHEARS:
        this.drawShears(ctx);
        break;
      case ItemType.FLINT_AND_STEEL:
        this.drawFlintAndSteel(ctx);
        break;
      case ItemType.BONE:
        this.drawBone(ctx);
        break;
      case ItemType.STRING:
        this.drawString(ctx);
        break;
      case ItemType.WHEAT_SEEDS:
        this.drawWheatSeeds(ctx);
        break;
      case ItemType.WHEAT:
        this.drawWheat(ctx);
        break;
      case ItemType.PUMPKIN_SEEDS:
        this.drawPumpkinSeeds(ctx);
        break;
      case ItemType.MELON_SEEDS:
        this.drawMelonSeeds(ctx);
        break;
      case ItemType.BEETROOT_SEEDS:
        this.drawBeetrootSeeds(ctx);
        break;
      case ItemType.BEETROOT:
        this.drawBeetroot(ctx);
        break;
      case ItemType.BEETROOT_SOUP:
        this.drawBeetrootSoup(ctx);
        break;
      case ItemType.MUSHROOM_STEW:
        this.drawMushroomStew(ctx);
        break;
      case ItemType.RABBIT_STEW:
        this.drawRabbitStew(ctx);
        break;
      case ItemType.RABBIT_FOOT:
        this.drawRabbitFoot(ctx);
        break;
      case ItemType.RABBIT_HIDE:
        this.drawRabbitHide(ctx);
        break;
      case ItemType.ROTTEN_FLESH:
        this.drawRottenFlesh(ctx);
        break;
      case ItemType.SPIDER_EYE:
        this.drawSpiderEye(ctx);
        break;
      case ItemType.GHAST_TEAR:
        this.drawGhastTear(ctx);
        break;
      case ItemType.BLAZE_ROD:
        this.drawBlazeRod(ctx);
        break;
      case ItemType.NETHER_WART:
        this.drawNetherWart(ctx);
        break;
      case ItemType.MAGMA_CREAM:
        this.drawMagmaCream(ctx);
        break;
      case ItemType.GOLDEN_APPLE:
        this.drawGoldenApple(ctx);
        break;
      case ItemType.ENCHANTED_GOLDEN_APPLE:
        this.drawEnchantedGoldenApple(ctx);
        break;
      case ItemType.CARROT:
        this.drawCarrot(ctx);
        break;
      case ItemType.POTATO:
        this.drawPotato(ctx);
        break;
      case ItemType.BAKED_POTATO:
        this.drawBakedPotato(ctx);
        break;
      case ItemType.POISONOUS_POTATO:
        this.drawPoisonousPotato(ctx);
        break;
      default:
        this.drawDefaultItem(ctx, itemType);
        break;
    }
  }

  // Basic drawing methods for common items
  private drawTool(ctx: CanvasRenderingContext2D, itemType: ItemType, color: string): void {
    // Draw handle
    ctx.fillStyle = color;
    ctx.fillRect(8, 8, 48, 16);
    
    // Draw head
    ctx.fillStyle = '#A0A0A0'; // Default stone color
    ctx.fillRect(8, 24, 48, 32);
  }

  private drawSword(ctx: CanvasRenderingContext2D, itemType: ItemType): void {
    // Draw handle
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(24, 8, 16, 24);
    
    // Draw blade
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(20, 32, 24, 32);
  }

  private drawApple(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(32, 8, 4, 16);
  }

  private drawBread(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(8, 24, 48, 16);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 40, 48, 8);
  }

  private drawCookedBeef(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawCookedPorkchop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFB6C1';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawCookedChicken(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawCookedMutton(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawCookedRabbit(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawCookedSalmon(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 48, 32, 8);
  }

  private drawBow(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(56, 56);
    ctx.stroke();
  }

  private drawArrow(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 8, 48, 8);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(56, 8, 8, 48);
  }

  private drawBucket(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawWaterBucket(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0000FF';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawLavaBucket(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawMilkBucket(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawBook(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawEnchantedBook(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawBed(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawCoal(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawIronIngot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawGoldIngot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawDiamond(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawEmerald(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawRedstone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawLapisLazuli(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0000FF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawQuartz(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawNetherStar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawPotion(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawGlassBottle(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawPaper(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawBookAndQuill(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawMap(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawCompass(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawClock(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawFireworkRocket(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawFireworkStar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawNameTag(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawLead(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawFishingRod(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawShears(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawFlintAndSteel(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawBone(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFDE8';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawString(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawWheatSeeds(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7DBD4A';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawWheat(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D4A84B';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawPumpkinSeeds(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7DBD4A';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawMelonSeeds(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7DBD4A';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawBeetrootSeeds(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#7DBD4A';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawBeetroot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawBeetrootSoup(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawMushroomStew(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawRabbitStew(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawRabbitFoot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawRabbitHide(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawRottenFlesh(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawSpiderEye(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(32, 32, 4, 4);
  }

  private drawGhastTear(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(32, 32, 4, 4);
  }

  private drawBlazeRod(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawNetherWart(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawMagmaCream(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawGoldenApple(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(32, 8, 4, 16);
  }

  private drawEnchantedGoldenApple(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(32, 8, 4, 16);
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawCarrot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(32, 8, 4, 16);
  }

  private drawPotato(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBakedPotato(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPoisonousPotato(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#00FF00';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(28, 28, 8, 8);
  }

  private drawRawFish(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#B8A090';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawCookedFish(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawTropicalFish(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E0A050';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawPufferfish(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#E8C050';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawMelonSlice(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawCookie(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 20, 4, 4);
    ctx.fillRect(28, 20, 4, 4);
    ctx.fillRect(36, 20, 4, 4);
    ctx.fillRect(20, 28, 4, 4);
    ctx.fillRect(28, 28, 4, 4);
    ctx.fillRect(36, 28, 4, 4);
    ctx.fillRect(20, 36, 4, 4);
    ctx.fillRect(28, 36, 4, 4);
    ctx.fillRect(36, 36, 4, 4);
  }

  private drawCake(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(8, 24, 48, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 24, 48, 8);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 24, 48, 32);
  }

  private drawPumpkinPie(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawGoldenCarrot(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(32, 8, 4, 16);
  }

  private drawSweetBerries(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#C03030';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawGlowBerries(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFA530';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawHoneyBottle(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#F9B233';
    ctx.fillRect(16, 16, 32, 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 32, 32);
  }

  private drawDriedKelp(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3A4A27';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawChorusFruit(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFB7C5';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
  }

  private drawDefaultItem(ctx: CanvasRenderingContext2D, itemType: ItemType): void {
    // Draw magenta/black checkerboard (missing texture)
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(0, 0, this.SIZE, this.SIZE);
    
    for (let y = 0; y < this.SIZE; y += 8) {
      for (let x = 0; x < this.SIZE; x += 8) {
        if ((x + y) % 16 === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }
  }

  private getBlockColor(blockType: BlockType): string {
    // Use the simple block color system for consistency
    return '#8B4513'; // Default brown
  }

  clearCache(): void {
    this.textureCache.forEach(({ texture }) => {
      texture.dispose();
    });
    this.canvasContexts.clear();
    this.textureCache.clear();
  }
}

export const itemTextureGenerator = new ItemTextureGenerator();
