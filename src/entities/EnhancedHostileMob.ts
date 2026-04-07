import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { useGameStore, getTimeOfDay } from '@/stores/gameStore';
import { useDroppedItemStore } from '@/components/DroppedItems';
import { BlockType, isSolid } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { Vector3 } from '@/utils/coordinates';
import {
  HostileMobState,
  MobBehaviorConfig,
  MOB_CONFIGS,
  getDifficultyMultiplier,
  hasLineOfSight,
  canMobSpawnHere,
  findPath,
  SpawnContext,
  MobDropConfig,
} from './MobBehaviorConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Hostile Mob - Standalone implementation
// ─────────────────────────────────────────────────────────────────────────────

export class EnhancedHostileMob {
  // Identity
  id: string;
  type: string;
  
  // Position and physics
  position: Vector3;
  rotation: { yaw: number; pitch: number };
  velocity: Vector3;
  
  // Health
  health: number;
  maxHealth: number;
  
  // Dimensions
  width: number;
  height: number;
  
  // State
  isOnGround: boolean = false;
  isDead: boolean = false;
  age: number = 0;
  
  // Behavior config
  config: MobBehaviorConfig;
  
  // State machine
  enhancedAiState: HostileMobState = 'idle';
  previousState: HostileMobState = 'idle';
  
  // Target tracking
  targetMemory: { x: number; y: number; z: number; time: number } | null = null;
  lastSeenPlayerTime: number = 0;
  targetX: number | null = null;
  targetZ: number | null = null;
  
  // Combat state
  isChargingAttack: boolean = false;
  chargeStartTime: number = 0;
  attackAnimationProgress: number = 0;
  lastAttackTime: number = 0;
  
  // Movement cooldowns
  wanderCooldown: number = 0;
  jumpCooldown: number = 0;
  
  // Stuck detection
  stuckCounter: number = 0;
  lastPosition: { x: number; z: number };
  
  // Creeper specific
  isIgnited: boolean = false;
  currentFuse: number = 0;

  // Pathing
  private pathNodes: { x: number; y: number; z: number }[] = [];
  private pathIndex: number = 0;
  private pathGoal: { x: number; y: number; z: number } | null = null;
  private pathCooldown: number = 0;
  
  // Burn tracking
  private burnTick: number = 0;
  
  // Drops
  drops: { item: BlockType | ItemType; count: [number, number]; chance: number }[];
  
  // Physics constants
  private static readonly PHYSICS_SUBSTEP = 1 / 30;
  private static readonly EPSILON = 0.001;
  
