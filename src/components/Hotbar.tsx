'use client';

import { useInventoryStore, getItemName, getItemColor } from '@/stores/inventoryStore';
import { usePlayerStore } from '@/stores/playerStore';
import { itemTextureGenerator } from '@/data/itemTextures';
import { BlockType, BLOCKS } from '@/data/blocks';
import { ItemType } from '@/data/items';

export default function Hotbar() {
  const hotbar = useInventoryStore((state) => state.hotbar);
  const selectedSlot = usePlayerStore((state) => state.selectedSlot);

  return (
    <div className="flex gap-0.5 bg-black/60 p-1 rounded">
      {hotbar.map((slot, index) => (
        <div
          key={index}
          className={`
            w-12 h-12 relative flex items-center justify-center
            border-2 transition-colors
            ${index === selectedSlot
              ? 'border-white bg-white/20'
              : 'border-gray-600 bg-black/40'
            }
          `}
        >
          {slot.item !== null && (
            <>
              {/* Item icon */}
              <ItemIcon item={slot.item} />

              {/* Item count */}
              {slot.count > 1 && (
                <span className="absolute bottom-0 right-0.5 text-white text-xs font-bold drop-shadow-lg">
                  {slot.count}
                </span>
              )}

              {/* Durability bar */}
              {slot.durability !== undefined && (
                <DurabilityBar current={slot.durability} max={getDurability(slot.item)} />
              )}
            </>
          )}

          {/* Slot number hint */}
          <span className="absolute top-0 left-0.5 text-gray-400 text-[10px]">
            {index + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

function ItemIcon({ item }: { item: BlockType | ItemType }) {
  // Use the new item texture generator
  const itemTexture = itemTextureGenerator.generateItemTexture(item);
  const canvas = itemTexture.canvas;

  return (
    <div
      className="w-8 h-8 border border-black/30 relative"
      style={{
        borderRadius: '2px',
        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <img
        src={canvas.toDataURL()}
        alt={getItemName(item)}
        className="w-full h-full object-cover"
        style={{
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

function DurabilityBar({ current, max }: { current: number; max: number }) {
  const percentage = current / max;

  let color = '#4ADE80'; // Green
  if (percentage < 0.25) color = '#EF4444'; // Red
  else if (percentage < 0.5) color = '#F59E0B'; // Orange

  return (
    <div className="absolute bottom-0.5 left-0.5 right-0.5 h-0.5 bg-black/50">
      <div
        className="h-full transition-all"
        style={{
          width: `${percentage * 100}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function getDurability(item: BlockType | ItemType): number {
  // Return max durability for items
  const durabilities: Record<string, number> = {
    wooden_pickaxe: 60,
    stone_pickaxe: 132,
    iron_pickaxe: 251,
    gold_pickaxe: 33,
    diamond_pickaxe: 1562,
    wooden_axe: 60,
    stone_axe: 132,
    iron_axe: 251,
    gold_axe: 33,
    diamond_axe: 1562,
    wooden_shovel: 60,
    stone_shovel: 132,
    iron_shovel: 251,
    gold_shovel: 33,
    diamond_shovel: 1562,
    wooden_sword: 60,
    stone_sword: 132,
    iron_sword: 251,
    gold_sword: 33,
    diamond_sword: 1562,
    wooden_hoe: 60,
    stone_hoe: 132,
    iron_hoe: 251,
    gold_hoe: 33,
    diamond_hoe: 1562,
    shears: 238,
  };

  return durabilities[item as string] || 100;
}
