'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';
import { DAY_LENGTH } from '@/utils/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function noise2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export default function Sky() {
  const groupRef   = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const timeOfDay  = useGameStore(s => s.worldTime);

  // Track if player is underground each frame
  const isUndergroundRef = useRef(false);
  const visibilityRef = useRef(1); // For smooth transitions

  useFrame(() => {
    if (!groupRef.current) return;

    // Always follow camera
    groupRef.current.position.copy(camera.position);

    // Check if player is deep underground - hide sky only when multiple blocks above
    const playerPos  = usePlayerStore.getState().position;
    const worldStore = useWorldStore.getState();
    const hx = Math.floor(playerPos.x);
    const hy = Math.floor(playerPos.y + 1.6); // Head level
    const hz = Math.floor(playerPos.z);

    const isSolid = (b: number | null | undefined) =>
      b != null && b !== BlockType.AIR && b !== BlockType.WATER;

    // Check multiple levels above player - only hide sky if deep underground
    let blocksAbove = 0;
    for (let y = hy + 1; y <= hy + 5; y++) {
      const block = worldStore.getBlock(hx, y, hz);
      if (isSolid(block)) {
        blocksAbove++;
      }
    }

    // Only hide sky if there are 3+ solid blocks above (deep underground)
    const underground = blocksAbove >= 3;
    isUndergroundRef.current = underground;

    // Smooth transition for visibility
    const targetVisibility = underground ? 0 : 1;
    visibilityRef.current += (targetVisibility - visibilityRef.current) * 0.1;
    
    // Apply visibility to entire sky group
    groupRef.current.visible = visibilityRef.current > 0.01;
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material.transparent !== underground) {
          material.transparent = true;
          material.opacity = visibilityRef.current;
          material.needsUpdate = true;
        }
      }
    });
  });

  // ─── Smooth flowing sky colors ─────────────────────────────────────────────
  const skyColor = useMemo(() => {
    const t = timeOfDay / DAY_LENGTH;
    
    // Define key color points throughout the day
    const colors = {
      midnight: new THREE.Color(0x0a0a1a),      // Deep space blue
      preDawn: new THREE.Color(0x1a0a2e),       // Dark purple
      sunrise: new THREE.Color(0xff6b35),       // Warm orange
      midday: new THREE.Color(0x87ceeb),        // Bright sky blue
      sunset: new THREE.Color(0xff8c42),        // Deep orange
      dusk: new THREE.Color(0x1a0a2e),          // Dark purple
    };
    
    // Normalize t to 0-1 range and create smooth flow
    let normalizedT = t;
    if (normalizedT > 0.75) normalizedT -= 1.0; // Wrap around for smooth midnight transition
    
    // Create flowing transitions using smoothstep and noise
    const flowFactor = Math.sin(normalizedT * Math.PI * 2) * 0.1; // Subtle color flow
    
    let finalColor = new THREE.Color();
    
    if (normalizedT < 0.05) {
      // Midnight to pre-dawn transition with flowing effect
      const blend = Math.pow(normalizedT / 0.05, 0.5); // Ease in
      finalColor.lerpColors(colors.midnight, colors.preDawn, blend);
      // Add subtle purple flow
      finalColor.add(new THREE.Color(0.05 * flowFactor, 0.02 * flowFactor, 0.08 * flowFactor));
    } else if (normalizedT < 0.10) {
      // Pre-dawn with flowing purple/orange transition
      const blend = (normalizedT - 0.05) / 0.05;
      finalColor.lerpColors(colors.preDawn, colors.sunrise, blend);
      // Add warm undertones flowing through
      finalColor.add(new THREE.Color(0.1 * flowFactor, 0.05 * flowFactor, 0.02 * flowFactor));
    } else if (normalizedT < 0.30) {
      // Sunrise to midday with flowing transition
      const blend = (normalizedT - 0.10) / 0.20;
      finalColor.lerpColors(colors.sunrise, colors.midday, blend);
      // Add blue flow mixing with orange
      finalColor.add(new THREE.Color(-0.05 * flowFactor, 0.1 * flowFactor, 0.05 * flowFactor));
    } else if (normalizedT < 0.45) {
      // Midday with subtle flowing variations
      finalColor.copy(colors.midday);
      // Add subtle blue/green flow
      finalColor.add(new THREE.Color(-0.02 * flowFactor, 0.03 * flowFactor, 0.05 * flowFactor));
    } else if (normalizedT < 0.55) {
      // Late midday to sunset transition
      const blend = (normalizedT - 0.45) / 0.10;
      finalColor.lerpColors(colors.midday, colors.sunset, blend);
      // Add warm flow
      finalColor.add(new THREE.Color(0.15 * flowFactor, 0.05 * flowFactor, 0.02 * flowFactor));
    } else if (normalizedT < 0.65) {
      // Sunset with flowing orange/red transition
      const blend = (normalizedT - 0.55) / 0.10;
      finalColor.lerpColors(colors.sunset, colors.dusk, blend);
      // Add deep red/purple flow
      finalColor.add(new THREE.Color(0.08 * flowFactor, 0.02 * flowFactor, 0.06 * flowFactor));
    } else {
      // Dusk to midnight with flowing transition
      const blend = (normalizedT - 0.65) / 0.10;
      finalColor.lerpColors(colors.dusk, colors.midnight, blend);
      // Add deep space flow
      finalColor.add(new THREE.Color(0.02 * flowFactor, 0.01 * flowFactor, 0.04 * flowFactor));
    }
    
    // Ensure color values stay within valid range
    finalColor.r = Math.max(0, Math.min(1, finalColor.r));
    finalColor.g = Math.max(0, Math.min(1, finalColor.g));
    finalColor.b = Math.max(0, Math.min(1, finalColor.b));
    
    return finalColor;
  }, [timeOfDay]);

  const sunAngle  = (timeOfDay / DAY_LENGTH) * Math.PI * 2 - Math.PI / 2;
  const moonAngle = sunAngle + Math.PI;
  const sunPos    = new THREE.Vector3(Math.cos(sunAngle) * 380, Math.sin(sunAngle) * 380, -80);
  const moonPos   = new THREE.Vector3(Math.cos(moonAngle) * 380, Math.sin(moonAngle) * 380, -80);

  return (
    <>
      {/* Lights live in world space — must NOT be inside the camera-following group */}
      <ambientLight intensity={Math.max(0.1, Math.sin(sunAngle) * 0.8 + 0.3)} color="#ffe8d0" />
      <directionalLight
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={Math.max(0, Math.sin(sunAngle))}
        color="#fffbe0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Everything below follows camera */}
      <group ref={groupRef}>

        {/* ── Sky dome ─────────────────────────────────────────────────── */}
        <mesh renderOrder={-2000}>
          <sphereGeometry args={[490, 32, 32]} />
          <meshBasicMaterial color={skyColor} side={THREE.BackSide} depthWrite={false} />
        </mesh>

        {/* ── Stars (night only) ───────────────────────────────────────── */}
        <Stars timeOfDay={timeOfDay} />

        {/* ── Sun ─────────────────────────────────────────────────────── */}
        <Sun position={sunPos} angle={sunAngle} />

        {/* ── Moon ────────────────────────────────────────────────────── */}
        <Moon position={moonPos} angle={moonAngle} />

        {/* ── Black hole — hidden underground ─────────────────────────── */}
        <BlackHole isUndergroundRef={isUndergroundRef} />

        {/* ── Clouds ──────────────────────────────────────────────────── */}
        <Clouds timeOfDay={timeOfDay} />
      </group>
    </>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ timeOfDay }: { timeOfDay: number }) {
  const t          = timeOfDay / DAY_LENGTH;
  const nightAlpha = t < 0.3 || t > 0.7
    ? 1.0
    : t < 0.35
      ? 1.0 - (t - 0.3) / 0.05
      : (t - 0.65) / 0.05;

  const { positions, sizes } = useMemo(() => {
    const count = 2000;
    const pos = new Float32Array(count * 3);
    const sz  = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = 460 * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = 460 * Math.cos(phi);
      pos[i*3+2] = 460 * Math.sin(phi) * Math.sin(theta);
      sz[i] = 0.5 + Math.random() * 2.0;
    }
    return { positions: pos, sizes: sz };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, sizes]);

  if (nightAlpha < 0.01) return null;

  return (
    <points geometry={geo} renderOrder={-1500}>
      <pointsMaterial
        color="#ffffff"
        size={1.5}
        sizeAttenuation={false}
        transparent
        opacity={nightAlpha}
        depthWrite={false}
        depthTest={true}
      />
    </points>
  );
}

