'use client';

/**
 * DroppedItems.tsx — fixed version
 *
 * Fixes vs previous:
 *  1. Block pass-through: proper solid-block ground detection using worldStore
 *  2. Duplication: collect flag set immediately (no race condition)
 *  3. Lights: removed per-item point light; only glowing ores/special blocks get one
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType, isSolid } from '@/data/blocks';

// ─── Store ────────────────────────────────────────────────────────────────────

export interface DroppedItem {
  id:        string;
  blockType: number;
  x:         number;
  y:         number;
  z:         number;
  vy:        number;
  spawnTime: number;
  collected: boolean;
}

interface DroppedItemStore {
  items:         DroppedItem[];
  spawnDrop:     (blockType: number, x: number, y: number, z: number) => void;
  collectItem:   (id: string) => void;
  clearCollected:() => void;
}

let _id = 0;

export const useDroppedItemStore = create<DroppedItemStore>((set) => ({
  items: [],

  spawnDrop(blockType, x, y, z) {
    if (blockType === BlockType.AIR) return;
    const id = `drop_${++_id}`;
    const scatter = () => (Math.random() - 0.5) * 0.5;
    set(s => ({
      items: [...s.items, {
        id,
        blockType,
        x: x + 0.5 + scatter(),
        y: y + 1.0,          // start 1 block above where it was broken
        z: z + 0.5 + scatter(),
        vy: 2.0 + Math.random() * 1.0,
        spawnTime: performance.now() / 1000,
        collected: false,
      }],
    }));
  },

  // Mark collected immediately to prevent double-pickup
  collectItem(id) {
    set(s => ({
      items: s.items.map(i => i.id === id ? { ...i, collected: true } : i),
    }));
  },

  clearCollected() {
    set(s => ({ items: s.items.filter(i => !i.collected) }));
  },
}));

// ─── Colors ───────────────────────────────────────────────────────────────────

const BLOCK_COLORS: Partial<Record<number, [number, number, number]>> = {
  [BlockType.GRASS]:         [0x55, 0x8B, 0x2F],
  [BlockType.DIRT]:          [0x8B, 0x5E, 0x3C],
  [BlockType.STONE]:         [0x80, 0x80, 0x80],
  [BlockType.COBBLESTONE]:   [0x6E, 0x6E, 0x6E],
  [BlockType.SAND]:          [0xED, 0xD0, 0x89],
  [BlockType.GRAVEL]:        [0x8F, 0x8B, 0x88],
  [BlockType.OAK_LOG]:       [0x6B, 0x4C, 0x11],
  [BlockType.OAK_PLANKS]:    [0xC8, 0xA0, 0x50],
  [BlockType.OAK_LEAVES]:    [0x3A, 0x7D, 0x1E],
  [BlockType.COAL_ORE]:      [0x33, 0x33, 0x33],
  [BlockType.IRON_ORE]:      [0xBF, 0x96, 0x78],
  [BlockType.GOLD_ORE]:      [0xFF, 0xD7, 0x00],
  [BlockType.DIAMOND_ORE]:   [0x00, 0xCC, 0xCC],
  [BlockType.REDSTONE_ORE]:  [0xCC, 0x00, 0x00],
  [BlockType.LAPIS_ORE]:     [0x22, 0x44, 0xAA],
  [BlockType.EMERALD_ORE]:   [0x00, 0xBB, 0x55],
  [BlockType.GLOWSTONE]:     [0xFF, 0xEE, 0x77],
  [BlockType.OBSIDIAN]:      [0x18, 0x0A, 0x2E],
  [BlockType.NETHERRACK]:    [0x8B, 0x1C, 0x1C],
};

// Only GLOWING blocks get a point light — avoids dozens of lights in scene
const GLOWING_BLOCKS = new Set([
  BlockType.GLOWSTONE,
  BlockType.REDSTONE_ORE,
  BlockType.DIAMOND_ORE,
  BlockType.EMERALD_ORE,
]);

function getColor(bt: number): THREE.Color {
  const rgb = BLOCK_COLORS[bt];
  return rgb ? new THREE.Color(rgb[0]/255, rgb[1]/255, rgb[2]/255) : new THREE.Color(0.55, 0.55, 0.55);
}

// Canvas texture cache
const texCache = new Map<number, THREE.CanvasTexture>();
function getTexture(bt: number): THREE.CanvasTexture {
  if (texCache.has(bt)) return texCache.get(bt)!;
  const size = 16;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const c = getColor(bt);
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  const rng = (s: number) => { s = Math.sin(s * 9301 + 49297) * 233280; return s - Math.floor(s); };
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const n = rng(px * 17 + py * 31 + bt * 7) * 0.2 - 0.1;
    const nr = Math.max(0, Math.min(255, r + n * 80));
    const ng2 = Math.max(0, Math.min(255, g + n * 80));
    const nb = Math.max(0, Math.min(255, b + n * 80));
    ctx.fillStyle = `rgb(${Math.round(nr)},${Math.round(ng2)},${Math.round(nb)})`;
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(0, 0); ctx.lineTo(size, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  texCache.set(bt, t);
  return t;
}

// ─── Physics constants ────────────────────────────────────────────────────────
const GRAVITY      = 14.0;
const BOB_SPEED    = 2.2;
const BOB_HEIGHT   = 0.10;
const PICKUP_DIST  = 1.5;
const DESPAWN_SECS = 300;
const ITEM_SIZE    = 0.35;

// ─── Single drop ──────────────────────────────────────────────────────────────

function SingleDrop({ item }: { item: DroppedItem }) {
  const meshRef   = useRef<THREE.Group>(null);
  const px        = useRef(item.x);
  const py        = useRef(item.y);
  const pz        = useRef(item.z);
  const vy        = useRef(item.vy);
  const landed    = useRef(false);
  const landedY   = useRef(0);
  const pickedUp  = useRef(false); // local flag to prevent double-fire

  const tex = useMemo(() => getTexture(item.blockType), [item.blockType]);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ map: tex }), [tex]);
  const glows = GLOWING_BLOCKS.has(item.blockType);
  const glowColor = useMemo(() => getColor(item.blockType), [item.blockType]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || item.collected || pickedUp.current) return;

    const now = performance.now() / 1000;
    if (now - item.spawnTime > DESPAWN_SECS) {
      pickedUp.current = true;
      useDroppedItemStore.getState().collectItem(item.id);
      return;
    }

    const dt = Math.min(delta, 0.05); // clamp delta to avoid tunnelling on lag spikes

    if (!landed.current) {
      vy.current -= GRAVITY * dt;
      const nextY = py.current + vy.current * dt;

      // --- Solid block ground detection using worldStore ---
      const wx = Math.floor(px.current);
      const wz = Math.floor(pz.current);
      const worldStore = useWorldStore.getState();

      // Check the block that the item would be moving into
      const feetY = Math.floor(nextY);
      const blockBelow = worldStore.getBlock(wx, feetY, wz);
      const blockAtFeet = worldStore.getBlock(wx, Math.floor(nextY + ITEM_SIZE), wz);

      const hitGround = isSolid(blockBelow) && !isSolid(blockAtFeet);

      if (hitGround && vy.current < 0) {
        // Snap to top surface of the solid block
        py.current = feetY + 1 + 0.01;
        vy.current = 0;
        landed.current = true;
        landedY.current = py.current;
      } else {
        py.current = nextY;
      }
    }

    // Bob once landed
    const bob = landed.current
      ? Math.sin(now * BOB_SPEED + item.spawnTime) * BOB_HEIGHT
      : 0;

    mesh.position.set(px.current, py.current + bob, pz.current);
    mesh.rotation.y = now * 1.8;

    // Pickup
    const player = usePlayerStore.getState().position;
    const dx = player.x - px.current;
    const dy = (player.y + 1) - py.current;
    const dz = player.z - pz.current;
    if (Math.sqrt(dx*dx + dy*dy + dz*dz) < PICKUP_DIST) {
      pickedUp.current = true; // prevent re-entry before store update propagates
      useInventoryStore.getState().addItem?.(item.blockType, 1);
      useDroppedItemStore.getState().collectItem(item.id);
    }
  });

  if (item.collected) return null;

  return (
    <group ref={meshRef} position={[item.x, item.y, item.z]}>
      <mesh material={mat} castShadow>
        <boxGeometry args={[ITEM_SIZE, ITEM_SIZE, ITEM_SIZE]} />
      </mesh>
      {/* Only glowing blocks get a light — greatly reduces light count in scene */}
      {glows && (
        <pointLight color={glowColor} intensity={0.5} distance={3} decay={2} />
      )}
    </group>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

export default function DroppedItems() {
  const items = useDroppedItemStore(s => s.items);

  useEffect(() => {
    const id = setInterval(() => {
      useDroppedItemStore.getState().clearCollected();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {items.filter(i => !i.collected).map(item => (
        <SingleDrop key={item.id} item={item} />
      ))}
    </>
  );
}