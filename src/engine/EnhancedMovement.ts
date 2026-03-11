import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore } from '@/stores/gameStore';
import { BlockType, isLiquid } from '@/data/blocks';
import {
  MOVEMENT_ACCELERATION,
  MOVEMENT_DECELERATION,
  AIR_CONTROL,
  WATER_CONTROL,
  ROTATION_SMOOTHING,
  PLAYER_SWIM_SPEED,
  PLAYER_SWIM_VERTICAL_SPEED,
} from '@/utils/constants';
import { applyPhysics } from './Physics';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
  up: boolean;
  down: boolean;
}

export class EnhancedMovement {
  private lastTime = 0;

  update(delta: number, input: MovementInput, mouseX: number, mouseY: number) {
    const playerStore = usePlayerStore.getState();
    const worldStore = useWorldStore.getState();
    const gameStore = useGameStore.getState();

    if (gameStore.gameState !== 'playing') return;

    const { position, velocity, isOnGround, isInWater, isFlying } = playerStore;
    const { x, y, z } = position;
    const { x: vx, y: vy, z: vz } = velocity;

    // Always read the LATEST rotation — after mouse look was applied this frame in Player.tsx
    const { yaw } = usePlayerStore.getState().rotation;

    // Update swimming state
    const feetBlock = worldStore.getBlock(Math.floor(x), Math.floor(y + 0.1), Math.floor(z));
    const centerBlock = worldStore.getBlock(Math.floor(x), Math.floor(y + 1.5), Math.floor(z));
    const isSwimming = feetBlock === BlockType.WATER || centerBlock === BlockType.WATER;

    playerStore.setSwimming(isSwimming);
    playerStore.setInWater(isSwimming);

    // Calculate movement direction
    const speed = playerStore.getMovementSpeed();

    let targetVx = 0;
    let targetVz = 0;
    const targetVy = vy;

    // Camera uses: camera.rotation.y = -yaw  (YXZ order)
    // So the world-space forward direction (into screen at yaw=0) is +Z
    // Verified per axis:
    //   yaw=0   → forward=(0,0,1),  right=(1,0,0)
    //   yaw=π/2 → forward=(-1,0,0), right=(0,0,1)  (turned left 90°)
    const forwardX =  Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX   =  Math.cos(yaw);
    const rightZ   =  Math.sin(yaw);

    if (input.forward)  { targetVx += forwardX; targetVz += forwardZ; }
    if (input.backward) { targetVx -= forwardX; targetVz -= forwardZ; }
    if (input.right)    { targetVx += rightX;   targetVz += rightZ;   }
    if (input.left)     { targetVx -= rightX;   targetVz -= rightZ;   }

    // Normalize and scale to speed
    const length = Math.sqrt(targetVx * targetVx + targetVz * targetVz);
    if (length > 0) {
      targetVx = (targetVx / length) * speed;
      targetVz = (targetVz / length) * speed;
    }

    // Acceleration / deceleration
    const controlFactor = isSwimming ? WATER_CONTROL : (isOnGround ? 1.0 : AIR_CONTROL);
    const accel = MOVEMENT_ACCELERATION * controlFactor;
    const decel = MOVEMENT_DECELERATION * controlFactor;

    let newVx = vx;
    let newVz = vz;

    if (Math.abs(targetVx) > 0.001 || Math.abs(targetVz) > 0.001) {
      const dx = targetVx - vx;
      const dz = targetVz - vz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.001) {
        const move = Math.min(dist, accel * delta);
        newVx += (dx / dist) * move;
        newVz += (dz / dist) * move;
      } else {
        newVx = targetVx;
        newVz = targetVz;
      }
    } else {
      const decelAmount = decel * delta;
      if (Math.abs(newVx) < decelAmount) newVx = 0;
      else newVx += (newVx > 0 ? -1 : 1) * decelAmount;

      if (Math.abs(newVz) < decelAmount) newVz = 0;
      else newVz += (newVz > 0 ? -1 : 1) * decelAmount;
    }

    // Prevent getting stuck on first frame of input
    if (
      (input.forward || input.backward || input.left || input.right) &&
      Math.abs(newVx) < 0.01 && Math.abs(newVz) < 0.01
    ) {
      newVx = targetVx;
      newVz = targetVz;
    }

    // Sprint / sneak state
    if (input.sprint && !isSwimming) {
      playerStore.setSprinting(true);
      playerStore.setSneaking(false);
    } else if (input.sneak) {
      playerStore.setSneaking(true);
      playerStore.setSprinting(false);
    } else {
      playerStore.setSprinting(false);
      playerStore.setSneaking(false);
    }

    // Only set velocity — Player.tsx owns physics + position updates
    playerStore.setVelocity({ x: newVx, y: targetVy, z: newVz });
  }

  reset() {
    this.lastTime = 0;
  }
}

export const enhancedMovement = new EnhancedMovement();