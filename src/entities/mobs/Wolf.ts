import { Mob } from '../Mob';

export class Wolf extends Mob {
  constructor(x: number, y: number, z: number) {
    super('wolf', 'passive', x, y, z);

    this.health = 8;
    this.maxHealth = 8;
    this.moveSpeed = 2.8;
    this.width = 0.8;
    this.height = 0.85;
  }
}
