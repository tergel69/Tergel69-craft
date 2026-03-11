import * as THREE from 'three';
import { ChunkData } from '@/stores/worldStore';
import { BlockType, BLOCKS } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { getBlockFromChunk } from '@/stores/worldStore';

// Performance-optimized mesh builder using per-block materials
export class HighPerformanceMeshBuilder {
  private static instance: HighPerformanceMeshBuilder;
  private chunkMeshCache: Map<string, THREE.Group> = new Map();
  
  // Shared materials cache
  private materialCache: Map<string, THREE.Material> = new Map();
  
  // Performance metrics
  private buildTimes: number[] = [];
  private lastCleanupTime: number = 0;
  private readonly MAX_BUILD_TIMES = 60;
  
  private constructor() {
    this.initializeMaterials();
  }
  
  static getInstance(): HighPerformanceMeshBuilder {
    if (!HighPerformanceMeshBuilder.instance) {
      HighPerformanceMeshBuilder.instance = new HighPerformanceMeshBuilder();
    }
    return HighPerformanceMeshBuilder.instance;
  }
  
  private initializeMaterials(): void {
    // Create materials for common block types with their actual colors
    const commonBlockTypes = [
      BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.COBBLESTONE,
      BlockType.SAND, BlockType.GRAVEL, BlockType.OAK_LOG, BlockType.OAK_LEAVES,
      BlockType.OAK_PLANKS, BlockType.BEDROCK, BlockType.WATER, BlockType.LAVA,
      BlockType.COAL_ORE, BlockType.IRON_ORE, BlockType.GOLD_ORE, BlockType.DIAMOND_ORE,
      BlockType.BRICK, BlockType.STONEBRICK, BlockType.SNOW, BlockType.ICE
    ];
    
    for (const blockType of commonBlockTypes) {
      const block = BLOCKS[blockType];
      if (block) {
        const material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(block.color),
          transparent: block.transparent || false,
          opacity: block.transparent ? 1.0 : 1.0,
          side: THREE.FrontSide,
          flatShading: true
        });
        this.materialCache.set(`block_${blockType}`, material);
      }
    }
    
    console.log('Materials initialized:', this.materialCache.size);
  }
  
  // Get or create a material for a block type
  private getBlockMaterial(blockType: BlockType): THREE.Material {
    const cacheKey = `block_${blockType}`;
    
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey)!;
    }
    
    // Create new material if not cached
    const block = BLOCKS[blockType];
    const color = block ? block.color : '#888888';
    
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color),
      transparent: block?.transparent || false,
      side: THREE.FrontSide,
      flatShading: true
    });
    
    this.materialCache.set(cacheKey, material);
    return material;
  }
  
  // Main method - build chunk mesh with proper colored materials
  updateChunkIncremental(chunk: ChunkData, changedBlocks?: Set<{x: number, y: number, z: number}>): THREE.Group | null {
    const startTime = performance.now();
    const cacheKey = `${chunk.x}_${chunk.z}`;
    
    // Full rebuild if no specific changes or chunk not cached
    if (!changedBlocks || changedBlocks.size > 100 || !this.chunkMeshCache.has(cacheKey)) {
      return this.buildChunkMesh(chunk);
    }
    
    // Incremental update for small changes
    const existingMesh = this.chunkMeshCache.get(cacheKey);
    if (existingMesh) {
      this.updateMeshRegion(existingMesh, chunk, changedBlocks);
      this.recordBuildTime(performance.now() - startTime);
      return existingMesh;
    }
    
    return this.buildChunkMesh(chunk);
  }
  
  private buildChunkMesh(chunk: ChunkData): THREE.Group {
    const startTime = performance.now();
    const cacheKey = `${chunk.x}_${chunk.z}`;
    
    // Clear old mesh if exists
    const oldMesh = this.chunkMeshCache.get(cacheKey);
    if (oldMesh) {
      this.disposeMeshGroup(oldMesh);
    }
    
    // Group faces by block type for multi-material rendering
    const facesByBlock: Map<BlockType, {
      vertices: number[];
      indices: number[];
      normals: number[];
    }> = new Map();
    
    // Build faces grouped by block type
    this.buildSolidBlocksGrouped(chunk, facesByBlock);
    
    // Create meshes for each block type
    const group = this.createGroupFromGroupedFaces(chunk, facesByBlock);
    this.chunkMeshCache.set(cacheKey, group);
    
    this.recordBuildTime(performance.now() - startTime);
    return group;
  }
  
  private buildSolidBlocksGrouped(
    chunk: ChunkData,
    facesByBlock: Map<BlockType, {
      vertices: number[];
      indices: number[];
      normals: number[];
    }>
  ): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const surfaceY = chunk.heightMap[z * CHUNK_SIZE + x];
        
        for (let y = surfaceY; y >= 0; y--) {
          const blockType = getBlockFromChunk(chunk, x, y, z);
          if (blockType === BlockType.AIR) continue;
          
          const block = BLOCKS[blockType];
          if (!block || block.transparent) continue;
          
          // Get or create face group for this block type
          if (!facesByBlock.has(blockType)) {
            facesByBlock.set(blockType, {
              vertices: [],
              indices: [],
              normals: []
            });
          }
          
          const faceGroup = facesByBlock.get(blockType)!;
          this.addBlockFaces(chunk, x, y, z, blockType, faceGroup);
        }
      }
    }
  }
  
  private addBlockFaces(
    chunk: ChunkData,
    x: number, y: number, z: number,
    blockType: BlockType,
    faceGroup: { vertices: number[]; indices: number[]; normals: number[] }
  ): void {
    const vx = x;
    const vy = y;
    const vz = z;
    
    // Define 6 faces of a cube (only add visible faces)
    const faces = [
      { // SOUTH (+Z)
        dir: [0, 0, 1],
        vertices: [vx, vy, vz + 1, vx + 1, vy, vz + 1, vx + 1, vy + 1, vz + 1, vx, vy + 1, vz + 1],
        normal: [0, 0, 1]
      },
      { // NORTH (-Z)
        dir: [0, 0, -1],
        vertices: [vx + 1, vy, vz, vx, vy, vz, vx, vy + 1, vz, vx + 1, vy + 1, vz],
        normal: [0, 0, -1]
      },
      { // TOP (+Y)
        dir: [0, 1, 0],
        vertices: [vx, vy + 1, vz, vx, vy + 1, vz + 1, vx + 1, vy + 1, vz + 1, vx + 1, vy + 1, vz],
        normal: [0, 1, 0]
      },
      { // BOTTOM (-Y)
        dir: [0, -1, 0],
        vertices: [vx, vy, vz + 1, vx, vy, vz, vx + 1, vy, vz, vx + 1, vy, vz + 1],
        normal: [0, -1, 0]
      },
      { // EAST (+X)
        dir: [1, 0, 0],
        vertices: [vx + 1, vy, vz + 1, vx + 1, vy, vz, vx + 1, vy + 1, vz, vx + 1, vy + 1, vz + 1],
        normal: [1, 0, 0]
      },
      { // WEST (-X)
        dir: [-1, 0, 0],
        vertices: [vx, vy, vz, vx, vy, vz + 1, vx, vy + 1, vz + 1, vx, vy + 1, vz],
        normal: [-1, 0, 0]
      }
    ];
    
    for (const face of faces) {
      // Check if face is visible (adjacent block is air)
      if (this.isFaceVisible(chunk, x + face.dir[0], y + face.dir[1], z + face.dir[2])) {
        const baseIndex = faceGroup.vertices.length / 3;
        
        // Add vertices
        faceGroup.vertices.push(...face.vertices);
        
        // Add normals (4 vertices per face)
        for (let i = 0; i < 4; i++) {
          faceGroup.normals.push(...face.normal);
        }
        
        // Add indices (2 triangles per face)
        faceGroup.indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex, baseIndex + 2, baseIndex + 3
        );
      }
    }
  }
  
  private isFaceVisible(chunk: ChunkData, x: number, y: number, z: number): boolean {
    // Chunk boundary - face is visible
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return true;
    }
    
    const neighborBlock = getBlockFromChunk(chunk, x, y, z);
    // Face is visible if neighbor is air or transparent
    if (neighborBlock === BlockType.AIR) return true;
    
    const neighborBlockData = BLOCKS[neighborBlock];
    if (neighborBlockData && neighborBlockData.transparent) return true;
    
    return false;
  }
  
  private createGroupFromGroupedFaces(
    chunk: ChunkData,
    facesByBlock: Map<BlockType, {
      vertices: number[];
      indices: number[];
      normals: number[];
    }>
  ): THREE.Group {
    const group = new THREE.Group();
    let meshCount = 0;
    
    for (const [blockType, faceGroup] of facesByBlock) {
      if (faceGroup.vertices.length === 0) continue;
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(faceGroup.vertices), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(faceGroup.indices), 1));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(faceGroup.normals), 3));
      geometry.computeVertexNormals();
      
      const material = this.getBlockMaterial(blockType);
      
      const meshPart = new THREE.Mesh(geometry, material);
      meshPart.castShadow = true;
      meshPart.receiveShadow = true;
      
      group.add(meshPart);
      meshCount++;
    }
    
    // Don't set position here - it's set in the component
    
    // If no meshes, return empty group
    if (meshCount === 0) {
      const geometry = new THREE.BufferGeometry();
      const material = this.getBlockMaterial(BlockType.STONE);
      const emptyMesh = new THREE.Mesh(geometry, material);
      group.add(emptyMesh);
    }
    
    return group;
  }
  
  private updateMeshRegion(group: THREE.Group, chunk: ChunkData, changedBlocks: Set<{x: number, y: number, z: number}>): void {
    // Full rebuild for now
    const newGroup = this.buildChunkMesh(chunk);
    
    // Replace old meshes with new ones
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      child.geometry.dispose();
    }
    
    // Copy children from new group
    while (newGroup.children.length > 0) {
      const child = newGroup.children[0] as THREE.Mesh;
      newGroup.remove(child);
      group.add(child);
    }
  }
  
  private disposeMeshGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Don't dispose shared materials
      }
    });
  }
  
  private recordBuildTime(time: number): void {
    this.buildTimes.push(time);
    if (this.buildTimes.length > this.MAX_BUILD_TIMES) {
      this.buildTimes.shift();
    }
  }
  
  // Memory management
  cleanup(): void {
    const now = performance.now();
    if (now - this.lastCleanupTime < 5000) return;
    
    this.lastCleanupTime = now;
    
    // Dispose old meshes
    for (const [key, group] of this.chunkMeshCache) {
      if (Math.random() < 0.1) {
        this.disposeMeshGroup(group);
        this.chunkMeshCache.delete(key);
      }
    }
  }
  
  // Performance metrics
  getAverageBuildTime(): number {
    if (this.buildTimes.length === 0) return 0;
    return this.buildTimes.reduce((a, b) => a + b, 0) / this.buildTimes.length;
  }
  
  getCacheStats(): { size: number; memoryEstimate: number } {
    return {
      size: this.chunkMeshCache.size,
      memoryEstimate: this.chunkMeshCache.size * 1024 * 10
    };
  }
  
  // Clear all cached meshes
  clearCache(): void {
    for (const group of this.chunkMeshCache.values()) {
      this.disposeMeshGroup(group);
    }
    this.chunkMeshCache.clear();
  }
  
  // Get the texture atlas reference for external checks
  get textureAtlas(): any {
    return null;
  }
}

export default HighPerformanceMeshBuilder.getInstance();
