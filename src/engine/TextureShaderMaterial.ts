import * as THREE from 'three';
import { BlockType } from '@/data/blocks';
import { textureManager } from '@/data/textureManager';

// Custom shader material that supports texture mapping with vertex colors
export class TextureShaderMaterial extends THREE.MeshLambertMaterial {
  private textureCache = new Map<BlockType, THREE.Texture>();

  constructor() {
    super({
      vertexColors: true,
      side: THREE.FrontSide,
      transparent: false,
    });
  }

  // Get texture for a specific block type
  getBlockTexture(blockType: BlockType): THREE.Texture {
    if (this.textureCache.has(blockType)) {
      return this.textureCache.get(blockType)!;
    }

    const texture = textureManager.getBlockTexture(blockType);
    this.textureCache.set(blockType, texture);
    return texture;
  }

  // Clear texture cache
  clearCache(): void {
    this.textureCache.clear();
  }

  // Update material with new texture
  updateTexture(blockType: BlockType): void {
    const texture = this.getBlockTexture(blockType);
    this.map = texture;
    this.needsUpdate = true;
  }
}

// Create a shared instance
export const textureShaderMaterial = new TextureShaderMaterial();