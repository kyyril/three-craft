
import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, BLOCK_PROPERTIES, FLAMMABLE_BLOCKS } from '../Technical/constants';
import { BlockType } from '../Technical/types';
import { Noise } from './Noise';

interface QueueItem {
  key: string;
  distanceSq: number;
}

interface FadingChunk {
  mesh: THREE.Mesh;
  opacity: number;
}

// Stats for fire behavior per block type
const FLAMMABILITY: Record<number, { catchChance: number, burnResistance: number }> = {
  [BlockType.LEAVES]: { catchChance: 0.7, burnResistance: 0.1 },
  [BlockType.GRASS]: { catchChance: 0.5, burnResistance: 0.3 },
  [BlockType.WOOD]: { catchChance: 0.2, burnResistance: 0.7 },
};

export class VoxelWorld {
  private chunks: Map<string, Uint8Array> = new Map();
  private noise: Noise;
  private treeNoise: Noise; 
  private caveNoise: Noise; 
  private scene: THREE.Scene;
  private sharedMaterial: THREE.MeshStandardMaterial;
  private chunkMeshes: Map<string, THREE.Mesh> = new Map();
  
  private meshQueue: QueueItem[] = [];
  private generationQueue: QueueItem[] = [];
  private fadingChunks: Map<string, FadingChunk> = new Map();
  private generatedChunks = new Set<string>(); 
  
  private activeFluids = new Set<string>();
  private activeFires = new Set<string>();
  private fluidTickTimer = 0;
  private lavaTickTimer = 0;
  private fireTickTimer = 0;
  
  // Wind simulation for fire spread
  private wind = new THREE.Vector3(1, 0, 0.3); 
  private windChangeTimer = 0;

  private lastPlayerPos = new THREE.Vector3();

  constructor(scene: THREE.Scene, material: THREE.MeshStandardMaterial) {
    this.scene = scene;
    this.sharedMaterial = material;
    const baseSeed = Math.random() * 10000;
    this.noise = new Noise(baseSeed);
    this.treeNoise = new Noise(baseSeed + 5555.5);
    this.caveNoise = new Noise(baseSeed + 8888.8);
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
    
    const posKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    
    if (type === BlockType.WATER || type === BlockType.LAVA) {
      this.activeFluids.add(posKey);
    } else if (type === BlockType.FIRE) {
      this.activeFires.add(posKey);
    }

    // Wake up neighbors for fluid/fire simulation
    const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
    for (const [ox, oy, oz] of neighbors) {
      const nx = Math.floor(x) + ox, ny = Math.floor(y) + oy, nz = Math.floor(z) + oz;
      const nb = this.getVoxel(nx, ny, nz);
      if (nb === BlockType.WATER || nb === BlockType.LAVA || nb === BlockType.FIRE) {
        this.activeFluids.add(`${nx},${ny},${nz}`);
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

  private spawnTree(x: number, y: number, z: number) {
    const trunkHeight = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < trunkHeight; i++) {
      this.setVoxel(x, y + i, z, BlockType.WOOD);
    }
    for (let ly = -2; ly <= 2; ly++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let lx = -2; lx <= 2; lx++) {
          const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
          if (dist < 2.5) {
            const vy = y + trunkHeight + ly - 1;
            if (this.getVoxel(x + lx, vy, z + lz) === BlockType.AIR) {
              this.setVoxel(x + lx, vy, z + lz, BlockType.LEAVES);
            }
          }
        }
      }
    }
  }

  private generateChunk(key: string) {
    if (this.generatedChunks.has(key)) return;
    this.generatedChunks.add(key);

    const [cx, cy, cz] = key.split(',').map(Number);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      this.chunks.set(key, chunk);
    }
    
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const seaLevel = 37;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = startX + lx;
        const z = startZ + lz;
        const baseHeight = (this.noise.perlin2d(x / 60, z / 60) + 1) * 20;
        const detailHeight = (this.noise.perlin2d(x / 15, z / 15)) * 6;
        const h = Math.floor(baseHeight + detailHeight + 35); 

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const y = startY + ly;
          let type = BlockType.AIR;
          
          if (y < h - 3) type = BlockType.STONE;
          else if (y < h) type = BlockType.DIRT;
          else if (y === h) {
            type = h <= seaLevel ? BlockType.SAND : BlockType.GRASS;
          } else if (y < seaLevel) {
            type = BlockType.WATER;
          }

