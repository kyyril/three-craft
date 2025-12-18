
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { VoxelWorld } from '../World/VoxelWorld';
import { BlockType } from '../Technical/types';
import { Player } from './Player';
import { 
  PLAYER_SPEED, 
  GRAVITY, 
  JUMP_FORCE, 
  PLAYER_HEIGHT, 
  EYE_HEIGHT
} from '../Technical/constants';

export class PlayerController {
  public controls: PointerLockControls;
  private velocity = new THREE.Vector3();
  private keys: Record<string, boolean> = {};
  private world: VoxelWorld;
  private player: Player;
  private canJump = false;

  constructor(camera: THREE.Camera, domElement: HTMLElement, world: VoxelWorld, player: Player) {
    this.controls = new PointerLockControls(camera, domElement);
    this.world = world;
    this.player = player;

    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    
    camera.position.set(32, 64, 32);
  }

  public isMoving(): boolean {
    return (this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD']) && this.controls.isLocked;
  }

  update(delta: number) {
    if (!this.controls.isLocked) return;

    const camPos = this.controls.object.position;
    const feetPos = camPos.clone().setY(camPos.y - EYE_HEIGHT + 0.1);
    
    const eyeVoxel = this.world.getVoxel(camPos.x, camPos.y, camPos.z);
    const feetVoxel = this.world.getVoxel(feetPos.x, feetPos.y, feetPos.z);
    
    this.player.stats.isUnderwater = (eyeVoxel === BlockType.WATER);
    this.player.stats.isInLava = (eyeVoxel === BlockType.LAVA || feetVoxel === BlockType.LAVA);
    
    const isSubmerged = this.player.stats.isUnderwater || (feetVoxel === BlockType.WATER) || this.player.stats.isInLava;

    const moveForward = this.keys['KeyW'] || this.keys['ArrowUp'] || false;
    const moveBackward = this.keys['KeyS'] || this.keys['ArrowDown'] || false;
    const moveLeft = this.keys['KeyA'] || this.keys['ArrowLeft'] || false;
    const moveRight = this.keys['KeyD'] || this.keys['ArrowRight'] || false;

    // Movement is much slower in lava than in water
    const speedMultiplier = this.player.stats.isInLava ? 0.3 : (isSubmerged ? 0.6 : 1.0);

    if (this.player.gameMode.hasGravity()) {
      if (isSubmerged) {
        this.velocity.y *= 0.9; 
        if (this.keys['Space']) {
          this.velocity.y = PLAYER_SPEED * (this.player.stats.isInLava ? 0.4 : 0.7); 
        } else if (this.keys['ShiftLeft']) {
          this.velocity.y = -PLAYER_SPEED * 0.5;
        } else {
          this.velocity.y += (GRAVITY * 0.1) * delta;
        }
      } else {
        this.velocity.y += GRAVITY * delta;
      }
    } else {
      this.velocity.y *= 0.1;
      if (this.keys['Space']) this.velocity.y = PLAYER_SPEED;
      if (this.keys['ShiftLeft']) this.velocity.y = -PLAYER_SPEED;
    }
    
    if (this.velocity.y < -50) this.velocity.y = -50;

    if (this.keys['Space'] && this.canJump && this.player.gameMode.hasGravity() && !this.player.stats.isUnderwater && !this.player.stats.isInLava) {
      this.velocity.y = JUMP_FORCE;
      this.canJump = false;
    }

    const direction = new THREE.Vector3();
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward || moveLeft || moveRight) {
      this.velocity.z = direction.z * PLAYER_SPEED * speedMultiplier;
      this.velocity.x = direction.x * PLAYER_SPEED * speedMultiplier;
    } else {
      this.velocity.z *= 0.4;
      this.velocity.x *= 0.4;
    }

    this.applyPhysics(delta, isSubmerged);
  }

  private isSolid(x: number, y: number, z: number): boolean {
    const block = this.world.getVoxel(x, y, z);
    return block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA;
  }

  private applyPhysics(delta: number, isSubmerged: boolean) {
    const pos = this.controls.object.position;
    const feetY = pos.y - EYE_HEIGHT;
    const radius = 0.3;

    if (!this.player.gameMode.hasGravity() && !isSubmerged) {
      this.controls.moveForward(this.velocity.z * delta);
      this.controls.moveRight(this.velocity.x * delta);
      pos.y += this.velocity.y * delta;
      this.player.position.copy(pos);
      return;
    }

    const vMove = this.velocity.y * delta;
    const nextFeetY = feetY + vMove;
    
    let collidedY = false;
    if (vMove <= 0) {
      if (this.isSolid(pos.x - radius, nextFeetY, pos.z - radius) || 
          this.isSolid(pos.x + radius, nextFeetY, pos.z - radius) ||
          this.isSolid(pos.x - radius, nextFeetY, pos.z + radius) ||
          this.isSolid(pos.x + radius, nextFeetY, pos.z + radius)) {
        collidedY = true;
      }
    } else {
      const headY = pos.y + (PLAYER_HEIGHT - EYE_HEIGHT);
      if (this.isSolid(pos.x, headY + vMove, pos.z)) {
        this.velocity.y = 0;
      }
    }

    if (collidedY) {
      this.velocity.y = 0;
      this.canJump = true;
      pos.y = Math.floor(nextFeetY) + 1 + EYE_HEIGHT;
    } else {
      pos.y += vMove;
      this.canJump = false; 
    }

    if (Math.abs(this.velocity.z) > 0.01) {
      const startX = pos.x;
      const startZ = pos.z;
      this.controls.moveForward(this.velocity.z * delta);
      if (this.checkCollision(pos.x, pos.y, pos.z, radius)) {
        pos.x = startX;
        pos.z = startZ;
      }
    }

    if (Math.abs(this.velocity.x) > 0.01) {
      const startX = pos.x;
      const startZ = pos.z;
      this.controls.moveRight(this.velocity.x * delta);
      if (this.checkCollision(pos.x, pos.y, pos.z, radius)) {
        pos.x = startX;
        pos.z = startZ;
      }
    }
    this.player.position.copy(pos);
  }

  private checkCollision(x: number, y: number, z: number, r: number): boolean {
    const fy = y - EYE_HEIGHT;
    const heights = [0.1, 0.8, 1.5];
    for (const h of heights) {
      const cy = fy + h;
      if (this.isSolid(x - r, cy, z - r) || 
          this.isSolid(x + r, cy, z - r) || 
          this.isSolid(x - r, cy, z + r) || 
          this.isSolid(x + r, cy, z + r)) {
        return true;
      }
    }
    return false;
  }
}
