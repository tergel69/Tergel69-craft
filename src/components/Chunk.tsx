'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useWorldStore } from '@/stores/worldStore';
import { buildWaterMesh, createBlockMaterial, createWaterMaterial } from '@/engine/MeshBuilder';
import { buildMultiTextureChunkMesh } from '@/engine/MultiTextureMeshBuilder';
import { CHUNK_SIZE } from '@/utils/constants';
import { textureManager } from '@/data/textureManager';

interface ChunkProps {
  chunkX: number;
  chunkZ: number;
  version: number; // Forces re-render when chunk is modified
}

// Material cache to avoid creating duplicate materials per texture
const materialCache = new Map<string, THREE.MeshLambertMaterial>();

function getMaterialForTexture(texture: THREE.Texture, isTransparent: boolean): THREE.MeshLambertMaterial {
  const cacheKey = `${texture.uuid}_${isTransparent}`;
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!;
  }

  const material = createBlockMaterial();
  material.map = texture;

  // Enable alpha testing for transparent blocks (leaves, flowers, grass, etc.)
  // Use alphaTest instead of transparent for cutout rendering - avoids sorting issues
  if (isTransparent) {
    material.alphaTest = 0.1;
    material.transparent = false;
    material.side = THREE.DoubleSide;
    material.depthWrite = true;
  }

  material.needsUpdate = true;
  materialCache.set(cacheKey, material);
  return material;
}

// Shared water material (one for all chunks)
const sharedWaterMaterial = createWaterMaterial();

// Preload textures once
let texturesPreloaded = false;

export default function Chunk({ chunkX, chunkZ, version }: ChunkProps) {
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const waterGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  const chunk = useWorldStore((state) => state.getChunk(chunkX, chunkZ));
  const getChunk = useWorldStore((state) => state.getChunk);

  // Preload common textures once
  useEffect(() => {
    if (!texturesPreloaded) {
      textureManager.preloadCommonTextures();
      texturesPreloaded = true;
    }
  }, []);

  // Get neighboring chunks for mesh building
  const neighbors = useMemo(() => ({
    north: getChunk(chunkX, chunkZ - 1),
    south: getChunk(chunkX, chunkZ + 1),
    east: getChunk(chunkX + 1, chunkZ),
    west: getChunk(chunkX - 1, chunkZ),
  }), [chunkX, chunkZ, getChunk, version]);

  // Build multi-texture mesh when chunk data changes
  const multiTextureMeshes = useMemo(() => {
    // Dispose old geometries
    geometriesRef.current.forEach((geo) => geo.dispose());
    geometriesRef.current = [];

    if (!chunk || !chunk.isGenerated) return null;

    const meshes = buildMultiTextureChunkMesh(chunk, neighbors);

    // Store new geometries for later disposal
    if (meshes) {
      geometriesRef.current = meshes.map((m) => m.geometry);
    }

    return meshes;
  }, [chunk, neighbors, version]);

  // Build water mesh
  const waterGeometry = useMemo(() => {
    // Dispose old water geometry
    if (waterGeometryRef.current) {
      waterGeometryRef.current.dispose();
      waterGeometryRef.current = null;
    }

    if (!chunk || !chunk.isGenerated) return null;

    const geo = buildWaterMesh(chunk, neighbors);
    waterGeometryRef.current = geo;
    return geo;
  }, [chunk, neighbors, version]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose all geometries when chunk unmounts
      geometriesRef.current.forEach((geo) => geo.dispose());
      geometriesRef.current = [];

      if (waterGeometryRef.current) {
        waterGeometryRef.current.dispose();
        waterGeometryRef.current = null;
      }
    };
  }, []);

  // World position
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  if (!chunk || !chunk.isGenerated || !multiTextureMeshes) {
    return null;
  }

  return (
    <group position={[worldX, 0, worldZ]}>
      {/* Multi-texture solid blocks - using cached materials */}
      {multiTextureMeshes.map((meshData, index) => (
        <mesh
          key={index}
          geometry={meshData.geometry}
          material={getMaterialForTexture(meshData.texture, meshData.isTransparent)}
          frustumCulled={true}
          renderOrder={meshData.isTransparent ? 1 : 0}
        />
      ))}

      {/* Water (transparent, rendered after solid) */}
      {waterGeometry && (
        <mesh
          geometry={waterGeometry}
          material={sharedWaterMaterial}
          renderOrder={1}
          frustumCulled={true}
        />
      )}
    </group>
  );
}

// Clear material cache (call when resetting the world)
export function clearMaterialCache(): void {
  materialCache.forEach((material) => {
    material.dispose();
    if (material.map) {
      material.map.dispose();
    }
  });
  materialCache.clear();
}
