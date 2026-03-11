import { create } from 'zustand';
import { BlockType, BLOCKS } from '@/data/blocks';
import { ItemType, ITEMS, ItemData } from '@/data/items';
import { HOTBAR_SLOTS, INVENTORY_ROWS, INVENTORY_COLS } from '@/utils/constants';
import { usePlayerStore } from '@/stores/playerStore';

export interface InventorySlot {
  item: BlockType | ItemType | null;
  count: number;
  durability?: number;
}

interface InventoryStore {
  // Slots
  hotbar: InventorySlot[];
  inventory: InventorySlot[]; // 27 slots (3 rows x 9 cols)
  armor: {
    helmet: InventorySlot;
    chestplate: InventorySlot;
    leggings: InventorySlot;
    boots: InventorySlot;
  };
  craftingGrid: InventorySlot[]; // 4 slots for 2x2 inventory crafting
  craftingResult: InventorySlot;
  // Dedicated 3x3 crafting table grid
  craftingGrid3x3: InventorySlot[];
  craftingResult3x3: InventorySlot;

  // Held item (cursor)
  heldItem: InventorySlot;

  // Actions
  getSlot: (index: number) => InventorySlot;
  setSlot: (index: number, slot: InventorySlot) => void;
  getHotbarSlot: (index: number) => InventorySlot;
  setHotbarSlot: (index: number, slot: InventorySlot) => void;
  addItem: (item: BlockType | ItemType, count?: number) => boolean;
  removeItem: (item: BlockType | ItemType, count?: number) => boolean;
  hasItem: (item: BlockType | ItemType, count?: number) => boolean;
  countItem: (item: BlockType | ItemType) => number;
  swapSlots: (index1: number, index2: number) => void;
  pickupItem: (index: number, half?: boolean) => void;
  placeItem: (index: number, single?: boolean) => void;
  dropHeldItem: () => InventorySlot | null;
  setCraftingGrid: (grid: InventorySlot[]) => void;
  setCraftingResult: (result: InventorySlot) => void;
  clearCraftingGrid: () => void;
  setCraftingGrid3x3: (grid: InventorySlot[]) => void;
  setCraftingResult3x3: (result: InventorySlot) => void;
  clearCraftingGrid3x3: () => void;
  getArmorSlot: (slot: 'helmet' | 'chestplate' | 'leggings' | 'boots') => InventorySlot;
  setArmorSlot: (slot: 'helmet' | 'chestplate' | 'leggings' | 'boots', value: InventorySlot) => void;
  recalculateArmor: () => void;
  useDurability: (slot: number, amount?: number) => boolean;
  reset: () => void;
}

function createEmptySlot(): InventorySlot {
  return { item: null, count: 0 };
}

function createSlots(count: number): InventorySlot[] {
  return Array(count).fill(null).map(() => createEmptySlot());
}

function getStackSize(item: BlockType | ItemType): number {
  // Check if it's a block
  if (typeof item === 'number') {
    return 64; // Blocks stack to 64
  }
  // Check items
  const itemData = ITEMS[item];
  return itemData?.stackSize || 64;
}

function getItemDurability(item: BlockType | ItemType): number | undefined {
  // Blocks don't have durability
  if (typeof item === 'number') {
    return undefined;
  }
  // Check items for durability (tools and armor)
  const itemData = ITEMS[item];
  return itemData?.durability;
}

