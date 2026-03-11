import * as THREE from 'three';
import { BlockType, BLOCKS } from '@/data/blocks';

export class TextureAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private blockUVs: Map<BlockType, { u: number; v: number; size: number }> = new Map();
  
  readonly ATLAS_SIZE = 256;
  readonly TEX_SIZE = 16;
  readonly GRID_SIZE = 16;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.ATLAS_SIZE;
    this.canvas.height = this.ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.generateAtlas();
    
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  private generateAtlas(): void {
    this.ctx.fillStyle = '#FF00FF';
    this.ctx.fillRect(0, 0, this.ATLAS_SIZE, this.ATLAS_SIZE);

    const blockTypes = Object.values(BlockType).filter((v): v is BlockType => typeof v === 'number');
    
    for (let i = 0; i < blockTypes.length; i++) {
      const blockType = blockTypes[i];
      const gridX = i % this.GRID_SIZE;
      const gridY = Math.floor(i / this.GRID_SIZE);
      const x = gridX * this.TEX_SIZE;
      const y = gridY * this.TEX_SIZE;

      this.drawBlockTexture(blockType, x, y);

      // Flip V for Three.js (V=0 at bottom)
      const v = (this.ATLAS_SIZE - y - this.TEX_SIZE) / this.ATLAS_SIZE;
      this.blockUVs.set(blockType, {
        u: x / this.ATLAS_SIZE,
        v: v,
        size: this.TEX_SIZE / this.ATLAS_SIZE
      });
    }
  }

  private drawBlockTexture(blockType: BlockType, x: number, y: number): void {
    const block = BLOCKS[blockType];
    if (!block) return;

    const color = block.color;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, this.TEX_SIZE, this.TEX_SIZE);

    // Add noise for texture
    this.addNoise(x, y, color);

    // Special textures for different block types
    switch (blockType) {
      case BlockType.GRASS:
        this.drawGrass(x, y, block.colorTop || color);
        break;
      case BlockType.DIRT:
        this.drawDirt(x, y);
        break;
      case BlockType.STONE:
      case BlockType.COBBLESTONE:
        this.drawStone(x, y);
        break;
      case BlockType.OAK_LOG:
        this.drawLog(x, y, '#6B5839', '#A08050');
        break;
      case BlockType.OAK_LEAVES:
        this.drawLeaves(x, y, '#4A7A23');
        break;
      case BlockType.SAND:
        this.drawSand(x, y);
        break;
      case BlockType.WATER:
        this.drawWater(x, y);
        break;
    }
  }

  private addNoise(x: number, y: number, baseColor: string): void {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    
    for (let i = 0; i < 8; i++) {
      const nx = x + Math.floor(Math.random() * this.TEX_SIZE);
      const ny = y + Math.floor(Math.random() * this.TEX_SIZE);
      const shade = (Math.random() - 0.5) * 30;
      const nr = Math.max(0, Math.min(255, r + shade));
      const ng = Math.max(0, Math.min(255, g + shade));
      const nb = Math.max(0, Math.min(255, b + shade));
      this.ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
      this.ctx.fillRect(nx, ny, 1, 1);
    }
  }

  private drawGrass(x: number, y: number, topColor: string): void {
    // Grass top
    this.ctx.fillStyle = topColor;
    this.ctx.fillRect(x, y, this.TEX_SIZE, this.TEX_SIZE);
    this.addNoise(x, y, topColor);
  }

  private drawDirt(x: number, y: number): void {
    // Dirt with speckles
    for (let i = 0; i < 12; i++) {
      const dx = x + Math.floor(Math.random() * this.TEX_SIZE);
      const dy = y + Math.floor(Math.random() * this.TEX_SIZE);
      this.ctx.fillStyle = Math.random() > 0.5 ? '#6B4A1B' : '#9B7A4B';
      this.ctx.fillRect(dx, dy, 1, 1);
    }
  }

  private drawStone(x: number, y: number): void {
    // Stone with cracks
    for (let i = 0; i < 6; i++) {
      const sx = x + Math.floor(Math.random() * (this.TEX_SIZE - 2));
      const sy = y + Math.floor(Math.random() * (this.TEX_SIZE - 2));
      this.ctx.fillStyle = '#5A5A5A';
      this.ctx.fillRect(sx, sy, 2, 1);
    }
  }

  private drawLog(x: number, y: number, bark: string, rings: string): void {
    // Bark texture
    this.ctx.fillStyle = bark;
    this.ctx.fillRect(x, y, this.TEX_SIZE, this.TEX_SIZE);
    
    // Vertical bark lines
    this.ctx.fillStyle = '#4A3824';
    for (let i = 0; i < 3; i++) {
      const lx = x + i * 5 + 1;
      this.ctx.fillRect(lx, y, 1, this.TEX_SIZE);
    }
  }

  private drawLeaves(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, this.TEX_SIZE, this.TEX_SIZE);
    
    // Leaf pattern
    for (let i = 0; i < 20; i++) {
      const lx = x + Math.floor(Math.random() * this.TEX_SIZE);
      const ly = y + Math.floor(Math.random() * this.TEX_SIZE);
      this.ctx.fillStyle = Math.random() > 0.5 ? '#3A6A13' : '#5A8A33';
      this.ctx.fillRect(lx, ly, 1, 1);
    }
  }

  private drawSand(x: number, y: number): void {
    for (let i = 0; i < 30; i++) {
      const sx = x + Math.floor(Math.random() * this.TEX_SIZE);
      const sy = y + Math.floor(Math.random() * this.TEX_SIZE);
      this.ctx.fillStyle = Math.random() > 0.5 ? '#D8C492' : '#F8E4B2';
      this.ctx.fillRect(sx, sy, 1, 1);
    }
  }

  private drawWater(x: number, y: number): void {
    this.ctx.fillStyle = '#3F76E4';
    this.ctx.fillRect(x, y, this.TEX_SIZE, this.TEX_SIZE);
    
    // Wave pattern
    this.ctx.fillStyle = '#2F66D4';
    for (let i = 0; i < 4; i++) {
      const wy = y + i * 4;
      for (let wx = x; wx < x + this.TEX_SIZE; wx++) {
        if ((wx + wy) % 8 < 4) {
          this.ctx.fillRect(wx, wy, 1, 2);
        }
      }
    }
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  getUVs(blockType: BlockType): { u1: number; u2: number; v1: number; v2: number } | null {
    const uv = this.blockUVs.get(blockType);
    if (!uv) return null;
    return {
      u1: uv.u,
      u2: uv.u + uv.size,
      v1: uv.v,
      v2: uv.v + uv.size
    };
  }
}

export const textureAtlas = new TextureAtlas();
