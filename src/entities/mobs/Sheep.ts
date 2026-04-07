import { Mob } from '../Mob';
import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';

type WoolColor = 'white' | 'black' | 'brown' | 'gray' | 'light_gray' | 'pink' | 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'magenta' | 'light_blue' | 'lime' | 'cyan' | 'purple';

export class Sheep extends Mob {
  woolColor: WoolColor;
  hasWool: boolean;
  regrowTimer: number;

  constructor(x: number, y: number, z: number) {
    super('sheep', 'passive', x, y, z);

    this.health = 8;
    this.maxHealth = 8;
    this.moveSpeed = 2.0;
    this.width = 0.9;
    this.height = 1.3;

    // Random wool color (weighted towards white)
    const colorRoll = Math.random();
    if (colorRoll < 0.8) this.woolColor = 'white';
    else if (colorRoll < 0.85) this.woolColor = 'black';
    else if (colorRoll < 0.9) this.woolColor = 'brown';
    else if (colorRoll < 0.95) this.woolColor = 'gray';
    else this.woolColor = 'light_gray';

    this.hasWool = true;
    this.regrowTimer = 0;

    this.drops = [
      { item: BlockType.WOOL_WHITE, count: [1, 1], chance: 1 },
    ];
  }

  update(delta: number): void {
    super.update(delta);

    // Wool regrowth
    if (!this.hasWool) {
      this.regrowTimer += delta;
      if (this.regrowTimer >= 60) { // 60 seconds to regrow
        this.hasWool = true;
        this.regrowTimer = 0;
      }
    }

    // Sheep baa occasionally
    if (Math.random() < 0.001) {
      // Play baa sound
    }
  }

  // Shear the sheep
  shear(): { item: BlockType; count: number } | null {
    if (!this.hasWool) return null;

    this.hasWool = false;
    this.regrowTimer = 0;

    const woolBlock = this.getWoolBlock();
    return { item: woolBlock, count: 1 + Math.floor(Math.random() * 3) };
  }

  private getWoolBlock(): BlockType {
    switch (this.woolColor) {
      case 'white': return BlockType.WOOL_WHITE;
      case 'black': return BlockType.WOOL_BLACK;
      case 'red': return BlockType.WOOL_RED;
      case 'blue': return BlockType.WOOL_BLUE;
      case 'green': return BlockType.WOOL_GREEN;
      case 'yellow': return BlockType.WOOL_YELLOW;
      case 'brown': return BlockType.WOOL_BROWN;
      case 'gray': return BlockType.WOOL_GRAY;
      case 'light_gray': return BlockType.WOOL_LIGHT_GRAY;
      case 'pink': return BlockType.WOOL_PINK;
      case 'orange': return BlockType.WOOL_ORANGE;
      case 'magenta': return BlockType.WOOL_MAGENTA;
      case 'light_blue': return BlockType.WOOL_LIGHT_BLUE;
      case 'lime': return BlockType.WOOL_LIME;
      case 'cyan': return BlockType.WOOL_CYAN;
      case 'purple': return BlockType.WOOL_PURPLE;
      default: return BlockType.WOOL_WHITE;
    }
  }

  // Dye the sheep
  dye(color: WoolColor): void {
    this.woolColor = color;
  }

  canBreed(): boolean {
    return super.canBreed();
  }

  protected onDeath(): void {
    // Drop wool based on color
    this.drops = [
      { item: this.getWoolBlock(), count: [1, 1], chance: 1 },
      { item: ItemType.RAW_MUTTON, count: [1, 2], chance: 1 },
    ];
    super.onDeath();
  }
}
