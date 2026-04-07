'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useInventoryStore, getItemName } from '@/stores/inventoryStore';
import { useWorldStore, ContainerSlot, BlockEntityData } from '@/stores/worldStore';
import { itemTextureGenerator } from '@/data/itemTextures';
import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { getSmeltingRecipe, FUEL_VALUES } from '@/data/smelting';
import {
  applyEnchantmentToSlot,
  getEnchantingOptions,
  getEnchantmentSummary,
  isEnchantableItem,
} from '@/data/enchantments';
import { usePlayerStore } from '@/stores/playerStore';

export default function ContainerScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const activeContainer = useGameStore((s) => s.activeContainer);
  const setGameState = useGameStore((s) => s.setGameState);
  const openContainer = useGameStore((s) => s.openContainer);
  const heldItem = useInventoryStore((s) => s.heldItem);
  const setHeldItem = useInventoryStore((s) => s.setHeldItem);
  const addItem = useInventoryStore((s) => s.addItem);
  const pickupItem = useInventoryStore((s) => s.pickupItem);
  const placeItem = useInventoryStore((s) => s.placeItem);
  const hotbar = useInventoryStore((s) => s.hotbar);
  const inventory = useInventoryStore((s) => s.inventory);
  const blockEntityVersion = useWorldStore((s) => s.blockEntityVersion);
  const setBlockEntity = useWorldStore((s) => s.setBlockEntity);
  const experienceLevel = usePlayerStore((s) => s.experienceLevel);
  const consumeExperienceLevels = usePlayerStore((s) => s.consumeExperienceLevels);
  const worldSeed = useGameStore((s) => s.worldSeed);
  const [selectedEnchantSlot, setSelectedEnchantSlot] = useState<number | null>(null);

  const container = useMemo<BlockEntityData | undefined>(() => {
    if (!activeContainer) return undefined;
    const blockEntities = useWorldStore.getState().blockEntities;
    return blockEntities.get(`${activeContainer.x},${activeContainer.y},${activeContainer.z}`);
  }, [activeContainer, blockEntityVersion]);

  const bookshelfCount = useMemo(() => {
    if (!activeContainer || gameState !== 'enchanting') return 0;

    const world = useWorldStore.getState();
    let count = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
        const block = world.getBlock(activeContainer.x + dx, activeContainer.y, activeContainer.z + dz);
        const blockAbove = world.getBlock(activeContainer.x + dx, activeContainer.y + 1, activeContainer.z + dz);
        if (block === BlockType.BOOKSHELF || blockAbove === BlockType.BOOKSHELF) {
          count++;
        }
      }
    }
    return count;
  }, [activeContainer, gameState]);

  const enchantingSlot = useMemo(() => {
    if (selectedEnchantSlot === null) return null;
    return selectedEnchantSlot < hotbar.length
      ? hotbar[selectedEnchantSlot]
      : inventory[selectedEnchantSlot - hotbar.length];
  }, [hotbar, inventory, selectedEnchantSlot]);

  const enchantingOptions = useMemo(() => {
    if (!activeContainer || gameState !== 'enchanting') return [];
    return getEnchantingOptions(enchantingSlot, bookshelfCount, experienceLevel, worldSeed ^ activeContainer.x ^ (activeContainer.z << 8));
  }, [activeContainer, experienceLevel, enchantingSlot, gameState, bookshelfCount, worldSeed]);

  useEffect(() => {
    if (gameState !== 'enchanting') {
      setSelectedEnchantSlot(null);
      return;
    }

    if (selectedEnchantSlot !== null && enchantingSlot && isEnchantableItem(enchantingSlot.item)) return;

    const candidates = [...hotbar, ...inventory].findIndex((slot) => isEnchantableItem(slot.item));
    setSelectedEnchantSlot(candidates >= 0 ? candidates : null);
  }, [enchantingSlot, gameState, hotbar, inventory, selectedEnchantSlot]);

  const closeContainer = useCallback(() => {
    if (heldItem.item !== null) {
      addItem(heldItem.item, heldItem.count);
      setHeldItem({ item: null, count: 0 });
    }
    openContainer(null);
    setGameState('playing');
    setSelectedEnchantSlot(null);
  }, [addItem, heldItem, openContainer, setGameState, setHeldItem]);

  useEffect(() => {
    if (gameState !== 'chest' && gameState !== 'furnace' && gameState !== 'enchanting') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') {
        e.preventDefault();
        e.stopPropagation();
        closeContainer();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeContainer, gameState]);

  const handleChestSlotClick = useCallback((index: number, e: React.MouseEvent) => {
    if (!activeContainer || !container || container.type !== 'chest') return;
    const rightClick = e.button === 2;
    const slots = container.slots;
    const slot = slots[index];
    const held = useInventoryStore.getState().heldItem;
    const nextSlots = [...slots];

    if (held.item === null) {
      if (slot.item === null) return;
      if (rightClick && slot.count > 1) {
        const pickup = Math.ceil(slot.count / 2);
        setHeldItem({ item: slot.item, count: pickup, durability: slot.durability });
        nextSlots[index] = { ...slot, count: slot.count - pickup };
      } else {
        setHeldItem({ ...slot });
        nextSlots[index] = { item: null, count: 0 };
      }
    } else if (slot.item === null) {
      const placeCount = rightClick ? 1 : held.count;
      nextSlots[index] = { item: held.item, count: placeCount, durability: held.durability };
      setHeldItem(held.count > placeCount ? { ...held, count: held.count - placeCount } : { item: null, count: 0 });
    } else if (slot.item === held.item) {
      const canAdd = Math.min(rightClick ? 1 : held.count, 64 - slot.count);
      if (canAdd > 0) {
        nextSlots[index] = { ...slot, count: slot.count + canAdd };
        setHeldItem(held.count > canAdd ? { ...held, count: held.count - canAdd } : { item: null, count: 0 });
      }
    } else {
      nextSlots[index] = { ...held };
      setHeldItem({ ...slot });
    }

    setBlockEntity(activeContainer.x, activeContainer.y, activeContainer.z, { type: 'chest', slots: nextSlots });
  }, [activeContainer, container, setBlockEntity, setHeldItem]);

  const handleFurnaceSlotClick = useCallback((slotName: 'input' | 'fuel' | 'output', e: React.MouseEvent) => {
    if (!activeContainer || !container || container.type !== 'furnace') return;
    const rightClick = e.button === 2;
    const current = container;
    const held = useInventoryStore.getState().heldItem;
    const next = { ...current };

    const slot = current[slotName];
    if (slotName === 'output') {
      if (slot.item === null) return;
      if (held.item === null) {
        setHeldItem({ ...slot });
        next.output = { item: null, count: 0 };
      } else if (held.item === slot.item) {
        const canAdd = Math.min(slot.count, 64 - held.count);
        if (canAdd > 0) {
          setHeldItem({ ...held, count: held.count + canAdd });
          next.output = slot.count > canAdd ? { ...slot, count: slot.count - canAdd } : { item: null, count: 0 };
        }
      }
    } else {
      if (held.item === null) {
        if (slot.item === null) return;
        if (rightClick && slot.count > 1) {
          const pickup = Math.ceil(slot.count / 2);
          setHeldItem({ item: slot.item, count: pickup, durability: slot.durability });
          next[slotName] = { ...slot, count: slot.count - pickup };
        } else {
          setHeldItem({ ...slot });
          next[slotName] = { item: null, count: 0 };
        }
      } else if (slot.item === null) {
        next[slotName] = { item: held.item, count: rightClick ? 1 : held.count, durability: held.durability };
        setHeldItem(held.count > (rightClick ? 1 : held.count) ? { ...held, count: held.count - (rightClick ? 1 : held.count) } : { item: null, count: 0 });
      } else if (slot.item === held.item) {
        const add = Math.min(rightClick ? 1 : held.count, 64 - slot.count);
        if (add > 0) {
          next[slotName] = { ...slot, count: slot.count + add };
          setHeldItem(held.count > add ? { ...held, count: held.count - add } : { item: null, count: 0 });
        }
      } else {
        next[slotName] = { ...held };
        setHeldItem({ ...slot });
      }
    }

    setBlockEntity(activeContainer.x, activeContainer.y, activeContainer.z, next as any);
  }, [activeContainer, container, setBlockEntity, setHeldItem]);

  const handleEnchantSlotClick = useCallback((index: number) => {
    if (gameState !== 'enchanting' || selectedEnchantSlot === null) return;
    if (!activeContainer || !enchantingSlot || !isEnchantableItem(enchantingSlot.item)) return;

    const offer = enchantingOptions[index];
    if (!offer || offer.disabled) return;

    const inventoryState = useInventoryStore.getState();
    if (!inventoryState.hasItem(ItemType.LAPIS_LAZULI, offer.lapisCost)) return;
    if (!consumeExperienceLevels(offer.cost)) return;

    const currentSlot = enchantingSlot;
    const nextSlot = applyEnchantmentToSlot(currentSlot, offer);
    inventoryState.removeItem(ItemType.LAPIS_LAZULI, offer.lapisCost);

    if (selectedEnchantSlot < hotbar.length) {
      inventoryState.setHotbarSlot(selectedEnchantSlot, nextSlot);
    } else {
      inventoryState.setSlot(selectedEnchantSlot, nextSlot);
    }
  }, [activeContainer, consumeExperienceLevels, enchantingOptions, enchantingSlot, gameState, hotbar.length, selectedEnchantSlot]);

  const title = gameState === 'chest' ? 'Chest' : gameState === 'furnace' ? 'Furnace' : 'Enchanting Table';

  if (gameState !== 'chest' && gameState !== 'furnace' && gameState !== 'enchanting') return null;
  if (!activeContainer) return null;
  if ((gameState === 'chest' || gameState === 'furnace') && !container) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onContextMenu={(e) => e.preventDefault()}>
      <div className="bg-[#2b2b2b] border border-black shadow-2xl rounded-lg p-4 text-white min-w-[760px]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold tracking-wide">{title}</div>
          <button className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm" onClick={closeContainer}>
            Close
          </button>
        </div>

        {gameState === 'chest' && container?.type === 'chest' ? (
          <div className="grid grid-cols-[auto_auto] gap-4">
            <div>
              <div className="grid grid-cols-9 gap-1">
                {container.slots.map((slot, i) => (
                  <ContainerSlotButton key={i} slot={slot} onClick={(e) => handleChestSlotClick(i, e)} />
                ))}
              </div>
            </div>
            <div>
              <InventoryPanel hotbar={hotbar} inventory={inventory} />
            </div>
          </div>
        ) : null}

        {gameState === 'furnace' && container?.type === 'furnace' ? (
          <div className="grid grid-cols-[auto_auto] gap-4">
            <div className="p-3 rounded border border-black/30 bg-black/20">
              <div className="flex gap-2 items-center mb-3">
                <ContainerSlotButton slot={container.input} onClick={(e) => handleFurnaceSlotClick('input', e)} label="Input" />
                <div className="text-xl">+</div>
                <ContainerSlotButton slot={container.fuel} onClick={(e) => handleFurnaceSlotClick('fuel', e)} label="Fuel" />
                <div className="text-xl">→</div>
                <ContainerSlotButton slot={container.output} onClick={(e) => handleFurnaceSlotClick('output', e)} label="Output" />
              </div>
              <div className="text-xs text-gray-300">Put raw items in the input slot and coal or wood in fuel.</div>
            </div>
            <div>
              <InventoryPanel hotbar={hotbar} inventory={inventory} />
            </div>
          </div>
        ) : null}

        {gameState === 'enchanting' ? (
          <div className="grid grid-cols-[360px_1fr] gap-4">
            <div className="p-3 rounded border border-black/30 bg-black/20 space-y-3">
              <div className="text-sm text-amber-100/80">
                Bookshelves nearby: <span className="font-semibold text-white">{bookshelfCount}</span>
              </div>
              <div className="text-sm text-amber-100/80">
                Level: <span className="font-semibold text-white">{experienceLevel}</span>
              </div>
              <div className="grid grid-cols-9 gap-1 max-h-[260px] overflow-y-auto pr-1">
                {[...hotbar, ...inventory].map((slot, index) => {
                  const isSelected = selectedEnchantSlot === index;
                  return (
                    <button
                      key={`ench-slot-${index}`}
                      className={`w-12 h-12 border-2 relative transition-colors ${isSelected ? 'border-amber-400 bg-amber-900/30' : 'border-[#5a5a5a] bg-[#1f1f1f] hover:border-[#9a9a9a]'}`}
                      onClick={() => setSelectedEnchantSlot(index)}
                      disabled={!isEnchantableItem(slot.item)}
                      title={slot.item !== null ? `${getItemName(slot.item)}${slot.enchantments ? ` (${getEnchantmentSummary(slot)})` : ''}` : 'Empty'}
                    >
                      <SelectableSlotPreview slot={slot} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-3 rounded border border-black/30 bg-black/20">
              <div className="text-sm font-semibold text-amber-100 mb-3">
                {enchantingSlot && isEnchantableItem(enchantingSlot.item)
                  ? `${getItemName(enchantingSlot.item as BlockType | ItemType)}${enchantingSlot.enchantments ? ` - ${getEnchantmentSummary(enchantingSlot)}` : ''}`
                  : 'Select an item to enchant'}
              </div>
              <div className="grid gap-3">
                {enchantingOptions.length > 0 ? enchantingOptions.map((offer, index) => (
                  <button
                    key={offer.id}
                    className={`p-3 rounded border text-left transition-colors ${offer.disabled ? 'border-gray-700 bg-black/20 text-gray-500' : 'border-amber-700 bg-[#3a2a18] hover:bg-[#4a341c] text-amber-50'}`}
                    onClick={() => handleEnchantSlotClick(index)}
                    disabled={offer.disabled || selectedEnchantSlot === null}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{offer.name} Lv {offer.level}</div>
                      <div className="text-xs">
                        {offer.cost} lvl / {offer.lapisCost} lapis
                      </div>
                    </div>
                    <div className="text-xs mt-1 text-amber-100/80">
                      Power {Math.round(offer.power)} · {offer.disabled ? 'Need more levels' : 'Click to apply'}
                    </div>
                  </button>
                )) : (
                  <div className="text-sm text-gray-300">
                    Put a tool, weapon, armor piece, bow, or book in a slot to see enchantments.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {heldItem.item !== null ? (
          <div className="fixed pointer-events-none z-[80]" style={{ left: '50%', top: '50%' }}>
            <div className="text-xs text-white">Holding {getItemName(heldItem.item)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FurnaceProcessor() {
  const gameState = useGameStore((s) => s.gameState);

  useEffect(() => {
    if (gameState === 'paused' || gameState === 'menu' || gameState === 'loading' || gameState === 'dead') return;

    const id = window.setInterval(() => {
      const { blockEntities, setBlockEntity } = useWorldStore.getState();
      for (const [key, entity] of blockEntities.entries()) {
        if (entity.type !== 'furnace') continue;

        const [x, y, z] = key.split(',').map(Number);
        const recipe = getSmeltingRecipe(entity.input.item);
        const fuelValue = entity.fuel.item ? FUEL_VALUES[entity.fuel.item] ?? 0 : 0;
        let next: BlockEntityData = entity;

        if (!recipe) {
          if (entity.cookTime !== 0) {
            next = { ...entity, cookTime: 0 };
          }
        } else {
          if (next.burnTime <= 0 && fuelValue > 0 && next.fuel.count > 0) {
            const nextFuelCount = next.fuel.count - 1;
            next = {
              ...next,
              fuel: { item: nextFuelCount > 0 ? next.fuel.item : null, count: nextFuelCount },
              burnTime: fuelValue,
            };
          }

          const resultItem = recipe.output;
          const canOutput = next.output.item === null || (next.output.item === resultItem && next.output.count < 64);
          if (next.burnTime > 0 && canOutput) {
            const nextCook = next.cookTime + 0.25;
            if (nextCook >= recipe.cookTime) {
              const nextOutputCount = Math.min(64, (next.output.item === resultItem ? next.output.count : 0) + (recipe.count ?? 1));
              const nextInputCount = next.input.count - 1;
              next = {
                ...next,
                input: { item: nextInputCount > 0 ? next.input.item : null, count: Math.max(0, nextInputCount) },
                output: { item: resultItem, count: nextOutputCount },
                burnTime: Math.max(0, next.burnTime - 0.25),
                cookTime: 0,
              };
            } else {
              next = {
                ...next,
                burnTime: Math.max(0, next.burnTime - 0.25),
                cookTime: nextCook,
              };
            }
          }
        }

        if (next !== entity) {
          setBlockEntity(x, y, z, next);
        }
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [gameState]);

  return null;
}

function InventoryPanel({ hotbar, inventory }: { hotbar: ContainerSlot[]; inventory: ContainerSlot[] }) {
  const pickupItem = useInventoryStore((s) => s.pickupItem);
  const placeItem = useInventoryStore((s) => s.placeItem);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-9 gap-1">
        {inventory.map((slot, i) => (
          <ContainerSlotButton key={`inv-${i}`} slot={slot} onClick={(e) => {
            const right = e.button === 2;
            if (useInventoryStore.getState().heldItem.item === null) pickupItem(i + 9, right);
            else placeItem(i + 9, right);
          }} />
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1">
        {hotbar.map((slot, i) => (
          <ContainerSlotButton key={`hot-${i}`} slot={slot} onClick={(e) => {
            const right = e.button === 2;
            if (useInventoryStore.getState().heldItem.item === null) pickupItem(i, right);
            else placeItem(i, right);
          }} />
        ))}
      </div>
    </div>
  );
}

function SelectableSlotPreview({ slot }: { slot: ContainerSlot }) {
  const name = slot.item !== null ? getItemName(slot.item) : '';
  const texture = slot.item !== null ? itemTextureGenerator.getItemImageSrc(slot.item) : null;
  return (
    <div className="w-full h-full relative" title={name}>
      {texture ? <img src={texture} alt={name} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} /> : null}
      {slot.count > 1 ? <span className="absolute bottom-0 right-0 text-xs font-bold text-white drop-shadow">{slot.count}</span> : null}
      {slot.enchantments && Object.keys(slot.enchantments).length > 0 ? (
        <span className="absolute top-0 left-0 text-[9px] text-amber-300 font-bold drop-shadow">E</span>
      ) : null}
    </div>
  );
}

function ContainerSlotButton({ slot, onClick, label }: { slot: ContainerSlot; onClick: (e: React.MouseEvent) => void; label?: string }) {
  const name = slot.item !== null ? getItemName(slot.item) : label ?? '';
  const texture = slot.item !== null ? itemTextureGenerator.getItemImageSrc(slot.item) : null;
  return (
    <button
      className="w-12 h-12 border-2 border-[#5a5a5a] bg-[#1f1f1f] relative hover:border-[#9a9a9a] transition-colors"
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onClick(e); }}
      title={name}
    >
      {texture ? <img src={texture} alt={name} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} /> : null}
      {slot.count > 1 ? <span className="absolute bottom-0 right-0 text-xs font-bold text-white drop-shadow">{slot.count}</span> : null}
      {slot.item === null && label ? <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500">{label}</span> : null}
    </button>
  );
}
