import * as THREE from 'three';
import { ChunkData } from '@/stores/worldStore';
import { BlockType, BLOCKS } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { getBlockFromChunk } from '@/stores/worldStore';
import { textureManager } from '@/data/textureManager';
import { useGameStore } from '@/stores/gameStore';
import { buildChunkMesh as buildBaseChunkMesh, buildWaterMesh, createWaterMaterial } from './MeshBuilder';

export interface MeshBuildConfig {
  enableFaceCulling: boolean;
  enableLighting: boolean;
  enableTextureAtlas: boolean;
  maxVertices: number;
  useInstancing: boolean;
}

export class OptimizedMeshBuilder {
  private config: MeshBuildConfig;
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  private vertexBuffer: Float32Array;
  private indexBuffer: Uint32Array;
  private colorBuffer: Float32Array;
  private uvBuffer: Float32Array;
  private currentVertexCount: number = 0;
  private currentIndexCount: number = 0;

  constructor(config: Partial<MeshBuildConfig> = {}) {
    this.config = {
      enableFaceCulling: true,
      enableLighting: true,
      enableTextureAtlas: true,
      maxVertices: 65536,
      useInstancing: false,
      ...config
    };

    // Pre-allocate buffers for better performance
    this.vertexBuffer = new Float32Array(this.config.maxVertices * 3);
    this.indexBuffer = new Uint32Array(this.config.maxVertices * 6);
    this.colorBuffer = new Float32Array(this.config.maxVertices * 3);
    this.uvBuffer = new Float32Array(this.config.maxVertices * 2);
  }

  buildMesh(chunk: ChunkData): THREE.Mesh {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(chunk);
    if (this.geometryCache.has(cacheKey)) {
      const geometry = this.geometryCache.get(cacheKey)!;
      const material = this.materialCache.get(cacheKey)!;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE);
      return mesh;
    }

    // Reset buffers
    this.currentVertexCount = 0;
    this.currentIndexCount = 0;

    // Build mesh data
    this.buildChunkMeshData(chunk);

    // Create geometry
    const geometry = this.createGeometry();
    
    // Create material
    const material = this.createMaterial();

