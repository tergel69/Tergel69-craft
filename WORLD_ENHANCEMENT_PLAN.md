# World Enhancement Plan

## Executive Summary
This plan addresses all requested improvements to the Minecraft world generation and rendering systems. Each enhancement is prioritized and systematically implemented to ensure compatibility and stability.

---

## 1. Look-Based Chunk Loading System

### Current State
- Chunks load based purely on Euclidean distance from player position
- No consideration of player's viewing direction

### Implementation Plan
1. **Add camera direction tracking** in ChunkLoadingSystem
2. **Calculate view frustum** from player's look direction
3. **Priority boost** for chunks in viewing direction (+50% priority bonus)
4. **View distance multiplier**:chunks within 45° of look direction get faster loading
5. **Maintain backward compatibility**: still load nearby chunks regardless of direction

### Files to Modify
- `src/engine/ChunkLoadingSystem.ts`

---

## 2. Structure Placement on Solid Blocks

### Current State
- Terrain analysis exists but may place structures on any surface
- No explicit solid block requirement enforcement

### Implementation Plan
1. **Enhance `analyzeTerrain()`** to explicitly check for solid ground
2. **Add `minSolidBlocks` parameter**: Require N consecutive solid blocks below surface
3. **Reject placement** if surface block is AIR, WATER, or LAVA
4. **Check foundation stability**: Block below must be solid stone/dirt/grass
5. **Add slope tolerance**: Max 1 block height difference across structure footprint

### Files to Modify
- `src/structures/StructurePlacementEngine.ts`

---

## 3. Increased Orange/Cherry Blossom Tree Spawn Rates

### Current State
- Cherry Grove: `treeDensity: 0.12` (12% per chunk)
- Orange Grove: `treeDensity: 0.15` (15% per chunk)

### Implementation Plan
1. **Increase Cherry Grove density**: `0.12 → 0.25` (doubled)
2. **Increase Orange Grove density**: `0.15 → 0.30` (doubled)
3. **Add new Cherry biome occurrences**: Reduce biome noise scale for more frequent cherry groves
4. **Add Orange trees to more biomes**: Allow in plains/sunflower_plains with low density (0.03)

### Files to Modify
- `src/engine/TerrainGenerator.ts` (BIOMES config)

---

## 4. Majestic Sky Enhancement

### Current State
- Basic sky dome with time-based colors
- Simple fog implementation
- Sun/moon with basic shaders

### Implementation Plan
1. **Enhanced Fog System**:
   - Add distance-based exponential fog
   - Add height-based fog density (thicker near water/ground)
   - Color varies with biome and time of day

2. **Vibrant Sky Colors**:
   - Expand color palette for each time period
   - Add purple/pink tints for dawn/dusk
   - Add gradient transitions between periods

3. **Sky Shaders**:
   - Add atmospheric scattering simulation
   - Add sun ray/God ray effects
   - Add subtle animated cloud layers
   - Add horizon glow effect

4. **Weather Integration**:
   - Fog density increases during rain
   - Storm clouds with darker colors

### Files to Modify
- `src/components/Sky.tsx`
- `src/components/OptimizedSky.tsx`

---

## 5. Advanced Shader System

### Current State
- PBR-based block shaders
- Basic fog and color grading
- Volumetric fog approximation

### Implementation Plan
1. **Enhanced Block Shaders**:
   - Better subsurface scattering for leaves/transparent blocks
   - Wetness effect for water-adjacent blocks
   - Snow accumulation on cold biomes/topography

2. **Water Rendering**:
   - Animated wave displacement
   - Underwater fog with murkiness based on depth
   - Caustics projection on underwater surfaces

3. **Post-Processing**:
   - Bloom for bright areas
   - Color grading presets per biome
   - Vignette effect

4. **Performance Optimization**:
   - LOD-based shader complexity
   - Frustum culling for shader calculations

### Files to Modify
- `src/engine/AdvancedShaders.ts`
- `src/engine/OptimizedShaderSystem.ts`

---

## 6. Rivers and Ponds

### Current State
- Basic ocean biomes exist
- No explicit river generation

### Implementation Plan
1. **River Generation**:
   - Add river noise layer (low frequency, 1D)
   - Carve rivers into terrain using negative height offset
   - River width: 3-8 blocks
   - Connect oceans to form continuous water networks
   - Depth: 1-3 blocks below surrounding terrain

2. **Pond Generation**:
   - Small-scale water bodies in low areas
   - Chance-based spawn in valleys
   - Size: 3-9 blocks diameter
   - Often found near biome borders

