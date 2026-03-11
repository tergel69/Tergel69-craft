/**
 * blockTextures.ts
 *
 * Procedural canvas textures for all block types.
 * Ore textures have a stone-grey base with colored vein patterns drawn on top,
 * matching the Minecraft style: you see rock with streaks of the ore color.
 *
 * Usage — import getBlockTexture and use as map in MeshLambertMaterial:
 *   import { getBlockTexture } from '@/components/blockTextures';
 *   const mat = new THREE.MeshLambertMaterial({ map: getBlockTexture(BlockType.DIAMOND_ORE) });
 *
 * All textures are 16×16 with NearestFilter (pixelated).
 * Results are cached — each block type is generated once.
 */

import * as THREE from 'three';
import { BlockType } from '@/data/blocks';

const SIZE = 16;

// ── Deterministic pseudo-random from seed ──────────────────────────────────
function rng(seed: number): number {
  const s = Math.sin(seed * 9301.0 + 49297.0) * 233280.0;
  return s - Math.floor(s);
}

// ── Base block colors ──────────────────────────────────────────────────────
type RGB = [number, number, number];

const BASE_COLORS: Partial<Record<number, RGB>> = {
  [BlockType.GRASS]:         [0x56, 0x8B, 0x2F],
  [BlockType.DIRT]:          [0x8B, 0x5E, 0x3C],
  [BlockType.STONE]:         [0x80, 0x80, 0x80],
  [BlockType.COBBLESTONE]:   [0x6E, 0x6E, 0x6E],
  [BlockType.SAND]:          [0xED, 0xD0, 0x89],
  [BlockType.GRAVEL]:        [0x8F, 0x8B, 0x88],
  [BlockType.OAK_LOG]:        [0x6B, 0x4C, 0x11],
  [BlockType.OAK_PLANKS]:     [0xC8, 0xA0, 0x50],
  [BlockType.OAK_LEAVES]:     [0x3A, 0x7D, 0x1E],
  [BlockType.GLASS]:          [0xAA, 0xDD, 0xFF],
  [BlockType.OBSIDIAN]:       [0x18, 0x0A, 0x2E],
  [BlockType.GLOWSTONE]:      [0xFF, 0xEE, 0x77],
  [BlockType.NETHERRACK]:     [0x8B, 0x1C, 0x1C],
  [BlockType.SNOW]:           [0xF0, 0xF4, 0xFF],
  [BlockType.BEDROCK]:        [0x33, 0x33, 0x33],
  [BlockType.WATER]:          [0x1A, 0x66, 0xCC],
  [BlockType.LAVA]:           [0xFF, 0x66, 0x00],
};

// ── Ore configs: [oreColor, veinCount, veinSize] ───────────────────────────
type OreConfig = { ore: RGB; veins: number; veinR: number };

const ORE_CONFIGS: Partial<Record<number, OreConfig>> = {
  [BlockType.COAL_ORE]:     { ore: [0x1A, 0x1A, 0x1A], veins: 5, veinR: 2.2 },
  [BlockType.IRON_ORE]:     { ore: [0xD4, 0xA5, 0x84], veins: 4, veinR: 1.8 },
  [BlockType.GOLD_ORE]:     { ore: [0xFF, 0xD7, 0x00], veins: 4, veinR: 1.6 },
  [BlockType.DIAMOND_ORE]:  { ore: [0x00, 0xE5, 0xFF], veins: 3, veinR: 1.5 },
  [BlockType.REDSTONE_ORE]: { ore: [0xFF, 0x22, 0x00], veins: 5, veinR: 1.4 },
  [BlockType.LAPIS_ORE]:    { ore: [0x22, 0x55, 0xCC], veins: 4, veinR: 1.8 },
  [BlockType.EMERALD_ORE]:  { ore: [0x00, 0xCC, 0x44], veins: 3, veinR: 1.4 },
};

