import { Mob, MobType } from './Mob';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';
import { useDroppedItemStore } from '@/components/DroppedItems';

// ─────────────────────────────────────────────────────────────────────────────
// Combat Profiles
// ─────────────────────────────────────────────────────────────────────────────
export enum CombatType {
  MELEE = 'melee',
  RANGED = 'ranged',
  EXPLOSIVE = 'explosive',
}

export interface CombatProfile {
  type: CombatType;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  knockback: number;
  fuseTime?: number;
  explosionRadius?: number;
}

export const COMBAT_PROFILES: Record<string, CombatProfile> = {
  zombie: {
    type: CombatType.MELEE,
    damage: 3,
    attackRange: 2,
    attackCooldown: 0.8,
    knockback: 0.5,
  },
  skeleton: {
    type: CombatType.RANGED,
    damage: 2,
    attackRange: 16,
    attackCooldown: 1.5,
    knockback: 0.2,
  },
  creeper: {
    type: CombatType.EXPLOSIVE,
    damage: 0,
    attackRange: 1.5,
    attackCooldown: 0,
    knockback: 0,
    fuseTime: 1.5,
    explosionRadius: 3,
  },
  spider: {
    type: CombatType.MELEE,
    damage: 2,
    attackRange: 2,
    attackCooldown: 0.6,
    knockback: 0.4,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Hostile Mob with Better Combat
// ─────────────────────────────────────────────────────────────────────────────
export class EnhancedHostileMob extends Mob {
  combatProfile: CombatProfile;
  
  // Extended state tracking
  lastAggroTime: number = 0;
  attackChargeTime: number = 0;
  targetMemoryTime: number = 0;
  lastKnownX: number = 0;
  lastKnownY: number = 0;
  lastKnownZ: number = 0;
  
  // Stuck detection
  stuckTime: number = 0;
  lastX: number = 0;
  lastZ: number = 0;
  
  // Sun burning
  protected burnsInSun: boolean = false;
  protected burnTick: number = 0;
  
  constructor(
    type: string,
    mobType: MobType,
    x: number, 
    y: number, 
    z: number,
    profile: CombatProfile
  ) {
    super(type, mobType, x, y, z);
    this.combatProfile = profile;
    
    // Apply profile
    this.attackDamage = profile.damage;
    this.attackCooldown = profile.attackCooldown;
    this.attackRange = profile.attackRange;
    this.detectionRange = 24;
    this.followRange = 32;
    
    this.lastX = x;
    this.lastZ = z;
    
    // Zombies and skeletons burn in sun
    if (type === 'zombie' || type === 'skeleton') {
      this.burnsInSun = true;
    }
  }

  update(delta: number): void {
    if (this.isDead) return;

    // Run base update (movement, physics)
    super.update(delta);
    
    // Enhanced hostile AI
    this.runEnhancedAI(delta);
    
    // Stuck detection
    this.checkStuck(delta);
    
    // Sun burning
    if (this.burnsInSun) {
      this.handleSunBurning(delta);
    }
  }

  protected runEnhancedAI(delta: number): void {
    const player = usePlayerStore.getState();
    const playerPos = player.position;
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    // Line of sight check
    const canSee = distance <= this.detectionRange && this.canSee(playerPos.x, playerPos.y, playerPos.z);
    
    // Track target
    if (canSee) {
      this.lastAggroTime = this.age;
      this.targetMemoryTime = 10;
      this.lastKnownX = playerPos.x;
      this.lastKnownY = playerPos.y;
      this.lastKnownZ = playerPos.z;
    }
    
    // Determine behavior based on state
    let targetX: number | null = null;
    let targetZ: number | null = null;
    let hasTarget = false;
    
    if (canSee) {
      hasTarget = true;
      if (distance <= this.attackRange) {
        // Attack state
        this.aiState = 'attack';
        this.attemptAttack(delta, playerPos);
      } else {
        // Chase state
        this.aiState = 'follow';
        targetX = playerPos.x;
        targetZ = playerPos.z;
      }
    } else if (this.targetMemoryTime > 0 && this.lastAggroTime > this.age - 20) {
      // Go to last known position
      hasTarget = true;
      this.aiState = 'follow';
      this.targetMemoryTime -= delta;
      targetX = this.lastKnownX;
      targetZ = this.lastKnownZ;
      
      // Reached last known?
      const distToLast = Math.sqrt(
        Math.pow(targetX - this.position.x, 2) + 
        Math.pow(targetZ - this.position.z, 2)
      );
      if (distToLast < 2) {
        this.targetMemoryTime = 0;
        this.aiState = 'idle';
      }
    } else {
      // No target - wander
      if (this.aiState === 'follow' || this.aiState === 'attack') {
        this.aiState = 'idle';
      }
      
      if (this.aiState === 'idle' && Math.random() < 0.01) {
        this.aiState = 'wander';
        this.targetX = this.position.x + (Math.random() - 0.5) * 16;
        this.targetZ = this.position.z + (Math.random() - 0.5) * 16;
      }
    }
    
    // Update movement target
    this.targetX = targetX;
    this.targetZ = targetZ;
  }

  protected attemptAttack(delta: number, playerPos: { x: number; y: number; z: number }): void {
    const now = Date.now() / 1000;
    const timeSinceLastAttack = now - this.lastAttackTime;
    
    if (timeSinceLastAttack >= this.attackCooldown) {
      // Execute attack based on type
      switch (this.combatProfile.type) {
        case CombatType.MELEE:
          this.performMeleeAttack(playerPos);
          break;
        case CombatType.EXPLOSIVE:
          this.handleCreeperBehavior(delta, playerPos);
          break;
        case CombatType.RANGED:
          // Skeleton shooting would go here
          this.performMeleeAttack(playerPos); // Fallback
          break;
      }
      
      this.lastAttackTime = now;
    }
  }

  protected performMeleeAttack(playerPos: { x: number; y: number; z: number }): void {
    const player = usePlayerStore.getState();
    
    // Check still in range
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    if (distance <= this.attackRange) {
      // Apply damage
      player.damage(this.attackDamage);
      
      // Apply knockback
      if (this.combatProfile.knockback > 0) {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 0 && player.setVelocity) {
          const kb = this.combatProfile.knockback * 4;
          player.setVelocity({
            x: (dx / dist) * kb,
            y: 3,
            z: (dz / dist) * kb
          });
        }
      }
    }
  }

  protected handleCreeperBehavior(delta: number, playerPos: { x: number; y: number; z: number }): void {
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    if (distance <= 2) {
      // Close enough - explode!
      this.explode();
    } else if (distance <= 4) {
      // Start fuse if close
      this.attackChargeTime += delta;
      if (this.attackChargeTime >= (this.combatProfile.fuseTime || 1.5)) {
        // Too far, stop charging
        this.attackChargeTime = 0;
        this.aiState = 'follow';
      }
    }
  }

  protected explode(): void {
    if (this.isDead) return;
    
    const player = usePlayerStore.getState();
    const playerPos = player.position;
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    const radius = this.combatProfile.explosionRadius || 3;
    
    // Damage player
    if (distance <= radius + 2) {
      const dmg = Math.max(1, Math.floor((radius + 2 - distance) * 4));
      player.damage(dmg);
    }
    
    // Destroy blocks
    const world = useWorldStore.getState();
    const ex = Math.floor(this.position.x);
    const ey = Math.floor(this.position.y);
    const ez = Math.floor(this.position.z);
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist <= radius && Math.random() < 0.3) {
            const bx = ex + dx, by = ey + dy, bz = ez + dz;
            if (world.getBlock(bx, by, bz) !== BlockType.BEDROCK) {
              world.setBlock(bx, by, bz, BlockType.AIR);
            }
          }
        }
      }
    }
    
    this.die();
  }

  protected checkStuck(delta: number): void {
    const movedX = Math.abs(this.position.x - this.lastX);
    const movedZ = Math.abs(this.position.z - this.lastZ);
    
    if (movedX < 0.1 && movedZ < 0.1) {
      this.stuckTime += delta;
      if (this.stuckTime > 2 && this.isOnGround && this.jumpCooldown <= 0) {
        // Jump to get unstuck
        this.velocity.y = 7;
        this.jumpCooldown = 1;
        this.stuckTime = 0;
      }
    } else {
      this.stuckTime = 0;
    }
    
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
  }

  protected handleSunBurning(delta: number): void {
    // Check if in sunlight (no blocks above)
    const world = useWorldStore.getState();
    const x = Math.floor(this.position.x);
    const y = Math.floor(this.position.y + this.height);
    const z = Math.floor(this.position.z);
    
    let exposedToSun = true;
    for (let checkY = y; checkY < 128; checkY++) {
      if (world.getBlock(x, checkY, z) !== BlockType.AIR) {
        exposedToSun = false;
        break;
      }
    }
    
    // Check if night (simplified - would check game time)
    const isNight = this.age % 24000 > 12000; // Rough check
    
    if (exposedToSun && !isNight) {
      this.burnTick += delta;
      if (this.burnTick > 4) {
        this.damage(1);
        this.burnTick = 0;
      }
    } else {
      this.burnTick = 0;
    }
  }

  // Override damage to become hostile when hurt
  damage(amount: number): void {
    super.damage(amount);
    
    if (this.isDead) return;
    
    // Aggro on damage
    const player = usePlayerStore.getState();
    this.lastAggroTime = this.age;
    this.targetMemoryTime = 8;
    this.lastKnownX = player.position.x;
    this.lastKnownY = player.position.y;
    this.lastKnownZ = player.position.z;
    this.aiState = 'follow';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn System
// ─────────────────────────────────────────────────────────────────────────────
export interface SpawnConditions {
  minLight: number;
  maxLight: number;
  minDistance: number;
  maxDistance: number;
  minPlayerDist: number;
}

export const SPAWN_CONDITIONS: Record<string, SpawnConditions> = {
  zombie: { minLight: 0, maxLight: 7, minDistance: 24, maxDistance: 64, minPlayerDist: 8 },
  skeleton: { minLight: 0, maxLight: 7, minDistance: 24, maxDistance: 64, minPlayerDist: 8 },
  creeper: { minLight: 0, maxLight: 7, minDistance: 24, maxDistance: 64, minPlayerDist: 8 },
  spider: { minLight: 0, maxLight: 7, minDistance: 16, maxDistance: 48, minPlayerDist: 8 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty Scaling
// ─────────────────────────────────────────────────────────────────────────────
export function getDifficultyMultiplier(dayCount: number): number {
  return Math.min(1 + dayCount * 0.05, 4);
}

export function applyDifficulty(mob: EnhancedHostileMob, dayCount: number): void {
  const mult = getDifficultyMultiplier(dayCount);
  mob.health = Math.floor(mob.maxHealth * mult);
  mob.maxHealth = mob.health;
  mob.attackDamage = Math.floor(mob.attackDamage * mult);
}