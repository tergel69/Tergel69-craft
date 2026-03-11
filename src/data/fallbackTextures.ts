import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';
import { staticTextureGenerator } from './staticTextures';

// Create a comprehensive fallback texture system using canvas
export class FallbackTextureGenerator {
  private textureCache = new Map<BlockType, THREE.Texture>();

  generateBlockTexture(blockType: BlockType, face: number = 0): THREE.Texture {
    const cacheKey = `${blockType}_${face}`;
    const cachedTexture = this.textureCache.get(blockType);
    
    if (cachedTexture) {
      return cachedTexture;
    }

    const block = BLOCKS[blockType];
    if (!block) {
      return this.createDefaultTexture();
    }

    // Use simple colored texture instead of complex static textures
    const texture = this.createSimpleColorTexture(blockType, face);

    this.textureCache.set(blockType, texture);
    return texture;
  }

  private createSimpleColorTexture(blockType: BlockType, face: number = 0): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return this.createDefaultTexture();
    }

    // Get 4-bit color for the block
    const color = this.get4BitColor(blockType, face);
    
    // Fill with solid color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);

    // Add simple pixel pattern for variety
    ctx.fillStyle = this.get4BitHighlightColor(blockType);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 64);
      const y = Math.floor(Math.random() * 64);
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;

    return texture;
  }

  private get4BitColor(blockType: BlockType, face: number = 0): string {
    // 4-bit colors (limited palette)
    switch (blockType) {
      case BlockType.GRASS:
        if (face === 0) return '#55FF55'; // Bright green top
        return '#558855'; // Darker green sides
      case BlockType.DIRT:
        return '#885522'; // Brown
      case BlockType.STONE:
        return '#888888'; // Gray
      case BlockType.COBBLESTONE:
        return '#666666'; // Darker gray
      case BlockType.SAND:
        return '#FFCC66'; // Yellow
      case BlockType.WATER:
        return '#3366FF'; // Blue
      case BlockType.LAVA:
        return '#FF4400'; // Red-orange
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG:
        return '#884400'; // Wood brown
      case BlockType.OAK_PLANKS:
      case BlockType.BIRCH_PLANKS:
      case BlockType.SPRUCE_PLANKS:
      case BlockType.JUNGLE_PLANKS:
      case BlockType.ACACIA_PLANKS:
      case BlockType.DARK_OAK_PLANKS:
        return '#AA6600'; // Plank color
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES:
        return '#33AA33'; // Leaf green
      case BlockType.GLASS:
        return '#66CCFF'; // Light blue
      case BlockType.COAL_ORE:
        return '#222222'; // Black
      case BlockType.IRON_ORE:
        return '#777777'; // Iron gray
      case BlockType.GOLD_ORE:
        return '#FFCC00'; // Gold yellow
      case BlockType.DIAMOND_ORE:
        return '#00FFFF'; // Cyan
      case BlockType.REDSTONE_ORE:
        return '#FF0000'; // Red
      case BlockType.LAPIS_ORE:
        return '#3333FF'; // Blue
      case BlockType.EMERALD_ORE:
        return '#00FF00'; // Green
      case BlockType.COPPER_ORE:
        return '#CC8844'; // Copper
      case BlockType.DEEPSLATE:
        return '#333333'; // Dark gray
      case BlockType.SANDSTONE:
        return '#DDAA66'; // Sandstone yellow
      case BlockType.BEDROCK:
        return '#111111'; // Very dark gray
      case BlockType.GRAVEL:
        return '#555555'; // Medium gray
      case BlockType.CLAY:
        return '#996633'; // Clay brown
      case BlockType.TALL_GRASS:
        return '#66FF66'; // Bright green
      case BlockType.FLOWER_RED:
        return '#FF5555'; // Red
      case BlockType.FLOWER_YELLOW:
        return '#FFFF55'; // Yellow
      case BlockType.CACTUS:
        return '#338833'; // Cactus green
      case BlockType.SUGAR_CANE:
        return '#44AA44'; // Cane green
      case BlockType.PUMPKIN:
        return '#FF8800'; // Orange
      case BlockType.MOSSY_COBBLESTONE:
        return '#557755'; // Mossy green-gray
      case BlockType.DRIPSTONE_BLOCK:
        return '#AAAAAA'; // Light gray
      case BlockType.CHEST:
        return '#885500'; // Chest brown
      case BlockType.CAULDRON:
        return '#444444'; // Cauldron dark gray
      default:
        return '#808080'; // Default gray
    }
  }

  private get4BitHighlightColor(blockType: BlockType): string {
    // Get highlight color for texture variation
    switch (blockType) {
      case BlockType.GRASS:
        return '#88FF88'; // Lighter green
      case BlockType.DIRT:
        return '#AA7744'; // Lighter brown
      case BlockType.STONE:
        return '#AAAAAA'; // Lighter gray
      case BlockType.WATER:
        return '#6699FF'; // Lighter blue
      case BlockType.LAVA:
        return '#FF7733'; // Lighter red-orange
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG:
        return '#AA6600'; // Lighter wood
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES:
        return '#66FF66'; // Lighter green
      default:
        return '#FFFFFF'; // White highlights
    }
  }

  private getBlockTypeName(blockType: BlockType): string {
    switch (blockType) {
      case BlockType.GRASS: return 'GRASS';
      case BlockType.DIRT: return 'DIRT';
      case BlockType.STONE: return 'STONE';
      case BlockType.COBBLESTONE: return 'COBBLESTONE';
      case BlockType.SAND: return 'SAND';
      case BlockType.WATER: return 'WATER';
      case BlockType.LAVA: return 'LAVA';
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG: return 'OAK_LOG';
      case BlockType.OAK_PLANKS:
      case BlockType.BIRCH_PLANKS:
      case BlockType.SPRUCE_PLANKS:
      case BlockType.JUNGLE_PLANKS:
      case BlockType.ACACIA_PLANKS:
      case BlockType.DARK_OAK_PLANKS: return 'OAK_PLANKS';
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES: return 'OAK_LEAVES';
      default: return 'DEFAULT';
    }
  }

  private generateBlockTextureDetails(ctx: CanvasRenderingContext2D, blockType: BlockType, block: any, face: number = 0) {
    // Clear canvas
    ctx.clearRect(0, 0, 64, 64);

    switch (blockType) {
      case BlockType.GRASS:
        this.createGrassTexture(ctx);
        break;
      case BlockType.DIRT:
        this.createDirtTexture(ctx);
        break;
      case BlockType.STONE:
        this.createStoneTexture(ctx);
        break;
      case BlockType.COBBLESTONE:
        this.createCobblestoneTexture(ctx);
        break;
      case BlockType.SAND:
        this.createSandTexture(ctx);
        break;
      case BlockType.WATER:
        this.createWaterTexture(ctx);
        break;
      case BlockType.LAVA:
        this.createLavaTexture(ctx);
        break;
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG:
        this.createWoodTexture(ctx, blockType);
        break;
      case BlockType.OAK_PLANKS:
      case BlockType.BIRCH_PLANKS:
      case BlockType.SPRUCE_PLANKS:
      case BlockType.JUNGLE_PLANKS:
      case BlockType.ACACIA_PLANKS:
      case BlockType.DARK_OAK_PLANKS:
        this.createPlankTexture(ctx, blockType);
        break;
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES:
        this.createLeavesTexture(ctx, blockType);
        break;
      case BlockType.GLASS:
        this.createGlassTexture(ctx);
        break;
      case BlockType.COAL_ORE:
        this.createCoalOreTexture(ctx);
        break;
      case BlockType.IRON_ORE:
        this.createIronOreTexture(ctx);
        break;
      case BlockType.GOLD_ORE:
        this.createGoldOreTexture(ctx);
        break;
      case BlockType.DIAMOND_ORE:
        this.createDiamondOreTexture(ctx);
        break;
      case BlockType.REDSTONE_ORE:
        this.createRedstoneOreTexture(ctx);
        break;
      case BlockType.LAPIS_ORE:
        this.createLapisOreTexture(ctx);
        break;
      case BlockType.EMERALD_ORE:
        this.createEmeraldOreTexture(ctx);
        break;
      case BlockType.COPPER_ORE:
        this.createCopperOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE:
        this.createDeepslateTexture(ctx);
        break;
      case BlockType.DEEPSLATE_COAL_ORE:
        this.createDeepslateCoalOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_IRON_ORE:
        this.createDeepslateIronOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_GOLD_ORE:
        this.createDeepslateGoldOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_DIAMOND_ORE:
        this.createDeepslateDiamondOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_REDSTONE_ORE:
        this.createDeepslateRedstoneOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_LAPIS_ORE:
        this.createDeepslateLapisOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_EMERALD_ORE:
        this.createDeepslateEmeraldOreTexture(ctx);
        break;
      case BlockType.DEEPSLATE_COPPER_ORE:
        this.createDeepslateCopperOreTexture(ctx);
        break;
      case BlockType.SANDSTONE:
        this.createSandstoneTexture(ctx);
        break;
      case BlockType.BEDROCK:
        this.createBedrockTexture(ctx);
        break;
      case BlockType.GRAVEL:
        this.createGravelTexture(ctx);
        break;
      case BlockType.CLAY:
        this.createClayTexture(ctx);
        break;
      case BlockType.TALL_GRASS:
        this.createTallGrassTexture(ctx);
        break;
      case BlockType.FLOWER_RED:
        this.createRedFlowerTexture(ctx);
        break;
      case BlockType.FLOWER_YELLOW:
        this.createYellowFlowerTexture(ctx);
        break;
      case BlockType.CACTUS:
        this.createCactusTexture(ctx);
        break;
      case BlockType.SUGAR_CANE:
        this.createSugarCaneTexture(ctx);
        break;
      case BlockType.PUMPKIN:
        this.createPumpkinTexture(ctx);
        break;
      case BlockType.MOSSY_COBBLESTONE:
        this.createMossyCobblestoneTexture(ctx);
        break;
      case BlockType.DRIPSTONE_BLOCK:
        this.createDripstoneTexture(ctx);
        break;
      case BlockType.CHEST:
        this.createChestTexture(ctx);
        break;
      case BlockType.CAULDRON:
        this.createCauldronTexture(ctx);
        break;
      default:
        this.createDefaultBlockTexture(ctx, block.color);
        break;
    }
  }

  private createGrassTexture(ctx: CanvasRenderingContext2D, face: number = 0) {
    // Face 0: Top (grass)
    if (face === 0) {
      ctx.fillStyle = '#5A8F2F';
      ctx.fillRect(0, 0, 64, 64);
      
      // Add grass blades
      ctx.fillStyle = '#6ABF3F';
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillRect(x, y, 2, 8);
      }
    }
    // Face 1: Bottom (dirt)
    else if (face === 1) {
      ctx.fillStyle = '#6B4A2B';
      ctx.fillRect(0, 0, 64, 64);
      
      // Add dirt texture
      ctx.fillStyle = '#4A3522';
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 6;
        ctx.fillRect(x, y, size, size);
      }
    }
    // Faces 2-5: Sides (grass/dirt transition)
    else {
      ctx.fillStyle = '#6B4A2B';
      ctx.fillRect(0, 0, 64, 64);
      
      // Top part (grass)
      ctx.fillStyle = '#5A8F2F';
      for (let y = 0; y < 32; y += 4) {
        for (let x = 0; x < 64; x += 6) {
          if (Math.random() > 0.3) {
            ctx.fillRect(x + Math.random() * 4, y + Math.random() * 2, 3, 4);
          }
        }
      }
      
      // Add dirt texture
      ctx.fillStyle = '#4A3522';
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  private createDirtTexture(ctx: CanvasRenderingContext2D) {
    // Base dirt color
    ctx.fillStyle = '#6B4A2B';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add darker patches
    ctx.fillStyle = '#4A3522';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 6;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add lighter patches
    ctx.fillStyle = '#8B6A4B';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 2 + Math.random() * 4;
      ctx.fillRect(x, y, size, size);
    }
  }

  private createStoneTexture(ctx: CanvasRenderingContext2D) {
    // Base stone color
    ctx.fillStyle = '#8A8A8A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add stone details
    ctx.fillStyle = '#6B6B6B';
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 4 + Math.random() * 8;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add cracks
    ctx.strokeStyle = '#5A5A5A';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 64, Math.random() * 64);
      ctx.lineTo(Math.random() * 64, Math.random() * 64);
      ctx.stroke();
    }
  }

  private createCobblestoneTexture(ctx: CanvasRenderingContext2D) {
    // Base color
    ctx.fillStyle = '#7A7A7A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Create cobblestone pattern
    ctx.fillStyle = '#6A6A6A';
    for (let y = 0; y < 64; y += 12) {
      for (let x = 0; x < 64; x += 12) {
        const offsetX = Math.random() * 4 - 2;
        const offsetY = Math.random() * 4 - 2;
        const width = 10 + Math.random() * 4;
        const height = 10 + Math.random() * 4;
        ctx.fillRect(x + offsetX, y + offsetY, width, height);
      }
    }
  }

  private createSandTexture(ctx: CanvasRenderingContext2D) {
    // Base sand color
    ctx.fillStyle = '#D4C28A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add sand grains
    ctx.fillStyle = '#B8A670';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 1, 1);
    }
    
    // Add highlights
    ctx.fillStyle = '#F0E6B0';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private createWaterTexture(ctx: CanvasRenderingContext2D) {
    // Base water color
    ctx.fillStyle = '#3F76E4';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add ripples
    ctx.fillStyle = '#6AA3FF';
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 5;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add bubbles
    ctx.fillStyle = '#A7D0FF';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createLavaTexture(ctx: CanvasRenderingContext2D) {
    // Base lava color
    ctx.fillStyle = '#D96415';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add hotspots
    ctx.fillStyle = '#FF8C2B';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 6;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add glowing embers
    ctx.fillStyle = '#FFD54A';
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createWoodTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Determine wood color based on type
    let baseColor = '#8B5A2B'; // Oak
    if (blockType === BlockType.BIRCH_LOG) baseColor = '#D2B48C';
    if (blockType === BlockType.SPRUCE_LOG) baseColor = '#5D4037';
    if (blockType === BlockType.JUNGLE_LOG) baseColor = '#6B4A2B';
    if (blockType === BlockType.ACACIA_LOG) baseColor = '#8B4513';
    if (blockType === BlockType.DARK_OAK_LOG) baseColor = '#3A2A1B';

    // Side texture (bark)
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 64, 64);
    
    // Add bark texture
    ctx.strokeStyle = '#3A2A1B';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = i * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y + Math.random() * 4);
      ctx.stroke();
    }
    
    // Add vertical bark lines
    ctx.strokeStyle = '#2A1A0B';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 10;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.random() * 4, 64);
      ctx.stroke();
    }
  }

  private createPlankTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Determine plank color based on type
    let baseColor = '#C28F4C'; // Oak
    if (blockType === BlockType.BIRCH_PLANKS) baseColor = '#E6D3A7';
    if (blockType === BlockType.SPRUCE_PLANKS) baseColor = '#A1694F';
    if (blockType === BlockType.JUNGLE_PLANKS) baseColor = '#8B5A2B';
    if (blockType === BlockType.ACACIA_PLANKS) baseColor = '#D2B48C';
    if (blockType === BlockType.DARK_OAK_PLANKS) baseColor = '#6B4A2B';

    // Base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 64, 64);
    
    // Add wood grain
    ctx.strokeStyle = '#3A2A1B';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const y = i * 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y + Math.random() * 3);
      ctx.stroke();
    }
    
    // Add knots
    ctx.fillStyle = '#2A1A0B';
    for (let i = 0; i < 4; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createLeavesTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Determine leaf color based on type
    let baseColor = '#5A8F2F'; // Oak
    if (blockType === BlockType.BIRCH_LEAVES) baseColor = '#6BAF4F';
    if (blockType === BlockType.SPRUCE_LEAVES) baseColor = '#4A7F2F';
    if (blockType === BlockType.JUNGLE_LEAVES) baseColor = '#6A9F3F';
    if (blockType === BlockType.ACACIA_LEAVES) baseColor = '#7ABF5F';
    if (blockType === BlockType.DARK_OAK_LEAVES) baseColor = '#4A6F2F';

    // Base leaf color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 64, 64);
    
    // Add leaf clusters
    ctx.fillStyle = '#3A6F1F';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Add highlights
    ctx.fillStyle = '#8FD05F';
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createGlassTexture(ctx: CanvasRenderingContext2D) {
    // Base glass color
    ctx.fillStyle = 'rgba(100, 150, 255, 0.6)';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add glass reflections
    ctx.fillStyle = 'rgba(200, 220, 255, 0.4)';
    ctx.fillRect(0, 0, 20, 20);
    ctx.fillRect(44, 44, 20, 20);
    
    // Add grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 64; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }
    for (let y = 0; y < 64; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
  }

  private createOreTexture(ctx: CanvasRenderingContext2D, baseColor: string, oreColor: string) {
    // Base stone color
    ctx.fillStyle = '#8A8A8A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add ore veins
    ctx.fillStyle = baseColor;
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 6;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add shiny ore spots
    ctx.fillStyle = oreColor;
    for (let i = 0; i < 4; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createCoalOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#3A3A3A', '#6A6A6A');
  }

  private createIronOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#7A7A7A', '#B8B8B8');
  }

  private createGoldOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#D4AF37', '#FFD700');
  }

  private createDiamondOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#00BFFF', '#87CEEB');
  }

  private createRedstoneOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#8B0000', '#FF4500');
  }

  private createLapisOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#1E90FF', '#4169E1');
  }

  private createEmeraldOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#00FF7F', '#32CD32');
  }

  private createCopperOreTexture(ctx: CanvasRenderingContext2D) {
    this.createOreTexture(ctx, '#B87333', '#DEB887');
  }

  private createDeepslateTexture(ctx: CanvasRenderingContext2D) {
    // Dark deepslate color
    ctx.fillStyle = '#3A3A3A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add deepslate details
    ctx.fillStyle = '#2A2A2A';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 4 + Math.random() * 8;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add mineral veins
    ctx.fillStyle = '#5A5A5A';
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createDeepslateOreTexture(ctx: CanvasRenderingContext2D, oreTexture: (ctx: CanvasRenderingContext2D) => void) {
    // Base deepslate
    this.createDeepslateTexture(ctx);
    
    // Add ore details on top
    oreTexture(ctx);
  }

  private createDeepslateCoalOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createCoalOreTexture.bind(this));
  }

  private createDeepslateIronOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createIronOreTexture.bind(this));
  }

  private createDeepslateGoldOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createGoldOreTexture.bind(this));
  }

  private createDeepslateDiamondOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createDiamondOreTexture.bind(this));
  }

  private createDeepslateRedstoneOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createRedstoneOreTexture.bind(this));
  }

  private createDeepslateLapisOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createLapisOreTexture.bind(this));
  }

  private createDeepslateEmeraldOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createEmeraldOreTexture.bind(this));
  }

  private createDeepslateCopperOreTexture(ctx: CanvasRenderingContext2D) {
    this.createDeepslateOreTexture(ctx, this.createCopperOreTexture.bind(this));
  }

  private createSandstoneTexture(ctx: CanvasRenderingContext2D) {
    // Base sandstone color
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add sandstone layers
    ctx.fillStyle = '#CD853F';
    for (let y = 0; y < 64; y += 8) {
      ctx.fillRect(0, y, 64, 2);
    }
    
    // Add texture details
    ctx.fillStyle = '#A0522D';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 2 + Math.random() * 4;
      ctx.fillRect(x, y, size, size);
    }
  }

  private createBedrockTexture(ctx: CanvasRenderingContext2D) {
    // Dark bedrock color
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add bedrock patterns
    ctx.fillStyle = '#2A2A2A';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 6;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add glowing cracks
    ctx.strokeStyle = '#4A4A4A';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 64, Math.random() * 64);
      ctx.lineTo(Math.random() * 64, Math.random() * 64);
      ctx.stroke();
    }
  }

  private createGravelTexture(ctx: CanvasRenderingContext2D) {
    // Base gravel color
    ctx.fillStyle = '#7A7A7A';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add gravel stones
    ctx.fillStyle = '#5A5A5A';
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 2 + Math.random() * 3;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add lighter stones
    ctx.fillStyle = '#9A9A9A';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 1 + Math.random() * 2;
      ctx.fillRect(x, y, size, size);
    }
  }

  private createClayTexture(ctx: CanvasRenderingContext2D) {
    // Base clay color
    ctx.fillStyle = '#B8860B';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add clay texture
    ctx.fillStyle = '#8B6914';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 3 + Math.random() * 5;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add wet clay highlights
    ctx.fillStyle = '#DAA520';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createTallGrassTexture(ctx: CanvasRenderingContext2D) {
    // Base grass color
    ctx.fillStyle = '#5A8F2F';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add grass blades
    ctx.fillStyle = '#6ABF3F';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 2, 10);
    }
    
    // Add highlights
    ctx.fillStyle = '#8FD05F';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 1, 6);
    }
  }

  private createRedFlowerTexture(ctx: CanvasRenderingContext2D) {
    // Flower center
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(24, 24, 16, 16);
    
    // Petals
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(16, 16, 32, 8);
    ctx.fillRect(16, 32, 32, 8);
    ctx.fillRect(16, 24, 8, 16);
    ctx.fillRect(32, 24, 8, 16);
    
    // Add details
    ctx.fillStyle = '#DC143C';
    ctx.fillRect(28, 28, 8, 8);
  }

  private createYellowFlowerTexture(ctx: CanvasRenderingContext2D) {
    // Flower center
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(24, 24, 16, 16);
    
    // Petals
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(16, 16, 32, 8);
    ctx.fillRect(16, 32, 32, 8);
    ctx.fillRect(16, 24, 8, 16);
    ctx.fillRect(32, 24, 8, 16);
    
    // Add details
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(28, 28, 8, 8);
  }

  private createCactusTexture(ctx: CanvasRenderingContext2D) {
    // Base cactus color
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add cactus ridges
    ctx.fillStyle = '#006400';
    for (let x = 0; x < 64; x += 12) {
      ctx.fillRect(x, 0, 4, 64);
    }
    
    // Add spines
    ctx.fillStyle = '#32CD32';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private createSugarCaneTexture(ctx: CanvasRenderingContext2D) {
    // Base cane color
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add cane segments
    ctx.fillStyle = '#006400';
    for (let y = 0; y < 64; y += 16) {
      ctx.fillRect(0, y, 64, 4);
    }
    
    // Add details
    ctx.fillStyle = '#32CD32';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private createPumpkinTexture(ctx: CanvasRenderingContext2D) {
    // Pumpkin body
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(8, 8, 48, 48);
    
    // Pumpkin lines
    ctx.fillStyle = '#B22222';
    ctx.fillRect(28, 8, 8, 48);
    ctx.fillRect(8, 28, 48, 8);
    
    // Stem
    ctx.fillStyle = '#228B22';
    ctx.fillRect(28, 0, 8, 8);
  }

  private createMossyCobblestoneTexture(ctx: CanvasRenderingContext2D) {
    // Base cobblestone
    this.createCobblestoneTexture(ctx);
    
    // Add moss
    ctx.fillStyle = 'rgba(90, 143, 47, 0.6)';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const size = 4 + Math.random() * 8;
      ctx.fillRect(x, y, size, size);
    }
  }

  private createDripstoneTexture(ctx: CanvasRenderingContext2D) {
    // Base dripstone color
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add dripstone formations
    ctx.fillStyle = '#A0A0A0';
    for (let x = 0; x < 64; x += 8) {
      const height = 10 + Math.random() * 20;
      ctx.fillRect(x, 64 - height, 6, height);
    }
    
    // Add highlights
    ctx.fillStyle = '#E0E0E0';
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private createChestTexture(ctx: CanvasRenderingContext2D) {
    // Chest wood
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0, 0, 64, 64);
    
    // Chest lid
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(0, 0, 64, 20);
    
    // Chest lock
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(28, 16, 8, 8);
    
    // Wood grain
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = i * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y + Math.random() * 3);
      ctx.stroke();
    }
  }

  private createCauldronTexture(ctx: CanvasRenderingContext2D) {
    // Cauldron metal
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(0, 0, 64, 64);
    
    // Cauldron rim
    ctx.fillStyle = '#4169E1';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillRect(0, 56, 64, 8);
    
    // Cauldron details
    ctx.strokeStyle = '#191970';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(8, 56);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(56, 8);
    ctx.lineTo(56, 56);
    ctx.stroke();
  }

  private createDefaultBlockTexture(ctx: CanvasRenderingContext2D, color: string) {
    // Default block with pattern
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    
    // Add checkerboard pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        if ((x + y) % 32 === 0) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }
  }

  private createDefaultTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillRect(32, 32, 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    
    return texture;
  }

  clearCache(): void {
    this.textureCache.clear();
  }
}

export const fallbackTextureGenerator = new FallbackTextureGenerator();
