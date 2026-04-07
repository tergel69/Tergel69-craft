'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { DAY_LENGTH } from '@/utils/constants';

type SkyPalette = {
  top: THREE.Color;
  bottom: THREE.Color;
  fog: THREE.Color;
};

const PALETTES: SkyPalette[] = [
  { top: new THREE.Color(0x87ceeb), bottom: new THREE.Color(0xe0f0ff), fog: new THREE.Color(0x88ccee) }, // day (index 0)
  { top: new THREE.Color(0x6090d0), bottom: new THREE.Color(0xffaa66), fog: new THREE.Color(0x776644) }, // sunrise (index 1)
  { top: new THREE.Color(0x3050a0), bottom: new THREE.Color(0xff8855), fog: new THREE.Color(0x553322) }, // pre-dawn (index 2)
  { top: new THREE.Color(0x1a1a2e), bottom: new THREE.Color(0x4a4a5a), fog: new THREE.Color(0x252535) }, // midnight (index 3)
];

function samplePalette(t: number): SkyPalette {
  // Normalize t to 0-1 range based on day cycle
  const normalizedT = t / DAY_LENGTH;
  const phase = normalizedT * 4; // 0-4 for 4 phases
  const i = Math.floor(phase) % 4; 
  const nextI = (i + 1) % 4;
  const localT = phase - Math.floor(phase);
  
  const a = PALETTES[i];
  const b = PALETTES[nextI];
  return {
    top: a.top.clone().lerp(b.top, localT),
    bottom: a.bottom.clone().lerp(b.bottom, localT),
    fog: a.fog.clone().lerp(b.fog, localT),
  };
}

