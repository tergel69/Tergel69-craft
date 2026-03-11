'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore } from '@/stores/gameStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { ItemType, ITEMS } from '@/data/items';
import { BlockType } from '@/data/blocks';

export default function PlayerModel() {
  const cameraMode = useGameStore((s) => s.cameraMode);

  return (
    <>
      {cameraMode === 'firstPerson' ? <FirstPersonHands /> : <ThirdPersonAvatar />}
    </>
  );
}

function ThirdPersonAvatar() {
  const position = usePlayerStore((s) => s.position);
  const rotation = usePlayerStore((s) => s.rotation);
  const armor = useInventoryStore((s) => s.armor);

  const armorColors = useMemo(() => {
    const getColor = (it: BlockType | ItemType | null) => {
      if (!it || typeof it !== 'string') return null;
      return ITEMS[it]?.color ?? null;
    };
    return {
      helmet: getColor(armor.helmet.item),
      chestplate: getColor(armor.chestplate.item),
      leggings: getColor(armor.leggings.item),
      boots: getColor(armor.boots.item),
    };
  }, [armor]);

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotation.yaw, 0]}>
      {/* Body */}
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.35]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.9} />
      </mesh>

      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 1.55, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#F2C9A0" roughness={0.9} />
      </mesh>

      {/* Arms */}
      <mesh castShadow receiveShadow position={[-0.55, 0.95, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.55, 0.95, 0]}>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.9} />
      </mesh>

      {/* Legs */}
      <mesh castShadow receiveShadow position={[-0.2, 0.35, 0]}>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        <meshStandardMaterial color="#1F2937" roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.2, 0.35, 0]}>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        <meshStandardMaterial color="#1F2937" roughness={0.95} />
      </mesh>

      {/* Armor overlays (simple) */}
      {armorColors.helmet && (
        <mesh castShadow receiveShadow position={[0, 1.55, 0]}>
          <boxGeometry args={[0.66, 0.66, 0.66]} />
          <meshStandardMaterial color={armorColors.helmet} roughness={0.6} metalness={0.1} />
        </mesh>
      )}
      {armorColors.chestplate && (
        <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
          <boxGeometry args={[0.76, 0.96, 0.42]} />
          <meshStandardMaterial color={armorColors.chestplate} roughness={0.6} metalness={0.1} />
        </mesh>
      )}
      {(armorColors.leggings || armorColors.boots) && (
        <group>
          {armorColors.leggings && (
            <>
              <mesh castShadow receiveShadow position={[-0.2, 0.35, 0]}>
                <boxGeometry args={[0.32, 0.74, 0.32]} />
                <meshStandardMaterial color={armorColors.leggings} roughness={0.6} metalness={0.1} />
              </mesh>
              <mesh castShadow receiveShadow position={[0.2, 0.35, 0]}>
                <boxGeometry args={[0.32, 0.74, 0.32]} />
                <meshStandardMaterial color={armorColors.leggings} roughness={0.6} metalness={0.1} />
              </mesh>
            </>
          )}
          {armorColors.boots && (
            <>
              <mesh castShadow receiveShadow position={[-0.2, 0.05, 0]}>
                <boxGeometry args={[0.34, 0.18, 0.34]} />
                <meshStandardMaterial color={armorColors.boots} roughness={0.6} metalness={0.1} />
              </mesh>
              <mesh castShadow receiveShadow position={[0.2, 0.05, 0]}>
                <boxGeometry args={[0.34, 0.18, 0.34]} />
                <meshStandardMaterial color={armorColors.boots} roughness={0.6} metalness={0.1} />
              </mesh>
            </>
          )}
        </group>
      )}
    </group>
  );
}

function FirstPersonHands() {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  // Don't render anything in first person to prevent visual artifacts
  return null;
}

// (no extra exported types)

