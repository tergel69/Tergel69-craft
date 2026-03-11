import { BlockType, BLOCKS, BlockData } from '@/data/blocks';
import { ItemType, ITEMS, ItemData } from '@/data/items';

// Tool levels: 0 = wood, 1 = stone, 2 = iron, 3 = gold, 4 = diamond, 5 = netherite
// Block harvest levels for ores
const BLOCK_HARVEST_LEVELS: Partial<Record<BlockType, number>> = {
  [BlockType.STONE]: 0,
  [BlockType.COBBLESTONE]: 0,
  [BlockType.COAL_ORE]: 0,
  [BlockType.DEEPSLATE_COAL_ORE]: 0,
  [BlockType.IRON_ORE]: 1,
  [BlockType.DEEPSLATE_IRON_ORE]: 1,
  [BlockType.COPPER_ORE]: 1,
  [BlockType.DEEPSLATE_COPPER_ORE]: 1,
  [BlockType.LAPIS_ORE]: 1,
  [BlockType.DEEPSLATE_LAPIS_ORE]: 1,
  [BlockType.GOLD_ORE]: 2,
  [BlockType.DEEPSLATE_GOLD_ORE]: 2,
  [BlockType.REDSTONE_ORE]: 2,
  [BlockType.DEEPSLATE_REDSTONE_ORE]: 2,
  [BlockType.DIAMOND_ORE]: 2,
  [BlockType.DEEPSLATE_DIAMOND_ORE]: 2,
  [BlockType.EMERALD_ORE]: 2,
  [BlockType.DEEPSLATE_EMERALD_ORE]: 2,
  [BlockType.OBSIDIAN]: 4,
  [BlockType.CRYING_OBSIDIAN]: 4,
  [BlockType.ANCIENT_DEBRIS]: 4,
  [BlockType.NETHERITE_BLOCK]: 4,
};

// Base break time multiplier
const BASE_BREAK_TIME = 1.5;

// Speed multiplier when not using correct tool
const WRONG_TOOL_PENALTY = 5;

export interface ToolInfo {
  toolType: 'pickaxe' | 'shovel' | 'axe' | 'hoe' | 'sword' | 'shears' | null;
  toolLevel: number;
  miningSpeed: number;
  durability: number;
  maxDurability: number;
  attackDamage: number;
}

/**
 * Get tool information for an item
 */
export function getToolInfo(item: BlockType | ItemType | null | undefined): ToolInfo | null {
  if (!item || typeof item === 'number') {
    return null; // Blocks are not tools
  }

  const itemData = ITEMS[item];
  if (!itemData || !itemData.toolType) {
    return null;
  }

  return {
    toolType: itemData.toolType,
    toolLevel: itemData.toolLevel ?? 0,
    miningSpeed: itemData.miningSpeed ?? 1,
    durability: itemData.durability ?? 0,
    maxDurability: itemData.durability ?? 0,
    attackDamage: itemData.attackDamage ?? 1,
  };
}

/**
 * Check if a tool can harvest a block (get drops)
 */
export function canHarvest(block: BlockType, item: BlockType | ItemType | null | undefined): boolean {
  const blockData = BLOCKS[block];
  if (!blockData) return false;

  // Blocks without tool requirements can be harvested with anything
  if (!blockData.tool) return true;

  // Check if block has a harvest level requirement
  const requiredLevel = BLOCK_HARVEST_LEVELS[block];
  if (requiredLevel === undefined) return true;

  // Get tool info
  const toolInfo = getToolInfo(item);
  if (!toolInfo) return requiredLevel === 0;

  // Check if it's the correct tool type
  if (toolInfo.toolType !== blockData.tool) return false;

  // Check if tool level is sufficient
  return toolInfo.toolLevel >= requiredLevel;
}

/**
 * Calculate break time for a block with given tool
 */
export function calculateBreakTime(
  block: BlockType,
  item: BlockType | ItemType | null | undefined,
  isOnGround: boolean = true,
  isInWater: boolean = false
): number {
  const blockData = BLOCKS[block];
  if (!blockData) return 1;

  // Unbreakable (bedrock)
  if (blockData.hardness === -1) return Infinity;

  // Instant break blocks
  if (blockData.hardness === 0) return 0.05;

  let speedMultiplier = 1;
  let canHarvestBlock = true;

  // Get tool info
  const toolInfo = getToolInfo(item);

  if (toolInfo) {
    // Check if it's the correct tool type
    if (blockData.tool && toolInfo.toolType === blockData.tool) {
      speedMultiplier = toolInfo.miningSpeed;
    } else if (toolInfo.toolType === 'sword' && block === BlockType.COBBLESTONE) {
      // Sword has slight bonus on cobwebs (simulated with cobblestone here)
      speedMultiplier = 1.5;
    }

    // Check harvest level
    const requiredLevel = BLOCK_HARVEST_LEVELS[block];
    if (requiredLevel !== undefined && toolInfo.toolLevel < requiredLevel) {
      canHarvestBlock = false;
    }
  }

  // If can't harvest, break time is multiplied by 5
  if (!canHarvestBlock) {
    speedMultiplier /= WRONG_TOOL_PENALTY;
  }

  // Calculate damage per tick (base is 1 per second for hand)
  let damage = speedMultiplier;

  // Not on ground penalty (breaks 5x slower)
  if (!isOnGround) {
    damage /= 5;
  }

  // In water penalty (breaks 5x slower, unless has aqua affinity)
  if (isInWater) {
    damage /= 5;
  }

  // Calculate break time
  // Break time = hardness * 1.5 / damage (in seconds)
  if (!canHarvestBlock) {
    return (blockData.hardness * 5) / damage;
  }

  return (blockData.hardness * BASE_BREAK_TIME) / damage;
}

