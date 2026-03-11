'use client';

import { useRef, useEffect, useCallback } from 'react';

// Advanced game loop with frame pacing and performance monitoring
export class AdvancedGameLoop {
  private callbacks: {
    update: (delta: number, frameTime: number) => void;
    render: (delta: number, frameTime: number) => void;
    fixedUpdate: (fixedDelta: number) => void;
  };
  
  // Frame timing
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private frameTimeHistory: number[] = [];
  private maxFrameTimeHistory: number = 60;
  
  // Fixed timestep
  private accumulator: number = 0;
  private fixedDelta: number = 1 / 60;
  private maxAccumulator: number = 0.25; // Prevent spiral of death
  
  // Performance monitoring
  private performanceStats: {
    averageFrameTime: number;
    averageFPS: number;
    droppedFrames: number;
    frameSpikes: number;
    lastSpikeTime: number;
  };
  
  // Frame pacing
  private targetFrameTime: number = 16.67; // 60 FPS
  private framePacingEnabled: boolean = true;
  private adaptiveQuality: boolean = true;
  
  // VSync and timing
  private vsyncEnabled: boolean = true;
  private timeBudget: number = 16.67;
  private frameStartTime: number = 0;
  
  constructor(
    updateCallback: (delta: number, frameTime: number) => void,
    renderCallback: (delta: number, frameTime: number) => void,
    fixedUpdateCallback: (fixedDelta: number) => void,
    options: {
      targetFPS?: number;
      enableFramePacing?: boolean;
      enableAdaptiveQuality?: boolean;
      fixedTimestep?: number;
    } = {}
  ) {
    this.callbacks = {
      update: updateCallback,
      render: renderCallback,
      fixedUpdate: fixedUpdateCallback
    };
    
    // Configure options
    if (options.targetFPS) {
      this.targetFrameTime = 1000 / options.targetFPS;
      this.timeBudget = this.targetFrameTime;
    }
    
    this.framePacingEnabled = options.enableFramePacing ?? true;
    this.adaptiveQuality = options.enableAdaptiveQuality ?? true;
    
    if (options.fixedTimestep) {
      this.fixedDelta = options.fixedTimestep;
    }
    
    this.performanceStats = {
      averageFrameTime: 0,
      averageFPS: 0,
      droppedFrames: 0,
      frameSpikes: 0,
      lastSpikeTime: 0
    };
  }
  
  // Main game loop
  start(): () => void {
    let frameId: number | null = null;
    let lastTime = 0;
    
    const loop = (currentTime: number) => {
      // Calculate delta time
      const rawDelta = lastTime ? (currentTime - lastTime) / 1000 : 0;
      lastTime = currentTime;
      
      // Cap delta to prevent huge jumps
      const cappedDelta = Math.min(rawDelta, 0.1);
      
      // Start frame timing
      this.frameStartTime = performance.now();
      
      // Process frame
      this.processFrame(cappedDelta);
      
      // Frame pacing
      if (this.framePacingEnabled) {
        this.scheduleNextFrame(loop);
      } else {
        frameId = requestAnimationFrame(loop);
      }
    };
    
    // Start the loop
    frameId = requestAnimationFrame(loop);
    
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }
  
  private processFrame(delta: number): void {
    // Fixed timestep updates
    this.accumulator += delta;
    this.accumulator = Math.min(this.accumulator, this.maxAccumulator);
    
    while (this.accumulator >= this.fixedDelta) {
      this.callbacks.fixedUpdate(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
    }
    
    // Variable timestep updates
    const frameTime = performance.now() - this.frameStartTime;
    this.callbacks.update(delta, frameTime);
    
    // Render
    this.callbacks.render(delta, frameTime);
    
    // Update performance stats
    this.updatePerformanceStats(frameTime);
    
    // Adaptive quality adjustments
    if (this.adaptiveQuality) {
      this.adjustQuality();
    }
  }
  
  private scheduleNextFrame(loop: (time: number) => void): void {
    const frameTime = performance.now() - this.frameStartTime;
    const delay = Math.max(0, this.timeBudget - frameTime);
    
    if (delay > 0) {
      setTimeout(() => {
        requestAnimationFrame(loop);
      }, delay);
    } else {
      requestAnimationFrame(loop);
    }
  }
  
  private updatePerformanceStats(frameTime: number): void {
    // Update frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxFrameTimeHistory) {
      this.frameTimeHistory.shift();
    }
    
    // Calculate averages
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    this.performanceStats.averageFrameTime = avgFrameTime;
    this.performanceStats.averageFPS = 1000 / avgFrameTime;
    
    // Detect frame drops
    if (frameTime > this.targetFrameTime * 1.5) {
      this.performanceStats.droppedFrames++;
    }
    
    // Detect frame spikes
    if (frameTime > this.targetFrameTime * 2) {
      this.performanceStats.frameSpikes++;
      this.performanceStats.lastSpikeTime = performance.now();
    }
    
    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }
  
