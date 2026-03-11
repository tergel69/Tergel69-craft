import { BiomeType as TerrainBiomeType } from '@/engine/TerrainGenerator';

const BIOME_ORDER = Object.values(TerrainBiomeType);
const BIOME_TO_INDEX = new Map<TerrainBiomeType, number>(
  BIOME_ORDER.map((biome, index) => [biome, index])
);

export function encodeTerrainBiome(biome: TerrainBiomeType): number {
  return BIOME_TO_INDEX.get(biome) ?? 0;
}

export function decodeTerrainBiome(index: number): TerrainBiomeType {
  return BIOME_ORDER[index] ?? TerrainBiomeType.PLAINS;
}