  constructor(
    type: string,
    x: number,
    y: number,
    z: number,
    config: MobBehaviorConfig
  ) {
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.position = { x, y, z };
    this.rotation = { yaw: Math.random() * Math.PI * 2, pitch: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.config = config;
    
    // Apply config
    this.health = config.health;
    this.maxHealth = config.maxHealth;
    this.width = config.width;
    this.height = config.height;
    
    // Setup drops
    this.drops = config.drops.map(d => ({
      item: d.item as unknown as BlockType | ItemType,
      count: d.count,
      chance: d.chance,
    }));
    
    this.lastPosition = { x, z };
  }

  update(delta: number): void {
    if (this.isDead) return;
    
    // Apply difficulty scaling (live update)
    const dayCount = useGameStore.getState().dayCount;
    const difficultyMult = getDifficultyMultiplier(dayCount);
    const actualHealth = Math.floor(this.config.health * difficultyMult);
    const actualDamage = Math.floor(this.config.combat.damage * difficultyMult);
    
    // Store previous position for stuck detection
    const prevX = this.position.x;
    const prevZ = this.position.z;
    
    // Run state machine
    this.runStateMachine(delta);
    
    // Handle environmental effects
    this.handleEnvironmentalEffects(delta);
    
    // Update physics
    this.updateMovement(delta);
    
    // Check if stuck
    this.checkStuck(delta, prevX, prevZ);
    
    // Update attack animation
    this.updateAttackAnimation(delta);
    
    // Age
    this.age++;
    
    // Reduce cooldowns
    if (this.wanderCooldown > 0) this.wanderCooldown -= delta;
    if (this.jumpCooldown > 0) this.jumpCooldown -= delta;
    if (this.pathCooldown > 0) this.pathCooldown -= delta;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State Machine
  // ─────────────────────────────────────────────────────────────────────────────

  private runStateMachine(delta: number): void {
    const player = usePlayerStore.getState();
    const playerPos = player.position;
    const distanceToPlayer = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    // Check line of sight
    const canSee = this.checkLineOfSight(playerPos);
    
    // Update target tracking
    if (canSee) {
      this.lastSeenPlayerTime = this.age;
      this.targetMemory = {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        time: this.age,
      };
    }
    
    // State transitions
    switch (this.enhancedAiState) {
      case 'idle':
        this.handleIdleState(distanceToPlayer, canSee, playerPos);
        break;
      case 'wander':
        this.handleWanderState(delta, distanceToPlayer, canSee);
        break;
      case 'chase':
        this.handleChaseState(delta, distanceToPlayer, canSee, playerPos);
        break;
      case 'attack':
        this.handleAttackState(delta, distanceToPlayer, canSee, playerPos);
        break;
      case 'retreat':
        this.handleRetreatState(delta, distanceToPlayer);
        break;
      case 'stuck':
        this.handleStuckState(delta, distanceToPlayer, canSee);
        break;
      case 'dead':
        break;
    }
  }

  private handleIdleState(
    distanceToPlayer: number,
    canSee: boolean,
    playerPos: { x: number; y: number; z: number }
  ): void {
    // Check if we should aggro
    if (distanceToPlayer <= this.config.detection.detectionRange && canSee) {
      this.enhancedAiState = 'chase';
      return;
    }
    
    // Check for target memory
    if (this.targetMemory && this.age - this.targetMemory.time < this.config.detection.memoryTime * 20) {
      this.enhancedAiState = 'chase';
      return;
    }
    
    // Random wandering
    if (Math.random() < 0.01 && this.wanderCooldown <= 0) {
      this.enhancedAiState = 'wander';
      this.targetX = this.position.x + (Math.random() - 0.5) * 16;
      this.targetZ = this.position.z + (Math.random() - 0.5) * 16;
      this.wanderCooldown = 3 + Math.random() * 4;
    }
  }

  private handleWanderState(
    delta: number,
    distanceToPlayer: number,
    canSee: boolean
  ): void {
    // Check for aggro
    if (distanceToPlayer <= this.config.detection.detectionRange && canSee) {
      this.enhancedAiState = 'chase';
      return;
    }
    
    // Check if reached wander target
    if (this.targetX !== null && this.targetZ !== null) {
      const dist = Math.sqrt(
        Math.pow(this.targetX - this.position.x, 2) +
        Math.pow(this.targetZ - this.position.z, 2)
      );
      if (dist < 1) {
        this.enhancedAiState = 'idle';
        this.targetX = null;
        this.targetZ = null;
        this.wanderCooldown = 2 + Math.random() * 3;
      }
    }
  }

  private handleChaseState(
    delta: number,
    distanceToPlayer: number,
    canSee: boolean,
    playerPos: { x: number; y: number; z: number }
  ): void {
    const attackRange = this.config.combat.attackRange;
    
    // Check for attack
    if (distanceToPlayer <= attackRange) {
      // For creepers, check if close enough to ignite
      if (this.type === 'creeper' && distanceToPlayer <= 3) {
        this.isIgnited = true;
      }
      this.enhancedAiState = 'attack';
      return;
    }
    
    // Skeleton flees if player too close
    if (this.type === 'skeleton' && distanceToPlayer < 6) {
      this.enhancedAiState = 'retreat';
      return;
    }
    
    // Check line of sight
    if (!canSee && this.targetMemory) {
      // Go to last known position with a light pathing pass so mobs feel less robotic.
      this.updatePathToGoal(this.targetMemory.x, this.targetMemory.y, this.targetMemory.z);
      this.followPath();
      
      const distToLastKnown = Math.sqrt(
        Math.pow(this.targetMemory.x - this.position.x, 2) +
        Math.pow(this.targetMemory.z - this.position.z, 2)
      );
      
      if (distToLastKnown < 2) {
        // Reached last known, search briefly then give up
        if (this.age - this.lastSeenPlayerTime > this.config.detection.deaggroDelay * 20) {
          this.clearPath();
          this.enhancedAiState = 'idle';
          this.targetMemory = null;
        }
      }
    } else if (canSee) {
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const nextX = this.position.x + (dx / Math.max(dist, 0.001)) * this.config.movement.baseSpeed * delta;
      const nextZ = this.position.z + (dz / Math.max(dist, 0.001)) * this.config.movement.baseSpeed * delta;
      
      if (dist > 0.1) {
        const speed = this.type === 'spider' ? this.config.movement.sprintSpeed : this.config.movement.baseSpeed;
        const blocked = this.isPathBlocked(nextX, nextZ);

        if (blocked || this.type === 'spider' || this.pathNodes.length > 0) {
          this.updatePathToGoal(playerPos.x, playerPos.y, playerPos.z);
          this.followPath();
          if (this.pathNodes.length === 0 && blocked && this.isOnGround && this.jumpCooldown <= 0 && this.config.movement.canJump) {
            this.velocity.y = this.config.movement.jumpVelocity;
            this.jumpCooldown = 1;
          }
        } else {
          this.clearPath();
          this.targetX = playerPos.x;
          this.targetZ = playerPos.z;
        }
      }
      
      // Face the player
      this.rotation.yaw = Math.atan2(-dx, dz);
    } else {
      // Lost sight, return to idle
      if (this.age - this.lastSeenPlayerTime > this.config.detection.deaggroDelay * 20) {
        this.enhancedAiState = 'idle';
      }
    }
  }

  private handleAttackState(
    delta: number,
    distanceToPlayer: number,
    canSee: boolean,
    playerPos: { x: number; y: number; z: number }
  ): void {
    if (distanceToPlayer > this.config.combat.attackRange * 1.5) {
      // Player moved out of range
      this.enhancedAiState = 'chase';
      return;
    }
    
    // Handle different combat types
    switch (this.config.combat.type) {
      case 'melee':
        this.handleMeleeAttack(delta, playerPos);
        break;
      case 'ranged':
        this.handleRangedAttack(delta, playerPos, canSee);
        break;
      case 'explosive':
        this.handleExplosiveBehavior(delta, distanceToPlayer, canSee);
        break;
    }
  }

  private handleRetreatState(delta: number, distanceToPlayer: number): void {
    // Stop retreating if far enough or if no longer threatened
    if (distanceToPlayer > 8 || this.health > this.maxHealth * 0.5) {
      this.enhancedAiState = this.lastSeenPlayerTime > this.age - 100 ? 'chase' : 'idle';
      this.clearPath();
      return;
    }
    
    // Move away from player
    const player = usePlayerStore.getState();
    const dx = this.position.x - player.position.x;
    const dz = this.position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > 0) {
      const awayX = this.position.x + (dx / dist) * 8;
      const awayZ = this.position.z + (dz / dist) * 8;
      this.updatePathToGoal(awayX, this.position.y, awayZ);
      this.followPath();
    }
  }

  private handleStuckState(delta: number, distanceToPlayer: number, canSee: boolean): void {
    // Try to get unstuck
    if (this.isOnGround && this.jumpCooldown <= 0) {
      this.velocity.y = this.config.movement.jumpVelocity;
      this.jumpCooldown = 1.5;
      this.stuckCounter = 0;
    }
    
    // Check if still stuck
    if (this.stuckCounter > 3) {
      // Give up and try to teleport or despawn
      this.enhancedAiState = 'idle';
      this.stuckCounter = 0;
    }
    
    // If player is nearby, try to chase
    if (distanceToPlayer <= this.config.detection.detectionRange && canSee) {
      this.enhancedAiState = 'chase';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Combat Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private handleMeleeAttack(delta: number, playerPos: { x: number; y: number; z: number }): void {
    // Face the player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    this.rotation.yaw = Math.atan2(-dx, dz);
    
    // Charge attack animation
    if (!this.isChargingAttack) {
      this.isChargingAttack = true;
      this.chargeStartTime = this.age;
    }
    
    this.attackAnimationProgress = Math.min(1, (this.age - this.chargeStartTime) / (this.config.combat.attackCooldown * 20));

    if (this.attackAnimationProgress < 0.72) return;
    
    // Execute attack when charged
    const now = Date.now() / 1000;
    if (now - this.lastAttackTime >= this.config.combat.attackCooldown) {
      this.performMeleeAttack(playerPos);
      this.lastAttackTime = now;
      this.isChargingAttack = false;
      this.attackAnimationProgress = 0;
    }
  }

  private performMeleeAttack(playerPos: { x: number; y: number; z: number }): void {
    const player = usePlayerStore.getState();
    
    // Check range again
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    if (distance > this.config.combat.attackRange) return;
    
    // Get difficulty-scaled damage
    const dayCount = useGameStore.getState().dayCount;
    const difficultyMult = getDifficultyMultiplier(dayCount);
    const damage = Math.floor(this.config.combat.damage * difficultyMult);
    
    // Apply damage
    player.damage(damage);
    
    // Apply knockback
    if (this.config.combat.knockback > 0) {
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      
      const knockbackX = (dx / dist) * this.config.combat.knockback;
      const knockbackZ = (dz / dist) * this.config.combat.knockback;
      const knockbackY = this.config.combat.knockbackY || 2;
      
      player.setVelocity({
        x: knockbackX,
        y: knockbackY,
        z: knockbackZ,
      });
    }
  }

  private handleRangedAttack(
    delta: number,
    playerPos: { x: number; y: number; z: number },
    canSee: boolean
  ): void {
    // Face the player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    this.rotation.yaw = Math.atan2(-dx, dz);
    
    // Charge bow animation
    if (!this.isChargingAttack) {
      this.isChargingAttack = true;
      this.chargeStartTime = this.age;
    }
    
    this.attackAnimationProgress = Math.min(1, (this.age - this.chargeStartTime) / (this.config.combat.attackCooldown * 20));

    if (this.attackAnimationProgress < 0.72) return;
    
    // Fire arrow when charged
    const now = Date.now() / 1000;
    if (now - this.lastAttackTime >= this.config.combat.attackCooldown) {
      this.fireArrow(playerPos, canSee);
      this.lastAttackTime = now;
      this.isChargingAttack = false;
      this.attackAnimationProgress = 0;
    }
  }

  private fireArrow(playerPos: { x: number; y: number; z: number }, canSee: boolean): void {
    if (!canSee) return;

    // Simplified arrow - damage player directly at range
    const player = usePlayerStore.getState();
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    // Get difficulty-scaled damage
    const dayCount = useGameStore.getState().dayCount;
    const difficultyMult = getDifficultyMultiplier(dayCount);
    let damage = Math.floor(this.config.combat.damage * difficultyMult);
    
    if (distance <= this.config.combat.attackRange) {
      // Apply damage with distance falloff
      if (distance > 10) {
        damage = Math.max(1, Math.floor(damage * 0.5));
      }
      player.damage(damage);
    }
  }

  private handleExplosiveBehavior(delta: number, distanceToPlayer: number, canSee: boolean): void {
    if (this.type !== 'creeper') return;
    
    const fuseTime = this.config.combat.fuseTime || 1.5;
    
    if (this.isIgnited) {
      this.currentFuse += delta;
      if (!canSee && distanceToPlayer > 5) {
        this.currentFuse = Math.max(0, this.currentFuse - delta * 0.35);
      }
      
      if (this.currentFuse >= fuseTime) {
        this.explode();
      }
    } else if (distanceToPlayer <= 3 && canSee) {
      // Start ignition when player is close
      this.isIgnited = true;
      this.currentFuse = 0;
    }
  }

  private explode(): void {
    const playerStore = usePlayerStore.getState();
    const playerPos = playerStore.position;
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    const radius = this.config.combat.explosionRadius || 3;
    const power = this.config.combat.explosionPower || 6;
    
    // Damage player
    if (distance < radius + 2) {
      const scale = Math.max(0, 1 - distance / (radius + 2));
      const damage = Math.ceil(power * scale * 3);
      playerStore.damage(damage);
      
      // Apply knockback
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      
      playerStore.setVelocity({
        x: (dx / dist) * power * scale,
        y: power * scale * 0.5,
        z: (dz / dist) * power * scale,
      });
    }
    
    // Destroy blocks if enabled
    if (this.config.combat.destroysBlocks) {
      const worldStore = useWorldStore.getState();
      const ex = Math.floor(this.position.x);
      const ey = Math.floor(this.position.y);
      const ez = Math.floor(this.position.z);
      
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist <= radius && Math.random() < 0.3) {
              const bx = ex + dx;
              const by = ey + dy;
              const bz = ez + dz;
              if (worldStore.getBlock(bx, by, bz) !== BlockType.BEDROCK) {
                worldStore.setBlock(bx, by, bz, BlockType.AIR);
              }
            }
          }
        }
      }
    }
    
