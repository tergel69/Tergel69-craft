/**
 * experience.ts — XP orb system
 *
 * Tracks experience orbs in the world, handles spawning from ore drops
 * and mob kills, and automates collection when the player walks near.
 */

import { create } from 'zustand';
import { usePlayerStore } from '@/stores/playerStore';
import { BlockType } from '@/data/blocks';
import { MOB_XP_REWARDS } from '@/data/mobXp';

// ─── Orb types ────────────────────────────────────────────────────────────────

export interface XpOrb {
  id: string;
  value: number;   // 1–10 XP
  x: number;
  y: number;
  z: number;
  vy: number;
  spawnTime: number;
  collected: boolean;
  age: number;     // seconds alive (used for animation)
  target?: { x: number; y: number; z: number }; // magnetic pull destination
}

interface XpStore {
  orbs: XpOrb[];
  spawnOrb: (value: number, x: number, y: number, z: number) => void;
  spawnOrbs: (value: number, x: number, y: number, z: number) => void;
  collectOrb: (id: string) => void;
  clearCollected: () => void;
  updateOrbs: (delta: number) => void;
}

let _xpId = 0;

export const useXpStore = create<XpStore>((set, get) => ({
  orbs: [],

  spawnOrb(value, x, y, z) {
    const id = `xp_${++_xpId}`;
    const scatter = () => (Math.random() - 0.5) * 0.8;
    set(s => ({
      orbs: [...s.orbs, {
        id,
        value,
        x: x + scatter(),
        y: y + 0.5,
        z: z + scatter(),
        vy: 0.5 + Math.random() * 0.8,
        spawnTime: performance.now() / 1000,
        collected: false,
        age: 0,
      }],
    }));
  },

  spawnOrbs(totalValue, x, y, z) {
    // Split total XP into smaller orbs (1–5 XP each, like Minecraft)
    let remaining = totalValue;
    while (remaining > 0) {
      const orbValue = Math.min(remaining, 1 + Math.floor(Math.random() * 4));
      remaining -= orbValue;
      get().spawnOrb(orbValue, x, y, z);
    }
  },

  collectOrb(id) {
    set(s => ({
      orbs: s.orbs.map(o => o.id === id ? { ...o, collected: true } : o),
    }));
  },

  clearCollected() {
    set(s => ({ orbs: s.orbs.filter(o => !o.collected) }));
  },

  updateOrbs(delta) {
    const playerPos = usePlayerStore.getState().position;
    const orbs = get().orbs;
    const now = performance.now() / 1000;
    const PICKUP_RANGE = 8;   // Start magnetic pull at 8 blocks
    const PICKUP_SPEED = 12;  // Speed when being pulled
    const DESPAWN_TIME = 300; // 5 minutes
    const MAX_ORBS = 200;

    for (const orb of orbs) {
      if (orb.collected) continue;
      orb.age += delta;

      // Despawn old orbs
      if (now - orb.spawnTime > DESPAWN_TIME) {
        orb.collected = true;
        continue;
      }

      // Gravity
      if (orb.vy > -2) orb.vy -= 14 * delta;
      orb.y += orb.vy * delta;
      if (orb.y < 0) orb.y = 0;

      // Magnetic pull toward player
      const dx = playerPos.x - orb.x;
      const dy = (playerPos.y + 0.5) - orb.y;
      const dz = playerPos.z - orb.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < PICKUP_RANGE * PICKUP_RANGE && distSq > 0.5) {
        const dist = Math.sqrt(distSq);
        const speed = PICKUP_SPEED * Math.max(0.3, 1 - dist / PICKUP_RANGE);
        orb.x += (dx / dist) * speed * delta;
        orb.y += (dy / dist) * speed * delta;
        orb.z += (dz / dist) * speed * delta;

        // Attraction visual — small upward velocity
        orb.vy = Math.min(orb.vy + 6 * delta, 2);
      }

      // Collection
      if (distSq < 1.5 * 1.5) {
        usePlayerStore.getState().addExperience(orb.value);
        orb.collected = true;
      }
    }

    // Cleanup excess
    if (orbs.length > MAX_ORBS) {
      const sorted = [...orbs].sort((a, b) => (a.age - b.age));
      for (let i = MAX_ORBS; i < sorted.length; i++) {
        sorted[i].collected = true;
      }
    }
  },
}));

// ─── XP rewards for blocks ────────────────────────────────────────────────────

export const BLOCK_XP_REWARDS: Partial<Record<BlockType, number>> = {
  [BlockType.COAL_ORE]:      0,    // Coal drops no XP
  [BlockType.IRON_ORE]:      0,    // Iron drops no XP (smelting gives XP)
  [BlockType.GOLD_ORE]:      0,
  [BlockType.COPPER_ORE]:    0,
  [BlockType.DIAMOND_ORE]:   3,    // 3–7 XP
  [BlockType.EMERALD_ORE]:   3,    // 3–7 XP
  [BlockType.LAPIS_ORE]:     2,    // 2–5 XP
  [BlockType.REDSTONE_ORE]:  1,    // 1–5 XP
  [BlockType.NETHER_GOLD_ORE]: 1,
  [BlockType.QUARTZ_ORE]:    1,    // 2–5 XP
  [BlockType.SPAWNER]:       15,   // 15–43 XP
};

export function getBlockXp(blockType: BlockType): number {
  const base = BLOCK_XP_REWARDS[blockType];
  if (base === undefined) return 0;
  if (base <= 0) return 0;
  // Random range: base to base*2 + 1
  return base + Math.floor(Math.random() * (base + 2));
}

export function getMobXp(mobType: string): number {
  const reward = (MOB_XP_REWARDS as Record<string, number>)[mobType];
  if (reward === undefined) return 0;
  // Random range: reward to reward*2
  return reward + Math.floor(Math.random() * (reward + 1));
}