// ── Draw a stone-base texture with noise ──────────────────────────────────
function drawStoneBase(ctx: CanvasRenderingContext2D, seed: number) {
  const base: RGB = [0x80, 0x80, 0x80];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng(x * 17 + y * 31 + seed) * 0.22 - 0.11;
      const r = Math.max(0, Math.min(255, base[0] + n * 80));
      const g = Math.max(0, Math.min(255, base[1] + n * 80));
      const b = Math.max(0, Math.min(255, base[2] + n * 80));
      ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ── Draw blob-like ore veins ───────────────────────────────────────────────
function drawOreVeins(
  ctx: CanvasRenderingContext2D,
  cfg: OreConfig,
  seed: number
) {
  const [or, og, ob] = cfg.ore;

  for (let v = 0; v < cfg.veins; v++) {
    const cx = 2 + Math.floor(rng(seed + v * 7.1) * (SIZE - 4));
    const cy = 2 + Math.floor(rng(seed + v * 13.3) * (SIZE - 4));
    const r  = cfg.veinR * (0.7 + rng(seed + v * 3.7) * 0.6);

    for (let py = Math.floor(cy - r - 1); py <= Math.ceil(cy + r + 1); py++) {
      for (let px = Math.floor(cx - r - 1); px <= Math.ceil(cx + r + 1); px++) {
        if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;

        // Blob shape: ellipse with some noise distortion
        const dx = px - cx, dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noiseD = rng(px * 41 + py * 73 + v * 19 + seed) * 0.6;

        if (dist + noiseD < r) {
          // Ore pixel — add some variation so it's not a flat color
          const bright = 0.85 + rng(px * 11 + py * 23 + seed) * 0.3;
          const nr = Math.round(Math.min(255, or * bright));
          const ng = Math.round(Math.min(255, og * bright));
          const nb = Math.round(Math.min(255, ob * bright));
          ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
          ctx.fillRect(px, py, 1, 1);
        } else if (dist + noiseD < r + 0.8) {
          // Dark outline pixel for contrast
          ctx.fillStyle = `rgba(0,0,0,0.35)`;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }
}

// ── Draw a plain colored block with noise variation ────────────────────────
function drawColorBlock(ctx: CanvasRenderingContext2D, base: RGB, seed: number) {
  const [br, bg, bb] = base;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng(x * 17 + y * 31 + seed) * 0.18 - 0.09;
      const r = Math.max(0, Math.min(255, br + n * 70));
      const g = Math.max(0, Math.min(255, bg + n * 70));
      const b = Math.max(0, Math.min(255, bb + n * 70));
      ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ── Draw edge shading (Minecraft-style bevel) ─────────────────────────────
function drawEdges(ctx: CanvasRenderingContext2D) {
  // Top-left highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, SIZE); ctx.lineTo(0, 0); ctx.lineTo(SIZE, 0);
  ctx.stroke();
  // Bottom-right shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(SIZE, 0); ctx.lineTo(SIZE, SIZE); ctx.lineTo(0, SIZE);
  ctx.stroke();
}

// ── Draw glowstone with bright veiny pattern ──────────────────────────────
function drawGlowstone(ctx: CanvasRenderingContext2D) {
  // Dark brown base
  drawColorBlock(ctx, [0x7A, 0x5C, 0x1E], 42);
  // Bright yellow-white cracks
  for (let i = 0; i < 8; i++) {
    const x1 = Math.floor(rng(i * 11) * SIZE);
    const y1 = Math.floor(rng(i * 17) * SIZE);
    const x2 = Math.floor(rng(i * 23) * SIZE);
    const y2 = Math.floor(rng(i * 31) * SIZE);
    ctx.strokeStyle = `rgba(255,240,120,${0.5 + rng(i * 7) * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Bright center dots
  for (let i = 0; i < 4; i++) {
    const x = 3 + Math.floor(rng(i * 37) * (SIZE - 6));
    const y = 3 + Math.floor(rng(i * 43) * (SIZE - 6));
    ctx.fillStyle = 'rgba(255,250,180,0.9)';
    ctx.fillRect(x, y, 2, 2);
  }
}

// ── Draw lava with hot animated-style look ────────────────────────────────
function drawLava(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n1 = rng(x * 17 + y * 31 + 1001);
      const n2 = rng(x * 13 + y * 37 + 2002);
      // Mix orange and dark red
      if (n1 > 0.75) {
        ctx.fillStyle = `rgb(255,${Math.round(220 + n2 * 35)},0)`;    // bright yellow-orange
      } else if (n1 > 0.45) {
        ctx.fillStyle = `rgb(${Math.round(200 + n2 * 55)},${Math.round(60 + n2 * 40)},0)`;  // orange
      } else {
        ctx.fillStyle = `rgb(${Math.round(120 + n2 * 60)},${Math.round(20 + n2 * 20)},0)`;  // dark red
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Bright hot spots
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(rng(i * 53) * (SIZE - 4));
    const y = 2 + Math.floor(rng(i * 61) * (SIZE - 4));
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    ctx.fillRect(x, y, 2, 1);
  }
}

// ── Draw water with blue gradient look ───────────────────────────────────
function drawWater(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng(x * 11 + y * 23 + 3003) * 0.3;
      const r = Math.round(20  + n * 30);
      const g = Math.round(90  + n * 40);
      const b = Math.round(200 + n * 55);
      ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Wave highlight lines
  for (let i = 0; i < 2; i++) {
    const y = 4 + i * 6;
    ctx.strokeStyle = 'rgba(180,220,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < SIZE; x++) {
      const wy = y + Math.sin(x * 0.8 + i * 2) * 1.2;
      if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
}

// ── Draw grass top (green top + brown sides blended) ─────────────────────
function drawGrass(ctx: CanvasRenderingContext2D) {
  // Top half: green grass
  for (let y = 0; y < SIZE / 2; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng(x * 17 + y * 31 + 5) * 0.2 - 0.1;
      const r = Math.round(Math.max(0, Math.min(255, 0x56 + n * 60)));
      const g = Math.round(Math.max(0, Math.min(255, 0x8B + n * 60)));
      const b = Math.round(Math.max(0, Math.min(255, 0x2F + n * 40)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Bottom half: dirt
  for (let y = SIZE / 2; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng(x * 19 + y * 37 + 6) * 0.2 - 0.1;
      const r = Math.round(Math.max(0, Math.min(255, 0x8B + n * 60)));
      const g = Math.round(Math.max(0, Math.min(255, 0x5E + n * 40)));
      const b = Math.round(Math.max(0, Math.min(255, 0x3C + n * 30)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ── Draw netherrack ────────────────────────────────────────────────────────
function drawNetherrack(ctx: CanvasRenderingContext2D) {
  drawColorBlock(ctx, [0x8B, 0x1C, 0x1C], 77);
  // Dark cracks
  for (let i = 0; i < 5; i++) {
    const x1 = Math.floor(rng(i * 19) * SIZE);
    const y1 = Math.floor(rng(i * 23) * SIZE);
    ctx.strokeStyle = `rgba(40,0,0,0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.floor(rng(i*29)*4-2), y1 + Math.floor(rng(i*31)*4));
    ctx.stroke();
  }
}

// ── Draw obsidian ─────────────────────────────────────────────────────────
function drawObsidian(ctx: CanvasRenderingContext2D) {
  drawColorBlock(ctx, [0x18, 0x0A, 0x2E], 99);
  // Purple shimmer dots
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng(i * 41) * SIZE);
    const y = Math.floor(rng(i * 47) * SIZE);
    ctx.fillStyle = `rgba(100,50,180,${0.3 + rng(i * 11) * 0.4})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

// ── Main texture builder ───────────────────────────────────────────────────
function buildTexture(blockType: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const oreCfg = ORE_CONFIGS[blockType];
  const seed = blockType * 73;

  if (oreCfg) {
    // Ore: stone base + colored vein blobs
    drawStoneBase(ctx, seed);
    drawOreVeins(ctx, oreCfg, seed);
  } else if (blockType === BlockType.GRASS) {
    drawGrass(ctx);
  } else if (blockType === BlockType.GLOWSTONE) {
    drawGlowstone(ctx);
  } else if (blockType === BlockType.LAVA) {
    drawLava(ctx);
  } else if (blockType === BlockType.WATER) {
    drawWater(ctx);
  } else if (blockType === BlockType.NETHERRACK) {
    drawNetherrack(ctx);
  } else if (blockType === BlockType.OBSIDIAN) {
    drawObsidian(ctx);
  } else {
    const base = BASE_COLORS[blockType] ?? [0x88, 0x88, 0x88];
    drawColorBlock(ctx, base, seed);
  }

  drawEdges(ctx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ── Cache & public getter ──────────────────────────────────────────────────
const _cache = new Map<number, THREE.CanvasTexture>();

export function getBlockTexture(blockType: number): THREE.CanvasTexture {
  if (_cache.has(blockType)) return _cache.get(blockType)!;
  const tex = buildTexture(blockType);
  _cache.set(blockType, tex);
  return tex;
}

/** Preload common block types at startup to avoid first-frame stutters */
export function preloadBlockTextures(): void {
  const common = [
    BlockType.GRASS, BlockType.DIRT, BlockType.STONE,
    BlockType.COBBLESTONE, BlockType.SAND, BlockType.GRAVEL,
    BlockType.OAK_LOG, BlockType.OAK_PLANKS, BlockType.OAK_LEAVES,
    BlockType.COAL_ORE, BlockType.IRON_ORE, BlockType.GOLD_ORE,
    BlockType.DIAMOND_ORE, BlockType.REDSTONE_ORE, BlockType.LAPIS_ORE,
    BlockType.EMERALD_ORE, BlockType.OBSIDIAN, BlockType.GLOWSTONE,
    BlockType.NETHERRACK, BlockType.WATER, BlockType.LAVA,
  ];
  for (const bt of common) getBlockTexture(bt);
}