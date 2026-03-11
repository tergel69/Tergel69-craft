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
  { top: new THREE.Color(0x0a1025), bottom: new THREE.Color(0x151a36), fog: new THREE.Color(0x11162f) }, // midnight
  { top: new THREE.Color(0x385a9c), bottom: new THREE.Color(0xffa86a), fog: new THREE.Color(0xdd9860) }, // sunrise
  { top: new THREE.Color(0x7fc8ff), bottom: new THREE.Color(0xd8efff), fog: new THREE.Color(0x9dcef7) }, // day
  { top: new THREE.Color(0x2e4c8d), bottom: new THREE.Color(0xff8756), fog: new THREE.Color(0xd27b53) }, // sunset
  { top: new THREE.Color(0x0a1025), bottom: new THREE.Color(0x151a36), fog: new THREE.Color(0x11162f) }, // night
];

function samplePalette(t: number): SkyPalette {
  const phase = (t % 1) * 4;
  const i = Math.floor(phase);
  const localT = phase - i;
  const a = PALETTES[i];
  const b = PALETTES[i + 1];
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
        color: 0xffeb9c,
        emissive: new THREE.Color(0xffd348),
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0,
      }),
    []
  );

  const moonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xd9e3ff,
        emissive: new THREE.Color(0x89a6ff),
        emissiveIntensity: 0.45,
        roughness: 0.8,
        metalness: 0,
      }),
    []
  );

  const stars = useMemo(() => {
    const positions = new Float32Array(1300 * 3);
    for (let i = 0; i < 1300; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 470;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 1.8,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: false,
      fog: false,
    });
    return { geometry, material };
  }, []);

  const cloudSprites = useMemo(() => {
    const items: { x: number; y: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 20; i++) {
      items.push({
        x: (Math.random() - 0.5) * 800,
        y: 95 + Math.random() * 35,
        z: (Math.random() - 0.5) * 800,
        scale: 16 + Math.random() * 20,
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
              color={0xffffff}
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      <mesh ref={sunRef} renderOrder={-1600}>
        <sphereGeometry args={[18, 16, 16]} />
        <primitive object={sunMaterial} attach="material" />
      </mesh>
      <mesh ref={sunHaloRef} renderOrder={-1610}>
        <planeGeometry args={[58, 58]} />
        <meshBasicMaterial color={0xffd56b} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh ref={moonRef} renderOrder={-1600}>
        <sphereGeometry args={[12, 14, 14]} />
        <primitive object={moonMaterial} attach="material" />
      </mesh>
      <mesh ref={moonHaloRef} renderOrder={-1610}>
        <planeGeometry args={[42, 42]} />
        <meshBasicMaterial color={0xa9c4ff} transparent opacity={0.16} depthWrite={false} />
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