3. **Integration**:
   - Rivers carve through other biomes
   - Underground aquifers for caves

### Files to Modify
- `src/engine/TerrainGenerator.ts`
- `src/engine/NewGenerationTerrainGenerator.ts`

---

## 7. Deep Ocean Biomes

### Current State
- DEEP_OCEAN biome exists with `minHeight: 20, maxHeight: 45`
- Not significantly different from regular ocean

### Implementation Plan
1. **Extreme Depth**: `minHeight: 1, maxHeight: 20` (very deep, near void)
2. **Add Underwater Canyons**: Carved valleys in ocean floor
3. **Ocean Monuments**: Spawn only in deep oceans
4. **Underwater Ruins**: More common in deep oceans
5. **Darkness System**: Extreme depth = near zero light
6. **Visibility**: Add underwater fog that gets darker with depth

### Files to Modify
- `src/engine/TerrainGenerator.ts` (BIOMES config)

---

## 8. 1.18-Style Terrain Generation

### Current State
- MOUNTAINS biome: `minHeight: 80, maxHeight: 200`
- MEGA_MOUNTAINS: `minHeight: 100, maxHeight: 256`

### Implementation Plan
1. **Improved Height Noise**:
   - Multiple octaves for natural variation
   - Ridged noise for sharp peaks
   - Terrain Carver for cave-like valleys

2. **Extended Mountain Range**:
   - Increase MEGA_MOUNTAINS frequency
   - Add "jagged peaks" variant with extreme height (up to 300)
   - Snow line at height 180+ (snowy peaks)

3. **Erosion Simulation**:
   - Add erosion noise layer
   - Creates flatter valleys between peaks

4. **Valley/Badlands Combination**:
   - Carved valleys through mountains
   - Exposed terracotta layers in eroded areas

### Files to Modify
- `src/engine/TerrainGenerator.ts`
- `src/utils/noise.ts`

---

## 9. Bug Prevention & Testing Checklist

### Structure Placement Bugs
- [ ] Verify structures don't spawn on water
- [ ] Verify structures don't spawn on lava
- [ ] Verify structures don't float in air
- [ ] Verify trees don't spawn underground

### Terrain Generation Bugs
- [ ] Check for floating islands (overhangs handled properly)
- [ ] Verify water doesn't flow into void
- [ ] Check for excessive terrain height differences
- [ ] Verify biomes blend smoothly

### Chunk Loading Bugs
- [ ] Verify chunks load when looking in direction
- [ ] Ensure no chunk loading deadlocks
- [ ] Check for memory leaks with chunk pooling
- [ ] Verify chunk unloading works correctly

### Rendering Bugs
- [ ] Verify fog renders correctly at all distances
- [ ] Check for z-fighting on transparent surfaces
- [ ] Verify sky renders on top of all terrain
- [ ] Check underwater rendering

---

## Implementation Priority

### Phase 1: Critical Fixes
1. Structure placement on solid blocks (gameplay critical)
2. Look-based chunk loading (usability)
3. Bug verification

### Phase 2: Visual Enhancement
4. Sky enhancement
5. Shader upgrades
6. Water rendering

### Phase 3: World Generation
7. Rivers and ponds
8. Deep oceans
9. 1.18 terrain

---

## File Modification Summary

| Feature | Primary Files | Secondary Files |
|---------|---------------|-----------------|
| Chunk Loading | `ChunkLoadingSystem.ts` | `ChunkManager.ts`, `WorldManager.ts` |
| Structure Placement | `StructurePlacementEngine.ts` | `StructureRegistry.ts`, `TerrainGenerator.ts` |
| Tree Density | `TerrainGenerator.ts` | `biomes.ts` |
| Sky System | `Sky.tsx`, `OptimizedSky.tsx` | `AdvancedShaders.ts` |
| Shaders | `AdvancedShaders.ts`, `OptimizedShaderSystem.ts` | `TextureShaderMaterial.ts` |
| Water Features | `TerrainGenerator.ts`, `NewGenerationTerrainGenerator.ts` | `noise.ts` |
| Terrain | `TerrainGenerator.ts` | `noise.ts`, `biomes.ts` |

---

## Compatibility Notes

- All changes maintain backward compatibility with existing saves
- Chunk loading changes are additive (still loads nearby chunks)
- New terrain features only apply to newly generated chunks
- Shader changes fall back gracefully on lower-end hardware
