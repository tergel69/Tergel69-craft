import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';

// 4-bit Minecraft-style color palette (limited to 16 colors)
const MINECRAFT_PALETTE = {
  // Earth tones
  DARK_BROWN: '#4A3522',
  MEDIUM_BROWN: '#6B4A2B',
  LIGHT_BROWN: '#8B6A4B',
  DARK_GRAY: '#3A3A3A',
  MEDIUM_GRAY: '#6B6B6B',
  LIGHT_GRAY: '#9A9A9A',
  WHITE: '#FFFFFF',
  
  // Greens
  DARK_GREEN: '#3A6F1F',
  MEDIUM_GREEN: '#5A8F2F',
  LIGHT_GREEN: '#6ABF3F',
  BRIGHT_GREEN: '#8FD05F',
  
  // Blues
  DARK_BLUE: '#1E3A8E',
  MEDIUM_BLUE: '#3F76E4',
  LIGHT_BLUE: '#6AA3FF',
  CYAN: '#00BFFF',
  
  // Reds/Yellows
  DARK_RED: '#8B0000',
  MEDIUM_RED: '#D93030',
  BRIGHT_RED: '#FF4500',
  DARK_YELLOW: '#8B6914',
  MEDIUM_YELLOW: '#D4AF37',
  BRIGHT_YELLOW: '#FFD700',
  
  // Other colors
  BLACK: '#000000',
  PURPLE: '#8932B8',
  PINK: '#D5649F',
  ORANGE: '#FF8C00',
  LIME: '#00FF7F',
  MAGENTA: '#FF00FF',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
};

// Block-specific texture patterns
interface TexturePattern {
  name: string;
  colors: string[];
  generate: (ctx: CanvasRenderingContext2D) => void;
}

