/**
 * Chunk Loading Queue - Priority based async chunk loading system
 * Manages chunk generation and loading with proper priority ordering
 */

import { ChunkData } from '../stores/worldStore';
import { CHUNK_SIZE } from '../utils/constants';

interface QueuedChunk {
  x: number;
  z: number;
  priority: number;
  addedAt: number;
  retryCount: number;
}

interface ChunkLoadResult {
  success: boolean;
  chunk?: ChunkData;
  error?: string;
}

export class ChunkLoadingQueue {
  private static readonly MAX_PARALLEL = 4;
  private static readonly MAX_RETRIES = 3;
  private static readonly HIGH_PRIORITY_THRESHOLD = 20;

  private queue: QueuedChunk[] = [];
  private processing = new Set<string>();
  private callbacks = new Map<string, ((result: ChunkLoadResult) => void)[]>();

  private isRunning = false;
  private workerIdle = true;

  /**
   * Add chunk to loading queue
   */
  public queueChunk(x: number, z: number, priority: number = 100): void {
    const key = `${x},${z}`;

    if (this.processing.has(key)) return;

    const existing = this.queue.find(c => c.x === x && c.z === z);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      return;
    }

    this.queue.push({
      x,
      z,
      priority,
      addedAt: performance.now(),
      retryCount: 0
    });

    this.sortQueue();
    this.startProcessing();
  }

  /**
   * Add multiple chunks in batch
   */
  public queueBatch(chunks: Array<{ x: number; z: number; priority: number }>): void {
    for (const chunk of chunks) {
      const key = `${chunk.x},${chunk.z}`;
      if (this.processing.has(key)) continue;

      const existing = this.queue.find(c => c.x === chunk.x && c.z === chunk.z);
      if (existing) {
        existing.priority = Math.min(existing.priority, chunk.priority);
      } else {
        this.queue.push({
          x: chunk.x,
          z: chunk.z,
          priority: chunk.priority,
          addedAt: performance.now(),
          retryCount: 0
        });
      }
    }

    this.sortQueue();
    this.startProcessing();
  }

  /**
   * Wait for specific chunk to load
   */
  public waitForChunk(x: number, z: number): Promise<ChunkLoadResult> {
    const key = `${x},${z}`;

    return new Promise(resolve => {
      if (!this.callbacks.has(key)) {
        this.callbacks.set(key, []);
      }
      this.callbacks.get(key)!.push(resolve);
    });
  }

  /**
   * Cancel pending chunk
   */
  public cancelChunk(x: number, z: number): void {
    const key = `${x},${z}`;
    this.queue = this.queue.filter(c => c.x !== x || c.z !== z);
    this.callbacks.delete(key);
  }

  /**
   * Clear entire queue
   */
  public clear(): void {
    this.queue = [];
    this.processing.clear();
    this.callbacks.clear();
  }

  /**
   * Get current queue size
   */
  public size(): number {
    return this.queue.length + this.processing.size;
  }

  /**
   * Get pending queue length
   */
  public pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if idle
   */
  public isIdle(): boolean {
    return this.queue.length === 0 && this.processing.size === 0;
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  private startProcessing(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.processing.size < ChunkLoadingQueue.MAX_PARALLEL) {
      const chunk = this.queue.shift()!;
      const key = `${chunk.x},${chunk.z}`;

      this.processing.add(key);

      // Process chunk asynchronously
      this.processChunk(chunk)
        .then(result => {
          this.processing.delete(key);
          this.notifyCallbacks(key, result);
        })
        .catch(error => {
          this.processing.delete(key);

          if (chunk.retryCount < ChunkLoadingQueue.MAX_RETRIES) {
            // Retry with slightly lower priority
            chunk.retryCount++;
            chunk.priority += 5;
            this.queue.push(chunk);
            this.sortQueue();
          } else {
            this.notifyCallbacks(key, {
              success: false,
              error: `Failed after ${ChunkLoadingQueue.MAX_RETRIES} retries: ${error}`
            });
          }
        });
    }

    this.isRunning = this.queue.length > 0 || this.processing.size > 0;

    if (this.isRunning) {
      requestAnimationFrame(() => this.processQueue());
    }
  }

  private async processChunk(chunk: QueuedChunk): Promise<ChunkLoadResult> {
    // Simulate chunk loading work
    // Actual implementation will call terrain generator
    await new Promise(resolve => {
      const baseTime = chunk.priority < ChunkLoadingQueue.HIGH_PRIORITY_THRESHOLD ? 2 : 8;
      setTimeout(resolve, baseTime);
    });

    return {
      success: true,
    };
  }

  private notifyCallbacks(key: string, result: ChunkLoadResult): void {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(result);
      }
      this.callbacks.delete(key);
    }
  }
}

let instance: ChunkLoadingQueue | null = null;

export function getChunkLoadingQueue(): ChunkLoadingQueue {
  if (!instance) {
    instance = new ChunkLoadingQueue();
  }
  return instance;
}

export function resetChunkLoadingQueue(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}