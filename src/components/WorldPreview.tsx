'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Simple voxel chunk for preview
function VoxelChunk({ position, size = 8 }: { position: [number, number, number]; size?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshLambertMaterial({ color: 0x5d8c3a });
  }, []);

  // Create a simple terrain using boxes
  const voxels = useMemo(() => {
    const boxes: { pos: [number, number, number]; type: number }[] = [];
    
    // Simple terrain generation
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        // Simple height variation
        const height = Math.floor(
          Math.sin(x * 0.3) * 1.5 + 
          Math.cos(z * 0.3) * 1.5 + 
          Math.sin(x * 0.15 + z * 0.1) * 2 +
          2
        );
        
        for (let y = 0; y <= height; y++) {
          // Grass on top, dirt below
          const type = y === height ? 0 : 1;
          boxes.push({
            pos: [x - size/2, y, z - size/2],
            type
          });
        }
      }
    }
    
    return boxes;
  }, [size]);

  return (
    <group position={position}>
      {voxels.map((voxel, i) => (
        <mesh
          key={i}
          position={voxel.pos}
          geometry={geometry}
          material={material}
        >
          <meshLambertMaterial color={voxel.type === 0 ? '#5d8c3a' : '#6b4423'} />
        </mesh>
      ))}
    </group>
  );
}

// Simple tree
function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshLambertMaterial color="#5a3d2b" />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshLambertMaterial color="#2d5a1e" />
      </mesh>
      <mesh position={[0.8, 3, 0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial color="#2d5a1e" />
      </mesh>
      <mesh position={[-0.8, 3, 0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial color="#2d5a1e" />
      </mesh>
      <mesh position={[0, 3, 0.8]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial color="#2d5a1e" />
      </mesh>
      <mesh position={[0, 3, -0.8]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial color="#2d5a1e" />
      </mesh>
    </group>
  );
}

// Water
function Water({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[20, 0.5, 20]} />
      <meshLambertMaterial color="#3498db" transparent opacity={0.7} />
    </mesh>
  );
}

// Camera controller for menu background
function CameraController() {
  const { camera } = useThree();
  const timeRef = useRef(0);
  
  useEffect(() => {
    camera.position.set(12, 8, 12);
    camera.lookAt(0, 2, 0);
  }, [camera]);
  
  useFrame((_, delta) => {
    timeRef.current += delta * 0.15;
    // Slow rotating camera around the scene
    const radius = 14;
    const height = 8 + Math.sin(timeRef.current * 0.5) * 2;
    camera.position.x = Math.cos(timeRef.current) * radius;
    camera.position.z = Math.sin(timeRef.current) * radius;
    camera.position.y = height;
    camera.lookAt(0, 2, 0);
  });
  
  return null;
}

// Simple sun/moon
function Sun() {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  
  useFrame((_, delta) => {
    timeRef.current += delta * 0.1;
    if (meshRef.current) {
      meshRef.current.position.x = Math.cos(timeRef.current) * 30;
      meshRef.current.position.y = Math.sin(timeRef.current) * 30 + 5;
    }
  });
  
  return (
    <mesh ref={meshRef} position={[20, 15, -10]}>
      <sphereGeometry args={[2, 16, 16]} />
      <meshBasicMaterial color="#ffdd44" />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.6} />
      
      {/* Directional light (sun) */}
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={1.2} 
        color="#fffae6"
        castShadow
      />
      
      {/* Hemisphere light for sky/ground */}
      <hemisphereLight 
        args={['#87ceeb', '#3d5c3a', 0.6]} 
      />
      
      {/* Sky */}
      <mesh>
        <sphereGeometry args={[100, 32, 32]} />
        <meshBasicMaterial color="#5cacee" side={THREE.BackSide} />
      </mesh>
      
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial color="#3d5c3a" />
      </mesh>
      
      {/* Terrain chunks */}
      <VoxelChunk position={[0, 0, 0]} size={10} />
      <VoxelChunk position={[10, 0, 0]} size={6} />
      <VoxelChunk position={[-10, 0, 0]} size={6} />
      <VoxelChunk position={[0, 0, 10]} size={6} />
      <VoxelChunk position={[0, 0, -10]} size={6} />
      
      {/* Trees */}
      <Tree position={[3, 2, 2]} />
      <Tree position={[-4, 2, 3]} />
      <Tree position={[2, 2, -3]} />
      <Tree position={[-2, 2, -4]} />
      <Tree position={[6, 2, -2]} />
      <Tree position={[-6, 2, 1]} />
      
      {/* Water pool */}
      <Water position={[0, -0.25, 8]} />
      
      {/* Sun */}
      <Sun />
      
      {/* Camera controller */}
      <CameraController />
    </>
  );
}

export default function WorldPreview() {
  return (
    <Canvas
      gl={{ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      }}
      camera={{ fov: 45, near: 0.1, far: 200 }}
      style={{ background: 'transparent' }}
    >
      <Scene />
    </Canvas>
  );
}
