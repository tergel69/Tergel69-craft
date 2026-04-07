import { BlockType } from '@/data/blocks';
import { ItemType, getAllItems } from '@/data/items';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { Chunk } from '@/engine/Chunk';
import { useWorldStore, ContainerSlot } from '@/stores/worldStore';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded RNG  (deterministic per-cell, never bleeds state between templates)
// ─────────────────────────────────────────────────────────────────────────────
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next(): number {
    // xorshift32 — avoids the sin() periodicity issue of the old version
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return (s >>> 0) / 0x100000000;
  }
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SB { dx: number; dy: number; dz: number; type: BlockType; }

interface StructureTemplate {
  name: string;
  /**
   * The world is divided into (gridSize × gridSize) chunk cells.
   * Each cell spawns at most one instance of this template.
   * gridSize=1  → one attempt per chunk  (trees)
   * gridSize=8  → one attempt per 128×128 block area  (rare structures)
   */
  gridSize: number;
  /** 0–1 probability the cell actually spawns (applied after the grid check). */
  probability: number;
  /** Y offset from surface top (positive = above ground, negative = underground). */
  heightOffset: number;
  blocks: SB[];
  /** Surface block must be one of these types (skip if undefined). */
  surfaceBlockTypes?: BlockType[];
  /** If true, the surface-type check is skipped and heightOffset digs underground. */
  underground?: boolean;
  /**
   * Approximate footprint of the structure in blocks.
   * Used to calculate the correct cell-overlap margin so no structure is ever cut off.
   * Defaults to CHUNK_SIZE if not provided.
   */
  footprintX?: number;
  footprintZ?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive builders
// ─────────────────────────────────────────────────────────────────────────────
function fill(x: number, y: number, z: number, w: number, h: number, d: number, t: BlockType): SB[] {
  const out: SB[] = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      for (let dz = 0; dz < d; dz++)
        out.push({ dx: x+dx, dy: y+dy, dz: z+dz, type: t });
  return out;
}
function hollow(
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  wall: BlockType, floorT: BlockType = wall, ceilT: BlockType = wall
): SB[] {
  const out: SB[] = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      for (let dz = 0; dz < d; dz++) {
        if (dx > 0 && dx < w-1 && dy > 0 && dy < h-1 && dz > 0 && dz < d-1) continue;
        out.push({ dx: x+dx, dy: y+dy, dz: z+dz, type: dy===0 ? floorT : dy===h-1 ? ceilT : wall });
      }
  return out;
}
function walls(x: number, y: number, z: number, w: number, h: number, d: number, t: BlockType): SB[] {
  const out: SB[] = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++)
      for (let dz = 0; dz < d; dz++)
        if (dx===0 || dx===w-1 || dz===0 || dz===d-1)
          out.push({ dx: x+dx, dy: y+dy, dz: z+dz, type: t });
  return out;
}
function col(x: number, z: number, y0: number, h: number, t: BlockType): SB[] {
  return Array.from({ length: h }, (_, i) => ({ dx: x, dy: y0+i, dz: z, type: t }));
}
function b(x: number, y: number, z: number, t: BlockType): SB {
  return { dx: x, dy: y, dz: z, type: t };
}

function furnaceEntity(): { type: 'furnace'; input: ContainerSlot; fuel: ContainerSlot; output: ContainerSlot; burnTime: number; cookTime: number } {
  return {
    type: 'furnace',
    input: emptySlot(),
    fuel: emptySlot(),
    output: emptySlot(),
    burnTime: 0,
    cookTime: 0,
  };
}

function remapStructureBlock(type: BlockType, surface: BlockType, templateName: string): BlockType {
  const isSnowy = surface === BlockType.SNOW || surface === BlockType.ICE || templateName.includes('spruce') || templateName.includes('snow');
  const isJungle = templateName.includes('jungle');
  const isCherry = templateName.includes('cherry');
  const isDarkForest = templateName.includes('mansion') || templateName.includes('dark_oak');
  const isDesert = surface === BlockType.SAND || surface === BlockType.RED_SAND || templateName.includes('desert');
  const isVillage = templateName.includes('village') || templateName.includes('outpost') || templateName.includes('hut');

  if (isCherry) {
    if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.SPRUCE_LOG || type === BlockType.JUNGLE_LOG || type === BlockType.ACACIA_LOG || type === BlockType.DARK_OAK_LOG) return BlockType.CHERRY_LOG;
    if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.ACACIA_LEAVES || type === BlockType.DARK_OAK_LEAVES) return BlockType.CHERRY_LEAVES;
    if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.SPRUCE_PLANKS || type === BlockType.JUNGLE_PLANKS || type === BlockType.ACACIA_PLANKS || type === BlockType.DARK_OAK_PLANKS) return BlockType.OAK_PLANKS;
  }

  if (isSnowy) {
    if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.JUNGLE_LOG || type === BlockType.ACACIA_LOG) return BlockType.SPRUCE_LOG;
    if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.ACACIA_LEAVES) return BlockType.SPRUCE_LEAVES;
    if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.JUNGLE_PLANKS || type === BlockType.ACACIA_PLANKS) return BlockType.SPRUCE_PLANKS;
    if (type === BlockType.COBBLESTONE) return BlockType.MOSSY_COBBLESTONE;
  }

  if (isJungle) {
    if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.SPRUCE_LOG || type === BlockType.ACACIA_LOG || type === BlockType.DARK_OAK_LOG) return BlockType.JUNGLE_LOG;
    if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.ACACIA_LEAVES || type === BlockType.DARK_OAK_LEAVES) return BlockType.JUNGLE_LEAVES;
    if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.SPRUCE_PLANKS || type === BlockType.ACACIA_PLANKS || type === BlockType.DARK_OAK_PLANKS) return BlockType.JUNGLE_PLANKS;
    if (type === BlockType.COBBLESTONE) return BlockType.MOSSY_COBBLESTONE;
  }

  if (isDarkForest) {
    if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.SPRUCE_LOG || type === BlockType.JUNGLE_LOG || type === BlockType.ACACIA_LOG) return BlockType.DARK_OAK_LOG;
    if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.ACACIA_LEAVES) return BlockType.DARK_OAK_LEAVES;
    if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.SPRUCE_PLANKS || type === BlockType.JUNGLE_PLANKS || type === BlockType.ACACIA_PLANKS) return BlockType.DARK_OAK_PLANKS;
    if (type === BlockType.COBBLESTONE) return BlockType.MOSSY_COBBLESTONE;
  }

  if (isDesert) {
    if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.SPRUCE_LOG || type === BlockType.JUNGLE_LOG || type === BlockType.ACACIA_LOG || type === BlockType.DARK_OAK_LOG) return BlockType.ACACIA_LOG;
    if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.ACACIA_LEAVES || type === BlockType.DARK_OAK_LEAVES) return BlockType.ACACIA_LEAVES;
    if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.SPRUCE_PLANKS || type === BlockType.JUNGLE_PLANKS || type === BlockType.DARK_OAK_PLANKS || type === BlockType.ACACIA_PLANKS) return BlockType.ACACIA_PLANKS;
    if (type === BlockType.COBBLESTONE || type === BlockType.STONE) return BlockType.SANDSTONE;
    if (type === BlockType.GRASS || type === BlockType.DIRT) return BlockType.RED_SAND;
    if (type === BlockType.TORCH) return BlockType.GLOWSTONE;
  }

  if (isVillage) {
    if (surface === BlockType.SNOW) {
      if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.ACACIA_LOG || type === BlockType.JUNGLE_LOG) return BlockType.SPRUCE_LOG;
      if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.ACACIA_LEAVES || type === BlockType.JUNGLE_LEAVES) return BlockType.SPRUCE_LEAVES;
      if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.ACACIA_PLANKS || type === BlockType.JUNGLE_PLANKS) return BlockType.SPRUCE_PLANKS;
    }
    if (surface === BlockType.SAND || surface === BlockType.RED_SAND) {
      if (type === BlockType.OAK_LOG || type === BlockType.BIRCH_LOG || type === BlockType.SPRUCE_LOG || type === BlockType.JUNGLE_LOG) return BlockType.ACACIA_LOG;
      if (type === BlockType.OAK_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.JUNGLE_LEAVES) return BlockType.ACACIA_LEAVES;
      if (type === BlockType.OAK_PLANKS || type === BlockType.BIRCH_PLANKS || type === BlockType.SPRUCE_PLANKS || type === BlockType.JUNGLE_PLANKS) return BlockType.ACACIA_PLANKS;
    }
  }

  return type;
}
function clear(x: number, y: number, z: number, w: number, h: number, d: number): SB[] {
  return fill(x, y, z, w, h, d, BlockType.AIR);
}

function emptySlot(): ContainerSlot {
  return { item: null, count: 0 };
}

function makeSlots(count: number): ContainerSlot[] {
  return Array.from({ length: count }, emptySlot);
}

function lootSlot(item: BlockType | ItemType, count: number): ContainerSlot {
  return { item, count };
}

type LootEntry = {
  item: BlockType | ItemType;
  minCount: number;
  maxCount: number;
  weight: number;
};

