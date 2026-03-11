'use client';

import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore } from '@/stores/gameStore';
import { getChunkManager, resetChunkManager } from '@/engine/ChunkManager';
import { worldToChunk } from '@/utils/coordinates';
import { CHUNK_SIZE, RENDER_DISTANCE, SEA_LEVEL } from '@/utils/constants';
import { BlockType } from '@/data/blocks';
import { isSolid, isLiquid } from '@/data/blocks';
import OptimizedChunk from './OptimizedChunk';
import { entityManager } from '@/entities/EntityManager';

const MemoizedChunk = memo(OptimizedChunk);

// ─────────────────────────────────────────────────────────────────────────────
// Spawn position finder — reads directly from worldStore (bypasses React state)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans downward from Y=220 to find the first solid non-liquid block with
 * 2 clear blocks above. Tries a spiral of positions if the origin fails.
 * Falls back to Y=120 if nothing found (player falls to surface safely).
 */
function findSpawnY(originX: number, originZ: number): { x: number; y: number; z: number } {
  const worldStore = useWorldStore.getState();

  function scanColumn(wx: number, wz: number): number | null {
    for (let y = 220; y >= 2; y--) {
      const block  = worldStore.getBlock(Math.floor(wx), y,     Math.floor(wz));
      const above1 = worldStore.getBlock(Math.floor(wx), y + 1, Math.floor(wz));
      const above2 = worldStore.getBlock(Math.floor(wx), y + 2, Math.floor(wz));

      // Block must be defined (chunk loaded), solid, and not liquid
      if (block === undefined || block === null) continue;
      if (!isSolid(block))  continue;
      if (isLiquid(block))  continue;

      // The two blocks above must be clear (air, not solid, not liquid)
      if (above1 === undefined) continue;
      if (above2 === undefined) continue;
      if (isSolid(above1) || isLiquid(above1)) continue;
      if (isSolid(above2) || isLiquid(above2)) continue;

      return y + 1; // stand on top
    }
    return null;
  }

  // Try origin first
  const originY = scanColumn(originX, originZ);
  if (originY !== null && originY > SEA_LEVEL) {
    return { x: originX + 0.5, y: originY, z: originZ + 0.5 };
  }

  // Spiral outward in rings of radius 4 up to 40 blocks
  for (let r = 4; r <= 40; r += 4) {
    for (let dx = -r; dx <= r; dx += 4) {
      for (let dz = -r; dz <= r; dz += 4) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // ring edge only
        const y = scanColumn(originX + dx, originZ + dz);
        if (y !== null && y > SEA_LEVEL) {
          return { x: originX + dx + 0.5, y, z: originZ + dz + 0.5 };
        }
      }
    }
  }

  // Last resort: high up so player falls to surface
  console.warn('[World] Could not find ideal spawn, using elevated fallback at Y=120');
  return { x: originX + 0.5, y: 120, z: originZ + 0.5 };
}

// ─────────────────────────────────────────────────────────────────────────────
// World component
// ─────────────────────────────────────────────────────────────────────────────

