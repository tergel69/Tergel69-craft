'use client';

import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore } from '@/stores/gameStore';
import { getChunkManager, resetChunkManager } from '@/engine/ChunkManager';
import { worldToChunk } from '@/utils/coordinates';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE, SEA_LEVEL } from '@/utils/constants';
import Chunk from './Chunk';
import { unifiedEntityManager as entityManager } from '@/entities/UnifiedEntityManager';
import { isValidPosition } from '@/engine/Physics';
import { getDeterministicSpawnAnchor, resolveSpawnLocation } from '@/utils/spawn';

const MemoizedChunk = memo(Chunk);
const MIN_EFFECTIVE_RENDER_DISTANCE = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Spawn position finder — reads directly from worldStore (bypasses React state)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// World component
// ─────────────────────────────────────────────────────────────────────────────

export default function World() {
  const { camera } = useThree();
  const [initialized, setInitialized] = useState(false);
  const [chunkVersions, setChunkVersions] = useState<Map<string, number>>(new Map());
  const [visibleChunkKeys, setVisibleChunkKeys] = useState<string[]>([]);
  const [adaptiveRenderDistance, setAdaptiveRenderDistance] = useState(() =>
    Math.max(MIN_EFFECTIVE_RENDER_DISTANCE, useGameStore.getState().renderDistance)
  );

  const setPosition    = usePlayerStore((state) => state.setPosition);
  const worldSeed      = useGameStore((state) => state.worldSeed);
  const worldGenerationMode = useGameStore((state) => state.worldGenerationMode);
  const worldInitMode  = useGameStore((state) => state.worldInitMode);
  const renderDistance = useGameStore((state) => state.renderDistance);
  const gameState      = useGameStore((state) => state.gameState);
  const setLoading     = useGameStore((state) => state.setLoading);
  const setGameState   = useGameStore((state) => state.setGameState);

  const loadedChunks   = useWorldStore((state) => state.loadedChunks);
  const loadedChunkVersion = useWorldStore((state) => state.loadedChunkVersion);
  const dirtyChunkVersion = useWorldStore((state) => state.dirtyChunkVersion);
  const clearDirtyChunks = useWorldStore((state) => state.clearDirtyChunks);
  const playerChunkRef = useRef(worldToChunk(usePlayerStore.getState().position.x, usePlayerStore.getState().position.z));
  const loadedChunkList = useMemo(() => Array.from(loadedChunks), [loadedChunkVersion, loadedChunks]);

  useEffect(() => {
    setAdaptiveRenderDistance((prev) =>
      Math.max(MIN_EFFECTIVE_RENDER_DISTANCE, Math.min(prev, renderDistance))
    );
  }, [renderDistance]);

  useEffect(() => {
    if (gameState !== 'loading') return;

    // Prevent multiple initializations
    let cancelled = false;

    const initializeWorld = async () => {
      if (cancelled) return;
      
      useGameStore.getState().setLoading(true, 0, 'Generating world…');
      resetChunkManager({ clearWorldStore: worldInitMode === 'new' });
      entityManager.clear();
      const manager = getChunkManager(worldSeed, worldGenerationMode);
      const currentPosition = usePlayerStore.getState().position;
      const spawnAnchor = worldInitMode === 'loaded'
        ? { x: Math.floor(currentPosition.x), z: Math.floor(currentPosition.z) }
        : getDeterministicSpawnAnchor(worldSeed);

      if (cancelled) return;
      useGameStore.getState().setLoading(true, 20, 'Generating terrain…');

      // Generate chunks synchronously - larger radius to ensure good spawn
      // Use larger radius to guarantee proper terrain generation
      const initialRadius = Math.max(8, Math.min(12, Math.floor(renderDistance / 2)));
      manager.generateInitialChunks(spawnAnchor.x, spawnAnchor.z, initialRadius);

      if (cancelled) return;
      useGameStore.getState().setLoading(true, 60, 'Finding spawn point…');

      let finalPosition = currentPosition;

      if (worldInitMode === 'new') {
        // For new worlds, try to find spawn with loaded chunks first
        let resolvedSpawn = resolveSpawnLocation({
          originX: spawnAnchor.x,
          originZ: spawnAnchor.z,
          searchRadius: 128, // Larger search to find proper terrain
          requireLoadedChunks: true,
          allowFallback: true,
          fallbackY: 64,
        });
        
        // If spawn is not found or is in water, try again with less strict requirements
        if (!resolvedSpawn || resolvedSpawn.position.y <= SEA_LEVEL + 1) {
          const retrySpawn = resolveSpawnLocation({
            originX: spawnAnchor.x,
            originZ: spawnAnchor.z,
            searchRadius: 256, // Even larger search
            requireLoadedChunks: false, // Don't require loaded chunks
            allowFallback: true,
            fallbackY: 70, // Try to find above water
          });
          if (retrySpawn) {
            resolvedSpawn = retrySpawn;
          }
        }

        finalPosition = resolvedSpawn?.position ?? {
          x: spawnAnchor.x + 0.5,
          y: 64, // Use sea level as fallback
          z: spawnAnchor.z + 0.5,
        };

        usePlayerStore.getState().setPosition(finalPosition);
        usePlayerStore.getState().setVelocity({ x: 0, y: 0, z: 0 });
        console.log(
          `[World] ${resolvedSpawn?.source ?? 'fallback'} spawn at ${finalPosition.x.toFixed(1)}, ${finalPosition.y.toFixed(1)}, ${finalPosition.z.toFixed(1)}`
        );
      } else if (!isValidPosition(currentPosition.x, currentPosition.y, currentPosition.z)) {
        const recoveredSpawn = resolveSpawnLocation({
          originX: currentPosition.x,
          originZ: currentPosition.z,
          searchRadius: 64,
          requireLoadedChunks: true,
          allowFallback: true,
          fallbackY: 64,
        });

        if (recoveredSpawn) {
          finalPosition = recoveredSpawn.position;
          usePlayerStore.getState().setPosition(finalPosition);
          usePlayerStore.getState().setVelocity({ x: 0, y: 0, z: 0 });
          console.log(
            `[World] Recovered saved spawn at ${finalPosition.x.toFixed(1)}, ${finalPosition.y.toFixed(1)}, ${finalPosition.z.toFixed(1)}`
          );
        }
      }

      if (cancelled) return;
      entityManager.populateAroundPlayer(finalPosition.x, finalPosition.z, 18);
      useGameStore.getState().setLoading(true, 100, 'Done!');

      setTimeout(() => {
        if (cancelled) return;
        useGameStore.getState().setLoading(false);
        useGameStore.getState().setGameState('playing');
        setInitialized(true);
      }, 120);
    };

    initializeWorld();

    return () => {
      cancelled = true;
    };
  }, [gameState, worldSeed, worldGenerationMode, worldInitMode, renderDistance]);

  // Stream in/out chunks as player moves
  const lastUpdateRef = useRef(0);
  const lastChunkRef = useRef<{ x: number; z: number; effectiveDistance: number } | null>(null);
  const frameSampleRef = useRef({ acc: 0, count: 0, lastNow: 0 });
  const visibleChunkKeyRef = useRef('');
  const lastVisibilityUpdateRef = useRef(0);
  const lastCameraPoseRef = useRef({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const chunkBoundsCacheRef = useRef(new Map<string, Box3>());

  useEffect(() => {
    const activeChunks = new Set(loadedChunkList);
    const cache = chunkBoundsCacheRef.current;
    for (const key of cache.keys()) {
      if (!activeChunks.has(key)) {
        cache.delete(key);
      }
    }
  }, [loadedChunkList]);

  function getChunkBounds(key: string): Box3 {
    const cache = chunkBoundsCacheRef.current;
    const existing = cache.get(key);
    if (existing) return existing;

    const [cx, cz] = key.split(',').map(Number);
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const box = new Box3(
      new Vector3(minX - 1, -2, minZ - 1),
      new Vector3(minX + CHUNK_SIZE + 1, CHUNK_HEIGHT, minZ + CHUNK_SIZE + 1)
    );
    cache.set(key, box);
    return box;
  }

  useFrame(() => {
    if (!initialized || gameState !== 'playing') return;
    const now = performance.now();
    const manager = getChunkManager();
    const position = usePlayerStore.getState().position;
    camera.updateMatrixWorld();
    const currentChunkX = Math.floor(position.x / CHUNK_SIZE);
    const currentChunkZ = Math.floor(position.z / CHUNK_SIZE);
    playerChunkRef.current = { x: currentChunkX, z: currentChunkZ };
    const maxDistance = Math.max(renderDistance, MIN_EFFECTIVE_RENDER_DISTANCE);
    const effectiveDistance = Math.max(
      MIN_EFFECTIVE_RENDER_DISTANCE,
      Math.min(maxDistance, adaptiveRenderDistance)
    );
    const last = lastChunkRef.current;
    const chunkChanged = !last || last.x !== currentChunkX || last.z !== currentChunkZ || last.effectiveDistance !== effectiveDistance;
    const queueNotEmpty = manager.getQueueSize() > 0;

    // Only do expensive chunk update when chunk boundary changes, render distance changes,
    // or there is still queued generation work to drain.
    if (!chunkChanged && !queueNotEmpty) return;

    // Conservative throttling to keep game smooth
    let intervalMs: number;
    if (queueNotEmpty) {
      // Queue exist - throttle more to process queue
      const queueSize = manager.getQueueSize();
      if (queueSize > 20) {
        intervalMs = 80; // Reduced from 300 - faster loading when behind
      } else if (queueSize > 10) {
        intervalMs = 50; // Reduced from 200 - faster loading
      } else {
        intervalMs = 30; // Reduced from 150 - responsive loading
      }
    } else {
      intervalMs = chunkChanged ? 50 : 100; // Much faster updates
    }
    
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
        setAdaptiveRenderDistance((prev) => Math.max(MIN_EFFECTIVE_RENDER_DISTANCE, prev - 1));
      } else if (avgFrameMs < 18) {
        setAdaptiveRenderDistance((prev) => Math.min(maxDistance, prev + 1));
      }
    }

    manager.update(position.x, position.z, effectiveDistance);
    lastChunkRef.current = { x: currentChunkX, z: currentChunkZ, effectiveDistance };

    const cameraMoved =
      Math.abs(camera.position.x - lastCameraPoseRef.current.x) > 0.25 ||
      Math.abs(camera.position.y - lastCameraPoseRef.current.y) > 0.25 ||
      Math.abs(camera.position.z - lastCameraPoseRef.current.z) > 0.25 ||
      Math.abs(camera.rotation.y - lastCameraPoseRef.current.yaw) > 0.03 ||
      Math.abs(camera.rotation.x - lastCameraPoseRef.current.pitch) > 0.03;
    const shouldRefreshVisibility =
      chunkChanged ||
      cameraMoved ||
      now - lastVisibilityUpdateRef.current > 75;

    if (!shouldRefreshVisibility) return;
    lastVisibilityUpdateRef.current = now;
    lastCameraPoseRef.current = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
    };

    const frustum = new Frustum();
    const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    const visibleKeys: string[] = [];
    for (const key of loadedChunkList) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - currentChunkX;
      const dz = cz - currentChunkZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > effectiveDistance * effectiveDistance) continue;

      if (frustum.intersectsBox(getChunkBounds(key))) {
        visibleKeys.push(key);
      }
    }

    visibleKeys.sort();
    const nextKey = visibleKeys.join('|');
    if (nextKey !== visibleChunkKeyRef.current) {
      visibleChunkKeyRef.current = nextKey;
      setVisibleChunkKeys(visibleKeys);
    }
  });

  // Mark dirty chunks for mesh rebuild
  useEffect(() => {
    const dirty = clearDirtyChunks();
    if (dirty.length === 0) return;
    setChunkVersions((prev) => {
      const next = new Map(prev);
      for (const key of dirty) next.set(key, (next.get(key) || 0) + 1);
      return next;
    });
  }, [dirtyChunkVersion, clearDirtyChunks]);

  // Only recompute chunk list when crossing chunk boundary
  const chunksToRender = useMemo(() => {
    const chunks: { x: number; z: number; key: string; distance: number }[] = [];
    const visibleSet = visibleChunkKeys.length > 0 ? new Set(visibleChunkKeys) : null;
    const effectiveDistance = Math.max(
      MIN_EFFECTIVE_RENDER_DISTANCE,
      Math.min(Math.max(renderDistance, MIN_EFFECTIVE_RENDER_DISTANCE), adaptiveRenderDistance)
    );
    const r2 = effectiveDistance * effectiveDistance;

    for (const key of loadedChunkList) {
      if (visibleSet && !visibleSet.has(key)) continue;
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunkRef.current.x;
      const dz = cz - playerChunkRef.current.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= r2) chunks.push({ x: cx, z: cz, key, distance: Math.sqrt(distSq) });
    }

    return chunks.sort((a, b) => a.distance - b.distance);
  }, [adaptiveRenderDistance, loadedChunkList, renderDistance, visibleChunkKeys]);

  if (!initialized) return null;

  return (
    <group>
      {chunksToRender.map(({ x, z, key }) => (
        <MemoizedChunk key={key} chunkX={x} chunkZ={z} version={chunkVersions.get(key) || 0} />
      ))}
    </group>
  );
}
