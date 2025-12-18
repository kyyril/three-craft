
import * as THREE from 'three';
import { BLOCK_PROPERTIES, ItemProperty } from '../constants';
import { BlockType } from '../types';

export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  const size = 64; // total atlas size
  const tileSize = 16; // 16x16 pixels per face
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Clear canvas with transparency
  ctx.clearRect(0, 0, size, size);

  // Fill textures based on BLOCK_PROPERTIES
  Object.entries(BLOCK_PROPERTIES).forEach(([type, p]) => {
    // Added type assertion to ItemProperty to fix "Property does not exist on type 'unknown'" error
    const props = p as ItemProperty;
    const blockType = parseInt(type) as BlockType;
    if (blockType === BlockType.AIR) return;

    // Accessing uvOffset now works after casting props to ItemProperty
    const [ux, uy] = props.uvOffset;
    const x = ux * tileSize;
    const y = uy * tileSize;

    // Accessing color now works after casting props to ItemProperty
    ctx.fillStyle = props.color;
    ctx.fillRect(x, y, tileSize, tileSize);
    
    // Add some noise/detail to pixels, maintaining alpha
    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const rand = Math.random();
        if (rand > 0.8) {
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          ctx.fillRect(x + px, y + py, 1, 1);
        } else if (rand > 0.95) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
}
