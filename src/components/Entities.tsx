'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { entityManager } from '@/entities/EntityManager';
import * as THREE from 'three';

const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const GEOMETRY = {
  pigBody: box(1.0, 0.6, 0.55),
  pigHead: box(0.5, 0.5, 0.5),
  pigLeg: box(0.18, 0.35, 0.18),
  snout: box(0.24, 0.18, 0.2),

  cowBody: box(1.1, 0.75, 0.6),
  cowHead: box(0.58, 0.5, 0.55),
  cowLeg: box(0.2, 0.5, 0.2),
  horn: box(0.08, 0.08, 0.2),

  sheepBody: box(1.0, 0.7, 0.62),
  sheepHead: box(0.42, 0.4, 0.4),
  sheepLeg: box(0.16, 0.38, 0.16),

  chickenBody: box(0.42, 0.42, 0.5),
  chickenHead: box(0.24, 0.24, 0.24),
  chickenWing: box(0.08, 0.22, 0.3),
  chickenLeg: box(0.07, 0.22, 0.07),
  beak: box(0.12, 0.08, 0.12),
  comb: box(0.06, 0.12, 0.06),

  humanoidBody: box(0.48, 0.7, 0.26),
  humanoidHead: box(0.4, 0.4, 0.4),
  humanoidArm: box(0.14, 0.62, 0.14),
  humanoidLeg: box(0.16, 0.62, 0.16),

  creeperBody: box(0.6, 0.95, 0.4),
  creeperHead: box(0.58, 0.58, 0.58),
  creeperLeg: box(0.16, 0.32, 0.16),
};

const MATERIALS: Record<string, THREE.MeshLambertMaterial> = {
  pig: new THREE.MeshLambertMaterial({ color: 0xf2a2b9 }),
  pigNose: new THREE.MeshLambertMaterial({ color: 0xe392ac }),
  cow: new THREE.MeshLambertMaterial({ color: 0x8b6b4a }),
  cowHorn: new THREE.MeshLambertMaterial({ color: 0xd8d1b8 }),
  sheepWool: new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
  sheepFace: new THREE.MeshLambertMaterial({ color: 0x595959 }),
  chickenBody: new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }),
  chickenAccent: new THREE.MeshLambertMaterial({ color: 0xe84a4a }),
  chickenBeak: new THREE.MeshLambertMaterial({ color: 0xf2b63d }),
  zombie: new THREE.MeshLambertMaterial({ color: 0x4e8b54 }),
  skeleton: new THREE.MeshLambertMaterial({ color: 0xdadada }),
  creeper: new THREE.MeshLambertMaterial({ color: 0x3baf4a }),
};

export default function Entities() {
  const [entities, setEntities] = useState(() => entityManager.getAllEntities());
  const refreshTimerRef = useRef(0);

  useFrame((_, delta) => {
    entityManager.update(delta);
    refreshTimerRef.current += delta;
    if (refreshTimerRef.current >= 0.1) {
      refreshTimerRef.current = 0;
      setEntities(entityManager.getAllEntities());
    }
  });

  if (entities.length === 0) return null;

  return (
    <group>
      {entities.map((entity) => (
        <MobMesh
          key={entity.id}
          id={entity.id}
          x={entity.position.x}
          y={entity.position.y}
          z={entity.position.z}
          yaw={entity.rotation.yaw}
          type={entity.type}
          isDead={entity.isDead}
        />
      ))}
    </group>
  );
}

function MobMesh({
  id,
  x,
  y,
  z,
  yaw,
  type,
  isDead,
}: {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  type: string;
  isDead: boolean;
}) {
  if (isDead) return null;
  const phase = (id.charCodeAt(0) + id.length) % 2 === 0 ? 0.05 : -0.05;

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {type === 'pig' && <PigMesh phase={phase} />}
      {type === 'cow' && <CowMesh phase={phase} />}
      {type === 'sheep' && <SheepMesh phase={phase} />}
      {type === 'chicken' && <ChickenMesh phase={phase} />}
      {type === 'zombie' && <HumanoidMesh material={MATERIALS.zombie} phase={phase} />}
      {type === 'skeleton' && <HumanoidMesh material={MATERIALS.skeleton} phase={phase} />}
      {type === 'creeper' && <CreeperMesh phase={phase} />}
      {!['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper'].includes(type) && (
        <mesh geometry={GEOMETRY.humanoidBody} material={MATERIALS.skeleton} />
      )}
    </group>
  );
}

function PigMesh({ phase }: { phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.pigBody} material={MATERIALS.pig} position={[0, 0.45, 0]} />
      <mesh geometry={GEOMETRY.pigHead} material={MATERIALS.pig} position={[0, 0.48, 0.45]} />
      <mesh geometry={GEOMETRY.snout} material={MATERIALS.pigNose} position={[0, 0.42, 0.7]} />
      <mesh geometry={GEOMETRY.pigLeg} material={MATERIALS.pig} position={[-0.28, 0.16 + phase, -0.2]} />
      <mesh geometry={GEOMETRY.pigLeg} material={MATERIALS.pig} position={[0.28, 0.16 - phase, -0.2]} />
      <mesh geometry={GEOMETRY.pigLeg} material={MATERIALS.pig} position={[-0.28, 0.16 - phase, 0.2]} />
      <mesh geometry={GEOMETRY.pigLeg} material={MATERIALS.pig} position={[0.28, 0.16 + phase, 0.2]} />
    </>
  );
}

