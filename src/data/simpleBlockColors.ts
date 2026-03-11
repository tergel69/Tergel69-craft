import * as THREE from 'three';

// Simple color mapping for blocks - much easier than complex textures
export const BLOCK_COLORS: Record<number, string> = {
  // Basic blocks
  0: '#808080', // AIR - gray (shouldn't be visible)
  1: '#55FF55', // GRASS - bright green
  2: '#6B4A2B', // DIRT - brown
  3: '#8A8A8A', // STONE - gray
  4: '#7A7A7A', // COBBLESTONE - darker gray
  5: '#D4C28A', // SAND - yellow
  6: '#3F76E4', // WATER - blue
  7: '#D96415', // LAVA - red-orange
  
  // Wood types
  8: '#8B5A2B',  // OAK_LOG - wood brown
  9: '#D2B48C',  // BIRCH_LOG - light wood
  10: '#5D4037', // SPRUCE_LOG - dark wood
  11: '#6B4A2B', // JUNGLE_LOG - jungle wood
  12: '#8B4513', // ACACIA_LOG - acacia wood
  13: '#3A2A1B', // DARK_OAK_LOG - dark wood
  
  // Planks
  14: '#C28F4C', // OAK_PLANKS - oak plank
  15: '#E6D3A7', // BIRCH_PLANKS - birch plank
  16: '#A1694F', // SPRUCE_PLANKS - spruce plank
  17: '#8B5A2B', // JUNGLE_PLANKS - jungle plank
  18: '#D2B48C', // ACACIA_PLANKS - acacia plank
  19: '#6B4A2B', // DARK_OAK_PLANKS - dark oak plank
  
  // Leaves
  20: '#5A8F2F', // OAK_LEAVES - oak green
  21: '#6BAF4F', // BIRCH_LEAVES - birch green
  22: '#4A7F2F', // SPRUCE_LEAVES - spruce green
  23: '#6A9F3F', // JUNGLE_LEAVES - jungle green
  24: '#7ABF5F', // ACACIA_LEAVES - acacia green
  25: '#4A6F2F', // DARK_OAK_LEAVES - dark oak green
  
  // Other blocks
  26: '#66CCFF', // GLASS - light blue
  27: '#3A3A3A', // COAL_ORE - black/dark gray
  28: '#7A7A7A', // IRON_ORE - iron gray
  29: '#FFCC00', // GOLD_ORE - gold yellow
  30: '#00BFFF', // DIAMOND_ORE - cyan
  31: '#FF0000', // REDSTONE_ORE - red
  32: '#3333FF', // LAPIS_ORE - blue
  33: '#00FF00', // EMERALD_ORE - green
  34: '#CC8844', // COPPER_ORE - copper
  35: '#333333', // DEEPSLATE - very dark gray
  36: '#DDAA66', // SANDSTONE - sandstone yellow
  37: '#111111', // BEDROCK - very dark
  38: '#555555', // GRAVEL - medium gray
  39: '#996633', // CLAY - clay brown
  40: '#66FF66', // TALL_GRASS - bright green
  41: '#FF5555', // FLOWER_RED - red
  42: '#FFFF55', // FLOWER_YELLOW - yellow
  43: '#338833', // CACTUS - cactus green
  44: '#44AA44', // SUGAR_CANE - cane green
  45: '#FF8800', // PUMPKIN - orange
  46: '#557755', // MOSSY_COBBLESTONE - mossy green-gray
  47: '#AAAAAA', // DRIPSTONE_BLOCK - light gray
  48: '#885500', // CHEST - chest brown
  49: '#444444', // CAULDRON - cauldron dark gray
};

// Simple color system that returns solid colors for blocks
export class SimpleBlockColorSystem {
  private colorCache = new Map<number, THREE.Color>();

  getBlockColor(blockType: number): THREE.Color {
    if (this.colorCache.has(blockType)) {
      return this.colorCache.get(blockType)!;
    }

    const hexColor = BLOCK_COLORS[blockType] || '#808080'; // Default gray
    const color = new THREE.Color(hexColor);
    
    this.colorCache.set(blockType, color);
    return color;
  }

  clearCache(): void {
    this.colorCache.clear();
  }
}

export const simpleBlockColorSystem = new SimpleBlockColorSystem();