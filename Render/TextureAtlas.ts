
import * as THREE from 'three';
import { ITEM_PROPERTIES, ItemProperty } from '../Technical/constants';
import { BlockType } from '../Technical/types';

export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  const size = 128; // Increased from 64 to 128 to support more rows/columns
  const tileSize = 16; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const atlasCols = size / tileSize; // 8 columns

  Object.entries(ITEM_PROPERTIES).forEach(([type, p]) => {
    const props = p as ItemProperty;
    const blockType = parseInt(type) as BlockType;
    if (blockType === BlockType.AIR) return;

    const [ux, uy] = props.uvOffset;
    const x = ux * tileSize;
    const y = uy * tileSize;

    ctx.fillStyle = props.color;
    ctx.fillRect(x, y, tileSize, tileSize);
    
    // Add pixelated noise
    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const rand = Math.random();
        if (rand > 0.8) {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x + px, y + py, 1, 1);
        } else if (rand > 0.95) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
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