export default function OptimizedSky() {
  const { camera, scene } = useThree();
  const worldTime = useGameStore((state) => state.worldTime);
  const renderDistance = useGameStore((state) => state.renderDistance);

  const skyRef = useRef<THREE.Mesh>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const sunHaloRef = useRef<THREE.Mesh>(null);
  const moonHaloRef = useRef<THREE.Mesh>(null);
  const starRef = useRef<THREE.Points>(null);
  const cloudRef = useRef<THREE.Group>(null);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunDirRef = useRef<THREE.DirectionalLight>(null);
  const moonDirRef = useRef<THREE.DirectionalLight>(null);
  const sunGlowRef = useRef<THREE.PointLight>(null);
  const moonGlowRef = useRef<THREE.PointLight>(null);

  const skyMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x7fc8ff, side: THREE.BackSide, depthWrite: false }),
    []
  );

  const sunMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xfff4d0,
        emissive: new THREE.Color(0xffaa33),
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.1,
      }),
    []
  );

  const sunFlareMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffdd55,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const moonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xe8f0ff,
        emissive: new THREE.Color(0x6688dd),
        emissiveIntensity: 0.55,
        roughness: 0.7,
        metalness: 0,
      }),
    []
  );
  
  const moonFlareMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x8899ff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const stars = useMemo(() => {
    const positions = new Float32Array(1500 * 3);
    const sizes = new Float32Array(1500);
    for (let i = 0; i < 1500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 450 + Math.random() * 30;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 2.0; // Varied star sizes
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({
      size: 2.0,
      color: 0xffffee,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, []);

  const cloudSprites = useMemo(() => {
    const items: { x: number; y: number; z: number; scale: number; opacity: number }[] = [];
    for (let i = 0; i < 25; i++) {
      items.push({
        x: (Math.random() - 0.5) * 700,
        y: 90 + Math.random() * 40,
        z: (Math.random() - 0.5) * 700,
        scale: 18 + Math.random() * 24,
        opacity: 0.12 + Math.random() * 0.15,
      });
    }
    return items;
  }, []);

  useFrame((_, delta) => {
    const dayT = (worldTime % DAY_LENGTH) / DAY_LENGTH;
    const angle = dayT * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(angle);
    const moonHeight = -sunHeight;
    const dist = 390;

    const palette = samplePalette(dayT);
    skyMaterial.color.lerp(palette.top, Math.min(1, delta * 2.2));

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.lerp(palette.fog, Math.min(1, delta * 2));
      scene.fog.near = renderDistance * 14;
      scene.fog.far = renderDistance * 26;
    }

    if (skyRef.current) {
      skyRef.current.position.copy(camera.position);
    }

    const sunX = Math.cos(angle) * dist;
    const sunY = sunHeight * dist;
    const moonX = -sunX;
    const moonY = moonHeight * dist;

    if (sunRef.current) {
      sunRef.current.position.set(camera.position.x + sunX, camera.position.y + sunY, camera.position.z - 70);
    }
    if (sunHaloRef.current) {
      sunHaloRef.current.position.set(camera.position.x + sunX, camera.position.y + sunY, camera.position.z - 72);
    }
    if (moonRef.current) {
      moonRef.current.position.set(camera.position.x + moonX, camera.position.y + moonY, camera.position.z - 70);
    }
    if (moonHaloRef.current) {
      moonHaloRef.current.position.set(camera.position.x + moonX, camera.position.y + moonY, camera.position.z - 72);
    }

    if (sunDirRef.current) {
      sunDirRef.current.position.set(camera.position.x + sunX, camera.position.y + sunY, camera.position.z);
      sunDirRef.current.intensity = Math.max(0, sunHeight) * 1.05;
    }
    if (moonDirRef.current) {
      moonDirRef.current.position.set(camera.position.x + moonX, camera.position.y + moonY, camera.position.z);
      moonDirRef.current.intensity = Math.max(0, moonHeight) * 0.24;
    }
    if (sunGlowRef.current) {
      sunGlowRef.current.position.set(camera.position.x + sunX, camera.position.y + sunY, camera.position.z - 70);
      sunGlowRef.current.intensity = Math.max(0, sunHeight) * 1.6;
    }
    if (moonGlowRef.current) {
      moonGlowRef.current.position.set(camera.position.x + moonX, camera.position.y + moonY, camera.position.z - 70);
      moonGlowRef.current.intensity = Math.max(0, moonHeight) * 0.55;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.2 + Math.max(0, sunHeight) * 0.4;
      ambientRef.current.color.lerp(palette.bottom, Math.min(1, delta * 2));
    }

    const twilight = Math.max(0, 1 - Math.abs(sunHeight) * 3);
    const nightFactor = Math.max(0, -sunHeight);
    stars.material.opacity = Math.min(1, nightFactor * 1.2 + twilight * 0.15);
    if (starRef.current) {
      starRef.current.position.copy(camera.position);
      starRef.current.rotation.y += delta * 0.003;
    }

    if (cloudRef.current) {
      cloudRef.current.position.copy(camera.position);
      cloudRef.current.rotation.y += delta * 0.0025;
    }
  });

  return (
    <>
      <mesh ref={skyRef} renderOrder={-2000}>
        <sphereGeometry args={[500, 24, 16]} />
        <primitive object={skyMaterial} attach="material" />
      </mesh>

      <points ref={starRef} geometry={stars.geometry} material={stars.material} renderOrder={-1800} />

      <group ref={cloudRef}>
        {cloudSprites.map((cloud, i) => (
          <mesh key={i} position={[cloud.x, cloud.y, cloud.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cloud.scale * 1.8, cloud.scale]} />
            <meshBasicMaterial
              color={0xfafafa}
              transparent
              opacity={cloud.opacity}
              depthWrite={false}
              fog={false}
            />
          </mesh>
        ))}
      </group>

      <mesh ref={sunRef} renderOrder={-1600}>
        <sphereGeometry args={[18, 16, 16]} />
        <primitive object={sunMaterial} attach="material" />
      </mesh>
      <mesh ref={sunHaloRef} renderOrder={-1610}>
        <planeGeometry args={[65, 65]} />
        <primitive object={sunFlareMaterial} attach="material" />
      </mesh>
      <mesh ref={moonRef} renderOrder={-1600}>
        <sphereGeometry args={[12, 14, 14]} />
        <primitive object={moonMaterial} attach="material" />
      </mesh>
      <mesh ref={moonHaloRef} renderOrder={-1610}>
        <planeGeometry args={[48, 48]} />
        <primitive object={moonFlareMaterial} attach="material" />
      </mesh>

      <directionalLight ref={sunDirRef} color={0xfff7da} castShadow={false} />
      <directionalLight ref={moonDirRef} color={0x9cb8ff} castShadow={false} />
      <pointLight ref={sunGlowRef} color={0xffc44f} distance={420} decay={2} />
      <pointLight ref={moonGlowRef} color={0x8fb2ff} distance={240} decay={2} />
      <ambientLight ref={ambientRef} intensity={0.4} color={0xc3d9ff} />
      <fog attach="fog" args={[0x87ceeb, renderDistance * 14, renderDistance * 26]} />
    </>
  );
}
