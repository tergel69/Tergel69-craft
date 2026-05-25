'use client';

/**
 * CropProcessor.tsx — Tick-based crop growth system
 *
 * Grows crops on hydrated farmland every few seconds.
 * Bone meal instantly grows crops to next stage.
 */

import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useWorldStore, getBlockStateFromChunk, setBlockStateInChunk } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';
import { worldToChunk, worldToLocal } from '@/utils/coordinates';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';

// Crop type → stage block mapping
const CROP_GROWTH: Record<number, { stages: number[]; matureStage: number }> = {
  [BlockType.WHEAT_CROP]: {
    stages: [BlockType.WHEAT_STAGE0, BlockType.WHEAT_STAGE1, BlockType.WHEAT_STAGE2, BlockType.WHEAT_STAGE3, BlockType.WHEAT_STAGE4, BlockType.WHEAT_STAGE5, BlockType.WHEAT_STAGE6, BlockType.WHEAT_STAGE7],
    matureStage: 7,
  },
  [BlockType.CARROTS_CROP]: {
    stages: [BlockType.CARROTS_STAGE0, BlockType.CARROTS_STAGE1, BlockType.CARROTS_STAGE2, BlockType.CARROTS_STAGE3],
    matureStage: 3,
  },
  [BlockType.POTATOES_CROP]: {
    stages: [BlockType.POTATOES_STAGE0, BlockType.POTATOES_STAGE1, BlockType.POTATOES_STAGE2, BlockType.POTATOES_STAGE3],
    matureStage: 3,
  },
};

// All crop stage blocks
const CROP_STAGE_BLOCKS = new Set([
  BlockType.WHEAT_STAGE0, BlockType.WHEAT_STAGE1, BlockType.WHEAT_STAGE2, BlockType.WHEAT_STAGE3,
  BlockType.WHEAT_STAGE4, BlockType.WHEAT_STAGE5, BlockType.WHEAT_STAGE6, BlockType.WHEAT_STAGE7,
  BlockType.CARROTS_STAGE0, BlockType.CARROTS_STAGE1, BlockType.CARROTS_STAGE2, BlockType.CARROTS_STAGE3,
  BlockType.POTATOES_STAGE0, BlockType.POTATOES_STAGE1, BlockType.POTATOES_STAGE2, BlockType.POTATOES_STAGE3,
]);

// All farmland blocks
const FARMLAND_BLOCKS = new Set([BlockType.FARMLAND, BlockType.FARMLAND_MOIST]);

// Find which crop type this stage block belongs to
function getCropTypeFromStage(stageBlock: BlockType): number | null {
  for (const [cropType, info] of Object.entries(CROP_GROWTH)) {
    if (info.stages.includes(stageBlock)) return Number(cropType);
  }
  return null;
}

// Get current stage index from stage block
function getStageIndex(stageBlock: BlockType): number {
  for (const info of Object.values(CROP_GROWTH)) {
    const idx = info.stages.indexOf(stageBlock);
    if (idx >= 0) return idx;
  }
  return 0;
}

// Get stage block for a crop at a given stage
function getStageBlock(cropType: BlockType, stage: number): BlockType | null {
  const info = CROP_GROWTH[cropType];
  if (!info || stage >= info.stages.length) return null;
  return info.stages[stage];
}

export function isCropStageBlock(block: BlockType): boolean {
  return CROP_STAGE_BLOCKS.has(block);
}

export function isFarmland(block: BlockType): boolean {
  return FARMLAND_BLOCKS.has(block);
}

export function getCropBlock(seedType: BlockType | string): BlockType | null {
  if (seedType === 'wheat_seeds') return BlockType.WHEAT_CROP;
  if (seedType === 'carrot' || seedType === BlockType.CARROTS_CROP) return BlockType.CARROTS_CROP;
  if (seedType === 'potato' || seedType === BlockType.POTATOES_CROP) return BlockType.POTATOES_CROP;
  if (seedType === 'beetroot_seeds') return BlockType.BEETROOTS_CROP;
  return null;
}

export function getSeedForCrop(cropType: BlockType): string | null {
  if (cropType === BlockType.WHEAT_CROP) return 'wheat_seeds';
  if (cropType === BlockType.CARROTS_CROP) return 'carrot';
  if (cropType === BlockType.POTATOES_CROP) return 'potato';
  if (cropType === BlockType.BEETROOTS_CROP) return 'beetroot_seeds';
  return null;
}

/** Apply bone meal to a crop block — grows to next stage */
export function applyBoneMeal(x: number, y: number, z: number): boolean {
  const worldStore = useWorldStore.getState();
  const block = worldStore.getBlock(x, y, z);
  const cropType = getCropTypeFromStage(block);
  if (cropType === null) return false;

  const info = CROP_GROWTH[cropType];
  const currentStage = info.stages.indexOf(block);
  if (currentStage < 0 || currentStage >= info.matureStage) return false;

  // Advance 1-2 stages
  const growth = 1 + Math.floor(Math.random() * 2);
  const nextStage = Math.min(info.matureStage, currentStage + growth);
  const nextBlock = info.stages[nextStage];
  if (nextBlock !== null) {
    useWorldStore.getState().setBlock(x, y, z, nextBlock);
    return true;
  }
  return false;
}

export default function CropProcessor() {
  const gameState = useGameStore((s) => s.gameState);

  useEffect(() => {
    if (gameState === 'paused' || gameState === 'menu' || gameState === 'loading') return;

    // Tick crop growth every 3 seconds (like Minecraft random ticks)
    const id = window.setInterval(() => {
      const worldStore = useWorldStore.getState();

      // Get all loaded chunk keys
      const loadedKeys = [...worldStore.loadedChunks];
      
      // Sample a few random chunks for performance
      const samples = Math.min(loadedKeys.length, 5 + Math.floor(Math.random() * 5));
      for (let ci = 0; ci < samples; ci++) {
        const key = loadedKeys[Math.floor(Math.random() * loadedKeys.length)];
        const [cx, cz] = key.split(',').map(Number);

        // Sample a few random positions per chunk
        for (let i = 0; i < 2; i++) {
          const lx = Math.floor(Math.random() * CHUNK_SIZE);
          const lz = Math.floor(Math.random() * CHUNK_SIZE);
          const worldX = cx * CHUNK_SIZE + lx;
          const worldZ = cz * CHUNK_SIZE + lz;

          // Scan Y for crops
          for (let ly = 60; ly < CHUNK_HEIGHT; ly++) {
            const block = worldStore.getBlock(worldX, ly, worldZ);
            const cropType = getCropTypeFromStage(block);
            if (cropType === null) continue;

            const info = CROP_GROWTH[cropType];
            const currentStage = info.stages.indexOf(block);
            if (currentStage < 0 || currentStage >= info.matureStage) continue;

            // Check if soil below is hydrated
            const soilBlock = worldStore.getBlock(worldX, ly - 1, worldZ);
            const isHydrated = soilBlock === BlockType.FARMLAND_MOIST;

            // Growth chance: 50% if hydrated, 20% if dry
            const growthChance = isHydrated ? 0.5 : 0.2;
            if (Math.random() < growthChance) {
              const nextBlock = info.stages[currentStage + 1];
              if (nextBlock !== null) {
                worldStore.setBlock(worldX, ly, worldZ, nextBlock);
              }
            }
            break; // Only process one crop per column
          }
        }
      }
    }, 3000); // Every 3 seconds

    return () => window.clearInterval(id);
  }, [gameState]);

  return null;
}