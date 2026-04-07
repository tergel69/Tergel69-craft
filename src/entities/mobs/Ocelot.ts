import { Mob } from '../Mob';

export class Ocelot extends Mob {
  constructor(x: number, y: number, z: number) {
    super('ocelot', 'passive', x, y, z);

    this.health = 6;
    this.maxHealth = 6;
    this.moveSpeed = 3.2;
    this.width = 0.7;
    this.height = 0.7;
  }
}
