
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import HUD from './components/HUD';
import { VoxelWorld } from './World/VoxelWorld';
import { PlayerController } from './Mechanics/PlayerController';
import { Player } from './Mechanics/Player';
import { createTextureAtlas } from './Render/TextureAtlas';
import { Viewmodel } from './Render/Viewmodel';
import { EntityManager } from './Mechanics/EntityManager';
import { BlockType } from './Technical/types';
import { RENDER_DISTANCE, ITEM_PROPERTIES, HOTBAR_SIZE } from './Technical/constants';
import { events } from './Technical/EventBus';
import { GoogleGenAI } from "@google/genai";
import { CreativeMode, SurvivalMode } from './Mechanics/GameMode';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fps, setFps] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  
  // Time Cycle State
  const [timeState, setTimeState] = useState({
    scale: 1,
    isPaused: false,
    rawTime: Math.PI / 4
  });

  const [playerStats, setPlayerStats] = useState({ 
    health: 20, 
    hunger: 20, 
    oxygen: 100, 
    isUnderwater: false, 
    mode: 'Creative',
    inventory: [] as any[]
  });

  const worldRef = useRef<VoxelWorld | null>(null);
  const playerRef = useRef<Player | null>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const viewmodelRef = useRef<Viewmodel | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const particlesRef = useRef<Particle[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const scrollAccumulator = useRef(0);
  const isInventoryOpenRef = useRef(false);

  // Day/Night Cycle Logic Refs
  const timeRef = useRef(Math.PI / 4); 
  const DAY_DURATION = 120; 

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.selectedIndex = selectedIndex;
      if (viewmodelRef.current) {
        viewmodelRef.current.setItem(playerRef.current.getSelectedItem());
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleInventoryUpdate = () => {
       if (playerRef.current && viewmodelRef.current) {
         viewmodelRef.current.setItem(playerRef.current.getSelectedItem());
       }
    };
    events.on('INVENTORY_UPDATED', handleInventoryUpdate);
    return () => events.off('INVENTORY_UPDATED', handleInventoryUpdate);
  }, []);

  const createParticles = (pos: THREE.Vector3, color: string) => {
    if (!sceneRef.current) return;
    const count = 10;
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const material = new THREE.MeshLambertMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      sceneRef.current.add(mesh);
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 2, (Math.random() - 0.5) * 4);
      particlesRef.current.push({ mesh, velocity, life: 0.6 });
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const skyColorDay = new THREE.Color(0x87ceeb);
    const skyColorNight = new THREE.Color(0x050510);
    const skyColorSunset = new THREE.Color(0xff5e00);
    
    scene.background = skyColorDay.clone();
    scene.fog = new THREE.Fog(skyColorDay.clone(), 40, 110);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    scene.add(camera);
    (scene as any).userData = { camera }; 

    const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    sunLight.position.set(50, 100, 50);
    scene.add(sunLight);

    const lavaLight = new THREE.PointLight(0xff4400, 0, 15);
    scene.add(lavaLight);

    const sunGeo = new THREE.BoxGeometry(25, 25, 25);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, fog: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    const moonGeo = new THREE.BoxGeometry(20, 20, 20);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee, fog: false });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    scene.add(moonMesh);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 1500; i++) {
      const x = THREE.MathUtils.randFloatSpread(1000);
      const y = THREE.MathUtils.randFloat(20, 500); 
      const z = THREE.MathUtils.randFloatSpread(1000);
      starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0, sizeAttenuation: false });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const cloudsGroup = new THREE.Group();
    const cloudGeo = new THREE.BoxGeometry(24, 4, 16);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, fog: true });
    for (let i = 0; i < 30; i++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set(
            THREE.MathUtils.randFloatSpread(500),
            100 + Math.random() * 15,
            THREE.MathUtils.randFloatSpread(500)
        );
        cloud.scale.set(Math.random() * 1 + 0.5, 1, Math.random() * 1 + 0.5);
        cloudsGroup.add(cloud);
    }
    scene.add(cloudsGroup);

    const texture = createTextureAtlas();
    const material = new THREE.MeshStandardMaterial({ 
      map: texture, 
      transparent: true, 
      alphaTest: 0.1, 
      vertexColors: true 
    });

    const world = new VoxelWorld(scene, material);
    worldRef.current = world;
    
    const player = new Player();
    playerRef.current = player;
    
    const controller = new PlayerController(camera, renderer.domElement, world, player);
    controllerRef.current = controller;

    const entityManager = new EntityManager(scene, world);
    entityManager.setPlayer(player);
    entityManagerRef.current = entityManager;

    for (let i = 0; i < 5; i++) {
      entityManager.spawnSheep(new THREE.Vector3(35 + i * 5, 64, 35 + i * 2));
    }

    const viewmodel = new Viewmodel(camera, texture);
    viewmodelRef.current = viewmodel;
    viewmodel.setItem(player.getSelectedItem());

    controller.controls.addEventListener('lock', () => {
      setIsLocked(true);
      setIsInventoryOpen(false);
      isInventoryOpenRef.current = false;
    });
    
    controller.controls.addEventListener('unlock', () => {
      setIsLocked(false);
    });

    world.updateVisibleChunks(camera.position.x, camera.position.z, RENDER_DISTANCE);

    const onMouseDown = (e: MouseEvent) => {
      if (isInventoryOpenRef.current) return;
      if (!controller.controls.isLocked) {
        controller.controls.lock();
        return;
      }
      viewmodel.swing();
      raycasterRef.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      const entities = entityManager.getEntities();
      const entityMeshes = entities.map(ent => ent.mesh);
      const entityIntersects = raycasterRef.current.intersectObjects(entityMeshes, true);
      if (e.button === 0 && entityIntersects.length > 0) {
          const hitObject = entityIntersects[0].object;
          let current: THREE.Object3D | null = hitObject;
          while (current && !entities.find(ent => ent.mesh === current)) current = current.parent;
          const hitEntity = entities.find(ent => ent.mesh === current);
          if (hitEntity) {
            hitEntity.takeDamage(2);
            createParticles(hitEntity.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ff0000');
            return; 
          }
      }
      const worldIntersects = raycasterRef.current.intersectObjects(scene.children, true);
      const validIntersects = worldIntersects.filter(inter => {
        let current: THREE.Object3D | null = inter.object;
        while (current) {
          if (entityMeshes.some(m => m === current)) return false;
          current = current.parent;
        }
        return true;
      });
      if (validIntersects.length > 0) {
        const intersection = validIntersects[0];
        const ctx = { world, gameMode: player.gameMode, targetPos: intersection.point, faceNormal: intersection.face!.normal, playerPos: camera.position, player: player };
        if (e.button === 0) {
          const breakPos = intersection.point.clone().add(intersection.face!.normal.clone().multiplyScalar(-0.5));
          const targetType = world.getVoxel(breakPos.x, breakPos.y, breakPos.z);
          if (targetType !== BlockType.AIR) {
            const prop = ITEM_PROPERTIES[BlockType[targetType]] || ITEM_PROPERTIES[targetType];
            if (prop) createParticles(new THREE.Vector3(Math.floor(breakPos.x) + 0.5, Math.floor(breakPos.y) + 0.5, Math.floor(breakPos.z) + 0.5), prop.color);
          }
          player.breakBlock(ctx);
        } else if (e.button === 2) {
          player.useItem(ctx);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!controller.controls.isLocked) return;
      scrollAccumulator.current += e.deltaY;
      if (Math.abs(scrollAccumulator.current) >= 100) {
        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        scrollAccumulator.current = 0;
        setSelectedIndex((prev) => {
          let nextIndex = prev + direction;
          if (nextIndex >= HOTBAR_SIZE) nextIndex = 0;
          if (nextIndex < 0) nextIndex = HOTBAR_SIZE - 1;
          return nextIndex;
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        const nextState = !isInventoryOpenRef.current;
        setIsInventoryOpen(nextState);
        isInventoryOpenRef.current = nextState;
        if (nextState) controller.controls.unlock();
        else controller.controls.lock();
        return;
      }
      
      // Time Control Shortcuts
      if (e.code === 'KeyT') { // Toggle Auto/Pause
        setTimeState(prev => ({ ...prev, isPaused: !prev.isPaused }));
        return;
      }
      if (e.code === 'KeyY') { // Cycle Speed
        setTimeState(prev => ({
          ...prev,
          scale: prev.scale === 1 ? 10 : (prev.scale === 10 ? 50 : 1)
        }));
        return;
      }
      if (e.code === 'KeyB') { // Skip Phase
        const current = timeRef.current % (Math.PI * 2);
        const morning = 0;
        const noon = Math.PI / 2;
        const evening = Math.PI;
        const night = 1.5 * Math.PI;

        if (current < noon) timeRef.current = noon;
        else if (current < evening) timeRef.current = evening;
        else if (current < night) timeRef.current = night;
        else timeRef.current = morning;
        return;
      }

      if (isInventoryOpenRef.current) return;
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''));
        if (num >= 1 && num <= HOTBAR_SIZE) {
          setSelectedIndex(num - 1);
          scrollAccumulator.current = 0;
        }
      }
      if (e.code === 'KeyC') player.setGameMode(new CreativeMode());
      if (e.code === 'KeyV') player.setGameMode(new SurvivalMode());
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;
    let visibilityUpdateTimer = 0;
    let uiUpdateTimer = 0;

    const animate = () => {
      requestAnimationFrame(animate);
      const time = performance.now();
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Updated Day/Night Cycle Logic with speed controls
      // We use a functional update for timeRef in refs, but need to sync with UI state occasionally
      if (!timeState.isPaused) {
        timeRef.current += (delta / DAY_DURATION) * Math.PI * 2 * timeState.scale;
      }
      
      const sunAngle = timeRef.current;
      const sunY = Math.sin(sunAngle);
      const sunX = Math.cos(sunAngle);
      const orbitDist = 400;
      
      sunLight.position.set(sunX * 100, sunY * 100, 50);
      sunMesh.position.set(camera.position.x + sunX * orbitDist, camera.position.y + sunY * orbitDist, camera.position.z + 50);
      sunMesh.lookAt(camera.position);
      moonMesh.position.set(camera.position.x - sunX * orbitDist, camera.position.y - sunY * orbitDist, camera.position.z - 50);
      moonMesh.lookAt(camera.position);
      
      lavaLight.position.copy(camera.position);
      const surroundingBlocks = [
        world.getVoxel(camera.position.x, camera.position.y - 1, camera.position.z),
        world.getVoxel(camera.position.x, camera.position.y - 2, camera.position.z),
        world.getVoxel(camera.position.x + 1, camera.position.y, camera.position.z),
        world.getVoxel(camera.position.x - 1, camera.position.y, camera.position.z),
      ];
      const nearLava = surroundingBlocks.some(b => b === BlockType.LAVA || b === BlockType.FIRE);
      const targetIntensity = nearLava ? (2.0 + Math.sin(time * 0.01) * 0.5) : 0;
      lavaLight.intensity = THREE.MathUtils.lerp(lavaLight.intensity, targetIntensity, delta * 2);

      stars.position.set(camera.position.x, 0, camera.position.z);
      starMaterial.opacity = THREE.MathUtils.lerp(starMaterial.opacity, sunY < -0.1 ? 1 : 0, delta * 2);

      cloudsGroup.children.forEach((c: any) => {
          c.position.x += delta * 1.5; 
          if (c.position.x > camera.position.x + 250) c.position.x = camera.position.x - 250;
          if (c.position.z > camera.position.z + 250) c.position.z = camera.position.z - 250;
          if (c.position.z < camera.position.z - 250) c.position.z = camera.position.z + 250;
      });

      sunLight.intensity = Math.max(0, sunY) * 1.2;
      ambientLight.intensity = 0.2 + Math.max(0, sunY) * 0.7;
      
      const currentSkyColor = new THREE.Color();
      if (sunY > 0.2) currentSkyColor.lerpColors(skyColorSunset, skyColorDay, Math.min(1, (sunY - 0.2) * 5));
      else if (sunY > -0.2) currentSkyColor.lerpColors(skyColorNight, skyColorSunset, (sunY + 0.2) * 2.5);
      else currentSkyColor.copy(skyColorNight);
      
      scene.background = currentSkyColor;
      if (scene.fog) scene.fog.color.copy(currentSkyColor);

      if (!isInventoryOpenRef.current) controller.update(delta);
      world.update(delta, camera.position);
      player.update(delta);
      entityManager.update(delta);
      
      const isMoving = controller.isMoving();
      viewmodel.update(delta, isMoving);

      // Periodically update UI stats
      uiUpdateTimer += delta;
      if (uiUpdateTimer > 0.1) {
        setPlayerStats({ 
          health: player.stats.health, 
          hunger: player.stats.hunger, 
          oxygen: player.stats.oxygen, 
          isUnderwater: player.stats.isUnderwater, 
          mode: player.gameMode.name, 
          inventory: [...player.inventory] 
        });
        uiUpdateTimer = 0;
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life -= delta;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          particlesRef.current.splice(i, 1);
        } else {
          p.velocity.y -= 12 * delta;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.scale.setScalar(p.life);
        }
      }
      
      renderer.render(scene, camera);
      frameCount++;
      fpsTimer += delta;
      visibilityUpdateTimer += delta;
      if (fpsTimer >= 1) { setFps(frameCount); frameCount = 0; fpsTimer = 0; }
      if (visibilityUpdateTimer >= 0.5) { world.updateVisibleChunks(camera.position.x, camera.position.z, RENDER_DISTANCE); visibilityUpdateTimer = 0; }
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      renderer.dispose();
      material.dispose();
      texture.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [timeState.isPaused, timeState.scale]); // Re-bind keys/animate when cycle state changes

  return (
    <div ref={containerRef} className="w-full h-screen relative">
      {!isLocked && !isInventoryOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer" onClick={() => controllerRef.current?.controls.lock()}>
          <div className="bg-gray-800 p-8 border-4 border-gray-600 text-center shadow-2xl max-w-md" onClick={(e) => e.stopPropagation()}>
            <h1 className="text-4xl font-bold text-white mb-4 uppercase tracking-tighter">VoxelCraft</h1>
            <p className="text-gray-400 mb-6 font-mono uppercase text-xs tracking-widest">Unified Engine v3.8 (Time Lord)</p>
            <button className="bg-white text-black px-6 py-2 font-bold mb-6 hover:bg-gray-200 transition-colors w-full uppercase" onClick={() => controllerRef.current?.controls.lock()}>Enter World</button>
            <div className="border-t border-gray-700 pt-4 text-[10px] text-gray-500 font-mono mb-4 text-left grid grid-cols-2 gap-2">
              <p>WASD: Move</p><p>SPACE: Jump</p>
              <p>E: Inventory</p><p>SCROLL: Hotbar</p>
              <p className="text-blue-400 font-bold">C/V: Mode Change</p>
              <div className="col-span-2 border-t border-gray-700/50 pt-2 mt-1">
                 <p className="text-orange-400 font-bold uppercase mb-1">Time Control:</p>
                 <p>T: Toggle Auto/Pause</p>
                 <p>Y: Cycle Speed (1x, 10x, 50x)</p>
                 <p>B: Skip Day Phase</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <HUD 
        selectedIndex={selectedIndex} 
        onSelectIndex={setSelectedIndex} 
        fps={fps} 
        health={playerStats.health} 
        hunger={playerStats.hunger} 
        oxygen={playerStats.oxygen} 
        isUnderwater={playerStats.isUnderwater} 
        mode={playerStats.mode} 
        inventory={playerStats.inventory} 
        isInventoryOpen={isInventoryOpen} 
        onSwapItems={(a, b) => playerRef.current?.swapItems(a, b)}
        timeScale={timeState.scale}
        isTimePaused={timeState.isPaused}
      />
    </div>
  );
};

export default App;
