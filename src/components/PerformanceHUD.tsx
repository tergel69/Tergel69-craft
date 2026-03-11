'use client';

import { useState, useEffect, useRef } from 'react';
import { performanceMonitor } from '@/utils/PerformanceMonitor';

export default function PerformanceHUD() {
  const [showStats, setShowStats] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update performance stats using setInterval instead of useFrame
  useEffect(() => {
    if (!showStats) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Update stats every 100ms
    intervalRef.current = setInterval(() => {
      const metrics = performanceMonitor.getMetrics();
      setFps(metrics.fps);
      setFrameTime(metrics.frameTime);
      setChunkCount(metrics.chunkCount);
      
      // Get memory usage if available
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        setMemoryUsage(Math.round(mem.usedJSHeapSize / 1048576)); // MB
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [showStats]);

  // Toggle with F3 key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        setShowStats(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!showStats) return null;

  return (
    <div className="fixed top-4 left-4 bg-black/80 text-green-400 font-mono text-sm p-4 rounded-lg z-50">
      <div className="text-yellow-400 mb-2">Performance Stats</div>
      <div className="space-y-1">
        <div>FPS: <span className={fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-400' : 'text-green-400'}>{fps}</span></div>
        <div>Frame Time: <span className={frameTime > 20 ? 'text-red-400' : frameTime > 16 ? 'text-yellow-400' : 'text-green-400'}>{frameTime}ms</span></div>
        <div>Chunks: {chunkCount}</div>
        <div>Memory: {memoryUsage}MB</div>
      </div>
      
      <div className="text-yellow-400 mt-3 mb-1">Optimizations Active:</div>
      <div className="text-xs space-y-1">
        <div>✓ High-Performance Mesh Builder</div>
        <div>✓ Advanced Game Loop</div>
        <div>✓ Memory Management</div>
        <div>✓ Optimized Lighting</div>
        <div>✓ Frustum Culling</div>
      </div>
      
      <div className="text-xs text-gray-400 mt-3">
        Press F3 to hide
      </div>
    </div>
  );
}
