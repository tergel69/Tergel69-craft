import { BlockType } from './blocks';

export enum BiomeType {
  PLAINS = 'plains',
  FOREST = 'forest',
  BIRCH_FOREST = 'birch_forest',
  TAIGA = 'taiga',
  DESERT = 'desert',
  MOUNTAINS = 'mountains',
  OCEAN = 'ocean',
  BEACH = 'beach',
  SWAMP = 'swamp',
  JUNGLE = 'jungle',
  SNOWY_PLAINS = 'snowy_plains',
  SNOWY_TAIGA = 'snowy_taiga',
  // New biomes
  MESA = 'mesa',
  SAVANNA = 'savanna',
  ICE_SPIKES = 'ice_spikes',
  MUSHROOM_ISLAND = 'mushroom_island',
  DARK_FOREST = 'dark_forest',
  FLOWER_FOREST = 'flower_forest',
  CHERRY_GROVE = 'cherry_grove',
  MEADOW = 'meadow',
  DEEP_OCEAN = 'deep_ocean',
  FROZEN_OCEAN = 'frozen_ocean',
  RIVER = 'river',
  BAMBOO_JUNGLE = 'bamboo_jungle',
  SPARSE_JUNGLE = 'sparse_jungle',
  WINDSWEPT_HILLS = 'windswept_hills',
  STONY_PEAKS = 'stony_peaks',
  SNOWY_SLOPES = 'snowy_slopes',
}

export interface BiomeData {
  id: BiomeType;
  name: string;
  temperature: [number, number]; // [min, max] range
  humidity: [number, number]; // [min, max] range
  baseHeight: number;
  heightVariation: number;
  surfaceBlock: BlockType;
  subsurfaceBlock: BlockType;
  underwaterBlock: BlockType;
  treeType: BlockType | null;
  leavesType: BlockType | null;
  treeDensity: number; // 0-1
  grassDensity: number; // 0-1
  flowerDensity: number; // 0-1
  hasSnow: boolean;
  waterColor: string;
  skyColor: string;
  fogColor: string;
  foliageColor: string;
  grassColor: string;
  // New properties
  secondaryTreeType?: BlockType | null;
  secondaryLeavesType?: BlockType | null;
  specialFeatures?: string[];
}

