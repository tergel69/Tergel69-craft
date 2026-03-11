import * as THREE from 'three';
import { ChunkData } from '@/stores/worldStore';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { OptimizedMeshBuilder, sharedWaterMaterial } from './OptimizedMeshBuilder';

// LOD levels for chunk rendering
export enum LODLevel {
  HIGH = 0,    // Full detail (16x16x256)
  MEDIUM = 1,  // Medium detail (8x8x128)
  LOW = 2,     // Low detail (4x4x64)
  VERY_LOW = 3, // Very low detail (2x2x32)
  INVISIBLE = 4 // Don't render
}

interface LODConfig {
  high: number;      // Distance for HIGH detail (0-50 blocks)
  medium: number;    // Distance for MEDIUM detail (50-100 blocks)
  low: number;       // Distance for LOW detail (100-200 blocks)
  veryLow: number;   // Distance for VERY_LOW detail (200-400 blocks)
  invisible: number; // Distance for INVISIBLE (400+ blocks)
}

interface ChunkLODData {
  level: LODLevel;
  lastUpdateTime: number;
  mesh?: THREE.Group;
  boundingBox: THREE.Box3;
}

export class LODSystem {
  private lodConfig: LODConfig = {
    high: 50,
    medium: 100,
    low: 200,
    veryLow: 400,
    invisible: 600
  };

  private chunkLODData = new Map<string, ChunkLODData>();
  private cameraPosition = new THREE.Vector3();
  private cameraFrustum = new THREE.Frustum();
  private lastLODUpdate = 0;

  constructor() {
    // Adjust LOD distances based on render distance
    this.updateLODConfig();
  }

  updateLODConfig(): void {
    // Get current render distance from game store
    // For now, use default values that scale with render distance
    const baseHigh = 40;
    const baseMedium = 80;
    const baseLow = 160;
    const baseVeryLow = 320;
    const baseInvisible = 500;

    this.lodConfig = {
      high: baseHigh,
      medium: baseMedium,
      low: baseLow,
      veryLow: baseVeryLow,
      invisible: baseInvisible
    };
  }

  update(
    cameraPosition: THREE.Vector3,
    cameraFrustum: THREE.Frustum,
    chunks: Array<{ x: number; z: number; key: string }>
  ): void {
    this.cameraPosition.copy(cameraPosition);
    this.cameraFrustum.copy(cameraFrustum);

    const now = performance.now();
    
    // Update LOD every 100ms to avoid performance overhead
    if (now - this.lastLODUpdate < 100) return;
    
    this.lastLODUpdate = now;

    // Update LOD for each chunk
    for (const { x, z, key } of chunks) {
      const chunkData = this.getOrCreateLODData(key, x, z);
      const distance = this.getChunkDistance(x, z);
      
      const newLevel = this.getLODLevel(distance);
      
      if (newLevel !== chunkData.level) {
        chunkData.level = newLevel;
        chunkData.lastUpdateTime = now;
      }
    }
  }

  getLODLevel(distance: number): LODLevel {
    if (distance <= this.lodConfig.high) return LODLevel.HIGH;
    if (distance <= this.lodConfig.medium) return LODLevel.MEDIUM;
    if (distance <= this.lodConfig.low) return LODLevel.LOW;
    if (distance <= this.lodConfig.veryLow) return LODLevel.VERY_LOW;
    return LODLevel.INVISIBLE;
  }

  getChunkDistance(chunkX: number, chunkZ: number): number {
    const chunkWorldX = chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
    const chunkWorldZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;
    
    return Math.sqrt(
      Math.pow(chunkWorldX - this.cameraPosition.x, 2) +
      Math.pow(chunkWorldZ - this.cameraPosition.z, 2)
    );
  }

  shouldRenderChunk(chunkX: number, chunkZ: number): boolean {
    const distance = this.getChunkDistance(chunkX, chunkZ);
    return distance <= this.lodConfig.invisible;
  }

  shouldUpdateChunk(chunkX: number, chunkZ: number): boolean {
    const distance = this.getChunkDistance(chunkX, chunkZ);
    return distance <= this.lodConfig.medium;
  }

  getOptimalChunkDetail(distance: number): { scale: number; heightScale: number } {
    if (distance <= this.lodConfig.high) {
      return { scale: 1, heightScale: 1 };
    } else if (distance <= this.lodConfig.medium) {
      return { scale: 2, heightScale: 2 };
    } else if (distance <= this.lodConfig.low) {
      return { scale: 4, heightScale: 4 };
    } else if (distance <= this.lodConfig.veryLow) {
      return { scale: 8, heightScale: 8 };
    } else {
      return { scale: 16, heightScale: 16 };
    }
  }

  createLODChunkMesh(
    chunk: ChunkData,
    neighbors: {
      north?: ChunkData;
      south?: ChunkData;
      east?: ChunkData;
      west?: ChunkData;
    },
    lodLevel: LODLevel
  ): THREE.Group | null {
    if (lodLevel === LODLevel.INVISIBLE) {
      return null;
    }

    // For now, return the standard mesh
    // In a full implementation, this would create simplified meshes
    const result = OptimizedMeshBuilder.buildChunkMesh(chunk, neighbors);
    
    if (!result) return null;

    const group = new THREE.Group();
    
    // Add solid block meshes
    for (const meshData of result.meshes) {
      const mesh = new THREE.Mesh(meshData.geometry, meshData.material);
      group.add(mesh);
    }

    // Add water mesh
    if (result.waterGeometry) {
      const waterMesh = new THREE.Mesh(result.waterGeometry, sharedWaterMaterial);
      group.add(waterMesh);
    }

    return group;
  }

