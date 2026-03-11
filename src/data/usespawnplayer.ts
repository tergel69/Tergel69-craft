/**
 * useSpawnPlayer.ts
 *
 * Safely spawns the player ON the surface after chunks generate.
 *
 * ROOT CAUSE of underground spawning:
 *   Spawn logic runs before chunks are generated. getBlock returns 0/undefined
 *   everywhere, so the surface scan finds nothing and falls back to a hardcoded Y
 *   (often 64) which ends up inside stone once terrain actually generates.
 *
 * FIX:
 *   1. Gate on MULTIPLE block checks — require that several points in the spawn
 *      area return non-undefined values AND that at least one solid block is found.
 *   2. Scan downward from y=240 (above any possible terrain height).
 *   3. Retry every 100ms for up to 15 seconds, then fall back to y=180 so the
 *      player falls down to the surface rather than spawning inside rock.
 *
 * USAGE — call once inside your World component:
 *   import { useSpawnPlayer } from '@/hooks/useSpawnPlayer';  // adjust path
 *   export default function World() {
 *     useSpawnPlayer();
 *     ...
 *   }
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore } from '@/stores/gameStore';
import { BlockType } from '@/data/blocks';

const SPAWN_X   = 0;
const SPAWN_Z   = 0;
const MAX_TRIES = 150;   // 15 seconds at 100ms
const INTERVAL  = 100;   // ms between retries

// Gate: require multiple points in spawn area to be loaded
function chunksReady(): boolean {
  const w = useWorldStore.getState();
  const tests: [number, number, number][] = [
    [SPAWN_X,     50, SPAWN_Z    ],
    [SPAWN_X + 8, 50, SPAWN_Z    ],
    [SPAWN_X,     50, SPAWN_Z + 8],
    [SPAWN_X - 8, 50, SPAWN_Z - 8],
  ];
  let loaded = 0;
  for (const [x, y, z] of tests) {
    const b = w.getBlock(x, y, z);
    if (b !== undefined && b !== null) loaded++;
  }
  return loaded >= 3;
}

// Scan down from very top to find surface
function findSurface(wx: number, wz: number): number | null {
  const w  = useWorldStore.getState();
  const fx = Math.floor(wx);
  const fz = Math.floor(wz);

  for (let y = 240; y >= 2; y--) {
    const b = w.getBlock(fx, y, fz);
    if (b === undefined || b === null) continue;
    if (b === BlockType.AIR || b === BlockType.WATER || b === BlockType.LAVA) continue;

    // Need 2 clear blocks above to stand in
    const a1 = w.getBlock(fx, y + 1, fz);
    const a2 = w.getBlock(fx, y + 2, fz);
    if ((a1 === BlockType.AIR || a1 === undefined) &&
        (a2 === BlockType.AIR || a2 === undefined)) {
      return y + 1;
    }
  }
  return null;
}

// Spiral outward to find the first safe spawn point
function findSafeSpawn(): { x: number; y: number; z: number } | null {
  const candidates: [number, number][] = [[SPAWN_X, SPAWN_Z]];
  for (let r = 4; r <= 32; r += 4) {
    for (let d = -r; d <= r; d += 4) {
      candidates.push([SPAWN_X + d, SPAWN_Z - r]);
      candidates.push([SPAWN_X + d, SPAWN_Z + r]);
      candidates.push([SPAWN_X - r, SPAWN_Z + d]);
      candidates.push([SPAWN_X + r, SPAWN_Z + d]);
    }
  }
  for (const [cx, cz] of candidates) {
    const y = findSurface(cx, cz);
    if (y !== null && y > 4 && y < 235) {
      return { x: cx + 0.5, y, z: cz + 0.5 };
    }
  }
  return null;
}

export function useSpawnPlayer() {
  const done  = useRef(false);
  const tries = useRef(0);

  useEffect(() => {
    done.current  = false;
    tries.current = 0;

    const attempt = () => {
      if (done.current) return;
      const gs = useGameStore.getState().gameState;
      if (gs !== 'playing' && gs !== 'loading') return;

      tries.current++;

      if (!chunksReady() && tries.current < MAX_TRIES) return;

      const spawn = findSafeSpawn();
      if (!spawn && tries.current < MAX_TRIES) return;

      const pos = spawn ?? { x: SPAWN_X + 0.5, y: 180, z: SPAWN_Z + 0.5 };

      // Set position (try both API styles)
      try { usePlayerStore.getState().setPosition(pos); } catch (_) {}
      usePlayerStore.setState((s: any) => ({ ...s, position: pos, velocity: { x:0, y:0, z:0 } }));

      console.log(`[Spawn] ${spawn ? 'surface' : 'fallback'} → y=${pos.y.toFixed(1)} (try ${tries.current})`);
      done.current = true;
      clearInterval(id);
    };

    const id = setInterval(attempt, INTERVAL);
    attempt();
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}