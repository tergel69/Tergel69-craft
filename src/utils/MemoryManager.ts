import * as THREE from 'three';

// Advanced memory management system for Three.js resources
export class MemoryManager {
  private static instance: MemoryManager;
  
  // Resource pools
  private geometryPool: Map<string, THREE.BufferGeometry[]> = new Map();
  private materialPool: Map<string, THREE.Material[]> = new Map();
  private texturePool: Map<string, THREE.Texture[]> = new Map();
  
  // Usage tracking
  private resourceUsage: Map<string, { count: number; lastUsed: number; size: number }> = new Map();
  private disposedResources: Set<string> = new Set();
  
  // Memory limits
  private maxGeometries: number = 1000;
  private maxMaterials: number = 500;
  private maxTextures: number = 200;
  private maxMemoryUsage: number = 500 * 1024 * 1024; // 500MB
  
  // Cleanup settings
  private cleanupInterval: number = 30000; // 30 seconds
  private lastCleanupTime: number = 0;
  private resourceLifetime: number = 60000; // 1 minute
  
  // Memory monitoring
  private memoryStats: {
    geometries: number;
    materials: number;
    textures: number;
    totalMemory: number;
    disposedCount: number;
  };
  
  private constructor() {
    this.memoryStats = {
      geometries: 0,
      materials: 0,
      textures: 0,
      totalMemory: 0,
      disposedCount: 0
    };
    
    // Start cleanup timer
    this.startCleanupTimer();
  }
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }
  
  // Geometry management
  getGeometry(type: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const pool = this.geometryPool.get(type);
    
    if (pool && pool.length > 0) {
      const geometry = pool.pop()!;
      this.trackResource(geometry, type);
      return geometry;
    }
    
    // Create new geometry if pool is empty
    const geometry = factory();
    this.trackResource(geometry, type);
    return geometry;
  }
  
  releaseGeometry(geometry: THREE.BufferGeometry, type: string): void {
    if (this.disposedResources.has(geometry.uuid)) return;
    
    const pool = this.geometryPool.get(type);
    if (!pool) {
      this.geometryPool.set(type, []);
      return;
    }
    
    // Clean geometry before returning to pool
    geometry.dispose();
    
    // Only keep if under limit
    if (pool.length < 50) {
      pool.push(geometry);
    } else {
      this.forceDispose(geometry);
    }
  }
  
  // Material management
  getMaterial(type: string, factory: () => THREE.Material): THREE.Material {
    const pool = this.materialPool.get(type);
    
    if (pool && pool.length > 0) {
      const material = pool.pop()!;
      this.trackResource(material, type);
      return material;
    }
    
    const material = factory();
    this.trackResource(material, type);
    return material;
  }
  
  releaseMaterial(material: THREE.Material, type: string): void {
    if (this.disposedResources.has(material.uuid)) return;
    
    const pool = this.materialPool.get(type);
    if (!pool) {
      this.materialPool.set(type, []);
      return;
    }
    
    // Reset material properties
    if (material instanceof THREE.MeshStandardMaterial) {
      material.needsUpdate = true;
    }
    
    if (pool.length < 30) {
      pool.push(material);
    } else {
      this.forceDispose(material);
    }
  }
  
  // Texture management
  getTexture(type: string, factory: () => THREE.Texture): THREE.Texture {
    const pool = this.texturePool.get(type);
    
    if (pool && pool.length > 0) {
      const texture = pool.pop()!;
      this.trackResource(texture, type);
      return texture;
    }
    
    const texture = factory();
    this.trackResource(texture, type);
    return texture;
  }
  
  releaseTexture(texture: THREE.Texture, type: string): void {
    if (this.disposedResources.has(texture.uuid)) return;
    
    const pool = this.texturePool.get(type);
    if (!pool) {
      this.texturePool.set(type, []);
      return;
    }
    
    // Reset texture properties
    texture.needsUpdate = true;
    
    if (pool.length < 20) {
      pool.push(texture);
    } else {
      this.forceDispose(texture);
    }
  }
  
  // Batch operations
  releaseResources(resources: Array<{
    resource: THREE.BufferGeometry | THREE.Material | THREE.Texture;
    type: string;
  }>): void {
    for (const { resource, type } of resources) {
      if (resource instanceof THREE.BufferGeometry) {
        this.releaseGeometry(resource, type);
      } else if (resource instanceof THREE.Material) {
        this.releaseMaterial(resource, type);
      } else if (resource instanceof THREE.Texture) {
        this.releaseTexture(resource, type);
      }
    }
  }
  
  // Resource tracking
  private trackResource(resource: THREE.BufferGeometry | THREE.Material | THREE.Texture, type: string): void {
    const size = this.estimateResourceSize(resource);
    this.resourceUsage.set(resource.uuid, {
      count: 1,
      lastUsed: performance.now(),
      size
    });
    
    this.updateMemoryStats();
  }
  
  private estimateResourceSize(resource: THREE.BufferGeometry | THREE.Material | THREE.Texture): number {
    if (resource instanceof THREE.BufferGeometry) {
      let size = 0;
      for (const name of Object.keys(resource.attributes)) {
        const attribute = resource.attributes[name];
        if (attribute) {
          size += attribute.array.byteLength;
        }
      }
      if (resource.index) {
        size += resource.index.array.byteLength;
      }
      return size;
    } else if (resource instanceof THREE.Texture) {
      // Rough estimate based on texture dimensions
      const width = resource.image?.width || 256;
      const height = resource.image?.height || 256;
      return width * height * 4; // RGBA
    } else if (resource instanceof THREE.Material) {
      return 1024; // Rough estimate for materials
    }
    return 1024;
  }
  
  // Cleanup operations
  private startCleanupTimer(): void {
    setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }
  
  private performCleanup(): void {
    const now = performance.now();
    
    // Clean up old resources
    for (const [uuid, usage] of this.resourceUsage) {
      if (now - usage.lastUsed > this.resourceLifetime) {
        this.disposeResource(uuid);
      }
    }
    
    // Clean up pool overflow
    this.cleanupPoolOverflow();
    
    // Update stats
    this.updateMemoryStats();
    this.lastCleanupTime = now;
  }
  
  private cleanupPoolOverflow(): void {
    // Geometry pools
    for (const [type, pool] of this.geometryPool) {
      while (pool.length > 50) {
        const geometry = pool.pop()!;
        this.forceDispose(geometry);
      }
    }
    
    // Material pools
    for (const [type, pool] of this.materialPool) {
      while (pool.length > 30) {
        const material = pool.pop()!;
        this.forceDispose(material);
      }
    }
    
    // Texture pools
    for (const [type, pool] of this.texturePool) {
      while (pool.length > 20) {
        const texture = pool.pop()!;
        this.forceDispose(texture);
      }
    }
  }
  
  private disposeResource(uuid: string): void {
    const usage = this.resourceUsage.get(uuid);
    if (!usage) return;
    
    // Find and dispose the actual resource
    this.findAndDisposeResource(uuid);
    
    this.resourceUsage.delete(uuid);
    this.disposedResources.add(uuid);
    this.memoryStats.disposedCount++;
  }
  
  private findAndDisposeResource(uuid: string): void {
    // Search in pools
    for (const pool of this.geometryPool.values()) {
      const index = pool.findIndex(g => g.uuid === uuid);
      if (index !== -1) {
        const geometry = pool.splice(index, 1)[0];
        geometry.dispose();
        return;
      }
    }
    
    for (const pool of this.materialPool.values()) {
      const index = pool.findIndex(m => m.uuid === uuid);
      if (index !== -1) {
        const material = pool.splice(index, 1)[0];
        material.dispose();
        return;
      }
    }
    
    for (const pool of this.texturePool.values()) {
      const index = pool.findIndex(t => t.uuid === uuid);
      if (index !== -1) {
        const texture = pool.splice(index, 1)[0];
        texture.dispose();
        return;
      }
    }
  }
  
  private forceDispose(resource: THREE.BufferGeometry | THREE.Material | THREE.Texture): void {
    resource.dispose();
    this.resourceUsage.delete(resource.uuid);
    this.disposedResources.add(resource.uuid);
    this.memoryStats.disposedCount++;
  }
  
  // Memory monitoring
  private updateMemoryStats(): void {
    let totalMemory = 0;
    let geometryCount = 0;
    let materialCount = 0;
    let textureCount = 0;
    
    for (const usage of this.resourceUsage.values()) {
      totalMemory += usage.size;
    }
    
    for (const pool of this.geometryPool.values()) {
      geometryCount += pool.length;
    }
    
    for (const pool of this.materialPool.values()) {
      materialCount += pool.length;
    }
    
    for (const pool of this.texturePool.values()) {
      textureCount += pool.length;
    }
    
    this.memoryStats = {
      geometries: geometryCount,
      materials: materialCount,
      textures: textureCount,
      totalMemory,
      disposedCount: this.memoryStats.disposedCount
    };
  }
  
  // Public API
  getMemoryStats() {
    return { ...this.memoryStats };
  }
  
  getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    isNearLimit: boolean;
  } {
    const used = this.memoryStats.totalMemory;
    const total = this.maxMemoryUsage;
    const percentage = (used / total) * 100;
    
    return {
      used,
      total,
      percentage,
      isNearLimit: percentage > 80
    };
  }
  
  // Emergency cleanup
  emergencyCleanup(): void {
    // Clear all pools
    for (const pool of this.geometryPool.values()) {
      for (const geometry of pool) {
        geometry.dispose();
      }
      pool.length = 0;
    }
    
    for (const pool of this.materialPool.values()) {
      for (const material of pool) {
        material.dispose();
      }
      pool.length = 0;
    }
    
    for (const pool of this.texturePool.values()) {
      for (const texture of pool) {
        texture.dispose();
      }
      pool.length = 0;
    }
    
    // Clear tracking
    this.resourceUsage.clear();
    this.disposedResources.clear();
    
    // Update stats
    this.updateMemoryStats();
  }
  
  // Configuration
  setLimits(limits: {
    maxGeometries?: number;
    maxMaterials?: number;
    maxTextures?: number;
    maxMemoryUsage?: number;
  }): void {
    if (limits.maxGeometries) this.maxGeometries = limits.maxGeometries;
    if (limits.maxMaterials) this.maxMaterials = limits.maxMaterials;
    if (limits.maxTextures) this.maxTextures = limits.maxTextures;
    if (limits.maxMemoryUsage) this.maxMemoryUsage = limits.maxMemoryUsage;
  }
  
  setCleanupSettings(settings: {
    interval?: number;
    resourceLifetime?: number;
  }): void {
    if (settings.interval) this.cleanupInterval = settings.interval;
    if (settings.resourceLifetime) this.resourceLifetime = settings.resourceLifetime;
  }
}

// Utility functions for memory management
export class MemoryUtils {
  static disposeObject3D(object3D: THREE.Object3D): void {
    // Dispose all children recursively
    object3D.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    
    // Remove from parent
    if (object3D.parent) {
      object3D.parent.remove(object3D);
    }
  }
  
  static createDisposableResource<T extends THREE.Object3D>(
    factory: () => T,
    memoryManager: MemoryManager
  ): T {
    const resource = factory();
    
    // Add disposal method
    (resource as any).dispose = () => {
      MemoryUtils.disposeObject3D(resource);
    };
    
    return resource;
  }
  
  static estimateMemoryUsage(object3D: THREE.Object3D): number {
    let totalSize = 0;
    
    object3D.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          // Estimate geometry size
          totalSize += child.geometry.attributes.position?.array.byteLength || 0;
          totalSize += child.geometry.attributes.normal?.array.byteLength || 0;
          totalSize += child.geometry.attributes.uv?.array.byteLength || 0;
          totalSize += child.geometry.index?.array.byteLength || 0;
        }
        
        if (child.material) {
          // Estimate material size
          totalSize += 1024; // Rough estimate
        }
      }
    });
    
    return totalSize;
  }
}

export default MemoryManager.getInstance();
