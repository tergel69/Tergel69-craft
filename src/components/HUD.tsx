'use client';

import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore } from '@/stores/gameStore';
import { useFPS } from '@/hooks/useGameLoop';
import { useWorldStore } from '@/stores/worldStore';
import { worldToChunk } from '@/utils/coordinates';
import Hotbar from './Hotbar';
import UnderwaterUI from './UnderwaterUI';

export default function HUD() {
  const gameState = useGameStore((state) => state.gameState);
  const showDebug = useGameStore((state) => state.showDebug);
  const dayCount = useGameStore((state) => state.dayCount);
  const worldTime = useGameStore((state) => state.worldTime);
  const breakingBlock = useGameStore((state) => state.breakingBlock);

  if (gameState !== 'playing') return null;

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Crosshair with breaking progress */}
      <Crosshair breakProgress={breakingBlock?.progress || 0} />

      {/* Hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <Hotbar />
      </div>

      {/* Health and Hunger bars */}
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2">
        <HealthHunger />
      </div>

      {/* Underwater UI */}
      <UnderwaterUI />

      {/* Debug info */}
      {showDebug && <DebugInfo />}
    </div>
  );
}

function Crosshair({ breakProgress }: { breakProgress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-8 h-8">
        {/* Crosshair lines */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white mix-blend-difference" />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white mix-blend-difference" />

        {/* Breaking progress circle */}
        {breakProgress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 36 36"
          >
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="3"
            />
            {/* Progress circle */}
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="3"
              strokeDasharray={`${breakProgress * 88} 88`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function HealthHunger() {
  const health = usePlayerStore((state) => state.health);
  const maxHealth = usePlayerStore((state) => state.maxHealth);
  const hunger = usePlayerStore((state) => state.hunger);
  const maxHunger = usePlayerStore((state) => state.maxHunger);
  const armor = usePlayerStore((state) => state.armor);
  const gameMode = useGameStore((state) => state.gameMode);

  if (gameMode === 'creative') return null;

  const hearts = Math.ceil(maxHealth / 2);
  const hungerPoints = Math.ceil(maxHunger / 2);

  return (
    <div className="flex gap-6 items-center">
      {/* Health Bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-row-reverse gap-1">
          {Array.from({ length: hearts }).map((_, i) => {
            const heartHealth = health - i * 2;
            let heartClass = 'text-gray-600'; // Empty
            if (heartHealth >= 2) heartClass = 'text-red-600 animate-pulse';
            else if (heartHealth >= 1) heartClass = 'text-red-400 animate-pulse';

            return (
              <span 
                key={i} 
                className={`text-xl transition-all duration-300 ${heartClass}`}
                style={{
                  filter: heartHealth >= 2 ? 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.5))' : 'none',
                }}
              >
                ❤
              </span>
            );
          })}
        </div>
        
        {/* Health Number */}
        <div className="text-white text-sm font-mono bg-black/30 px-2 py-1 rounded">
          {Math.ceil(health)} / {maxHealth}
        </div>
      </div>

      {/* Hunger Bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: hungerPoints }).map((_, i) => {
            const hungerLevel = hunger - i * 2;
            let hungerClass = 'text-gray-600'; // Empty
            if (hungerLevel >= 2) hungerClass = 'text-amber-600';
            else if (hungerLevel >= 1) hungerClass = 'text-amber-400';

            return (
              <span 
                key={i} 
                className={`text-xl transition-all duration-300 ${hungerClass}`}
                style={{
                  filter: hungerLevel >= 2 ? 'drop-shadow(0 0 2px rgba(245, 158, 11, 0.5))' : 'none',
                }}
              >
                🍖
              </span>
            );
          })}
        </div>
        
        {/* Hunger Number */}
        <div className="text-white text-sm font-mono bg-black/30 px-2 py-1 rounded">
          {Math.ceil(hunger)} / {maxHunger}
        </div>
      </div>

      {/* Armor Bar */}
      {armor > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(armor / 2) }).map((_, i) => (
              <span key={i} className="text-blue-400 text-xl">
                🛡️
              </span>
            ))}
          </div>
          <div className="text-white text-sm font-mono bg-black/30 px-2 py-1 rounded">
            {armor}
          </div>
        </div>
      )}
    </div>
  );
}

function DebugInfo() {
  const fpsRef = useFPS();
  const position = usePlayerStore((state) => state.position);
  const rotation = usePlayerStore((state) => state.rotation);
  const velocity = usePlayerStore((state) => state.velocity);
  const isOnGround = usePlayerStore((state) => state.isOnGround);
  const isInWater = usePlayerStore((state) => state.isInWater);
  const isSprinting = usePlayerStore((state) => state.isSprinting);
  const gameMode = useGameStore((state) => state.gameMode);

  const loadedChunkCount = useWorldStore((state) => state.getLoadedChunkCount());
  const seed = useWorldStore((state) => state.seed);

  const chunk = worldToChunk(position.x, position.z);

  const direction = (() => {
    const deg = ((rotation.yaw * 180) / Math.PI + 360) % 360;
    if (deg < 45 || deg >= 315) return 'South (+Z)';
    if (deg < 135) return 'West (-X)';
    if (deg < 225) return 'North (-Z)';
    return 'East (+X)';
  })();

  return (
    <div className="absolute top-4 left-4 bg-black/50 text-white text-xs font-mono p-2 space-y-0.5">
      <p>Minecraft Clone</p>
      <p>FPS: {fpsRef.current}</p>
      <p>Mode: {gameMode}</p>
      <p>---</p>
      <p>
        XYZ: {position.x.toFixed(2)} / {position.y.toFixed(2)} / {position.z.toFixed(2)}
      </p>
      <p>
        Chunk: {chunk.x}, {chunk.z}
      </p>
      <p>Facing: {direction}</p>
      <p>
        Yaw: {((rotation.yaw * 180) / Math.PI).toFixed(1)}° Pitch:{' '}
        {((rotation.pitch * 180) / Math.PI).toFixed(1)}°
      </p>
      <p>---</p>
      <p>
        Velocity: {velocity.x.toFixed(2)} / {velocity.y.toFixed(2)} / {velocity.z.toFixed(2)}
      </p>
      <p>On Ground: {isOnGround ? 'Yes' : 'No'}</p>
      <p>In Water: {isInWater ? 'Yes' : 'No'}</p>
      <p>Sprinting: {isSprinting ? 'Yes' : 'No'}</p>
      <p>---</p>
      <p>Loaded Chunks: {loadedChunkCount}</p>
      <p>Seed: {seed}</p>
    </div>
  );
}
