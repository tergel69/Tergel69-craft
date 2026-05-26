'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { Projectile, useProjectileStore } from '@/utils/projectile';

const shaftGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
const tipGeometry = new THREE.ConeGeometry(0.05, 0.16, 6);
const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
const tipMaterial = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.3, metalness: 0.4 });
const up = new THREE.Vector3(0, 1, 0);

function ProjectileMesh({ projectile }: { projectile: Projectile }) {
  if (projectile.collected) return null;

  const direction = new THREE.Vector3(projectile.vx, projectile.vy, projectile.vz);
  if (direction.lengthSq() === 0) direction.set(0, 0, 1);
  direction.normalize();

  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

  return (
    <group position={[projectile.x, projectile.y, projectile.z]} quaternion={quaternion}>
      <mesh geometry={shaftGeometry} material={shaftMaterial} />
      <mesh geometry={tipGeometry} material={tipMaterial} position={[0, 0.43, 0]} />
    </group>
  );
}

export default function Projectiles() {
  const gameState = useGameStore((s) => s.gameState);
  const projectiles = useProjectileStore((s) => s.projectiles);

  useFrame((_, delta) => {
    if (gameState !== 'playing') return;
    useProjectileStore.getState().update(delta);
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      useProjectileStore.getState().clearCollected();
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <group>
      {projectiles.filter((projectile) => !projectile.collected).map((projectile) => (
        <ProjectileMesh key={projectile.id} projectile={projectile} />
      ))}
    </group>
  );
}
