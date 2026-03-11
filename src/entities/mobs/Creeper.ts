import { Mob } from '../Mob';
import { ItemType } from '@/data/items';
import { usePlayerStore } from '@/stores/playerStore';

export class Creeper extends Mob {
  fuseTime: number = 1.5;
  currentFuse: number = 0;
  isIgnited: boolean = false;
  explosionRadius: number = 3;
  explosionPower: number = 3;

  constructor(x: number, y: number, z: number) {
    super('creeper', 'hostile', x, y, z);

    this.health = 20;
    this.maxHealth = 20;
    this.attackDamage = 0;
    this.attackRange = 3;
    this.detectionRange = 16;
    this.followRange = 16;
    this.moveSpeed = 2.5;
    this.width = 0.6;
    this.height = 1.7;

    this.drops = [{ item: ItemType.GUNPOWDER, count: [0, 2], chance: 1 }];
  }

  update(delta: number): void {
    if (this.isDead) return;

    const player = usePlayerStore.getState().position;
    const distanceToPlayer = this.distanceTo(player.x, player.y, player.z);

    if (this.isIgnited) {
      this.currentFuse += delta;
      if (this.currentFuse >= this.fuseTime) {
        this.explode();
        return;
      }
    } else if (distanceToPlayer > this.attackRange) {
      this.currentFuse = Math.max(0, this.currentFuse - delta);
    }

    super.update(delta);
  }

  protected updateHostileAI(
    distanceToPlayer: number,
    playerPos: { x: number; y: number; z: number }
  ): void {
    if (distanceToPlayer <= this.attackRange) {
      this.aiState = 'attack';
      this.isIgnited = true;
      this.targetX = null;
      this.targetZ = null;
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      this.rotation.yaw = Math.atan2(-dx, dz);
    } else if (distanceToPlayer <= this.detectionRange) {
      this.aiState = 'follow';
      this.isIgnited = false;
      this.targetX = playerPos.x;
      this.targetZ = playerPos.z;
    } else {
      this.aiState = 'wander';
      this.isIgnited = false;
    }
  }

  private explode(): void {
    const playerStore = usePlayerStore.getState();
    const playerPos = playerStore.position;
    const distance = this.distanceTo(playerPos.x, playerPos.y, playerPos.z);

    if (distance < this.explosionRadius) {
      const scale = 1 - distance / this.explosionRadius;
      const damage = Math.ceil(this.explosionPower * 6 * scale);
      playerStore.damage(damage);

      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const len = Math.hypot(dx, dz) || 1;
      playerStore.setVelocity({
        x: (dx / len) * (6 * scale),
        y: 4 * scale,
        z: (dz / len) * (6 * scale),
      });
    }

    this.die();
  }

  getFuseProgress(): number {
    return this.currentFuse / this.fuseTime;
  }
}
