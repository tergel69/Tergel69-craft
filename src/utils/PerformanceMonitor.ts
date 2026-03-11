import { useGameStore } from '@/stores/gameStore';
import { useWorldStore } from '@/stores/worldStore';
import { optimizedEntityManager } from '@/entities/OptimizedEntityManager';
import { getOptimizedChunkManager } from '@/engine/OptimizedChunkManager';
import { OptimizedMeshBuilder } from '@/engine/OptimizedMeshBuilder';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  chunkCount: number;
  entityCount: number;
  meshCacheSize: number;
  memoryUsage: {
    geometries: number;
    textures: number;
    materials: number;
  };
  generationStats: {
    queueSize: number;
    isGenerating: boolean;
    budget: number;
  };
  entityStats: {
    entityCount: number;
    gridCellCount: number;
    averageEntitiesPerCell: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    chunkCount: 0,
    entityCount: 0,
    meshCacheSize: 0,
    memoryUsage: {
      geometries: 0,
      textures: 0,
      materials: 0
    },
    generationStats: {
      queueSize: 0,
      isGenerating: false,
      budget: 0
    },
    entityStats: {
      entityCount: 0,
      gridCellCount: 0,
      averageEntitiesPerCell: 0
    }
  };

  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private isMonitoring: boolean = false;
  private updateInterval: number = 1000; // Update every second

  start(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;
    
    // Start monitoring loop
    this.monitorLoop();
  }

  stop(): void {
    this.isMonitoring = false;
  }

  private monitorLoop(): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    // Update FPS every second
    if (now - this.lastFpsUpdate >= 1000) {
      this.metrics.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
      this.metrics.frameTime = Math.round(frameTime);
      this.lastFpsUpdate = now;
      this.frameCount = 0;

      // Update all metrics
      this.updateMetrics();
    }

    requestAnimationFrame(() => this.monitorLoop());
  }

  private updateMetrics(): void {
    // Chunk metrics
    this.metrics.chunkCount = useWorldStore.getState().getLoadedChunkCount();

    // Entity metrics
    this.metrics.entityCount = optimizedEntityManager.getCount();
    const stats = optimizedEntityManager.getStats();
    this.metrics.entityStats = {
      entityCount: stats.activeEntities,
      gridCellCount: stats.spatialGridCells,
      averageEntitiesPerCell: stats.spatialGridCells > 0 ? stats.activeEntities / stats.spatialGridCells : 0,
    };

    // Generation metrics
    const chunkManager = getOptimizedChunkManager();
    const genStats = chunkManager.getGenerationStats();
    this.metrics.generationStats = genStats;

    // Mesh cache metrics
    const cacheStats = (OptimizedMeshBuilder as any).getCacheStats?.() ?? { size: 0 };
    this.metrics.meshCacheSize = cacheStats.size;

    // Memory usage estimation
    this.metrics.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): { geometries: number; textures: number; materials: number } {
    // This is a rough estimation based on typical Three.js memory usage
    const worldStore = useWorldStore.getState();
    const loadedChunks = Array.from(worldStore.loadedChunks);
    
    let geometryCount = 0;
    let textureCount = 0;
    let materialCount = 0;

    // Estimate based on loaded chunks
    for (const key of loadedChunks) {
      const [x, z] = key.split(',').map(Number);
      const chunk = worldStore.getChunk(x, z);
      if (chunk && chunk.isGenerated) {
        // Each chunk typically has multiple geometries (one per texture type)
        geometryCount += 5; // Rough estimate
        textureCount += 3;   // Rough estimate
        materialCount += 3;  // Rough estimate
      }
    }

    return {
      geometries: geometryCount,
      textures: textureCount,
      materials: materialCount
    };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Performance warnings
  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];
    const metrics = this.getMetrics();

    // FPS warnings
    if (metrics.fps < 30) {
      warnings.push(`Low FPS: ${metrics.fps} (target: 60)`);
    }

    // Chunk count warnings
    if (metrics.chunkCount > 100) {
      warnings.push(`High chunk count: ${metrics.chunkCount} (consider reducing render distance)`);
    }

    // Entity count warnings
    if (metrics.entityCount > 100) {
      warnings.push(`High entity count: ${metrics.entityCount} (consider reducing mob spawn rate)`);
    }

    // Generation warnings
    if (metrics.generationStats.queueSize > 20) {
      warnings.push(`Large generation queue: ${metrics.generationStats.queueSize} chunks`);
    }

    // Memory warnings
    const totalMemory = metrics.memoryUsage.geometries + metrics.memoryUsage.textures + metrics.memoryUsage.materials;
    if (totalMemory > 200) {
      warnings.push(`High memory usage: ${totalMemory} resources`);
    }

    return warnings;
  }

  // Performance recommendations
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.fps < 30) {
      recommendations.push('Reduce render distance in settings');
      recommendations.push('Lower graphics quality settings');
      recommendations.push('Close other applications to free up CPU/GPU');
    }

    if (metrics.chunkCount > 80) {
      recommendations.push('Reduce render distance to improve performance');
    }

    if (metrics.entityCount > 80) {
      recommendations.push('Reduce mob spawn rate or entity count');
    }

    if (metrics.generationStats.queueSize > 15) {
      recommendations.push('Increase generation budget or reduce world complexity');
    }

    return recommendations;
  }

  // Memory cleanup suggestions
  getMemoryCleanupSuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (this.metrics.meshCacheSize > 50) {
      suggestions.push('Clear mesh cache to free memory');
    }

    return suggestions;
  }

  // Clear performance data
  reset(): void {
    this.metrics = {
      fps: 0,
      frameTime: 0,
      chunkCount: 0,
      entityCount: 0,
      meshCacheSize: 0,
      memoryUsage: {
        geometries: 0,
        textures: 0,
        materials: 0
      },
      generationStats: {
        queueSize: 0,
        isGenerating: false,
        budget: 0
      },
      entityStats: {
        entityCount: 0,
        gridCellCount: 0,
        averageEntitiesPerCell: 0
      }
    };
  }

  // Export performance data
  exportPerformanceData(): string {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      warnings: this.getPerformanceWarnings(),
      recommendations: this.getPerformanceRecommendations(),
      suggestions: this.getMemoryCleanupSuggestions()
    };

    return JSON.stringify(data, null, 2);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Performance utilities
