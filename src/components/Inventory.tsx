'use client';
/**
 * Inventory.tsx — Complete rewrite
 * Clean Minecraft-style layout: armor | player | crafting
 * Smooth drag-and-drop, right-click split, keyboard shortcuts
 */

import { useEffect, useCallback, useState } from 'react';
import { useInventoryStore, getItemName, getItemColor, InventorySlot } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { BlockType, BLOCKS } from '@/data/blocks';
import { ItemType, ITEMS } from '@/data/items';
import { findRecipeMatch } from '@/data/recipes';

// ── Constants ─────────────────────────────────────────────────────────────────
const SLOT_SIZE = 48; // px

// ── Slot rendering ────────────────────────────────────────────────────────────

function getSlotBg(item: BlockType | ItemType | null): string {
  if (item === null) return '#2a2a2a';
  const color = getItemColor(item);
  return color || '#555';
}

function ItemIcon({ item, count, size = 36 }: { item: BlockType | ItemType; count: number; size?: number }) {
  const color = getItemColor(item);
  const name = getItemName(item);
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        style={{
          width: size, height: size,
          background: `linear-gradient(135deg, ${lighten(color, 20)} 0%, ${color} 60%, ${darken(color, 20)} 100%)`,
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 0 rgba(0,0,0,0.35)',
          imageRendering: 'pixelated',
          borderRadius: 2,
          flexShrink: 0,
        }}
        title={name}
      />
      {count > 1 && (
        <span
          className="absolute bottom-0.5 right-0.5 text-white font-bold select-none pointer-events-none"
          style={{ fontSize: 10, textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function lighten(hex: string, amt: number): string {
  return adjustColor(hex, amt);
}
function darken(hex: string, amt: number): string {
  return adjustColor(hex, -amt);
}
function adjustColor(hex: string, amt: number): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex; }
}

interface SlotProps {
  slot: InventorySlot;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
  highlight?: boolean;
  dim?: boolean;
}

function Slot({ slot, onClick, label, highlight, dim }: SlotProps) {
  const [hovered, setHovered] = useState(false);
  const name = slot.item !== null ? getItemName(slot.item) : label;

  return (
    <div className="relative group" style={{ width: SLOT_SIZE, height: SLOT_SIZE }}>
      <button
        style={{
          width: SLOT_SIZE, height: SLOT_SIZE,
          background: hovered ? '#3a3a3a' : '#1e1e1e',
          border: `2px solid ${highlight ? '#f0b429' : hovered ? '#888' : '#555'}`,
          boxShadow: highlight ? '0 0 6px #f0b429' : 'inset 1px 1px 0 #333, inset -1px -1px 0 #111',
          position: 'relative',
          cursor: 'pointer',
          opacity: dim ? 0.45 : 1,
          transition: 'border-color 0.1s, background 0.1s',
          borderRadius: 3,
        }}
        onClick={onClick}
        onContextMenu={e => { e.preventDefault(); onClick(e); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {slot.item !== null && <ItemIcon item={slot.item} count={slot.count} size={32} />}
        {slot.item === null && label && (
          <span style={{ color: '#444', fontSize: 9, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {label}
          </span>
        )}
        {/* Durability bar */}
        {slot.durability !== undefined && slot.item !== null && (() => {
          const itemData = typeof slot.item === 'string' ? ITEMS[slot.item] : null;
          const maxDur = itemData?.durability ?? 1;
          const pct = slot.durability / maxDur;
          const barColor = pct > 0.6 ? '#55ff55' : pct > 0.3 ? '#ffaa00' : '#ff3333';
          return (
            <div style={{
              position: 'absolute', bottom: 2, left: 2, right: 2, height: 2,
              background: '#222', borderRadius: 1,
            }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', background: barColor, borderRadius: 1 }} />
            </div>
          );
        })()}
      </button>
      {/* Tooltip */}
      {hovered && name && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.92)', color: '#fff', fontSize: 11, padding: '4px 8px',
          borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          border: '1px solid #555',
        }}>
          {name}
        </div>
      )}
    </div>
  );
}

// ── Main Inventory ────────────────────────────────────────────────────────────

export default function Inventory() {
  const gameState = useGameStore(s => s.gameState);
  const gameMode  = useGameStore(s => s.gameMode);

  const hotbar          = useInventoryStore(s => s.hotbar);
  const inventory       = useInventoryStore(s => s.inventory);
  const craftingGrid    = useInventoryStore(s => s.craftingGrid);
  const craftingResult  = useInventoryStore(s => s.craftingResult);
  const heldItem        = useInventoryStore(s => s.heldItem);
  const armor           = useInventoryStore(s => s.armor);
  const setCraftingGrid = useInventoryStore(s => s.setCraftingGrid);
  const setCraftingResult = useInventoryStore(s => s.setCraftingResult);
  const clearCraftingGrid = useInventoryStore(s => s.clearCraftingGrid);
  const addItem         = useInventoryStore(s => s.addItem);
  const setArmorSlot    = useInventoryStore(s => s.setArmorSlot);
  const pickupItem      = useInventoryStore(s => s.pickupItem);
  const placeItem       = useInventoryStore(s => s.placeItem);
  const [consumeMask, setConsumeMask] = useState<boolean[][]>([
    [false, false],
    [false, false],
  ]);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  // Crafting: recalculate result whenever grid changes
  useEffect(() => {
    const grid = [
      [craftingGrid[0]?.item ?? null, craftingGrid[1]?.item ?? null],
      [craftingGrid[2]?.item ?? null, craftingGrid[3]?.item ?? null],
    ];
    const match = findRecipeMatch(grid);
    if (match) {
      setCraftingResult({ item: match.recipe.result.item, count: match.recipe.result.count });
      setConsumeMask(match.consumeMask);
    } else {
      setCraftingResult({ item: null, count: 0 });
      setConsumeMask([
        [false, false],
        [false, false],
      ]);
    }
  }, [craftingGrid, setCraftingResult]);

  const handleCraftResult = useCallback(() => {
    if (craftingResult.item === null) return;
    const store = useInventoryStore.getState();
    const held = store.heldItem;
    if (held.item === null) {
      useInventoryStore.setState({ heldItem: { ...craftingResult } });
    } else if (held.item === craftingResult.item && held.count + craftingResult.count <= 64) {
      useInventoryStore.setState({ heldItem: { ...held, count: held.count + craftingResult.count } });
    } else return;
    const newGrid = craftingGrid.map((slot, idx) => {
      const gy = Math.floor(idx / 2);
      const gx = idx % 2;
      if (!consumeMask[gy]?.[gx] || slot.item === null) return slot;
      const nextCount = slot.count - 1;
      return { ...slot, count: nextCount, item: nextCount > 0 ? slot.item : null };
    });
    setCraftingGrid(newGrid);
  }, [craftingResult, craftingGrid, consumeMask, setCraftingGrid]);

  const handleSlotClick = useCallback((idx: number, isHotbar: boolean, e: React.MouseEvent) => {
    const right = e.button === 2;
    const actualIdx = isHotbar ? idx : idx + 9;
    if (useInventoryStore.getState().heldItem.item === null) pickupItem(actualIdx, right);
    else placeItem(actualIdx, right);
  }, [pickupItem, placeItem]);

  const handleCraftSlot = useCallback((i: number, e: React.MouseEvent) => {
    const right = e.button === 2;
    const slot = craftingGrid[i];
    const held = useInventoryStore.getState().heldItem;
    if (held.item === null) {
      if (slot.item === null) return;
      if (right && slot.count > 1) {
        const n = Math.ceil(slot.count / 2);
        useInventoryStore.setState({ heldItem: { item: slot.item, count: n } });
        const g = [...craftingGrid]; g[i] = { ...slot, count: slot.count - n }; setCraftingGrid(g);
      } else {
        useInventoryStore.setState({ heldItem: { ...slot } });
        const g = [...craftingGrid]; g[i] = { item: null, count: 0 }; setCraftingGrid(g);
      }
    } else {
      if (slot.item === null) {
        const n = right ? 1 : held.count;
        const g = [...craftingGrid]; g[i] = { item: held.item, count: n }; setCraftingGrid(g);
        const rem = held.count - n;
        useInventoryStore.setState({ heldItem: rem > 0 ? { ...held, count: rem } : { item: null, count: 0 } });
      } else if (slot.item === held.item) {
        const n = right ? 1 : held.count;
        const add = Math.min(n, 64 - slot.count);
        const g = [...craftingGrid]; g[i] = { ...slot, count: slot.count + add }; setCraftingGrid(g);
        const rem = held.count - add;
        useInventoryStore.setState({ heldItem: rem > 0 ? { ...held, count: rem } : { item: null, count: 0 } });
      } else {
        const g = [...craftingGrid]; g[i] = { ...held }; setCraftingGrid(g);
        useInventoryStore.setState({ heldItem: { ...slot } });
      }
    }
  }, [craftingGrid, setCraftingGrid]);

  const handleArmorSlot = useCallback((name: 'helmet'|'chestplate'|'leggings'|'boots', e: React.MouseEvent) => {
    const held = useInventoryStore.getState().heldItem;
    const current = armor[name];
    if (held.item === null) {
      if (current.item !== null) {
        useInventoryStore.setState({ heldItem: { ...current } });
        setArmorSlot(name, { item: null, count: 0 });
      }
    } else {
      if (typeof held.item === 'string' && ITEMS[held.item]?.armorSlot === name) {
        setArmorSlot(name, { ...held });
        useInventoryStore.setState({ heldItem: { ...current } });
      }
    }
  }, [armor, setArmorSlot]);

  // Key handling is done centrally in Game.tsx — no duplicate listener here

  if (gameState !== 'inventory' || gameMode === 'creative') return null;

  const armorSlots: { name: 'helmet'|'chestplate'|'leggings'|'boots'; label: string }[] = [
    { name: 'helmet',     label: '⛑ Helmet' },
    { name: 'chestplate', label: '🦺 Chest' },
    { name: 'leggings',   label: '🩲 Legs' },
    { name: 'boots',      label: '👟 Boots' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={{
        background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)',
        border: '2px solid #111',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: 20,
        userSelect: 'none',
      }}>
        {/* Title */}
        <div style={{ color: '#d0c8b0', fontSize: 15, fontWeight: 700, marginBottom: 14, letterSpacing: 1, textAlign: 'center', fontFamily: 'monospace' }}>
          INVENTORY
        </div>

        {/* Top area: armor + player silhouette + crafting */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'flex-start' }}>
          {/* Armor column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {armorSlots.map(({ name, label }) => (
              <Slot key={name} slot={armor[name]} label={label} onClick={e => handleArmorSlot(name, e)} />
            ))}
          </div>

          {/* Player silhouette */}
          <div style={{
            width: 80, height: 4 * SLOT_SIZE + 12,
            background: 'rgba(0,0,0,0.25)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #333',
          }}>
            <PlayerSilhouette />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* 2×2 crafting */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' }}>CRAFT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {craftingGrid.map((slot, i) => (
                <Slot key={i} slot={slot} onClick={e => handleCraftSlot(i, e)} />
              ))}
            </div>
            {/* Arrow + result */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#888', fontSize: 18 }}>→</span>
              <Slot
                slot={craftingResult}
                onClick={handleCraftResult}
                highlight={craftingResult.item !== null}
                dim={craftingResult.item === null}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #555, transparent)', margin: '10px 0' }} />

        {/* Main inventory 3×9 */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`, gap: 4, marginBottom: 4 }}>
          {inventory.map((slot, i) => (
            <Slot key={i} slot={slot} onClick={e => handleSlotClick(i, false, e)} />
          ))}
        </div>

        {/* Hotbar */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(9, ${SLOT_SIZE}px)`, gap: 4, marginTop: 6, paddingTop: 6, borderTop: '1px solid #444' }}>
          {hotbar.map((slot, i) => (
            <Slot key={i} slot={slot} onClick={e => handleSlotClick(i, true, e)} />
          ))}
        </div>

        {/* Hint */}
        <div style={{ color: '#555', fontSize: 10, textAlign: 'center', marginTop: 10, fontFamily: 'monospace' }}>
          E / ESC to close • Right-click to split
        </div>
      </div>

      {/* Held item follows cursor */}
      {heldItem.item !== null && (
        <div style={{ position: 'fixed', left: mouse.x - 20, top: mouse.y - 20, pointerEvents: 'none', zIndex: 300 }}>
          <ItemIcon item={heldItem.item} count={heldItem.count} size={36} />
        </div>
      )}
    </div>
  );
}

