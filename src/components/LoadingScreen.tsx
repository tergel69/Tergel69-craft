'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';

// Minecraft-style loading tips - outside component to avoid hook issues
const TIPS = [
  "You can mine wood faster by hitting two blocks at once!",
  "Creeper - Ssss...",
  "Zombies can break down wooden doors!",
  "Find a village for free stuff!",
  "Use a boat to cross large oceans!",
  "Wolves are loyal friends!",
  "Don't forget to sleep in a bed!",
  "Diamond tools are your best friend!",
  "Use the compass to find your home!",
  "Pigs are tasty when cooked!",
  "Caves often have hidden treasures!",
  "Build a fence to keep creepers out!",
];

function getRandomTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export default function LoadingScreen() {
  const gameState = useGameStore((state) => state.gameState);
  const isLoading = useGameStore((state) => state.isLoading);
  const loadingProgress = useGameStore((state) => state.loadingProgress);
  const loadingMessage = useGameStore((state) => state.loadingMessage);
  const randomTip = useMemo(() => getRandomTip(), []);

  if (gameState !== 'loading' && !isLoading) return null;

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Dirt background */}
      <DirtBackground />
      
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

      {/* Loading content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <h1 className="text-4xl font-black uppercase tracking-wider text-white mb-8" 
            style={{
              textShadow: '3px 3px 0 #3a5a28, 6px 6px 15px rgba(0,0,0,0.5)',
              color: '#f8f8f8'
            }}>
          Minecraft
        </h1>

        {/* Compass spinner */}
        <div className="w-32 h-32 mb-8">
          <div className="compass-spin">
            <div className="compass-needle-north" />
            <div className="compass-needle-south" />
            <div className="compass-center" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-72 mb-6">
          <div className="mc-progress-container">
            <div 
              className="mc-progress-bar" 
              style={{ width: `${loadingProgress}%` }}
            />
            <span className="mc-progress-text">
              {Math.round(loadingProgress)}%
            </span>
          </div>
        </div>

        {/* Message */}
        <p className="text-white/80 text-sm font-medium mb-8">
          {loadingMessage || 'Loading...'}
        </p>

        {/* Tip */}
        <div className="absolute bottom-8 max-w-lg px-4 text-center">
          <p className="text-white/50 text-xs">
            <span className="text-white/70 font-bold">Tip: </span>
            {randomTip}
          </p>
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-2 right-3 text-[10px] text-white/30 font-mono">
        v1.20.4
      </div>

      <style jsx global>{`
        .compass-spin {
          width: 100%;
          height: 100%;
          position: relative;
          animation: spin 4s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .compass-needle-north {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-bottom: 36px solid #ff4444;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        
        .compass-needle-south {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-top: 36px solid #ffffff;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        
        .compass-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(180deg, #6a6a6a 0%, #4a4a4a 100%);
          border: 3px solid #3a3a3a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        
        .mc-progress-container {
          position: relative;
          height: 22px;
          background: linear-gradient(180deg, #2a1d14 0%, #1a120c 100%);
          border: 3px solid #3d2b1f;
          border-radius: 3px;
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .mc-progress-bar {
          height: 100%;
          background: linear-gradient(180deg, #8b8b8b 0%, #5a5a5a 50%, #8b8b8b 100%);
          border-right: 2px solid #3d2b1f;
          transition: width 0.2s ease-out;
          position: relative;
        }
        
        .mc-progress-bar::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          right: 2px;
          height: 6px;
          background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%);
        }
        
        .mc-progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: bold;
          color: #f8f8f8;
          text-shadow: 1px 1px 0 #000;
        }
      `}</style>
    </div>
  );
}

function DirtBackground() {
  const tiles = useMemo(() => {
    const nextTiles = [];
    for (let i = 0; i < 240; i++) {
      const variation = Math.random() > 0.5 ? '#8B5A2B' : '#7a4f25';
      nextTiles.push(
        <div
          key={i}
          className="border border-black/10"
          style={{
            backgroundColor: variation,
            animation: `pulse ${2 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      );
    }
    return nextTiles;
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        className="grid w-full h-full opacity-90"
        style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))', gridTemplateRows: 'repeat(12, minmax(0, 1fr))' }}
      >
        {tiles}
      </div>
    </div>
  );
}
