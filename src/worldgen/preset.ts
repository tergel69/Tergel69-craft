import {
  ABYSS_BAND_Y,
  DEEP_CAVE_BAND_Y,
  MAX_WORLD_Y,
  MIN_WORLD_Y,
  SEA_LEVEL,
  SURFACE_BAND_MAX_Y,
  SURFACE_BAND_MIN_Y,
  WORLD_HEIGHT,
} from '@/utils/constants';
import { BlockType } from '@/data/blocks';
import type { DimensionId, StructureType } from '@/engine/ProgressionState';

export type WorldgenPresetVersion = 'legacy_v1' | 'mythic_vertical_v2';

export interface CaveBiomeConfig {
  id: string;
  minY: number;
  maxY: number;
  floorBlock: BlockType;
  fillerBlock: BlockType;
  liquidBlock?: BlockType;
  hazard?: 'none' | 'magma' | 'abyssal_darkness' | 'frozen_void';
}

export interface BiomeConfigV2 {
  id: string;
  displayName: string;
  temperature: [number, number];
  humidity: [number, number];
  terrain: {
    baseHeight: number;
    heightVariance: number;
    mountainBoost: number;
    cliffBias: number;
    erosionResistance: number;
  };
  surface: {
    top: BlockType;
    subsurface: BlockType;
    filler: BlockType;
  };
  caveBiomes: string[];
  signatureStructures: StructureType[];
}

export interface StructureTheme {
  id: string;
  displayName: string;
  primaryBlocks: BlockType[];
  accentBlocks: BlockType[];
  dimension: DimensionId;
}

export interface MegaStructureTemplate {
  id: string;
  theme: string;
  dimension: DimensionId;
  districts: string[];
  minChunks: number;
  maxChunks: number;
  anchorYOffset: number;
}

export interface DimensionGeneratorConfig {
  id: DimensionId;
  presetVersion: WorldgenPresetVersion;
  minWorldY: number;
  maxWorldY: number;
  seaLevel: number;
  spawnBand: [number, number];
  climateBands: Array<{
    id: string;
    minY: number;
    maxY: number;
  }>;
  caveBiomes: CaveBiomeConfig[];
}

export const ACTIVE_WORLDGEN_PRESET_VERSION: WorldgenPresetVersion = 'mythic_vertical_v2';

