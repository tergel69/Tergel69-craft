'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
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

function getMaterialForTexture(texture: THREE.Texture, renderMode: 'opaque' | 'cutout' | 'translucent'): THREE.MeshLambertMaterial {
  const cacheKey = `${texture.uuid}_${renderMode}`;
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!;
  }

  const material = createBlockMaterial();
  material.map = texture;

  if (renderMode === 'cutout') {
    material.alphaTest = 0.1;
    material.transparent = false;
    material.side = THREE.DoubleSide;
    material.depthWrite = true;
  } else if (renderMode === 'translucent') {
    material.transparent = true;
    material.opacity = 0.6;
    material.side = THREE.DoubleSide;
    material.depthWrite = false;
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
  const meshWorkerRef = useRef<Worker | null>(null);
  const [workerMeshes, setWorkerMeshes] = useState<{ geometry: THREE.BufferGeometry; texture: THREE.Texture; renderMode: 'opaque' | 'cutout' | 'translucent' }[] | null>(null);
  const [isBuildingMesh, setIsBuildingMesh] = useState(false);

  const chunk = useWorldStore((state) => state.getChunk(chunkX, chunkZ));
  const getChunk = useWorldStore((state) => state.getChunk);

  // Preload common textures once
  useEffect(() => {
    if (!texturesPreloaded) {
      textureManager.preloadCommonTextures();
      texturesPreloaded = true;
    }
  }, []);

  // Initialize mesh worker
  useEffect(() => {
    try {
      meshWorkerRef.current = new Worker(new URL('../workers/meshWorker.ts', import.meta.url), { type: 'module' });

      meshWorkerRef.current.onmessage = (e) => {
        const { type, chunkX: responseChunkX, chunkZ: responseChunkZ, meshes, waterMesh } = e.data;
        if (type === 'mesh_built' && responseChunkX === chunkX && responseChunkZ === chunkZ) {
          // Convert worker data to THREE geometries
          const threeMeshes = meshes.map((meshData: any) => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
            geometry.setIndex(meshData.indices);
            geometry.computeBoundingSphere();

            // Get texture from textureManager (simplified)
            const texture = textureManager.getBlockTexture(1, 'side'); // Default texture

            return {
              geometry,
              texture,
              renderMode: meshData.renderMode,
            };
          });

          setWorkerMeshes(threeMeshes);
          setIsBuildingMesh(false);
        }
      };

      return () => {
        if (meshWorkerRef.current) {
          meshWorkerRef.current.terminate();
        }
      };
    } catch (error) {
      console.warn('Mesh worker not supported, falling back to main thread');
      meshWorkerRef.current = null;
    }
  }, [chunkX, chunkZ]);

  // Get neighboring chunks for mesh building
  const neighbors = useMemo(() => ({
    north: getChunk(chunkX, chunkZ - 1),
    south: getChunk(chunkX, chunkZ + 1),
    east: getChunk(chunkX + 1, chunkZ),
    west: getChunk(chunkX - 1, chunkZ),
  }), [chunkX, chunkZ, getChunk]);

  // Build multi-texture mesh when chunk data changes
  const buildMesh = useCallback(() => {
    if (!chunk || !chunk.isGenerated) {
      setWorkerMeshes(null);
      return;
    }

    if (meshWorkerRef.current && !isBuildingMesh) {
      setIsBuildingMesh(true);
      meshWorkerRef.current.postMessage({
        type: 'build_mesh',
        chunk,
        neighbors,
      });
    } else if (!meshWorkerRef.current) {
      // Fallback to main thread
      // Dispose old geometries
      geometriesRef.current.forEach((geo) => geo.dispose());
      geometriesRef.current = [];

      const meshes = buildMultiTextureChunkMesh(chunk, neighbors);

      // Store new geometries for later disposal
      if (meshes) {
        geometriesRef.current = meshes.map((m) => m.geometry);
      }

      setWorkerMeshes(meshes);
    }
  }, [chunk, neighbors, version, isBuildingMesh]);

  useEffect(() => {
    buildMesh();
  }, [buildMesh]);

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

      if (workerMeshes) {
        workerMeshes.forEach((mesh) => mesh.geometry.dispose());
      }

      if (waterGeometryRef.current) {
        waterGeometryRef.current.dispose();
        waterGeometryRef.current = null;
      }
    };
  }, [workerMeshes]);

  // World position
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  const meshesToRender = workerMeshes;

  if (!chunk || !chunk.isGenerated || !meshesToRender) {
    return null;
  }

  return (
    <group position={[worldX, 0, worldZ]}>
      {/* Multi-texture solid blocks - using cached materials */}
      {meshesToRender.map((meshData, index) => (
        <mesh
          key={index}
          geometry={meshData.geometry}
          material={getMaterialForTexture(meshData.texture, meshData.renderMode)}
          frustumCulled={true}
          renderOrder={meshData.renderMode === 'opaque' ? 0 : 1}
        />
      ))}

      {/* Water (transparent, rendered after solid) */}
      {waterGeometry && (
        <mesh
          geometry={waterGeometry}
          material={sharedWaterMaterial}
          renderOrder={2}
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