    // Cache the results
    this.geometryCache.set(cacheKey, geometry);
    this.materialCache.set(cacheKey, material);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE);

    // Track performance
    const buildTime = performance.now() - startTime;
    if (useGameStore.getState().showDebug) {
      console.log(`Mesh built in ${buildTime.toFixed(2)}ms for chunk ${chunk.x},${chunk.z}`);
    }

    return mesh;
  }

  private buildChunkMeshData(chunk: ChunkData): void {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Find the highest solid block in this column
        let y = chunk.heightMap[z * CHUNK_SIZE + x];
        
        // Build down from the highest block
        for (; y >= 0; y--) {
          const blockType = getBlockFromChunk(chunk, x, y, z);
          
          if (blockType === BlockType.AIR) continue;

          const block = BLOCKS[blockType];
          if (!block) continue;

          // Add faces based on neighbors
          this.addBlockFaces(
            chunk, x, y, z, blockType, 
            vertices, indices, colors, uvs
          );
        }
      }
    }

    // Copy to typed arrays
    this.copyToBuffers(vertices, indices, colors, uvs);
  }

  private addBlockFaces(
    chunk: ChunkData,
    x: number, y: number, z: number,
    blockType: BlockType,
    vertices: number[], indices: number[], colors: number[], uvs: number[]
  ): void {
    const block = BLOCKS[blockType];
    if (!block) return;

    // Define cube vertices
    const size = 1;
    const halfSize = size / 2;
    
    const vx = x + 0.5;
    const vy = y + 0.5;
    const vz = z + 0.5;

    const cubeVertices = [
      // Front face
      vx - halfSize, vy + halfSize, vz + halfSize,
      vx + halfSize, vy + halfSize, vz + halfSize,
      vx + halfSize, vy - halfSize, vz + halfSize,
      vx - halfSize, vy - halfSize, vz + halfSize,
      
      // Back face
      vx - halfSize, vy + halfSize, vz - halfSize,
      vx + halfSize, vy + halfSize, vz - halfSize,
      vx + halfSize, vy - halfSize, vz - halfSize,
      vx - halfSize, vy - halfSize, vz - halfSize,
      
      // Top face
      vx - halfSize, vy + halfSize, vz - halfSize,
      vx + halfSize, vy + halfSize, vz - halfSize,
      vx + halfSize, vy + halfSize, vz + halfSize,
      vx - halfSize, vy + halfSize, vz + halfSize,
      
      // Bottom face
      vx - halfSize, vy - halfSize, vz - halfSize,
      vx + halfSize, vy - halfSize, vz - halfSize,
      vx + halfSize, vy - halfSize, vz + halfSize,
      vx - halfSize, vy - halfSize, vz + halfSize,
      
      // Right face
      vx + halfSize, vy + halfSize, vz - halfSize,
      vx + halfSize, vy + halfSize, vz + halfSize,
      vx + halfSize, vy - halfSize, vz + halfSize,
      vx + halfSize, vy - halfSize, vz - halfSize,
      
      // Left face
      vx - halfSize, vy + halfSize, vz - halfSize,
      vx - halfSize, vy + halfSize, vz + halfSize,
      vx - halfSize, vy - halfSize, vz + halfSize,
      vx - halfSize, vy - halfSize, vz - halfSize,
    ];

    // Define face indices
    const faces = [
      // Front (0, 1, 2, 3)
      [0, 1, 2, 3],
      // Back (4, 7, 6, 5)
      [4, 7, 6, 5],
      // Top (8, 9, 10, 11)
      [8, 9, 10, 11],
      // Bottom (12, 15, 14, 13)
      [12, 15, 14, 13],
      // Right (16, 17, 18, 19)
      [16, 17, 18, 19],
      // Left (20, 23, 22, 21)
      [20, 23, 22, 21],
    ];

    // Face normals
    const normals = [
      [0, 0, 1],  // Front
      [0, 0, -1], // Back
      [0, 1, 0],  // Top
      [0, -1, 0], // Bottom
      [1, 0, 0],  // Right
      [-1, 0, 0], // Left
    ];

    // Check each face
    for (let i = 0; i < 6; i++) {
      const face = faces[i];
      const normal = normals[i];

      // Face culling optimization
      if (this.config.enableFaceCulling) {
        const neighborX = x + normal[0];
        const neighborY = y + normal[1];
        const neighborZ = z + normal[2];

        if (this.isFaceVisible(chunk, neighborX, neighborY, neighborZ)) {
          this.addFace(
            cubeVertices, face, normal,
            vertices, indices, colors, uvs,
            blockType, i
          );
        }
      } else {
        // Add all faces (for debugging or special cases)
        this.addFace(
          cubeVertices, face, normal,
          vertices, indices, colors, uvs,
          blockType, i
        );
      }
    }
  }

  private isFaceVisible(chunk: ChunkData, x: number, y: number, z: number): boolean {
    // Check if coordinates are within chunk bounds
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return true; // Visible if outside chunk
    }

    if (y < 0 || y >= CHUNK_HEIGHT) {
      return true; // Visible if outside world
    }

    // Check if neighbor block is air
    const neighborBlock = getBlockFromChunk(chunk, x, y, z);
    return neighborBlock === BlockType.AIR;
  }

  private addFace(
    vertices: number[], face: number[], normal: number[],
    outVertices: number[], outIndices: number[], outColors: number[], outUvs: number[],
    blockType: BlockType, faceIndex: number
  ): void {
    const startIndex = outVertices.length / 3;

    // Add vertices for this face
    for (let i = 0; i < 4; i++) {
      const vertexIndex = face[i];
      outVertices.push(
        vertices[vertexIndex * 3],
        vertices[vertexIndex * 3 + 1],
        vertices[vertexIndex * 3 + 2]
      );

      // Add color
      const color = this.getBlockColor(blockType, faceIndex);
      outColors.push(color.r, color.g, color.b);

      // Add UV coordinates
      const uv = this.getFaceUV(blockType, faceIndex, i);
      outUvs.push(uv.u, uv.v);
    }

    // Add indices for two triangles
    outIndices.push(
      startIndex, startIndex + 1, startIndex + 2,
      startIndex, startIndex + 2, startIndex + 3
    );
  }

  private getBlockColor(blockType: BlockType, faceIndex: number): { r: number; g: number; b: number } {
    const block = BLOCKS[blockType];
    if (!block) return { r: 0.5, g: 0.5, b: 0.5 };

    // Apply lighting based on face direction
    const baseColor = this.hexToRgb(block.color);
    const lightIntensity = this.getFaceLightIntensity(faceIndex);
    
    return {
      r: baseColor.r * lightIntensity,
      g: baseColor.g * lightIntensity,
      b: baseColor.b * lightIntensity
    };
  }

  private getFaceLightIntensity(faceIndex: number): number {
    // Different lighting for different faces
    const intensities = [0.8, 0.6, 1.0, 0.4, 0.7, 0.7];
    return intensities[faceIndex] || 0.8;
  }

  private getFaceUV(blockType: BlockType, faceIndex: number, vertexIndex: number): { u: number; v: number } {
    // Simple UV mapping - could be enhanced with texture atlas
    const u = vertexIndex % 2;
    const v = Math.floor(vertexIndex / 2);
    
    return { u, v };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    return {
      r: ((num >> 16) & 0xff) / 255,
      g: ((num >> 8) & 0xff) / 255,
      b: (num & 0xff) / 255
    };
  }

  private copyToBuffers(vertices: number[], indices: number[], colors: number[], uvs: number[]): void {
    // Copy vertices
    for (let i = 0; i < vertices.length; i++) {
      this.vertexBuffer[i] = vertices[i];
    }
    this.currentVertexCount = vertices.length / 3;

    // Copy indices
    for (let i = 0; i < indices.length; i++) {
      this.indexBuffer[i] = indices[i];
    }
    this.currentIndexCount = indices.length;

    // Copy colors
    for (let i = 0; i < colors.length; i++) {
      this.colorBuffer[i] = colors[i];
    }

    // Copy UVs
    for (let i = 0; i < uvs.length; i++) {
      this.uvBuffer[i] = uvs[i];
    }
  }

  private createGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    
    geometry.setAttribute('position', new THREE.BufferAttribute(this.vertexBuffer.slice(0, this.currentVertexCount * 3), 3));
    geometry.setIndex(new THREE.BufferAttribute(this.indexBuffer.slice(0, this.currentIndexCount), 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colorBuffer.slice(0, this.currentVertexCount * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvBuffer.slice(0, this.currentVertexCount * 2), 2));
    
    geometry.computeVertexNormals();
    
    return geometry;
  }

  private createMaterial(): THREE.Material {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.2
    });

    return material;
  }

  private getCacheKey(chunk: ChunkData): string {
    // Create a hash based on chunk data that affects mesh generation
    const key = `${chunk.x}_${chunk.z}_${chunk.isDirty ? 'dirty' : 'clean'}`;
    return key;
  }

  // Batch mesh building for multiple chunks
  buildMeshes(chunks: ChunkData[]): Map<string, THREE.Mesh> {
    const result = new Map<string, THREE.Mesh>();
    
    for (const chunk of chunks) {
      const mesh = this.buildMesh(chunk);
      result.set(`${chunk.x}_${chunk.z}`, mesh);
    }
    
    return result;
  }

  // Clear geometry and material caches
  clearCache(): void {
    // Dispose of cached geometries and materials
    for (const geometry of this.geometryCache.values()) {
      geometry.dispose();
    }
    for (const material of this.materialCache.values()) {
      if (Array.isArray(material)) {
        material.forEach(mat => mat.dispose());
      } else {
        material.dispose();
      }
    }
    
    this.geometryCache.clear();
    this.materialCache.clear();
  }

  // Get memory usage statistics
  getMemoryStats(): {
    geometryCacheSize: number;
    materialCacheSize: number;
    totalCacheSize: number;
  } {
    return {
      geometryCacheSize: this.geometryCache.size,
      materialCacheSize: this.materialCache.size,
      totalCacheSize: this.geometryCache.size + this.materialCache.size
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<MeshBuildConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Static method for building chunk meshes with water support
  static buildChunkMesh(
    chunk: ChunkData,
    neighbors: {
      north?: ChunkData;
      south?: ChunkData;
      east?: ChunkData;
      west?: ChunkData;
    }
  ): { meshes: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>; waterGeometry?: THREE.BufferGeometry } | null {
    // Build solid block geometry
    const solidGeometry = buildBaseChunkMesh(chunk, neighbors);
    
    // Build water geometry
    const waterGeometry = buildWaterMesh(chunk, neighbors);
    
    if (!solidGeometry && !waterGeometry) {
      return null;
    }
    
    const result: { meshes: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>; waterGeometry?: THREE.BufferGeometry } = {
      meshes: []
    };
    
    if (solidGeometry) {
      result.meshes.push({
        geometry: solidGeometry,
        material: new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.FrontSide,
        })
      });
    }
    
    if (waterGeometry) {
      result.waterGeometry = waterGeometry;
    }
    
    return result;
  }
}

// Default configuration
export const DEFAULT_MESH_BUILD_CONFIG: MeshBuildConfig = {
  enableFaceCulling: true,
  enableLighting: true,
  enableTextureAtlas: true,
  maxVertices: 65536,
  useInstancing: false,
};

// Shared water material for all water meshes
export const sharedWaterMaterial = createWaterMaterial();