/**
 * Get the drop for a block when broken
 */
export function getBlockDrop(
  block: BlockType,
  item: BlockType | ItemType | null | undefined
): { item: BlockType | ItemType; count: number }[] {
  const blockData = BLOCKS[block];
  if (!blockData) return [];

  // Unbreakable blocks don't drop
  if (blockData.hardness === -1) return [];

  // Check if player can harvest the block with this tool
  if (!canHarvest(block, item)) {
    // Some blocks (like glass) don't drop if broken without correct tool
    const fragileBlocks = [
      BlockType.GLASS,
      BlockType.ICE,
      BlockType.PACKED_ICE,
      BlockType.BLUE_ICE,
    ];
    if (fragileBlocks.includes(block)) {
      return [];
    }
    // Ores don't drop if wrong tool level
    if (blockData.tool === 'pickaxe' && BLOCK_HARVEST_LEVELS[block] !== undefined) {
      return [];
    }
  }

  // Check for custom drops
  if (blockData.drops && blockData.drops.length > 0) {
    const drops: { item: BlockType | ItemType; count: number }[] = [];

    for (const drop of blockData.drops) {
      // Check chance
      if (drop.chance !== undefined && Math.random() > drop.chance) {
        continue;
      }

      // Handle different drop types
      if (typeof drop.item === 'string') {
        // Convert string to ItemType if possible
        const itemType = drop.item as ItemType;
        drops.push({ item: itemType, count: drop.count });
      } else {
        drops.push({ item: drop.item as BlockType, count: drop.count });
      }
    }

    return drops;
  }

  // Default: drop the block itself
  return [{ item: block, count: 1 }];
}

/**
 * Check if an item is a tool
 */
export function isTool(item: BlockType | ItemType | null | undefined): boolean {
  return getToolInfo(item) !== null;
}

/**
 * Get the damage dealt by a weapon/tool
 */
export function getAttackDamage(item: BlockType | ItemType | null | undefined): number {
  const toolInfo = getToolInfo(item);
  if (toolInfo) {
    return toolInfo.attackDamage;
  }
  return 1; // Fist damage
}

/**
 * Check if using a tool on a block should consume durability
 */
export function shouldConsumeDurability(block: BlockType, item: BlockType | ItemType | null | undefined): boolean {
  const toolInfo = getToolInfo(item);
  if (!toolInfo) return false;

  const blockData = BLOCKS[block];
  if (!blockData) return false;

  // Swords lose 2 durability when mining (unless it's their intended block type which doesn't exist)
  if (toolInfo.toolType === 'sword') {
    return blockData.hardness > 0;
  }

  // Hoes don't lose durability on blocks (only when tilling)
  if (toolInfo.toolType === 'hoe') {
    return false;
  }

  // Other tools lose durability when mining
  return blockData.hardness > 0;
}

/**
 * Get durability cost for breaking a block
 */
export function getDurabilityCost(block: BlockType, item: BlockType | ItemType | null | undefined): number {
  const toolInfo = getToolInfo(item);
  if (!toolInfo) return 0;

  const blockData = BLOCKS[block];
  if (!blockData) return 0;

  // Swords cost 2 durability when mining
  if (toolInfo.toolType === 'sword' && blockData.hardness > 0) {
    return 2;
  }

  // Other tools cost 1 durability
  if (shouldConsumeDurability(block, item)) {
    return 1;
  }

  return 0;
}

/**
 * Get item data for display purposes
 */
export function getItemDisplayInfo(item: BlockType | ItemType): {
  name: string;
  color: string;
  maxDurability?: number;
} {
  if (typeof item === 'number') {
    const blockData = BLOCKS[item];
    return {
      name: blockData?.name || 'Unknown',
      color: blockData?.color || '#808080',
    };
  }

  const itemData = ITEMS[item];
  return {
    name: itemData?.name || 'Unknown',
    color: itemData?.color || '#808080',
    maxDurability: itemData?.durability,
  };
}
