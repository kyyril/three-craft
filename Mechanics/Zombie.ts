
import * as THREE from 'three';
import { Entity } from './Entity';
import { VoxelWorld } from '../World/VoxelWorld';
import { Player } from './Player';

export class Zombie extends Entity {
  private player: Player;
  private attackTimer = 0;
  private walkingTimer = 0;
  private arms: THREE.Object3D[] = [];
  private legs: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, world: VoxelWorld, position: THREE.Vector3, player: Player) {
    super(scene, world, position);
    this.player = player;
    this.maxHealth = 20;
    this.health = 20;
    this.radius = 0.4;
    this.height = 1.8;

    // Visuals
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a7a4a }); // Zombie Green
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x334488 }); // Blue Shirt
    const pantMat = new THREE.MeshStandardMaterial({ color: 0x443366 }); // Purple Pants

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.45;
    this.mesh.add(head);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), shirtMat);
    body.position.y = 0.825;
    this.mesh.add(body);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.34, 1.0, 0.2); // Arms forward
    leftArm.rotation.x = -Math.PI / 2;
    this.mesh.add(leftArm);
    this.arms.push(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.34, 1.0, 0.2);
    rightArm.rotation.x = -Math.PI / 2;
    this.mesh.add(rightArm);
    this.arms.push(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, pantMat);
    leftLeg.position.set(-0.13, 0.375, 0);
    this.mesh.add(leftLeg);
    this.legs.push(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantMat);
    rightLeg.position.set(0.13, 0.375, 0);
    this.mesh.add(rightLeg);
    this.legs.push(rightLeg);

    this.updateHealthBar();
    this.healthBarGroup.position.y = 1.9;
  }

  update(delta: number) {
    // Damage Flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== this.healthBarFill) {
          (child.material as THREE.MeshStandardMaterial).emissive?.setHex(this.damageFlashTimer > 0 ? 0xaa0000 : 0x000000);
        }
      });
    }

    // AI
    const dist = this.position.distanceTo(this.player.position);
    
    // Chase Player
    if (dist < 20 && dist > 0.8) {
      const dir = new THREE.Vector3().subVectors(this.player.position, this.position).normalize();
      dir.y = 0;
      
      this.velocity.x += dir.x * 10 * delta;
      this.velocity.z += dir.z * 10 * delta;
      
      // Look at player
      this.mesh.lookAt(this.player.position.x, this.mesh.position.y, this.player.position.z);
      
      // Jump if blocked
      const moveDir = dir.clone().multiplyScalar(0.6);
      if (this.onGround) {
          if (this.isSolid(this.position.x + moveDir.x, this.position.y + 0.1, this.position.z + moveDir.z)) {
              this.velocity.y = 8;
              this.onGround = false;
          }
      }

      // Animation
      this.walkingTimer += delta * 10;
      this.legs[0].rotation.x = Math.sin(this.walkingTimer) * 0.5;
      this.legs[1].rotation.x = -Math.sin(this.walkingTimer) * 0.5;
      
      // Zombie arms bobble
      this.arms[0].rotation.x = -Math.PI / 2 + Math.sin(this.walkingTimer * 0.5) * 0.1;
      this.arms[1].rotation.x = -Math.PI / 2 - Math.sin(this.walkingTimer * 0.5) * 0.1;

    } else {
        // Idle
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
        this.legs.forEach(l => l.rotation.x = 0);
    }

    // Attack
    if (dist < 1.5) {
      this.attackTimer += delta;
      if (this.attackTimer > 1.0) {
        this.player.takeDamage(3); // Deal damage
        this.attackTimer = 0;
        // Swing arms visual
        this.arms[0].rotation.x = -Math.PI / 2 - 0.5;
        this.arms[1].rotation.x = -Math.PI / 2 - 0.5;
      }
    }

    this.applyPhysics(delta);
  }
}