// ─── Sun ──────────────────────────────────────────────────────────────────────
const sunVertShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const sunFragShader = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2 uv  = vUv * 2.0 - 1.0;
    float d  = length(uv);
    if (d > 1.0) discard;
    // limb darkening
    float limb  = 1.0 - smoothstep(0.3, 1.0, d);
    vec3  core  = mix(vec3(1.0,0.97,0.8), vec3(1.0,0.75,0.2), smoothstep(0.0,0.7,d));
    // corona pulse
    float corona = exp(-d * 3.0) * (0.7 + 0.3 * sin(time * 1.5));
    vec3  col    = core * limb + vec3(1.0, 0.9, 0.5) * corona * 0.4;
    float alpha  = smoothstep(1.0, 0.85, d);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Sun({ position, angle }: { position: THREE.Vector3; angle: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => { if (matRef.current) matRef.current.uniforms.time.value = clock.elapsedTime; });

  const visible = Math.sin(angle) > -0.15;
  if (!visible) return null;

  return (
    <group position={position}>
      {/* glow halo */}
      <mesh renderOrder={-1600}>
        <planeGeometry args={[55, 55]} />
        <meshBasicMaterial color="#ffe566" transparent opacity={0.18} depthWrite={false} depthTest={true} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* disk */}
      <mesh renderOrder={-1595}>
        <planeGeometry args={[38, 38]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={sunVertShader}
          fragmentShader={sunFragShader}
          uniforms={{ time: { value: 0 } }}
          transparent
          depthWrite={false}
          depthTest={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ─── Moon ─────────────────────────────────────────────────────────────────────
const moonFragShader = `
  uniform float time;
  varying vec2 vUv;
  float rand(vec2 co) { return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453); }
  void main() {
    vec2  uv = vUv * 2.0 - 1.0;
    float d  = length(uv);
    if (d > 1.0) discard;
    vec3 col = vec3(0.88, 0.88, 0.95);
    // craters
    vec2 cuv = vUv * 8.0;
    float cr = rand(floor(cuv));
    if (cr > 0.78) {
      float cd = length(fract(cuv) - 0.5);
      if (cd < 0.25) col *= 0.6 + cd * 1.2;
    }
    // phase shading
    float shade = smoothstep(-0.4, 0.8, uv.x * 0.6 + 0.3);
    col *= mix(0.25, 1.0, shade);
    float alpha = smoothstep(1.0, 0.88, d);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Moon({ position, angle }: { position: THREE.Vector3; angle: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => { if (matRef.current) matRef.current.uniforms.time.value = clock.elapsedTime; });

  const visible = Math.sin(angle) > -0.15;
  if (!visible) return null;

  return (
    <group position={position}>
      <mesh renderOrder={-1600}>
        <planeGeometry args={[38, 38]} />
        <meshBasicMaterial color="#aaccff" transparent opacity={0.12} depthWrite={false} depthTest={true} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh renderOrder={-1595}>
        <planeGeometry args={[26, 26]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={sunVertShader}
          fragmentShader={moonFragShader}
          uniforms={{ time: { value: 0 } }}
          transparent
          depthWrite={false}
          depthTest={true}
        />
      </mesh>
    </group>
  );
}

// ─── Black Hole ───────────────────────────────────────────────────────────────
// Huge, spectacular, fully occluded underground
const BH_POS = new THREE.Vector3(140, 210, -310);

const horizonFrag = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2  uv = vUv * 2.0 - 1.0;
    float d  = length(uv);
    if (d > 1.0) discard;

    // Pure black interior
    vec3 col = vec3(0.0);

    // Photon sphere edge — intense blue-white glow right at the event horizon rim
    float rim = smoothstep(0.82, 1.0, d);
    float rimShimmer = 0.7 + 0.3 * sin(d * 40.0 - time * 8.0 + atan(uv.y, uv.x) * 3.0);
    vec3 rimCol = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 1.0, 1.0), rimShimmer * rim);
    col = mix(col, rimCol, rim * rimShimmer * 0.9);

    // Inner warped space — subtle purple tint near edge
    float inner = smoothstep(0.6, 0.85, d);
    col += vec3(0.04, 0.0, 0.08) * inner * (0.5 + 0.5 * sin(time * 1.5 + d * 12.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const lensRingFrag = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2  uv = vUv * 2.0 - 1.0;
    float d  = length(uv);
    float angle = atan(uv.y, uv.x);

    // Multiple stacked lensing rings at different radii
    float ring1 = max(0.0, 1.0 - abs(d - 0.88) / 0.04);
    float ring2 = max(0.0, 1.0 - abs(d - 0.96) / 0.03);
    float ring3 = max(0.0, 1.0 - abs(d - 1.06) / 0.05);

    // Each ring pulses and rotates at a different speed
    float p1 = 0.5 + 0.5 * sin(time * 4.0 + angle * 5.0);
    float p2 = 0.5 + 0.5 * sin(time * 2.8 - angle * 7.0 + 1.4);
    float p3 = 0.5 + 0.5 * sin(time * 1.9 + angle * 3.0 + 2.8);

    // Colour shifts: electric blue → violet → cyan
    vec3 c1 = mix(vec3(0.2, 0.5, 1.0),  vec3(0.9, 0.3, 1.0), p1) * ring1 * (1.2 + p1);
    vec3 c2 = mix(vec3(0.1, 0.9, 1.0),  vec3(0.5, 0.1, 1.0), p2) * ring2 * (1.5 + p2 * 0.5);
    vec3 c3 = mix(vec3(0.8, 0.2, 1.0),  vec3(0.2, 0.8, 1.0), p3) * ring3 * (1.0 + p3 * 0.3);

    vec3 col = c1 + c2 + c3;
    float alpha = max(ring1 * p1, max(ring2 * p2, ring3 * p3)) * 0.95;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const accretionFrag = `
  uniform float time;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for(int i=0;i<4;i++) { v += a*noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }
  void main() {
    vec2  uv    = vUv * 2.0 - 1.0;
    float d     = length(uv);
    float angle = atan(uv.y, uv.x);

    // Three nested disk rings with different widths/positions
    float w1 = 0.18, w2 = 0.14, w3 = 0.10;
    float r1 = max(0.0, 1.0 - abs(d - 1.18) / w1);
    float r2 = max(0.0, 1.0 - abs(d - 1.42) / w2);
    float r3 = max(0.0, 1.0 - abs(d - 1.65) / w3);
    if (r1 + r2 + r3 < 0.01) discard;

    // Orbital flow — inner disk spins faster (Keplerian)
    float flow1 = angle * 5.0 - time * 3.5;
    float flow2 = angle * 4.0 - time * 2.2;
    float flow3 = angle * 3.0 - time * 1.4;

    float plasma1 = fbm(vec2(flow1, (d-1.0)*4.0 + time*0.5));
    float plasma2 = fbm(vec2(flow2, (d-1.2)*3.0 - time*0.3));
    float plasma3 = fbm(vec2(flow3, (d-1.5)*2.5 + time*0.2));

    // Relativistic Doppler brightening — approaching side is 3× brighter
    float doppler1 = 0.35 + 0.65 * pow(max(0.0, sin(angle - time * 2.0)), 1.5);
    float doppler2 = 0.35 + 0.65 * pow(max(0.0, sin(angle - time * 1.4 + 1.2)), 1.5);
    float doppler3 = 0.35 + 0.65 * pow(max(0.0, sin(angle - time * 0.9 + 2.4)), 1.5);

    // Temperature gradient: white-hot → deep orange → blood red → purple at edges
    vec3 white  = vec3(1.0, 0.97, 0.88);
    vec3 orange = vec3(1.0, 0.45, 0.05);
    vec3 red    = vec3(0.65, 0.02, 0.0);
    vec3 purple = vec3(0.3, 0.0, 0.25);

    float t1 = smoothstep(0.0, 1.0, abs(d - 1.18) / w1 + plasma1 * 0.35);
    float t2 = smoothstep(0.0, 1.0, abs(d - 1.42) / w2 + plasma2 * 0.35);
    float t3 = smoothstep(0.0, 1.0, abs(d - 1.65) / w3 + plasma3 * 0.35);

    vec3 col1 = mix(mix(white, orange, t1), red, t1*t1) * r1 * (0.6 + 0.4*plasma1) * doppler1;
    vec3 col2 = mix(mix(orange, red, t2), purple, t2*t2) * r2 * (0.5 + 0.5*plasma2) * doppler2;
    vec3 col3 = mix(red, purple, t3) * r3 * (0.4 + 0.6*plasma3) * doppler3;

    // Bright flare spots — magnetic reconnection events
    float flare = pow(max(0.0, noise(vec2(angle*3.0 - time*4.0, d*8.0)) - 0.7), 2.0) * 6.0;
    col1 += vec3(1.0, 0.8, 0.5) * flare * r1;

    vec3 col = col1 * 2.8 + col2 * 2.0 + col3 * 1.5;
    float alpha = max(r1 * 0.94, max(r2 * 0.85, r3 * 0.75));
    gl_FragColor = vec4(col, alpha);
  }
`;

const outerGlowFrag = `
  uniform float time;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    vec2  uv    = vUv * 2.0 - 1.0;
    float d     = length(uv);
    float angle = atan(uv.y, uv.x);

    // Wide diffuse corona glow — massive soft halo
    float halo = exp(-pow((d - 1.3) * 2.2, 2.0)) * 0.6;

    // Multiple outer rings
    float or1 = max(0.0, 1.0 - abs(d - 1.55) / 0.18);
    float or2 = max(0.0, 1.0 - abs(d - 1.85) / 0.22);
    float or3 = max(0.0, 1.0 - abs(d - 2.20) / 0.30);

    float p1 = 0.5 + 0.5 * sin(time * 1.3 + angle * 4.0);
    float p2 = 0.5 + 0.5 * sin(time * 0.9 - angle * 6.0 + 2.0);
    float p3 = 0.5 + 0.5 * sin(time * 0.6 + angle * 2.0 + 4.0);

    // Tendrils/filaments streaming outward
    float filament = noise(vec2(angle * 4.0 - time * 0.8, d * 3.0 + time * 0.2));
    filament = pow(filament, 2.5) * max(0.0, 1.0 - abs(d - 1.7) / 0.5);

    // Colour: deep crimson → hot magenta → cold purple at outer edge
    vec3 crimson = vec3(0.9, 0.0, 0.15);
    vec3 magenta = vec3(0.6, 0.0, 0.5);
    vec3 violet  = vec3(0.15, 0.0, 0.4);
    vec3 iceblue = vec3(0.0, 0.1, 0.5);

    vec3 c1 = mix(crimson, magenta, p1) * or1 * (1.8 + p1 * 0.8);
    vec3 c2 = mix(magenta, violet,  p2) * or2 * (1.4 + p2 * 0.6);
    vec3 c3 = mix(violet,  iceblue, p3) * or3 * (1.0 + p3 * 0.4);
    vec3 ch = mix(crimson, magenta, 0.5) * halo;
    vec3 cf = magenta * filament * 1.5;

    vec3 col = c1 + c2 + c3 + ch + cf;
    float alpha = max(or1*p1*0.8, max(or2*p2*0.65, max(or3*p3*0.5, halo * 0.5 + filament * 0.6)));
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const jetFrag = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2  uv = vUv * 2.0 - 1.0;
    float dx = abs(uv.x);
    float dy = uv.y;
    float jet = max(0.0, 1.0 - dx * 8.0) * max(0.0, 1.0 - abs(dy)*0.7);
    float flicker = 0.5 + 0.5*sin(time*5.0 + dy*10.0);
    vec3  col = mix(vec3(0.2,0.5,1.0), vec3(0.8,0.2,1.0), abs(dy));
    gl_FragColor = vec4(col * jet * flicker, jet * 0.7);
  }
`;

function BlackHole({ isUndergroundRef }: { isUndergroundRef: React.RefObject<boolean> }) {
  const horizonRef     = useRef<THREE.ShaderMaterial>(null);
  const lensRef        = useRef<THREE.ShaderMaterial>(null);
  const accretionRef   = useRef<THREE.ShaderMaterial>(null);
  const outerGlowRef   = useRef<THREE.ShaderMaterial>(null);
  const jetRef         = useRef<THREE.ShaderMaterial>(null);
  const groupRef       = useRef<THREE.Group>(null);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    if (horizonRef.current)   horizonRef.current.uniforms.time.value   = t;
    if (lensRef.current)      lensRef.current.uniforms.time.value      = t;
    if (accretionRef.current) accretionRef.current.uniforms.time.value = t;
    if (outerGlowRef.current) outerGlowRef.current.uniforms.time.value = t;
    if (jetRef.current)       jetRef.current.uniforms.time.value       = t;

    // Rotate accretion disk
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        if (i === 2) child.rotation.z += 0.0005; // inner accretion
        if (i === 3) child.rotation.z -= 0.0003; // outer glow
      });

      // Billboard: face camera always
      groupRef.current.lookAt(camera.position);

      // Note: parent Sky group already hides all sky children underground.
      // This group's visibility is also covered by that, but we keep lookAt always active.
    }
  });

  return (
    <group ref={groupRef} position={BH_POS}>
      {/* Event horizon — pure black disk with photon sphere rim */}
      <mesh renderOrder={-1800}>
        <planeGeometry args={[140, 140]} />
        <shaderMaterial
          ref={horizonRef}
          vertexShader={sunVertShader}
          fragmentShader={horizonFrag}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest={true}
        />
      </mesh>

      {/* Multi-ring gravitational lensing */}
      <mesh renderOrder={-1795}>
        <planeGeometry args={[175, 175]} />
        <shaderMaterial
          ref={lensRef}
          vertexShader={sunVertShader}
          fragmentShader={lensRingFrag}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Accretion disk — 3 nested rings of hot plasma */}
      <mesh renderOrder={-1790}>
        <planeGeometry args={[340, 340]} />
        <shaderMaterial
          ref={accretionRef}
          vertexShader={sunVertShader}
          fragmentShader={accretionFrag}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Massive outer corona + filaments */}
      <mesh renderOrder={-1785}>
        <planeGeometry args={[560, 560]} />
        <shaderMaterial
          ref={outerGlowRef}
          vertexShader={sunVertShader}
          fragmentShader={outerGlowFrag}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Relativistic jets (top + bottom) */}
      <mesh renderOrder={-1783} rotation={[0, 0, 0]}>
        <planeGeometry args={[40, 260]} />
        <shaderMaterial
          ref={jetRef}
          vertexShader={sunVertShader}
          fragmentShader={jetFrag}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Enhanced ambient purple point light from black hole */}
      <pointLight color="#6600cc" intensity={2.5} distance={1200} decay={2} />
      
      {/* Volumetric light scattering for dramatic effect */}
      <spotLight 
        color="#8a2be2" 
        intensity={1.5} 
        position={[140, 210, -310]} 
        angle={0.8} 
        penumbra={1} 
        distance={1000} 
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

// ─── Clouds ───────────────────────────────────────────────────────────────────
function Clouds({ timeOfDay }: { timeOfDay: number }) {
  const t     = timeOfDay / DAY_LENGTH;
  const alpha = t > 0.3 && t < 0.7 ? 0.6 : 0.2;

  const positions = useMemo(() => {
    const pts = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      pts[i*3]   = (Math.random() - 0.5) * 700;
      pts[i*3+1] = 80 + Math.random() * 60;
      pts[i*3+2] = (Math.random() - 0.5) * 700;
    }
    return pts;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <points geometry={geo} renderOrder={-1400}>
      <pointsMaterial color="#ffffff" size={18} sizeAttenuation transparent opacity={alpha} depthWrite={false} />
    </points>
  );
}