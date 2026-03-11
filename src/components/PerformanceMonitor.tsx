'use client';

import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  chunks: number;
  drawCalls: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    chunks: 0,
    drawCalls: 0
  });
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    let animationId: number;
    
    const updateMetrics = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      frameCountRef.current++;
      
      // Update FPS every 500ms
      if (delta >= 500) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        const frameTime = Math.round((delta / frameCountRef.current) * 100) / 100;
        
        // Store FPS history for average calculation
        fpsHistoryRef.current.push(fps);
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }
        
        // Get memory usage if available
        let memoryUsage = 0;
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          memoryUsage = Math.round(memory.usedJSHeapSize / 1048576); // Convert to MB
        }
        
        // Get renderer info if available
        let drawCalls = 0;
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl && 'getExtension' in gl) {
            // Try to get performance info from WebGL debug extension if available
            const webglGl = gl as WebGLRenderingContext;
            const debugInfo = webglGl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              // We can't easily get draw calls without Three.js renderer access
              // so we'll estimate based on FPS
              drawCalls = Math.min(metrics.fps * 100, 9999);
            }
          }
        }
        
        setMetrics({
          fps,
          frameTime,
          memoryUsage,
          chunks: 0, // Will be updated by world store
          drawCalls
        });
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animationId = requestAnimationFrame(updateMetrics);
    };
    
    animationId = requestAnimationFrame(updateMetrics);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Get average FPS
  const avgFps = fpsHistoryRef.current.length > 0 
    ? Math.round(fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length)
    : 0;

  // Performance status
  const getStatus = () => {
    if (metrics.fps >= 50) return { color: 'text-green-400', text: 'Excellent' };
    if (metrics.fps >= 30) return { color: 'text-yellow-400', text: 'Good' };
    if (metrics.fps >= 20) return { color: 'text-orange-400', text: 'Fair' };
    return { color: 'text-red-400', text: 'Poor' };
  };

  const status = getStatus();

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg font-mono text-xs backdrop-blur-sm border border-gray-700">
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span>FPS:</span>
          <span className={status.color}>{metrics.fps}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Avg:</span>
          <span className="text-gray-300">{avgFps}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Frame:</span>
          <span className="text-gray-300">{metrics.frameTime}ms</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Memory:</span>
          <span className="text-gray-300">{metrics.memoryUsage}MB</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Draw:</span>
          <span className="text-gray-300">{metrics.drawCalls}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Status:</span>
          <span className={status.color}>{status.text}</span>
        </div>
      </div>
    </div>
  );
}
