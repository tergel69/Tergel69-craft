'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { resolveSpawnLocation } from '@/utils/spawn';
import { playSpawnSound } from '@/utils/audio';

const INITIAL_POSITION = { x: 0, y: 100, z: 0 };
const MAX_TRIES = 150;
const INTERVAL_MS = 100;

function isInitialPosition() {
  const position = usePlayerStore.getState().position;
  return (
    Math.abs(position.x - INITIAL_POSITION.x) < 0.001 &&
    Math.abs(position.y - INITIAL_POSITION.y) < 0.001 &&
    Math.abs(position.z - INITIAL_POSITION.z) < 0.001
  );
}

export function useSpawnPlayer() {
  const doneRef = useRef(false);
  const triesRef = useRef(0);

  useEffect(() => {
    doneRef.current = false;
    triesRef.current = 0;

    const attempt = () => {
      if (doneRef.current) return;

      const gameState = useGameStore.getState().gameState;
      if (gameState !== 'loading' && gameState !== 'playing') return;
      if (useGameStore.getState().worldInitMode === 'loaded') {
        doneRef.current = true;
        clearInterval(timerId);
        return;
      }

      if (!isInitialPosition()) {
        doneRef.current = true;
        clearInterval(timerId);
        return;
      }

      triesRef.current += 1;
      const current = usePlayerStore.getState().position;
      const resolved = resolveSpawnLocation({
        originX: current.x,
        originZ: current.z,
        searchRadius: 64,
        requireLoadedChunks: true,
        allowFallback: triesRef.current >= MAX_TRIES,
        fallbackY: 180,
      });

      if (!resolved) return;

      usePlayerStore.setState((state) => ({
        ...state,
        position: resolved.position,
        velocity: { x: 0, y: 0, z: 0 },
      }));
      playSpawnSound();
      doneRef.current = true;
      clearInterval(timerId);
    };

    const timerId = setInterval(attempt, INTERVAL_MS);
    attempt();

    return () => clearInterval(timerId);
  }, []);
}
