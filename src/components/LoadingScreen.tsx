'use client';

import { useGameStore } from '@/stores/gameStore';

export default function LoadingScreen() {
  const gameState = useGameStore((state) => state.gameState);
  const isLoading = useGameStore((state) => state.isLoading);
  const loadingProgress = useGameStore((state) => state.loadingProgress);
  const loadingMessage = useGameStore((state) => state.loadingMessage);

  if (gameState !== 'loading' && !isLoading) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-sky-600 to-sky-800 flex flex-col items-center justify-center z-50">
      {/* Minecraft-style dirt background */}
      <div className="absolute inset-0 opacity-20">
        <div className="grid grid-cols-20 grid-rows-12 w-full h-full">
          {Array.from({ length: 240 }).map((_, i) => (
            <div
              key={i}
              className="border border-black/10"
              style={{
                backgroundColor: '#8B5A2B',
              }}
            />
          ))}
        </div>
      </div>

      {/* Loading content */}
      <div className="relative">
        <h1 className="text-4xl font-bold text-white mb-8 text-center drop-shadow-lg">
          Loading World...
        </h1>

        {/* Progress bar */}
        <div className="w-80 h-4 bg-gray-800 rounded-full border-2 border-gray-600 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>

        {/* Loading message */}
        <p className="text-gray-300 text-center mt-4 text-sm">
          {loadingMessage || 'Please wait...'}
        </p>

        {/* Progress percentage */}
        <p className="text-white text-center mt-2 font-mono">
          {loadingProgress}%
        </p>
      </div>

      {/* Loading tips */}
      <div className="absolute bottom-8 text-white/60 text-sm text-center max-w-md">
        <p className="mb-2">Tip: Press F3 to see debug information</p>
        <p>Double-tap Space in Creative mode to fly!</p>
      </div>
    </div>
  );
}