function buildUniversalLootPool(): LootEntry[] {
  return getAllItems().map((item) => {
    const id = item.id.toString();

    if (id.includes('spawn_egg')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.06 };
    }

    if (id.includes('music_disc')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.08 };
    }

    if (id.includes('netherite') || id.includes('elytra') || id.includes('trident')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.04 };
    }

    if (id.includes('bucket') || id.includes('boat') || id.includes('minecart')) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.12 };
    }

    if (item.toolType || item.armorSlot) {
      return { item: item.id, minCount: 1, maxCount: 1, weight: 0.14 };
    }

    if (item.foodPoints !== undefined) {
      return { item: item.id, minCount: 1, maxCount: 3, weight: 0.55 };
    }

    if (item.stackSize > 1) {
      return { item: item.id, minCount: 2, maxCount: Math.min(8, item.stackSize), weight: 0.7 };
    }

    return { item: item.id, minCount: 1, maxCount: 2, weight: 0.3 };
  });
}

const UNIVERSAL_LOOT_POOL = buildUniversalLootPool();

function pickWeightedLoot(rng: SeededRandom, pool: LootEntry[], count: number): LootEntry[] {
  const working = [...pool];
  const picks: LootEntry[] = [];

  for (let i = 0; i < count && working.length > 0; i++) {
    const totalWeight = working.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * totalWeight;
    let selectedIndex = 0;

    for (let j = 0; j < working.length; j++) {
      roll -= working[j].weight;
      if (roll <= 0) {
        selectedIndex = j;
        break;
      }
    }

    picks.push(working[selectedIndex]);
    working.splice(selectedIndex, 1);
  }

  return picks;
}

