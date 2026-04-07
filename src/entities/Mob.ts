import { Entity } from './Entity';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType, isSolid } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { useDroppedItemStore } from '@/components/DroppedItems';

export type MobType = 'passive' | 'hostile' | 'neutral';

export interface MobDrop {
  item: BlockType | ItemType;
  count: [number, number]; // [min, max]
  chance: number;
}

export abstract class Mob extends Entity {
  private static readonly MAX_STEP_HEIGHT = 0.6;
  private static readonly PHYSICS_SUBSTEP = 1 / 30;
  private static readonly EPSILON = 0.001;
  private static readonly MOB_JUMP_VELOCITY = 7.0;

  mobType: MobType;
  attackDamage: number;
  attackCooldown: number;
  attackRange: number;
  detectionRange: number;
  followRange: number;
  moveSpeed: number;
  drops: MobDrop[];

  // AI state
  aiState: 'idle' | 'wander' | 'follow' | 'attack' | 'flee';
  targetX: number | null = null;
  targetZ: number | null = null;
  lastAttackTime: number = 0;
  wanderCooldown: number = 0;
  breedCooldown: number = 0;
  evadeCooldown: number = 0;
  jumpCooldown: number = 0;
  private fallDistance: number = 0;
  private lavaTick: number = 0;
  private fireTick: number = 0;
  private fireDamageTick: number = 0;
  private obstacleTurnDirection: number = Math.random() < 0.5 ? -1 : 1;

  constructor(type: string, mobType: MobType, x: number, y: number, z: number) {
    super(type, x, y, z);
    this.mobType = mobType;
    this.attackDamage = 2;
    this.attackCooldown = 1;
    this.attackRange = 2;
    this.detectionRange = 16;
    this.followRange = 32;
    this.moveSpeed = 2;
    this.drops = [];
    this.aiState = 'idle';
  }