export default function World() {
  const [initialized, setInitialized] = useState(false);
  const [chunkVersions, setChunkVersions] = useState<Map<string, number>>(new Map());
  const [adaptiveRenderDistance, setAdaptiveRenderDistance] = useState(5);

  const position       = usePlayerStore((state) => state.position);
  const setPosition    = usePlayerStore((state) => state.setPosition);
  const worldSeed      = useGameStore((state) => state.worldSeed);
  const renderDistance = useGameStore((state) => state.renderDistance);
  const gameState      = useGameStore((state) => state.gameState);
  const setLoading     = useGameStore((state) => state.setLoading);
  const setGameState   = useGameStore((state) => state.setGameState);

  const loadedChunks   = useWorldStore((state) => state.loadedChunks);
  const dirtyChunks    = useWorldStore((state) => state.dirtyChunks);
  const clearDirtyChunks = useWorldStore((state) => state.clearDirtyChunks);

  useEffect(() => {
    if (gameState !== 'loading') return;

    const initializeWorld = async () => {
      setLoading(true, 0, 'Generating world…');
      resetChunkManager();
      entityManager.clear();
      const manager = getChunkManager(worldSeed);

      // Random spawn offset for variety
      const spawnOffsetX = Math.floor((Math.random() - 0.5) * 1000);
      const spawnOffsetZ = Math.floor((Math.random() - 0.5) * 1000);

      setLoading(true, 20, 'Generating terrain…');

      // Generate chunks — this populates worldStore synchronously
      manager.generateInitialChunks(
        spawnOffsetX,
        spawnOffsetZ,
        Math.max(4, Math.min(6, renderDistance))
      );

      setLoading(true, 60, 'Finding spawn point…');

      // Small yield so React can flush the setChunk calls into state
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      // Now worldStore has chunk data — scan for a safe spawn
      const spawnPos = findSpawnY(spawnOffsetX, spawnOffsetZ);

      console.log(
        `[World] Spawning at ${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)}`
      );

      setPosition(spawnPos);
      entityManager.populateAroundPlayer(spawnPos.x, spawnPos.z, 18);
      setLoading(true, 100, 'Done!');

      setTimeout(() => {
        setLoading(false);
        setGameState('playing');
        setInitialized(true);
      }, 400);
    };

    initializeWorld();
  }, [gameState, worldSeed, setLoading, setGameState, setPosition, renderDistance]);

  // Stream in/out chunks as player moves
  const lastUpdateRef = useRef(0);
  const lastChunkRef = useRef<{ x: number; z: number; renderDistance: number } | null>(null);
  const frameSampleRef = useRef({ acc: 0, count: 0, lastNow: 0 });
  useFrame(() => {
    if (!initialized || gameState !== 'playing') return;
    const now = performance.now();
    const manager = getChunkManager();
    const currentChunkX = Math.floor(position.x / CHUNK_SIZE);
    const currentChunkZ = Math.floor(position.z / CHUNK_SIZE);
    const last = lastChunkRef.current;
    const chunkChanged = !last || last.x !== currentChunkX || last.z !== currentChunkZ || last.renderDistance !== renderDistance;
    const queueNotEmpty = manager.getQueueSize() > 0;

    // Only do expensive chunk update when chunk boundary changes, render distance changes,
    // or there is still queued generation work to drain.
    if (!chunkChanged && !queueNotEmpty) return;

    const intervalMs = chunkChanged ? 80 : 180;
    if (now - lastUpdateRef.current < intervalMs) return;
    lastUpdateRef.current = now;

    if (frameSampleRef.current.lastNow > 0) {
      frameSampleRef.current.acc += now - frameSampleRef.current.lastNow;
      frameSampleRef.current.count += 1;
    }
    frameSampleRef.current.lastNow = now;

    if (frameSampleRef.current.count >= 20) {
      const avgFrameMs = frameSampleRef.current.acc / frameSampleRef.current.count;
      frameSampleRef.current.acc = 0;
      frameSampleRef.current.count = 0;

      if (avgFrameMs > 26) {
        setAdaptiveRenderDistance((prev) => Math.max(3, prev - 1));
      } else if (avgFrameMs < 18) {
        setAdaptiveRenderDistance((prev) => Math.min(renderDistance, prev + 1));
      }
    }

    const effectiveDistance = Math.min(renderDistance, adaptiveRenderDistance);
    manager.update(position.x, position.z, effectiveDistance);
    lastChunkRef.current = { x: currentChunkX, z: currentChunkZ, renderDistance };
  });

  // Mark dirty chunks for mesh rebuild
  useEffect(() => {
    if (dirtyChunks.size === 0) return;
    const dirty = clearDirtyChunks();
    setChunkVersions((prev) => {
      const next = new Map(prev);
      for (const key of dirty) next.set(key, (next.get(key) || 0) + 1);
      return next;
    });
  }, [dirtyChunks, clearDirtyChunks]);

  // Only recompute chunk list when crossing chunk boundary
  const playerChunk = useMemo(
    () => worldToChunk(position.x, position.z),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(position.x / CHUNK_SIZE), Math.floor(position.z / CHUNK_SIZE)]
  );

  const chunksToRender = useMemo(() => {
    const chunks: { x: number; z: number; key: string; distance: number }[] = [];
    const effectiveDistance = Math.min(renderDistance, adaptiveRenderDistance);
    const r2 = effectiveDistance * effectiveDistance;

    for (const key of Array.from(loadedChunks)) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= r2) chunks.push({ x: cx, z: cz, key, distance: Math.sqrt(distSq) });
    }

    return chunks.sort((a, b) => a.distance - b.distance);
  }, [loadedChunks, playerChunk.x, playerChunk.z, renderDistance, adaptiveRenderDistance]);

  if (!initialized) return null;

  return (
    <group>
      {chunksToRender.map(({ x, z, key }) => (
        <MemoizedChunk key={key} x={x} z={z} version={chunkVersions.get(key) || 0} />
      ))}
    </group>
  );
}