const TEXTURE_PATTERNS: Record<string, TexturePattern> = {
  // Grass textures
  GRASS_TOP: {
    name: 'Grass Top',
    colors: [MINECRAFT_PALETTE.MEDIUM_GREEN, MINECRAFT_PALETTE.BRIGHT_GREEN, MINECRAFT_PALETTE.DARK_GREEN],
    generate: (ctx) => {
      // Base grass color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GREEN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add grass blades
      ctx.fillStyle = MINECRAFT_PALETTE.BRIGHT_GREEN;
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillRect(x, y, 2, 8);
      }
      
      // Add darker patches
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GREEN;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 4 + Math.random() * 6;
        ctx.fillRect(x, y, size, size);
      }
    }
  },
  
  GRASS_SIDE: {
    name: 'Grass Side',
    colors: [MINECRAFT_PALETTE.MEDIUM_BROWN, MINECRAFT_PALETTE.MEDIUM_GREEN, MINECRAFT_PALETTE.DARK_GREEN],
    generate: (ctx) => {
      // Dirt base
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_BROWN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Grass top part
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GREEN;
      for (let y = 0; y < 32; y += 4) {
        for (let x = 0; x < 64; x += 6) {
          if (Math.random() > 0.3) {
            ctx.fillRect(x + Math.random() * 4, y + Math.random() * 2, 3, 4);
          }
        }
      }
      
      // Darker grass patches
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GREEN;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 32;
        ctx.fillRect(x, y, 4, 6);
      }
    }
  },
  
  // Dirt textures
  DIRT: {
    name: 'Dirt',
    colors: [MINECRAFT_PALETTE.MEDIUM_BROWN, MINECRAFT_PALETTE.DARK_BROWN, MINECRAFT_PALETTE.LIGHT_BROWN],
    generate: (ctx) => {
      // Base dirt color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_BROWN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add darker patches
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_BROWN;
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 4 + Math.random() * 8;
        ctx.fillRect(x, y, size, size);
      }
      
      // Add lighter patches
      ctx.fillStyle = MINECRAFT_PALETTE.LIGHT_BROWN;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 5;
        ctx.fillRect(x, y, size, size);
      }
    }
  },
  
  // Stone textures
  STONE: {
    name: 'Stone',
    colors: [MINECRAFT_PALETTE.MEDIUM_GRAY, MINECRAFT_PALETTE.DARK_GRAY, MINECRAFT_PALETTE.LIGHT_GRAY],
    generate: (ctx) => {
      // Base stone color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add stone details
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GRAY;
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 4 + Math.random() * 8;
        ctx.fillRect(x, y, size, size);
      }
      
      // Add cracks
      ctx.strokeStyle = MINECRAFT_PALETTE.DARK_GRAY;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 64, Math.random() * 64);
        ctx.lineTo(Math.random() * 64, Math.random() * 64);
        ctx.stroke();
      }
    }
  },
  
  COBBLESTONE: {
    name: 'Cobblestone',
    colors: [MINECRAFT_PALETTE.MEDIUM_GRAY, MINECRAFT_PALETTE.DARK_GRAY],
    generate: (ctx) => {
      // Base color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Create cobblestone pattern
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GRAY;
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
  },
  
  // Wood textures
  OAK_LOG_SIDE: {
    name: 'Oak Log Side',
    colors: [MINECRAFT_PALETTE.MEDIUM_BROWN, MINECRAFT_PALETTE.DARK_BROWN],
    generate: (ctx) => {
      // Base bark color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_BROWN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add bark texture
      ctx.strokeStyle = MINECRAFT_PALETTE.DARK_BROWN;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = i * 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y + Math.random() * 4);
        ctx.stroke();
      }
      
      // Add vertical bark lines
      ctx.strokeStyle = MINECRAFT_PALETTE.DARK_BROWN;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 10;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + Math.random() * 4, 64);
        ctx.stroke();
      }
    }
  },
  
  OAK_LOG_TOP: {
    name: 'Oak Log Top',
    colors: [MINECRAFT_PALETTE.LIGHT_BROWN, MINECRAFT_PALETTE.MEDIUM_BROWN, MINECRAFT_PALETTE.DARK_BROWN],
    generate: (ctx) => {
      // Base wood color
      ctx.fillStyle = MINECRAFT_PALETTE.LIGHT_BROWN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add wood rings
      ctx.strokeStyle = MINECRAFT_PALETTE.MEDIUM_BROWN;
      ctx.lineWidth = 1;
      for (let r = 5; r < 30; r += 3) {
        ctx.beginPath();
        ctx.arc(32, 32, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Add darker center
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_BROWN;
      ctx.beginPath();
      ctx.arc(32, 32, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  
  OAK_PLANKS: {
    name: 'Oak Planks',
    colors: [MINECRAFT_PALETTE.MEDIUM_BROWN, MINECRAFT_PALETTE.DARK_BROWN],
    generate: (ctx) => {
      // Base plank color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_BROWN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add wood grain
      ctx.strokeStyle = MINECRAFT_PALETTE.DARK_BROWN;
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const y = i * 5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y + Math.random() * 3);
        ctx.stroke();
      }
      
      // Add plank seams
      ctx.strokeStyle = MINECRAFT_PALETTE.DARK_BROWN;
      ctx.lineWidth = 2;
      for (let x = 0; x < 64; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 64);
        ctx.stroke();
      }
    }
  },
  
  // Leaf textures
  OAK_LEAVES: {
    name: 'Oak Leaves',
    colors: [MINECRAFT_PALETTE.MEDIUM_GREEN, MINECRAFT_PALETTE.DARK_GREEN, MINECRAFT_PALETTE.BRIGHT_GREEN],
    generate: (ctx) => {
      // Base leaf color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GREEN;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add leaf clusters
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GREEN;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.beginPath();
        ctx.arc(x, y, 4 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Add highlights
      ctx.fillStyle = MINECRAFT_PALETTE.BRIGHT_GREEN;
      for (let i = 0; i < 4; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  
  // Flower textures
  RED_FLOWER: {
    name: 'Red Flower',
    colors: [MINECRAFT_PALETTE.BRIGHT_YELLOW, MINECRAFT_PALETTE.MEDIUM_RED, MINECRAFT_PALETTE.DARK_RED],
    generate: (ctx) => {
      // Flower center
      ctx.fillStyle = MINECRAFT_PALETTE.BRIGHT_YELLOW;
      ctx.fillRect(24, 24, 16, 16);
      
      // Petals
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_RED;
      ctx.fillRect(16, 16, 32, 8);
      ctx.fillRect(16, 32, 32, 8);
      ctx.fillRect(16, 24, 8, 16);
      ctx.fillRect(32, 24, 8, 16);
      
      // Petal details
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_RED;
      ctx.fillRect(28, 28, 8, 8);
    }
  },
  
  YELLOW_FLOWER: {
    name: 'Yellow Flower',
    colors: [MINECRAFT_PALETTE.BRIGHT_YELLOW, MINECRAFT_PALETTE.MEDIUM_YELLOW, MINECRAFT_PALETTE.DARK_YELLOW],
    generate: (ctx) => {
      // Flower center
      ctx.fillStyle = MINECRAFT_PALETTE.BRIGHT_YELLOW;
      ctx.fillRect(24, 24, 16, 16);
      
      // Petals
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_YELLOW;
      ctx.fillRect(16, 16, 32, 8);
      ctx.fillRect(16, 32, 32, 8);
      ctx.fillRect(16, 24, 8, 16);
      ctx.fillRect(32, 24, 8, 16);
      
      // Petal details
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_YELLOW;
      ctx.fillRect(28, 28, 8, 8);
    }
  },
  
  // Water texture
  WATER: {
    name: 'Water',
    colors: [MINECRAFT_PALETTE.MEDIUM_BLUE, MINECRAFT_PALETTE.LIGHT_BLUE, MINECRAFT_PALETTE.CYAN],
    generate: (ctx) => {
      // Base water color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_BLUE;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add ripples
      ctx.fillStyle = MINECRAFT_PALETTE.LIGHT_BLUE;
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 5;
        ctx.fillRect(x, y, size, size);
      }
      
      // Add bubbles
      ctx.fillStyle = MINECRAFT_PALETTE.CYAN;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  
  // Lava texture
  LAVA: {
    name: 'Lava',
    colors: [MINECRAFT_PALETTE.BRIGHT_RED, MINECRAFT_PALETTE.MEDIUM_RED, MINECRAFT_PALETTE.DARK_RED],
    generate: (ctx) => {
      // Base lava color
      ctx.fillStyle = MINECRAFT_PALETTE.BRIGHT_RED;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add hotspots
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_RED;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 4 + Math.random() * 6;
        ctx.fillRect(x, y, size, size);
      }
      
      // Add glowing embers
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_RED;
      for (let i = 0; i < 4; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  
  // Ore textures
  COAL_ORE: {
    name: 'Coal Ore',
    colors: [MINECRAFT_PALETTE.DARK_GRAY, MINECRAFT_PALETTE.BLACK],
    generate: (ctx) => {
      // Base stone color
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add coal veins
      ctx.fillStyle = MINECRAFT_PALETTE.BLACK;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 4 + Math.random() * 6;
        ctx.fillRect(x, y, size, size);
      }
    }
  },
  
  IRON_ORE: {
    name: 'Iron Ore',
    colors: [MINECRAFT_PALETTE.MEDIUM_GRAY, MINECRAFT_PALETTE.SILVER],
    generate: (ctx) => {
      // Base stone color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add iron veins
      ctx.fillStyle = MINECRAFT_PALETTE.SILVER;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 5;
        ctx.fillRect(x, y, size, size);
      }
    }
  },
  
  GOLD_ORE: {
    name: 'Gold Ore',
    colors: [MINECRAFT_PALETTE.MEDIUM_GRAY, MINECRAFT_PALETTE.GOLD],
    generate: (ctx) => {
      // Base stone color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add gold veins
      ctx.fillStyle = MINECRAFT_PALETTE.GOLD;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 5;
        ctx.fillRect(x, y, size, size);
      }
    }
  },
  
  DIAMOND_ORE: {
    name: 'Diamond Ore',
    colors: [MINECRAFT_PALETTE.DARK_GRAY, MINECRAFT_PALETTE.CYAN],
    generate: (ctx) => {
      // Base stone color
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add diamond crystals
      ctx.fillStyle = MINECRAFT_PALETTE.CYAN;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 2);
        ctx.lineTo(x + 2, y + 6);
        ctx.lineTo(x - 2, y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
  
  // Sand texture
  SAND: {
    name: 'Sand',
    colors: [MINECRAFT_PALETTE.MEDIUM_YELLOW, MINECRAFT_PALETTE.LIGHT_BROWN],
    generate: (ctx) => {
      // Base sand color
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_YELLOW;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add sand grains
      ctx.fillStyle = MINECRAFT_PALETTE.LIGHT_BROWN;
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  },
  
  // Glass texture
  GLASS: {
    name: 'Glass',
    colors: [MINECRAFT_PALETTE.LIGHT_BLUE, MINECRAFT_PALETTE.CYAN, MINECRAFT_PALETTE.WHITE],
    generate: (ctx) => {
      // Base glass color
      ctx.fillStyle = MINECRAFT_PALETTE.LIGHT_BLUE;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add reflections
      ctx.fillStyle = MINECRAFT_PALETTE.CYAN;
      ctx.fillRect(0, 0, 20, 20);
      ctx.fillRect(44, 44, 20, 20);
      
      // Add grid pattern
      ctx.strokeStyle = MINECRAFT_PALETTE.WHITE;
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
  },
  
  // Default texture
  DEFAULT: {
    name: 'Default',
    colors: [MINECRAFT_PALETTE.MEDIUM_GRAY, MINECRAFT_PALETTE.DARK_GRAY],
    generate: (ctx) => {
      // Default block with pattern
      ctx.fillStyle = MINECRAFT_PALETTE.MEDIUM_GRAY;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add checkerboard pattern
      ctx.fillStyle = MINECRAFT_PALETTE.DARK_GRAY;
      for (let y = 0; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 16) {
          if ((x + y) % 32 === 0) {
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }
    }
  }
};

// Texture generator for Minecraft-style blocks
export class MinecraftTextureGenerator {
  private textureCache = new Map<string, THREE.Texture>();

  generateBlockTexture(blockType: BlockType, face: 'TOP' | 'BOTTOM' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'): THREE.Texture {
    const cacheKey = `${blockType}_${face}`;
    
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const block = BLOCKS[blockType];
    if (!block) {
      return this.createDefaultTexture();
    }

    const texture = this.createMinecraftTexture(blockType, face);
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  private createMinecraftTexture(blockType: BlockType, face: string): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return this.createDefaultTexture();
    }

    // Determine which texture pattern to use
    let pattern: TexturePattern = TEXTURE_PATTERNS.DEFAULT;

    switch (blockType) {
      case BlockType.GRASS:
        if (face === 'TOP') pattern = TEXTURE_PATTERNS.GRASS_TOP;
        else if (face === 'BOTTOM') pattern = TEXTURE_PATTERNS.DIRT;
        else pattern = TEXTURE_PATTERNS.GRASS_SIDE;
        break;
        
      case BlockType.DIRT:
        pattern = TEXTURE_PATTERNS.DIRT;
        break;
        
      case BlockType.STONE:
      case BlockType.COBBLESTONE:
        pattern = TEXTURE_PATTERNS.STONE;
        break;
        
      case BlockType.COBBLESTONE:
        pattern = TEXTURE_PATTERNS.COBBLESTONE;
        break;
        
      case BlockType.OAK_LOG:
      case BlockType.BIRCH_LOG:
      case BlockType.SPRUCE_LOG:
      case BlockType.JUNGLE_LOG:
      case BlockType.ACACIA_LOG:
      case BlockType.DARK_OAK_LOG:
        if (face === 'TOP' || face === 'BOTTOM') pattern = TEXTURE_PATTERNS.OAK_LOG_TOP;
        else pattern = TEXTURE_PATTERNS.OAK_LOG_SIDE;
        break;
        
      case BlockType.OAK_PLANKS:
      case BlockType.BIRCH_PLANKS:
      case BlockType.SPRUCE_PLANKS:
      case BlockType.JUNGLE_PLANKS:
      case BlockType.ACACIA_PLANKS:
      case BlockType.DARK_OAK_PLANKS:
        pattern = TEXTURE_PATTERNS.OAK_PLANKS;
        break;
        
      case BlockType.OAK_LEAVES:
      case BlockType.BIRCH_LEAVES:
      case BlockType.SPRUCE_LEAVES:
      case BlockType.JUNGLE_LEAVES:
      case BlockType.ACACIA_LEAVES:
      case BlockType.DARK_OAK_LEAVES:
        pattern = TEXTURE_PATTERNS.OAK_LEAVES;
        break;
        
      case BlockType.FLOWER_RED:
        pattern = TEXTURE_PATTERNS.RED_FLOWER;
        break;
        
      case BlockType.FLOWER_YELLOW:
        pattern = TEXTURE_PATTERNS.YELLOW_FLOWER;
        break;
        
      case BlockType.WATER:
        pattern = TEXTURE_PATTERNS.WATER;
        break;
        
      case BlockType.LAVA:
        pattern = TEXTURE_PATTERNS.LAVA;
        break;
        
      case BlockType.COAL_ORE:
        pattern = TEXTURE_PATTERNS.COAL_ORE;
        break;
        
      case BlockType.IRON_ORE:
        pattern = TEXTURE_PATTERNS.IRON_ORE;
        break;
        
      case BlockType.GOLD_ORE:
        pattern = TEXTURE_PATTERNS.GOLD_ORE;
        break;
        
      case BlockType.DIAMOND_ORE:
        pattern = TEXTURE_PATTERNS.DIAMOND_ORE;
        break;
        
      case BlockType.SAND:
        pattern = TEXTURE_PATTERNS.SAND;
        break;
        
      case BlockType.GLASS:
        pattern = TEXTURE_PATTERNS.GLASS;
        break;
        
      default:
        pattern = TEXTURE_PATTERNS.DEFAULT;
        break;
    }

    // Generate the texture
    pattern.generate(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;

    return texture;
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

export const minecraftTextureGenerator = new MinecraftTextureGenerator();