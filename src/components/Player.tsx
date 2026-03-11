'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore, getSelectedBlockType, getSelectedItem } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useMouse } from '@/hooks/useMouse';
import { useKeyboard, useNumberKeys } from '@/hooks/useKeyboard';
import { applyPhysics, canJump, getJumpVelocity } from '@/engine/Physics';
import { BlockType } from '@/data/blocks';
import { getBreakTime, isUnbreakable } from '@/data/blockHardness';
import { useDroppedItemStore } from './DroppedItems';
import { useInventoryStore } from '@/stores/inventoryStore';
import { PLAYER_REACH } from '@/utils/constants';
import { entityManager } from '@/entities/EntityManager';
import { ITEMS } from '@/data/items';

const SPRINT_MULTIPLIER      = 1.6;
const SWIM_SPRINT_MULTIPLIER = 1.4;
const DOUBLE_TAP_WINDOW      = 300;
const PLACE_COOLDOWN         = 0.2;

// ── DDA voxel raycast ─────────────────────────────────────────────────────────
function voxelRaycast(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number
): { bx: number; by: number; bz: number; nx: number; ny: number; nz: number } | null {
  const worldStore = useWorldStore.getState();
  let bx = Math.floor(ox), by = Math.floor(oy), bz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tDX = Math.abs(1 / dx), tDY = Math.abs(1 / dy), tDZ = Math.abs(1 / dz);
  let tMaxX = dx !== 0 ? (dx > 0 ? bx+1-ox : ox-bx) * tDX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? by+1-oy : oy-by) * tDY : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? bz+1-oz : oz-bz) * tDZ : Infinity;
  let lastNx = 0, lastNy = 0, lastNz = 0, t = 0;

  while (t < maxDist) {
    const block = worldStore.getBlock(bx, by, bz);
    if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
      return { bx, by, bz, nx: lastNx, ny: lastNy, nz: lastNz };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      t = tMaxX; tMaxX += tDX; lastNx = -stepX; lastNy = 0; lastNz = 0; bx += stepX;
    } else if (tMaxY < tMaxZ) {
      t = tMaxY; tMaxY += tDY; lastNx = 0; lastNy = -stepY; lastNz = 0; by += stepY;
    } else {
      t = tMaxZ; tMaxZ += tDZ; lastNx = 0; lastNy = 0; lastNz = -stepZ; bz += stepZ;
    }
  }
  return null;
}