  private adjustQuality(): void {
    const avgFrameTime = this.performanceStats.averageFrameTime;
    
    // Adjust time budget based on performance
    if (avgFrameTime < this.targetFrameTime * 0.8) {
      // Performance is good, can allocate more time
      this.timeBudget = Math.min(this.targetFrameTime * 1.2, 20);
    } else if (avgFrameTime > this.targetFrameTime * 1.2) {
      // Performance is poor, reduce time budget
      this.timeBudget = Math.max(this.targetFrameTime * 0.8, 8);
    } else {
      // Reset to target
      this.timeBudget = this.targetFrameTime;
    }
  }
  
  // Performance monitoring
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      currentFPS: this.fps,
      timeBudget: this.timeBudget,
      frameTimeHistory: [...this.frameTimeHistory],
      accumulator: this.accumulator
    };
  }
  
  // Quality control
  setTargetFPS(fps: number): void {
    this.targetFrameTime = 1000 / fps;
    this.timeBudget = this.targetFrameTime;
  }
  
  enableFramePacing(enabled: boolean): void {
    this.framePacingEnabled = enabled;
  }
  
  enableAdaptiveQuality(enabled: boolean): void {
    this.adaptiveQuality = enabled;
  }
  
  // Reset performance stats
  resetStats(): void {
    this.performanceStats = {
      averageFrameTime: 0,
      averageFPS: 0,
      droppedFrames: 0,
      frameSpikes: 0,
      lastSpikeTime: 0
    };
    this.frameTimeHistory = [];
    this.frameCount = 0;
    this.fps = 0;
  }
}

// React hook for advanced game loop
export function useAdvancedGameLoop(
  updateCallback: (delta: number, frameTime: number) => void,
  renderCallback: (delta: number, frameTime: number) => void,
  fixedUpdateCallback: (fixedDelta: number) => void,
  options: {
    targetFPS?: number;
    enableFramePacing?: boolean;
    enableAdaptiveQuality?: boolean;
    fixedTimestep?: number;
    enabled?: boolean;
  } = {}
) {
  const gameLoopRef = useRef<AdvancedGameLoop | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  const enabled = options.enabled ?? true;
  
  useEffect(() => {
    if (enabled) {
      gameLoopRef.current = new AdvancedGameLoop(
        updateCallback,
        renderCallback,
        fixedUpdateCallback,
        options
      );
      
      cleanupRef.current = gameLoopRef.current.start();
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      gameLoopRef.current = null;
    };
  }, [enabled, updateCallback, renderCallback, fixedUpdateCallback]);
  
  // Performance monitoring
  const getPerformanceStats = useCallback(() => {
    return gameLoopRef.current?.getPerformanceStats() || null;
  }, []);
  
  const setTargetFPS = useCallback((fps: number) => {
    gameLoopRef.current?.setTargetFPS(fps);
  }, []);
  
  const resetStats = useCallback(() => {
    gameLoopRef.current?.resetStats();
  }, []);
  
  return {
    getPerformanceStats,
    setTargetFPS,
    resetStats
  };
}

// Utility functions for frame timing
export class FrameTimingUtils {
  static measureFrameTime<T>(fn: () => T): { result: T; frameTime: number } {
    const start = performance.now();
    const result = fn();
    const frameTime = performance.now() - start;
    return { result, frameTime };
  }
  
  static throttleFrame<T>(fn: () => T, targetFPS: number = 60): () => T | null {
    let lastCall = 0;
    const interval = 1000 / targetFPS;
    
    return () => {
      const now = performance.now();
      if (now - lastCall >= interval) {
        lastCall = now;
        return fn();
      }
      return null;
    };
  }
  
  static createFrameLimiter(maxFPS: number) {
    let lastFrame = 0;
    const minInterval = 1000 / maxFPS;
    
    return (callback: () => void) => {
      const now = performance.now();
      if (now - lastFrame >= minInterval) {
        lastFrame = now;
        callback();
      }
    };
  }
}