    this.die();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Environmental Effects
  // ─────────────────────────────────────────────────────────────────────────────

  private handleEnvironmentalEffects(delta: number): void {
    // Sun burning
    if (this.config.environmental.burnsInSun) {
      this.handleSunBurning(delta);
    }
  }

  private handleSunBurning(delta: number): void {
    const worldTime = useGameStore.getState().worldTime;
    const timeOfDay = getTimeOfDay(worldTime);
    
    if (timeOfDay !== 'day') return;
    
    const worldStore = useWorldStore.getState();
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    
    // Check if exposed to sky
    let exposedToSun = true;
    for (let y = Math.floor(this.position.y + this.height); y < 128; y++) {
      if (worldStore.getBlock(x, y, z) !== BlockType.AIR) {
        exposedToSun = false;
        break;
      }
    }
    
    if (exposedToSun) {
      const burnRate = this.config.environmental.burnTickRate;
      if (burnRate > 0) {
        this.burnTick += delta;
        if (this.burnTick >= burnRate) {
          this.damage(this.config.environmental.burnDamagePerTick);
          this.burnTick = 0;
        }
      }
    } else {
      this.burnTick = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Physics & Movement
  // ─────────────────────────────────────────────────────────────────────────────

  private updateMovement(delta: number): void {
    const worldStore = useWorldStore.getState();
    
    // Determine target velocity
    let desiredVX = 0;
    let desiredVZ = 0;
    
    if (this.targetX !== null && this.targetZ !== null) {
      const dx = this.targetX - this.position.x;
      const dz = this.targetZ - this.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance > 0.1) {
        const speed = this.enhancedAiState === 'retreat' 
          ? this.config.movement.baseSpeed * 1.2 
          : this.config.movement.baseSpeed;
        
        desiredVX = (dx / distance) * speed;
        desiredVZ = (dz / distance) * speed;
        
        this.rotation.yaw = Math.atan2(-dx, dz);
      }
    }
    
    // Smooth acceleration/deceleration
    const accel = this.isOnGround ? 0.2 : 0.08;
    this.velocity.x += (desiredVX - this.velocity.x) * accel;
    this.velocity.z += (desiredVZ - this.velocity.z) * accel;
    
    const clampedDelta = Math.min(delta, 0.15);
    const substeps = Math.max(1, Math.ceil(clampedDelta / EnhancedHostileMob.PHYSICS_SUBSTEP));
    const dt = clampedDelta / substeps;
    
    for (let i = 0; i < substeps; i++) {
      // Apply gravity each substep
      this.velocity.y -= 28 * dt;
      this.resolveVertical(worldStore, dt);
      this.resolveHorizontal(worldStore, dt);
      this.isOnGround = this.isGrounded(worldStore);
    }
    
    // Prevent falling through world
    if (this.position.y < 1) {
      this.position.y = 1;
      this.velocity.y = 0;
      this.isOnGround = true;
    }
  }

  private resolveVertical(worldStore: ReturnType<typeof useWorldStore.getState>, dt: number): void {
    const nextY = this.position.y + this.velocity.y * dt;
    if (!this.collidesAt(worldStore, this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
      return;
    }

    if (this.velocity.y < 0) {
      this.position.y = Math.floor(this.position.y) + EnhancedHostileMob.EPSILON;
      this.isOnGround = true;
    } else if (this.velocity.y > 0) {
      this.position.y = Math.ceil(this.position.y + this.height) - this.height - EnhancedHostileMob.EPSILON;
    }
    this.velocity.y = 0;
  }

  private resolveHorizontal(worldStore: ReturnType<typeof useWorldStore.getState>, dt: number): void {
    const targetX = this.position.x + this.velocity.x * dt;
    if (!this.collidesAt(worldStore, targetX, this.position.y, this.position.z)) {
      this.position.x = targetX;
    } else if (!this.tryStepUp(worldStore, targetX, this.position.z)) {
      this.velocity.x = 0;
    }

    const targetZ = this.position.z + this.velocity.z * dt;
    if (!this.collidesAt(worldStore, this.position.x, this.position.y, targetZ)) {
      this.position.z = targetZ;
    } else if (!this.tryStepUp(worldStore, this.position.x, targetZ)) {
      this.velocity.z = 0;
    }
  }

  private tryStepUp(
    worldStore: ReturnType<typeof useWorldStore.getState>,
    targetX: number,
    targetZ: number
  ): boolean {
    if (!this.isOnGround) return false;

    const stepHeight = this.config.movement.stepHeight;
    for (let step = 0.2; step <= stepHeight; step += 0.1) {
      const steppedY = this.position.y + step;
      if (this.collidesAt(worldStore, this.position.x, steppedY, this.position.z)) continue;
      if (this.collidesAt(worldStore, targetX, steppedY, targetZ)) continue;
      this.position.y = steppedY;
      this.position.x = targetX;
      this.position.z = targetZ;
      this.isOnGround = true;
      return true;
    }
    return false;
  }

  private isGrounded(worldStore: ReturnType<typeof useWorldStore.getState>): boolean {
    return this.collidesAt(worldStore, this.position.x, this.position.y - 0.05, this.position.z);
  }

  private collidesAt(worldStore: ReturnType<typeof useWorldStore.getState>, x: number, y: number, z: number): boolean {
    const halfW = this.width * 0.5;
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + this.height);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (!isSolid(worldStore.getBlock(bx, by, bz))) continue;

          const blockMinX = bx;
          const blockMaxX = bx + 1;
          const blockMinY = by;
          const blockMaxY = by + 1;
          const blockMinZ = bz;
          const blockMaxZ = bz + 1;

          const intersects =
            x - halfW < blockMaxX &&
            x + halfW > blockMinX &&
            y < blockMaxY &&
            y + this.height > blockMinY &&
            z - halfW < blockMaxZ &&
            z + halfW > blockMinZ;

          if (intersects) return true;
        }
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stuck Detection & Pathfinding
  // ─────────────────────────────────────────────────────────────────────────────

  private checkStuck(delta: number, prevX: number, prevZ: number): void {
    const movedX = Math.abs(this.position.x - prevX);
    const movedZ = Math.abs(this.position.z - prevZ);
    
    if (movedX < 0.05 && movedZ < 0.05 && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1)) {
      this.stuckCounter += delta;
      if (this.stuckCounter > 2) {
        this.enhancedAiState = 'stuck';
      }
    } else {
      this.stuckCounter = 0;
    }
    
    this.lastPosition = { x: this.position.x, z: this.position.z };
  }

