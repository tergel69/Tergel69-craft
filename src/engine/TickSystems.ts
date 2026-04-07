/**
 * TickSystems - Deterministic tick-based simulation scheduler
 * 
 * This module provides a unified interface for all tick-driven systems:
 * - Redstone ticks
 * - Potion/status effect ticks  
 * - Villager schedule ticks
 * - Mob event ticks
 * - Random block ticks
 * 
 * All systems use deterministic scheduling for consistent outcomes across reloads.
 */

export interface TickSchedulerConfig {
  randomTickSpeed: number; // Default: 3 (blocks per chunk per tick)
  redstoneTickRate: number; // Ticks per second for redstone
  entityTickRate: number; // Ticks per second for entities
  statusEffectTickRate: number; // Ticks per second for status effects
  villagerTickRate: number; // Ticks per second for villager AI
}

export const DEFAULT_TICK_CONFIG: TickSchedulerConfig = {
  randomTickSpeed: 3,
  redstoneTickRate: 10, // 10 Hz
  entityTickRate: 20,   // 20 Hz
  statusEffectTickRate: 20, // 20 Hz
  villagerTickRate: 5,  // 5 Hz
};

export interface ScheduledTick<T = any> {
  id: string;
  type: TickType;
  scheduledTime: number; // Game tick when this should execute
  data: T;
  priority: number; // Lower = higher priority
}

export type TickType = 
  | 'redstone'
  | 'liquid'
  | 'random_block'
  | 'status_effect'
  | 'villager'
  | 'mob_event'
  | 'crop_growth'
  | 'ice_melt'
  | 'fire_spread';

export interface TickResult {
  success: boolean;
  changesApplied: number;
  error?: string;
}

// ============================================
// TICK HANDLER INTERFACES
// ============================================

export interface RedstoneTickData {
  position: { x: number; y: number; z: number };
  powerLevel: number;
  componentType: string;
}

export interface LiquidTickData {
  position: { x: number; y: number; z: number };
  liquidType: 'water' | 'lava';
  level: number;
  falling: boolean;
}

export interface RandomBlockTickData {
  position: { x: number; y: number; z: number };
  blockType: string;
  age?: number;
}

export interface StatusEffectTickData {
  entityId: string;
  effectId: string;
  amplifier: number;
  duration: number;
  ambient: boolean;
  showParticles: boolean;
  showIcon: boolean;
}

export interface VillagerTickData {
  entityId: string;
  profession: string;
  schedule: string;
  workstation?: { x: number; y: number; z: number };
  home?: { x: number; y: number; z: number };
}

export interface MobEventTickData {
  eventId: string;
  entityType: string;
  position: { x: number; y: number; z: number };
  eventState: string;
}

// ============================================
// TICK HANDLER FUNCTIONS
// ============================================

export type TickHandler<T> = (data: T, context: TickContext) => TickResult;

export interface TickContext {
  gameTick: number;
  worldTime: number;
  dayCount: number;
  dimension: string;
  randomSeed: number;
}

// ============================================
// TICK SCHEDULER CLASS
// ============================================

export class TickScheduler {
  private config: TickSchedulerConfig;
  private currentGameTick: number = 0;
  
  // Priority queues for different tick types
  private redstoneQueue: ScheduledTick<RedstoneTickData>[] = [];
  private liquidQueue: ScheduledTick<LiquidTickData>[] = [];
  private randomBlockQueue: ScheduledTick<RandomBlockTickData>[] = [];
  private statusEffectQueue: ScheduledTick<StatusEffectTickData>[] = [];
  private villagerQueue: ScheduledTick<VillagerTickData>[] = [];
  private mobEventQueue: ScheduledTick<MobEventTickData>[] = [];
  
  // Handler registry
  private handlers: Map<TickType, TickHandler<any>> = new Map();
  
  // Budget tracking
  private tickBudgetMs: number = 10; // Max ms to spend on ticks per frame
  
