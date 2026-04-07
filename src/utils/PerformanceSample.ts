/**
 * PerformanceSample - Unified telemetry schema for performance monitoring
 */

export interface PerformanceSample {
  // Frame timing
  frameTimeP50: number; // milliseconds
  frameTimeP95: number; // milliseconds
  frameTimeMax: number; // milliseconds
  
  // Generation queue
  generationQueueSize: number;
  generationQueueDrainRate: number; // chunks per second
  generationAvgTimeMs: number;
  
  // Entity stats
  activeEntities: number;
  entityUpdatesThisFrame: number;
  entityTickTimeMs: number;
  
  // Chunk stats
  loadedChunks: number;
  visibleChunks: number;
  chunkRebuildsThisFrame: number;
  chunkRebuildAvgTimeMs: number;
  
  // Memory (optional, may be undefined if not tracked)
  heapUsedMB?: number;
  heapTotalMB?: number;
  
  // Timestamp
  timestamp: number;
}

export function createEmptyPerformanceSample(): PerformanceSample {
  return {
    frameTimeP50: 0,
    frameTimeP95: 0,
    frameTimeMax: 0,
    generationQueueSize: 0,
    generationQueueDrainRate: 0,
    generationAvgTimeMs: 0,
    activeEntities: 0,
    entityUpdatesThisFrame: 0,
    entityTickTimeMs: 0,
    loadedChunks: 0,
    visibleChunks: 0,
    chunkRebuildsThisFrame: 0,
    chunkRebuildAvgTimeMs: 0,
    heapUsedMB: undefined,
    heapTotalMB: undefined,
    timestamp: Date.now(),
  };
}

/**
 * Simple rolling statistics tracker for performance metrics
 */
export class RollingStats {
  private values: number[] = [];
  private maxSamples: number;
  private sum: number = 0;
  
  constructor(maxSamples: number = 60) {
    this.maxSamples = maxSamples;
  }
  
  add(value: number): void {
    if (this.values.length >= this.maxSamples) {
      const removed = this.values.shift()!;
      this.sum -= removed;
    }
    this.values.push(value);
    this.sum += value;
  }
  
  getAverage(): number {
    return this.values.length === 0 ? 0 : this.sum / this.values.length;
  }
  
  getP50(): number {
    return this.getPercentile(50);
  }
  
  getP95(): number {
    return this.getPercentile(95);
  }
  
  getMax(): number {
    return this.values.length === 0 ? 0 : Math.max(...this.values);
  }
  
  private getPercentile(percentile: number): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * (sorted.length - 1));
    return sorted[index];
  }
  
  clear(): void {
    this.values = [];
    this.sum = 0;
  }
}

/**
 * Performance tracker that aggregates multiple metrics
 */
export class PerformanceTracker {
  private frameTimeStats: RollingStats;
  private generationTimeStats: RollingStats;
  private entityTickTimeStats: RollingStats;
  private chunkRebuildTimeStats: RollingStats;
  
  private generationQueueSize: number = 0;
  private activeEntities: number = 0;
  private entityUpdatesThisFrame: number = 0;
  private loadedChunks: number = 0;
  private visibleChunks: number = 0;
  private chunkRebuildsThisFrame: number = 0;
  
  constructor(sampleSize: number = 60) {
    this.frameTimeStats = new RollingStats(sampleSize);
    this.generationTimeStats = new RollingStats(sampleSize);
    this.entityTickTimeStats = new RollingStats(sampleSize);
    this.chunkRebuildTimeStats = new RollingStats(sampleSize);
  }
  
  recordFrameTime(ms: number): void {
    this.frameTimeStats.add(ms);
  }
  
  recordGenerationTime(ms: number, queueSize: number): void {
    this.generationTimeStats.add(ms);
    this.generationQueueSize = queueSize;
  }
  
  recordEntityTick(ms: number, count: number, totalEntities: number): void {
    this.entityTickTimeStats.add(ms);
    this.entityUpdatesThisFrame = count;
    this.activeEntities = totalEntities;
  }
  
  recordChunkRebuild(ms: number, rebuildCount: number, loaded: number, visible: number): void {
    this.chunkRebuildTimeStats.add(ms);
    this.chunkRebuildsThisFrame = rebuildCount;
    this.loadedChunks = loaded;
    this.visibleChunks = visible;
  }
  
  getSample(): PerformanceSample {
    return {
      frameTimeP50: this.frameTimeStats.getP50(),
      frameTimeP95: this.frameTimeStats.getP95(),
      frameTimeMax: this.frameTimeStats.getMax(),
      generationQueueSize: this.generationQueueSize,
      generationQueueDrainRate: 0, // Would need to track over time
      generationAvgTimeMs: this.generationTimeStats.getAverage(),
      activeEntities: this.activeEntities,
      entityUpdatesThisFrame: this.entityUpdatesThisFrame,
      entityTickTimeMs: this.entityTickTimeStats.getAverage(),
      loadedChunks: this.loadedChunks,
      visibleChunks: this.visibleChunks,
      chunkRebuildsThisFrame: this.chunkRebuildsThisFrame,
      chunkRebuildAvgTimeMs: this.chunkRebuildTimeStats.getAverage(),
      heapUsedMB: typeof performance !== 'undefined' && 'memory' in performance 
        ? (performance as any).memory?.usedJSHeapSize / (1024 * 1024) 
        : undefined,
      heapTotalMB: typeof performance !== 'undefined' && 'memory' in performance 
        ? (performance as any).memory?.totalJSHeapSize / (1024 * 1024) 
        : undefined,
      timestamp: Date.now(),
    };
  }
  
  reset(): void {
    this.frameTimeStats.clear();
    this.generationTimeStats.clear();
    this.entityTickTimeStats.clear();
    this.chunkRebuildTimeStats.clear();
    this.generationQueueSize = 0;
    this.activeEntities = 0;
    this.entityUpdatesThisFrame = 0;
    this.loadedChunks = 0;
    this.visibleChunks = 0;
    this.chunkRebuildsThisFrame = 0;
  }
}
