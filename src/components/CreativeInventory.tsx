'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useInventoryStore, getItemName, getItemColor } from '@/stores/inventoryStore';
import { useGameStore } from '@/stores/gameStore';
import { itemTextureGenerator } from '@/data/itemTextures';
import { BlockType, BLOCKS } from '@/data/blocks';
import { ItemType, ITEMS, getAllItems } from '@/data/items';

type TabType = 'blocks' | 'tools' | 'combat' | 'food' | 'materials' | 'misc';

export default function CreativeInventory() {
  const gameState = useGameStore((state) => state.gameState);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameState = useGameStore((state) => state.setGameState);

  const hotbar = useInventoryStore((state) => state.hotbar);
  const heldItem = useInventoryStore((state) => state.heldItem);
  const setHotbarSlot = useInventoryStore((state) => state.setHotbarSlot);

  const [activeTab, setActiveTab] = useState<TabType>('blocks');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Update held item display position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Get all blocks (excluding AIR)
  const allBlocks = useMemo(() => {
    return Object.values(BLOCKS).filter(block => block.id !== BlockType.AIR);
  }, []);

  // Get all items by category
  const categorizedItems = useMemo(() => {
    const items = getAllItems();
    return {
      tools: items.filter(item => item.toolType !== undefined),
      combat: items.filter(item =>
        item.armorSlot !== undefined ||
        item.toolType === 'sword' ||
        item.id.toString().includes('bow') ||
        item.id.toString().includes('arrow') ||
        item.id.toString().includes('shield') ||
        item.id.toString().includes('crossbow') ||
        item.id.toString().includes('trident')
      ),
      food: items.filter(item => item.foodPoints !== undefined),
      materials: items.filter(item =>
        !item.toolType &&
        !item.armorSlot &&
        !item.foodPoints &&
        !item.id.toString().includes('spawn_egg') &&
        !item.id.toString().includes('music_disc') &&
        !item.id.toString().includes('boat') &&
        !item.id.toString().includes('minecart') &&
        item.stackSize > 1
      ),
      misc: items.filter(item =>
        !item.toolType &&
        !item.armorSlot &&
        !item.foodPoints &&
        (item.stackSize === 1 ||
         item.id.toString().includes('spawn_egg') ||
         item.id.toString().includes('music_disc') ||
         item.id.toString().includes('boat') ||
         item.id.toString().includes('minecart'))
      ),
    };
  }, []);

  // Filter items based on search query
  const getFilteredItems = useCallback(() => {
    const query = searchQuery.toLowerCase();

    if (activeTab === 'blocks') {
      return allBlocks.filter(block =>
        block.name.toLowerCase().includes(query)
      );
    }

    const items = categorizedItems[activeTab] || [];
    return items.filter(item =>
      item.name.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, allBlocks, categorizedItems]);

  const filteredItems = getFilteredItems();

  // Handle clicking on a creative item (pick it up)
  const handleCreativeItemClick = useCallback((item: BlockType | ItemType, e: React.MouseEvent) => {
    const isRightClick = e.button === 2;
    const count = isRightClick ? 1 : 64;

    useInventoryStore.setState({
      heldItem: { item, count }
    });
  }, []);

  // Handle slot click (place held item into hotbar)
  const handleHotbarClick = useCallback((index: number, e: React.MouseEvent) => {
    const isRightClick = e.button === 2;

    if (heldItem.item === null) {
      // Pick up from hotbar
      const slot = hotbar[index];
      if (slot.item !== null) {
        if (isRightClick && slot.count > 1) {
          const pickup = Math.ceil(slot.count / 2);
          useInventoryStore.setState({
            heldItem: { item: slot.item, count: pickup },
          });
          setHotbarSlot(index, { ...slot, count: slot.count - pickup });
        } else {
          useInventoryStore.setState({ heldItem: { ...slot } });
          setHotbarSlot(index, { item: null, count: 0 });
        }
      }
    } else {
      // Place into hotbar
      const slot = hotbar[index];
      if (slot.item === null) {
        const placeCount = isRightClick ? 1 : heldItem.count;
        setHotbarSlot(index, { item: heldItem.item, count: placeCount });
        const remaining = heldItem.count - placeCount;
        useInventoryStore.setState({
          heldItem: remaining > 0 ? { ...heldItem, count: remaining } : { item: null, count: 0 },
        });
      } else if (slot.item === heldItem.item) {
        // Stack
        const canAdd = Math.min(isRightClick ? 1 : heldItem.count, 64 - slot.count);
        setHotbarSlot(index, { ...slot, count: slot.count + canAdd });
        const remaining = heldItem.count - canAdd;
        useInventoryStore.setState({
          heldItem: remaining > 0 ? { ...heldItem, count: remaining } : { item: null, count: 0 },
        });
      } else {
        // Swap
        setHotbarSlot(index, { ...heldItem });
        useInventoryStore.setState({ heldItem: { ...slot } });
      }
    }
  }, [heldItem, hotbar, setHotbarSlot]);

  // Close inventory with escape or E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Discard held item in creative mode
        useInventoryStore.setState({ heldItem: { item: null, count: 0 } });
        setGameState('playing');
      }
    };

    if (gameState === 'inventory' && gameMode === 'creative') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [gameState, gameMode, setGameState]);

  // Only show for creative mode
  if (gameState !== 'inventory' || gameMode !== 'creative') return null;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'blocks', label: 'Blocks' },
    { id: 'tools', label: 'Tools' },
    { id: 'combat', label: 'Combat' },
    { id: 'food', label: 'Food' },
    { id: 'materials', label: 'Materials' },
    { id: 'misc', label: 'Misc' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-gray-800 p-4 rounded-lg max-w-4xl w-full mx-4">
        <h2 className="text-white text-center mb-4 text-lg">Creative Inventory</h2>

        {/* Search bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div className="bg-gray-900/50 rounded p-2 mb-4 h-64 overflow-y-auto">
          <div className="grid grid-cols-9 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-18 gap-1">
            {filteredItems.map((item, i) => {
              const itemId = activeTab === 'blocks'
                ? (item as typeof BLOCKS[BlockType]).id
                : (item as typeof ITEMS[ItemType]).id;
              const itemName = activeTab === 'blocks'
                ? (item as typeof BLOCKS[BlockType]).name
                : (item as typeof ITEMS[ItemType]).name;

              return (
                <button
                  key={`${activeTab}-${i}`}
                  className="w-10 h-10 border border-gray-600 bg-gray-700/50 hover:border-gray-400 hover:bg-gray-600/50 transition-colors relative group"
                  onClick={(e) => handleCreativeItemClick(itemId, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleCreativeItemClick(itemId, e);
                  }}
                  title={itemName}
                >
                  <CreativeItemDisplay
                    item={itemId}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {itemName}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredItems.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              No items found
            </div>
          )}
        </div>

        {/* Hotbar */}
        <div className="pt-2 border-t border-gray-600">
          <p className="text-gray-400 text-xs mb-2 text-center">Hotbar</p>
          <div className="grid grid-cols-9 gap-1 justify-center max-w-fit mx-auto">
            {hotbar.map((slot, i) => (
              <button
                key={`hot-${i}`}
                className="w-12 h-12 border-2 border-gray-600 bg-gray-700/50 hover:border-gray-400 transition-colors relative"
                onClick={(e) => handleHotbarClick(i, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleHotbarClick(i, e);
                }}
              >
                {slot.item !== null && (
                  <ItemDisplay item={slot.item} count={slot.count} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <p className="text-gray-500 text-xs text-center mt-3">
          Left-click: Pick up 64 | Right-click: Pick up 1 | Press E or ESC to close
        </p>
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

function CreativeItemDisplay({
  item,
}: {
  item: BlockType | ItemType;
}) {
  const src = itemTextureGenerator.getItemImageSrc(item);
  return (
    <div
      className="w-7 h-7 m-auto border border-black/30 overflow-hidden"
      style={{
        borderRadius: '2px',
        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

function ItemDisplay({ item, count }: { item: BlockType | ItemType; count: number }) {
  const name = getItemName(item);

  // Use the new item texture generator
  const src = itemTextureGenerator.getItemImageSrc(item);

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
          src={src}
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
