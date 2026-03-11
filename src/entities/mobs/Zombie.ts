import { Mob } from '../Mob';
import { ItemType } from '@/data/items';
import { getTimeOfDay, useGameStore } from '@/stores/gameStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';

export class Zombie extends Mob {
  constructor(x: number, y: number, z: number) {
    super('zombie', 'hostile', x, y, z);

    this.health = 20;
    this.maxHealth = 20;
    this.attackDamage = 3;
    this.attackCooldown = 1;
    this.attackRange = 2;
    this.detectionRange = 40;
    this.followRange = 40;
    this.moveSpeed = 2.3;
    this.width = 0.6;
    this.height = 1.95;

    this.drops = [
      { item: ItemType.ROTTEN_FLESH, count: [0, 2], chance: 1 },
      { item: ItemType.IRON_INGOT, count: [0, 1], chance: 0.02 },
      { item: ItemType.CARROT, count: [0, 1], chance: 0.02 },
      { item: ItemType.POTATO, count: [0, 1], chance: 0.02 },
    ];
  }

  update(delta: number): void {
    super.update(delta);
    this.applySunlightBurn(delta);
  }

  private applySunlightBurn(delta: number): void {
    const worldTime = useGameStore.getState().worldTime;
    if (getTimeOfDay(worldTime) !== 'day') return;

    const worldStore = useWorldStore.getState();
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    const startY = Math.floor(this.position.y + this.height);

    for (let y = startY; y < startY + 6; y++) {
      const block = worldStore.getBlock(x, y, z);
      if (block !== BlockType.AIR) return;
    }

    this.damage(delta * 1.5);
  }
}