function CowMesh({ phase }: { phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.cowBody} material={MATERIALS.cow} position={[0, 0.58, 0]} />
      <mesh geometry={GEOMETRY.cowHead} material={MATERIALS.cow} position={[0, 0.62, 0.52]} />
      <mesh geometry={GEOMETRY.horn} material={MATERIALS.cowHorn} position={[-0.19, 0.82, 0.72]} />
      <mesh geometry={GEOMETRY.horn} material={MATERIALS.cowHorn} position={[0.19, 0.82, 0.72]} />
      <mesh geometry={GEOMETRY.cowLeg} material={MATERIALS.cow} position={[-0.3, 0.25 + phase, -0.22]} />
      <mesh geometry={GEOMETRY.cowLeg} material={MATERIALS.cow} position={[0.3, 0.25 - phase, -0.22]} />
      <mesh geometry={GEOMETRY.cowLeg} material={MATERIALS.cow} position={[-0.3, 0.25 - phase, 0.22]} />
      <mesh geometry={GEOMETRY.cowLeg} material={MATERIALS.cow} position={[0.3, 0.25 + phase, 0.22]} />
    </>
  );
}

function SheepMesh({ phase }: { phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.sheepBody} material={MATERIALS.sheepWool} position={[0, 0.54, 0]} />
      <mesh geometry={GEOMETRY.sheepHead} material={MATERIALS.sheepFace} position={[0, 0.53, 0.48]} />
      <mesh geometry={GEOMETRY.sheepLeg} material={MATERIALS.sheepFace} position={[-0.25, 0.19 + phase, -0.2]} />
      <mesh geometry={GEOMETRY.sheepLeg} material={MATERIALS.sheepFace} position={[0.25, 0.19 - phase, -0.2]} />
      <mesh geometry={GEOMETRY.sheepLeg} material={MATERIALS.sheepFace} position={[-0.25, 0.19 - phase, 0.2]} />
      <mesh geometry={GEOMETRY.sheepLeg} material={MATERIALS.sheepFace} position={[0.25, 0.19 + phase, 0.2]} />
    </>
  );
}

function ChickenMesh({ phase }: { phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.chickenBody} material={MATERIALS.chickenBody} position={[0, 0.34, 0]} />
      <mesh geometry={GEOMETRY.chickenHead} material={MATERIALS.chickenBody} position={[0, 0.58, 0.22]} />
      <mesh geometry={GEOMETRY.beak} material={MATERIALS.chickenBeak} position={[0, 0.54, 0.36]} />
      <mesh geometry={GEOMETRY.comb} material={MATERIALS.chickenAccent} position={[0, 0.73, 0.22]} />
      <mesh geometry={GEOMETRY.chickenWing} material={MATERIALS.chickenBody} position={[-0.25, 0.35, 0]} />
      <mesh geometry={GEOMETRY.chickenWing} material={MATERIALS.chickenBody} position={[0.25, 0.35, 0]} />
      <mesh geometry={GEOMETRY.chickenLeg} material={MATERIALS.chickenBeak} position={[-0.1, 0.11 + phase, 0.02]} />
      <mesh geometry={GEOMETRY.chickenLeg} material={MATERIALS.chickenBeak} position={[0.1, 0.11 - phase, 0.02]} />
    </>
  );
}

function HumanoidMesh({ material, phase }: { material: THREE.Material; phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.humanoidBody} material={material} position={[0, 0.95, 0]} />
      <mesh geometry={GEOMETRY.humanoidHead} material={material} position={[0, 1.5, 0]} />
      <mesh geometry={GEOMETRY.humanoidArm} material={material} position={[-0.32, 0.95 + phase, 0]} />
      <mesh geometry={GEOMETRY.humanoidArm} material={material} position={[0.32, 0.95 - phase, 0]} />
      <mesh geometry={GEOMETRY.humanoidLeg} material={material} position={[-0.14, 0.31 + phase, 0]} />
      <mesh geometry={GEOMETRY.humanoidLeg} material={material} position={[0.14, 0.31 - phase, 0]} />
    </>
  );
}

function CreeperMesh({ phase }: { phase: number }) {
  return (
    <>
      <mesh geometry={GEOMETRY.creeperBody} material={MATERIALS.creeper} position={[0, 0.83, 0]} />
      <mesh geometry={GEOMETRY.creeperHead} material={MATERIALS.creeper} position={[0, 1.55, 0]} />
      <mesh geometry={GEOMETRY.creeperLeg} material={MATERIALS.creeper} position={[-0.18, 0.16 + phase, -0.12]} />
      <mesh geometry={GEOMETRY.creeperLeg} material={MATERIALS.creeper} position={[0.18, 0.16 - phase, -0.12]} />
      <mesh geometry={GEOMETRY.creeperLeg} material={MATERIALS.creeper} position={[-0.18, 0.16 - phase, 0.12]} />
      <mesh geometry={GEOMETRY.creeperLeg} material={MATERIALS.creeper} position={[0.18, 0.16 + phase, 0.12]} />
    </>
  );
}