// ─────────────────────────────────────────────────────────────────────────────
// WOODLAND MANSION  (28 × 21 × 24)
// ─────────────────────────────────────────────────────────────────────────────
function buildWoodlandMansion(): SB[] {
  const P=BlockType.OAK_PLANKS, D=BlockType.OAK_LOG, S=BlockType.COBBLESTONE;
  const G=BlockType.GLASS, C=BlockType.CHEST, L=BlockType.GLOWSTONE, A=BlockType.AIR;
  const out: SB[] = [];
  out.push(...fill(0,0,0, 28,1,24, S));
  out.push(...hollow(0,1,0, 28,5,24, P,S,P));
  for (const [cx,cz] of [[0,0],[27,0],[0,23],[27,23],[0,11],[27,11],[13,0],[13,23]])
    out.push(...col(cx as number, cz as number, 1, 5, D));
  for (let wx=4; wx<28; wx+=4) { out.push(b(wx,3,0,G)); out.push(b(wx,3,23,G)); }
  for (let wz=3; wz<24; wz+=4) { out.push(b(0,3,wz,G)); out.push(b(27,3,wz,G)); }
  out.push(b(12,1,0,A)); out.push(b(13,1,0,A)); out.push(b(14,1,0,A));
  out.push(b(12,2,0,A)); out.push(b(13,2,0,A)); out.push(b(14,2,0,A));
  out.push(...walls(13,1,0, 1,4,24, P));
  out.push(b(13,1,12,A)); out.push(b(13,2,12,A));
  out.push(b(2,1,2,C)); out.push(b(25,1,2,C)); out.push(b(2,1,21,C)); out.push(b(25,1,21,C));
  out.push(b(6,4,6,L)); out.push(b(21,4,6,L)); out.push(b(6,4,17,L)); out.push(b(21,4,17,L));
  // Second floor
  out.push(...hollow(0,6,0, 28,5,24, P,P,P));
  for (const [cx,cz] of [[0,0],[27,0],[0,23],[27,23]])
    out.push(...col(cx as number, cz as number, 6, 5, D));
  for (let wx=4; wx<28; wx+=4) { out.push(b(wx,8,0,G)); out.push(b(wx,8,23,G)); }
  for (let wz=3; wz<24; wz+=4) { out.push(b(0,8,wz,G)); out.push(b(27,8,wz,G)); }
  out.push(...fill(10,10,-2, 8,1,2, P));
  for (let bx=10; bx<=17; bx++) out.push(b(bx,11,-2,D));
  out.push(...walls(6,7,1, 1,3,10, P)); out.push(...walls(6,7,13, 1,3,10, P));
  out.push(...walls(21,7,1, 1,3,10, P)); out.push(...walls(21,7,13, 1,3,10, P));
  out.push(b(3,7,8,C)); out.push(b(24,7,8,C));
  out.push(b(10,9,6,L)); out.push(b(17,9,6,L)); out.push(b(10,9,17,L)); out.push(b(17,9,17,L));
  // Third floor
  out.push(...hollow(2,11,2, 24,4,20, P,P,P));
  for (const [cx,cz] of [[2,2],[25,2],[2,21],[25,21]])
    out.push(...col(cx as number, cz as number, 11, 4, D));
  for (let wx=5; wx<26; wx+=5) { out.push(b(wx,13,2,G)); out.push(b(wx,13,21,G)); }
  out.push(b(10,12,20,C));
  out.push(b(7,13,7,L)); out.push(b(20,13,7,L)); out.push(b(7,13,16,L)); out.push(b(20,13,16,L));
  // Stepped roof
  for (let i=0; i<6; i++) {
    const rw=28-i*2, rd=24-i*2; if (rw<=0 || rd<=0) break;
    out.push(...hollow(i,15+i,i, rw,1,rd, D,D,D));
  }
  out.push(b(13,20,11,L)); out.push(b(14,20,12,L));
  out.push(...col(4,4,16,6,S)); out.push(...col(23,4,19,6,S));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// JUNGLE TEMPLE  (12 × 17 × 16)
// ─────────────────────────────────────────────────────────────────────────────
function buildJungleTemple(): SB[] {
  const M=BlockType.COBBLESTONE, S=BlockType.STONE;
  const C=BlockType.CHEST, L=BlockType.GLOWSTONE, V=BlockType.OAK_LEAVES, A=BlockType.AIR;
  const out: SB[] = [];
  out.push(...fill(0,0,0, 12,1,16, S));
  out.push(...hollow(0,1,0, 12,4,16, M,S,M));
  for (const [ex,ey,ez] of [
    [3,1,0],[4,1,0],[5,1,0],[6,1,0],[7,1,0],[8,1,0],
    [3,2,0],[4,2,0],[5,2,0],[6,2,0],[7,2,0],[8,2,0],[5,3,0],[6,3,0]
  ]) out.push(b(ex as number, ey as number, ez as number, A));
  out.push(b(0,2,4,A)); out.push(b(0,2,11,A)); out.push(b(11,2,4,A)); out.push(b(11,2,11,A));
  out.push(b(2,1,6,C)); out.push(b(9,1,6,C)); out.push(b(5,1,14,C));
  out.push(b(6,2,8,S)); out.push(b(6,3,8,L));
  out.push(...hollow(1,5,1, 10,4,14, M,M,M));
  out.push(b(5,5,1,A)); out.push(b(6,5,1,A)); out.push(b(5,6,1,A)); out.push(b(6,6,1,A));
  out.push(b(1,6,5,A)); out.push(b(1,6,9,A)); out.push(b(10,6,5,A)); out.push(b(10,6,9,A));
  out.push(b(5,7,10,L));
  out.push(...hollow(3,9,4, 6,4,8, M,M,M));
  out.push(b(5,9,4,A)); out.push(b(6,9,4,A)); out.push(b(5,10,4,A)); out.push(b(6,10,4,A));
  out.push(b(5,12,4,L));
  out.push(...fill(0,13,0, 12,1,16, S));
  out.push(...fill(2,14,2, 8,1,12, S));
  out.push(...fill(4,15,4, 4,1,8, S));
  out.push(...fill(5,16,6, 2,1,4, S));
  out.push(b(5,17,7,L)); out.push(b(6,17,8,L));
  for (let vy=1; vy<=12; vy+=2) {
    out.push(b(0,vy,2,V)); out.push(b(0,vy,8,V));
    out.push(b(11,vy,3,V)); out.push(b(11,vy,12,V));
    out.push(b(3,vy,0,V)); out.push(b(9,vy,0,V));
  }
  out.push(...hollow(3,-5,5, 6,5,6, S,S,S));
  out.push(...clear(4,-4,6, 4,3,4));
  out.push(b(5,-4,8,C)); out.push(b(6,-4,8,C));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESERT PYRAMID  (21 × 14 × 21)
// ─────────────────────────────────────────────────────────────────────────────
function buildDesertPyramid(): SB[] {
  const S=BlockType.SAND, SS=BlockType.STONE, C=BlockType.COBBLESTONE;
  const CH=BlockType.CHEST, L=BlockType.GLOWSTONE, A=BlockType.AIR;
  const out: SB[] = [];
  out.push(...fill(2,-4,2, 17,1,17, SS));
  out.push(...walls(2,-4,2, 17,5,17, SS));
  out.push(...clear(3,-3,3, 15,4,15));
  out.push(...fill(8,-4,8, 5,1,5, SS));
  out.push(b(10,-3,10,CH)); out.push(b(11,-3,10,CH));
  out.push(b(10,-3,11,CH)); out.push(b(11,-3,11,CH));
  for (let i=0; i<5; i++) out.push(b(10,-i,1-i,SS));
  out.push(...fill(0,0,0, 21,1,21, S));
  for (let i=0; i<=20; i++) { out.push(b(i,0,10,C)); out.push(b(10,0,i,C)); }
  out.push(b(10,0,10,L));
  out.push(...hollow(0,1,0, 21,2,21, S));
  out.push(...hollow(2,3,2, 17,2,17, S));
  out.push(...hollow(4,5,4, 13,2,13, S));
  out.push(...hollow(6,7,6, 9,2,9, S));
  out.push(...hollow(8,9,8, 5,2,5, S));
  out.push(...hollow(9,11,9, 3,2,3, S));
  out.push(b(10,13,10,SS)); out.push(b(10,12,10,L));
  for (let ey=1; ey<=4; ey++)
    for (let ex=9; ex<=11; ex++)
      for (let ez=0; ez<=2; ez++) out.push(b(ex,ey,ez,A));
  for (const [tx,tz] of [[0,0],[0,20],[20,0],[20,20]])
    out.push(...col(tx as number, tz as number, 1, 4, SS));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLAGER OUTPOST  (8 × 18 tower + camp, ~20 × 20 footprint)
// ─────────────────────────────────────────────────────────────────────────────
function buildPillagerOutpost(): SB[] {
  const P=BlockType.OAK_PLANKS, L=BlockType.OAK_LOG, S=BlockType.COBBLESTONE;
  const G=BlockType.GLASS, C=BlockType.CHEST, LT=BlockType.GLOWSTONE, A=BlockType.AIR;
  const out: SB[] = [];
  for (const [cx,cz] of [[0,0],[0,7],[7,0],[7,7]])
    out.push(...col(cx as number, cz as number, 0, 18, L));
  out.push(...fill(0,0,0,8,1,8,P)); out.push(...fill(0,6,0,8,1,8,P));
  out.push(...fill(0,12,0,8,1,8,P)); out.push(...fill(0,17,0,8,1,8,P));
  for (let floor=0; floor<3; floor++) {
    const base=floor*6;
    for (let wy=1; wy<=5; wy++) {
      for (let wx=1; wx<=6; wx++) {
        if (floor===0 && wy<=2 && (wx===3||wx===4)) continue;
        out.push(b(wx,base+wy,0,P)); out.push(b(wx,base+wy,7,P));
      }
      for (let wz=1; wz<=6; wz++) { out.push(b(0,base+wy,wz,P)); out.push(b(7,base+wy,wz,P)); }
    }
    const wy=base+3;
    out.push(b(2,wy,0,G)); out.push(b(5,wy,0,G)); out.push(b(2,wy,7,G)); out.push(b(5,wy,7,G));
    out.push(b(0,wy,2,G)); out.push(b(0,wy,5,G)); out.push(b(7,wy,2,G)); out.push(b(7,wy,5,G));
  }
  for (let i=0; i<8; i+=2) {
    out.push(b(i,18,0,L)); out.push(b(i,18,7,L));
    out.push(b(0,18,i,L)); out.push(b(7,18,i,L));
  }
  out.push(...col(3,4,18,4,L));
  out.push(b(3,17,3,C)); out.push(b(4,17,4,C));
  out.push(b(3,6,3,LT)); out.push(b(3,12,3,LT));
  for (let i=-3; i<=11; i+=2) {
    out.push(b(i,0,-3,L)); out.push(b(i,1,-3,L));
    out.push(b(i,0,11,L)); out.push(b(i,1,11,L));
  }
  for (let i=-3; i<=11; i+=2) {
    out.push(b(-3,0,i,L)); out.push(b(-3,1,i,L));
    out.push(b(11,0,i,L)); out.push(b(11,1,i,L));
  }
  out.push(...hollow(-5,0,2, 3,3,3, L)); out.push(...hollow(9,0,2, 3,3,3, L));
  out.push(b(-4,1,3,LT)); out.push(b(10,1,3,LT));
  out.push(...fill(-2,0,10, 12,1,3, P));
  out.push(...col(-2,11,1,3,L)); out.push(...col(9,11,1,3,L));
  out.push(...fill(-2,3,10, 12,1,3, P));
  out.push(b(2,1,11,C)); out.push(b(6,1,11,C));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCEAN MONUMENT  (58 × 23 × 58)
// ─────────────────────────────────────────────────────────────────────────────
function buildOceanMonument(): SB[] {
  const P=BlockType.STONE, PB=BlockType.COBBLESTONE;
  const PD=BlockType.GRAVEL, L=BlockType.GLOWSTONE, C=BlockType.CHEST;
  const out: SB[] = [];
  out.push(...fill(0,-2,0, 58,3,58, P));
  out.push(...hollow(0,0,0, 58,7,58, PB,P,PB));
  out.push(...clear(1,1,1, 56,5,56));
  for (const [tx,tz] of [[0,0],[0,27],[0,51],[27,0],[27,51],[51,0],[51,27],[51,51]]) {
    out.push(...hollow(tx as number, 0, tz as number, 7, 14, 7, PB));
    out.push(b((tx as number)+3, 13, (tz as number)+3, L));
  }
  out.push(...hollow(3,3,3, 24,12,14, PB,P,PB)); out.push(...clear(4,4,4, 22,10,12));
  out.push(b(14,4,9,L)); out.push(b(14,8,9,L)); out.push(b(6,4,6,C)); out.push(b(22,4,6,C));
  out.push(...hollow(31,3,3, 24,12,14, PB,P,PB)); out.push(...clear(32,4,4, 22,10,12));
  out.push(b(43,4,9,L)); out.push(b(43,8,9,L)); out.push(b(33,4,6,C)); out.push(b(53,4,6,C));
  out.push(...hollow(10,3,31, 38,12,24, PB,P,PB)); out.push(...clear(11,4,32, 36,10,22));
  out.push(b(28,4,42,L)); out.push(b(28,10,42,L)); out.push(b(15,4,43,C)); out.push(b(42,4,43,C));
  out.push(...hollow(22,3,22, 14,14,14, PD,P,PD)); out.push(...clear(23,4,23, 12,12,12));
  out.push(b(28,4,28,L)); out.push(b(29,5,29,L)); out.push(b(27,5,27,L)); out.push(b(28,6,30,C));
  out.push(...hollow(24,14,24, 10,9,10, PB));
  out.push(...col(28,28,14,9,P)); out.push(b(28,23,28,L)); out.push(b(28,22,28,L));
  out.push(...fill(27,6,0, 4,2,29, P)); out.push(...fill(27,6,29, 4,2,29, P));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// NETHER FORTRESS  (40 × 14 × 26)
// ─────────────────────────────────────────────────────────────────────────────
function buildNetherFortress(): SB[] {
  const N=BlockType.STONE, GL=BlockType.GLOWSTONE, C=BlockType.CHEST, A=BlockType.AIR;
  const out: SB[] = [];
  out.push(...fill(0,0,1, 40,1,4, N));
  out.push(...fill(0,1,0, 40,3,1, N)); out.push(...fill(0,1,5, 40,3,1, N));
  for (let i=1; i<40; i+=3) { out.push(b(i,3,0,A)); out.push(b(i,3,5,A)); }
  for (let ax=5; ax<40; ax+=10) {
    out.push(...col(ax,2,-5,5,N)); out.push(...col(ax,3,-5,5,N));
    out.push(...fill(ax-1,-5,1, 4,1,4, N));
  }
  out.push(...hollow(-4,0,-2, 12,8,12, N,N,N)); out.push(...clear(-3,1,-1, 10,6,10));
  out.push(b(1,1,4,GL)); out.push(b(4,1,4,GL)); out.push(b(1,7,4,C));
  out.push(...hollow(40,0,-2, 12,8,12, N,N,N)); out.push(...clear(41,1,-1, 10,6,10));
  out.push(b(45,1,4,GL)); out.push(b(48,7,4,C));
  out.push(...fill(0,0,7, 18,1,10, N)); out.push(...walls(0,1,7, 18,4,10, N));
  for (let wx=2; wx<16; wx+=3) { out.push(b(wx,0,9,GL)); out.push(b(wx,0,13,GL)); }
  out.push(b(9,3,12,C));
  out.push(...fill(10,6,-4, 20,1,14, N));
  out.push(...fill(10,7,-4, 20,2,1, N)); out.push(...fill(10,7,9, 20,2,1, N));
  out.push(b(8,4,2,GL)); out.push(b(20,4,2,GL)); out.push(b(8,4,3,GL)); out.push(b(32,4,3,GL));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRONGHOLD  (46 × 9 × 40, underground)
// ─────────────────────────────────────────────────────────────────────────────
function buildStronghold(): SB[] {
  const S=BlockType.STONE, C=BlockType.COBBLESTONE, O=BlockType.OBSIDIAN;
  const GL=BlockType.GLOWSTONE, CH=BlockType.CHEST, P=BlockType.OAK_PLANKS, A=BlockType.AIR;
  const out: SB[] = [];
  out.push(...fill(0,0,0, 30,1,5, C)); out.push(...walls(0,1,0, 30,8,5, C));
  out.push(...fill(0,8,0, 30,1,5, C));
  for (let tx=3; tx<30; tx+=5) { out.push(b(tx,6,0,GL)); out.push(b(tx,6,4,GL)); }
  out.push(...hollow(30,0,-3, 15,9,12, C,S,C)); out.push(...clear(31,1,-2, 13,7,10));
  out.push(...fill(34,0,1, 6,3,6, S)); out.push(...clear(35,1,2, 4,3,4));
  for (let i=0; i<4; i++) out.push(b(35+i,3,2,O));
  for (let i=0; i<4; i++) out.push(b(35+i,3,6,O));
  for (let i=0; i<2; i++) out.push(b(34,3,3+i,O));
  for (let i=0; i<2; i++) out.push(b(40,3,3+i,O));
  out.push(b(37,4,4,GL)); out.push(b(37,1,4,GL));
  out.push(b(31,1,0,CH)); out.push(b(43,1,0,CH));
  out.push(...hollow(0,0,6, 15,9,15, C,S,C)); out.push(...clear(1,1,7, 13,7,13));
  out.push(...fill(1,1,7, 13,4,1, P)); out.push(...fill(1,1,19, 13,4,1, P));
  out.push(...fill(1,1,7, 1,4,13, P)); out.push(...fill(13,1,7, 1,4,13, P));
  out.push(...fill(1,5,7, 13,1,13, P)); out.push(...clear(2,5,8, 11,2,11));
  out.push(...col(2,7,1,5,P)); out.push(b(7,1,12,CH)); out.push(b(7,5,12,CH));
  out.push(b(7,7,13,GL)); out.push(b(7,4,13,GL));
  out.push(...fill(0,0,-14, 13,1,12, C)); out.push(...walls(0,1,-14, 13,5,12, C));
  out.push(...fill(0,5,-14, 13,1,12, C));
  for (let ci=0; ci<3; ci++) {
    const cz=-13+ci*4;
    out.push(...walls(1,1,cz, 1,4,3, C)); out.push(...walls(7,1,cz, 1,4,3, C));
    out.push(b(1,1,cz+1,A)); out.push(b(1,2,cz+1,A));
    out.push(b(7,1,cz+1,A)); out.push(b(7,2,cz+1,A));
  }
  out.push(b(4,4,-12,GL)); out.push(b(9,4,-12,GL)); out.push(b(10,1,-8,CH));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCIENT CITY  (42 × 12 × 46, deep underground)
// ─────────────────────────────────────────────────────────────────────────────
function buildAncientCity(): SB[] {
  const S=BlockType.STONE, C=BlockType.COBBLESTONE, O=BlockType.OBSIDIAN;
  const GL=BlockType.GLOWSTONE, CH=BlockType.CHEST;
  const out: SB[] = [];
  out.push(...fill(19,0,0, 4,1,46, C)); out.push(...fill(0,0,21, 42,1,4, C));
  out.push(...fill(0,0,8, 42,1,2, S)); out.push(...fill(0,0,36, 42,1,2, S));
  for (const [bx,bz,bw,bd] of [
    [1,1,6,12],[24,1,6,12],[1,26,6,10],[24,26,6,10],
    [1,12,6,8],[24,12,6,8],[5,39,14,6],[23,39,14,6]
  ] as [number,number,number,number][]) {
    out.push(...hollow(bx,1,bz, bw,8,bd, C,S,C));
    out.push(...clear(bx+1,2,bz+1, bw-2,6,bd-2));
    out.push(b(bx+1,2,bz+1,GL)); out.push(b(bx+1,2,bz+bd-2,CH));
  }
  out.push(...hollow(17,1,19, 8,6,8, O,C,O)); out.push(...clear(18,2,20, 6,4,6));
  out.push(b(20,2,22,O)); out.push(b(21,2,23,O));
  out.push(b(20,3,22,GL)); out.push(b(21,3,23,GL));
  out.push(b(20,2,25,CH)); out.push(b(21,2,18,CH));
  for (let pz=4; pz<46; pz+=8) {
    out.push(...col(16,pz,0,10,C)); out.push(...col(25,pz,0,10,C));
    out.push(b(16,10,pz,GL)); out.push(b(25,10,pz,GL));
  }
  out.push(...fill(0,1,0, 42,3,1, C)); out.push(...fill(0,1,45, 42,3,1, C));
  out.push(...fill(0,1,0, 1,3,46, C)); out.push(...fill(41,1,0, 1,3,46, C));
  for (let i=2; i<42; i+=3) { out.push(b(i,4,0,C)); out.push(b(i,4,45,C)); }
  for (let i=2; i<46; i+=3) { out.push(b(0,4,i,C)); out.push(b(41,4,i,C)); }
  out.push(b(10,4,10,GL)); out.push(b(31,4,10,GL));
  out.push(b(10,4,35,GL)); out.push(b(31,4,35,GL)); out.push(b(20,8,22,GL));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MINESHAFT  (32 × 5 × 32, underground)
// ─────────────────────────────────────────────────────────────────────────────
function buildMineshaft(): SB[] {
  const P=BlockType.OAK_PLANKS, L=BlockType.OAK_LOG, S=BlockType.STONE;
  const G=BlockType.GRAVEL, GL=BlockType.GLOWSTONE, CH=BlockType.CHEST;
  const out: SB[] = [];
  out.push(...fill(0,0,1, 32,1,3, S)); out.push(...clear(0,1,1, 32,3,3));
  for (let bx=0; bx<32; bx+=4) {
    out.push(...col(bx,1,2,3,L)); out.push(...col(bx,3,2,3,L));
    out.push(b(bx,3,1,P)); out.push(b(bx,3,2,P)); out.push(b(bx,3,3,P));
    out.push(b(bx,2,2,GL));
  }
  for (let zz=0; zz<3; zz++) {
    const sz=zz*12;
    out.push(...fill(8,0,sz, 3,1,12, S)); out.push(...clear(8,1,sz, 3,3,12));
    for (let bz=sz; bz<sz+12; bz+=4) {
      out.push(b(8,3,bz,P)); out.push(b(9,3,bz,P)); out.push(b(10,3,bz,P)); out.push(b(9,2,bz,GL));
    }
    out.push(...fill(20,0,sz, 3,1,12, S)); out.push(...clear(20,1,sz, 3,3,12));
    for (let bz=sz; bz<sz+12; bz+=4) {
      out.push(b(20,3,bz,P)); out.push(b(21,3,bz,P)); out.push(b(22,3,bz,P)); out.push(b(21,2,bz,GL));
    }
  }
  for (const [ox,oy,oz] of [
    [3,1,0],[7,2,0],[14,1,4],[22,2,4],[28,1,0],
    [5,2,5],[16,1,5],[30,2,5],[9,1,12],[18,1,20]
  ]) out.push(b(ox as number, oy as number, oz as number, GL));
  out.push(b(4,1,2,CH)); out.push(b(16,1,2,CH)); out.push(b(28,1,2,CH));
  out.push(b(9,1,14,CH)); out.push(b(21,1,20,CH));
  out.push(...fill(12,1,1, 4,3,1, G)); out.push(...fill(9,1,16, 3,2,1, G));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL CHAMBERS  (32 × 10 × 32, underground)
// ─────────────────────────────────────────────────────────────────────────────
function buildTrialChamber(): SB[] {
  const S=BlockType.STONE, C=BlockType.COBBLESTONE;
  const GL=BlockType.GLOWSTONE, CH=BlockType.CHEST, O=BlockType.OBSIDIAN;
  const out: SB[] = [];
  out.push(...hollow(0,0,0, 32,10,32, C,S,C)); out.push(...clear(1,1,1, 30,8,30));
  out.push(...hollow(12,0,12, 8,10,8, O,S,O)); out.push(...clear(13,1,13, 6,8,6));
  out.push(b(13,2,13,GL)); out.push(b(18,2,13,GL)); out.push(b(13,2,18,GL)); out.push(b(18,2,18,GL));
  out.push(b(15,2,15,CH)); out.push(b(16,2,16,CH)); out.push(...col(15,15,3,5,GL));
  out.push(...hollow(8,0,1, 16,8,11, C,S,C)); out.push(...clear(9,1,2, 14,6,9));
  out.push(b(15,1,6,GL)); out.push(b(15,5,6,GL)); out.push(b(10,1,9,CH));
  out.push(...hollow(8,0,20, 16,8,11, C,S,C)); out.push(...clear(9,1,21, 14,6,9));
  out.push(b(15,1,25,GL)); out.push(b(15,5,25,GL)); out.push(b(10,1,27,CH));
  out.push(...hollow(1,0,8, 11,8,16, C,S,C)); out.push(...clear(2,1,9, 9,6,14));
  out.push(b(6,1,15,GL)); out.push(b(6,5,15,GL)); out.push(b(2,1,20,CH));
  out.push(...hollow(20,0,8, 11,8,16, C,S,C)); out.push(...clear(21,1,9, 9,6,14));
  out.push(b(25,1,15,GL)); out.push(b(25,5,15,GL)); out.push(b(27,1,20,CH));
  out.push(...fill(14,0,11,4,1,1,S)); out.push(...clear(14,1,11,4,4,1));
  out.push(...fill(14,0,20,4,1,1,S)); out.push(...clear(14,1,20,4,4,1));
  out.push(...fill(11,0,14,1,1,4,S)); out.push(...clear(11,1,14,1,4,4));
  out.push(...fill(20,0,14,1,1,4,S)); out.push(...clear(20,1,14,1,4,4));
  out.push(b(4,8,4,GL)); out.push(b(27,8,4,GL)); out.push(b(4,8,27,GL)); out.push(b(27,8,27,GL));
  out.push(b(15,8,15,GL));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL VILLAGE  (~60 × 8 × 60)
// ─────────────────────────────────────────────────────────────────────────────
function buildVillage(): SB[] {
  const P=BlockType.OAK_PLANKS, L=BlockType.OAK_LOG, S=BlockType.COBBLESTONE;
  const G=BlockType.GLASS, C=BlockType.CHEST, LT=BlockType.GLOWSTONE;
  const D=BlockType.DIRT, GR=BlockType.GRAVEL, A=BlockType.AIR;
  const out: SB[] = [];

  // Roads
  out.push(...fill(0,0,26, 60,1,4, GR));
  out.push(...fill(26,0,0, 4,1,60, GR));
  for (let rx=4; rx<60; rx+=10) out.push(b(rx,2,28,LT));
  for (let rz=4; rz<60; rz+=10) out.push(b(28,2,rz,LT));

  // Well
  out.push(...fill(26,0,11, 4,1,4, S));
  out.push(b(27,1,11,S)); out.push(b(28,1,11,S));
  out.push(b(27,1,14,S)); out.push(b(28,1,14,S));
  out.push(b(27,1,12,S)); out.push(b(28,1,12,S));
  out.push(b(27,1,13,S)); out.push(b(28,1,13,S));
  out.push(...col(26,11,2,3,L)); out.push(...col(29,11,2,3,L));
  out.push(...fill(26,4,11, 4,1,4, P));

  // House helper
  function house(ox: number, oz: number, w: number, d: number, h: number): void {
    out.push(...fill(ox,0,oz, w,1,d, S));
    out.push(...hollow(ox,1,oz, w,h,d, P,S,P));
    out.push(...col(ox,oz,1,h,L)); out.push(...col(ox+w-1,oz,1,h,L));
    out.push(...col(ox,oz+d-1,1,h,L)); out.push(...col(ox+w-1,oz+d-1,1,h,L));
    const mid=Math.floor(h/2)+1;
    out.push(b(ox,mid,oz+1,G)); out.push(b(ox,mid,oz+d-2,G));
    out.push(b(ox+w-1,mid,oz+1,G)); out.push(b(ox+w-1,mid,oz+d-2,G));
    out.push(b(ox+1,mid,oz,G)); out.push(b(ox+w-2,mid,oz,G));
    out.push(b(ox+Math.floor(w/2),1,oz,A)); out.push(b(ox+Math.floor(w/2),2,oz,A));
    out.push(b(ox+1,1,oz+1,C)); out.push(b(ox+1,h,oz+1,LT));
    if (w >= 5 && d >= 5) {
      out.push(b(ox + Math.floor(w / 2), 1, oz + Math.floor(d / 2), BlockType.CRAFTING_TABLE));
      out.push(b(ox + 2, 1, oz + 2, BlockType.FURNACE));
      out.push(b(ox + w - 3, 1, oz + 2, BlockType.CHEST));
    }
    for (let ri=0; ri<w; ri++) {
      out.push(b(ox+ri,h+1,oz+1,P)); out.push(b(ox+ri,h+1,oz+d-2,P));
      out.push(b(ox+ri,h+2,oz+2,P));
      if (d>5) out.push(b(ox+ri,h+2,oz+d-3,P));
      out.push(b(ox+ri,h+3,oz+3,L));
    }
  }

  house(2,  2,  7, 8, 4);
  house(12, 2,  6, 7, 4);
  house(2,  32, 8, 7, 4);
  house(12, 34, 6, 6, 4);
  house(34, 2,  7, 8, 4);
  house(46, 4,  6, 7, 4);
  house(34, 33, 8, 7, 4);
  house(46, 35, 6, 6, 4);

  // Blacksmith
  out.push(...fill(3,0,44, 10,1,9, S));
  out.push(...hollow(3,1,44, 10,5,9, S,S,P));
  out.push(...col(3,44,1,5,L)); out.push(...col(12,44,1,5,L));
  out.push(...col(3,52,1,5,L)); out.push(...col(12,52,1,5,L));
  out.push(b(7,1,44,A)); out.push(b(8,1,44,A)); out.push(b(7,2,44,A)); out.push(b(8,2,44,A));
  out.push(b(7,1,49,LT)); out.push(b(8,1,49,LT));
  out.push(b(6,1,49,S)); out.push(b(9,1,49,S));
  out.push(b(10,1,46,C)); out.push(b(10,1,50,C));
  out.push(...col(6,50,6,4,S));
  out.push(b(7,1,46,BlockType.FURNACE));
  out.push(b(8,1,46,BlockType.CRAFTING_TABLE));
  out.push(b(8,2,46,BlockType.FURNACE));
  out.push(b(7,2,46,BlockType.CHEST));

  // Church
  out.push(...fill(34,0,44, 12,1,14, S));
  out.push(...hollow(34,1,44, 12,7,14, S,S,S));
  out.push(...clear(35,2,45, 10,5,12));
  for (let wy=3; wy<=5; wy++) {
    out.push(b(34,wy,47,G)); out.push(b(34,wy,51,G));
    out.push(b(45,wy,47,G)); out.push(b(45,wy,51,G));
  }
  out.push(b(39,1,44,A)); out.push(b(40,1,44,A)); out.push(b(39,2,44,A)); out.push(b(40,2,44,A));
  out.push(...hollow(38,7,44, 6,8,6, S,S,S));
  out.push(...clear(39,8,45, 4,6,4));
  out.push(b(40,11,47,LT));
  out.push(...col(40,47,15,5,L)); out.push(...col(41,47,15,5,L));
  out.push(...col(40,48,15,5,L)); out.push(...col(41,48,15,5,L));
  out.push(b(40,19,47,LT));
  out.push(b(39,1,55,S)); out.push(b(40,1,55,S)); out.push(b(41,1,55,S));
  out.push(b(40,2,55,LT)); out.push(b(39,1,56,C));

  // Farm
  out.push(...fill(2,0,15, 22,1,8, D));
  for (let fx=2; fx<24; fx+=2) out.push(b(fx,0,15,GR));
  for (let fx=2; fx<24; fx+=2) out.push(b(fx,0,22,GR));
  out.push(...fill(2,0,15, 1,1,8, GR)); out.push(...fill(23,0,15, 1,1,8, GR));
  for (let fx=2; fx<=23; fx+=3) { out.push(b(fx,1,15,L)); out.push(b(fx,1,22,L)); }
  out.push(...col(12,19,1,3,L));
  out.push(b(11,3,19,P)); out.push(b(13,3,19,P)); out.push(b(12,3,19,P)); out.push(b(12,4,19,S));

  // Library
  out.push(...fill(48,0,30, 10,1,12, S));
  out.push(...hollow(48,1,30, 10,5,12, P,S,P));
  out.push(...col(48,30,1,5,L)); out.push(...col(57,30,1,5,L));
  out.push(...col(48,41,1,5,L)); out.push(...col(57,41,1,5,L));
  out.push(b(52,1,30,A)); out.push(b(53,1,30,A)); out.push(b(52,2,30,A)); out.push(b(53,2,30,A));
  out.push(...fill(49,1,31, 8,3,1, P)); out.push(...fill(49,1,40, 8,3,1, P));
  out.push(...fill(49,1,31, 1,3,10, P)); out.push(...fill(56,1,31, 1,3,10, P));
  out.push(b(52,4,35,LT)); out.push(b(53,4,36,LT));
  out.push(b(50,1,39,C)); out.push(b(55,1,39,C)); out.push(b(50,1,32,C));

  // Lamp posts
  for (const [lx,lz] of [
    [5,26],[15,26],[22,26],[37,26],[50,26],
    [26,5],[26,15],[26,22],[26,37],[26,50]
  ]) out.push(...col(lx as number, lz as number, 1, 4, L), b(lx as number, 5, lz as number, LT));

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SWAMP HUT  (12 × 10 × 12)
// ─────────────────────────────────────────────────────────────────────────────
function buildSwampHut(): SB[] {
  const P = BlockType.OAK_PLANKS;
  const L = BlockType.OAK_LOG;
  const S = BlockType.COBBLESTONE;
  const G = BlockType.GLASS;
  const C = BlockType.CHEST;
  const LT = BlockType.GLOWSTONE;
  const A = BlockType.AIR;
  const out: SB[] = [];

  out.push(...fill(0,0,0, 12,1,12, S));
  out.push(...fill(1,1,1, 10,1,10, P));
  out.push(...hollow(1,2,1, 10,4,10, P,S,P));
  out.push(...col(1,1,1,5,L)); out.push(...col(10,1,1,5,L));
  out.push(...col(1,1,10,5,L)); out.push(...col(10,1,10,5,L));
  out.push(b(5,2,1,A)); out.push(b(6,2,1,A));
  out.push(b(5,3,10,A)); out.push(b(6,3,10,A));
  out.push(b(1,3,5,G)); out.push(b(10,3,5,G));
  out.push(b(1,4,6,G)); out.push(b(10,4,6,G));
  out.push(...fill(3,6,3, 6,1,6, P));
  out.push(...fill(4,7,4, 4,1,4, P));
  out.push(...fill(5,8,5, 2,1,2, P));
  out.push(b(5,9,5,LT));
  out.push(b(2,2,2,C)); out.push(b(9,2,9,C));
  out.push(...col(2,2,6,3,L)); out.push(...col(9,2,6,3,L));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUINED PORTAL  (12 × 12 × 12)
// ─────────────────────────────────────────────────────────────────────────────
function buildRuinedPortal(): SB[] {
  const O = BlockType.OBSIDIAN;
  const C = BlockType.COBBLESTONE;
  const L = BlockType.GLOWSTONE;
  const A = BlockType.AIR;
  const out: SB[] = [];

  out.push(...fill(3,0,3, 6,1,6, C));
  out.push(...col(3,1,3,4,O)); out.push(...col(8,1,3,4,O));
  out.push(...col(3,1,8,4,O)); out.push(...col(8,1,8,4,O));
  out.push(...fill(4,1,4, 4,4,1, O)); out.push(...fill(4,1,7, 4,4,1, O));
  out.push(...fill(4,1,4, 1,4,4, O)); out.push(...fill(7,1,4, 1,4,4, O));
  out.push(b(5,2,5,L)); out.push(b(6,2,6,L));
  out.push(b(5,4,5,A)); out.push(b(6,4,6,A));
  out.push(b(4,5,4,C)); out.push(b(7,5,7,C));
  out.push(...fill(0,0,5, 3,1,2, C)); out.push(...fill(9,0,5, 3,1,2, C));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEADOW SHRINE  (14 × 8 × 14)
// ─────────────────────────────────────────────────────────────────────────────
function buildMeadowShrine(): SB[] {
  const S = BlockType.STONE;
  const C = BlockType.COBBLESTONE;
  const P = BlockType.OAK_PLANKS;
  const L = BlockType.GLOWSTONE;
  const B = BlockType.BOOKSHELF;
  const CH = BlockType.CHEST;
  const out: SB[] = [];

  out.push(...fill(2,0,2, 10,1,10, C));
  out.push(...hollow(2,1,2, 10,4,10, S,S,S));
  out.push(...col(2,1,2,4,P)); out.push(...col(11,1,2,4,P));
  out.push(...col(2,1,11,4,P)); out.push(...col(11,1,11,4,P));
  out.push(...fill(5,1,5, 4,1,4, P));
  out.push(...fill(6,2,6, 2,1,2, B));
  out.push(b(7,3,7,L));
  out.push(b(4,1,7,CH));
  out.push(b(7,1,4,CH));
  out.push(...fill(0,0,6, 2,1,2, P));
  out.push(...fill(12,0,6, 2,1,2, P));
  out.push(...fill(6,0,0, 2,1,2, P));
  out.push(...fill(6,0,12, 2,1,2, P));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// DUNGEON  (9 × 5 × 9)
// ─────────────────────────────────────────────────────────────────────────────
function buildDungeon(): SB[] {
  return [
    ...hollow(0,0,0, 9,5,9, BlockType.COBBLESTONE, BlockType.STONE, BlockType.STONE),
    ...fill(1,0,1, 7,1,7, BlockType.COBBLESTONE),
    ...clear(1,1,1, 7,3,7),
    b(4,1,4, BlockType.GLOWSTONE),
    b(1,1,1, BlockType.CHEST), b(7,1,7, BlockType.CHEST),
    b(1,1,7, BlockType.CHEST), b(7,1,1, BlockType.CHEST),
    b(2,0,2, BlockType.DIRT), b(6,0,6, BlockType.DIRT),
    b(2,0,6, BlockType.DIRT), b(6,0,2, BlockType.DIRT),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Template catalogue
//
// Tuning guide:
//   gridSize  = minimum chunk-grid spacing between instances.
//               gridSize=8 → one per 128×128 block area (very rare).
//               gridSize=1 → one attempt per chunk (common, like trees).
//   probability = fraction of grid cells that actually get one.
//               Keep rare structures below 0.35 so they feel special.
//   footprintX/Z = actual block dimensions so the margin check below
//               never clips a structure at a chunk boundary.
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATES: StructureTemplate[] = [
  // ── Trees (gridSize=1 → one attempt per chunk, probability gates density) ──
  {
    name: 'oak_tree', gridSize: 1, probability: 0.30, heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 6, footprintZ: 6,
    blocks: [
      ...col(0,0,0,5,BlockType.OAK_LOG),
      b(-1,3,-1,BlockType.OAK_LEAVES), b(0,3,-1,BlockType.OAK_LEAVES), b(1,3,-1,BlockType.OAK_LEAVES),
      b(-1,3, 0,BlockType.OAK_LEAVES),                                  b(1,3, 0,BlockType.OAK_LEAVES),
      b(-1,3, 1,BlockType.OAK_LEAVES), b(0,3, 1,BlockType.OAK_LEAVES), b(1,3, 1,BlockType.OAK_LEAVES),
      b(-2,4,-2,BlockType.OAK_LEAVES), b(-1,4,-2,BlockType.OAK_LEAVES), b(0,4,-2,BlockType.OAK_LEAVES), b(1,4,-2,BlockType.OAK_LEAVES), b(2,4,-2,BlockType.OAK_LEAVES),
      b(-2,4,-1,BlockType.OAK_LEAVES), b(-1,4,-1,BlockType.OAK_LEAVES), b(0,4,-1,BlockType.OAK_LEAVES), b(1,4,-1,BlockType.OAK_LEAVES), b(2,4,-1,BlockType.OAK_LEAVES),
      b(-2,4, 0,BlockType.OAK_LEAVES), b(-1,4, 0,BlockType.OAK_LEAVES),                                 b(1,4, 0,BlockType.OAK_LEAVES), b(2,4, 0,BlockType.OAK_LEAVES),
      b(-2,4, 1,BlockType.OAK_LEAVES), b(-1,4, 1,BlockType.OAK_LEAVES), b(0,4, 1,BlockType.OAK_LEAVES), b(1,4, 1,BlockType.OAK_LEAVES), b(2,4, 1,BlockType.OAK_LEAVES),
      b(-2,4, 2,BlockType.OAK_LEAVES), b(-1,4, 2,BlockType.OAK_LEAVES), b(0,4, 2,BlockType.OAK_LEAVES), b(1,4, 2,BlockType.OAK_LEAVES), b(2,4, 2,BlockType.OAK_LEAVES),
      b(-1,5,-1,BlockType.OAK_LEAVES), b(0,5,-1,BlockType.OAK_LEAVES), b(1,5,-1,BlockType.OAK_LEAVES),
      b(-1,5, 0,BlockType.OAK_LEAVES), b(0,5, 0,BlockType.OAK_LEAVES), b(1,5, 0,BlockType.OAK_LEAVES),
      b(-1,5, 1,BlockType.OAK_LEAVES), b(0,5, 1,BlockType.OAK_LEAVES), b(1,5, 1,BlockType.OAK_LEAVES),
      b(0,6,0,BlockType.OAK_LEAVES),
    ],
  },
  {
    name: 'birch_tree', gridSize: 1, probability: 0.20, heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 6, footprintZ: 6,
    blocks: [
      ...col(0,0,0,7,BlockType.BIRCH_LOG),
      ...fill(-1,4,-1,3,2,3,BlockType.BIRCH_LEAVES),
      ...fill(-2,5,-2,5,2,5,BlockType.BIRCH_LEAVES),
      ...fill(-1,7,-1,3,1,3,BlockType.BIRCH_LEAVES),
      b(0,8,0,BlockType.BIRCH_LEAVES),
    ],
  },
  {
    name: 'spruce_tree', gridSize: 1, probability: 0.20, heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS, BlockType.SNOW],
    footprintX: 8, footprintZ: 8,
    blocks: [
      ...col(0,0,0,10,BlockType.SPRUCE_LOG),
      ...fill(-3,2,-3,7,2,7,BlockType.SPRUCE_LEAVES),
      ...fill(-2,4,-2,5,2,5,BlockType.SPRUCE_LEAVES),
      ...fill(-1,6,-1,3,2,3,BlockType.SPRUCE_LEAVES),
      b(0,8,0,BlockType.SPRUCE_LEAVES), b(1,8,0,BlockType.SPRUCE_LEAVES),
      b(-1,8,0,BlockType.SPRUCE_LEAVES), b(0,8,1,BlockType.SPRUCE_LEAVES), b(0,8,-1,BlockType.SPRUCE_LEAVES),
      b(0,9,0,BlockType.SPRUCE_LEAVES),
    ],
  },
  {
    name: 'dark_oak', gridSize: 1, probability: 0.15, heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 10, footprintZ: 10,
    blocks: [
      ...col(0,0,0,6,BlockType.DARK_OAK_LOG), ...col(1,0,0,6,BlockType.DARK_OAK_LOG),
      ...col(0,1,0,6,BlockType.DARK_OAK_LOG), ...col(1,1,0,6,BlockType.DARK_OAK_LOG),
      ...fill(-3,4,-3,9,1,9,BlockType.DARK_OAK_LEAVES),
      ...fill(-2,5,-2,7,1,7,BlockType.DARK_OAK_LEAVES),
      ...fill(-1,6,-1,5,1,5,BlockType.DARK_OAK_LEAVES),
      ...fill(0,7,0,3,1,3,BlockType.DARK_OAK_LEAVES),
    ],
  },
  {
    name: 'cherry_tree', gridSize: 1, probability: 0.18, heightOffset: 1,
    surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 8, footprintZ: 8,
    blocks: [
      ...col(0,0,0,6,BlockType.CHERRY_LOG),
      ...fill(-2,3,-2,5,1,5,BlockType.CHERRY_LEAVES),
      ...fill(-3,4,-3,7,1,7,BlockType.CHERRY_LEAVES),
      ...fill(-2,5,-2,5,1,5,BlockType.CHERRY_LEAVES),
      b(0,6,0,BlockType.CHERRY_LEAVES),
      b(1,6,0,BlockType.CHERRY_LEAVES),
      b(-1,6,0,BlockType.CHERRY_LEAVES),
      b(0,6,1,BlockType.CHERRY_LEAVES),
      b(0,6,-1,BlockType.CHERRY_LEAVES),
    ],
  },

  // ── Large surface structures ───────────────────────────────────────────────
  {
    name: 'woodland_mansion', gridSize: 16, probability: 0.30,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 32, footprintZ: 28,
    blocks: buildWoodlandMansion(),
  },
  {
    name: 'village', gridSize: 12, probability: 0.35,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS, BlockType.DIRT],
    footprintX: 64, footprintZ: 64,
    blocks: buildVillage(),
  },
  {
    name: 'jungle_temple', gridSize: 8, probability: 0.30,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 14, footprintZ: 18,
    blocks: buildJungleTemple(),
  },
  {
    name: 'desert_pyramid', gridSize: 8, probability: 0.30,
    heightOffset: 0, surfaceBlockTypes: [BlockType.SAND],
    footprintX: 24, footprintZ: 24,
    blocks: buildDesertPyramid(),
  },
  {
    name: 'pillager_outpost', gridSize: 8, probability: 0.28,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS, BlockType.SAND],
    footprintX: 22, footprintZ: 22,
    blocks: buildPillagerOutpost(),
  },
  {
    name: 'ocean_monument', gridSize: 16, probability: 0.25,
    heightOffset: 0, surfaceBlockTypes: [BlockType.SAND, BlockType.GRAVEL],
    footprintX: 62, footprintZ: 62,
    blocks: buildOceanMonument(),
  },
  {
    name: 'nether_fortress', gridSize: 12, probability: 0.25,
    heightOffset: 0, surfaceBlockTypes: [BlockType.STONE, BlockType.GRAVEL],
    footprintX: 56, footprintZ: 30,
    blocks: buildNetherFortress(),
  },
  {
    name: 'swamp_hut', gridSize: 8, probability: 0.18,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS, BlockType.DIRT],
    footprintX: 14, footprintZ: 14,
    blocks: buildSwampHut(),
  },
  {
    name: 'ruined_portal', gridSize: 10, probability: 0.22,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS, BlockType.SAND, BlockType.STONE, BlockType.GRAVEL],
    footprintX: 12, footprintZ: 12,
    blocks: buildRuinedPortal(),
  },
  {
    name: 'meadow_shrine', gridSize: 10, probability: 0.20,
    heightOffset: 0, surfaceBlockTypes: [BlockType.GRASS],
    footprintX: 14, footprintZ: 14,
    blocks: buildMeadowShrine(),
  },

  // ── Underground ───────────────────────────────────────────────────────────
  {
    name: 'stronghold', gridSize: 12, probability: 0.28,
    heightOffset: -12, underground: true,
    footprintX: 50, footprintZ: 50,
    blocks: buildStronghold(),
  },
  {
    name: 'ancient_city', gridSize: 14, probability: 0.22,
    heightOffset: -22, underground: true,
    footprintX: 46, footprintZ: 50,
    blocks: buildAncientCity(),
  },
  {
    name: 'mineshaft', gridSize: 4, probability: 0.35,
    heightOffset: -8, underground: true,
    footprintX: 35, footprintZ: 35,
    blocks: buildMineshaft(),
  },
  {
    name: 'trial_chamber', gridSize: 8, probability: 0.28,
    heightOffset: -14, underground: true,
    footprintX: 36, footprintZ: 36,
    blocks: buildTrialChamber(),
  },
  {
    name: 'dungeon', gridSize: 3, probability: 0.30,
    heightOffset: -5, underground: true,
    footprintX: 10, footprintZ: 10,
    blocks: buildDungeon(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// StructureGenerator
// ─────────────────────────────────────────────────────────────────────────────
export class StructureGenerator {

  public static populateChunk(chunk: Chunk, worldSeed: number): void {
    const cx = chunk.cx;
    const cz = chunk.cz;
    for (const tpl of TEMPLATES) {
      StructureGenerator.applyTemplate(chunk, cx, cz, worldSeed, tpl);
    }
  }

  private static applyTemplate(
    chunk: Chunk,
    cx: number, cz: number,
    worldSeed: number,
    tpl: StructureTemplate
  ): void {
    const G = tpl.gridSize;

    // ── Correct margin calculation ─────────────────────────────────────────
    // How many extra grid cells could bleed into this chunk?
    // A structure of footprintX blocks, placed anywhere inside its cell
    // (cell width = G * CHUNK_SIZE blocks), can extend at most
    // ceil(footprintX / CHUNK_SIZE) chunks beyond the cell boundary.
    // We add 1 extra for safety.
    const fpX = tpl.footprintX ?? CHUNK_SIZE;
    const fpZ = tpl.footprintZ ?? CHUNK_SIZE;
    const marginX = Math.ceil(fpX / CHUNK_SIZE) + 1;
    const marginZ = Math.ceil(fpZ / CHUNK_SIZE) + 1;

    // Base grid cell this chunk belongs to
    const baseCellX = Math.floor(cx / G);
    const baseCellZ = Math.floor(cz / G);

    for (let dcx = -marginX; dcx <= marginX; dcx++) {
      for (let dcz = -marginZ; dcz <= marginZ; dcz++) {
        const gcx = baseCellX + dcx;
        const gcz = baseCellZ + dcz;

        // ── Deterministic cell seed ──────────────────────────────────────
        const cellSeed = StructureGenerator.cellSeed(worldSeed, gcx, gcz, tpl.name);
        const rng = new SeededRandom(cellSeed);

        // ── Probability gate ─────────────────────────────────────────────
        if (rng.next() >= tpl.probability) continue;

        // ── Owner chunk inside this grid cell ────────────────────────────
        const ownerCX = gcx * G + rng.nextInt(0, G - 1);
        const ownerCZ = gcz * G + rng.nextInt(0, G - 1);

        // ── Local offset inside owner chunk ──────────────────────────────
        // Keep at least 2 blocks away from chunk edge so tiny structures
        // (dungeons, trees) don't always start right at the seam.
        const localX = rng.nextInt(2, CHUNK_SIZE - 3);
        const localZ = rng.nextInt(2, CHUNK_SIZE - 3);

        // ── World-block origin ───────────────────────────────────────────
        const worldOriginX = ownerCX * CHUNK_SIZE + localX;
        const worldOriginZ = ownerCZ * CHUNK_SIZE + localZ;

        // ── This chunk's world origin ────────────────────────────────────
        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldZ = cz * CHUNK_SIZE;

        // Quick bounding-box reject: if no block of this structure can
        // possibly land inside this chunk, skip immediately.
        const minWX = worldOriginX;               // dx min is always 0 or negative, but
        const maxWX = worldOriginX + fpX;         // use fpX as a conservative upper bound
        const minWZ = worldOriginZ;
        const maxWZ = worldOriginZ + fpZ;
        if (maxWX < chunkWorldX || minWX >= chunkWorldX + CHUNK_SIZE) continue;
        if (maxWZ < chunkWorldZ || minWZ >= chunkWorldZ + CHUNK_SIZE) continue;

        // ── Surface Y — ONLY sample when origin is inside this chunk ─────
        // If the origin is in a different chunk we have no height data for
        // it, so we skip rather than guess.  The chunk that actually owns
        // the origin will perform the surface check and determine placeY;
        // neighboring chunks use the same cellSeed to derive the same
        // ownerCX/ownerCZ/localX/localZ and therefore the same placeY
        // once we pass the origin-in-chunk gate.
        //
        // HOWEVER: for cross-chunk writing we still need a consistent placeY.
        // We solve this by computing placeY only in the owner chunk and
        // storing it — but since we can't share state between chunk calls,
        // we instead use a second deterministic value from the RNG stream
        // that was pre-rolled when the owner chunk processed this cell.
        // The trick: consume the same RNG calls as the owner would, then
        // read placeY from a fixed slot in the sequence.

        const sampleLX = worldOriginX - chunkWorldX;
        const sampleLZ = worldOriginZ - chunkWorldZ;
        const originIsHere = (
          sampleLX >= 0 && sampleLX < CHUNK_SIZE &&
          sampleLZ >= 0 && sampleLZ < CHUNK_SIZE
        );

        let surfaceY: number;
        if (originIsHere) {
          // We own the origin — find actual surface height
          surfaceY = 64;
          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            if (chunk.getBlock(sampleLX, y, sampleLZ) !== BlockType.AIR) {
              surfaceY = y;
              break;
            }
          }

          // Surface-type validation (surface structures only)
          if (!tpl.underground && tpl.surfaceBlockTypes) {
            const surfBlock = chunk.getBlock(sampleLX, surfaceY, sampleLZ);
            if (!tpl.surfaceBlockTypes.includes(surfBlock)) continue;
          }

          // Stash surfaceY into the RNG stream so neighboring chunks can
          // recover it deterministically (see below).
          // We do this by encoding surfaceY as the next RNG draw, which
          // we'll read back as a fixed offset.  Actually simpler: we
          // store it in a per-cell cache keyed by (cellSeed).
          StructureGenerator.surfaceCache.set(cellSeed, surfaceY);
        } else {
          // We are a neighbor chunk writing the overflow portion.
          // Recover surfaceY from the cache set by the owner chunk.
          // If the owner hasn't run yet (load order), skip — the block
          // will be written when the owner chunk eventually generates.
          const cached = StructureGenerator.surfaceCache.get(cellSeed);
          if (cached === undefined) continue;
          surfaceY = cached;
        }

        const placeY = surfaceY + (tpl.heightOffset ?? 0);
        const surfaceBlock = chunk.getBlock(sampleLX, surfaceY, sampleLZ);

        // ── Place every block that lands in this chunk ────────────────────
        for (const blk of tpl.blocks) {
          const wx = worldOriginX + blk.dx;
          const wy = placeY       + blk.dy;
          const wz = worldOriginZ + blk.dz;
          const blockType = remapStructureBlock(blk.type, surfaceBlock, tpl.name);

          const lx = wx - chunkWorldX;
          const lz = wz - chunkWorldZ;

          if (
            lx >= 0 && lx < CHUNK_SIZE &&
            wy >= 0 && wy < CHUNK_HEIGHT &&
            lz >= 0 && lz < CHUNK_SIZE
          ) {
            chunk.setBlock(lx, wy, lz, blockType);
            if (blockType === BlockType.CHEST) {
              const chestLoot = StructureGenerator.createStructureLoot(tpl.name, cellSeed, wx, wy, wz);
              useWorldStore.getState().setBlockEntity(wx, wy, wz, {
                type: 'chest',
                slots: chestLoot,
              });
            } else if (blockType === BlockType.FURNACE) {
              useWorldStore.getState().setBlockEntity(wx, wy, wz, furnaceEntity());
            }
          }
        }
      }
    }
  }

  // ── Shared surface-Y cache ───────────────────────────────────────────────
  // Maps cellSeed → surfaceY so that neighbor chunks can recover the height
  // the owner chunk measured.  Cleared between world resets via reset().
  private static surfaceCache = new Map<number, number>();

  public static reset(): void {
    StructureGenerator.surfaceCache.clear();
  }

  private static createStructureLoot(
    structureName: string,
    seed: number,
    x: number,
    y: number,
    z: number
  ): ContainerSlot[] {
    const rng = new SeededRandom(seed ^ (x * 31) ^ (y * 131) ^ (z * 17));
    const slots = makeSlots(27);

    const tables: Record<string, Array<[BlockType | ItemType, number, number, number]>> = {
      mineshaft: [
        [ItemType.COAL, 2, 8, 0.35],
        [ItemType.IRON_INGOT, 1, 4, 0.35],
        [ItemType.GOLD_INGOT, 1, 3, 0.18],
        [ItemType.DIAMOND, 1, 2, 0.08],
        [ItemType.BREAD, 1, 3, 0.22],
        [ItemType.MINECART, 1, 1, 0.08],
        [ItemType.BOOK, 1, 3, 0.18],
      ],
      desert_pyramid: [
        [ItemType.GOLD_INGOT, 2, 7, 0.5],
        [ItemType.DIAMOND, 1, 2, 0.2],
        [ItemType.BONE, 2, 8, 0.35],
        [ItemType.SADDLE, 1, 1, 0.12],
        [ItemType.EMERALD, 1, 3, 0.16],
      ],
      jungle_temple: [
        [ItemType.BONE, 2, 6, 0.35],
        [ItemType.GUNPOWDER, 2, 6, 0.3],
        [ItemType.EMERALD, 1, 2, 0.2],
        [ItemType.DIAMOND, 1, 2, 0.12],
        [ItemType.BOOK, 1, 2, 0.28],
      ],
      pillager_outpost: [
        [ItemType.ARROW, 8, 24, 0.45],
        [ItemType.CROSSBOW, 1, 1, 0.12],
        [ItemType.IRON_INGOT, 1, 5, 0.3],
        [ItemType.GUNPOWDER, 2, 5, 0.22],
        [ItemType.EMERALD, 1, 4, 0.2],
      ],
      woodland_mansion: [
        [ItemType.GOLD_INGOT, 1, 4, 0.25],
        [ItemType.DIAMOND, 1, 2, 0.15],
        [ItemType.ENCHANTED_BOOK, 1, 1, 0.1],
        [ItemType.IRON_INGOT, 2, 6, 0.35],
        [ItemType.BOOK, 1, 4, 0.35],
      ],
      swamp_hut: [
        [ItemType.BOOK, 1, 4, 0.5],
        [ItemType.SUGAR, 2, 6, 0.4],
        [ItemType.GLASS_BOTTLE, 1, 3, 0.3],
        [ItemType.GLOWSTONE_DUST, 1, 4, 0.22],
      ],
      ruined_portal: [
        [ItemType.GOLD_INGOT, 2, 6, 0.45],
        [BlockType.OBSIDIAN, 1, 4, 0.4],
        [ItemType.FIRE_CHARGE, 1, 3, 0.28],
        [ItemType.FLINT_AND_STEEL, 1, 1, 0.18],
      ],
      meadow_shrine: [
        [ItemType.BOOK, 1, 3, 0.55],
        [ItemType.LAPIS_LAZULI, 2, 6, 0.45],
        [ItemType.DIAMOND, 1, 1, 0.18],
        [ItemType.ENCHANTED_BOOK, 1, 1, 0.12],
      ],
    };

    const entries = tables[structureName] ?? [
      [ItemType.COAL, 1, 4, 0.25],
      [ItemType.BREAD, 1, 2, 0.2],
      [ItemType.IRON_INGOT, 1, 2, 0.18],
    ];

    let placed = 0;
    for (const [item, minCount, maxCount, chance] of entries) {
      if (rng.next() > chance) continue;
      const count = rng.nextInt(minCount, maxCount);
      for (let attempt = 0; attempt < 8; attempt++) {
        const idx = rng.nextInt(0, slots.length - 1);
        if (slots[idx].item === null) {
          slots[idx] = lootSlot(item, count);
          placed++;
          break;
        }
      }
    }

    // Universal fallback pool so every item can show up somewhere in the world.
    // This keeps progression broad even when a specific structure table does not
    // mention a given item directly.
    const bonusRolls = pickWeightedLoot(rng, UNIVERSAL_LOOT_POOL, 4);
    for (const entry of bonusRolls) {
      if (rng.next() > Math.min(0.85, entry.weight)) continue;
      const count = rng.nextInt(entry.minCount, entry.maxCount);
      for (let attempt = 0; attempt < 8; attempt++) {
        const idx = rng.nextInt(0, slots.length - 1);
        if (slots[idx].item === null) {
          slots[idx] = lootSlot(entry.item, count);
          placed++;
          break;
        }
      }
    }

    if (placed === 0) {
      slots[rng.nextInt(0, slots.length - 1)] = lootSlot(ItemType.BREAD, 2);
    }

    return slots;
  }

  // ── Stable per-cell hash ─────────────────────────────────────────────────
  private static cellSeed(
    worldSeed: number, gcx: number, gcz: number, name: string
  ): number {
    // Use large distinct primes to minimise collisions across axes
    let h = (worldSeed ^ 0xDEADBEEF) >>> 0;
    h = Math.imul(h ^ (gcx * 0x9E3779B9 >>> 0), 0x6B43A9B5) >>> 0;
    h = Math.imul(h ^ (gcz * 0xC4CEB9FE >>> 0), 0x45D9F3B)  >>> 0;
    for (let i = 0; i < name.length; i++) {
      h = Math.imul(h ^ (name.charCodeAt(i) * 0x27D4EB2F >>> 0), 0x94D049BB) >>> 0;
    }
    h ^= h >>> 16;
    h  = Math.imul(h, 0x85EBCA6B) >>> 0;
    h ^= h >>> 13;
    h  = Math.imul(h, 0xC2B2AE35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }
}