const initialState = {
  hotbar: createSlots(HOTBAR_SLOTS),
  inventory: createSlots(INVENTORY_ROWS * INVENTORY_COLS),
  armor: {
    helmet: createEmptySlot(),
    chestplate: createEmptySlot(),
    leggings: createEmptySlot(),
    boots: createEmptySlot(),
  },
  craftingGrid: createSlots(4),
  craftingResult: createEmptySlot(),
  heldItem: createEmptySlot(),
  craftingGrid3x3: createSlots(9),
  craftingResult3x3: createEmptySlot(),
};

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  ...initialState,

  getSlot: (index) => {
    const { hotbar, inventory } = get();
    if (index < HOTBAR_SLOTS) {
      return hotbar[index];
    }
    return inventory[index - HOTBAR_SLOTS];
  },

  setSlot: (index, slot) => {
    if (index < HOTBAR_SLOTS) {
      set((state) => {
        const newHotbar = [...state.hotbar];
        newHotbar[index] = slot;
        return { hotbar: newHotbar };
      });
    } else {
      set((state) => {
        const newInventory = [...state.inventory];
        newInventory[index - HOTBAR_SLOTS] = slot;
        return { inventory: newInventory };
      });
    }
  },

  getHotbarSlot: (index) => {
    return get().hotbar[index];
  },

  setHotbarSlot: (index, slot) => {
    set((state) => {
      const newHotbar = [...state.hotbar];
      newHotbar[index] = slot;
      return { hotbar: newHotbar };
    });
  },

  addItem: (item, count = 1) => {
    const { hotbar, inventory } = get();
    const maxStack = getStackSize(item);
    const durability = getItemDurability(item);
    let remaining = count;

    // First, try to add to existing stacks (only for stackable items without durability)
    const tryAddToSlots = (slots: InventorySlot[], setSlots: (slots: InventorySlot[]) => void) => {
      const newSlots = [...slots];

      // Items with durability don't stack - each goes in a new slot
      if (durability !== undefined) {
        for (let i = 0; i < newSlots.length && remaining > 0; i++) {
          if (newSlots[i].item === null) {
            newSlots[i] = { item, count: 1, durability };
            remaining -= 1;
          }
        }
      } else {
        // Stackable items - try to add to existing stacks first
        for (let i = 0; i < newSlots.length && remaining > 0; i++) {
          if (newSlots[i].item === item && newSlots[i].count < maxStack) {
            const canAdd = Math.min(remaining, maxStack - newSlots[i].count);
            newSlots[i] = { ...newSlots[i], count: newSlots[i].count + canAdd };
            remaining -= canAdd;
          }
        }
        // Then, try empty slots
        for (let i = 0; i < newSlots.length && remaining > 0; i++) {
          if (newSlots[i].item === null) {
            const canAdd = Math.min(remaining, maxStack);
            newSlots[i] = { item, count: canAdd };
            remaining -= canAdd;
          }
        }
      }
      setSlots(newSlots);
    };

    // Try hotbar first
    tryAddToSlots(hotbar, (slots) => set({ hotbar: slots }));

    // Then inventory
    if (remaining > 0) {
      tryAddToSlots(inventory, (slots) => set({ inventory: slots }));
    }

    return remaining === 0;
  },

  removeItem: (item, count = 1) => {
    const { hotbar, inventory } = get();
    let remaining = count;

    const tryRemoveFromSlots = (slots: InventorySlot[]): InventorySlot[] => {
      const newSlots = [...slots];
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].item === item) {
          const canRemove = Math.min(remaining, newSlots[i].count);
          newSlots[i] = {
            ...newSlots[i],
            count: newSlots[i].count - canRemove,
            item: newSlots[i].count - canRemove > 0 ? item : null,
          };
          remaining -= canRemove;
        }
      }
      return newSlots;
    };

    set({
      hotbar: tryRemoveFromSlots(hotbar),
      inventory: tryRemoveFromSlots(inventory),
    });

    return remaining === 0;
  },

  hasItem: (item, count = 1) => {
    return get().countItem(item) >= count;
  },

  countItem: (item) => {
    const { hotbar, inventory } = get();
    let total = 0;

    const countInSlots = (slots: InventorySlot[]) => {
      for (const slot of slots) {
        if (slot.item === item) {
          total += slot.count;
        }
      }
    };

    countInSlots(hotbar);
    countInSlots(inventory);

    return total;
  },

  swapSlots: (index1, index2) => {
    const slot1 = get().getSlot(index1);
    const slot2 = get().getSlot(index2);

    get().setSlot(index1, slot2);
    get().setSlot(index2, slot1);
  },

  pickupItem: (index, half = false) => {
    const { heldItem, getSlot, setSlot } = get();
    const slot = getSlot(index);

    if (heldItem.item !== null) {
      // Already holding something
      return;
    }

    if (slot.item === null) {
      return;
    }

    if (half && slot.count > 1) {
      const pickupCount = Math.ceil(slot.count / 2);
      set({
        heldItem: { item: slot.item, count: pickupCount, durability: slot.durability },
      });
      setSlot(index, {
        item: slot.item,
        count: slot.count - pickupCount,
        durability: slot.durability,
      });
    } else {
      set({ heldItem: { ...slot } });
      setSlot(index, createEmptySlot());
    }
  },

  placeItem: (index, single = false) => {
    const { heldItem, getSlot, setSlot } = get();
    const slot = getSlot(index);

    if (heldItem.item === null) {
      // Not holding anything, maybe pickup
      if (slot.item !== null) {
        get().pickupItem(index);
      }
      return;
    }

    if (slot.item === null) {
      // Empty slot
      if (single) {
        setSlot(index, { item: heldItem.item, count: 1, durability: heldItem.durability });
        if (heldItem.count > 1) {
          set({ heldItem: { ...heldItem, count: heldItem.count - 1 } });
        } else {
          set({ heldItem: createEmptySlot() });
        }
      } else {
        setSlot(index, { ...heldItem });
        set({ heldItem: createEmptySlot() });
      }
    } else if (slot.item === heldItem.item) {
      // Same item, try to stack
      const maxStack = getStackSize(slot.item);
      const canAdd = Math.min(
        single ? 1 : heldItem.count,
        maxStack - slot.count
      );

      if (canAdd > 0) {
        setSlot(index, { ...slot, count: slot.count + canAdd });
        if (heldItem.count - canAdd > 0) {
          set({ heldItem: { ...heldItem, count: heldItem.count - canAdd } });
        } else {
          set({ heldItem: createEmptySlot() });
        }
      }
    } else {
      // Different item, swap
      setSlot(index, { ...heldItem });
      set({ heldItem: { ...slot } });
    }
  },

  dropHeldItem: () => {
    const { heldItem } = get();
    if (heldItem.item === null) return null;

    const dropped = { ...heldItem };
    set({ heldItem: createEmptySlot() });
    return dropped;
  },

  setCraftingGrid: (grid) => {
    set({ craftingGrid: grid });
  },

  setCraftingResult: (result) => {
    set({ craftingResult: result });
  },

  clearCraftingGrid: () => {
    set({ craftingGrid: createSlots(4), craftingResult: createEmptySlot() });
  },

  setCraftingGrid3x3: (grid) => {
    set({ craftingGrid3x3: grid });
  },

  setCraftingResult3x3: (result) => {
    set({ craftingResult3x3: result });
  },

  clearCraftingGrid3x3: () => {
    set({ craftingGrid3x3: createSlots(9), craftingResult3x3: createEmptySlot() });
  },

  getArmorSlot: (slot) => {
    return get().armor[slot];
  },

  setArmorSlot: (slot, value) => {
    set((state) => ({
      armor: {
        ...state.armor,
        [slot]: value,
      },
    }));
    // Keep player store armor value in sync
    get().recalculateArmor();
  },

  recalculateArmor: () => {
    const armorState = get().armor;
    const slots = [armorState.helmet, armorState.chestplate, armorState.leggings, armorState.boots];
    let points = 0;
    for (const s of slots) {
      if (s.item && typeof s.item === 'string') {
        const data = ITEMS[s.item];
        points += data?.armorPoints ?? 0;
      }
    }
    // Player store doesn't expose setArmor; set directly via zustand internal setter:
    usePlayerStore.setState({ armor: points });
  },

  useDurability: (slot, amount = 1) => {
    const item = get().getHotbarSlot(slot);
    if (!item.item || item.durability === undefined) return true;

    const newDurability = item.durability - amount;
    if (newDurability <= 0) {
      // Item broke
      get().setHotbarSlot(slot, createEmptySlot());
      return false;
    }

    get().setHotbarSlot(slot, { ...item, durability: newDurability });
    return true;
  },

  reset: () => {
    set(initialState);
    usePlayerStore.setState({ armor: 0 });
  },
}));

