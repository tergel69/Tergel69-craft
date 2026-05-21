'use client';

/**
 * XpOrbs.tsx — Experience orb visual component
 *
 * Renders floating green XP orbs that magnetically pull toward the player
 * when close. Spawned when breaking ores and killing mobs.
 */

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useXpStore } from '@/utils/experience';

const ORB_RADIUS = 0.12;
const ORB_SEGMENTS = 8;

// Shared geometry and material for performance
const orbGeometry = new THREE.SphereGeometry(ORB_RADIUS, ORB_SEGMENTS, ORB_SEGMENTS);
const orbMaterial = new THREE.MeshBasicMaterial({
  color: 0x80ff80,
  transparent: true,
  opacity: 0.85,
});

function SingleOrb({ orb }: { orb: any }) {
  useFrame((_, delta) => {
    if (orb.collected) return;
    // Physics is handled in store.updateOrbs() — we just render
  });

  if (orb.collected) return null;

  return (
    <mesh
      geometry={orbGeometry}
      material={orbMaterial}
      position={[orb.x, orb.y, orb.z]}
    >
      {/* Inner glow */}
      <pointLight color={0x80ff80} intensity={0.15} distance={2} decay={2} />
    </mesh>
  );
}

export default function XpOrbs() {
  // Update physics each frame
  useFrame((_, delta) => {
    useXpStore.getState().updateOrbs(delta);
  });

  // Periodic cleanup
  useEffect(() => {
    const id = setInterval(() => {
      useXpStore.getState().clearCollected();
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const orbs = useXpStore((s) => s.orbs);

  return (
    <group>
      {orbs.filter(o => !o.collected).map(orb => (
        <SingleOrb key={orb.id} orb={orb} />
      ))}
    </group>
  );
}