export const BIOMES: Record<BiomeType, BiomeData> = {
  [BiomeType.PLAINS]: {
    id: BiomeType.PLAINS,
    name: 'Plains',
    temperature: [0.4, 0.7],
    humidity: [0.3, 0.6],
    baseHeight: 64,
    heightVariation: 3,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.008,
    grassDensity: 0.4,
    flowerDensity: 0.03,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#77AB2F',
    grassColor: '#91BD59',
  },
  [BiomeType.FOREST]: {
    id: BiomeType.FOREST,
    name: 'Forest',
    temperature: [0.4, 0.7],
    humidity: [0.6, 0.9],
    baseHeight: 64,
    heightVariation: 5,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    secondaryTreeType: BlockType.BIRCH_LOG,
    secondaryLeavesType: BlockType.BIRCH_LEAVES,
    treeDensity: 0.15,
    grassDensity: 0.25,
    flowerDensity: 0.04,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#59AE30',
    grassColor: '#79C05A',
  },
  [BiomeType.BIRCH_FOREST]: {
    id: BiomeType.BIRCH_FOREST,
    name: 'Birch Forest',
    temperature: [0.4, 0.6],
    humidity: [0.5, 0.8],
    baseHeight: 64,
    heightVariation: 4,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.BIRCH_LOG,
    leavesType: BlockType.BIRCH_LEAVES,
    treeDensity: 0.12,
    grassDensity: 0.2,
    flowerDensity: 0.05,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#6BA941',
    grassColor: '#88BB67',
  },
  [BiomeType.TAIGA]: {
    id: BiomeType.TAIGA,
    name: 'Taiga',
    temperature: [0.1, 0.4],
    humidity: [0.5, 0.8],
    baseHeight: 64,
    heightVariation: 6,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.SPRUCE_LOG,
    leavesType: BlockType.SPRUCE_LEAVES,
    treeDensity: 0.14,
    grassDensity: 0.15,
    flowerDensity: 0.01,
    hasSnow: false,
    waterColor: '#287082',
    skyColor: '#6B9BB6',
    fogColor: '#A4C4D4',
    foliageColor: '#68A55F',
    grassColor: '#86B783',
  },
  [BiomeType.DESERT]: {
    id: BiomeType.DESERT,
    name: 'Desert',
    temperature: [0.8, 1.0],
    humidity: [0.0, 0.2],
    baseHeight: 64,
    heightVariation: 2,
    surfaceBlock: BlockType.SAND,
    subsurfaceBlock: BlockType.SAND,
    underwaterBlock: BlockType.SAND,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#32A598',
    skyColor: '#6EB1FF',
    fogColor: '#D4E8FF',
    foliageColor: '#AEA42A',
    grassColor: '#BFB755',
    specialFeatures: ['cacti', 'dead_bush'],
  },
  [BiomeType.MOUNTAINS]: {
    id: BiomeType.MOUNTAINS,
    name: 'Mountains',
    temperature: [0.2, 0.5],
    humidity: [0.3, 0.6],
    baseHeight: 90,
    heightVariation: 60,
    surfaceBlock: BlockType.STONE,
    subsurfaceBlock: BlockType.STONE,
    underwaterBlock: BlockType.GRAVEL,
    treeType: BlockType.SPRUCE_LOG,
    leavesType: BlockType.SPRUCE_LEAVES,
    treeDensity: 0.03,
    grassDensity: 0.08,
    flowerDensity: 0.01,
    hasSnow: true,
    waterColor: '#0084FF',
    skyColor: '#8BB9FF',
    fogColor: '#C0D4FF',
    foliageColor: '#6DA36B',
    grassColor: '#8AB689',
    specialFeatures: ['emeralds', 'goats'],
  },
  [BiomeType.OCEAN]: {
    id: BiomeType.OCEAN,
    name: 'Ocean',
    temperature: [0.3, 0.6],
    humidity: [0.8, 1.0],
    baseHeight: 36,
    heightVariation: 5,
    surfaceBlock: BlockType.GRAVEL,
    subsurfaceBlock: BlockType.GRAVEL,
    underwaterBlock: BlockType.SAND,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#71A74D',
    grassColor: '#8EB971',
    specialFeatures: ['kelp', 'seagrass'],
  },
  [BiomeType.BEACH]: {
    id: BiomeType.BEACH,
    name: 'Beach',
    temperature: [0.5, 0.8],
    humidity: [0.4, 0.7],
    baseHeight: 62,
    heightVariation: 1,
    surfaceBlock: BlockType.SAND,
    subsurfaceBlock: BlockType.SAND,
    underwaterBlock: BlockType.SAND,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#157CAB',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#71A74D',
    grassColor: '#A7DB76',
    specialFeatures: ['sugar_cane', 'turtles'],
  },
  [BiomeType.SWAMP]: {
    id: BiomeType.SWAMP,
    name: 'Swamp',
    temperature: [0.5, 0.7],
    humidity: [0.8, 1.0],
    baseHeight: 62,
    heightVariation: 2,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.CLAY,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.06,
    grassDensity: 0.5,
    flowerDensity: 0.02,
    hasSnow: false,
    waterColor: '#617B64',
    skyColor: '#6A7469',
    fogColor: '#9DA89D',
    foliageColor: '#6A7039',
    grassColor: '#6A7039',
    specialFeatures: ['lily_pads', 'vines', 'witch_huts'],
  },
  [BiomeType.JUNGLE]: {
    id: BiomeType.JUNGLE,
    name: 'Jungle',
    temperature: [0.8, 1.0],
    humidity: [0.8, 1.0],
    baseHeight: 64,
    heightVariation: 10,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.JUNGLE_LOG,
    leavesType: BlockType.JUNGLE_LEAVES,
    treeDensity: 0.25,
    grassDensity: 0.6,
    flowerDensity: 0.08,
    hasSnow: false,
    waterColor: '#14A2C5',
    skyColor: '#64C8FF',
    fogColor: '#A0D8FF',
    foliageColor: '#30BB0B',
    grassColor: '#59C93C',
    specialFeatures: ['vines', 'cocoa', 'melons', 'parrots'],
  },
  [BiomeType.SNOWY_PLAINS]: {
    id: BiomeType.SNOWY_PLAINS,
    name: 'Snowy Plains',
    temperature: [0.0, 0.2],
    humidity: [0.2, 0.5],
    baseHeight: 64,
    heightVariation: 3,
    surfaceBlock: BlockType.SNOW,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.SPRUCE_LOG,
    leavesType: BlockType.SPRUCE_LEAVES,
    treeDensity: 0.003,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: true,
    waterColor: '#3D57D6',
    skyColor: '#A4B5D8',
    fogColor: '#D4E0F0',
    foliageColor: '#60A17B',
    grassColor: '#80B497',
    specialFeatures: ['igloos', 'polar_bears'],
  },
  [BiomeType.SNOWY_TAIGA]: {
    id: BiomeType.SNOWY_TAIGA,
    name: 'Snowy Taiga',
    temperature: [0.0, 0.15],
    humidity: [0.4, 0.7],
    baseHeight: 64,
    heightVariation: 5,
    surfaceBlock: BlockType.SNOW,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.SPRUCE_LOG,
    leavesType: BlockType.SPRUCE_LEAVES,
    treeDensity: 0.12,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: true,
    waterColor: '#3D57D6',
    skyColor: '#8BA5CD',
    fogColor: '#BDD0E8',
    foliageColor: '#60A17B',
    grassColor: '#80B497',
  },
  // New biomes
  [BiomeType.MESA]: {
    id: BiomeType.MESA,
    name: 'Mesa (Badlands)',
    temperature: [0.9, 1.0],
    humidity: [0.0, 0.1],
    baseHeight: 70,
    heightVariation: 25,
    surfaceBlock: BlockType.TERRACOTTA_RED,
    subsurfaceBlock: BlockType.TERRACOTTA_ORANGE,
    underwaterBlock: BlockType.TERRACOTTA,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#4E7F81',
    skyColor: '#FFB87F',
    fogColor: '#FFD4A8',
    foliageColor: '#9E814D',
    grassColor: '#90814D',
    specialFeatures: ['gold_ore', 'terracotta_layers'],
  },
  [BiomeType.SAVANNA]: {
    id: BiomeType.SAVANNA,
    name: 'Savanna',
    temperature: [0.85, 0.95],
    humidity: [0.0, 0.3],
    baseHeight: 68,
    heightVariation: 4,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.ACACIA_LOG,
    leavesType: BlockType.ACACIA_LEAVES,
    treeDensity: 0.02,
    grassDensity: 0.8,
    flowerDensity: 0.01,
    hasSnow: false,
    waterColor: '#44AFF5',
    skyColor: '#A0D8FF',
    fogColor: '#C8E8FF',
    foliageColor: '#AEA42A',
    grassColor: '#BFB755',
    specialFeatures: ['horses', 'llamas'],
  },
  [BiomeType.ICE_SPIKES]: {
    id: BiomeType.ICE_SPIKES,
    name: 'Ice Spikes',
    temperature: [-0.1, 0.0],
    humidity: [0.3, 0.6],
    baseHeight: 64,
    heightVariation: 4,
    surfaceBlock: BlockType.SNOW,
    subsurfaceBlock: BlockType.PACKED_ICE,
    underwaterBlock: BlockType.ICE,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: true,
    waterColor: '#3938C9',
    skyColor: '#96B5C9',
    fogColor: '#BED0DC',
    foliageColor: '#60A17B',
    grassColor: '#80B497',
    specialFeatures: ['ice_spikes', 'packed_ice'],
  },
  [BiomeType.MUSHROOM_ISLAND]: {
    id: BiomeType.MUSHROOM_ISLAND,
    name: 'Mushroom Island',
    temperature: [0.7, 0.8],
    humidity: [0.9, 1.0],
    baseHeight: 64,
    heightVariation: 8,
    surfaceBlock: BlockType.GRASS, // Would be mycelium if available
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#8E52A8',
    skyColor: '#9C7CDA',
    fogColor: '#C8B8DC',
    foliageColor: '#55C93F',
    grassColor: '#55C93F',
    specialFeatures: ['huge_mushrooms', 'mooshrooms'],
  },
  [BiomeType.DARK_FOREST]: {
    id: BiomeType.DARK_FOREST,
    name: 'Dark Forest',
    temperature: [0.5, 0.7],
    humidity: [0.7, 0.9],
    baseHeight: 64,
    heightVariation: 4,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.DARK_OAK_LOG,
    leavesType: BlockType.DARK_OAK_LEAVES,
    secondaryTreeType: BlockType.OAK_LOG,
    secondaryLeavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.35,
    grassDensity: 0.1,
    flowerDensity: 0.02,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#4A6070',
    fogColor: '#7A8A8A',
    foliageColor: '#28340A',
    grassColor: '#507A32',
    specialFeatures: ['huge_mushrooms', 'woodland_mansions'],
  },
  [BiomeType.FLOWER_FOREST]: {
    id: BiomeType.FLOWER_FOREST,
    name: 'Flower Forest',
    temperature: [0.5, 0.7],
    humidity: [0.6, 0.8],
    baseHeight: 64,
    heightVariation: 5,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.BIRCH_LOG,
    leavesType: BlockType.BIRCH_LEAVES,
    secondaryTreeType: BlockType.OAK_LOG,
    secondaryLeavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.08,
    grassDensity: 0.3,
    flowerDensity: 0.3,
    hasSnow: false,
    waterColor: '#20E3B2',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#6A7039',
    grassColor: '#79C05A',
    specialFeatures: ['all_flowers', 'bees'],
  },
  [BiomeType.CHERRY_GROVE]: {
    id: BiomeType.CHERRY_GROVE,
    name: 'Cherry Grove',
    temperature: [0.5, 0.65],
    humidity: [0.5, 0.7],
    baseHeight: 70,
    heightVariation: 8,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.OAK_LOG, // Would be cherry log
    leavesType: BlockType.OAK_LEAVES, // Would be cherry leaves (pink)
    treeDensity: 0.1,
    grassDensity: 0.4,
    flowerDensity: 0.15,
    hasSnow: false,
    waterColor: '#5DB7EF',
    skyColor: '#F5D0E6',
    fogColor: '#FFEEF5',
    foliageColor: '#B6DB61',
    grassColor: '#B6DB61',
    specialFeatures: ['cherry_petals', 'bees'],
  },
  [BiomeType.MEADOW]: {
    id: BiomeType.MEADOW,
    name: 'Meadow',
    temperature: [0.4, 0.6],
    humidity: [0.5, 0.7],
    baseHeight: 80,
    heightVariation: 6,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.002,
    grassDensity: 0.6,
    flowerDensity: 0.2,
    hasSnow: false,
    waterColor: '#0E4ECF',
    skyColor: '#9BC5FF',
    fogColor: '#C8E0FF',
    foliageColor: '#63A948',
    grassColor: '#83BB6D',
    specialFeatures: ['bee_nests'],
  },
  [BiomeType.DEEP_OCEAN]: {
    id: BiomeType.DEEP_OCEAN,
    name: 'Deep Ocean',
    temperature: [0.3, 0.5],
    humidity: [0.9, 1.0],
    baseHeight: 20,
    heightVariation: 8,
    surfaceBlock: BlockType.GRAVEL,
    subsurfaceBlock: BlockType.GRAVEL,
    underwaterBlock: BlockType.GRAVEL,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#1A3C7F',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#71A74D',
    grassColor: '#8EB971',
    specialFeatures: ['ocean_monuments', 'deep_sea_creatures'],
  },
  [BiomeType.FROZEN_OCEAN]: {
    id: BiomeType.FROZEN_OCEAN,
    name: 'Frozen Ocean',
    temperature: [-0.1, 0.1],
    humidity: [0.7, 0.9],
    baseHeight: 36,
    heightVariation: 5,
    surfaceBlock: BlockType.GRAVEL,
    subsurfaceBlock: BlockType.GRAVEL,
    underwaterBlock: BlockType.GRAVEL,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: true,
    waterColor: '#3938C9',
    skyColor: '#9DB5D4',
    fogColor: '#C8D8E8',
    foliageColor: '#60A17B',
    grassColor: '#80B497',
    specialFeatures: ['icebergs', 'polar_bears'],
  },
  [BiomeType.RIVER]: {
    id: BiomeType.RIVER,
    name: 'River',
    temperature: [0.4, 0.6],
    humidity: [0.7, 0.9],
    baseHeight: 58,
    heightVariation: 2,
    surfaceBlock: BlockType.SAND,
    subsurfaceBlock: BlockType.SAND,
    underwaterBlock: BlockType.CLAY,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.01,
    grassDensity: 0.3,
    flowerDensity: 0.02,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#71A74D',
    grassColor: '#8EB971',
    specialFeatures: ['sugar_cane', 'salmon'],
  },
  [BiomeType.BAMBOO_JUNGLE]: {
    id: BiomeType.BAMBOO_JUNGLE,
    name: 'Bamboo Jungle',
    temperature: [0.85, 1.0],
    humidity: [0.85, 1.0],
    baseHeight: 64,
    heightVariation: 6,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.JUNGLE_LOG,
    leavesType: BlockType.JUNGLE_LEAVES,
    treeDensity: 0.4,
    grassDensity: 0.7,
    flowerDensity: 0.05,
    hasSnow: false,
    waterColor: '#14A2C5',
    skyColor: '#64C8FF',
    fogColor: '#A0D8FF',
    foliageColor: '#30BB0B',
    grassColor: '#59C93C',
    specialFeatures: ['bamboo', 'pandas'],
  },
  [BiomeType.SPARSE_JUNGLE]: {
    id: BiomeType.SPARSE_JUNGLE,
    name: 'Sparse Jungle',
    temperature: [0.8, 0.95],
    humidity: [0.6, 0.8],
    baseHeight: 64,
    heightVariation: 6,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.DIRT,
    underwaterBlock: BlockType.DIRT,
    treeType: BlockType.JUNGLE_LOG,
    leavesType: BlockType.JUNGLE_LEAVES,
    treeDensity: 0.08,
    grassDensity: 0.5,
    flowerDensity: 0.06,
    hasSnow: false,
    waterColor: '#14A2C5',
    skyColor: '#6EC8FF',
    fogColor: '#A8D8FF',
    foliageColor: '#40C71B',
    grassColor: '#64C946',
  },
  [BiomeType.WINDSWEPT_HILLS]: {
    id: BiomeType.WINDSWEPT_HILLS,
    name: 'Windswept Hills',
    temperature: [0.25, 0.45],
    humidity: [0.3, 0.5],
    baseHeight: 80,
    heightVariation: 35,
    surfaceBlock: BlockType.GRASS,
    subsurfaceBlock: BlockType.STONE,
    underwaterBlock: BlockType.GRAVEL,
    treeType: BlockType.OAK_LOG,
    leavesType: BlockType.OAK_LEAVES,
    treeDensity: 0.02,
    grassDensity: 0.1,
    flowerDensity: 0.01,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#78A7FF',
    fogColor: '#C0D8FF',
    foliageColor: '#6DA36B',
    grassColor: '#8AB689',
    specialFeatures: ['emeralds', 'llamas'],
  },
  [BiomeType.STONY_PEAKS]: {
    id: BiomeType.STONY_PEAKS,
    name: 'Stony Peaks',
    temperature: [0.3, 0.5],
    humidity: [0.2, 0.4],
    baseHeight: 100,
    heightVariation: 50,
    surfaceBlock: BlockType.STONE,
    subsurfaceBlock: BlockType.STONE,
    underwaterBlock: BlockType.STONE,
    treeType: null,
    leavesType: null,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: false,
    waterColor: '#3F76E4',
    skyColor: '#8BB9FF',
    fogColor: '#C0D4FF',
    foliageColor: '#6DA36B',
    grassColor: '#8AB689',
    specialFeatures: ['calcite', 'goats'],
  },
  [BiomeType.SNOWY_SLOPES]: {
    id: BiomeType.SNOWY_SLOPES,
    name: 'Snowy Slopes',
    temperature: [0.0, 0.2],
    humidity: [0.3, 0.5],
    baseHeight: 90,
    heightVariation: 40,
    surfaceBlock: BlockType.SNOW,
    subsurfaceBlock: BlockType.STONE,
    underwaterBlock: BlockType.STONE,
    treeType: BlockType.SPRUCE_LOG,
    leavesType: BlockType.SPRUCE_LEAVES,
    treeDensity: 0.01,
    grassDensity: 0,
    flowerDensity: 0,
    hasSnow: true,
    waterColor: '#3D57D6',
    skyColor: '#A4B5D8',
    fogColor: '#D4E0F0',
    foliageColor: '#60A17B',
    grassColor: '#80B497',
    specialFeatures: ['powder_snow', 'goats'],
  },
};