export class PerformanceUtils {
  // Measure function execution time
  static measureFunction<T>(fn: () => T, label: string): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    console.log(`${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  // Measure async function execution time
  static async measureAsyncFunction<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    console.log(`${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  // Throttle function calls
  static throttle<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  // Debounce function calls
  static debounce<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // Memory usage estimation
  static getMemoryUsage(): { used: number; total: number; percentage: number } {
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      return {
        used: Math.round(mem.usedJSHeapSize / 1048576), // MB
        total: Math.round(mem.totalJSHeapSize / 1048576), // MB
        percentage: Math.round((mem.usedJSHeapSize / mem.totalJSHeapSize) * 100)
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  // Frame time analysis
  static analyzeFrameTime(): { min: number; max: number; average: number; droppedFrames: number } {
    // This would need to be implemented with frame time tracking
    // For now, return placeholder values
    return {
      min: 0,
      max: 0,
      average: 0,
      droppedFrames: 0
    };
  }
}

// Performance profiler for specific operations
export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(label: string): void {
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
  }

  endMeasurement(label: string): number {
    const times = this.measurements.get(label);
    if (!times) return 0;

    const duration = performance.now();
    times.push(duration);
    return duration;
  }

  getAverageTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;

    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }

  getMinTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return Math.min(...times);
  }

  getMaxTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return Math.max(...times);
  }

  clearMeasurements(): void {
    this.measurements.clear();
  }

  getAllMeasurements(): Record<string, { average: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [label, times] of this.measurements) {
      if (times.length > 0) {
        result[label] = {
          average: this.getAverageTime(label),
          min: this.getMinTime(label),
          max: this.getMaxTime(label),
          count: times.length
        };
      }
    }

    return result;
  }
}

export const performanceProfiler = new PerformanceProfiler();