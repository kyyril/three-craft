
export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WATER = 5,
  WOOD = 6,
  LEAVES = 7,
  GLASS = 8,
  COAL_ORE = 9,
  IRON_ORE = 10,
  DIAMOND_ORE = 11,
  LAVA = 12,
  FIRE = 13
}

export enum ItemCategory {
  BLOCK = 'BLOCK',
  TOOL = 'TOOL',
  FOOD = 'FOOD'
}

export enum ToolType {
  PICKAXE = 'PICKAXE',
  SHOVEL = 'SHOVEL',
  AXE = 'AXE',
  SWORD = 'SWORD',
  NONE = 'NONE'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ChunkData {
  id: string;
  position: Vector3;
  data: Uint8Array;
}
