import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { minecraftTextureGenerator } from '@/data/minecraftTextures';
import { BlockType } from '@/data/blocks';
import { textureShaderMaterial } from '@/engine/TextureShaderMaterial';

export default function TextureGallery() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cubesRef = useRef<THREE.Mesh[]>([]);

  const blockOptions = [
    { type: BlockType.GRASS, name: 'Grass Block' },
    { type: BlockType.DIRT, name: 'Dirt' },
    { type: BlockType.STONE, name: 'Stone' },
    { type: BlockType.COBBLESTONE, name: 'Cobblestone' },
    { type: BlockType.OAK_LOG, name: 'Oak Log' },
    { type: BlockType.OAK_LEAVES, name: 'Oak Leaves' },
    { type: BlockType.OAK_PLANKS, name: 'Oak Planks' },
    { type: BlockType.FLOWER_RED, name: 'Red Flower' },
    { type: BlockType.FLOWER_YELLOW, name: 'Yellow Flower' },
    { type: BlockType.SAND, name: 'Sand' },
    { type: BlockType.WATER, name: 'Water' },
    { type: BlockType.LAVA, name: 'Lava' },
    { type: BlockType.COAL_ORE, name: 'Coal Ore' },
    { type: BlockType.IRON_ORE, name: 'Iron Ore' },
    { type: BlockType.GOLD_ORE, name: 'Gold Ore' },
    { type: BlockType.DIAMOND_ORE, name: 'Diamond Ore' },
    { type: BlockType.GLASS, name: 'Glass' },
  ];

  useEffect(() => {
    if (!mountRef.current) return;

    // Set up scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

    // Set up camera
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create cubes for each block type
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = textureShaderMaterial;

    const cubes: THREE.Mesh[] = [];
    
    // Arrange cubes in a grid
    const gridSize = Math.ceil(Math.sqrt(blockOptions.length));
    let index = 0;

    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        if (index >= blockOptions.length) break;

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x * 2 - gridSize, 0.5, z * 2 - gridSize);
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cubes.push(cube);
        index++;
      }
    }

    // Add grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x000000, 0x888888);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground

    // Store references
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    cubesRef.current = cubes;

    // Add to DOM
    mountRef.current.appendChild(renderer.domElement);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Texture Gallery</h2>
        <p className="text-sm mb-4">All block textures in a grid layout</p>
        
        <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
          {blockOptions.map((option) => (
            <div key={option.type} className="px-2 py-1 text-xs rounded bg-gray-600">
              {option.name}
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-xs text-gray-300">
          <p>• Use mouse to rotate camera</p>
          <p>• Scroll to zoom</p>
          <p>• Right-click to pan</p>
        </div>
      </div>
    </div>
  );
}