  private checkLineOfSight(playerPos: { x: number; y: number; z: number }): boolean {
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);
    
    if (distance > this.config.detection.sightRange) return false;
    
    const worldStore = useWorldStore.getState();
    return hasLineOfSight(
      this.position.x,
      this.position.y + this.height * 0.6,
      this.position.z,
      playerPos.x,
      playerPos.y + 1.6,
      playerPos.z,
      worldStore,
      this.config.detection.sightRange
    );
  }

  private isPathBlocked(targetX: number, targetZ: number): boolean {
    const worldStore = useWorldStore.getState();
    const feetY = Math.floor(this.position.y);
    const checkX = Math.floor(targetX);
    const checkZ = Math.floor(targetZ);
    
    const feet = worldStore.getBlock(checkX, feetY, checkZ);
    const head = worldStore.getBlock(checkX, feetY + 1, checkZ);
    const ground = worldStore.getBlock(checkX, feetY - 1, checkZ);
    
    return (
      isSolid(feet) ||
      isSolid(head) ||
      ground === BlockType.LAVA
    );
  }

  private updateAttackAnimation(delta: number): void {
    if (this.isChargingAttack) {
      this.attackAnimationProgress = Math.min(1, this.attackAnimationProgress + delta * 2);
    } else {
      this.attackAnimationProgress = Math.max(0, this.attackAnimationProgress - delta * 4);
    }
  }

  private clearPath(): void {
    this.pathNodes = [];
    this.pathIndex = 0;
    this.pathGoal = null;
  }

  private updatePathToGoal(goalX: number, goalY: number, goalZ: number): void {
    const goal = {
      x: Math.floor(goalX),
      y: Math.floor(goalY),
      z: Math.floor(goalZ),
    };

    if (
      this.pathGoal &&
      Math.abs(this.pathGoal.x - goal.x) <= 1 &&
      Math.abs(this.pathGoal.y - goal.y) <= 1 &&
      Math.abs(this.pathGoal.z - goal.z) <= 1 &&
      this.pathNodes.length > 0 &&
      this.pathCooldown > 0
    ) {
      return;
    }

    const worldStore = useWorldStore.getState();
    const path = findPath(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z),
      goal.x,
      goal.y,
      goal.z,
      worldStore,
      120
    );

    this.pathGoal = goal;
    this.pathCooldown = path.length > 0 ? 0.6 : 0.9;

    if (path.length <= 1) {
      this.clearPath();
      return;
    }

    this.pathNodes = path.slice(1).map(node => ({
      x: node.x + 0.5,
      y: node.y,
      z: node.z + 0.5,
    }));
    this.pathIndex = 0;
  }

  private followPath(): void {
    if (this.pathNodes.length === 0) return;

    const target = this.pathNodes[this.pathIndex];
    if (!target) {
      this.clearPath();
      return;
    }

    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < 0.45 * 0.45) {
      this.pathIndex++;
      if (this.pathIndex >= this.pathNodes.length) {
        this.clearPath();
        return;
      }
    }

    const next = this.pathNodes[this.pathIndex];
    if (next) {
      this.targetX = next.x;
      this.targetZ = next.z;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Damage & Death
  // ─────────────────────────────────────────────────────────────────────────────

  damage(amount: number): void {
    if (this.isDead) return;
    
    this.health = Math.max(0, this.health - amount);
    
    if (this.health <= 0) {
      this.die();
      return;
    }
    
    // Aggro on damage
    const player = usePlayerStore.getState();
    this.lastSeenPlayerTime = this.age;
    this.targetMemory = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      time: this.age,
    };
    this.enhancedAiState = 'chase';
    
    // Retreat if low health
    if (this.health < this.maxHealth * 0.25) {
      this.enhancedAiState = 'retreat';
    }
  }

  die(): void {
    this.isDead = true;
    this.enhancedAiState = 'dead';
    this.onDeath();
  }

  private onDeath(): void {
    // Generate drops
    const droppedItems = useDroppedItemStore.getState();
    
    for (const drop of this.drops) {
      if (Math.random() < drop.chance) {
        const count = drop.count[0] + Math.floor(Math.random() * (drop.count[1] - drop.count[0] + 1));
        droppedItems.spawnDrop(drop.item, this.position.x, this.position.y, this.position.z, count);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────────

  distanceTo(x: number, y: number, z: number): number {
    const dx = x - this.position.x;
    const dy = y - this.position.y;
    const dz = z - this.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────────

  serialize(): EntityData & { configId: string; aiState: HostileMobState } {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      rotation: { ...this.rotation },
      velocity: { ...this.velocity },
      health: this.health,
      maxHealth: this.maxHealth,
      isOnGround: this.isOnGround,
      isDead: this.isDead,
      age: this.age,
      configId: this.config.id,
      aiState: this.enhancedAiState,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type for serialized data
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityData {
  id: string;
  type: string;
  position: Vector3;
  rotation: { yaw: number; pitch: number };
  velocity: Vector3;
  health: number;
  maxHealth: number;
  isOnGround: boolean;
  isDead: boolean;
  age: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

export function createEnhancedHostileMob(
  type: string,
  x: number,
  y: number,
  z: number,
  dayCount: number = 0
): EnhancedHostileMob | null {
  const config = MOB_CONFIGS[type];
  if (!config) return null;
  
  // Apply difficulty scaling
  const difficultyMult = getDifficultyMultiplier(dayCount);
  const scaledConfig: MobBehaviorConfig = {
    ...config,
    health: Math.floor(config.health * difficultyMult),
    maxHealth: Math.floor(config.maxHealth * difficultyMult),
    combat: {
      ...config.combat,
      damage: Math.floor(config.combat.damage * difficultyMult),
      explosionRadius: config.combat.explosionRadius 
        ? Math.floor(config.combat.explosionRadius + difficultyMult * 0.5) 
        : undefined,
    },
  };
  
  return new EnhancedHostileMob(type, x, y, z, scaledConfig);
}

// Check spawn conditions
export function canSpawnAt(
  type: string,
  ctx: SpawnContext
): boolean {
  const config = MOB_CONFIGS[type];
  if (!config) return false;
  return canMobSpawnHere(config, ctx);
}
