import { Mob } from '../Mob';
import { ItemType } from '@/data/items';

export class Cow extends Mob {
  constructor(x: number, y: number, z: number) {
    super('cow', 'passive', x, y, z);

    this.health = 10;
    this.maxHealth = 10;
    this.moveSpeed = 2.0;
    this.width = 0.9;
    this.height = 1.4;

    this.drops = [
      { item: ItemType.RAW_BEEF, count: [1, 3], chance: 1 },
      { item: ItemType.LEATHER, count: [0, 2], chance: 1 },
    ];
  }

  update(delta: number): void {
    super.update(delta);

    // Cows moo occasionally
    if (Math.random() < 0.001) {
      // Play moo sound
    }
  }

  // Can be milked with bucket
  milk(): boolean {
    // Return milk bucket item
    return true;
  }

  canBreed(): boolean {
    return super.canBreed();
  }
}
