/**
 * PerformanceProfile - Tunable performance settings for balanced 60-90 FPS target
 */
export type PerformancePreset = 'performance' | 'balanced' | 'quality';

export interface PerformanceProfile {
  preset: PerformancePreset;
  
  // Generation budget (ms per frame)
  generationBudgetMs: number;
  generationQueueDrainRate: number; // chunks per tick
  
  // Entity tick rates
  entityTickRateNear: number; // ticks per second for nearby entities (< 16 blocks)
  entityTickRateMid: number;  // ticks per second for mid-range entities (16-32 blocks)
  entityTickRateFar: number;  // ticks per second for far entities (32+ blocks)
  maxEntityUpdatesPerFrame: number;
  
  // Chunk visibility cadence
  chunkUpdateIntervalMs: number;
  chunkUpdateBudgetMs: number;
  adaptiveRenderDistanceEnabled: boolean;
  
  // Mesh rebuild strategy
  incrementalMeshRebuild: boolean;
  meshRebuildBudgetMs: number;
  
  // Store update throttling
  positionUpdateThreshold: number; // minimum distance change to trigger store update
  rotationUpdateThreshold: number; // minimum radians change to trigger store update
  storeUpdateBatchIntervalMs: number;
  
  // Raycast/interaction throttling
  interactionCheckIntervalMs: number;
  interactionMotionTriggered: boolean;
  motionThresholdForInteraction: number;
  
  // Low-frequency game ticks
  hungerRegenTickIntervalMs: number;
  statusEffectTickIntervalMs: number;
}

export const PERFORMANCE_PROFILES: Record<PerformancePreset, PerformanceProfile> = {
  performance: {
    preset: 'performance',
    generationBudgetMs: 8,
    generationQueueDrainRate: 4,
    entityTickRateNear: 20,
    entityTickRateMid: 10,
    entityTickRateFar: 5,
    maxEntityUpdatesPerFrame: 15,
    chunkUpdateIntervalMs: 100,
    chunkUpdateBudgetMs: 6,
    adaptiveRenderDistanceEnabled: true,
    incrementalMeshRebuild: true,
    meshRebuildBudgetMs: 5,
    positionUpdateThreshold: 0.05,
    rotationUpdateThreshold: 0.02,
    storeUpdateBatchIntervalMs: 50,
    interactionCheckIntervalMs: 100,
    interactionMotionTriggered: true,
    motionThresholdForInteraction: 0.1,
    hungerRegenTickIntervalMs: 4000,
    statusEffectTickIntervalMs: 1000,
  },
  
  balanced: {
    preset: 'balanced',
    generationBudgetMs: 12,
    generationQueueDrainRate: 3,
    entityTickRateNear: 20,
    entityTickRateMid: 12,
    entityTickRateFar: 6,
    maxEntityUpdatesPerFrame: 20,
    chunkUpdateIntervalMs: 80,
    chunkUpdateBudgetMs: 8,
    adaptiveRenderDistanceEnabled: true,
    incrementalMeshRebuild: true,
    meshRebuildBudgetMs: 7,
    positionUpdateThreshold: 0.03,
    rotationUpdateThreshold: 0.015,
    storeUpdateBatchIntervalMs: 40,
    interactionCheckIntervalMs: 80,
    interactionMotionTriggered: true,
    motionThresholdForInteraction: 0.08,
    hungerRegenTickIntervalMs: 3000,
    statusEffectTickIntervalMs: 800,
  },
  
  quality: {
    preset: 'quality',
    generationBudgetMs: 16,
    generationQueueDrainRate: 2,
    entityTickRateNear: 20,
    entityTickRateMid: 15,
    entityTickRateFar: 8,
    maxEntityUpdatesPerFrame: 30,
    chunkUpdateIntervalMs: 60,
    chunkUpdateBudgetMs: 10,
    adaptiveRenderDistanceEnabled: false,
    incrementalMeshRebuild: false,
    meshRebuildBudgetMs: 10,
    positionUpdateThreshold: 0.01,
    rotationUpdateThreshold: 0.008,
    storeUpdateBatchIntervalMs: 30,
    interactionCheckIntervalMs: 60,
    interactionMotionTriggered: false,
    motionThresholdForInteraction: 0.05,
    hungerRegenTickIntervalMs: 2000,
    statusEffectTickIntervalMs: 500,
  },
};

export const DEFAULT_PERFORMANCE_PROFILE: PerformanceProfile = PERFORMANCE_PROFILES.balanced;