// ── Player ────────────────────────────────────────────────────────────────────
export default function Player() {
  const { camera } = useThree();
  const gameState        = useGameStore((s) => s.gameState);
  const gameMode         = useGameStore((s) => s.gameMode);
  const mouseSensitivity = useGameStore((s) => s.mouseSensitivity ?? 0.002);

  const { isLocked, requestPointerLock, consumeMovement, getButtons } = useMouse(mouseSensitivity);
  const keys = useKeyboard();

  const lastWPressTime = useRef(0);
  const wWasUp         = useRef(true);
  const isSprinting    = useRef(false);

  const posRef   = useRef(new THREE.Vector3());
  const velRef   = useRef(new THREE.Vector3());
  const yawRef   = useRef(0);
  const pitchRef = useRef(0);
  const onGround = useRef(false);
  const inWater  = useRef(false);
  const inLava   = useRef(false);
  const isFlying = useRef(gameMode === 'creative');

  const breakingRef   = useRef<{ bx:number; by:number; bz:number; progress:number; startTime:number } | null>(null);
  const lastPlaceTime = useRef(0);
  const hungerTickRef = useRef(0);
  const regenTickRef = useRef(0);
  const starvationTickRef = useRef(0);
  const fallDistanceRef = useRef(0);
  const lavaTickRef = useRef(0);
  const fireTickRef = useRef(0);
  const oxygenTickRef = useRef(0);

  // ── Hand animation refs ───────────────────────────────────────────────────
  const handRef       = useRef<THREE.Group>(null!);
  const swingProgress = useRef(0);
  const idlePhase     = useRef(0);

  // Hotbar selection
  const selectedSlot = usePlayerStore((s) => s.selectedSlot);
  const setSelectedSlot = usePlayerStore((s) => s.setSelectedSlot);

  // Handle hotbar selection
  useNumberKeys((slot) => {
    setSelectedSlot(slot);
  }, gameState === 'playing' && isLocked);

  // Reusable vectors for performance optimization
  const tempVector1 = useMemo(() => new THREE.Vector3(), []);
  const tempVector2 = useMemo(() => new THREE.Vector3(), []);
  const tempVector3 = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const pos = usePlayerStore.getState().position;
    posRef.current.set(pos.x, pos.y, pos.z);
    const rot = usePlayerStore.getState().rotation;
    yawRef.current   = rot.yaw;
    pitchRef.current = rot.pitch;
  }, []);

  useEffect(() => {
    const handleClick = () => {
      if (gameState === 'playing' && !isLocked) requestPointerLock();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [gameState, isLocked, requestPointerLock]);

  useFrame((_, delta) => {
    if (gameState !== 'playing' || !isLocked) return;

    const dt = Math.min(delta, 0.05);
    const playerState = usePlayerStore.getState();
    playerState.updateCooldowns(dt);

    // Mouse look
    const mouse = consumeMovement();
    yawRef.current   -= mouse.x;
    pitchRef.current  = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitchRef.current - mouse.y));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;

    // Sprint double-tap W
    const wDown = keys.current?.forward ?? false;
    if (wDown) {
      if (wWasUp.current) {
        const now = performance.now();
        if (now - lastWPressTime.current < DOUBLE_TAP_WINDOW) isSprinting.current = true;
        lastWPressTime.current = now;
        wWasUp.current = false;
      }
    } else {
      wWasUp.current = true;
      isSprinting.current = false;
    }
    if (keys.current?.sneak) isSprinting.current = false;
    if (gameMode === 'survival' && playerState.hunger <= 6) {
      isSprinting.current = false;
    }

    // Movement - reuse vectors to avoid garbage collection
    const fwd = tempVector1.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    const right = tempVector2.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
    const dir = tempVector3.set(0, 0, 0);
    
    if (keys.current?.forward)  dir.add(fwd);
    if (keys.current?.backward) dir.sub(fwd);
    if (keys.current?.right)    dir.add(right);
    if (keys.current?.left)     dir.sub(right);
    if (dir.lengthSq() > 0) dir.normalize();

    let speed = isFlying.current ? 10 : 4.3;
    if (isSprinting.current) speed *= inWater.current ? SWIM_SPRINT_MULTIPLIER : SPRINT_MULTIPLIER;
    if (keys.current?.sneak && !isFlying.current) speed *= 0.3;

    velRef.current.x = dir.x * speed;
    velRef.current.z = dir.z * speed;

    if (isFlying.current) {
      velRef.current.y = keys.current?.jump ? speed : keys.current?.sneak ? -speed : 0;
    }
    if (!isFlying.current && keys.current?.jump) {
      if (canJump(posRef.current.x, posRef.current.y, posRef.current.z, onGround.current, inWater.current)) {
        velRef.current.y = getJumpVelocity(inWater.current);
        if (inWater.current && isSprinting.current) velRef.current.y *= 1.3;
      }
    }

    const result = applyPhysics(
      posRef.current.x, posRef.current.y, posRef.current.z,
      velRef.current.x, velRef.current.y, velRef.current.z,
      dt, isFlying.current
    );
    posRef.current.set(result.x, result.y, result.z);
    velRef.current.set(result.vx, result.vy, result.vz);
    onGround.current = result.onGround;
    inWater.current  = result.inWater;
    inLava.current   = result.inLava;

    camera.position.set(result.x, result.y + 1.62, result.z);

    // Raycast
    const cosPitch = Math.cos(pitchRef.current);
    const ndx = -Math.sin(yawRef.current) * cosPitch;
    const ndy =  Math.sin(pitchRef.current);
    const ndz = -Math.cos(yawRef.current) * cosPitch;
    const len = Math.sqrt(ndx*ndx + ndy*ndy + ndz*ndz) || 1;
    const hit = voxelRaycast(result.x, result.y+1.62, result.z, ndx/len, ndy/len, ndz/len, PLAYER_REACH);

    const buttons  = getButtons();
    const storeFns = useGameStore.getState();
    const playerStore = usePlayerStore.getState();
    const curTime  = performance.now() / 1000;

    // Melee attack when not hitting a block
    if (buttons.left && !hit && playerState.attackCooldown <= 0) {
      const dir = new THREE.Vector3(ndx / len, ndy / len, ndz / len);
      const origin = new THREE.Vector3(result.x, result.y + 1.4, result.z);
      const entities = entityManager.getEntitiesInRange(result.x, result.y, result.z, 3.5);
      let best: { entity: any; dist: number } | null = null;
      for (const entity of entities) {
        if (entity.isDead) continue;
        const toEntity = new THREE.Vector3(entity.position.x - origin.x, (entity.position.y + entity.height * 0.6) - origin.y, entity.position.z - origin.z);
        const dist = toEntity.length();
        if (dist > 3.2) continue;
        toEntity.normalize();
        const facing = dir.dot(toEntity);
        if (facing < 0.6) continue;
        if (!best || dist < best.dist) best = { entity, dist };
      }
      if (best) {
        const held = getSelectedItem();
        const weaponDamage =
          typeof held === 'string' && ITEMS[held]?.attackDamage
            ? ITEMS[held].attackDamage
            : 1;
        best.entity.damage(weaponDamage);
        usePlayerStore.setState({ attackCooldown: 0.35 });
      }
    }

    // Breaking
    if (buttons.left && hit) {
      const { bx, by, bz } = hit;
      const targetBlock = useWorldStore.getState().getBlock(bx, by, bz);
      if (isUnbreakable(targetBlock)) {
        breakingRef.current = null;
        storeFns.setBreakingBlock(null);
      } else {
        const breakTime = getBreakTime(targetBlock);
        const prev = breakingRef.current;
        const same = prev && prev.bx === bx && prev.by === by && prev.bz === bz;
        if (!same) {
          breakingRef.current = { bx, by, bz, progress: 0, startTime: curTime };
        } else if (prev) {
          const progress = breakTime > 0 ? Math.min(1, (curTime - prev.startTime) / breakTime) : 1;
          breakingRef.current = { ...prev, progress };
          if (progress >= 1) {
            useWorldStore.getState().setBlock(bx, by, bz, BlockType.AIR);
            useDroppedItemStore.getState().spawnDrop(targetBlock, bx, by, bz);
            breakingRef.current = null;
            storeFns.setBreakingBlock(null);
          }
        }
        if (breakingRef.current) {
          const br = breakingRef.current;
          storeFns.setBreakingBlock({ x: br.bx, y: br.by, z: br.bz, progress: br.progress, nx: hit.nx, ny: hit.ny, nz: hit.nz });
        }
      }
    } else {
      if (breakingRef.current) { breakingRef.current = null; storeFns.setBreakingBlock(null); }
    }

    // Placement
    if (buttons.right && hit && curTime - lastPlaceTime.current > PLACE_COOLDOWN) {
      const { bx, by, bz, nx, ny, nz } = hit;
      const hitBlock = useWorldStore.getState().getBlock(bx, by, bz);

      // Open crafting table UI when right-clicking a crafting table
      if (hitBlock === BlockType.CRAFTING_TABLE) {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        storeFns.setGameState('crafting');
        lastPlaceTime.current = curTime;
        return;
      }

      const px = bx+nx, py = by+ny, pz = bz+nz;
      
      // Check if player is trying to place a block in their head space
      const playerHeadY = result.y + 1.8; // Player eye height + head
      const blockBottomY = py;
      const blockTopY = py + 1;
      
      // Head collision check: if the block would intersect with player head space
      const headCollision = blockBottomY < playerHeadY && blockTopY > result.y + 1.62;
      
      if (headCollision) {
        // Don't place block if it would intersect with player head
        return;
      }
      
      // Check if placement position is blocked by player body
      const pMinX = result.x-0.3, pMaxX = result.x+0.3;
      const pMinY = result.y,     pMaxY = result.y+1.8;
      const pMinZ = result.z-0.3, pMaxZ = result.z+0.3;
      const blocked = px+1>pMinX && px<pMaxX && py+1>pMinY && py<pMaxY && pz+1>pMinZ && pz<pMaxZ;
      
      if (!blocked) {
        // Get selected block from inventory
        const selectedBlock = getSelectedBlockType();
        
        if (selectedBlock !== null) {
          // Check if player has the block in inventory
          const inventoryStore = useInventoryStore.getState();
          const hasBlock = inventoryStore.hasItem(selectedBlock);
          
          if (hasBlock) {
            // Place the block
            useWorldStore.getState().setBlock(px, py, pz, selectedBlock);
            
            // Remove one block from inventory
            inventoryStore.removeItem(selectedBlock, 1);
            
            lastPlaceTime.current = curTime;
          }
        }
      }
    }

    // ── Hand animation ────────────────────────────────────────────────────
    if (handRef.current) {
      const swinging = (buttons.left && !!hit) || (buttons.right && !!hit);
      swingProgress.current = swinging
        ? Math.min(1, swingProgress.current + dt * 9)
        : Math.max(0, swingProgress.current - dt * 12);
      idlePhase.current += dt * 1.6;

      const swing    = Math.sin(swingProgress.current * Math.PI) * 0.55;
      const idleBob  = Math.sin(idlePhase.current) * 0.006;
      const idleRoll = Math.cos(idlePhase.current * 0.7) * 0.008;
      const moving   = !!(keys.current?.forward || keys.current?.backward || keys.current?.left || keys.current?.right);
      const wBob     = moving ? Math.sin(idlePhase.current * 2.4) * 0.022 : 0;

      handRef.current.position.set(0.27 + idleRoll, -0.22 + idleBob + wBob, -0.42);
      handRef.current.rotation.set(-0.12 - swing + idleBob * 3, -0.28 + idleRoll, 0.04 + wBob);
    }

    // Sync store
    usePlayerStore.setState({
      position:    { x: result.x,  y: result.y,  z: result.z },
      velocity:    { x: result.vx, y: result.vy, z: result.vz },
      rotation:    { yaw: yawRef.current, pitch: pitchRef.current },
      isOnGround:  result.onGround,
      isInWater:   result.inWater,
      isInLava:    result.inLava,
      isSprinting: isSprinting.current,
    });

    if (gameMode === 'survival') {
      // Fall damage
      if (!result.onGround && result.vy < -1) {
        fallDistanceRef.current += Math.abs(result.vy) * dt;
      }
      if (result.onGround && fallDistanceRef.current > 3) {
        const fallDamage = Math.floor((fallDistanceRef.current - 3) * 1.25);
        if (fallDamage > 0) playerStore.damage(fallDamage);
        fallDistanceRef.current = 0;
      }
      if (result.onGround) fallDistanceRef.current = 0;

      // Lava and fire damage over time
      if (result.inLava) {
        lavaTickRef.current += dt;
        if (lavaTickRef.current >= 0.4) {
          playerStore.damage(2);
          lavaTickRef.current = 0;
          fireTickRef.current = 2.5;
        }
      } else {
        lavaTickRef.current = 0;
      }

      if (fireTickRef.current > 0) {
        fireTickRef.current -= dt;
        if (fireTickRef.current <= 0) {
          fireTickRef.current = 0;
        } else {
          oxygenTickRef.current += dt;
          if (oxygenTickRef.current >= 1) {
            playerStore.damage(1);
            oxygenTickRef.current = 0;
          }
        }
      } else {
        oxygenTickRef.current = 0;
      }

      // Drowning
      if (result.inWater && !result.onGround) {
        const nextOxygen = Math.max(0, playerStore.oxygen - dt * 20);
        playerStore.setOxygen(nextOxygen);
        if (nextOxygen <= 0) {
          lavaTickRef.current += dt;
          if (lavaTickRef.current >= 1.2) {
            playerStore.damage(1);
            lavaTickRef.current = 0;
          }
        }
      } else {
        playerStore.setOxygen(Math.min(300, playerStore.oxygen + dt * 40));
      }
    }

    if (gameMode === 'survival') {
      const moving = dir.lengthSq() > 0;
      let hungerDrainPerSecond = 0.00035;
      if (moving) hungerDrainPerSecond += 0.0012;
      if (isSprinting.current) hungerDrainPerSecond += 0.0065;
      if (result.inWater) hungerDrainPerSecond += 0.0015;

      hungerTickRef.current += dt * hungerDrainPerSecond;
      if (hungerTickRef.current >= 0.08) {
        const state = usePlayerStore.getState();
        state.consumeHunger(hungerTickRef.current);
        hungerTickRef.current = 0;
      }

      const state = usePlayerStore.getState();
      if (state.hunger >= 18 && state.health < state.maxHealth) {
        regenTickRef.current += dt;
        if (regenTickRef.current >= 4) {
          state.heal(1);
          state.consumeHunger(0.6);
          regenTickRef.current = 0;
        }
      } else {
        regenTickRef.current = 0;
      }

      if (state.hunger <= 0) {
        starvationTickRef.current += dt;
        if (starvationTickRef.current >= 4) {
          state.damage(1);
          starvationTickRef.current = 0;
        }
      } else {
        starvationTickRef.current = 0;
      }
    }
  });

  return <FirstPersonHand handRef={handRef} />;
}