  update(delta: number): void {
    if (this.isDead) return;

    this.updateAI(delta);
    this.updateMovement(delta);

    // Reduce wander cooldown
    if (this.wanderCooldown > 0) {
      this.wanderCooldown -= delta;
    }
    if (this.breedCooldown > 0) {
      this.breedCooldown -= delta;
    }
    if (this.evadeCooldown > 0) {
      this.evadeCooldown -= delta;
    }
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= delta;
    }
  }

  protected updateAI(delta: number): void {
    const player = usePlayerStore.getState();
    const playerPos = player.position;
    const distanceToPlayer = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);

    if (this.mobType === 'hostile') {
      this.updateHostileAI(distanceToPlayer, playerPos, delta);
    } else if (this.mobType === 'passive') {
      this.updatePassiveAI(delta);
    }
  }

  protected updateHostileAI(
    distanceToPlayer: number,
    playerPos: { x: number; y: number; z: number },
    delta: number
  ): void {
    // Check if player is in range
    if (distanceToPlayer <= this.detectionRange && this.canSee(playerPos.x, playerPos.y, playerPos.z)) {
      if (distanceToPlayer <= this.attackRange) {
        this.aiState = 'attack';
        this.tryAttack(delta);
      } else {
        this.aiState = 'follow';
        this.targetX = playerPos.x;
        this.targetZ = playerPos.z;
      }
    } else if (distanceToPlayer > this.followRange) {
      this.aiState = 'wander';
    }
  }

  protected updatePassiveAI(delta: number): void {
    const player = usePlayerStore.getState().position;
    const playerVelocity = usePlayerStore.getState().velocity;
    const distanceToPlayer = this.distanceTo(player.x, player.y, player.z);
    
    // Calculate player speed to determine if we should flee
    const playerSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
    const isPlayerRunning = playerSpeed > 0.15;
    
    // Flee behavior - enhanced with better escape logic
    const fleeDistance = isPlayerRunning ? 6 : 4.5;
    if (distanceToPlayer < fleeDistance) {
      this.aiState = 'flee';
      
      // Calculate escape direction - move away from player with some randomness
      const angle = Math.atan2(this.position.z - player.z, this.position.x - player.x);
      const randomOffset = (Math.random() - 0.5) * 0.5; // Add some variation to escape path
      
      // Choose a random direction to run to
      const fleeDist = 8 + Math.random() * 6;
      this.targetX = this.position.x + Math.cos(angle + randomOffset) * fleeDist;
      this.targetZ = this.position.z + Math.sin(angle + randomOffset) * fleeDist;
      
      // Sometimes jump when fleeing
      if (this.isOnGround && this.jumpCooldown <= 0 && Math.random() < 0.1) {
        this.velocity.y = Mob.MOB_JUMP_VELOCITY * 0.7;
        this.jumpCooldown = 0.5 + Math.random() * 0.5;
      }
      return;
    }

    // Grouping behavior - look for nearby same-type mobs
    this.updateGroupingBehavior(delta);

    // Random wandering with more natural movement
    if (this.aiState === 'idle' || this.aiState === 'wander') {
      // Random direction change with momentum
      if (this.wanderCooldown <= 0) {
        if (Math.random() < 0.015) { // Less frequent but more decisive
          this.aiState = 'wander';
          
          // Choose wandering direction - bias towards exploring
          const wanderAngle = Math.random() * Math.PI * 2;
          const wanderDist = 5 + Math.random() * 10;
          
          this.targetX = this.position.x + Math.cos(wanderAngle) * wanderDist;
          this.targetZ = this.position.z + Math.sin(wanderAngle) * wanderDist;
          
          // Set longer wandering time
          this.wanderCooldown = 1.5 + Math.random() * 2.5;
        }
      }
    }

    // Reached target - return to idle or continue wandering
    if ((this.aiState === 'wander' || this.aiState === 'flee') && this.targetX !== null && this.targetZ !== null) {
      const distToTarget = Math.sqrt(
        Math.pow(this.targetX - this.position.x, 2) +
        Math.pow(this.targetZ - this.position.z, 2)
      );

      if (distToTarget < 1.5) {
        const wasFleeing = this.aiState === 'flee';
        this.aiState = 'idle';
        this.targetX = null;
        this.targetZ = null;
        
        // Fleeing has shorter cooldown so they can keep distance
        this.wanderCooldown = wasFleeing ? 0.8 + Math.random() * 1.2 : 2 + Math.random() * 4;
      }
    }
  }

  // Enhanced grouping behavior for passive mobs
  private updateGroupingBehavior(delta: number): void {
    // This would integrate with entity manager to find nearby same-type mobs
    // For now, we'll add some group cohesion logic
    
    // If idle, occasionally check for nearby mobs of same type
    if (this.aiState === 'idle' && this.wanderCooldown <= 0) {
      // Move towards center of nearby mobs if any
      // This is a placeholder - would need entity manager integration
      
      // Small chance to graze (feed) when idle
      if (Math.random() < 0.005) {
        this.aiState = 'wander';
        // Move in current direction a bit to "graze"
        this.targetX = this.position.x + (Math.random() - 0.5) * 3;
        this.targetZ = this.position.z + (Math.random() - 0.5) * 3;
      }
    }
  }

  protected updateMovement(delta: number): void {
    let desiredVX = 0;
    let desiredVZ = 0;
    if (this.targetX !== null && this.targetZ !== null) {
      const dx = this.targetX - this.position.x;
      const dz = this.targetZ - this.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > 0.1) {
        desiredVX = (dx / distance) * this.getCurrentMoveSpeed();
        desiredVZ = (dz / distance) * this.getCurrentMoveSpeed();
        this.rotation.yaw = Math.atan2(-dx, dz);
      }

      // Simple obstacle avoidance: if blocked, strafe around and retry next tick.
      if (this.isPathBlocked(delta)) {
        const yaw = this.rotation.yaw + this.obstacleTurnDirection * (Math.PI * 0.5);
        desiredVX = -Math.sin(yaw) * this.moveSpeed * 0.6;
        desiredVZ = Math.cos(yaw) * this.moveSpeed * 0.6;
        if (this.evadeCooldown <= 0) {
          this.obstacleTurnDirection *= -1;
          this.evadeCooldown = 1.2 + Math.random();
        }
        if (this.isOnGround && this.jumpCooldown <= 0) {
          this.velocity.y = Mob.MOB_JUMP_VELOCITY;
          this.isOnGround = false;
          this.jumpCooldown = 0.8 + Math.random() * 0.6;
        }
      }
    } else {
      // Slow down when not moving
      desiredVX = 0;
      desiredVZ = 0;
    }

    // Smooth acceleration/deceleration
    const accel = this.isOnGround ? 0.2 : 0.08;
    this.velocity.x += (desiredVX - this.velocity.x) * accel;
    this.velocity.z += (desiredVZ - this.velocity.z) * accel;

    const worldStore = useWorldStore.getState();
    const clampedDelta = Math.min(delta, 0.15);
    const substeps = Math.max(1, Math.ceil(clampedDelta / Mob.PHYSICS_SUBSTEP));
    const dt = clampedDelta / substeps;

    for (let i = 0; i < substeps; i++) {
      // Apply gravity each substep to avoid tunneling on long frames.
      this.velocity.y -= this.gravity * dt;
      this.resolveVertical(worldStore, dt);
      this.resolveHorizontal(worldStore, dt);
      this.isOnGround = this.isGrounded(worldStore);
    }

    if (this.position.y < 1) {
      this.position.y = 1;
      this.velocity.y = 0;
      this.isOnGround = true;
    }

    // Environmental damage + fall damage
    const feetX = Math.floor(this.position.x);
    const feetY = Math.floor(this.position.y);
    const feetZ = Math.floor(this.position.z);
    const blockAtFeet = worldStore.getBlock(feetX, feetY, feetZ);

    if (!this.isOnGround && this.velocity.y < -1) {
      this.fallDistance += Math.abs(this.velocity.y) * clampedDelta;
    }
    if (this.isOnGround && this.fallDistance > 3) {
      const fallDamage = Math.floor((this.fallDistance - 3) * 1.2);
      if (fallDamage > 0) this.damage(fallDamage);
      this.fallDistance = 0;
    }
    if (this.isOnGround) this.fallDistance = 0;

    if (blockAtFeet === BlockType.LAVA) {
      this.lavaTick += clampedDelta;
      if (this.lavaTick >= 0.5) {
        this.damage(2);
        this.lavaTick = 0;
        this.fireTick = 2;
      }
    } else {
      this.lavaTick = 0;
    }

    if (this.fireTick > 0) {
      this.fireTick -= clampedDelta;
      if (this.fireTick > 0) {
        this.fireDamageTick += clampedDelta;
        if (this.fireDamageTick >= 1) {
          this.damage(1);
          this.fireDamageTick = 0;
        }
      } else {
        this.fireDamageTick = 0;
      }
    } else {
      this.fireDamageTick = 0;
    }
  }

  protected tryAttack(delta: number): void {
    const now = Date.now() / 1000;
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attack();
      this.lastAttackTime = now;
    }
  }

  protected attack(): void {
    // Damage the player
    usePlayerStore.getState().damage(this.attackDamage);
  }

  protected getCurrentMoveSpeed(): number {
    return this.aiState === 'flee' ? this.moveSpeed * 1.2 : this.moveSpeed;
  }

  canBreed(): boolean {
    return this.mobType === 'passive' && this.breedCooldown <= 0 && !this.isDead;
  }

  onBred(): void {
    this.breedCooldown = 75 + Math.random() * 45;
  }

  protected isPathBlocked(delta: number): boolean {
    const worldStore = useWorldStore.getState();
    const dt = Math.max(0.15, delta);
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;
    const feetY = Math.floor(this.position.y);
    const checkX = Math.floor(nextX);
    const checkZ = Math.floor(nextZ);

    const feet = worldStore.getBlock(checkX, feetY, checkZ);
    const head = worldStore.getBlock(checkX, feetY + 1, checkZ);
    const ground = worldStore.getBlock(checkX, feetY - 1, checkZ);

    return (
      isSolid(feet) ||
      isSolid(head) ||
      ground === BlockType.LAVA ||
      (this.mobType === 'passive' && ground === BlockType.WATER)
    );
  }

  damage(amount: number): void {
    super.damage(amount);
    if (this.isDead) return;
    if (this.mobType === 'passive') {
      this.aiState = 'flee';
      const player = usePlayerStore.getState().position;
      this.targetX = this.position.x + (this.position.x - player.x) * 2.4;
      this.targetZ = this.position.z + (this.position.z - player.z) * 2.4;
      this.wanderCooldown = 2 + Math.random() * 2;
    }
  }

  private resolveVertical(worldStore: ReturnType<typeof useWorldStore.getState>, dt: number): void {
    const nextY = this.position.y + this.velocity.y * dt;
    if (!this.collidesAt(worldStore, this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
      return;
    }

    if (this.velocity.y < 0) {
      this.position.y = Math.floor(this.position.y) + Mob.EPSILON;
      this.isOnGround = true;
    } else if (this.velocity.y > 0) {
      this.position.y = Math.ceil(this.position.y + this.height) - this.height - Mob.EPSILON;
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

    for (let step = 0.2; step <= Mob.MAX_STEP_HEIGHT; step += 0.1) {
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

  protected onDeath(): void {
    // Generate drops
    for (const drop of this.drops) {
      if (Math.random() < drop.chance) {
        const count = drop.count[0] + Math.floor(Math.random() * (drop.count[1] - drop.count[0] + 1));
        useDroppedItemStore
          .getState()
          .spawnDrop(drop.item, this.position.x, this.position.y, this.position.z, count);
      }
    }
  }
}
