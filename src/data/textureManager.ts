import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';
import { simpleTextureSystem } from './simpleTextures';

type FaceType = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west' | 'side';

// Texture manager for handling different block textures with face support
export class TextureManager {
  private textureCache = new Map<string, THREE.Texture>();
  private preloadedTextures = new Set<string>();

  // Get texture for a specific block type and face
  getBlockTexture(blockType: BlockType, face: FaceType = 'side'): THREE.Texture {
    // Normalize face to basic types (top, side, bottom)
    const normalizedFace = this.normalizeFace(face);
    const cacheKey = `${blockType}_${normalizedFace}`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    // Generate texture using the simple texture system
    const texture = simpleTextureSystem.getBlockTexture(blockType, normalizedFace);
    
    // Optimize texture settings for better performance
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false; // Disable mipmaps for pixel art style
    texture.needsUpdate = true;
    
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  // Normalize directional faces to basic types
  private normalizeFace(face: FaceType): 'top' | 'side' | 'bottom' {
    switch (face) {
      case 'top':
        return 'top';
      case 'bottom':
        return 'bottom';
      case 'north':
      case 'south':
      case 'east':
      case 'west':
      case 'side':
      default:
        return 'side';
    }
  }

  // Get a default texture (for materials that need a single texture)
  getDefaultTexture(): THREE.Texture {
    return this.getBlockTexture(BlockType.STONE);
  }

  // Clear all cached textures
  clearCache(): void {
    this.textureCache.clear();
    simpleTextureSystem.clearCache();
  }

  // Get texture coordinates for a specific block type and face
  getTextureCoords(blockType: BlockType, faceIndex: number): THREE.Vector4 {
    const textureIndex = this.getTextureIndex(blockType);

    const u = (textureIndex % 16) / 16;
    const v = Math.floor(textureIndex / 16) / 16;
    const size = 1/16;

    return new THREE.Vector4(u, v, size, size);
  }

  // Get texture index for a block type
  private getTextureIndex(blockType: BlockType): number {
    const blockTypes = Object.values(BlockType);
    return blockTypes.indexOf(blockType) % 256;
  }

  // Preload common textures for better performance (optimized)
  async preloadCommonTextures(): Promise<void> {
    // Preload only essential blocks for better memory usage
    const essentialBlocks = [
      BlockType.STONE, BlockType.DIRT, BlockType.GRASS, BlockType.SAND,
      BlockType.WATER, BlockType.OAK_LOG, BlockType.OAK_LEAVES, BlockType.COBBLESTONE,
      BlockType.BEDROCK, BlockType.OAK_PLANKS
    ].filter(block => block !== undefined);

    const faces: ('top' | 'side' | 'bottom')[] = ['top', 'side', 'bottom'];
    
    // Batch preload for better performance
    const preloadPromises: Promise<void>[] = [];
    
    for (const block of essentialBlocks) {
      for (const face of faces) {
        const cacheKey = `${block}_${face}`;
        if (!this.preloadedTextures.has(cacheKey)) {
          preloadPromises.push(
            new Promise<void>((resolve) => {
              requestIdleCallback(() => {
                this.getBlockTexture(block, face);
                this.preloadedTextures.add(cacheKey);
                resolve();
              });
            })
          );
        }
      }
    }
    
    await Promise.all(preloadPromises);
  }
}

export const textureManager = new TextureManager();

// Preload textures immediately on module load for instant access
textureManager.preloadCommonTextures().catch(err => {
  console.warn('Texture preload failed:', err);
});