// ── First-person hand ─────────────────────────────────────────────────────────
function FirstPersonHand({ handRef }: { handRef: React.RefObject<THREE.Group> }) {
  const { camera } = useThree();
  const mountRef = useRef<THREE.Group>(null);

  // Keep mount group glued to camera every frame
  useFrame(() => {
    if (!mountRef.current) return;
    mountRef.current.position.copy(camera.position);
    mountRef.current.quaternion.copy(camera.quaternion);
  });

  const skinMat   = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: 0xF2C9A0, 
    roughness: 0.8,
    metalness: 0.1
  }), []);
  const sleeveMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: 0x3B82F6,
    roughness: 0.9,
    metalness: 0.1
  }), []);

  return (
    <group ref={mountRef}>
      {/* handRef is positioned by Player useFrame in camera-local space */}
      <group ref={handRef}>
        {/* Forearm */}
        <mesh position={[0, 0.04, -0.01]} material={sleeveMat} rotation={[0.08, 0.05, -0.12]}>
          <boxGeometry args={[0.14, 0.3, 0.16]} />
        </mesh>

        {/* Palm */}
        <mesh position={[0.01, -0.12, 0.05]} material={skinMat} rotation={[0.08, 0, -0.08]}>
          <boxGeometry args={[0.13, 0.12, 0.11]} />
        </mesh>

        {/* Index */}
        <mesh position={[-0.045, -0.19, 0.09]} material={skinMat} rotation={[0.18, 0.02, -0.06]}>
          <boxGeometry args={[0.024, 0.07, 0.03]} />
        </mesh>
        {/* Middle */}
        <mesh position={[-0.012, -0.2, 0.095]} material={skinMat} rotation={[0.16, 0, -0.04]}>
          <boxGeometry args={[0.024, 0.08, 0.03]} />
        </mesh>
        {/* Ring */}
        <mesh position={[0.02, -0.195, 0.09]} material={skinMat} rotation={[0.17, -0.01, -0.02]}>
          <boxGeometry args={[0.024, 0.074, 0.03]} />
        </mesh>
        {/* Pinky */}
        <mesh position={[0.05, -0.185, 0.082]} material={skinMat} rotation={[0.15, -0.02, 0]}>
          <boxGeometry args={[0.022, 0.062, 0.028]} />
        </mesh>

        {/* Thumb */}
        <mesh position={[-0.078, -0.13, 0.04]} material={skinMat} rotation={[0.08, 0.25, -0.65]}>
          <boxGeometry args={[0.03, 0.08, 0.034]} />
        </mesh>
      </group>
    </group>
  );
}
