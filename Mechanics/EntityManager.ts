
import * as THREE from 'three';
import { Entity } from './Entity';
import { Sheep } from './Sheep';
import { Zombie } from './Zombie';
import { VoxelWorld } from '../World/VoxelWorld';
import { Player } from './Player';

export class EntityManager {
  private entities: Entity[] = [];
  private scene: THREE.Scene;
  private world: VoxelWorld;
  private player: Player | null = null;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;
  }

  public setPlayer(player: Player) {
    this.player = player;
  }

  public spawnSheep(position: THREE.Vector3) {
    const sheep = new Sheep(this.scene, this.world, position);
    this.entities.push(sheep);
    return sheep;
  }

  public spawnZombie(position: THREE.Vector3) {
    if (!this.player) return;
    const zombie = new Zombie(this.scene, this.world, position, this.player);
    this.entities.push(zombie);
    return zombie;
  }

  public update(delta: number) {
    // Spawning Logic
    this.spawnTimer += delta;
    if (this.spawnTimer > 10) { // Try spawn every 10s
        this.spawnTimer = 0;
        if (this.player && this.entities.length < 20) {
            // Spawn random zombie around player
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 10;
            const px = this.player.position.x + Math.cos(angle) * dist;
            const pz = this.player.position.z + Math.sin(angle) * dist;
            
            // Find ground
            let py = 100;
            for(let y=100; y>0; y--) {
                if(this.world.getVoxel(px, y, pz) !== 0) {
                    py = y + 2;
                    break;
                }
            }
            if (py < 100) this.spawnZombie(new THREE.Vector3(px, py, pz));
        }
    }

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      entity.update(delta);

      if (entity.health <= 0) {
        entity.dispose();
        this.entities.splice(i, 1);
      }
    }
  }

  public getEntities() {
    return this.entities;
  }
}
