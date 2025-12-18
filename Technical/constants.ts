
import { BlockType, ToolType, ItemCategory } from './types';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const RENDER_DISTANCE = 4;
export const GRAVITY = -45;
export const JUMP_FORCE = 15;
export const PLAYER_SPEED = 8;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.6;

export interface ItemProperty {
  category: ItemCategory;
  transparent?: boolean;
  color: string;
  uvOffset: [number, number];
  opacity?: number;
  toolType?: ToolType;
  lightEmission?: number; // 0 to 1 intensity
}

export const ITEM_PROPERTIES: Record<string, ItemProperty> = {
  [BlockType.AIR]: { category: ItemCategory.BLOCK, color: 'transparent', uvOffset: [0, 0] },
  [BlockType.GRASS]: { category: ItemCategory.BLOCK, color: '#5e9134', uvOffset: [0, 0] },
  [BlockType.DIRT]: { category: ItemCategory.BLOCK, color: '#6b4e31', uvOffset: [1, 0] },
  [BlockType.STONE]: { category: ItemCategory.BLOCK, color: '#808080', uvOffset: [2, 0] },
  [BlockType.SAND]: { category: ItemCategory.BLOCK, color: '#e3ca91', uvOffset: [3, 0] },
  [BlockType.WATER]: { category: ItemCategory.BLOCK, transparent: true, color: 'rgba(59, 95, 145, 0.7)', uvOffset: [0, 1], opacity: 0.7 },
  [BlockType.WOOD]: { category: ItemCategory.BLOCK, color: '#4a3520', uvOffset: [1, 1] },
  [BlockType.LEAVES]: { category: ItemCategory.BLOCK, transparent: true, color: 'rgba(45, 77, 26, 0.8)', uvOffset: [2, 1], opacity: 0.8 },
  [BlockType.GLASS]: { category: ItemCategory.BLOCK, transparent: true, color: 'rgba(255, 255, 255, 0.3)', uvOffset: [3, 1], opacity: 0.3 },
  [BlockType.COAL_ORE]: { category: ItemCategory.BLOCK, color: '#2a2a2a', uvOffset: [0, 2] },
  [BlockType.IRON_ORE]: { category: ItemCategory.BLOCK, color: '#d1b29d', uvOffset: [1, 2] },
  [BlockType.DIAMOND_ORE]: { category: ItemCategory.BLOCK, color: '#b9f2ff', uvOffset: [2, 2] },
  [BlockType.LAVA]: { category: ItemCategory.BLOCK, transparent: true, color: '#ff4500', uvOffset: [3, 2], opacity: 0.95, lightEmission: 1.0 },
  [BlockType.FIRE]: { category: ItemCategory.BLOCK, transparent: true, color: '#ff6600', uvOffset: [0, 4], opacity: 0.8, lightEmission: 0.8 },
  
  // Tools
  'PICKAXE': { category: ItemCategory.TOOL, color: '#b0b0b0', uvOffset: [0, 3], toolType: ToolType.PICKAXE },
  'SHOVEL': { category: ItemCategory.TOOL, color: '#d2b48c', uvOffset: [1, 3], toolType: ToolType.SHOVEL },
  'AXE': { category: ItemCategory.TOOL, color: '#8b4513', uvOffset: [2, 3], toolType: ToolType.AXE },
  'SWORD': { category: ItemCategory.TOOL, color: '#4682b4', uvOffset: [3, 3], toolType: ToolType.SWORD },
};

export const FLAMMABLE_BLOCKS = new Set([
  BlockType.WOOD,
  BlockType.LEAVES,
  BlockType.GRASS
]);

export const BLOCK_PROPERTIES = ITEM_PROPERTIES as any;

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;
