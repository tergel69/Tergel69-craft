'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore } from '@/stores/gameStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { ItemType } from '@/data/items';
import { BlockType } from '@/data/blocks';
import { ITEMS } from '@/data/items';

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
  const armLeftRef = useRef<THREE.Mesh>(null);
  const armRightRef = useRef<THREE.Group>(null);
  
  // Animation state
  const animationTime = useRef(0);
  const isMoving = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0, z: 0 });
  
  // Get player state for animation - use refs to avoid re-renders
  const positionRef = useRef({ x: 0, y: 0, z: 0 });
  const velocityRef = useRef({ x: 0, y: 0, z: 0 });
  
  useFrame((_, delta) => {
    if (!groupRef.current || !armLeftRef.current || !armRightRef.current) return;
    
    // Get current position from store
    const currentPos = usePlayerStore.getState().position;
    const currentVel = usePlayerStore.getState().velocity;
    
    // Update hand position relative to camera
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
    
    // Calculate movement for animation
    const dx = currentPos.x - lastPosition.current.x;
    const dz = currentPos.z - lastPosition.current.z;
    const movementSpeed = Math.sqrt(dx * dx + dz * dz);
    
    isMoving.current = movementSpeed > 0.01;
    lastPosition.current = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
    
    // Update animation time
    animationTime.current += delta * (isMoving.current ? 8 : 2);
    
    // Idle breathing animation
    const breathOffset = Math.sin(animationTime.current * 0.5) * 0.02;
    
    // Walking animation parameters
    const walkCycle = isMoving.current ? Math.sin(animationTime.current) * 0.4 : 0;
    
    // Left arm (off-hand) animation
    armLeftRef.current.position.set(-0.35, -0.25 - breathOffset, -0.4);
    armLeftRef.current.rotation.set(
      0.1 + walkCycle * 0.5,
      0.1 + walkCycle * 0.3,
      0.15
    );
    
    // Right arm (main hand) animation
    armRightRef.current.position.set(0.35, -0.25 - breathOffset, -0.4);
    armRightRef.current.rotation.set(
      -0.1 - walkCycle * 0.5,
      -0.1 - walkCycle * 0.3,
      -0.15
    );
  });

  return (
    <group ref={groupRef}>
      {/* Left arm (off-hand) */}
      <mesh ref={armLeftRef} position={[-0.35, -0.25, -0.4]}>
        <boxGeometry args={[0.08, 0.25, 0.08]} />
        <meshStandardMaterial 
          color="#C4A77D" 
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      {/* Right arm (main hand) */}
      <group ref={armRightRef} position={[0.35, -0.25, -0.4]}>
        {/* Arm */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.25, 0.08]} />
          <meshStandardMaterial 
            color="#C4A77D" 
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
        
        {/* Item slot indicator - shows when holding something */}
        <mesh position={[0, -0.15, -0.1]} visible={false}>
          <boxGeometry args={[0.06, 0.3, 0.06]} />
          <meshStandardMaterial 
            color="#8B4513"
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

// (no extra exported types)

