import { Vector3 } from '@/utils/coordinates';

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
  age: number; // Ticks since spawn
}

export abstract class Entity {
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

  // Bounding box dimensions
  width: number;
  height: number;

  // Physics
  gravity: number = 28;
  drag: number = 0.02;
  maxSpeed: number = 10;

  constructor(type: string, x: number, y: number, z: number) {
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.position = { x, y, z };
    this.rotation = { yaw: Math.random() * Math.PI * 2, pitch: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.health = 20;
    this.maxHealth = 20;
    this.isOnGround = false;
    this.isDead = false;
    this.age = 0;
    this.width = 0.6;
    this.height = 1.8;
  }

  abstract update(delta: number): void;

  tick(): void {
    this.age++;
  }

  damage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  die(): void {
    this.isDead = true;
    this.onDeath();
  }

  protected onDeath(): void {
    // Override in subclasses for drops, sounds, etc.
  }

  // Move towards a target
  moveTowards(targetX: number, targetZ: number, speed: number): void {
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.1) {
      this.velocity.x = (dx / distance) * speed;
      this.velocity.z = (dz / distance) * speed;

      // Face movement direction
      this.rotation.yaw = Math.atan2(-dx, dz);
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  // Check line of sight to a point
  canSee(targetX: number, targetY: number, targetZ: number): boolean {
    // Simplified: just check distance for now
    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const dz = targetZ - this.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < 32;
  }

  // Get distance to a point
  distanceTo(x: number, y: number, z: number): number {
    const dx = x - this.position.x;
    const dy = y - this.position.y;
    const dz = z - this.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Serialize entity data
  serialize(): EntityData {
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
    };
  }
}
