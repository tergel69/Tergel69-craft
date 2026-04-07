'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore, giveStartingItems } from '@/stores/inventoryStore';
import { useWorldStore } from '@/stores/worldStore';
import { resetChunkManager } from '@/engine/ChunkManager';
import { enhancedMovement } from '@/engine/EnhancedMovement';

// Simple noise function for terrain
function noise2D(x: number, z: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function getTerrainHeight(x: number, z: number): number {
  const scale = 0.08;
  const h = Math.sin(x * scale) * 3 + Math.cos(z * scale * 0.8) * 3 + 
            Math.sin((x + z) * scale * 0.5) * 2;
  return Math.floor(h + 4);
}

// Voxel block component
function Block({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

// Terrain chunk for background
function TerrainChunk({ offsetX, offsetZ }: { offsetX: number; offsetZ: number }) {
  const blocks = useMemo(() => {
    const b: { pos: [number, number, number]; color: string }[] = [];
    const size = 12;
    
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + offsetX;
        const worldZ = z + offsetZ;
        const height = getTerrainHeight(worldX, worldZ);
        
        // Grass on top
        b.push({ 
          pos: [x - size/2, height, z - size/2], 
          color: '#4a7c2b' 
        });
        
        // Dirt below
        for (let y = height - 1; y >= height - 3 && y >= -5; y--) {
          b.push({ 
            pos: [x - size/2, y, z - size/2], 
            color: '#6b4423' 
          });
        }
      }
    }
    return b;
  }, [offsetX, offsetZ]);

  return (
    <group position={[offsetX, 0, offsetZ]}>
      {blocks.map((block, i) => (
        <Block key={i} position={block.pos} color={block.color} />
      ))}
    </group>
  );
}

// Simple tree
function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Trunk */}
      {[0, 1, 2, 3].map(y => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.6, 1, 0.6]} />
          <meshLambertMaterial color="#5a3d2b" />
        </mesh>
      ))}
      {/* Leaves */}
      {[
        [0, 4, 0], [-1, 4, 0], [1, 4, 0], [0, 4, -1], [0, 4, 1],
        [0, 5, 0], [-1, 5, 0], [1, 5, 0], [0, 5, -1], [0, 5, 1],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#1a5c0d" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Camera that slowly rotates around the terrain with smooth easing
function RotatingCamera() {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const targetPosRef = useRef({ x: 0, y: 18, z: 25 });
  
  useFrame((_, delta) => {
    timeRef.current += delta * 0.12;
    const radius = 28;
    const height = 20;
    
    // Smooth sine wave for more natural movement
    const targetX = Math.sin(timeRef.current) * radius;
    const targetZ = Math.cos(timeRef.current) * radius;
    const targetY = height + Math.sin(timeRef.current * 0.3) * 4;
    
    // Lerp for smooth camera movement
    targetPosRef.current.x += (targetX - targetPosRef.current.x) * 0.02;
    targetPosRef.current.y += (targetY - targetPosRef.current.y) * 0.02;
    targetPosRef.current.z += (targetZ - targetPosRef.current.z) * 0.02;
    
    camera.position.x = targetPosRef.current.x;
    camera.position.y = targetPosRef.current.y;
    camera.position.z = targetPosRef.current.z;
    
    camera.lookAt(0, 3, 0);
  });
  
  return null;
}

// Floating particles for atmosphere
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const { positions, velocities } = useMemo(() => {
    const count = 150;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 30 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      
      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = Math.random() * 0.01 + 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    
    return { positions: pos, velocities: vel };
  }, []);
  
  useFrame((_, delta) => {
    if (!particlesRef.current) return;
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      posArray[i * 3] += velocities[i * 3] * delta * 60;
      posArray[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
      posArray[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;
      
      // Reset particles that go too high or too far
      if (posArray[i * 3 + 1] > 35 || Math.abs(posArray[i * 3]) > 30) {
        posArray[i * 3] = (Math.random() - 0.5) * 60;
        posArray[i * 3 + 1] = 5;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 60;
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    return g;
  }, [positions]);
  
  return (
    <points ref={particlesRef} geometry={geo}>
      <pointsMaterial
        color="#a8d8ff"
        size={0.3}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Main 3D scene with enhanced atmosphere
function WorldPreviewScene() {
  return (
    <>
      {/* Enhanced lighting for depth */}
      <ambientLight intensity={0.4} color="#e8f4ff" />
      <directionalLight position={[50, 100, 50]} intensity={1.2} color="#fff8e7" castShadow />
      <directionalLight position={[-30, 60, -30]} intensity={0.3} color="#a8d8ff" />
      
      {/* Atmospheric fog */}
      <fog attach="fog" args={['#1a2a1a', 30, 80]} />
      
      <RotatingCamera />
      
      {/* Main terrain with more chunks for depth */}
      <TerrainChunk offsetX={0} offsetZ={0} />
      <TerrainChunk offsetX={12} offsetZ={0} />
      <TerrainChunk offsetX={-12} offsetZ={0} />
      <TerrainChunk offsetX={0} offsetZ={12} />
      <TerrainChunk offsetX={0} offsetZ={-12} />
      <TerrainChunk offsetX={12} offsetZ={12} />
      <TerrainChunk offsetX={-12} offsetZ={-12} />
      <TerrainChunk offsetX={12} offsetZ={-12} />
      <TerrainChunk offsetX={-12} offsetZ={12} />
      
      {/* More trees for lush forest feel */}
      <Tree position={[-4, getTerrainHeight(-4, 3), 3]} />
      <Tree position={[5, getTerrainHeight(5, -4), -4]} />
      <Tree position={[-6, getTerrainHeight(-6, -5), -5]} />
      <Tree position={[7, getTerrainHeight(7, 5), 5]} />
      <Tree position={[3, getTerrainHeight(3, 7), 7]} />
      <Tree position={[-8, getTerrainHeight(-8, 2), 2]} />
      <Tree position={[9, getTerrainHeight(9, -3), -3]} />
      <Tree position={[-3, getTerrainHeight(-3, -8), -8]} />
      
      {/* Floating particles for atmosphere */}
      <FloatingParticles />
    </>
  );
}

export default function MainMenu() {
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setWorldInfo = useGameStore((state) => state.setWorldInfo);
  const setWorldGenerationMode = useGameStore((state) => state.setWorldGenerationMode);
  const setWorldInitMode = useGameStore((state) => state.setWorldInitMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const [nameInput, setNameInput] = useState('New World');
  const [seedInput, setSeedInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'survival' | 'creative'>('creative');
  const [selectedGeneration, setSelectedGeneration] = useState<'classic' | 'new_generation'>('classic');
  const [showSettings, setShowSettings] = useState(false);

  if (gameState !== 'menu') return null;

  const handleStartGame = () => {
    usePlayerStore.getState().reset();
    useInventoryStore.getState().reset();
    useWorldStore.getState().reset();
    resetChunkManager();
    enhancedMovement.reset();

    const nextSeed = seedInput ? hashString(seedInput) : Date.now();
    setWorldInfo(nameInput.trim() || 'New World', nextSeed);
    setWorldGenerationMode(selectedGeneration);
    setWorldInitMode('new');
    setGameMode(selectedMode);

    if (selectedMode === 'creative') {
      giveStartingItems();
    }

    setShowSettings(false);
    setGameState('loading');
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 3D World Background */}
      <div className="absolute inset-0">
        <Canvas camera={{ fov: 60, near: 0.1, far: 1000 }} shadows>
          <WorldPreviewScene />
        </Canvas>
      </div>
      
      {/* Dark overlay for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
      
      {/* Vignette effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1
              className="text-[clamp(3.2rem,9vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.06em] text-white"
              style={{
                textShadow: '5px 5px 0 #284825, 12px 12px 28px rgba(0,0,0,0.45), 0 0 60px rgba(139, 198, 92, 0.3)',
                color: '#fbfbf7',
                animation: 'titlePulse 4s ease-in-out infinite',
              }}
            >
              <span className="relative">
                Minecraft
                <span className="absolute inset-0 animate-pulse opacity-30" style={{ color: '#8bc65c', mixBlendMode: 'overlay' }}>
                  Minecraft
                </span>
              </span>
            </h1>
            <p className="text-white/70 text-lg mt-2 font-['MinecraftFont'] tracking-widest" style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                letterSpacing: '0.3em',
                animation: 'fadeInUp 1s ease-out 0.3s both',
              }}>
                CLONE
              </p>
          </div>

          <div className="w-full max-w-md pb-2" style={{ animation: 'fadeInUp 1s ease-out 0.5s both' }}>
            {showSettings ? (
              <MenuPanel>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white" style={{ animation: 'fadeInUp 0.5s ease-out' }}>Create New World</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mc-label">World Name</label>
                    <input
                      className="mc-input"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="New World"
                    />
                  </div>
                  <div>
                    <label className="mc-label">Seed</label>
                    <input
                      className="mc-input"
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                      placeholder="Random"
                    />
                  </div>
                  <div>
                    <label className="mc-label">Game Mode</label>
                    <div className="flex gap-2">
                      <button
                        className={`mc-button flex-1 ${selectedMode === 'survival' ? 'mc-button-active' : 'mc-button-secondary'}`}
                        onClick={() => setSelectedMode('survival')}
                      >
                        Survival
                      </button>
                      <button
                        className={`mc-button flex-1 ${selectedMode === 'creative' ? 'mc-button-active' : 'mc-button-secondary'}`}
                        onClick={() => setSelectedMode('creative')}
                      >
                        Creative
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mc-label">World Type</label>
                    <div className="flex gap-2">
                      <button
                        className={`mc-button flex-1 ${selectedGeneration === 'classic' ? 'mc-button-active' : 'mc-button-secondary'}`}
                        onClick={() => setSelectedGeneration('classic')}
                      >
                        Default
                      </button>
                      <button
                        className={`mc-button flex-1 ${selectedGeneration === 'new_generation' ? 'mc-button-active' : 'mc-button-secondary'}`}
                        onClick={() => setSelectedGeneration('new_generation')}
                      >
                        Large Biomes
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button className="mc-button mc-button-secondary flex-1" onClick={() => setShowSettings(false)}>
                      Cancel
                    </button>
                    <button className="mc-button mc-button-primary flex-1" onClick={handleStartGame}>
                      Create
                    </button>
                  </div>
                </div>
              </MenuPanel>
            ) : (
              <MenuPanel>
                <button className="mc-button mc-button-primary w-full" onClick={() => setShowSettings(true)}>
                  Singleplayer
                </button>
                <button className="mc-button mc-button-disabled w-full" disabled>
                  Multiplayer
                </button>
                <button className="mc-button mc-button-disabled w-full" disabled>
                  Options
                </button>
              </MenuPanel>
            )}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl items-end justify-between px-6 pb-4 text-[10px] text-white/55 sm:px-10" style={{ animation: 'fadeInUp 1s ease-out 0.7s both' }}>
          <div className="font-mono uppercase tracking-[0.28em]">v1.20.4</div>
        </div>
      </div>

      <style jsx global>{`
        .mc-menu-panel {
          background: linear-gradient(180deg, rgba(29, 38, 32, 0.9) 0%, rgba(16, 20, 18, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          animation: fadeInUp 0.6s ease-out;
        }
        
        .mc-button {
          display: block;
          width: 100%;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.1s ease, filter 0.1s ease;
          text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);
          margin-bottom: 4px;
          font-family: 'MinecraftFont', 'Trebuchet MS', Arial, sans-serif;
        }
        
        .mc-button:last-child { margin-bottom: 0; }
        
        .mc-button-primary {
          background: linear-gradient(180deg, #78b959 0%, #3e6e31 100%);
          color: #f8f8f8;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 6px 16px rgba(0, 0, 0, 0.25);
          transition: all 0.15s ease;
        }
        
        .mc-button-primary:hover {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.1);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 20px rgba(0, 0, 0, 0.35), 0 0 15px rgba(123, 198, 92, 0.3);
        }
        
        .mc-button-primary:active {
          transform: translateY(1px) scale(0.98);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .mc-button-secondary {
          background: linear-gradient(180deg, #b0895c 0%, #715239 100%);
          color: #f8f8f8;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        
        .mc-button-secondary:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }
        
        .mc-button-active {
          background: linear-gradient(180deg, #8bc65c 0%, #4f8138 100%);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 0 16px rgba(123, 198, 92, 0.3);
        }
        
        .mc-button-disabled {
          background: linear-gradient(180deg, #5a5a5a 0%, #3a3a3a 100%);
          color: #888;
          cursor: not-allowed;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        
        .mc-label {
          display: block;
          font-size: 11px;
          font-weight: bold;
          color: #a0a0a0;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .mc-input {
          width: 100%;
          padding: 8px 10px;
          font-size: 14px;
          background: rgba(4, 10, 8, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          outline: none;
          box-sizing: border-box;
        }
        
        .mc-input:focus {
          border-color: rgba(123, 198, 92, 0.7);
          box-shadow: 0 0 0 3px rgba(123, 198, 92, 0.18);
        }
        
        .mc-input::placeholder {
          color: #666;
        }
        
        @keyframes titlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.95; }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function MenuPanel({ children }: { children: React.ReactNode }) {
  return <div className="mc-menu-panel">{children}</div>;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