export function getBiome(temperature: number, humidity: number, height: number): BiomeType {
  // Special case for deep ocean (very low height)
  if (height < 30) {
    return BiomeType.DEEP_OCEAN;
  }

  // Special case for ocean (low height)
  if (height < 58) {
    if (temperature < 0.1) {
      return BiomeType.FROZEN_OCEAN;
    }
    return BiomeType.OCEAN;
  }

  // Beach near water level
  if (height >= 58 && height <= 64) {
    if (humidity > 0.55 && temperature > 0.35) {
      return BiomeType.BEACH;
    }
  }

  // River detection (narrow low areas)
  if (height >= 56 && height <= 60 && humidity > 0.7) {
    return BiomeType.RIVER;
  }

  // High altitude biomes
  if (height > 120) {
    if (temperature < 0.2) {
      return BiomeType.SNOWY_SLOPES;
    }
    return BiomeType.STONY_PEAKS;
  }

  // Mountain range
  if (height > 90) {
    if (temperature < 0.2) {
      return BiomeType.SNOWY_SLOPES;
    }
    return BiomeType.WINDSWEPT_HILLS;
  }

  // Meadow (elevated grassland)
  if (height > 80 && temperature > 0.3 && temperature < 0.6 && humidity > 0.5) {
    return BiomeType.MEADOW;
  }

  // Temperature and humidity based biome selection
  if (temperature < 0.0) {
    // Frozen biomes
    if (humidity > 0.5) {
      return BiomeType.ICE_SPIKES;
    }
    return BiomeType.SNOWY_PLAINS;
  } else if (temperature < 0.2) {
    // Cold biomes
    if (humidity > 0.6) {
      return BiomeType.SNOWY_TAIGA;
    }
    return BiomeType.SNOWY_PLAINS;
  } else if (temperature < 0.5) {
    // Temperate biomes
    if (humidity > 0.8) {
      return BiomeType.DARK_FOREST;
    } else if (humidity > 0.7) {
      return BiomeType.TAIGA;
    } else if (humidity > 0.55) {
      return BiomeType.BIRCH_FOREST;
    }
    return BiomeType.PLAINS;
  } else if (temperature < 0.8) {
    // Warm biomes
    if (humidity > 0.85) {
      return BiomeType.SWAMP;
    } else if (humidity > 0.7) {
      return BiomeType.FLOWER_FOREST;
    } else if (humidity > 0.55) {
      return BiomeType.FOREST;
    } else if (humidity > 0.4) {
      return BiomeType.CHERRY_GROVE;
    }
    return BiomeType.PLAINS;
  } else {
    // Hot biomes
    if (humidity > 0.9) {
      return BiomeType.BAMBOO_JUNGLE;
    } else if (humidity > 0.75) {
      return BiomeType.JUNGLE;
    } else if (humidity > 0.6) {
      return BiomeType.SPARSE_JUNGLE;
    } else if (humidity > 0.25) {
      return BiomeType.SAVANNA;
    } else if (humidity > 0.1) {
      return BiomeType.MESA;
    }
    return BiomeType.DESERT;
  }
}

export function getBiomeData(biome: BiomeType): BiomeData {
  return BIOMES[biome];
}
