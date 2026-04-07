'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType, BLOCKS, isLiquid } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '@/utils/constants';
import { getBlockFromChunk } from '@/stores/worldStore';
import { textureManager } from '@/data/textureManager';

interface ChunkProps {
  x: number;
  z: number;
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block classification helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Blocks that render as flat X-crossed sprites (no cube faces) */
function isCrossSprite(bt: BlockType): boolean {
  return (
    bt === BlockType.TALL_GRASS ||
    bt === BlockType.FLOWER_RED ||
    bt === BlockType.FLOWER_YELLOW ||
    bt === BlockType.FLOWER_BLUE_ORCHID ||
    bt === BlockType.FLOWER_ALLIUM ||
    bt === BlockType.FLOWER_AZURE_BLUET ||
    bt === BlockType.FLOWER_TULIP_RED ||
    bt === BlockType.FLOWER_TULIP_ORANGE ||
    bt === BlockType.FLOWER_TULIP_WHITE ||
    bt === BlockType.FLOWER_TULIP_PINK ||
    bt === BlockType.FLOWER_OXEYE_DAISY ||
    bt === BlockType.FLOWER_CORNFLOWER ||
    bt === BlockType.FLOWER_LILY_OF_THE_VALLEY ||
    bt === BlockType.FLOWER_WITHER_ROSE ||
    bt === BlockType.MUSHROOM_RED ||
    bt === BlockType.MUSHROOM_BROWN
  );
}

/** Leaf blocks — transparent but still render their own faces */
function isLeaf(bt: BlockType): boolean {
  return (
    bt === BlockType.OAK_LEAVES ||
    bt === BlockType.BIRCH_LEAVES ||
    bt === BlockType.SPRUCE_LEAVES ||
    bt === BlockType.JUNGLE_LEAVES ||
    bt === BlockType.ACACIA_LEAVES ||
    bt === BlockType.DARK_OAK_LEAVES
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Material cache
// ─────────────────────────────────────────────────────────────────────────────

const materialCache: Map<string, THREE.Material> = new Map();

function getBlockMaterial(blockType: BlockType, face: 'top' | 'side' | 'bottom'): THREE.Material {
  const cacheKey = `${blockType}_${face}`;
  if (materialCache.has(cacheKey)) return materialCache.get(cacheKey)!;

  const block = BLOCKS[blockType];
  if (!block) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    materialCache.set(cacheKey, mat);
    return mat;
  }

  const texture = textureManager.getBlockTexture(blockType, face);
  const liquid  = blockType === BlockType.WATER || blockType === BlockType.LAVA;
  const leaf    = isLeaf(blockType);

  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    side: leaf ? THREE.DoubleSide : THREE.FrontSide,
    transparent: block.transparent || liquid,
    alphaTest: leaf ? 0.5 : block.transparent ? 0.1 : 0,
    depthWrite: !block.transparent && !liquid,
    opacity: liquid ? 0.75 : 1.0,
  });

  materialCache.set(cacheKey, mat);
  return mat;
}

/** Shared sprite material for all cross-sprite vegetation */
let spriteMaterialCache: Map<BlockType, THREE.Material> | null = null;
function getSpriteMaterial(blockType: BlockType): THREE.Material {
  if (!spriteMaterialCache) spriteMaterialCache = new Map();
  if (spriteMaterialCache.has(blockType)) return spriteMaterialCache.get(blockType)!;

  const texture = textureManager.getBlockTexture(blockType, 'side');
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.5,
    depthWrite: false,
  });
  spriteMaterialCache.set(blockType, mat);
  return mat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Face visibility
// ─────────────────────────────────────────────────────────────────────────────

function isFaceVisible(
  chunk: any,
  nx: number, ny: number, nz: number,
  currentBlockType: BlockType
): boolean {
  // Out-of-chunk bounds → assume visible (neighbour chunk handles own faces)
  if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT) {
    return true;
  }

  const nb = getBlockFromChunk(chunk, nx, ny, nz);
  if (nb === BlockType.AIR) return true;

  const nbData = BLOCKS[nb];

  // Liquid face always visible so player can see into water from outside
  if (isLiquid(nb)) return true;

  // Transparent neighbour (glass, leaves) → show face
  if (nbData?.transparent) return true;

  // Two leaf blocks adjacent: hide the shared face to avoid z-fighting blobs
  // (we DON'T hide — leaves should show their faces so the canopy looks full)
  // Actually: hide leaf-to-leaf faces to avoid dark interior blobs
  if (isLeaf(currentBlockType) && isLeaf(nb)) return false;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-sprite geometry builder
