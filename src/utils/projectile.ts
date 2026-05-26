import { create } from 'zustand';
import { unifiedEntityManager as entityManager } from '@/entities/UnifiedEntityManager';
import { BlockType, isSolid } from '@/data/blocks';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { getMobXp, useXpStore } from '@/utils/experience';

export interface Projectile {
  id: string;
  type: 'arrow' | 'trident' | 'snowball' | 'egg' | 'ender_pearl';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  shooterId: string;
  damage: number;
  age: number;
  collected: boolean;
  fromBow: boolean;
}

interface ProjectileStore {
  projectiles: Projectile[];
  shoot: (
    type: Projectile['type'],
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    damage: number,
    fromBow: boolean
  ) => void;
  update: (delta: number) => void;
  clearCollected: () => void;
}

let nextProjectileId = 0;

export const useProjectileStore = create<ProjectileStore>((set) => ({
  projectiles: [],

  shoot(type, x, y, z, vx, vy, vz, damage, fromBow = true) {
    set((state) => ({
      projectiles: [
        ...state.projectiles,
        {
          id: `proj_${++nextProjectileId}`,
          type,
          x,
          y,
          z,
          vx,
          vy,
          vz,
          shooterId: 'player',
          damage,
          age: 0,
          collected: false,
          fromBow,
        },
      ],
    }));
  },

  update(delta) {
    set((state) => {
      const world = useWorldStore.getState();
      const GRAVITY = 28;
      const DRAG = 0.99;

      return {
        projectiles: state.projectiles.map((projectile) => {
          if (projectile.collected) return projectile;

          const next = { ...projectile, age: projectile.age + delta };

          if (next.age > 60 || Math.abs(next.x) + Math.abs(next.z) > 200) {
            next.collected = true;
            return next;
          }

          const gravityMultiplier = next.fromBow ? 0.6 : 1;
          next.vy -= GRAVITY * gravityMultiplier * delta;
          next.vx *= DRAG;
          next.vy *= DRAG;
          next.vz *= DRAG;

          const targetX = next.x + next.vx * delta;
          const targetY = next.y + next.vy * delta;
          const targetZ = next.z + next.vz * delta;

          const blockX = Math.floor(targetX);
          const blockY = Math.floor(targetY + 0.1);
          const blockZ = Math.floor(targetZ);
          const block = world.getBlock(blockX, blockY, blockZ);

          if (block !== BlockType.AIR && isSolid(block)) {
            next.collected = true;
            return next;
          }

          next.x = targetX;
          next.y = Math.max(0, targetY);
          next.z = targetZ;

          const entities = entityManager.getEntitiesInRange(next.x, next.y, next.z, 1.25);
          for (const entity of entities) {
            if (entity.isDead) continue;

            const centerY = entity.position.y + entity.height * 0.5;
            const dx = entity.position.x - next.x;
            const dy = centerY - next.y;
            const dz = entity.position.z - next.z;
            if (dx * dx + dy * dy + dz * dz > 1.25 * 1.25) continue;

            const wasDead = entity.isDead;
            entity.damage(next.damage);
            if (!wasDead && entity.isDead) {
              const xp = getMobXp(entity.type);
              if (xp > 0) {
                useXpStore.getState().spawnOrbs(
                  xp,
                  entity.position.x,
                  centerY,
                  entity.position.z
                );
              }
            }

            next.collected = true;
            return next;
          }

          return next;
        }),
      };
    });
  },

  clearCollected() {
    set((state) => ({
      projectiles: state.projectiles.filter((projectile) => !projectile.collected),
    }));
  },
}));

export function getArrowVelocity(charge: number): { vx: number; vy: number; vz: number } {
  const speed = 15 + charge * 35;
  const { yaw, pitch } = usePlayerStore.getState().rotation;
  return {
    vx: -Math.sin(yaw) * Math.cos(pitch) * speed,
    vy: -Math.sin(pitch) * speed,
    vz: Math.cos(yaw) * Math.cos(pitch) * speed,
  };
}
