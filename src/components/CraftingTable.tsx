'use client';

import { useEffect, useCallback, useState } from 'react';
import { useInventoryStore, getItemName, getItemColor, InventorySlot } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { itemTextureGenerator } from '@/data/itemTextures';
import { BlockType, BLOCKS } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { findRecipeMatch } from '@/data/recipes';

export default function CraftingTable() {
  const gameState = useGameStore((state) => state.gameState);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameState = useGameStore((state) => state.setGameState);

  const hotbar = useInventoryStore((state) => state.hotbar);
  const inventory = useInventoryStore((state) => state.inventory);
  const craftingGrid3x3 = useInventoryStore((state) => state.craftingGrid3x3);
  const craftingResult3x3 = useInventoryStore((state) => state.craftingResult3x3);
  const heldItem = useInventoryStore((state) => state.heldItem);
  const pickupItem = useInventoryStore((state) => state.pickupItem);
  const placeItem = useInventoryStore((state) => state.placeItem);
  const addItem = useInventoryStore((state) => state.addItem);
  const setCraftingGrid3x3 = useInventoryStore((state) => state.setCraftingGrid3x3);
  const setCraftingResult3x3 = useInventoryStore((state) => state.setCraftingResult3x3);
  const clearCraftingGrid3x3 = useInventoryStore((state) => state.clearCraftingGrid3x3);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [consumeMask, setConsumeMask] = useState<boolean[][]>(
    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => false))
  );

  // Update held item display position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Recompute 3x3 crafting result whenever the grid changes
  useEffect(() => {
    const grid: (BlockType | ItemType | null)[][] = [
      [craftingGrid3x3[0]?.item ?? null, craftingGrid3x3[1]?.item ?? null, craftingGrid3x3[2]?.item ?? null],
      [craftingGrid3x3[3]?.item ?? null, craftingGrid3x3[4]?.item ?? null, craftingGrid3x3[5]?.item ?? null],
      [craftingGrid3x3[6]?.item ?? null, craftingGrid3x3[7]?.item ?? null, craftingGrid3x3[8]?.item ?? null],
    ];

    const match = findRecipeMatch(grid);
    if (match) {
      setCraftingResult3x3({
        item: match.recipe.result.item,
        count: match.recipe.result.count,
      });
      setConsumeMask(match.consumeMask);
    } else {
      setCraftingResult3x3({ item: null, count: 0 });
      setConsumeMask(Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => false)));
    }
  }, [craftingGrid3x3, setCraftingResult3x3]);

  // Handle crafting result click
  const handleCraftClick = useCallback(() => {
    if (craftingResult3x3.item === null) return;

    // Add result to held cursor if possible
    if (heldItem.item === null) {
      useInventoryStore.setState({ heldItem: { ...craftingResult3x3 } });
    } else if (heldItem.item === craftingResult3x3.item) {
      const newCount = heldItem.count + craftingResult3x3.count;
      useInventoryStore.setState({
        heldItem: { ...heldItem, count: Math.min(newCount, 64) },
      });
    } else {
      return;
    }

    // Consume only the slots that matched the recipe
    const newGrid = craftingGrid3x3.map((slot, idx) => {
      const y = Math.floor(idx / 3);
      const x = idx % 3;
      if (consumeMask[y]?.[x] && slot.item !== null) {
        const newCount = slot.count - 1;
        return { ...slot, count: newCount, item: newCount > 0 ? slot.item : null };
      }
      return slot;
    });
    setCraftingGrid3x3(newGrid);
  }, [craftingResult3x3, craftingGrid3x3, heldItem, setCraftingGrid3x3, consumeMask]);

  const handleSlotClick = useCallback(
    (index: number, isHotbar: boolean, e: React.MouseEvent) => {
      const isRightClick = e.button === 2;

      if (isHotbar) {
        if (heldItem.item === null) {
          pickupItem(index, isRightClick);
        } else {
          placeItem(index, isRightClick);
        }
      } else {
        const actualIndex = index + 9; // inventory slots start after hotbar
        if (heldItem.item === null) {
          pickupItem(actualIndex, isRightClick);
        } else {
          placeItem(actualIndex, isRightClick);
        }
      }
    },
    [heldItem, pickupItem, placeItem]
  );

  // Handle crafting grid click
  const handleCraftingSlotClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      const isRightClick = e.button === 2;
      const slot = craftingGrid3x3[index];
      const currentHeld = useInventoryStore.getState().heldItem;

      if (currentHeld.item === null) {
        // Pick up from grid
        if (slot.item !== null) {
          if (isRightClick && slot.count > 1) {
            const pickup = Math.ceil(slot.count / 2);
            useInventoryStore.setState({
              heldItem: { item: slot.item, count: pickup },
            });
            const newGrid = [...craftingGrid3x3];
            newGrid[index] = { ...slot, count: slot.count - pickup };
            setCraftingGrid3x3(newGrid);
          } else {
            useInventoryStore.setState({ heldItem: { ...slot } });
            const newGrid = [...craftingGrid3x3];
            newGrid[index] = { item: null, count: 0 };
            setCraftingGrid3x3(newGrid);
          }
        }
      } else {
        // Place into grid
        if (slot.item === null) {
          const placeCount = isRightClick ? 1 : currentHeld.count;
          const newGrid = [...craftingGrid3x3];
          newGrid[index] = { item: currentHeld.item, count: placeCount };
          setCraftingGrid3x3(newGrid);

          const remaining = currentHeld.count - placeCount;
          useInventoryStore.setState({
            heldItem: remaining > 0 ? { ...currentHeld, count: remaining } : { item: null, count: 0 },
          });
        } else if (slot.item === currentHeld.item) {
          const canAdd = Math.min(isRightClick ? 1 : currentHeld.count, 64 - slot.count);
          if (canAdd > 0) {
            const newGrid = [...craftingGrid3x3];
            newGrid[index] = { ...slot, count: slot.count + canAdd };
            setCraftingGrid3x3(newGrid);

            const remaining = currentHeld.count - canAdd;
            useInventoryStore.setState({
              heldItem: remaining > 0 ? { ...currentHeld, count: remaining } : { item: null, count: 0 },
            });
          }
        } else {
          // Swap
          const newGrid = [...craftingGrid3x3];
          newGrid[index] = { ...currentHeld };
          setCraftingGrid3x3(newGrid);
          useInventoryStore.setState({ heldItem: { ...slot } });
        }
      }
    },
    [craftingGrid3x3, setCraftingGrid3x3]
  );

  // Close crafting table with Escape / E: return leftovers to main inventory
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Only handle escape key when in crafting state
      if (gameState !== 'crafting') return;
      
      if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') {
        e.preventDefault();
        e.stopPropagation();
        
        const { heldItem: currentHeld } = useInventoryStore.getState();

        // Return held item
        if (currentHeld.item !== null) {
          addItem(currentHeld.item, currentHeld.count);
          useInventoryStore.setState({ heldItem: { item: null, count: 0 } });
        }

        // Return grid items
        craftingGrid3x3.forEach((slot) => {
          if (slot.item !== null) {
            addItem(slot.item, slot.count);
          }
        });

        clearCraftingGrid3x3();
        setGameState('playing');
      }
    };

    if (gameState === 'crafting') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [gameState, craftingGrid3x3, addItem, clearCraftingGrid3x3, setGameState]);

  // Only show for survival mode crafting UI
  if (gameState !== 'crafting' || gameMode === 'creative') return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-white text-center mb-4 text-lg">Crafting Table</h2>

        {/* Crafting area */}
        <div className="flex justify-center gap-8 mb-6">
          {/* 3x3 grid */}
          <div className="grid grid-cols-3 gap-1">
            {craftingGrid3x3.map((slot, i) => (
              <SlotButton
                key={`craft3-${i}`}
                slot={slot}
                onClick={(e) => handleCraftingSlotClick(i, e)}
              />
            ))}
          </div>

          {/* Arrow */}
          <div className="flex items-center text-white text-2xl">→</div>

          {/* Result */}
          <div>
            <SlotButton slot={craftingResult3x3} onClick={handleCraftClick} isResult />
          </div>
        </div>

        {/* Main inventory (27 slots) */}
        <div className="grid grid-cols-9 gap-1 mb-2">
          {inventory.map((slot, i) => (
            <SlotButton key={`inv-${i}`} slot={slot} onClick={(e) => handleSlotClick(i, false, e)} />
          ))}
        </div>

        {/* Hotbar */}
        <div className="grid grid-cols-9 gap-1 pt-2 border-t border-gray-600">
          {hotbar.map((slot, i) => (
            <SlotButton key={`hot-${i}`} slot={slot} onClick={(e) => handleSlotClick(i, true, e)} />
          ))}
        </div>
      </div>

      {/* Held item following cursor */}
      {heldItem.item !== null && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: mousePos.x - 20,
            top: mousePos.y - 20,
          }}
        >
          <ItemDisplay item={heldItem.item} count={heldItem.count} />
        </div>
      )}
    </div>
  );
}

