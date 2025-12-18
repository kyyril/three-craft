
import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, BLOCK_PROPERTIES } from '../constants';
import { BlockType } from '../types';
import { Noise } from './Noise';

interface QueueItem {
  key: string;
  distanceSq: number;
}

interface FadingChunk {
  mesh: THREE.Mesh;
  opacity: number;
}

export class VoxelWorld {
  private chunks: Map<string, Uint8Array> = new Map();
  private noise: Noise;
  private moistureNoise: Noise;
  private biomeNoise: Noise;
  private treeNoise: Noise;
  private scene: THREE.Scene;
  private sharedMaterial: THREE.MeshStandardMaterial;
  private chunkMeshes: Map<string, THREE.Mesh> = new Map();
  
  // Priority Queues
  private meshQueue: QueueItem[] = [];
  private generationQueue: QueueItem[] = [];
  private fadingChunks: Map<string, FadingChunk> = new Map();
  
  // Water simulation
  private activeWater = new Set<string>();
  private waterTickTimer = 0;

  private lastPlayerPos = new THREE.Vector3();

  constructor(scene: THREE.Scene, material: THREE.MeshStandardMaterial) {
    this.scene = scene;
    this.sharedMaterial = material;
    const baseSeed = Math.random() * 10000;
    this.noise = new Noise(baseSeed);
    this.moistureNoise = new Noise(baseSeed + 1234.5);
    this.biomeNoise = new Noise(baseSeed + 9876.5);
    this.treeNoise = new Noise(baseSeed + 5555.5);
  }

  getChunkKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return `${cx},${cy},${cz}`;
  }

  getVoxel(x: number, y: number, z: number): BlockType {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockType.AIR;
    const key = this.getChunkKey(x, y, z);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return BlockType.AIR;

    const lx = ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((Math.floor(y) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
  }

  setVoxel(x: number, y: number, z: number, type: BlockType) {
    const current = this.getVoxel(x, y, z);
    if (current === type) return;

    const key = this.getChunkKey(x, y, z);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      this.chunks.set(key, chunk);
    }

    const lx = ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((Math.floor(y) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = type;
    
    if (type === BlockType.WATER) {
      this.activeWater.add(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
    }

    if (type === BlockType.AIR) {
      const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
      for (const [ox, oy, oz] of neighbors) {
        if (this.getVoxel(x + ox, y + oy, z + oz) === BlockType.WATER) {
          this.activeWater.add(`${Math.floor(x + ox)},${Math.floor(y + oy)},${Math.floor(z + oz)}`);
        }
      }
    }

    this.addToMeshQueue(key, 0); 
    this.refreshNeighbors(x, y, z);
  }

  private refreshNeighbors(x: number, y: number, z: number) {
    const offsets = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
    for (const [ox, oy, oz] of offsets) {
      const key = this.getChunkKey(x + ox, y + oy, z + oz);
      if (this.chunks.has(key)) this.addToMeshQueue(key, 1);
    }
  }

  private addToMeshQueue(key: string, distSq: number) {
    if (!this.meshQueue.find(i => i.key === key)) {
      this.meshQueue.push({ key, distanceSq: distSq });
    }
  }

  private generateChunk(key: string) {
    if (this.chunks.has(key)) return;

    const [cx, cy, cz] = key.split(',').map(Number);
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    const heights = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = startX + lx;
        const z = startZ + lz;
        // Adjusted noise for bigger basins
        const baseHeight = (this.noise.perlin2d(x / 80, z / 80) + 1) * 12;
        const detailHeight = (this.noise.perlin2d(x / 20, z / 20)) * 5;
        const h = Math.floor(baseHeight + detailHeight + 32); 
        heights[lz * CHUNK_SIZE + lx] = h;

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const y = startY + ly;
          let type = BlockType.AIR;
          if (y < h - 3) type = BlockType.STONE;
          else if (y < h) type = BlockType.DIRT;
          else if (y === h) type = h < 38 ? BlockType.SAND : BlockType.GRASS;
          else if (y < 37) {
             type = BlockType.WATER;
          }
          data[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = type;
        }
      }
    }

    this.chunks.set(key, data);
    this.addToMeshQueue(key, this.calculateDistToPlayer(cx, cy, cz));
  }

  private calculateDistToPlayer(cx: number, cy: number, cz: number): number {
    const pcx = this.lastPlayerPos.x / CHUNK_SIZE;
    const pcy = this.lastPlayerPos.y / CHUNK_SIZE;
    const pcz = this.lastPlayerPos.z / CHUNK_SIZE;
    return Math.pow(cx - pcx, 2) + Math.pow(cy - pcy, 2) + Math.pow(cz - pcz, 2);
  }

  update(delta: number, playerPos: THREE.Vector3) {
    this.lastPlayerPos.copy(playerPos);
    
    this.fadingChunks.forEach((fade, key) => {
      fade.opacity += delta * 1.5;
      if (fade.opacity >= 1) {
        fade.mesh.material = this.sharedMaterial;
        this.fadingChunks.delete(key);
      } else {
        (fade.mesh.material as THREE.MeshStandardMaterial).opacity = fade.opacity;
      }
    });

    this.waterTickTimer += delta;
    if (this.waterTickTimer > 0.15) {
      this.processWater();
      this.waterTickTimer = 0;
    }

    this.processUpdateQueue();
  }

  private processWater() {
    if (this.activeWater.size === 0) return;

    const currentActive = Array.from(this.activeWater);
    this.activeWater.clear();
    const nextTickActive = new Set<string>();

    for (const key of currentActive) {
      const [x, y, z] = key.split(',').map(Number);
      if (this.getVoxel(x, y, z) !== BlockType.WATER) continue;

      const downType = this.getVoxel(x, y - 1, z);
      if (downType === BlockType.AIR) {
        this.setVoxel(x, y - 1, z, BlockType.WATER);
        nextTickActive.add(`${x},${y - 1},${z}`);
      } else {
        const neighbors = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
        for (const [ox, oy, oz] of neighbors) {
          const nx = x + ox;
          const ny = y + oy;
          const nz = z + oz;
          if (this.getVoxel(nx, ny, nz) === BlockType.AIR) {
            this.setVoxel(nx, ny, nz, BlockType.WATER);
            nextTickActive.add(`${nx},${ny},${nz}`);
          }
        }
      }
    }
    nextTickActive.forEach(k => this.activeWater.add(k));
  }

  processUpdateQueue() {
    this.generationQueue.sort((a, b) => a.distanceSq - b.distanceSq);
    this.meshQueue.sort((a, b) => a.distanceSq - b.distanceSq);

    const genBatch = this.generationQueue.splice(0, 4);
    for (const item of genBatch) {
      this.generateChunk(item.key);
    }

    const meshBatch = this.meshQueue.splice(0, 2);
    for (const item of meshBatch) {
      this.updateChunkMesh(item.key);
    }
  }

  private isTransparent(type: BlockType): boolean {
    return type === BlockType.AIR || type === BlockType.WATER || type === BlockType.GLASS || type === BlockType.LEAVES;
  }

  private updateChunkMesh(key: string) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    const [cx, cy, cz] = key.split(',').map(Number);
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const addFace = (x: number, y: number, z: number, face: string, blockType: BlockType) => {
      const uvBase = BLOCK_PROPERTIES[blockType].uvOffset;
      const u0 = uvBase[0] / 4;
      const v0 = 1 - (uvBase[1] + 1) / 4;
      const u1 = (uvBase[0] + 1) / 4;
      const v1 = 1 - uvBase[1] / 4;

      const vCount = vertices.length / 3;
      
      const positions: Record<string, number[][]> = {
        top:    [[0,1,0],[0,1,1],[1,1,1],[1,1,0]],
        bottom: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
        left:   [[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
        right:  [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
        front:  [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
        back:   [[0,0,0],[0,1,0],[1,1,0],[1,0,0]],
      };

      const norms: Record<string, number[]> = {
        top:[0,1,0], bottom:[0,-1,0], left:[-1,0,0], right:[1,0,0], front:[0,0,1], back:[0,0,-1]
      };

      const tint = new THREE.Color(1, 1, 1);
      if (blockType === BlockType.GRASS) {
        tint.setHSL(0.28, 0.5, 0.4);
      } else if (blockType === BlockType.WATER) {
        tint.setHSL(0.6, 0.6, 0.5); // Vibrant blue
      }

      positions[face].forEach(p => {
        vertices.push(x + p[0], y + p[1], z + p[2]);
        colors.push(tint.r, tint.g, tint.b);
      });

      for (let i = 0; i < 4; i++) normals.push(...norms[face]);
      uvs.push(u0,v0, u0,v1, u1,v1, u1,v0);
      indices.push(vCount, vCount+1, vCount+2, vCount, vCount+2, vCount+3);
    };

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const type = chunk[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
          if (type === BlockType.AIR) continue;

          const x = startX + lx;
          const y = startY + ly;
          const z = startZ + lz;

          const neighbors = [
            { nx: x, ny: y+1, nz: z, f: 'top' },
            { nx: x, ny: y-1, nz: z, f: 'bottom' },
            { nx: x-1, ny: y, nz: z, f: 'left' },
            { nx: x+1, ny: y, nz: z, f: 'right' },
            { nx: x, ny: y, nz: z+1, f: 'front' },
            { nx: x, ny: y, nz: z-1, f: 'back' }
          ];

          for (const n of neighbors) {
            const nType = this.getVoxel(n.nx, n.ny, n.nz);
            const currentIsTransparent = this.isTransparent(type);
            const neighborIsTransparent = this.isTransparent(nType);

            if (nType === BlockType.AIR) {
              addFace(x, y, z, n.f, type);
            } else if (!currentIsTransparent && neighborIsTransparent) {
              addFace(x, y, z, n.f, type);
            } else if (currentIsTransparent && neighborIsTransparent && type !== nType) {
              addFace(x, y, z, n.f, type);
            }
          }
        }
      }
    }

    const oldMesh = this.chunkMeshes.get(key);
    if (vertices.length === 0) {
      if (oldMesh) {
        this.scene.remove(oldMesh);
        oldMesh.geometry.dispose();
        this.chunkMeshes.delete(key);
      }
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    if (oldMesh) {
      oldMesh.geometry.dispose();
      oldMesh.geometry = geometry;
    } else {
      const mesh = new THREE.Mesh(geometry, this.sharedMaterial);
      mesh.name = key;
      this.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
    }
  }

  updateVisibleChunks(playerX: number, playerZ: number, radius: number) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    for (let x = pcx - radius; x <= pcx + radius; x++) {
      for (let z = pcz - radius; z <= pcz + radius; z++) {
        for (let y = 0; y < WORLD_HEIGHT / CHUNK_SIZE; y++) {
          const key = `${x},${y},${z}`;
          if (!this.chunks.has(key)) {
            const distSq = this.calculateDistToPlayer(x, y, z);
            if (!this.generationQueue.find(i => i.key === key)) {
              this.generationQueue.push({ key, distanceSq: distSq });
            }
          }
        }
      }
    }
    
    const keysToRemove: string[] = [];
    this.chunkMeshes.forEach((mesh, key) => {
      const [cx, , cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > radius + 2 || Math.abs(cz - pcz) > radius + 2) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => {
      const mesh = this.chunkMeshes.get(key);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.chunkMeshes.delete(key);
        this.fadingChunks.delete(key);
      }
    });
  }
}
