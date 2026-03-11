import { Mob } from '../Mob';
import { ItemType } from '@/data/items';
import { usePlayerStore } from '@/stores/playerStore';
import { getTimeOfDay, useGameStore } from '@/stores/gameStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';

export class Skeleton extends Mob {
  constructor(x: number, y: number, z: number) {
    super('skeleton', 'hostile', x, y, z);

    this.health = 20;
    this.maxHealth = 20;
    this.attackDamage = 2;
    this.attackCooldown = 1.8;
    this.attackRange = 15;
    this.detectionRange = 16;
    this.followRange = 16;
    this.moveSpeed = 2.0;
    this.width = 0.6;
    this.height = 1.99;

    this.drops = [
      { item: ItemType.BONE, count: [0, 2], chance: 1 },
      { item: ItemType.ARROW, count: [0, 2], chance: 1 },
    ];
  }

  update(delta: number): void {
    super.update(delta);
    this.applySunlightBurn(delta);
  }

  protected updateHostileAI(
    distanceToPlayer: number,
    playerPos: { x: number; y: number; z: number },
    delta: number
  ): void {
    if (distanceToPlayer <= this.detectionRange) {
      if (distanceToPlayer < 4) {
        this.aiState = 'flee';
        this.targetX = this.position.x + (this.position.x - playerPos.x) * 1.8;
        this.targetZ = this.position.z + (this.position.z - playerPos.z) * 1.8;
      } else if (distanceToPlayer <= this.attackRange) {
        this.aiState = 'attack';
        this.targetX = null;
        this.targetZ = null;
        this.tryAttack(delta);
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        this.rotation.yaw = Math.atan2(-dx, dz);
      } else {
        this.aiState = 'follow';
        this.targetX = playerPos.x;
        this.targetZ = playerPos.z;
      }
    } else {
      this.aiState = 'wander';
    }
  }

  protected attack(): void {
    const player = usePlayerStore.getState();
    const distance = this.distanceTo(player.position.x, player.position.y, player.position.z);
    const damage = distance > 10 ? 1 : 2;
    player.damage(damage);
  }

  private applySunlightBurn(delta: number): void {
    const worldTime = useGameStore.getState().worldTime;
    if (getTimeOfDay(worldTime) !== 'day') return;

    const worldStore = useWorldStore.getState();
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    const startY = Math.floor(this.position.y + this.height);
    for (let y = startY; y < startY + 6; y++) {
      if (worldStore.getBlock(x, y, z) !== BlockType.AIR) return;
    }

    this.damage(delta * 1.5);
  }
}
