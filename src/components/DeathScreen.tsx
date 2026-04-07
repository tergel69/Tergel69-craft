'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';

export default function DeathScreen() {
  const gameState = useGameStore((s) => s.gameState);

  useEffect(() => {
    if (gameState !== 'dead') return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [gameState]);

  if (gameState !== 'dead') return null;

  const handleRespawn = () => {
    usePlayerStore.getState().respawn();
    useGameStore.getState().setGameState('playing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900/90 border border-red-800/60 rounded-lg p-6 text-center">
        <div className="text-red-400 text-3xl font-bold mb-2">You Died</div>
        <div className="text-gray-300 text-sm mb-6">Your items dropped on the ground.</div>
        <button
          className="px-6 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
          onClick={handleRespawn}
        >
          Respawn
        </button>
      </div>
    </div>
  );
}
