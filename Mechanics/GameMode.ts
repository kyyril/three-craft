
import { BlockType } from '../Technical/types';
import { Player } from './Player';
import { Item } from '../Items/Item';

export interface GameMode {
  name: string;
  canBreakBlock: (type: BlockType) => boolean;
  canPlaceBlock: () => boolean;
  onBlockBreak: (player: Player, type: BlockType, item: Item | null) => void;
  onItemUse: (player: Player, item: Item) => void;
  hasGravity: () => boolean;
  infiniteResources: boolean;
  handleEnvironmentalEffects?: (player: Player, delta: number) => void;
}

export class CreativeMode implements GameMode {
  name = 'Creative';
  infiniteResources = true;
  canBreakBlock = () => true;
  canPlaceBlock = () => true;
  onBlockBreak = () => {};
  onItemUse = () => {};
  hasGravity = () => false;
  handleEnvironmentalEffects = (player: Player) => {
    player.stats.oxygen = 100;
    player.stats.hunger = 20;
    player.stats.health = 20;
  };
}

export class SurvivalMode implements GameMode {
  name = 'Survival';
  infiniteResources = false;
  
  private exhaustion: number = 0;
  private readonly EXHAUSTION_LIMIT = 4.0;

  canBreakBlock = (type: BlockType) => type !== BlockType.WATER;
  canPlaceBlock = () => true;

  onBlockBreak = (player: Player, type: BlockType, item: Item | null) => {
    this.addExhaustion(player, 0.025);
    if (item) item.durability = Math.max(0, item.durability - 1);
  };

  onItemUse = (player: Player, item: Item) => {
    this.addExhaustion(player, 0.01);
    item.durability = Math.max(0, item.durability - 0.5);
  };

  hasGravity = () => true;

  private addExhaustion(player: Player, amount: number) {
    this.exhaustion += amount;
    if (this.exhaustion >= this.EXHAUSTION_LIMIT) {
      this.exhaustion = 0;
      player.stats.hunger = Math.max(0, player.stats.hunger - 1);
    }
  }

  handleEnvironmentalEffects = (player: Player, delta: number) => {
    if (player.stats.isUnderwater) {
      player.stats.oxygen = Math.max(0, player.stats.oxygen - delta * 15);
      if (player.stats.oxygen <= 0) {
        player.stats.health = Math.max(0, player.stats.health - delta * 2);
      }
    } else {
      player.stats.oxygen = Math.min(100, player.stats.oxygen + delta * 50);
    }

    this.addExhaustion(player, delta * 0.01);

    if (player.stats.hunger <= 0) {
      player.stats.health = Math.max(0, player.stats.health - delta * 0.5);
    }

    if (player.stats.hunger >= 18 && player.stats.health < 20) {
      player.stats.health = Math.min(20, player.stats.health + delta * 1.0);
      this.addExhaustion(player, delta * 0.5);
    }
  };
}
