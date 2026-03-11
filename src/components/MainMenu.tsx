'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore, giveStartingItems } from '@/stores/inventoryStore';
import { useWorldStore } from '@/stores/worldStore';
import { resetChunkManager } from '@/engine/ChunkManager';
import { enhancedMovement } from '@/engine/EnhancedMovement';
import EnhancedWorldManager from './EnhancedWorldManager';

// Splash texts like Minecraft
const SPLASH_TEXTS = [
  'Also try Terraria!',
  'Woo, world generation!',
  'Now with more blocks!',
  'Infinite worlds!',
  'Made with React Three Fiber!',
  '100% more voxels!',
  'Crafting not included!',
  'Now in 3D!',
  'Blocks, blocks, blocks!',
  'Steve says hello!',
];

export default function MainMenu() {
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setWorldInfo = useGameStore((state) => state.setWorldInfo);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const [worldName, setWorldName] = useState('New World');
  const [seed, setSeed] = useState('');
  const [selectedMode, setSelectedMode] = useState<'survival' | 'creative'>('creative');
  const [showSettings, setShowSettings] = useState(false);
  const [showWorldManager, setShowWorldManager] = useState(false);

  // Memoize splash text so it doesn't change on re-renders
  const splashText = useMemo(() => SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)], []);

  if (gameState !== 'menu') return null;

  const handleStartGame = () => {
    usePlayerStore.getState().reset();
    useInventoryStore.getState().reset();
    useWorldStore.getState().reset();
    resetChunkManager();
    enhancedMovement.reset(); // Reset movement system

    const worldSeed = seed ? hashString(seed) : Date.now();
    setWorldInfo(worldName, worldSeed);
    setGameMode(selectedMode);

    if (selectedMode === 'creative') {
      giveStartingItems();
    }

    setGameState('loading');
  };

  const handleWorldSelected = (worldId: string) => {
    setGameState('loading');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Static stars - using CSS animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              left: `${(i * 3.3) % 100}%`,
              top: `${(i * 7.7) % 100}%`,
              animationDelay: `${(i * 0.3) % 3}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <div className="relative mb-10 select-none">
          <h1
            className="text-6xl md:text-7xl font-bold tracking-wider bg-gradient-to-b from-teal-300 to-teal-500 bg-clip-text text-transparent drop-shadow-lg"
          >
            MINECRAFT
          </h1>
          
          <div className="flex items-center justify-center mt-2 gap-3">
            <span className="text-gray-400 text-base tracking-widest uppercase">Web Edition</span>
            <span className="text-yellow-400 text-base font-bold italic -rotate-6 animate-pulse">
              {splashText}
            </span>
          </div>
        </div>

        {/* Menu panel */}
        <div className="relative bg-black/60 backdrop-blur-sm p-6 rounded-xl border border-white/10 min-w-[340px]">
          {showSettings ? (
            <div>
              <h2 className="text-white text-xl mb-4 text-center font-semibold">
                Create New World
              </h2>

              <div className="mb-4">
                <label className="block text-gray-300 text-sm mb-1">World Name</label>
                <input
                  type="text"
                  value={worldName}
                  onChange={(e) => setWorldName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-gray-600 text-white rounded focus:border-teal-500 outline-none"
                  placeholder="New World"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 text-sm mb-1">
                  Seed <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-gray-600 text-white rounded focus:border-teal-500 outline-none"
                  placeholder="Leave blank for random"
                />
              </div>

              <div className="mb-5">
                <label className="block text-gray-300 text-sm mb-2">Game Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedMode('survival')}
                    className={`p-3 rounded-lg border transition-colors text-left ${
                      selectedMode === 'survival'
                        ? 'bg-teal-600/30 border-teal-500 text-teal-300'
                        : 'bg-black/30 border-gray-600 text-white hover:border-gray-500'
                    }`}
                  >
                    <span className="text-lg">⚔️</span>
                    <span className="ml-2 font-medium">Survival</span>
                  </button>
                  <button
                    onClick={() => setSelectedMode('creative')}
                    className={`p-3 rounded-lg border transition-colors text-left ${
                      selectedMode === 'creative'
                        ? 'bg-teal-600/30 border-teal-500 text-teal-300'
                        : 'bg-black/30 border-gray-600 text-white hover:border-gray-500'
                    }`}
                  >
                    <span className="text-lg">🎨</span>
                    <span className="ml-2 font-medium">Creative</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleStartGame}
                  className="py-2 bg-teal-600 hover:bg-teal-500 text-white rounded border border-teal-500 transition-colors"
                >
                  Create World
                </button>
              </div>
            </div>
          ) : showWorldManager ? (
            <EnhancedWorldManager
              onWorldSelected={handleWorldSelected}
              onBack={() => setShowWorldManager(false)}
            />
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg border border-teal-500 transition-colors font-medium"
              >
                Create New World
              </button>

              <button
                onClick={() => setShowWorldManager(true)}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg border border-teal-500 transition-colors font-medium"
              >
                Load World
              </button>

              <button
                disabled
                className="w-full py-3 bg-gray-700/50 text-gray-500 rounded-lg border border-gray-700 cursor-not-allowed"
              >
                Multiplayer (Coming Soon)
              </button>

              <button
                disabled
                className="w-full py-3 bg-gray-700/50 text-gray-500 rounded-lg border border-gray-700 cursor-not-allowed"
              >
                Options
              </button>
            </div>
          )}
        </div>

        {/* Version info */}
        <div className="absolute bottom-4 left-4 text-gray-500 text-xs">
          Minecraft Web Edition v1.0.0
        </div>

        {/* Credits */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs">
          Made with Next.js, React Three Fiber & Tailwind CSS
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 text-gray-400 text-xs text-right bg-black/30 p-2 rounded border border-white/5">
          <p>WASD - Move | Space - Jump</p>
          <p>E - Inventory | F3 - Debug</p>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Simple string hash function for seed
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}