import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';

// Static texture generator that creates detailed 8x8 textures for blocks
export class StaticTextureGenerator {
  private textureCache = new Map<BlockType, THREE.Texture>();

  generateStaticTexture(blockType: BlockType): THREE.Texture {
    if (this.textureCache.has(blockType)) {
      return this.textureCache.get(blockType)!;
    }

    const block = BLOCKS[blockType];
    if (!block) {
      return this.createDefaultTexture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return this.createDefaultTexture();
    }

    // Generate texture based on block type
    this.generateBlockTexture(ctx, blockType, block);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    this.textureCache.set(blockType, texture);
    return texture;
  }

  private generateBlockTexture(ctx: CanvasRenderingContext2D, blockType: BlockType, block: any) {
    // Base color fill
    ctx.fillStyle = block.color;
    ctx.fillRect(0, 0, 8, 8);

    // Add texture details based on block type
    switch (blockType) {
      case BlockType.GRASS:
        this.addGrassTexture(ctx);
        break;
      case BlockType.DIRT:
        this.addDirtTexture(ctx);
        break;
      case BlockType.STONE:
      case BlockType.COBBLESTONE:
        this.addStoneTexture(ctx);
        break;
      case BlockType.SAND:
        this.addSandTexture(ctx);
        break;
      case BlockType.WATER:
        this.addWaterTexture(ctx);
        break;
      case BlockType.LAVA:
        this.addLavaTexture(ctx);
        break;
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG:
        this.addWoodTexture(ctx, blockType);
        break;
      case BlockType.OAK_PLANKS:
      case BlockType.BIRCH_PLANKS:
      case BlockType.SPRUCE_PLANKS:
      case BlockType.JUNGLE_PLANKS:
      case BlockType.ACACIA_PLANKS:
      case BlockType.DARK_OAK_PLANKS:
        this.addPlankTexture(ctx, blockType);
        break;
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES:
        this.addLeavesTexture(ctx, blockType);
        break;
      default:
        // Add simple pattern for other blocks
        this.addDefaultPattern(ctx, block.color);
        break;
    }
  }

  private addGrassTexture(ctx: CanvasRenderingContext2D) {
    // Detailed grass pattern
    const pattern = [
      [0,0,1,0,1,0,0,1],
      [1,0,0,1,0,1,0,0],
      [0,1,0,0,1,0,1,0],
      [0,0,1,0,0,1,0,1],
      [1,0,0,1,0,0,1,0],
      [0,1,0,0,1,0,0,1],
      [0,0,1,0,1,1,0,0],
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

  private addDirtTexture(ctx: CanvasRenderingContext2D) {
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

  private addStoneTexture(ctx: CanvasRenderingContext2D) {
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

  private addSandTexture(ctx: CanvasRenderingContext2D) {
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

  private addWaterTexture(ctx: CanvasRenderingContext2D) {
    // Base water color
    ctx.fillStyle = '#3B9EFF';
    ctx.fillRect(0, 0, 8, 8);

    // Wave pattern
    ctx.fillStyle = '#1E6ED8';
    ctx.fillRect(0, 0, 3, 1);
    ctx.fillRect(4, 1, 4, 1);
    ctx.fillRect(0, 3, 3, 1);
    ctx.fillRect(5, 4, 3, 1);
    ctx.fillRect(1, 6, 3, 1);

    // Highlights
    ctx.fillStyle = '#6BC6FF';
    ctx.fillRect(1, 1, 2, 1);
    ctx.fillRect(5, 2, 2, 1);
    ctx.fillRect(2, 4, 2, 1);
    ctx.fillRect(0, 7, 2, 1);
  }

  private addLavaTexture(ctx: CanvasRenderingContext2D) {
    // Base lava color - bright orange
    ctx.fillStyle = '#FF6A00';
    ctx.fillRect(0, 0, 8, 8);
    
    // Add darker spots for texture
    ctx.fillStyle = '#D93030';
    ctx.fillRect(1, 2, 1, 1);
    ctx.fillRect(4, 1, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(3, 7, 1, 1);
    
    // Add bright highlights
    ctx.fillStyle = '#FFAA00';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(7, 6, 1, 1);
  }

  private addWoodTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Bark lines
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, 8, 1);
    ctx.fillRect(0, 2, 8, 1);
    ctx.fillRect(0, 4, 8, 1);
    ctx.fillRect(0, 6, 8, 1);
    
    // Vertical variation
    ctx.fillRect(2, 0, 1, 8);
    ctx.fillRect(5, 0, 1, 8);
  }

  private addPlankTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Plank lines
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
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

  private addLeavesTexture(ctx: CanvasRenderingContext2D, blockType: BlockType) {
    // Create leaf pattern
    const pattern = [
      [1,0,1,1,0,1,0,1],
      [0,1,1,0,1,1,1,0],
      [1,1,0,1,0,1,1,1],
      [1,0,1,1,1,0,1,0],
      [0,1,0,1,1,1,0,1],
      [1,1,1,0,1,0,1,1],
      [0,1,1,1,0,1,0,1],
      [1,0,1,0,1,1,1,0]
    ];

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private addDefaultPattern(ctx: CanvasRenderingContext2D, baseColor: string) {
    // Add a simple texture pattern
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
    ctx.fillRect(6, 2, 1, 1);
    ctx.fillRect(2, 6, 1, 1);
  }

  private createDefaultTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, 4, 4);
      ctx.fillRect(4, 4, 4, 4);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    
    return texture;
  }

  clearCache(): void {
    this.textureCache.clear();
  }
}

export const staticTextureGenerator = new StaticTextureGenerator();
