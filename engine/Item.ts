
import { BlockType, ItemCategory, ToolType } from '../types';
import { VoxelWorld } from './VoxelWorld';
import { GameMode } from './GameMode';
import * as THREE from 'three';

export interface InteractionContext {
  world: VoxelWorld;
  gameMode: GameMode;
  targetPos: THREE.Vector3;
  faceNormal: THREE.Vector3;
  playerPos: THREE.Vector3;
  player: any; 
}

export abstract class Item {
  public durability: number = 100;
  public maxDurability: number = 100;
  public category: ItemCategory;

  constructor(public id: string, public name: string, category: ItemCategory) {
    this.category = category;
  }
  abstract onUse(ctx: InteractionContext): void;
  abstract onBreak(ctx: InteractionContext): void;
}

export class BlockItem extends Item {
  constructor(public blockType: BlockType) {
    super(BlockType[blockType], BlockType[blockType], ItemCategory.BLOCK);
    this.maxDurability = 64; 
    this.durability = 64;
  }

  onUse(ctx: InteractionContext) {
    if (!ctx.gameMode.canPlaceBlock()) return;
    if (!ctx.gameMode.infiniteResources && this.durability <= 0) return;

    const placePos = ctx.targetPos.clone().add(ctx.faceNormal);
    const nx = Math.floor(placePos.x), ny = Math.floor(placePos.y), nz = Math.floor(placePos.z);
    const px = Math.floor(ctx.playerPos.x), py = Math.floor(ctx.playerPos.y), pz = Math.floor(ctx.playerPos.z);

    if (!(nx === px && nz === pz && (ny === py || ny === py - 1))) {
      ctx.world.setVoxel(nx, ny, nz, this.blockType);
      ctx.gameMode.onItemUse(ctx.player, this);
    }
  }

  onBreak(ctx: InteractionContext) {
    const breakPos = ctx.targetPos.clone().add(ctx.faceNormal.clone().multiplyScalar(-0.5));
    const targetType = ctx.world.getVoxel(breakPos.x, breakPos.y, breakPos.z);
    
    if (targetType !== BlockType.AIR && ctx.gameMode.canBreakBlock(targetType)) {
      ctx.world.setVoxel(breakPos.x, breakPos.y, breakPos.z, BlockType.AIR);
      ctx.gameMode.onBlockBreak(ctx.player, targetType, this);
    }
  }
}

export class ToolItem extends Item {
  constructor(id: string, name: string, public toolType: ToolType) {
    super(id, name, ItemCategory.TOOL);
    this.maxDurability = 250;
    this.durability = 250;
  }

  onUse(ctx: InteractionContext) {
    // Tools don't place anything, they interact with targeted blocks
  }

  onBreak(ctx: InteractionContext) {
    const breakPos = ctx.targetPos.clone().add(ctx.faceNormal.clone().multiplyScalar(-0.5));
    const targetType = ctx.world.getVoxel(breakPos.x, breakPos.y, breakPos.z);
    
    if (targetType !== BlockType.AIR && ctx.gameMode.canBreakBlock(targetType)) {
      ctx.world.setVoxel(breakPos.x, breakPos.y, breakPos.z, BlockType.AIR);
      ctx.gameMode.onBlockBreak(ctx.player, targetType, this);
    }
  }
}
