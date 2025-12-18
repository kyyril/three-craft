
import * as THREE from 'three';
import { Entity } from './Entity';
import { VoxelWorld } from '../World/VoxelWorld';

export class Sheep extends Entity {
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private legs: THREE.Mesh[] = [];
  private wanderTimer: number = 0;
  private targetRotation: number = 0;
  private isWalking: boolean = false;
  private animationTimer: number = 0;

  constructor(scene: THREE.Scene, world: VoxelWorld, position: THREE.Vector3) {
    super(scene, world, position);
    this.maxHealth = 8;
    this.health = 8;
    
    // Sheep-specific collision box
    this.radius = 0.4;
    this.height = 0.8;

    const woolMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });

    // Body
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.9), woolMat);
    this.body.position.y = 0.4;
    this.mesh.add(this.body);

    // Head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), woolMat);
    this.head.position.set(0, 0.7, 0.4);
    this.mesh.add(this.head);

    // Face
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), skinMat);
    face.position.set(0, -0.05, 0.21);
    this.head.add(face);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const legPositions = [
      [0.2, 0.2, 0.3], [-0.2, 0.2, 0.3],
      [0.2, 0.2, -0.3], [-0.2, 0.2, -0.3]
    ];

    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, skinMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      this.mesh.add(leg);
      this.legs.push(leg);
    });

    this.updateHealthBar();
  }

  update(delta: number) {
    this.animationTimer += delta;

    // Damage flash logic
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== this.healthBarFill) {
          (child.material as THREE.MeshStandardMaterial).emissive?.setHex(this.damageFlashTimer > 0 ? 0x660000 : 0x000000);
        }
      });
    }

    // AI logic
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.isWalking = Math.random() > 0.3;
      this.wanderTimer = Math.random() * 5 + 2;
      this.targetRotation = Math.random() * Math.PI * 2;
    }

    if (this.isWalking) {
      // Smoothly rotate towards target
      const currentRot = this.mesh.rotation.y;
      this.mesh.rotation.y = THREE.MathUtils.lerp(currentRot, this.targetRotation, delta * 3);
      
      const moveDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
      this.velocity.x = moveDir.x * 2.5;
      this.velocity.z = moveDir.z * 2.5;

      // Jump if blocked by a low wall and on ground
      if (this.onGround) {
        const checkDist = 0.6;
        const frontX = this.position.x + moveDir.x * checkDist;
        const frontZ = this.position.z + moveDir.z * checkDist;
        // Check if there's a block in front at floor and eye level
        if (this.isSolid(frontX, this.position.y + 0.1, frontZ) || this.isSolid(frontX, this.position.y + 0.5, frontZ)) {
            // Increased from 6 to 9 to overcome gravity and reach 1-block height
            this.velocity.y = 9;
            this.onGround = false;
        }
      }

      // Leg animation
      this.legs.forEach((leg, i) => {
        const offset = (i % 2 === 0) ? 0 : Math.PI;
        leg.rotation.x = Math.sin(this.animationTimer * 10 + offset) * 0.5;
      });
    } else {
      this.legs.forEach(leg => leg.rotation.x = 0);
    }

    this.applyPhysics(delta);
  }
}