// Simple stick-figure player silhouette in SVG
function PlayerSilhouette() {
  return (
    <svg width="64" height="96" viewBox="0 0 64 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <rect x="20" y="2" width="24" height="24" rx="2" fill="#4a6fa5" stroke="#2a3f5f" strokeWidth="1.5"/>
      <rect x="23" y="7" width="7" height="5" rx="1" fill="#6fa3d0" opacity="0.7"/>
      <rect x="34" y="7" width="7" height="5" rx="1" fill="#6fa3d0" opacity="0.7"/>
      {/* Body */}
      <rect x="18" y="28" width="28" height="26" rx="2" fill="#3b6fcf" stroke="#2a3f5f" strokeWidth="1.5"/>
      {/* Arms */}
      <rect x="6"  y="28" width="10" height="24" rx="2" fill="#3b6fcf" stroke="#2a3f5f" strokeWidth="1.5"/>
      <rect x="48" y="28" width="10" height="24" rx="2" fill="#3b6fcf" stroke="#2a3f5f" strokeWidth="1.5"/>
      {/* Legs */}
      <rect x="18" y="56" width="12" height="28" rx="2" fill="#1f2937" stroke="#111" strokeWidth="1.5"/>
      <rect x="34" y="56" width="12" height="28" rx="2" fill="#1f2937" stroke="#111" strokeWidth="1.5"/>
    </svg>
  );
}
