
import * as THREE from 'three';
import { Entity } from './Entity';
import { Sheep } from './Sheep';
import { VoxelWorld } from './VoxelWorld';

export class EntityManager {
  private entities: Entity[] = [];
  private scene: THREE.Scene;
  private world: VoxelWorld;

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;
  }

  public spawnSheep(position: THREE.Vector3) {
    const sheep = new Sheep(this.scene, this.world, position);
    this.entities.push(sheep);
    return sheep;
  }

  public update(delta: number) {
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
