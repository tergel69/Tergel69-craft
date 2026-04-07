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
    <div className="flex gap-0.5 bg-black/70 p-1.5 rounded-lg" style={{
      boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      border: '2px solid rgba(0,0,0,0.3)'
    }}>
      {hotbar.map((slot, index) => (
        <div
          key={index}
          className={index === selectedSlot
            ? "w-14 h-14 relative flex items-center justify-center border-2 border-white bg-white/20"
            : "w-14 h-14 relative flex items-center justify-center border-2 border-gray-600 bg-black/40"
          }
          style={{
            borderRadius: '4px',
            boxShadow: index === selectedSlot
              ? '0 0 12px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
              : 'inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.2)',
            transition: 'all 0.15s ease'
          }}
        >
          {/* Inner highlight */}
          <div style={{
            position: 'absolute',
            inset: 2,
            background: index === selectedSlot
              ? 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
              : 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
            borderRadius: '2px',
            pointerEvents: 'none'
          }} />
          {slot.item !== null && (
            <>
              {/* Item icon */}
              <ItemIcon item={slot.item} />

              {/* Item count */}
              {slot.count > 1 && (
                <span
                  className="absolute bottom-0.5 right-0.5 text-white text-xs font-bold"
                  style={{
                    textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 0 0 3px #000',
                    fontFamily: 'monospace',
                    fontWeight: 'bold'
                  }}
                >
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
          <span
            className="absolute top-0.5 left-1 text-gray-400 text-[9px]"
            style={{ fontFamily: 'monospace' }}
          >
            {index + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

function ItemIcon({ item }: { item: BlockType | ItemType }) {
  const src = itemTextureGenerator.getItemImageSrc(item);

  return (
    <div
      className="w-9 h-9 border border-black/30 relative"
      style={{
        borderRadius: '3px',
        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 0 rgba(0,0,0,0.35)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.2) 100%)',
      }}
    >
      <img
        src={src}
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
    <div className="absolute bottom-1 left-1 right-1 h-1 bg-black/60 rounded-sm" style={{
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.3)'
    }}>
      <div
        className="h-full transition-all"
        style={{
          width: `${percentage * 100}%`,
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}80`,
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