export const DEFAULT_BIOME_CONFIGS_V2: Record<string, BiomeConfigV2> = {
  stormpeak_highlands: {
    id: 'stormpeak_highlands',
    displayName: 'Stormpeak Highlands',
    temperature: [0.1, 0.4],
    humidity: [0.35, 0.7],
    terrain: { baseHeight: 148, heightVariance: 120, mountainBoost: 250, cliffBias: 0.82, erosionResistance: 0.78 },
    surface: { top: BlockType.STONE, subsurface: BlockType.STONE, filler: BlockType.STONE },
    caveBiomes: ['cathedral_caverns', 'magma_faults'],
    signatureStructures: ['mountain_citadel', 'stronghold'],
  },
  ember_caldera: {
    id: 'ember_caldera',
    displayName: 'Ember Caldera',
    temperature: [0.75, 1.0],
    humidity: [0.15, 0.55],
    terrain: { baseHeight: 92, heightVariance: 88, mountainBoost: 180, cliffBias: 0.74, erosionResistance: 0.9 },
    surface: { top: BlockType.BASALT, subsurface: BlockType.NETHERRACK, filler: BlockType.OBSIDIAN },
    caveBiomes: ['magma_faults', 'underworld_abyss'],
    signatureStructures: ['mountain_citadel', 'ruined_portal'],
  },
  skyroot_forest: {
    id: 'skyroot_forest',
    displayName: 'Skyroot Forest',
    temperature: [0.35, 0.7],
    humidity: [0.55, 0.95],
    terrain: { baseHeight: 82, heightVariance: 54, mountainBoost: 64, cliffBias: 0.42, erosionResistance: 0.52 },
    surface: { top: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
    caveBiomes: ['upper_lush', 'cathedral_caverns'],
    signatureStructures: ['mansion', 'pillager_outpost'],
  },
  shattered_badlands: {
    id: 'shattered_badlands',
    displayName: 'Shattered Badlands',
    temperature: [0.72, 1.0],
    humidity: [0.0, 0.22],
    terrain: { baseHeight: 88, heightVariance: 72, mountainBoost: 96, cliffBias: 0.88, erosionResistance: 0.84 },
    surface: { top: BlockType.RED_SAND, subsurface: BlockType.TERRACOTTA, filler: BlockType.TERRACOTTA },
    caveBiomes: ['cathedral_caverns', 'magma_faults'],
    signatureStructures: ['desert_temple', 'mineshaft'],
  },
  blooming_giantsteppe: {
    id: 'blooming_giantsteppe',
    displayName: 'Blooming Giantsteppe',
    temperature: [0.4, 0.75],
    humidity: [0.25, 0.6],
    terrain: { baseHeight: 74, heightVariance: 38, mountainBoost: 48, cliffBias: 0.28, erosionResistance: 0.58 },
    surface: { top: BlockType.GRASS, subsurface: BlockType.DIRT, filler: BlockType.STONE },
    caveBiomes: ['upper_lush', 'cathedral_caverns'],
    signatureStructures: ['pillager_outpost', 'shipwreck'],
  },
  crystal_barrens: {
    id: 'crystal_barrens',
    displayName: 'Crystal Barrens',
    temperature: [0.18, 0.45],
    humidity: [0.05, 0.25],
    terrain: { baseHeight: 96, heightVariance: 44, mountainBoost: 84, cliffBias: 0.63, erosionResistance: 0.72 },
    surface: { top: BlockType.CALCITE, subsurface: BlockType.TUFF, filler: BlockType.STONE },
    caveBiomes: ['cathedral_caverns', 'underworld_abyss'],
    signatureStructures: ['stronghold', 'ancient_city'],
  },
  moonfrost_tundra: {
    id: 'moonfrost_tundra',
    displayName: 'Moonfrost Tundra',
    temperature: [0.0, 0.16],
    humidity: [0.3, 0.75],
    terrain: { baseHeight: 86, heightVariance: 46, mountainBoost: 90, cliffBias: 0.52, erosionResistance: 0.66 },
    surface: { top: BlockType.SNOW, subsurface: BlockType.ICE, filler: BlockType.STONE },
    caveBiomes: ['upper_lush', 'cathedral_caverns'],
    signatureStructures: ['stronghold', 'pillager_outpost'],
  },
  sunken_hollow_basin: {
    id: 'sunken_hollow_basin',
    displayName: 'Sunken Hollow Basin',
    temperature: [0.3, 0.72],
    humidity: [0.6, 1.0],
    terrain: { baseHeight: SEA_LEVEL - 42, heightVariance: 26, mountainBoost: 20, cliffBias: 0.31, erosionResistance: 0.4 },
    surface: { top: BlockType.SAND, subsurface: BlockType.DIRT, filler: BlockType.STONE },
    caveBiomes: ['upper_lush', 'cathedral_caverns', 'magma_faults'],
    signatureStructures: ['ancient_city', 'witch_hut'],
  },
};

export const DEFAULT_STRUCTURE_THEMES: Record<string, StructureTheme> = {
  highland_citadel: {
    id: 'highland_citadel',
    displayName: 'Highland Citadel',
    primaryBlocks: [BlockType.STONEBRICK, BlockType.POLISHED_ANDESITE, BlockType.COBBLESTONE],
    accentBlocks: [BlockType.SEA_LANTERN, BlockType.OAK_PLANKS],
    dimension: 'overworld',
  },
  sunken_necropolis: {
    id: 'sunken_necropolis',
    displayName: 'Sunken Necropolis',
    primaryBlocks: [BlockType.SANDSTONE, BlockType.SMOOTH_STONE, BlockType.TERRACOTTA],
    accentBlocks: [BlockType.GLOWSTONE, BlockType.TERRACOTTA_ORANGE],
    dimension: 'overworld',
  },
  radiant_ruins: {
    id: 'radiant_ruins',
    displayName: 'Radiant Ruins',
    primaryBlocks: [BlockType.QUARTZ_BLOCK, BlockType.CALCITE, BlockType.SEA_LANTERN],
    accentBlocks: [BlockType.GOLD_BLOCK, BlockType.GLASS],
    dimension: 'aether',
  },
  void_bastion: {
    id: 'void_bastion',
    displayName: 'Void Bastion',
    primaryBlocks: [BlockType.DEEPSLATE, BlockType.BLACKSTONE, BlockType.OBSIDIAN],
    accentBlocks: [BlockType.AMETHYST_BLOCK, BlockType.GLOWSTONE],
    dimension: 'underdeep',
  },
};

export const DEFAULT_MEGA_STRUCTURE_TEMPLATES: Record<string, MegaStructureTemplate> = {
  mountain_citadel: {
    id: 'mountain_citadel',
    theme: 'highland_citadel',
    dimension: 'overworld',
    districts: ['gate', 'outer_wall', 'forge', 'keep', 'observatory'],
    minChunks: 6,
    maxChunks: 14,
    anchorYOffset: 18,
  },
  sky_sanctuary: {
    id: 'sky_sanctuary',
    theme: 'radiant_ruins',
    dimension: 'aether',
    districts: ['landing_ring', 'ruined_halls', 'cloud_garden', 'spire'],
    minChunks: 8,
    maxChunks: 16,
    anchorYOffset: 24,
  },
  underdeep_gate: {
    id: 'underdeep_gate',
    theme: 'void_bastion',
    dimension: 'underdeep',
    districts: ['causeway', 'obsidian_dais', 'vault', 'rift_chapel'],
    minChunks: 7,
    maxChunks: 15,
    anchorYOffset: -12,
  },
};

export const DEFAULT_DIMENSION_GENERATOR_CONFIGS: Record<DimensionId, DimensionGeneratorConfig> = {
  overworld: {
    id: 'overworld',
    presetVersion: ACTIVE_WORLDGEN_PRESET_VERSION,
    minWorldY: MIN_WORLD_Y,
    maxWorldY: MAX_WORLD_Y,
    seaLevel: SEA_LEVEL,
    spawnBand: [SURFACE_BAND_MIN_Y, SURFACE_BAND_MAX_Y],
    climateBands: [
      { id: 'abyss', minY: MIN_WORLD_Y, maxY: ABYSS_BAND_Y },
      { id: 'deep_caves', minY: ABYSS_BAND_Y, maxY: DEEP_CAVE_BAND_Y },
      { id: 'surface', minY: SURFACE_BAND_MIN_Y, maxY: SURFACE_BAND_MAX_Y },
      { id: 'highlands', minY: SURFACE_BAND_MAX_Y, maxY: MAX_WORLD_Y },
    ],
    caveBiomes: [
      { id: 'upper_lush', minY: -32, maxY: 96, floorBlock: BlockType.STONE, fillerBlock: BlockType.DIRT, liquidBlock: BlockType.WATER, hazard: 'none' },
      { id: 'cathedral_caverns', minY: -224, maxY: 32, floorBlock: BlockType.DEEPSLATE ?? BlockType.STONE, fillerBlock: BlockType.TUFF ?? BlockType.STONE, hazard: 'none' },
      { id: 'magma_faults', minY: -480, maxY: -128, floorBlock: BlockType.BASALT, fillerBlock: BlockType.NETHERRACK, liquidBlock: BlockType.LAVA, hazard: 'magma' },
      { id: 'underworld_abyss', minY: MIN_WORLD_Y, maxY: -448, floorBlock: BlockType.OBSIDIAN, fillerBlock: BlockType.OBSIDIAN, liquidBlock: BlockType.LAVA, hazard: 'abyssal_darkness' },
    ],
  },
  nether: {
    id: 'nether',
    presetVersion: ACTIVE_WORLDGEN_PRESET_VERSION,
    minWorldY: -128,
    maxWorldY: 384,
    seaLevel: 32,
    spawnBand: [24, 96],
    climateBands: [{ id: 'inferno', minY: -128, maxY: 384 }],
    caveBiomes: [],
  },
  end: {
    id: 'end',
    presetVersion: ACTIVE_WORLDGEN_PRESET_VERSION,
    minWorldY: -64,
    maxWorldY: 320,
    seaLevel: 0,
    spawnBand: [48, 96],
    climateBands: [{ id: 'void_isles', minY: -64, maxY: 320 }],
    caveBiomes: [],
  },
  aether: {
    id: 'aether',
    presetVersion: ACTIVE_WORLDGEN_PRESET_VERSION,
    minWorldY: 64,
    maxWorldY: 896,
    seaLevel: 320,
    spawnBand: [280, 420],
    climateBands: [{ id: 'sky_ocean', minY: 64, maxY: 896 }],
    caveBiomes: [],
  },
  underdeep: {
    id: 'underdeep',
    presetVersion: ACTIVE_WORLDGEN_PRESET_VERSION,
    minWorldY: -896,
    maxWorldY: 128,
    seaLevel: -320,
    spawnBand: [-256, -128],
    climateBands: [{ id: 'void_caverns', minY: -896, maxY: 128 }],
    caveBiomes: [],
  },
};
