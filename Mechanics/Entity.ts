
import * as THREE from 'three';
import { VoxelWorld } from '../World/VoxelWorld';
import { BlockType } from '../Technical/types';

export abstract class Entity {
  public mesh: THREE.Group;
  public health: number = 10;
  public maxHealth: number = 10;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  
  protected radius: number = 0.3;
  protected height: number = 0.8;
  
  protected world: VoxelWorld;
  protected scene: THREE.Scene;
  protected damageFlashTimer: number = 0;
  protected onGround: boolean = false;
  
  protected healthBarGroup: THREE.Group;
  protected healthBarFill: THREE.Mesh;

  constructor(scene: THREE.Scene, world: VoxelWorld, position: THREE.Vector3) {
    this.scene = scene;
    this.world = world;
    this.position.copy(position);
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = 1.2; 
    
    const bgGeo = new THREE.PlaneGeometry(0.8, 0.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    this.healthBarGroup.add(bg);

    const fillGeo = new THREE.PlaneGeometry(0.78, 0.08);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.healthBarFill = new THREE.Mesh(fillGeo, fillMat);
    this.healthBarFill.position.z = 0.01;
    this.healthBarGroup.add(this.healthBarFill);

    this.mesh.add(this.healthBarGroup);
  }

  abstract update(delta: number): void;

  public takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.damageFlashTimer = 0.2;
    this.updateHealthBar();
    
    this.velocity.y = 3;
    this.velocity.x += (Math.random() - 0.5) * 4;
    this.velocity.z += (Math.random() - 0.5) * 4;
    this.onGround = false;
  }

  protected updateHealthBar() {
    const scale = Math.max(0, this.health / this.maxHealth);
    this.healthBarFill.scale.x = scale;
    this.healthBarFill.position.x = -0.39 * (1 - scale);
    
    const fillMat = this.healthBarFill.material as THREE.MeshBasicMaterial;
    if (scale > 0.5) fillMat.color.setHex(0x00ff00);
    else if (scale > 0.2) fillMat.color.setHex(0xffff00);
    else fillMat.color.setHex(0xff0000);
  }

  protected isSolid(x: number, y: number, z: number): boolean {
    const block = this.world.getVoxel(x, y, z);
    return block !== BlockType.AIR && block !== BlockType.WATER;
  }

  protected applyPhysics(delta: number) {
    this.velocity.y -= 25 * delta;
    this.velocity.x *= 0.8;
    this.velocity.z *= 0.8;

    const dx = this.velocity.x * delta;
    const dy = this.velocity.y * delta;
    const dz = this.velocity.z * delta;

    const nextY = this.position.y + dy;
    let collidedY = false;
    
    if (dy < 0) { 
      if (this.checkPointCollision(this.position.x, nextY, this.position.z)) {
        collidedY = true;
      }
    } else if (dy > 0) { 
      if (this.checkPointCollision(this.position.x, nextY + this.height, this.position.z)) {
        this.velocity.y = 0;
      }
    }

    if (collidedY) {
      this.position.y = Math.floor(nextY) + 1;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.position.y += dy;
      this.onGround = false;
    }

    const nextX = this.position.x + dx;
    if (!this.checkBodyCollision(nextX, this.position.y, this.position.z)) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.position.z + dz;
    if (!this.checkBodyCollision(this.position.x, this.position.y, nextZ)) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    this.mesh.position.copy(this.position);
    
    const camera = (this.scene as any).userData?.camera;
    if (camera) {
        this.healthBarGroup.quaternion.copy(camera.quaternion);
    }
  }

  private checkPointCollision(x: number, y: number, z: number): boolean {
    const r = this.radius;
    return this.isSolid(x - r, y, z - r) || 
           this.isSolid(x + r, y, z - r) || 
           this.isSolid(x - r, y, z + r) || 
           this.isSolid(x + r, y, z + r);
  }

  private checkBodyCollision(x: number, y: number, z: number): boolean {
    return this.checkPointCollision(x, y + 0.1, z) || 
           this.checkPointCollision(x, y + this.height * 0.5, z) || 
           this.checkPointCollision(x, y + this.height - 0.1, z);
  }

  public dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
