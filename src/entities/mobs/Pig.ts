import { Mob } from '../Mob';
import { ItemType } from '@/data/items';

export class Pig extends Mob {
  constructor(x: number, y: number, z: number) {
    super('pig', 'passive', x, y, z);

    this.health = 10;
    this.maxHealth = 10;
    this.moveSpeed = 2.0;
    this.width = 0.9;
    this.height = 0.9;

    this.drops = [
      { item: ItemType.RAW_PORKCHOP, count: [1, 3], chance: 1 },
    ];
  }

  update(delta: number): void {
    super.update(delta);

    // Pigs oink occasionally
    if (Math.random() < 0.001) {
      // Play oink sound
    }
  }

  // Pigs can be bred with carrots
  canBreed(): boolean {
    return super.canBreed();
  }
}