interface SlotButtonProps {
  slot: InventorySlot;
  onClick: (e: React.MouseEvent) => void;
  isResult?: boolean;
}

function SlotButton({ slot, onClick, isResult }: SlotButtonProps) {
  return (
    <button
      className={`
        w-12 h-12 border-2 relative
        ${isResult ? 'border-yellow-600 bg-yellow-900/30' : 'border-gray-600 bg-gray-700/50'}
        hover:border-gray-400 transition-colors
      `}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onClick(e);
      }}
    >
      {slot.item !== null && <ItemDisplay item={slot.item} count={slot.count} />}
    </button>
  );
}

function ItemDisplay({ item, count }: { item: BlockType | ItemType; count: number }) {
  const name = getItemName(item);

  // Use the new item texture generator
  const itemTexture = itemTextureGenerator.generateItemTexture(item);
  const canvas = itemTexture.canvas;

  return (
    <div className="w-full h-full flex items-center justify-center relative group" title={name}>
      {/* Item texture using canvas */}
      <div
        className="w-8 h-8 border border-black/30 relative"
        style={{
          borderRadius: '2px',
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)',
        }}
      >
        <img
          src={canvas.toDataURL()}
          alt={name}
          className="w-full h-full object-cover"
          style={{
            imageRendering: 'pixelated',
          }}
        />
      </div>
      
      {/* Item count */}
      {count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-white text-xs font-bold drop-shadow-lg">
          {count}
        </span>
      )}
      
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {name}
        {typeof item === 'number' && (BLOCKS[item] as any)?.breakTime !== undefined && (
          <div className="text-gray-300 text-[10px]">
            Break time: {(BLOCKS[item] as any).breakTime}s
          </div>
        )}
      </div>
    </div>
  );
}
