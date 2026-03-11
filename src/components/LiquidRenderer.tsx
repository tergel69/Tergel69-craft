'use client';

/**
 * LiquidRenderer.tsx
 *
 * Renders animated water and lava as translucent flat planes wherever
 * liquid blocks exist near the player. Works by scanning a radius around
 * the player each frame and batching liquid surfaces into single meshes.
 *
 * HOW TO USE:
 *   1. Copy to components/LiquidRenderer.tsx
 *   2. Inside your World component (or Game.tsx Canvas), add:
 *        import LiquidRenderer from './LiquidRenderer';
 *        // ...inside <Canvas>:
 *        <LiquidRenderer />
 *
 * PERFORMANCE:
 *   - Only scans within SCAN_RADIUS blocks of player
 *   - Rebuilds geometry only when player crosses a chunk boundary
 *   - Uses instancing via merged BufferGeometry (one draw call per liquid type)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';

const SCAN_RADIUS = 20;        // blocks around player to scan
const LIQUID_Y_OFFSET = 0.875; // water surface sits 1/8 block below block top

// ── Animated water shader ──────────────────────────────────────────────────

const WATER_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WATER_FRAG = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;

  float wave(vec2 uv, float freq, float speed, float phase) {
    return sin(uv.x * freq + uTime * speed + phase) *
           cos(uv.y * freq * 0.7 + uTime * speed * 0.8 + phase * 1.3) * 0.5 + 0.5;
  }

  void main() {
    float w1 = wave(vUv, 6.0, 1.2, 0.0);
    float w2 = wave(vUv, 9.0, 0.8, 2.1);
    float w3 = wave(vUv, 4.0, 1.5, 4.7);
    float w  = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2);

    vec3 deep    = vec3(0.04, 0.22, 0.55);
    vec3 shallow = vec3(0.18, 0.55, 0.90);
    vec3 foam    = vec3(0.70, 0.88, 1.00);

    vec3 col = mix(deep, shallow, w);
    col = mix(col, foam, smoothstep(0.7, 1.0, w) * 0.4);

    // Slight edge fade for blending
    float edgeFade = 1.0 - smoothstep(0.45, 0.5, abs(vUv.x - 0.5)) * 0.3;
    edgeFade      *= 1.0 - smoothstep(0.45, 0.5, abs(vUv.y - 0.5)) * 0.3;

    gl_FragColor = vec4(col, 0.72 * edgeFade);
  }
`;

// ── Animated lava shader ───────────────────────────────────────────────────

const LAVA_VERT = WATER_VERT;

const LAVA_FRAG = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;

  float lavaCell(vec2 uv) {
    uv.x += sin(uv.y * 4.0 + uTime * 0.6) * 0.12;
    uv.y += cos(uv.x * 3.0 + uTime * 0.4) * 0.10;
    float d = length(fract(uv * 2.5) - 0.5);
    return smoothstep(0.45, 0.05, d);
  }

  void main() {
    float cell1 = lavaCell(vUv);
    float cell2 = lavaCell(vUv + vec2(0.3, 0.17) + uTime * 0.04);
    float lava  = max(cell1, cell2 * 0.6);

    float pulse = sin(uTime * 1.8 + vUv.x * 3.0 + vUv.y * 2.0) * 0.5 + 0.5;

    vec3 dark   = vec3(0.30, 0.04, 0.00);
    vec3 mid    = vec3(0.85, 0.25, 0.00);
    vec3 bright = vec3(1.00, 0.85, 0.10);

    vec3 col = mix(dark, mid, lava);
    col = mix(col, bright, lava * pulse * 0.7);

    gl_FragColor = vec4(col, 0.95);
  }
`;

// ── Build merged flat geometry from block list ─────────────────────────────
function buildLiquidGeometry(
  blocks: Array<{ x: number; y: number; z: number }>
): THREE.BufferGeometry | null {
  if (blocks.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let base = 0;
  for (const { x, y, z } of blocks) {
    const sy = y + LIQUID_Y_OFFSET;
    // One quad per liquid surface (XZ plane)
    positions.push(
      x,     sy, z,
      x + 1, sy, z,
      x + 1, sy, z + 1,
      x,     sy, z + 1,
    );
    uvs.push(0, 0,  1, 0,  1, 1,  0, 1);
    indices.push(
      base, base + 1, base + 2,
      base, base + 2, base + 3,
    );
    base += 4;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── Scan around player for liquid surfaces ─────────────────────────────────
function scanLiquids(
  px: number, py: number, pz: number
): { water: { x: number; y: number; z: number }[]; lava: { x: number; y: number; z: number }[] } {
  const world = useWorldStore.getState();
  const water: { x: number; y: number; z: number }[] = [];
  const lava:  { x: number; y: number; z: number }[] = [];

  const x0 = Math.floor(px) - SCAN_RADIUS;
  const x1 = Math.floor(px) + SCAN_RADIUS;
  const y0 = Math.max(1,   Math.floor(py) - SCAN_RADIUS);
  const y1 = Math.min(250, Math.floor(py) + SCAN_RADIUS);
  const z0 = Math.floor(pz) - SCAN_RADIUS;
  const z1 = Math.floor(pz) + SCAN_RADIUS;

  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      for (let y = y1; y >= y0; y--) {
        const b = world.getBlock(x, y, z);
        if (b === BlockType.WATER) {
          // Only add a top face if block above is air/not-water
          const above = world.getBlock(x, y + 1, z);
          if (above === BlockType.AIR || above === undefined) {
            water.push({ x, y, z });
          }
        } else if (b === BlockType.LAVA) {
          const above = world.getBlock(x, y + 1, z);
          if (above === BlockType.AIR || above === undefined) {
            lava.push({ x, y, z });
          }
        }
      }
    }
  }

  return { water, lava };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function LiquidRenderer() {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const lavaMeshRef  = useRef<THREE.Mesh>(null);

  const lastChunkX = useRef<number | null>(null);
  const lastChunkZ = useRef<number | null>(null);

  const timeRef = useRef(0);

  const waterMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
  }), []);

  const lavaMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   LAVA_VERT,
    fragmentShader: LAVA_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: false,
    side:        THREE.DoubleSide,
    depthWrite:  true,
  }), []);

  useFrame((_, delta) => {
    timeRef.current += delta;
    waterMat.uniforms.uTime.value = timeRef.current;
    lavaMat.uniforms.uTime.value  = timeRef.current;

    // Rebuild geometry when player crosses chunk boundary
    const pos = usePlayerStore.getState().position;
    const chunkX = Math.floor(pos.x / 16);
    const chunkZ = Math.floor(pos.z / 16);

    if (chunkX !== lastChunkX.current || chunkZ !== lastChunkZ.current) {
      lastChunkX.current = chunkX;
      lastChunkZ.current = chunkZ;

      const { water, lava } = scanLiquids(pos.x, pos.y, pos.z);

      // Update water mesh
      if (waterMeshRef.current) {
        const oldGeo = waterMeshRef.current.geometry;
        const newGeo = buildLiquidGeometry(water);
        waterMeshRef.current.geometry = newGeo ?? new THREE.BufferGeometry();
        oldGeo.dispose();
      }

      // Update lava mesh
      if (lavaMeshRef.current) {
        const oldGeo = lavaMeshRef.current.geometry;
        const newGeo = buildLiquidGeometry(lava);
        lavaMeshRef.current.geometry = newGeo ?? new THREE.BufferGeometry();
        oldGeo.dispose();
      }
    }
  });

  return (
    <>
      <mesh ref={waterMeshRef} material={waterMat} renderOrder={1} />
      <mesh ref={lavaMeshRef}  material={lavaMat}  renderOrder={2} />
    </>
  );
}