  private getOrCreateLODData(key: string, chunkX: number, chunkZ: number): ChunkLODData {
    if (this.chunkLODData.has(key)) {
      return this.chunkLODData.get(key)!;
    }

    const chunkWorldX = chunkX * CHUNK_SIZE;
    const chunkWorldZ = chunkZ * CHUNK_SIZE;

    const data: ChunkLODData = {
      level: LODLevel.HIGH,
      lastUpdateTime: performance.now(),
      boundingBox: new THREE.Box3(
        new THREE.Vector3(chunkWorldX, 0, chunkWorldZ),
        new THREE.Vector3(chunkWorldX + CHUNK_SIZE, CHUNK_HEIGHT, chunkWorldZ + CHUNK_SIZE)
      )
    };

    this.chunkLODData.set(key, data);
    return data;
  }

  getLODStats(): { 
    highDetail: number; 
    mediumDetail: number; 
    lowDetail: number; 
    veryLowDetail: number; 
    invisible: number; 
  } {
    const stats = {
      highDetail: 0,
      mediumDetail: 0,
      lowDetail: 0,
      veryLowDetail: 0,
      invisible: 0
    };

    for (const data of this.chunkLODData.values()) {
      switch (data.level) {
        case LODLevel.HIGH:
          stats.highDetail++;
          break;
        case LODLevel.MEDIUM:
          stats.mediumDetail++;
          break;
        case LODLevel.LOW:
          stats.lowDetail++;
          break;
        case LODLevel.VERY_LOW:
          stats.veryLowDetail++;
          break;
        case LODLevel.INVISIBLE:
          stats.invisible++;
          break;
      }
    }

    return stats;
  }

  clear(): void {
    this.chunkLODData.clear();
  }

  // Memory optimization: dispose of LOD data for distant chunks
  cleanupDistantChunks(maxDistance: number = 1000): void {
    const keysToDelete: string[] = [];
    
    for (const [key, data] of this.chunkLODData) {
      const center = data.boundingBox.getCenter(new THREE.Vector3());
      const distance = this.cameraPosition.distanceTo(center);
      
      if (distance > maxDistance) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.chunkLODData.delete(key);
    }
  }

  // Get recommended render distance based on performance
  getRecommendedRenderDistance(currentFPS: number): number {
    if (currentFPS >= 60) return 12;
    if (currentFPS >= 45) return 10;
    if (currentFPS >= 30) return 8;
    if (currentFPS >= 20) return 6;
    return 4; // Minimum
  }

  // Dynamic LOD adjustment based on performance
  adjustLODForPerformance(currentFPS: number): void {
    const adjustment = Math.max(0, (60 - currentFPS) / 10);
    
    this.lodConfig.high = Math.max(20, this.lodConfig.high - adjustment * 5);
    this.lodConfig.medium = Math.max(40, this.lodConfig.medium - adjustment * 10);
    this.lodConfig.low = Math.max(80, this.lodConfig.low - adjustment * 20);
    this.lodConfig.veryLow = Math.max(160, this.lodConfig.veryLow - adjustment * 40);
  }
}

// Singleton instance
export const lodSystem = new LODSystem();

// LOD utilities for mesh simplification
export class LODUtils {
  // Simplify geometry for lower LOD levels
  static simplifyGeometry(geometry: THREE.BufferGeometry, targetReduction: number): THREE.BufferGeometry {
    // This is a placeholder for actual geometry simplification
    // In a real implementation, you'd use algorithms like:
    // - Quadric Error Metrics
    // - Edge Collapse
    // - Vertex Clustering
    
    // For now, return the original geometry
    return geometry;
  }

  // Create simplified mesh for LOD
  static createSimplifiedMesh(
    geometry: THREE.BufferGeometry, 
    material: THREE.Material, 
    lodLevel: LODLevel
  ): THREE.Mesh {
    const simplifiedGeometry = this.simplifyGeometry(geometry, lodLevel * 0.3);
    return new THREE.Mesh(simplifiedGeometry, material);
  }

  // Batch similar meshes for better performance
  static batchMeshes(meshes: THREE.Mesh[]): THREE.InstancedMesh | null {
    if (meshes.length === 0) return null;

    // Group meshes by material
    const materialGroups = new Map<THREE.Material, THREE.Mesh[]>();
    
    for (const mesh of meshes) {
      const material = mesh.material;
      // Handle both single materials and material arrays
      if (Array.isArray(material)) {
        // For multi-material meshes, use the first material as the key
        const firstMaterial = material[0];
        if (!materialGroups.has(firstMaterial)) {
          materialGroups.set(firstMaterial, []);
        }
        materialGroups.get(firstMaterial)!.push(mesh);
      } else {
        if (!materialGroups.has(material)) {
          materialGroups.set(material, []);
        }
        materialGroups.get(material)!.push(mesh);
      }
    }

    // Create instanced meshes for each material group
    const instancedMeshes: THREE.InstancedMesh[] = [];
    
    for (const [material, groupMeshes] of materialGroups) {
      if (groupMeshes.length < 2) continue; // Skip if only one mesh

      const geometry = groupMeshes[0].geometry;
      const instancedMesh = new THREE.InstancedMesh(geometry, material, groupMeshes.length);
      
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < groupMeshes.length; i++) {
        matrix.copy(groupMeshes[i].matrixWorld);
        instancedMesh.setMatrixAt(i, matrix);
      }
      
      instancedMeshes.push(instancedMesh);
    }

    return instancedMeshes.length > 0 ? instancedMeshes[0] : null;
  }
}