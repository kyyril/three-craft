
import { GameMode, CreativeMode } from './GameMode';
import { Item, BlockItem, ToolItem, InteractionContext } from './Item';
import { BlockType, ToolType } from '../types';
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../constants';
import { events } from './EventBus';
import * as THREE from 'three';

export class Player {
  public inventory: (Item | null)[] = new Array(INVENTORY_SIZE).fill(null);
  public selectedIndex: number = 0;
  public gameMode: GameMode;
  public stats = { 
    health: 20, 
    hunger: 20,
    oxygen: 100,
    isUnderwater: false
  };
  public position = new THREE.Vector3(32, 64, 32);

  constructor() {
    this.gameMode = new CreativeMode();
    
    // Initialize hotbar with some tools and blocks
    this.inventory[0] = new ToolItem('PICKAXE', 'Pickaxe', ToolType.PICKAXE);
    this.inventory[1] = new ToolItem('SHOVEL', 'Shovel', ToolType.SHOVEL);
    this.inventory[2] = new ToolItem('SWORD', 'Sword', ToolType.SWORD);
    this.inventory[3] = new BlockItem(BlockType.GRASS);
    this.inventory[4] = new BlockItem(BlockType.STONE);
    this.inventory[5] = new BlockItem(BlockType.WOOD);
    this.inventory[6] = new BlockItem(BlockType.GLASS);
    this.inventory[7] = new BlockItem(BlockType.SAND);
    this.inventory[8] = new BlockItem(BlockType.WATER);

    // Fill main inventory with ores for testing
    this.inventory[9] = new BlockItem(BlockType.COAL_ORE);
    this.inventory[10] = new BlockItem(BlockType.IRON_ORE);
    this.inventory[11] = new BlockItem(BlockType.DIAMOND_ORE);
  }

  getSelectedItem(): Item | null {
    const item = this.inventory[this.selectedIndex];
    if (item && !this.gameMode.infiniteResources && item.durability <= 0) {
      return null;
    }
    return item || null;
  }

  swapItems(indexA: number, indexB: number) {
    if (indexA < 0 || indexA >= INVENTORY_SIZE || indexB < 0 || indexB >= INVENTORY_SIZE) return;
    const temp = this.inventory[indexA];
    this.inventory[indexA] = this.inventory[indexB];
    this.inventory[indexB] = temp;
    events.emit('INVENTORY_UPDATED');
  }

  update(delta: number) {
    this.gameMode.handleEnvironmentalEffects?.(this, delta);
    
    if (this.stats.health <= 0) {
      this.respawn();
    }
  }

  respawn() {
    this.stats.health = 20;
    this.stats.hunger = 20;
    this.stats.oxygen = 100;
    this.position.set(32, 64, 32);
    this.inventory.forEach(item => {
      if (item) item.durability = item.maxDurability;
    });
    events.emit('PLAYER_RESPAWN');
  }

  useItem(ctx: InteractionContext) {
    const item = this.getSelectedItem();
    if (item) {
      ctx.player = this;
      item.onUse(ctx);
      events.emit('ITEM_USED', { item, ctx });
    }
  }

  breakBlock(ctx: InteractionContext) {
    const item = this.getSelectedItem();
    ctx.player = this;
    if (item) {
      item.onBreak(ctx);
    } else {
      const breakPos = ctx.targetPos.clone().add(ctx.faceNormal.clone().multiplyScalar(-0.5));
      const targetType = ctx.world.getVoxel(breakPos.x, breakPos.y, breakPos.z);
      if (targetType !== BlockType.AIR && this.gameMode.canBreakBlock(targetType)) {
        ctx.world.setVoxel(breakPos.x, breakPos.y, breakPos.z, BlockType.AIR);
        this.gameMode.onBlockBreak(this, targetType, null);
      }
    }
    events.emit('BLOCK_BREAK', { ctx });
  }

  setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.stats.hunger = 20;
    this.stats.oxygen = 100;
    events.emit('MODE_CHANGED', mode);
  }
}
