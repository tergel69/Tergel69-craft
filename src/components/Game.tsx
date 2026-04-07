'use client';

import { Suspense, useEffect, memo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from '@/stores/gameStore';
import World from './World';
import Player from './Player';
import Sky from './OptimizedSky';
import Entities from './Entities';
import PlayerModel from './PlayerModel';
import HUD from './HUD';
import Inventory from './Inventory';
import CraftingTable from './CraftingTable';
import MainMenu from './MainMenu';
import { PauseMenu } from './PauseMenu';
import LoadingScreen from './LoadingScreen';
import BlockBreakOverlay from './BlockBreakOverlay';
import CreativeInventory from './CreativeInventory';
import PerformanceHUD from './PerformanceHUD';
import DroppedItems from './DroppedItems';
import DeathScreen from './DeathScreen';
import ContainerScreen, { FurnaceProcessor } from './ContainerScreen';
import { ensureAudioUnlocked } from '@/utils/audio';

const MemoizedHUD           = memo(HUD);
const MemoizedMainMenu      = memo(MainMenu);
const MemoizedPauseMenu     = memo(PauseMenu);
const MemoizedLoadingScreen = memo(LoadingScreen);

export default function Game() {
  const gameState    = useGameStore(s => s.gameState);
  const fov          = useGameStore(s => s.fov);
  const updateTime   = useGameStore(s => s.updateTime);
  const setGameState = useGameStore(s => s.setGameState);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const id = setInterval(() => updateTime(100), 100);
    return () => clearInterval(id);
  }, [gameState, updateTime]);

  useEffect(() => {
    const primeAudio = () => {
      void ensureAudioUnlocked();
    };

    window.addEventListener('pointerdown', primeAudio, { once: true, passive: true });
    window.addEventListener('keydown', primeAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', primeAudio);
      window.removeEventListener('keydown', primeAudio);
    };
  }, []);

  // Central key handler — inventory open/close and pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // E or I — toggle inventory
      if (e.code === 'KeyE' || e.code === 'KeyI') {
        e.preventDefault();
        e.stopPropagation();
        if (gameState === 'playing') {
          document.exitPointerLock();
          setGameState('inventory');
        } else if (gameState === 'inventory') {
          setGameState('playing');
        }
        return;
      }

      // ESC — pause or close overlay
      if (e.key === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
          document.exitPointerLock();
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        } else if (gameState === 'inventory' || gameState === 'crafting' || gameState === 'chest' || gameState === 'furnace' || gameState === 'enchanting') {
          setGameState('playing');
        }
      }
    };

    // Use capture phase so this fires before any child listeners
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [gameState, setGameState]);

  const showCanvas =
    gameState === 'playing'   ||
    gameState === 'paused'    ||
    gameState === 'inventory' ||
    gameState === 'crafting'  ||
    gameState === 'chest'     ||
    gameState === 'furnace'   ||
    gameState === 'enchanting'||
    gameState === 'loading'   ||
    gameState === 'dead';

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {showCanvas && (
        <Canvas
          camera={{ fov, near: 0.05, far: 2000 }}
          gl={{
            antialias: false, alpha: false,
            powerPreference: 'high-performance',
            stencil: false, depth: true,
          }}
          dpr={[1, 1.25]}
          onCreated={({ gl }) => gl.setClearColor(0x87CEEB, 1)}
        >
          <Suspense fallback={null}>
            <Sky />
            <World />
            <DroppedItems />
            <BlockBreakOverlay />
            <Entities />
            <PlayerModel />
            <Player />
          </Suspense>
        </Canvas>
      )}

      <MemoizedMainMenu />
      <MemoizedLoadingScreen />
      {gameState === 'playing' && <MemoizedHUD />}
      <Inventory />
      <CraftingTable />
      <ContainerScreen />
      <CreativeInventory />
      <MemoizedPauseMenu />
      <DeathScreen />
      <FurnaceProcessor />
      <PerformanceHUD />
      {gameState === 'playing' && <ClickToPlayHint />}
    </div>
  );
}

// Uses a pointer-lock state listener so it actually disappears when locked
const ClickToPlayHint = memo(function ClickToPlayHint() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onLock   = () => setLocked(true);
    const onUnlock = () => setLocked(false);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('pointerlockerror',  onUnlock);
    // Set initial state
    setLocked(!!document.pointerLockElement);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('pointerlockerror',  onUnlock);
    };
  }, []);

  if (locked) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
      <div
        className="px-6 py-3 rounded text-white text-sm font-mono tracking-widest border border-white/20"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      >
        Click to play
      </div>
    </div>
  );
});
