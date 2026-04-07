import { BlockType } from './blocks';
import { ItemType, ITEMS } from './items';

export type EnchantmentId =
  | 'sharpness'
  | 'efficiency'
  | 'unbreaking'
  | 'protection'
  | 'power'
  | 'punch'
  | 'fortune'
  | 'mending';

export interface EnchantableSlot {
  item: BlockType | ItemType | null;
  count: number;
  durability?: number;
  enchantments?: Record<string, number>;
}

export interface EnchantmentDefinition {
  id: EnchantmentId;
  name: string;
  maxLevel: number;
  categories: Array<'tool' | 'weapon' | 'armor' | 'bow' | 'utility' | 'book'>;
}

export interface EnchantingOffer {
  id: EnchantmentId;
  name: string;
  level: number;
  cost: number;
  lapisCost: number;
  power: number;
  disabled: boolean;
}

const ENCHANTMENTS: Record<EnchantmentId, EnchantmentDefinition> = {
  sharpness: {
    id: 'sharpness',
    name: 'Sharpness',
    maxLevel: 5,
    categories: ['weapon'],
  },
  efficiency: {
    id: 'efficiency',
    name: 'Efficiency',
    maxLevel: 5,
    categories: ['tool'],
  },
  unbreaking: {
    id: 'unbreaking',
    name: 'Unbreaking',
    maxLevel: 3,
    categories: ['tool', 'weapon', 'armor', 'bow', 'utility'],
  },
  protection: {
    id: 'protection',
    name: 'Protection',
    maxLevel: 4,
    categories: ['armor'],
  },
  power: {
    id: 'power',
    name: 'Power',
    maxLevel: 5,
    categories: ['bow'],
  },
  punch: {
    id: 'punch',
    name: 'Punch',
    maxLevel: 2,
    categories: ['bow'],
  },
  fortune: {
    id: 'fortune',
    name: 'Fortune',
    maxLevel: 3,
    categories: ['tool'],
  },
  mending: {
    id: 'mending',
    name: 'Mending',
    maxLevel: 1,
    categories: ['tool', 'weapon', 'armor', 'bow', 'utility', 'book'],
  },
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seededValue(seed: number, salt: string): number {
  const n = hashString(`${seed}:${salt}`);
  return (n % 10000) / 10000;
}

function getItemCategory(item: BlockType | ItemType): EnchantmentDefinition['categories'][number] | null {
  if (typeof item === 'number') {
    return null;
  }

  const data = ITEMS[item];
  if (!data) return null;

  if (item === ItemType.BOW || item === ItemType.CROSSBOW) return 'bow';
  if (item === ItemType.ENCHANTED_BOOK || item === ItemType.BOOK || item === ItemType.KNOWLEDGE_BOOK) return 'book';
  if (data.armorSlot) return 'armor';
  if (data.toolType) return 'tool';
  if (data.attackDamage !== undefined) return 'weapon';
  return null;
}

export function isEnchantableItem(item: BlockType | ItemType | null): boolean {
  if (item === null || typeof item === 'number') return false;
  return getItemCategory(item) !== null;
}

export function getEnchantmentLevel(slot: EnchantableSlot | null | undefined, enchantmentId: EnchantmentId): number {
  return slot?.enchantments?.[enchantmentId] ?? 0;
}

export function getEnchantmentSummary(slot: EnchantableSlot | null | undefined): string {
  if (!slot?.enchantments) return '';

  const entries = Object.entries(slot.enchantments)
    .filter(([, level]) => level > 0)
    .map(([id, level]) => `${ENCHANTMENTS[id as EnchantmentId]?.name ?? id} ${romanNumeral(level)}`);

  return entries.join(', ');
}

export function getEnchantingOptions(
  slot: EnchantableSlot | null | undefined,
  bookshelfCount: number,
  playerLevel: number,
  seed: number
): EnchantingOffer[] {
  if (!slot?.item || typeof slot.item === 'number' || !isEnchantableItem(slot.item)) return [];

  const category = getItemCategory(slot.item);
  const available = Object.values(ENCHANTMENTS).filter((enchantment) => {
    if (!category) return false;
    return enchantment.categories.includes(category);
  });

  const power = clamp(bookshelfCount * 2 + playerLevel * 0.75 + 4, 1, 30);
  const current = slot.enchantments ?? {};

  return available
    .map((enchantment) => {
      const noise = seededValue(seed, `${slot.item}:${enchantment.id}`);
      const baseLevel = Math.max(1, Math.round((power / 8) + noise * 2));
      const level = clamp(baseLevel, 1, enchantment.maxLevel);
      const cost = clamp(Math.round((level + 1) * 2 + bookshelfCount * 0.5), 1, 30);
      const lapisCost = clamp(Math.ceil(cost / 8), 1, 3);
      return {
        id: enchantment.id,
        name: enchantment.name,
        level,
        cost,
        lapisCost,
        power,
        disabled: playerLevel < cost,
      };
    })
    .filter((offer) => {
      const currentLevel = current[offer.id] ?? 0;
      return currentLevel < offer.level || offer.id === 'mending' || offer.id === 'unbreaking';
    })
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .slice(0, 3);
}

export function applyEnchantmentToSlot(
  slot: EnchantableSlot,
  offer: EnchantingOffer
): EnchantableSlot {
  if (!slot.item || typeof slot.item === 'number') return slot;
  if (!isEnchantableItem(slot.item)) return slot;

  const currentEnchantments = { ...(slot.enchantments ?? {}) };
  const currentLevel = currentEnchantments[offer.id] ?? 0;
  currentEnchantments[offer.id] = Math.max(currentLevel, offer.level);

  const item = slot.item === ItemType.BOOK ? ItemType.ENCHANTED_BOOK : slot.item;

  return {
    ...slot,
    item,
    enchantments: currentEnchantments,
  };
}

export function getSharpnessBonus(slot: EnchantableSlot | null | undefined): number {
  const level = getEnchantmentLevel(slot, 'sharpness');
  return level > 0 ? 0.75 * level : 0;
}

export function getEfficiencyMultiplier(slot: EnchantableSlot | null | undefined): number {
  const level = getEnchantmentLevel(slot, 'efficiency');
  if (level <= 0) return 1;
  return Math.max(0.35, 1 - level * 0.12);
}

function romanNumeral(level: number): string {
  const values = [
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ] as const;

  return values.find(([value]) => value === level)?.[1] ?? `${level}`;
}