          if (type === BlockType.STONE || type === BlockType.DIRT) {
            const cNoise = this.caveNoise.perlin3d(x * 0.08, y * 0.12, z * 0.08);
            if (cNoise > 0.45 && y < h - 1) {
              type = BlockType.AIR;
            }
          }
          
          if (chunk[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] === BlockType.AIR) {
             chunk[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = type;
          }
        }

        if (h >= startY && h < startY + CHUNK_SIZE) {
          const surfaceType = h <= seaLevel ? BlockType.SAND : BlockType.GRASS;
          if (surfaceType === BlockType.GRASS && this.getVoxel(x, h, z) === BlockType.GRASS) {
            const treeProb = this.treeNoise.perlin2d(x * 0.12, z * 0.12);
            if (x % 9 === 0 && z % 9 === 0 && treeProb > 0.1) {
              this.spawnTree(x, h + 1, z);
            }
          }
        }
      }
    }
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

    this.fluidTickTimer += delta;
    this.lavaTickTimer += delta;
    this.fireTickTimer += delta;
    this.windChangeTimer += delta;

    if (this.windChangeTimer > 15) {
      this.wind.x = Math.sin(performance.now() * 0.0001) * 1.5;
      this.wind.z = Math.cos(performance.now() * 0.0001) * 1.5;
      this.windChangeTimer = 0;
    }

    if (this.fluidTickTimer > 0.1) {
      this.processFluids(BlockType.WATER);
      this.fluidTickTimer = 0;
    }
    if (this.lavaTickTimer > 0.7) {
      this.processFluids(BlockType.LAVA);
      this.lavaTickTimer = 0;
    }
    if (this.fireTickTimer > 0.4) {
      this.processFire();
      this.fireTickTimer = 0;
    }

    this.processUpdateQueue();
  }

  private processFire() {
    if (this.activeFires.size === 0) return;
    const currentActive = Array.from(this.activeFires);
    this.activeFires.clear();
    const nextTickActive = new Set<string>();

    for (const key of currentActive) {
      const [x, y, z] = key.split(',').map(Number);
      if (this.getVoxel(x, y, z) !== BlockType.FIRE) continue;

      for (let ox = -2; ox <= 2; ox++) {
        for (let oy = -1; oy <= 4; oy++) {
          for (let oz = -2; oz <= 2; oz++) {
            if (ox === 0 && oy === 0 && oz === 0) continue;
            const nx = x + ox, ny = y + oy, nz = z + oz;
            const targetBlock = this.getVoxel(nx, ny, nz);
            
            if (FLAMMABLE_BLOCKS.has(targetBlock)) {
              const stats = FLAMMABILITY[targetBlock] || { catchChance: 0.1, burnResistance: 0.5 };
              const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
              let spreadChance = stats.catchChance / (dist * 1.2 + 1.0);

              if (oy > 0) spreadChance *= (1.0 + oy * 0.4);
              else if (oy < 0) spreadChance *= 0.2; 
              
              const dot = ox * this.wind.x + oz * this.wind.z;
              if (dot > 0) spreadChance *= (1 + dot * 1.2);
              else spreadChance *= (1 + dot * 0.4);

              if (Math.random() < spreadChance * 0.2) {
                 this.setVoxel(nx, ny, nz, BlockType.FIRE);
                 nextTickActive.add(`${nx},${ny},${nz}`);
              }
            }
          }
        }
      }

      let flammableNeighbors = 0;
      for(let ox = -1; ox <= 1; ox++) {
        for(let oy = -1; oy <= 1; oy++) {
          for(let oz = -1; oz <= 1; oz++) {
            if (FLAMMABLE_BLOCKS.has(this.getVoxel(x+ox, y+oy, z+oz))) flammableNeighbors++;
          }
        }
      }

      const burnoutChance = flammableNeighbors === 0 ? 0.7 : 0.12;
      if (Math.random() < burnoutChance) {
        this.setVoxel(x, y, z, BlockType.AIR);
      } else {
        nextTickActive.add(key);
      }
    }
    nextTickActive.forEach(k => this.activeFires.add(k));
  }

  private processFluids(fluidType: BlockType) {
    if (this.activeFluids.size === 0) return;
    const currentActive = Array.from(this.activeFluids);
    this.activeFluids.clear();
    const nextTickActive = new Set<string>();

    for (const key of currentActive) {
      const [x, y, z] = key.split(',').map(Number);
      const type = this.getVoxel(x, y, z);
      
      if (type !== fluidType) {
        if (type === BlockType.WATER || type === BlockType.LAVA) nextTickActive.add(key);
        continue;
      }

      // Viscosity for Lava: slow flow
      if (fluidType === BlockType.LAVA && Math.random() > 0.4) {
        nextTickActive.add(key);
        continue;
      }

      // Interaction check
      const oppositeFluid = fluidType === BlockType.WATER ? BlockType.LAVA : BlockType.WATER;
      const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
      let interactionOccurred = false;
      for (const [ox, oy, oz] of neighbors) {
        const nx = x + ox, ny = y + oy, nz = z + oz;
        const nb = this.getVoxel(nx, ny, nz);
        
        // Heat interaction
        if (nb === oppositeFluid) {
          this.setVoxel(x, y, z, BlockType.STONE);
          interactionOccurred = true;
          break;
        }

        // Lava sets things on fire
        if (fluidType === BlockType.LAVA && FLAMMABLE_BLOCKS.has(nb)) {
           if (Math.random() < 0.3) this.setVoxel(nx, ny, nz, BlockType.FIRE);
        }
      }
      if (interactionOccurred) continue;
      
      const downType = this.getVoxel(x, y - 1, z);
      if (downType === BlockType.AIR) {
        this.setVoxel(x, y - 1, z, type);
        nextTickActive.add(`${x},${y - 1},${z}`);
      } else if (downType !== type) {
        // Horizontal spread
        const horizontalNeighbors = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
        for (const [ox, oy, oz] of horizontalNeighbors) {
          const nx = x + ox, ny = y + oy, nz = z + oz;
          if (this.getVoxel(nx, ny, nz) === BlockType.AIR) {
            this.setVoxel(nx, ny, nz, type);
            nextTickActive.add(`${nx},${ny},${nz}`);
          }
        }
      }
    }
    nextTickActive.forEach(k => this.activeFluids.add(k));
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
    return type === BlockType.AIR || type === BlockType.WATER || type === BlockType.GLASS || type === BlockType.LEAVES || type === BlockType.LAVA || type === BlockType.FIRE;
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

    const atlasCols = 8; 

    const addFace = (x: number, y: number, z: number, face: string, blockType: BlockType) => {
      const uvBase = BLOCK_PROPERTIES[blockType].uvOffset;
      const u0 = uvBase[0] / atlasCols;
      const v0 = 1 - (uvBase[1] + 1) / atlasCols;
      const u1 = (uvBase[0] + 1) / atlasCols;
      const v1 = 1 - uvBase[1] / atlasCols;

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
          tint.setHex(0x4CAF50); 
      } else if (blockType === BlockType.WATER) {
        tint.setHSL(0.6, 0.8, 0.7); 
      } else if (blockType === BlockType.LAVA) {
        tint.setHex(0xffaa00);
      } else if (blockType === BlockType.FIRE) {
        tint.setHex(0xffffff);
      }

      const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
      let localGlow = 0;
      for (const [ox, oy, oz] of neighbors) {
        const nb = this.getVoxel(x + ox, y + oy, z + oz);
        const nbProps = BLOCK_PROPERTIES[nb];
        if (nbProps?.lightEmission) {
          localGlow = Math.max(localGlow, nbProps.lightEmission);
        }
      }

      if (localGlow > 0 && blockType !== BlockType.LAVA && blockType !== BlockType.FIRE) {
        tint.r = Math.min(1, tint.r + localGlow * 0.4);
        tint.g = Math.min(1, tint.g + localGlow * 0.2);
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
          const x = startX + lx, y = startY + ly, z = startZ + lz;
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
            
            // Standard culling: Render if neighbor is air
            if (nType === BlockType.AIR) {
              addFace(x, y, z, n.f, type);
            } 
            // Render face if current is solid and neighbor is transparent
            else if (!currentIsTransparent && neighborIsTransparent) {
              addFace(x, y, z, n.f, type);
            } 
            // Render face between two different transparent blocks (e.g. Water and Glass)
            else if (currentIsTransparent && neighborIsTransparent && type !== nType) {
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
          if (!this.generatedChunks.has(key)) {
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