  constructor(config: Partial<TickSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_TICK_CONFIG, ...config };
  }
  
  /**
   * Schedule a tick for future execution
   */
  scheduleTick<T>(type: TickType, delayTicks: number, data: T, priority: number = 5): string {
    const id = `${type}_${this.currentGameTick + delayTicks}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tick: ScheduledTick<T> = {
      id,
      type,
      scheduledTime: this.currentGameTick + delayTicks,
      data,
      priority,
    };
    
    this.addToQueue(tick);
    return id;
  }
  
  /**
   * Cancel a scheduled tick
   */
  cancelTick(id: string): boolean {
    for (const queue of this.getAllQueues()) {
      const index = queue.findIndex(t => t.id === id);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Register a handler for a tick type
   */
  registerHandler<T>(type: TickType, handler: TickHandler<T>): void {
    this.handlers.set(type, handler);
  }
  
  /**
   * Process all due ticks within the budget
   */
  processTicks(context: TickContext, maxTicks: number = 100): { processed: number; remaining: number } {
    const startTime = performance.now();
    let processed = 0;
    
    while (processed < maxTicks) {
      // Check budget
      if (performance.now() - startTime > this.tickBudgetMs) {
        break;
      }
      
      // Get next tick from highest priority queue
      const nextTick = this.getNextDueTick();
      if (!nextTick) {
        break;
      }
      
      // Execute tick
      const result = this.executeTick(nextTick, context);
      if (result.success) {
        processed += result.changesApplied;
      }
      
      // Remove processed tick
      this.removeTick(nextTick.id);
    }
    
    const totalRemaining = this.getTotalQueuedTicks();
    
    return {
      processed,
      remaining: totalRemaining,
    };
  }
  
  /**
   * Advance the game tick counter
   */
  advanceTick(): void {
    this.currentGameTick++;
  }
  
  /**
   * Get current game tick
   */
  getCurrentTick(): number {
    return this.currentGameTick;
  }
  
  /**
   * Set tick budget in milliseconds
   */
  setTickBudget(budgetMs: number): void {
    this.tickBudgetMs = Math.max(1, Math.min(50, budgetMs));
  }
  
  /**
   * Clear all queues
   */
  clear(): void {
    this.redstoneQueue = [];
    this.liquidQueue = [];
    this.randomBlockQueue = [];
    this.statusEffectQueue = [];
    this.villagerQueue = [];
    this.mobEventQueue = [];
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  private addToQueue<T>(tick: ScheduledTick<T>): void {
    switch (tick.type) {
      case 'redstone':
        this.redstoneQueue.push(tick as ScheduledTick<RedstoneTickData>);
        break;
      case 'liquid':
        this.liquidQueue.push(tick as ScheduledTick<LiquidTickData>);
        break;
      case 'random_block':
        this.randomBlockQueue.push(tick as ScheduledTick<RandomBlockTickData>);
        break;
      case 'status_effect':
        this.statusEffectQueue.push(tick as ScheduledTick<StatusEffectTickData>);
        break;
      case 'villager':
        this.villagerQueue.push(tick as ScheduledTick<VillagerTickData>);
        break;
      case 'mob_event':
        this.mobEventQueue.push(tick as ScheduledTick<MobEventTickData>);
        break;
    }
    
    // Sort by scheduled time and priority
    this.sortQueue(this.getQueueForType(tick.type));
  }
  
  private getQueueForType(type: TickType): ScheduledTick<any>[] {
    switch (type) {
      case 'redstone': return this.redstoneQueue;
      case 'liquid': return this.liquidQueue;
      case 'random_block': return this.randomBlockQueue;
      case 'status_effect': return this.statusEffectQueue;
      case 'villager': return this.villagerQueue;
      case 'mob_event': return this.mobEventQueue;
      default: return [];
    }
  }
  
  private getAllQueues(): ScheduledTick<any>[][] {
    return [
      this.redstoneQueue,
      this.liquidQueue,
      this.randomBlockQueue,
      this.statusEffectQueue,
      this.villagerQueue,
      this.mobEventQueue,
    ];
  }
  
  private sortQueue(queue: ScheduledTick<any>[]): void {
    queue.sort((a, b) => {
      if (a.scheduledTime !== b.scheduledTime) {
        return a.scheduledTime - b.scheduledTime;
      }
      return a.priority - b.priority;
    });
  }
  
  private getNextDueTick(): ScheduledTick<any> | null {
    const dueQueues = [
      this.redstoneQueue.filter(t => t.scheduledTime <= this.currentGameTick),
      this.liquidQueue.filter(t => t.scheduledTime <= this.currentGameTick),
      this.randomBlockQueue.filter(t => t.scheduledTime <= this.currentGameTick),
      this.statusEffectQueue.filter(t => t.scheduledTime <= this.currentGameTick),
      this.villagerQueue.filter(t => t.scheduledTime <= this.currentGameTick),
      this.mobEventQueue.filter(t => t.scheduledTime <= this.currentGameTick),
    ];
    
    // Find earliest tick across all queues
    let earliest: ScheduledTick<any> | null = null;
    
    for (const queue of dueQueues) {
      if (queue.length > 0) {
        if (!earliest || queue[0].scheduledTime < earliest.scheduledTime) {
          earliest = queue[0];
        } else if (queue[0].scheduledTime === earliest.scheduledTime && queue[0].priority < earliest.priority) {
          earliest = queue[0];
        }
      }
    }
    
    return earliest;
  }
  
  private executeTick(tick: ScheduledTick<any>, context: TickContext): TickResult {
    const handler = this.handlers.get(tick.type);
    
    if (!handler) {
      console.warn(`No handler registered for tick type: ${tick.type}`);
      return { success: false, changesApplied: 0, error: 'No handler' };
    }
    
    try {
      return handler(tick.data, context);
    } catch (error) {
      console.error(`Error executing tick ${tick.id}:`, error);
      return { 
        success: false, 
        changesApplied: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  private removeTick(id: string): void {
    for (const queue of this.getAllQueues()) {
      const index = queue.findIndex(t => t.id === id);
      if (index !== -1) {
        queue.splice(index, 1);
        return;
      }
    }
  }
  
  private getTotalQueuedTicks(): number {
    return this.redstoneQueue.length +
           this.liquidQueue.length +
           this.randomBlockQueue.length +
           this.statusEffectQueue.length +
           this.villagerQueue.length +
           this.mobEventQueue.length;
  }
  
  /**
   * Get stats about queued ticks
   */
  getStats(): {
    totalQueued: number;
    byType: Record<TickType, number>;
    currentTick: number;
  } {
    return {
      totalQueued: this.getTotalQueuedTicks(),
      byType: {
        redstone: this.redstoneQueue.length,
        liquid: this.liquidQueue.length,
        random_block: this.randomBlockQueue.length,
        status_effect: this.statusEffectQueue.length,
        villager: this.villagerQueue.length,
        mob_event: this.mobEventQueue.length,
        crop_growth: 0,
        ice_melt: 0,
        fire_spread: 0,
      },
      currentTick: this.currentGameTick,
    };
  }
}

// ============================================
// DEFAULT HANDLERS (stubs - to be implemented)
// ============================================

export function createDefaultHandlers(): Map<TickType, TickHandler<any>> {
  const handlers = new Map<TickType, TickHandler<any>>();
  
  // Redstone handler stub
  handlers.set('redstone', (data: RedstoneTickData, context: TickContext): TickResult => {
    // TODO: Implement redstone logic
    return { success: true, changesApplied: 1 };
  });
  
  // Liquid handler stub
  handlers.set('liquid', (data: LiquidTickData, context: TickContext): TickResult => {
    // TODO: Implement liquid flow logic
    return { success: true, changesApplied: 1 };
  });
  
  // Random block tick handler stub
  handlers.set('random_block', (data: RandomBlockTickData, context: TickContext): TickResult => {
    // TODO: Implement random block updates (crop growth, ice melt, etc.)
    return { success: true, changesApplied: 1 };
  });
  
  // Status effect handler stub
  handlers.set('status_effect', (data: StatusEffectTickData, context: TickContext): TickResult => {
    // TODO: Implement status effect ticking
    return { success: true, changesApplied: 1 };
  });
  
  // Villager handler stub
  handlers.set('villager', (data: VillagerTickData, context: TickContext): TickResult => {
    // TODO: Implement villager AI ticking
    return { success: true, changesApplied: 1 };
  });
  
  // Mob event handler stub
  handlers.set('mob_event', (data: MobEventTickData, context: TickContext): TickResult => {
    // TODO: Implement mob event ticking
    return { success: true, changesApplied: 1 };
  });
  
  return handlers;
}

// ============================================
// GLOBAL SCHEDULER INSTANCE
// ============================================

export const globalTickScheduler = new TickScheduler();

// Register default handlers
const defaultHandlers = createDefaultHandlers();
for (const [type, handler] of defaultHandlers.entries()) {
  globalTickScheduler.registerHandler(type, handler);
}
