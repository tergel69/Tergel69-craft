import { createNoise2D, createNoise3D, NoiseFunction2D, NoiseFunction3D } from 'simplex-noise';

// Seeded random number generator
function createSeededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export class NoiseGenerator {
  private noise2D: NoiseFunction2D;
  private noise3D: NoiseFunction3D;
  private caveNoise3D: NoiseFunction3D;
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    const random = createSeededRandom(seed);
    this.noise2D = createNoise2D(random);
    this.noise3D = createNoise3D(createSeededRandom(seed + 1));
    this.caveNoise3D = createNoise3D(createSeededRandom(seed + 2));
  }

  // Basic 2D noise
  get2D(x: number, z: number): number {
    return this.noise2D(x, z);
  }

  // Basic 3D noise
  get3D(x: number, y: number, z: number): number {
    return this.noise3D(x, y, z);
  }

  // Fractal Brownian Motion (multi-octave noise)
  fbm2D(
    x: number,
    z: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    scale: number = 0.01
  ): number {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  fbm3D(
    x: number,
    y: number,
    z: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    scale: number = 0.01
  ): number {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  // Terrain height at a point
  getTerrainHeight(x: number, z: number, baseHeight: number = 64): number {
    // Large scale continental features
    const continental = this.fbm2D(x, z, 4, 0.5, 2.0, 0.001) * 0.5 + 0.5;

    // Medium scale terrain variation
    const terrain = this.fbm2D(x, z, 6, 0.5, 2.0, 0.008);

    // Small scale detail
    const detail = this.fbm2D(x, z, 3, 0.5, 2.0, 0.03) * 0.1;

    // Combine scales
    const heightVariation = 30 * continental + 20 * terrain + detail * 10;

    return Math.floor(baseHeight + heightVariation);
  }

  // Get biome value for temperature/humidity
  getTemperature(x: number, z: number): number {
    return this.fbm2D(x + 5000, z + 5000, 3, 0.5, 2.0, 0.0005) * 0.5 + 0.5;
  }

  getHumidity(x: number, z: number): number {
    return this.fbm2D(x + 10000, z + 10000, 3, 0.5, 2.0, 0.0005) * 0.5 + 0.5;
  }

  // Cave generation noise
  getCaveNoise(x: number, y: number, z: number): number {
    // Use cheese cave algorithm (two 3D noises that need to both be high)
    const noise1 = this.caveNoise3D(x * 0.05, y * 0.05, z * 0.05);
    const noise2 = this.caveNoise3D(x * 0.03 + 100, y * 0.03, z * 0.03 + 100);

    // Caves are more common at lower y levels
    const depthFactor = Math.max(0, 1 - y / 64);

    return (noise1 + noise2) / 2 * (0.5 + depthFactor * 0.5);
  }

  // Check if position should be a cave
  isCave(x: number, y: number, z: number): boolean {
    if (y <= 5 || y >= 120) return false; // No caves at bedrock or high up

    const caveNoise = this.getCaveNoise(x, y, z);
    const threshold = 0.6;

    return caveNoise > threshold;
  }

  // Ore distribution noise
  getOreNoise(x: number, y: number, z: number, oreType: number): number {
    return this.noise3D(
      x * 0.1 + oreType * 1000,
      y * 0.1,
      z * 0.1 + oreType * 1000
    );
  }

  // Tree placement noise
  getTreeNoise(x: number, z: number): number {
    return this.noise2D(x * 0.5, z * 0.5) * 0.5 + 0.5;
  }

  getSeed(): number {
    return this.seed;
  }
}

// Singleton instance for the world
let worldNoise: NoiseGenerator | null = null;

export function getWorldNoise(seed?: number): NoiseGenerator {
  if (!worldNoise || (seed !== undefined && seed !== worldNoise.getSeed())) {
    worldNoise = new NoiseGenerator(seed);
  }
  return worldNoise;
}

export function resetWorldNoise(): void {
  worldNoise = null;
}
