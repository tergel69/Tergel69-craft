'use client';

/**
 * BlockBreakOverlay
 *
 * Renders a Minecraft-style cracking overlay on the face of the block
 * currently being broken. Uses 8 crack stages that darken + crack
 * progressively as progress goes 0→1.
 *
 * Expects gameStore.breakingBlock to have shape:
 *   { x, y, z, progress: 0–1, nx, ny, nz }
 */

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';

// 8 crack stages: each is an SVG-style path drawn on a canvas
const STAGES = 8;

// Build crack textures once and cache them
let crackTextures: THREE.CanvasTexture[] | null = null;

function buildCrackTextures(): THREE.CanvasTexture[] {
  const size = 64;
  const textures: THREE.CanvasTexture[] = [];

  for (let stage = 0; stage < STAGES; stage++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const t = (stage + 1) / STAGES; // 0.125 → 1.0

    // Dark overlay — gets progressively more opaque
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = `rgba(0,0,0,${0.08 + t * 0.3})`;
    ctx.fillRect(0, 0, size, size);

    // Draw crack lines — more lines at higher stages
    ctx.strokeStyle = `rgba(0,0,0,${0.5 + t * 0.5})`;
    ctx.lineWidth = 1.5 + t * 1.5;
    ctx.lineCap = 'round';

    const crackCount = Math.floor(2 + t * 5);
    const rng = mulberry32(stage * 12345 + 67890); // deterministic seeded RNG

    for (let i = 0; i < crackCount; i++) {
      const sx = rng() * size;
      const sy = rng() * size;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const segments = Math.floor(1 + t * 3);
      let cx = sx, cy = sy;
      for (let s = 0; s < segments; s++) {
        cx += (rng() - 0.5) * size * 0.45;
        cy += (rng() - 0.5) * size * 0.45;
        cx = Math.max(0, Math.min(size, cx));
        cy = Math.max(0, Math.min(size, cy));
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Edge chips — small dark patches around cracks
    if (t > 0.4) {
      const chipCount = Math.floor(t * 8);
      for (let i = 0; i < chipCount; i++) {
        const cx = rng() * size;
        const cy = rng() * size;
        const cr = 1.5 + rng() * 4 * t;
        ctx.fillStyle = `rgba(0,0,0,${0.3 + rng() * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    textures.push(tex);
  }
  return textures;
}

/** Fast deterministic seeded RNG (returns 0–1) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Particle system for block breaking
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

const MAX_PARTICLES = 100;

// Slight inset so the overlay sits just in front of the face
const INSET = 0.002;

// Block breaking particle system
function BlockBreakParticles() {
  const particlesRef = useRef<Particle[]>([]);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const lastBreakingRef = useRef<any>(null);

  useEffect(() => {
    // Initialize particle system
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const mat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geo, mat);
    points.renderOrder = 1000;
    
    geometryRef.current = geo;
    materialRef.current = mat;
    pointsRef.current = points;

    return () => {
      if (mat.map) mat.map.dispose();
      mat.dispose();
      geo.dispose();
    };
  }, []);

  useFrame(() => {
    const breaking = useGameStore.getState().breakingBlock;
    const worldStore = useWorldStore.getState();
    
    if (!geometryRef.current || !materialRef.current || !pointsRef.current) return;

    const particles = particlesRef.current;
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const colors = geometryRef.current.attributes.color.array as Float32Array;

    // Spawn particles when block is being broken
    if (breaking && breaking.progress > 0) {
      const blockType = worldStore.getBlock(breaking.x, breaking.y, breaking.z);
      const blockColor = getBlockColor(blockType);
      
      // Spawn particles based on breaking progress
      if (lastBreakingRef.current !== breaking) {
        spawnParticles(breaking, blockColor, particles);
        lastBreakingRef.current = breaking;
      }
    }

    // Update and render particles
    let activeCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.life <= 0) continue;

      // Update physics
      p.velocity.y -= 0.002; // gravity
      p.position.add(p.velocity);
      p.life--;
      
      // Update geometry
      positions[activeCount * 3] = p.position.x;
      positions[activeCount * 3 + 1] = p.position.y;
      positions[activeCount * 3 + 2] = p.position.z;
      
      const alpha = p.life / p.maxLife;
      colors[activeCount * 3] = p.color.r * alpha;
      colors[activeCount * 3 + 1] = p.color.g * alpha;
      colors[activeCount * 3 + 2] = p.color.b * alpha;
      
      activeCount++;
    }

    if (activeCount > 0) {
      geometryRef.current.setDrawRange(0, activeCount);
      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.attributes.color.needsUpdate = true;
      pointsRef.current.visible = true;
    } else {
      pointsRef.current.visible = false;
    }
  });

  // Return null if pointsRef.current is not available yet
  if (!pointsRef.current) {
    return null;
  }

  return <primitive object={pointsRef.current} />;
}

function spawnParticles(breaking: any, color: THREE.Color, particles: Particle[]) {
  const { x, y, z, nx, ny, nz, progress } = breaking;
  const center = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
  const normal = new THREE.Vector3(nx, ny, nz);
  
  // Spawn more particles as breaking progresses
  const particleCount = Math.floor(8 + progress * 20);
  
  for (let i = 0; i < particleCount; i++) {
    const p = getParticle(particles);
    if (!p) break;

    // Random position on the face
    const randX = (Math.random() - 0.5) * 0.8;
    const randY = (Math.random() - 0.5) * 0.8;
    const randZ = (Math.random() - 0.5) * 0.8;
    
    // Align with face normal
    let pos = new THREE.Vector3(randX, randY, randZ);
    if (Math.abs(nx) === 1) pos = new THREE.Vector3(0, randY, randZ);
    if (Math.abs(ny) === 1) pos = new THREE.Vector3(randX, 0, randZ);
    if (Math.abs(nz) === 1) pos = new THREE.Vector3(randX, randY, 0);
    
    p.position.copy(center).add(pos);
    
    // Velocity away from face with more intensity based on progress
    const intensity = 0.02 + progress * 0.04;
    const velocity = normal.clone().multiplyScalar(intensity + Math.random() * 0.03);
    velocity.x += (Math.random() - 0.5) * 0.02 * (1 + progress);
    velocity.y += (Math.random() - 0.5) * 0.02 * (1 + progress);
    velocity.z += (Math.random() - 0.5) * 0.02 * (1 + progress);
    p.velocity.copy(velocity);
    
    // Longer life for higher progress
    p.life = p.maxLife = 60 + Math.floor(Math.random() * 40) + Math.floor(progress * 30);
    
    // Color shifts from block color to red as progress increases
    const colorMix = progress;
    p.color.setRGB(
      color.r * (1 - colorMix * 0.5) + 0.8 * colorMix,
      color.g * (1 - colorMix * 0.3),
      color.b * (1 - colorMix)
    );
    p.size = 0.1 + Math.random() * 0.1 + progress * 0.05;
  }
}

function getParticle(particles: Particle[]): Particle | null {
  // Find existing dead particle or create new one
  for (const p of particles) {
    if (p.life <= 0) {
      p.life = 1; // Mark as active
      return p;
    }
  }
  
  // Create new particle if none available
  const p: Particle = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    life: 1,
    maxLife: 1,
    color: new THREE.Color(),
    size: 0.1
  };
  particles.push(p);
  return p;
}

function getBlockColor(blockType: BlockType | null): THREE.Color {
  switch (blockType) {
    case BlockType.STONE: return new THREE.Color(0x8B8B8B);
    case BlockType.DIRT: return new THREE.Color(0x8B5A2B);
    case BlockType.GRASS: return new THREE.Color(0x7CBA3D);
    case BlockType.SAND: return new THREE.Color(0xE8D4A2);
    case BlockType.OAK_LOG: return new THREE.Color(0x8B5A2B);
    case BlockType.COAL_ORE: return new THREE.Color(0x3D3D3D);
    case BlockType.IRON_ORE: return new THREE.Color(0x8B7355);
    case BlockType.GOLD_ORE: return new THREE.Color(0xFCEE4B);
    case BlockType.DIAMOND_ORE: return new THREE.Color(0x4AEDD9);
    default: return new THREE.Color(0x8B8B8B);
  }
}

export default function BlockBreakOverlay() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const breaking = useGameStore.getState().breakingBlock;
    const mesh = meshRef.current;
    const mat  = matRef.current;
    if (!mesh || !mat) return;

    if (!breaking || breaking.progress <= 0) {
      mesh.visible = false;
      return;
    }

    // Ensure textures are built (client-side only)
    if (!crackTextures) crackTextures = buildCrackTextures();

    const { x, y, z, progress, nx = 0, ny = 1, nz = 0 } = breaking;

    // Which crack stage (0–7)
    const stage = Math.min(STAGES - 1, Math.floor(progress * STAGES));
    mat.map = crackTextures[stage];
    mat.needsUpdate = true;

    // Position the overlay plane on the correct face
    // Block centre + face normal * 0.5 (face centre) + normal * INSET
    const cx = x + 0.5;
    const cy = y + 0.5;
    const cz = z + 0.5;

    mesh.position.set(
      cx + nx * (0.5 + INSET),
      cy + ny * (0.5 + INSET),
      cz + nz * (0.5 + INSET)
    );

    // Rotate plane to face the correct direction
    if (nx !== 0) {
      mesh.rotation.set(0, nx > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    } else if (ny !== 0) {
      mesh.rotation.set(ny > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0);
    } else {
      mesh.rotation.set(0, nz > 0 ? 0 : Math.PI, 0);
    }

    mesh.visible = true;
  });

  return (
    <>
      <mesh ref={meshRef} visible={false} renderOrder={999}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={matRef}
          transparent
          opacity={1}
          depthWrite={false}
          depthTest={true}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <BlockBreakParticles />
    </>
  );
}
