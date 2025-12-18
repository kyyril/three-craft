
# VoxelCraft JS - Technical Requirements & Specification

A high-performance, interactive voxel-based sandbox game built with Three.js and WebGL.

## 1. Core World System (Voxel Engine)
- **Structure**: Voxel-based world using 1x1x1 cubic blocks.
- **Chunking**: 16x16x16 block chunks for dynamic loading/unloading.
- **Infinite Generation**: Procedural generation as the player moves.
- **Block Registry**:
  - Grass, Dirt, Stone, Sand, Water (semi-transparent), Wood, Leaves, and Glass.
- **Optimization**:
  - Face culling (hiding internal faces).
  - Texture atlas usage for reduced draw calls.
  - Priority-based chunk loading (closest to player first).
  - Material-based fade-in effects for new chunks.

## 2. Procedural Terrain Generation
- **Noise Engine**: Multi-layered Perlin noise for heightmaps and biomes.
- **Stratification**: 
  - Grass/Sand surface based on sea level (y=37).
  - Dirt layer below surface.
  - Stone layer for deep terrain.
- **Biomes**: Plains (lush green), Hills (drier colors), and Oceans.
- **Vegetation**: Deterministic tree placement using a secondary noise pass.

## 3. Player System (First-Person Controller)
- **View**: First-person camera with Pointer Lock API.
- **Movement**: WASD for horizontal movement, Space for jumping.
- **Dimensions**:
  - Total height: 1.8 blocks.
  - Camera/Eye height: 1.6 blocks.
- **Physics**: Simple AABB collision detection, gravity, and grounded state management.

## 4. Block Interaction & Inventory
- **Interaction**: Raycasting from screen center.
  - Left Click: Break block + Particle effects.
  - Right Click: Place selected block.
- **Selection**: Highlighted box on the targeted voxel (handled via raycast normals).
- **HUD**: 
  - Hotbar with block selection.
  - Number keys (1-7) for quick swapping.
  - AI Assistant for building tips (Integrated Gemini API).

---

# UML Diagram (Textual)

## Class Diagram (Core Architecture)

### Game Engine
**Game**
* world: `World`
* player: `Player`
* gameMode: `GameMode`
* eventBus: `EventBus`

**World**
* chunks: `Map<ChunkKey, Chunk>`
* getBlock(pos)
* setBlock(pos, blockId)

**Chunk**
* blocks: `Uint8Array(16*16*16)`
* mesh: `THREE.Mesh`
* dirty: `boolean`

### Gameplay Logic
**Player**
* inventory: `Inventory`
* controller: `PlayerController`
* stats: `PlayerStats`
* gameMode: `GameMode`
* useItem()

**Inventory**
* slots: `ItemStack[]`
* addItem()
* removeItem()

**GameMode (Interface)**
* canBreakBlock()
* canPlaceBlock()
* onBlockBreak()
* onItemUse()

---

# UML Sequence (Break Block Action)
1. **Player** -> Input triggers `controller.action()`
2. **Controller** -> `Raycast` to find block
3. **Raycast** -> Returns `VoxelPos`
4. **GameMode** -> Checks `canBreakBlock(pos)`
5. **World** -> `setBlock(pos, AIR)`
6. **Chunk** -> `markDirty()`
7. **Renderer** -> Rebuilds mesh on next frame

---

# PSEUDO-CODE CORE LOOPS

## Game Loop
```javascript
function gameLoop(delta) {
  input.update();
  player.controller.update(delta);
  world.update(delta, player.position); // Logic for loading/fading
  
  if (world.needsMeshRebuild) {
    world.processMeshQueue();
  }
  
  renderer.render(scene, camera);
}
```

## Creative Mode Logic
```javascript
class CreativeMode implements GameMode {
  canBreakBlock() { return true; }
  canPlaceBlock() { return true; }
  onItemUse(player, item) {
    // Infinite items, no consumption
  }
}
```

---

# FINAL FOLDER STRUCTURE (Scalable Design)

```text
/ src
  / core
    - Game.ts (Entry)
    - GameLoop.ts
    - Input.ts
  / world
    - VoxelWorld.ts
    - Chunk.ts
    - Noise.ts
    - TerrainGenerator.ts
  / player
    - PlayerController.ts
    - Inventory.ts
  / gameplay
    - GameMode.ts
    - BlockRegistry.ts
  / render
    - TextureAtlas.ts
    - ShaderManager.ts
  / components
    - HUD.tsx
```

---

# DESIGN GUARANTEE
* **No Logic Bloat**: Core loops are isolated from rendering.
* **Modularity**: Biomes and structures (trees) are pluggable.
* **Performance**: WebGL draw calls minimized via Atlas and Greedy meshing concepts.
* **AI Ready**: Clean API endpoints for external tool integration.
