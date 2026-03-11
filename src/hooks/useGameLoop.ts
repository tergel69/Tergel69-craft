'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useGameLoop(callback: (delta: number) => void, enabled: boolean = true) {
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const loop = useCallback((time: number) => {
    if (!enabled) return;

    const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = time;

    // Cap delta to prevent huge jumps (e.g., when tab is backgrounded)
    const cappedDelta = Math.min(delta, 0.1);

    callbackRef.current(cappedDelta);

    frameRef.current = requestAnimationFrame(loop);
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      lastTimeRef.current = 0;
      frameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [enabled, loop]);
}

// Hook for fixed timestep updates (for physics)
export function useFixedUpdate(
  callback: (fixedDelta: number) => void,
  fixedDelta: number = 1 / 60,
  enabled: boolean = true
) {
  const accumulatorRef = useRef(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useGameLoop((delta) => {
    accumulatorRef.current += delta;

    while (accumulatorRef.current >= fixedDelta) {
      callbackRef.current(fixedDelta);
      accumulatorRef.current -= fixedDelta;
    }
  }, enabled);
}

// Hook for FPS calculation
export function useFPS() {
  const fpsRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  useGameLoop(() => {
    frameCountRef.current++;

    const now = performance.now();
    const elapsed = now - lastFpsTimeRef.current;

    if (elapsed >= 1000) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }
  });

  return fpsRef;
}
