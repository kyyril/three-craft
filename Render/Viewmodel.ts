
import * as THREE from 'three';
import { BlockType, ItemCategory, ToolType } from '../Technical/types';
import { ITEM_PROPERTIES } from '../Technical/constants';

export class Viewmodel {
  public group: THREE.Group;
  private currentItemMesh: THREE.Group | null = null;
  private camera: THREE.Camera;
  private atlas: THREE.Texture;
  
  private swingProgress = 0;
  private isSwinging = false;
  private bobAmount = 0;
  private equipProgress = 1;

  private baseRotation = new THREE.Euler();
  private basePosition = new THREE.Vector3();

  constructor(camera: THREE.Camera, atlas: THREE.Texture) {
    this.camera = camera;
    this.atlas = atlas;
    this.group = new THREE.Group();
    
    this.group.position.set(0.45, -0.4, -0.5);
    this.camera.add(this.group);
  }

  public setItem(item: any) {
    if (this.currentItemMesh) {
      this.group.remove(this.currentItemMesh);
      this.disposeNode(this.currentItemMesh);
    }

    if (!item) {
      this.currentItemMesh = null;
      return;
    }

    const itemGroup = new THREE.Group();
    const props = ITEM_PROPERTIES[item.id] || ITEM_PROPERTIES[item.blockType];

    if (props.category === ItemCategory.BLOCK) {
      this.createBlockModel(item.blockType, itemGroup);
      this.baseRotation.set(0.3, -0.6, 0.1);
      this.basePosition.set(0, 0, 0);
    } else if (props.category === ItemCategory.TOOL) {
      this.createToolModel(props, itemGroup);
      this.baseRotation.set(-0.8, -0.6, 0.4);
      this.basePosition.set(0, 0, 0);
    } else if (props.category === ItemCategory.FOOD) {
      this.createFoodModel(props, itemGroup);
      this.baseRotation.set(0.5, 0.5, 0);
      this.basePosition.set(0, 0, 0);
    }

    itemGroup.rotation.copy(this.baseRotation);
    itemGroup.position.copy(this.basePosition);
    
    this.currentItemMesh = itemGroup;
    this.group.add(itemGroup);
    
    this.equipProgress = 0;
    this.isSwinging = false;
    this.swingProgress = 0;
  }

  private createBlockModel(blockType: BlockType, group: THREE.Group) {
    const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const material = new THREE.MeshStandardMaterial({ 
      map: this.atlas,
      transparent: true,
      alphaTest: 0.1,
      roughness: 1.0
    });

    const uvBase = ITEM_PROPERTIES[blockType].uvOffset;
    const u0 = uvBase[0] / 4;
    const v0 = 1 - (uvBase[1] + 1) / 4;
    const u1 = (uvBase[0] + 1) / 4;
    const v1 = 1 - uvBase[1] / 4;

    const faceUVs = [u0, v0, u1, v0, u0, v1, u1, v1];
    const uvs = new Float32Array([...faceUVs, ...faceUVs, ...faceUVs, ...faceUVs, ...faceUVs, ...faceUVs]);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
  }

  private createToolModel(props: any, group: THREE.Group) {
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: props.color, metalness: 0.4, roughness: 0.4 });

    const pivot = new THREE.Group();
    group.add(pivot);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), handleMaterial);
    handle.position.y = 0.3; 
    pivot.add(handle);

    if (props.toolType === ToolType.PICKAXE) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.06), headMaterial);
      head.position.y = 0.55;
      pivot.add(head);
    } else if (props.toolType === ToolType.SWORD) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.03), headMaterial);
      blade.position.y = 0.6;
      pivot.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), headMaterial);
      guard.position.y = 0.25;
      pivot.add(guard);
    } else if (props.toolType === ToolType.SHOVEL) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), headMaterial);
      head.position.y = 0.6;
      pivot.add(head);
    } else if (props.toolType === ToolType.AXE) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), headMaterial);
      head.position.set(0.07, 0.55, 0);
      pivot.add(head);
    }

    group.scale.set(0.8, 0.8, 0.8);
  }

  private createFoodModel(props: any, group: THREE.Group) {
    const material = new THREE.MeshStandardMaterial({ color: props.color });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), material);
    group.add(mesh);
  }

  public swing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  public update(delta: number, isMoving: boolean) {
    if (!this.currentItemMesh) return;

    if (this.equipProgress < 1) {
      this.equipProgress = Math.min(1, this.equipProgress + delta * 8);
      this.currentItemMesh.position.y = this.basePosition.y - 0.5 + this.equipProgress * 0.5;
    }

    if (this.isSwinging) {
      this.swingProgress += delta * 15;
      
      if (this.swingProgress >= Math.PI) {
        this.swingProgress = 0;
        this.isSwinging = false;
        this.currentItemMesh.rotation.copy(this.baseRotation);
        this.currentItemMesh.position.copy(this.basePosition);
      } else {
        const swingFactor = Math.sin(this.swingProgress);
        
        this.currentItemMesh.rotation.x = this.baseRotation.x - swingFactor * 1.2;
        this.currentItemMesh.rotation.y = this.baseRotation.y + swingFactor * 0.5;
        this.currentItemMesh.rotation.z = this.baseRotation.z - swingFactor * 0.2;
        
        this.currentItemMesh.position.z = this.basePosition.z + swingFactor * 0.2;
        this.currentItemMesh.position.y = this.basePosition.y - swingFactor * 0.1;
      }
    }

    if (!this.isSwinging && this.equipProgress >= 1) {
        this.bobAmount += delta * (isMoving ? 8 : 1.5);
        const swayX = Math.cos(this.bobAmount * 0.5) * 0.012;
        const swayY = Math.sin(this.bobAmount) * 0.012;
        
        this.group.position.x = 0.45 + swayX;
        this.group.position.y = -0.4 + swayY;
    } else {
        this.group.position.set(0.45, -0.4, -0.5);
    }
  }

  private disposeNode(node: any) {
    if (node instanceof THREE.Mesh) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
        else node.material.dispose();
      }
    }
    node.children?.forEach((child: any) => this.disposeNode(child));
  }
}
