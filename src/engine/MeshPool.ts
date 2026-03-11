import * as THREE from 'three';

export interface MeshPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
}

export class MeshPool {
  private pool: THREE.Mesh[] = [];
  private activeMeshes: Map<string, THREE.Mesh> = new Map();
  private config: MeshPoolConfig;
  private performanceMonitor: any;

  constructor(config: MeshPoolConfig, performanceMonitor?: any) {
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.initializePool();
  }

  private initializePool(): void {
    console.log(`Initializing mesh pool with ${this.config.initialSize} meshes`);
    
    for (let i = 0; i < this.config.initialSize; i++) {
      const mesh = this.createMeshInstance();
      this.pool.push(mesh);
    }
  }

  private createMeshInstance(): THREE.Mesh {
    // Create a basic mesh with empty geometry and material
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    
    return mesh;
  }

  acquire(key: string): THREE.Mesh {
    // Check if mesh is already active
    if (this.activeMeshes.has(key)) {
      const mesh = this.activeMeshes.get(key)!;
      mesh.visible = true;
      return mesh;
    }

    let mesh: THREE.Mesh;

    // Try to get from pool
    if (this.pool.length > 0) {
      mesh = this.pool.pop()!;
      console.log(`Reusing mesh from pool for ${key}`);
    } else {
      // Pool is empty, create new mesh or grow pool
      if (this.activeMeshes.size < this.config.maxSize) {
        mesh = this.createMeshInstance();
        console.log(`Created new mesh for ${key}`);
      } else {
        // Force reuse of oldest mesh
        mesh = this.evictOldestMesh();
        console.log(`Evicted oldest mesh for ${key}`);
      }
    }

    // Reset mesh state
    mesh.visible = true;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.userData = {};

    this.activeMeshes.set(key, mesh);
    
    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMeshPoolOperation('acquire', key);
    }

    return mesh;
  }

  release(mesh: THREE.Mesh): void {
    if (!mesh) return;

    // Remove from active meshes
    const key = this.getKeyFromMesh(mesh);
    if (key) {
      this.activeMeshes.delete(key);
    }

    // Reset mesh state for reuse
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.userData = {};

    // Dispose of geometry and material if they're not shared
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }

    // Return to pool if not at max size
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(mesh);
    } else {
      // Pool is full, destroy mesh
      this.destroyMesh(mesh);
    }

    // Track performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMeshPoolOperation('release', key || 'unknown');
    }
  }

  private evictOldestMesh(): THREE.Mesh {
    // For now, just create a new mesh since we don't have access time tracking
    // In a real implementation, we'd track last access time
    return this.createMeshInstance();
  }

  private destroyMesh(mesh: THREE.Mesh): void {
    // Clean up any remaining resources
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }

  private getKeyFromMesh(mesh: THREE.Mesh): string | null {
    // Try to find the key by searching through active meshes
    // This is not ideal but works for now
    for (const [key, activeMesh] of this.activeMeshes.entries()) {
      if (activeMesh === mesh) {
        return key;
      }
    }
    return null;
  }

  getActiveMeshCount(): number {
    return this.activeMeshes.size;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getMemoryUsage(): { active: number; pooled: number; total: number } {
    const activeMemory = this.activeMeshes.size * this.estimateMeshMemory();
    const pooledMemory = this.pool.length * this.estimateMeshMemory();
    
    return {
      active: activeMemory,
      pooled: pooledMemory,
      total: activeMemory + pooledMemory
    };
  }

  private estimateMeshMemory(): number {
    // Rough estimate of memory usage per mesh
    // This is a simplified calculation
    return 512 * 1024; // ~512KB per mesh estimate
  }

  clear(): void {
    // Release all active meshes
    for (const mesh of this.activeMeshes.values()) {
      this.release(mesh);
    }
    
    // Destroy all pooled meshes
    this.pool.forEach(mesh => this.destroyMesh(mesh));
    this.pool = [];
    
    console.log('Mesh pool cleared');
  }

  resize(newSize: number): void {
    this.config.maxSize = newSize;
    
    // If shrinking, evict excess meshes
    while (this.pool.length > newSize) {
      const mesh = this.pool.pop();
      if (mesh) {
        this.destroyMesh(mesh);
      }
    }
    
    // If growing, add more meshes to pool
    while (this.pool.length < this.config.initialSize && this.pool.length < newSize) {
      this.pool.push(this.createMeshInstance());
    }
  }

  // Performance monitoring integration
  getStats(): {
    activeMeshes: number;
    pooledMeshes: number;
    totalMeshes: number;
    memoryUsage: { active: number; pooled: number; total: number };
  } {
    return {
      activeMeshes: this.getActiveMeshCount(),
      pooledMeshes: this.getPoolSize(),
      totalMeshes: this.getActiveMeshCount() + this.getPoolSize(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Batch operations for better performance
  acquireBatch(keys: string[]): Map<string, THREE.Mesh> {
    const result = new Map<string, THREE.Mesh>();
    
    for (const key of keys) {
      result.set(key, this.acquire(key));
    }
    
    return result;
  }

  releaseBatch(meshes: THREE.Mesh[]): void {
    for (const mesh of meshes) {
      this.release(mesh);
    }
  }

  // Pre-warm the pool with a specific number of meshes
  preWarm(count: number): void {
    while (this.pool.length < count && this.pool.length < this.config.maxSize) {
      this.pool.push(this.createMeshInstance());
    }
  }
}

// Default configuration
export const DEFAULT_MESH_POOL_CONFIG: MeshPoolConfig = {
  initialSize: 8,
  maxSize: 32,
  growthFactor: 1.5
};