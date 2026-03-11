import { Mob } from '../Mob';
import { ItemType } from '@/data/items';

export class Chicken extends Mob {
  constructor(x: number, y: number, z: number) {
    super('chicken', 'passive', x, y, z);

    this.health = 4;
    this.maxHealth = 4;
    this.moveSpeed = 2.4;
    this.width = 0.5;
    this.height = 0.9;

    this.drops = [
      { item: ItemType.RAW_CHICKEN, count: [1, 2], chance: 1 },
      { item: ItemType.FEATHER, count: [0, 2], chance: 1 },
      { item: ItemType.EGG, count: [0, 1], chance: 0.25 },
    ];
  }
}