// Helper to give starting items for creative mode or testing
export function giveStartingItems(): void {
  const store = useInventoryStore.getState();

  // Give some basic blocks and tools
  store.setHotbarSlot(0, { item: BlockType.GRASS, count: 64 });
  store.setHotbarSlot(1, { item: BlockType.DIRT, count: 64 });
  store.setHotbarSlot(2, { item: BlockType.STONE, count: 64 });
  store.setHotbarSlot(3, { item: BlockType.OAK_LOG, count: 64 });
  store.setHotbarSlot(4, { item: BlockType.OAK_PLANKS, count: 64 });
  store.setHotbarSlot(5, { item: BlockType.COBBLESTONE, count: 64 });
  store.setHotbarSlot(6, { item: BlockType.GLASS, count: 64 });
  store.setHotbarSlot(7, { item: ItemType.DIAMOND_PICKAXE, count: 1, durability: 1562 });
  store.setHotbarSlot(8, { item: ItemType.DIAMOND_SWORD, count: 1, durability: 1562 });
  
  // Also add some items to the main inventory for testing
  store.setSlot(9, { item: BlockType.WATER, count: 64 });
  store.setSlot(10, { item: BlockType.LAVA, count: 64 });
  store.setSlot(11, { item: BlockType.SAND, count: 64 });
  store.setSlot(12, { item: BlockType.GRAVEL, count: 64 });
  store.setSlot(13, { item: ItemType.WOODEN_PICKAXE, count: 1, durability: 60 });
  store.setSlot(14, { item: ItemType.WOODEN_AXE, count: 1, durability: 60 });
  store.setSlot(15, { item: ItemType.WOODEN_SHOVEL, count: 1, durability: 60 });
  store.setSlot(16, { item: ItemType.WOODEN_SWORD, count: 1, durability: 60 });
  store.setSlot(17, { item: ItemType.WOODEN_HOE, count: 1, durability: 60 });
}

// Get item display name
export function getItemName(item: BlockType | ItemType): string {
  if (typeof item === 'number') {
    return BLOCKS[item]?.name || 'Unknown';
  }
  return ITEMS[item]?.name || 'Unknown';
}

// Get item color for rendering
export function getItemColor(item: BlockType | ItemType): string {
  if (typeof item === 'number') {
    return BLOCKS[item]?.color || '#FFFFFF';
  }
  return ITEMS[item]?.color || '#FFFFFF';
}