// ─────────────────────────────────────────────────────────────────────────────

type FaceGroup = {
  blockType: BlockType;
  face: 'top' | 'side' | 'bottom';
  vertices: number[];
  indices: number[];
  normals: number[];
  uvs: number[];
};

/**
 * Adds two crossed quads for grass/flower/fern sprites.
 * They're 0.8×0.8 units, centred on the block, slightly above floor.
 */
function addCrossSpriteQuads(
  x: number, y: number, z: number,
  blockType: BlockType,
  spriteGroups: Map<BlockType, FaceGroup>
): void {
  if (!spriteGroups.has(blockType)) {
    spriteGroups.set(blockType, {
      blockType, face: 'side',
      vertices: [], indices: [], normals: [], uvs: [],
    });
  }
  const g = spriteGroups.get(blockType)!;

  const cx = x + 0.5;
  const cy = y;        // base of block
  const cz = z + 0.5;
  const h  = 0.9;      // sprite height
  const r  = 0.45;     // half-width

  // Diagonal 1: NW-SE
  const quads = [
    // NW corner to SE corner
    [cx - r, cy, cz - r,   cx + r, cy, cz + r],
    // NE corner to SW corner
    [cx + r, cy, cz - r,   cx - r, cy, cz + r],
  ];

  for (const [x0, y0, z0, x1, y1, z1] of quads) {
    const base = g.vertices.length / 3;
    // 4 verts: bottom-left, bottom-right, top-right, top-left
    g.vertices.push(
      x0, y0, z0,
      x1, y1, z1,
      x1, y1 + h, z1,
      x0, y0 + h, z0,
    );
    g.normals.push(
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    );
    g.uvs.push(
      0, 1,  1, 1,  1, 0,  0, 0,
    );
    g.indices.push(
      base, base + 1, base + 2,
      base, base + 2, base + 3,
      // Back face
      base + 2, base + 1, base,
      base + 3, base + 2, base,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cube face geometry builder
// ─────────────────────────────────────────────────────────────────────────────

const CUBE_FACES = [
  { faceName: 'top'    as const, dir: [ 0,  1,  0], verts: (x:number,y:number,z:number) => [x,y+1,z, x,y+1,z+1, x+1,y+1,z+1, x+1,y+1,z],   norm:[0,1,0],  uvs:[0,0, 0,1, 1,1, 1,0] },
  { faceName: 'bottom' as const, dir: [ 0, -1,  0], verts: (x:number,y:number,z:number) => [x,y,z+1, x,y,z,     x+1,y,z,     x+1,y,z+1],    norm:[0,-1,0], uvs:[0,1, 0,0, 1,0, 1,1] },
  { faceName: 'side'   as const, dir: [ 0,  0,  1], verts: (x:number,y:number,z:number) => [x,y,z+1, x+1,y,z+1, x+1,y+1,z+1, x,y+1,z+1],   norm:[0,0,1],  uvs:[0,1, 1,1, 1,0, 0,0] },
  { faceName: 'side'   as const, dir: [ 0,  0, -1], verts: (x:number,y:number,z:number) => [x+1,y,z, x,y,z,     x,y+1,z,     x+1,y+1,z],    norm:[0,0,-1], uvs:[0,1, 1,1, 1,0, 0,0] },
  { faceName: 'side'   as const, dir: [ 1,  0,  0], verts: (x:number,y:number,z:number) => [x+1,y,z+1, x+1,y,z, x+1,y+1,z,  x+1,y+1,z+1],  norm:[1,0,0],  uvs:[0,1, 1,1, 1,0, 0,0] },
  { faceName: 'side'   as const, dir: [-1,  0,  0], verts: (x:number,y:number,z:number) => [x,y,z,   x,y,z+1,   x,y+1,z+1,  x,y+1,z],       norm:[-1,0,0], uvs:[0,1, 1,1, 1,0, 0,0] },
] as const;

function addBlockFaces(
  chunk: any,
  x: number, y: number, z: number,
  blockType: BlockType,
  facesByKey: Map<string, FaceGroup>
): void {
  for (const face of CUBE_FACES) {
    const [dx, dy, dz] = face.dir;
    if (!isFaceVisible(chunk, x + dx, y + dy, z + dz, blockType)) continue;

    const key = `${blockType}_${face.faceName}`;
    if (!facesByKey.has(key)) {
      facesByKey.set(key, { blockType, face: face.faceName, vertices: [], indices: [], normals: [], uvs: [] });
    }
    const g = facesByKey.get(key)!;
    const base = g.vertices.length / 3;

    g.vertices.push(...face.verts(x, y, z));
    for (let i = 0; i < 4; i++) g.normals.push(...face.norm);
    g.uvs.push(...face.uvs);
    g.indices.push(base, base+1, base+2, base, base+2, base+3);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build BufferGeometry from a FaceGroup
// ─────────────────────────────────────────────────────────────────────────────

function buildGeometry(g: FaceGroup): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.vertices), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(g.indices), 1));
  geo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(g.normals), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(g.uvs), 2));
  geo.computeBoundingSphere();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function OptimizedChunk({ x, z, version }: ChunkProps) {
  const groupRef  = useRef<THREE.Group>(null);
  const chunk     = useWorldStore((state) => state.getChunk(x, z));
  const { camera } = useThree();

  const chunkWorldPos = useMemo(
    () => new THREE.Vector3(x * CHUNK_SIZE + CHUNK_SIZE / 2, 64, z * CHUNK_SIZE + CHUNK_SIZE / 2),
    [x, z]
  );

  const meshes = useMemo(() => {
    if (!chunk || !chunk.isGenerated) return null;

    // Cube face groups (keyed by blockType_face)
    const facesByKey = new Map<string, FaceGroup>();
    // Cross-sprite groups (keyed by blockType)
    const spriteGroups = new Map<BlockType, FaceGroup>();

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        // Limit vertical scan to column surface + headroom.
        // This avoids scanning all 256 levels for each column.
        const columnIndex = lz * CHUNK_SIZE + lx;
        const maxY = Math.min(CHUNK_HEIGHT - 1, chunk.heightMap[columnIndex] + 20);
        for (let y = maxY; y >= 0; y--) {
          const bt = getBlockFromChunk(chunk, lx, y, lz);
          if (bt === BlockType.AIR) continue;

          if (isCrossSprite(bt)) {
            // Render as flat X-cross sprite
            addCrossSpriteQuads(lx, y, lz, bt, spriteGroups);
          } else {
            addBlockFaces(chunk, lx, y, lz, bt, facesByKey);
          }
        }
      }
    }

    const result: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];

    // Cube face meshes
    for (const [, g] of facesByKey) {
      if (g.vertices.length === 0) continue;
      result.push({ geometry: buildGeometry(g), material: getBlockMaterial(g.blockType, g.face) });
    }

    // Cross-sprite meshes
    for (const [bt, g] of spriteGroups) {
      if (g.vertices.length === 0) continue;
      result.push({ geometry: buildGeometry(g), material: getSpriteMaterial(bt) });
    }

    return result;
  }, [chunk, version]);

  // Sync THREE.Mesh objects into group
  useEffect(() => {
    if (!groupRef.current || !meshes) return;

    // Clear old
    while (groupRef.current.children.length > 0) {
      const child = groupRef.current.children[0] as THREE.Mesh;
      groupRef.current.remove(child);
      child.geometry.dispose();
    }

    for (const { geometry, material } of meshes) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = true;
      groupRef.current.add(mesh);
    }
  }, [meshes]);

  // Cleanup
  useEffect(() => {
    return () => {
      groupRef.current?.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    };
  }, []);

  if (!chunk || !chunk.isGenerated || !meshes) return null;

  return <group ref={groupRef} position={[x * CHUNK_SIZE, 0, z * CHUNK_SIZE]} />;
}

export function clearMaterialCache(): void {
  materialCache.forEach((material) => {
    material.dispose();
  });
  materialCache.clear();
}
