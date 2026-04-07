'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';
import { DAY_LENGTH } from '@/utils/constants';

// ─── Shared vertex shader (UV passthrough) ────────────────────────────────────
const UV_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

export default function Sky() {
  const groupRef   = useRef<THREE.Group>(null);
  const { camera, scene } = useThree();
  const timeOfDay  = useGameStore(s => s.worldTime);
  const renderDistance = useGameStore(s => s.renderDistance);
  const worldGenerationMode = useGameStore(s => s.worldGenerationMode);
  const isUndergroundRef = useRef(false);
  const visibilityRef    = useRef(1);
  const lastOpacityApplyRef = useRef(0);

  const skyColor = useMemo(() => {
    const t = timeOfDay / DAY_LENGTH;
    // Enhanced color palette - more vibrant and majestic
    const colors = {
      midnight: new THREE.Color(0x050510),       // Deep cosmic blue
      preDawn:  new THREE.Color(0x2d1b4e),       // Deep purple
      sunrise:  new THREE.Color(0xff7b4d),       // Vibrant orange-pink
      sunriseGlow: new THREE.Color(0xffaa6e),   // Golden sunrise
      midday:   new THREE.Color(0x4fa3d1),      // Bright sky blue
      middayHorizon: new THREE.Color(0xa8d8ff), // Light blue at horizon
      sunset:   new THREE.Color(0xff6b6b),       // Coral red
      sunsetGlow: new THREE.Color(0xff9966),     // Orange sunset
      dusk:     new THREE.Color(0x1a0a3d),      // Deep purple dusk
      night:    new THREE.Color(0x0a0a2e),       // Deep night blue
    };
    
    let nt = t; if (nt > 0.75) nt -= 1.0;
    let c = new THREE.Color();
    
    // More detailed time periods for smoother transitions
    if (nt < 0.02) {
      // Deep midnight
      c.lerpColors(colors.midnight, colors.preDawn, nt / 0.02);
    } else if (nt < 0.06) {
      // Pre-dawn
      c.lerpColors(colors.preDawn, colors.sunrise, (nt - 0.02) / 0.04);
    } else if (nt < 0.12) {
      // Sunrise
      c.lerpColors(colors.sunrise, colors.sunriseGlow, (nt - 0.06) / 0.06);
    } else if (nt < 0.25) {
      // Morning
      c.lerpColors(colors.sunriseGlow, colors.midday, (nt - 0.12) / 0.13);
    } else if (nt < 0.45) {
      // Midday
      c.copy(colors.midday);
    } else if (nt < 0.52) {
      // Late afternoon
      c.lerpColors(colors.midday, colors.sunsetGlow, (nt - 0.45) / 0.07);
    } else if (nt < 0.58) {
      // Sunset
      c.lerpColors(colors.sunsetGlow, colors.sunset, (nt - 0.52) / 0.06);
    } else if (nt < 0.65) {
      // Dusk
      c.lerpColors(colors.sunset, colors.dusk, (nt - 0.58) / 0.07);
    } else if (nt < 0.72) {
      // Night approaching
      c.lerpColors(colors.dusk, colors.night, (nt - 0.65) / 0.07);
    } else {
      // Night
      c.lerpColors(colors.night, colors.midnight, (nt - 0.72) / 0.03);
    }
    
    // Clamp values
    c.r = Math.max(0, Math.min(1, c.r));
    c.g = Math.max(0, Math.min(1, c.g));
    c.b = Math.max(0, Math.min(1, c.b));
    return c;
  }, [timeOfDay]);
  
  // Enhanced fog color that matches sky with more dramatic effect
  const fogColor = useMemo(() => {
    const t = timeOfDay / DAY_LENGTH;
    let nt = t; if (nt > 0.75) nt -= 1.0;
    
    // Fog colors that blend with sky
    const fogColors = {
      midnight: new THREE.Color(0x0a0a20),
      sunrise:  new THREE.Color(0xff9966),
      midday:   new THREE.Color(0xc8e6ff),
      sunset:  new THREE.Color(0xff7755),
      dusk:    new THREE.Color(0x2a1a4a),
      night:   new THREE.Color(0x0f0f25),
    };
    
    let c = new THREE.Color();
    if (nt < 0.06) {
      c.lerpColors(fogColors.midnight, fogColors.sunrise, nt / 0.06);
    } else if (nt < 0.12) {
      c.lerpColors(fogColors.sunrise, fogColors.midday, (nt - 0.06) / 0.06);
    } else if (nt < 0.45) {
      c.copy(fogColors.midday);
    } else if (nt < 0.58) {
      c.lerpColors(fogColors.midday, fogColors.sunset, (nt - 0.45) / 0.13);
    } else if (nt < 0.68) {
      c.lerpColors(fogColors.sunset, fogColors.dusk, (nt - 0.58) / 0.10);
    } else if (nt < 0.75) {
      c.lerpColors(fogColors.dusk, fogColors.night, (nt - 0.68) / 0.07);
    } else {
      c.lerpColors(fogColors.night, fogColors.midnight, (nt - 0.75) / 0.25);
    }
    
    return c;
  }, [timeOfDay]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);

    // Use enhanced fog color with atmospheric depth
    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(fogColor.getHex(), renderDistance * 12, renderDistance * 30);
    }
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(fogColor);
    // Dynamic fog distances based on render distance
    fog.near = renderDistance * 12;
    fog.far = renderDistance * 30;

    const playerPos  = usePlayerStore.getState().position;
    const worldStore = useWorldStore.getState();
    const hx = Math.floor(playerPos.x);
    const hy = Math.floor(playerPos.y + 1.6);
    const hz = Math.floor(playerPos.z);
    const isSolid = (blk: number | null | undefined) =>
      blk != null && blk !== BlockType.AIR && blk !== BlockType.WATER;

    // Keep the sky visible in rugged terrain, but still allow a gentle fade
    // in the flatter classic world when the player is genuinely enclosed.
    let blocksAbove = 0;
    for (let y = hy + 1; y <= hy + 8; y++) {
      if (isSolid(worldStore.getBlock(hx, y, hz))) blocksAbove++;
    }

    const allowUndergroundFade = worldGenerationMode === 'classic';
    const underground = allowUndergroundFade && blocksAbove >= 7;
    isUndergroundRef.current = underground;
    const target = underground ? 0 : 1;
    visibilityRef.current += (target - visibilityRef.current) * 0.1;
    groupRef.current.visible = visibilityRef.current > 0.01;

    const now = performance.now();
    if (now - lastOpacityApplyRef.current < 33 && Math.abs(visibilityRef.current - target) > 0.02) {
      return;
    }

    lastOpacityApplyRef.current = now;
    groupRef.current.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const m = child.material as THREE.MeshBasicMaterial | THREE.ShaderMaterial;
        if ('opacity' in m) {
          m.transparent = true;
          (m as any).opacity = visibilityRef.current;
        }
      }
    });
  });

  const sunAngle  = (timeOfDay / DAY_LENGTH) * Math.PI * 2 - Math.PI / 2;
  const moonAngle = sunAngle + Math.PI;
  const sunPos    = new THREE.Vector3(Math.cos(sunAngle) * 380, Math.sin(sunAngle) * 380, -80);
  const moonPos   = new THREE.Vector3(Math.cos(moonAngle) * 380, Math.sin(moonAngle) * 380, -80);

  return (
    <>
      <ambientLight intensity={Math.max(0.1, Math.sin(sunAngle) * 0.8 + 0.3)} color="#ffe8d0" />
      <directionalLight
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={Math.max(0, Math.sin(sunAngle))}
        color="#fffbe0" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5}   shadow-camera-far={500}
        shadow-camera-left={-100}  shadow-camera-right={100}
        shadow-camera-top={100}    shadow-camera-bottom={-100}
      />
      <group ref={groupRef}>
        {/* Sky dome */}
        <mesh renderOrder={-2000}>
          <sphereGeometry args={[490, 32, 32]} />
          <meshBasicMaterial color={skyColor} side={THREE.BackSide} depthWrite={false} />
        </mesh>
        <Stars timeOfDay={timeOfDay} />
        <Sun  position={sunPos}  angle={sunAngle}  />
        <Moon position={moonPos} angle={moonAngle} />
        {worldGenerationMode === 'classic' ? (
          <BlackHole isUndergroundRef={isUndergroundRef} />
        ) : null}
        <Clouds timeOfDay={timeOfDay} />
      </group>
    </>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ timeOfDay }: { timeOfDay: number }) {
  const t = timeOfDay / DAY_LENGTH;
  const nightAlpha = t < 0.3 || t > 0.7 ? 1
    : t < 0.35 ? 1-(t-0.3)/0.05 : (t-0.65)/0.05;
  const { positions, sizes } = useMemo(() => {
    const count = 2000, pos = new Float32Array(count*3), sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random()*Math.PI*2, phi = Math.acos(2*Math.random()-1);
      pos[i*3]   = 460*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1] = 460*Math.cos(phi);
      pos[i*3+2] = 460*Math.sin(phi)*Math.sin(theta);
      sz[i] = 0.5 + Math.random()*2;
    }
    return { positions: pos, sizes: sz };
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, sizes]);
  if (nightAlpha < 0.01) return null;
  return (
    <points geometry={geo} renderOrder={-1500}>
      <pointsMaterial color="#ffffff" size={1.5} sizeAttenuation={false}
        transparent opacity={nightAlpha} depthWrite={false} depthTest />
    </points>
  );
}

// ─── 3D SUN ───────────────────────────────────────────────────────────────────
// A real sphere with animated plasma surface + two glow halos
const SUN_FRAG = /* glsl */`
  precision highp float;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=.5;}return v;}

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Plasma surface
    vec2 uv = vUv * 4.0;
    uv.x += time * 0.04; uv.y += time * 0.025;
    float plasma = fbm(uv);
    float plasma2 = fbm(uv * 1.7 + vec2(time*0.03, time*0.05));
    float combined = plasma * 0.6 + plasma2 * 0.4;

    // Temperature gradient
    vec3 core  = vec3(1.0, 0.98, 0.85);   // white-yellow core
    vec3 hot   = vec3(1.0, 0.72, 0.15);   // orange-gold mid
    vec3 cool  = vec3(0.9, 0.3, 0.05);    // red-orange edges
    vec3 col   = mix(core, mix(hot, cool, combined), combined * 0.8);

    // Limb darkening (cooler at edge)
    float cosTheta = max(dot(N, V), 0.0);
    float limb = pow(cosTheta, 0.35);
    col *= mix(0.55, 1.0, limb);

    // Sunspot hints
    float spot = noise(uv * 3.0 + time * 0.01);
    if (spot > 0.72) col *= 0.45 + (1.0-spot)*2.0;

    // Solar prominences at edge
    float rim = 1.0 - cosTheta;
    float prom = pow(rim, 4.0) * (0.5 + 0.5*sin(time*2.0 + vUv.x*20.0));
    col += vec3(1.0, 0.5, 0.1) * prom * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const SUN_CORONA_FRAG = /* glsl */`
  precision highp float;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    vec2 uv  = vUv * 2.0 - 1.0;
    float d  = length(uv);
    float ang = atan(uv.y, uv.x);

    // Soft glow halo
    float halo = exp(-d * 2.2) * 0.7;
    // Coronal streamers
    float streamer = pow(max(0.0, noise(vec2(ang * 3.0 + time*0.3, d*2.0))), 2.5);
    streamer *= max(0.0, 1.0 - d * 1.2);

    vec3 col = vec3(1.0, 0.88, 0.4) * (halo + streamer * 0.5);
    float alpha = (halo + streamer * 0.4) * 0.55;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function Sun({ position, angle }: { position: THREE.Vector3; angle: number }) {
  const matRef    = useRef<THREE.ShaderMaterial>(null);
  const coronaRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef  = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (matRef.current)    matRef.current.uniforms.time.value    = t;
    if (coronaRef.current) coronaRef.current.uniforms.time.value = t;
    // Slowly rotate the sphere so surface moves
    if (groupRef.current) {
      groupRef.current.children[0].rotation.y = t * 0.03;
      groupRef.current.children[0].rotation.x = t * 0.01;
      // Billboard corona quad
      groupRef.current.children[1].lookAt(camera.position);
    }
  });

  if (Math.sin(angle) < -0.15) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* 3D sphere — the actual sun body */}
      <mesh renderOrder={-1600}>
        <sphereGeometry args={[18, 48, 48]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={UV_VERT}
          fragmentShader={SUN_FRAG}
          uniforms={{ time: { value: 0 } }}
          side={THREE.FrontSide}
          depthWrite={false}
          depthTest
        />
      </mesh>

      {/* Billboarded corona glow plane behind sphere */}
      <mesh renderOrder={-1605}>
        <planeGeometry args={[90, 90]} />
        <shaderMaterial
          ref={coronaRef}
          vertexShader={UV_VERT}
          fragmentShader={SUN_CORONA_FRAG}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Point light so sphere is lit from "itself" */}
      <pointLight color="#fffacc" intensity={3} distance={500} decay={2} />
    </group>
  );
}

// ─── 3D MOON ──────────────────────────────────────────────────────────────────
const MOON_FRAG = /* glsl */`
  precision highp float;
  uniform float time;
  uniform float phaseOffset;   // 0 = full, 0.5 = new, shifts the terminator
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Regolith base colour
    vec3 highland = vec3(0.82, 0.82, 0.88);
    vec3 mare     = vec3(0.40, 0.40, 0.48);

    // Mare patches (large scale noise)
    float mareNoise = noise(vUv * 2.5);
    vec3 surface = mix(highland, mare, smoothstep(0.45, 0.6, mareNoise));

    // Crater layer
    vec2 c1 = vUv*6.0, c2 = vUv*11.0, c3 = vUv*18.0;
    float cr1 = length(fract(c1)-0.5); float cr2 = length(fract(c2)-0.5);
    float cr3 = length(fract(c3)-0.5); float cHash = hash(floor(c2));
    float craters = smoothstep(0.22, 0.18, cr1) * 0.35
                  + (cHash > 0.6 ? smoothstep(0.18, 0.13, cr2) * 0.25 : 0.0)
                  + smoothstep(0.14, 0.10, cr3) * 0.15;
    surface *= 1.0 - craters * 0.55;
    // Bright ejecta rings
    surface += vec3(0.9,0.9,0.95) * smoothstep(0.235, 0.22, cr1) * 0.2;

    // Diffuse lighting from sun direction (approx: from +X side in local space)
    vec3 sunDir = normalize(vec3(cos(phaseOffset*3.14159), 0.2, sin(phaseOffset*3.14159)));
    float NdotL  = max(dot(N, sunDir), 0.0);
    float NdotL2 = max(dot(N, -sunDir), 0.0); // earthshine on dark side
    vec3 lit   = surface * (NdotL * 1.1 + 0.04);       // sunlit
    vec3 dark  = surface * 0.03 + vec3(0.02,0.03,0.06)*NdotL2; // dark side + earthshine
    vec3 col   = mix(dark, lit, smoothstep(0.0, 0.08, NdotL));

    // Atmosphere limb tint (thin blue rim)
    float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    col += vec3(0.3, 0.45, 0.7) * rim * 0.12;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const MOON_GLOW_FRAG = /* glsl */`
  precision highp float;
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float d = length(uv);
    float halo = exp(-d * 3.0) * 0.35;
    if (halo < 0.005) discard;
    gl_FragColor = vec4(0.7, 0.8, 1.0, halo);
  }
`;

function Moon({ position, angle }: { position: THREE.Vector3; angle: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const glowRef  = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const phaseOffset = useMemo(() => Math.sin(Date.now() * 0.00001) * 0.5 + 0.5, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (matRef.current)  matRef.current.uniforms.time.value  = t;
    if (glowRef.current) glowRef.current.uniforms.time.value = t;
    // Slowly rotate sphere
    if (groupRef.current) {
      groupRef.current.children[0].rotation.y = t * 0.005;
      groupRef.current.children[1].lookAt(camera.position);
    }
  });

  if (Math.sin(angle) < -0.15) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* 3D sphere */}
      <mesh renderOrder={-1600}>
        <sphereGeometry args={[14, 48, 48]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={UV_VERT}
          fragmentShader={MOON_FRAG}
          uniforms={{ time: { value: 0 }, phaseOffset: { value: phaseOffset } }}
          side={THREE.FrontSide}
          depthWrite={false}
          depthTest
        />
      </mesh>

      {/* Billboarded soft glow */}
      <mesh renderOrder={-1605}>
        <planeGeometry args={[72, 72]} />
        <shaderMaterial
          ref={glowRef}
          vertexShader={UV_VERT}
          fragmentShader={MOON_GLOW_FRAG}
          uniforms={{ time: { value: 0 } }}
          transparent depthWrite={false} depthTest
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ─── Black Hole (unchanged from original) ─────────────────────────────────────
const BH_POS = new THREE.Vector3(140, 210, -310);
const BH_VERT = UV_VERT;

const horizonFrag = /* glsl */`
  uniform float time; varying vec2 vUv;
  void main(){
    vec2 uv=vUv*2.-1.; float d=length(uv); if(d>1.0)discard;
    vec3 col=vec3(0.0);
    float rim=smoothstep(0.82,1.0,d);
    float rs=0.7+0.3*sin(d*40.-time*8.+atan(uv.y,uv.x)*3.);
    vec3 rc=mix(vec3(0.3,0.6,1.0),vec3(1.,1.,1.),rs*rim);
    col=mix(col,rc,rim*rs*0.9);
    float inner=smoothstep(0.6,0.85,d);
    col+=vec3(0.04,0.,0.08)*inner*(0.5+0.5*sin(time*1.5+d*12.));
    gl_FragColor=vec4(col,1.0);
  }
`;
const lensRingFrag = /* glsl */`
  uniform float time; varying vec2 vUv;
  void main(){
    vec2 uv=vUv*2.-1.; float d=length(uv); float ang=atan(uv.y,uv.x);
    float r1=max(0.,1.-abs(d-.88)/.04),r2=max(0.,1.-abs(d-.96)/.03),r3=max(0.,1.-abs(d-1.06)/.05);
    float p1=.5+.5*sin(time*4.+ang*5.),p2=.5+.5*sin(time*2.8-ang*7.+1.4),p3=.5+.5*sin(time*1.9+ang*3.+2.8);
    vec3 c1=mix(vec3(.2,.5,1.),vec3(.9,.3,1.),p1)*r1*(1.2+p1);
    vec3 c2=mix(vec3(.1,.9,1.),vec3(.5,.1,1.),p2)*r2*(1.5+p2*.5);
    vec3 c3=mix(vec3(.8,.2,1.),vec3(.2,.8,1.),p3)*r3*(1.+p3*.3);
    vec3 col=c1+c2+c3; float alpha=max(r1*p1,max(r2*p2,r3*p3))*.95;
    if(alpha<.01)discard; gl_FragColor=vec4(col,alpha);
  }
`;
const accretionFrag = /* glsl */`
  uniform float time; varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=.5;}return v;}
  void main(){
    vec2 uv=vUv*2.-1.;float d=length(uv),ang=atan(uv.y,uv.x);
    float r1=max(0.,1.-abs(d-1.18)/.18),r2=max(0.,1.-abs(d-1.42)/.14),r3=max(0.,1.-abs(d-1.65)/.10);
    if(r1+r2+r3<.01)discard;
    float f1=fbm(vec2(ang*5.-time*3.5,(d-1.)*4.+time*.5));
    float f2=fbm(vec2(ang*4.-time*2.2,(d-1.2)*3.-time*.3));
    float f3=fbm(vec2(ang*3.-time*1.4,(d-1.5)*2.5+time*.2));
    float dp1=.35+.65*pow(max(0.,sin(ang-time*2.)),1.5);
    float dp2=.35+.65*pow(max(0.,sin(ang-time*1.4+1.2)),1.5);
    float dp3=.35+.65*pow(max(0.,sin(ang-time*.9+2.4)),1.5);
    vec3 w=vec3(1.,.97,.88),o=vec3(1.,.45,.05),r=vec3(.65,.02,0.),pu=vec3(.3,0.,.25);
    vec3 c1=mix(mix(w,o,smoothstep(0.,1.,abs(d-1.18)/.18+f1*.35)),r,pow(smoothstep(0.,1.,abs(d-1.18)/.18+f1*.35),2.))*r1*(.6+.4*f1)*dp1;
    vec3 c2=mix(mix(o,r,smoothstep(0.,1.,abs(d-1.42)/.14+f2*.35)),pu,pow(smoothstep(0.,1.,abs(d-1.42)/.14+f2*.35),2.))*r2*(.5+.5*f2)*dp2;
    vec3 c3=mix(r,pu,smoothstep(0.,1.,abs(d-1.65)/.10+f3*.35))*r3*(.4+.6*f3)*dp3;
    float fl=pow(max(0.,noise(vec2(ang*3.-time*4.,d*8.))-.7),2.)*6.;
    c1+=vec3(1.,.8,.5)*fl*r1;
    vec3 col=c1*2.8+c2*2.+c3*1.5;
    float alpha=max(r1*.94,max(r2*.85,r3*.75));
    gl_FragColor=vec4(col,alpha);
  }
`;
const outerGlowFrag = /* glsl */`
  uniform float time; varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec2 uv=vUv*2.-1.;float d=length(uv),ang=atan(uv.y,uv.x);
    float halo=exp(-pow((d-1.3)*2.2,2.))*.6;
    float or1=max(0.,1.-abs(d-1.55)/.18),or2=max(0.,1.-abs(d-1.85)/.22),or3=max(0.,1.-abs(d-2.20)/.30);
    float p1=.5+.5*sin(time*1.3+ang*4.),p2=.5+.5*sin(time*.9-ang*6.+2.),p3=.5+.5*sin(time*.6+ang*2.+4.);
    float fi=pow(noise(vec2(ang*4.-time*.8,d*3.+time*.2)),2.5)*max(0.,1.-abs(d-1.7)/.5);
    vec3 cr=vec3(.9,0.,.15),mg=vec3(.6,0.,.5),vi=vec3(.15,0.,.4),ib=vec3(0.,.1,.5);
    vec3 c1=mix(cr,mg,p1)*or1*(1.8+p1*.8);
    vec3 c2=mix(mg,vi,p2)*or2*(1.4+p2*.6);
    vec3 c3=mix(vi,ib,p3)*or3*(1.+p3*.4);
    vec3 col=c1+c2+c3+mix(cr,mg,.5)*halo+mg*fi*1.5;
    float alpha=max(or1*p1*.8,max(or2*p2*.65,max(or3*p3*.5,halo*.5+fi*.6)));
    if(alpha<.005)discard; gl_FragColor=vec4(col,alpha);
  }
`;
const jetFrag = /* glsl */`
  uniform float time; varying vec2 vUv;
  void main(){
    vec2 uv=vUv*2.-1.;float dx=abs(uv.x),dy=uv.y;
    float jet=max(0.,1.-dx*8.)*max(0.,1.-abs(dy)*.7);
    float fl=.5+.5*sin(time*5.+dy*10.);
    vec3 col=mix(vec3(.2,.5,1.),vec3(.8,.2,1.),abs(dy));
    gl_FragColor=vec4(col*jet*fl,jet*.7);
  }
`;

function BlackHole({ isUndergroundRef }: { isUndergroundRef: React.RefObject<boolean> }) {
  const horizonRef=useRef<THREE.ShaderMaterial>(null),lensRef=useRef<THREE.ShaderMaterial>(null);
  const accretionRef=useRef<THREE.ShaderMaterial>(null),outerGlowRef=useRef<THREE.ShaderMaterial>(null);
  const jetRef=useRef<THREE.ShaderMaterial>(null),groupRef=useRef<THREE.Group>(null);
  useFrame(({clock,camera})=>{
    const t=clock.elapsedTime;
    if(horizonRef.current)   horizonRef.current.uniforms.time.value=t;
    if(lensRef.current)      lensRef.current.uniforms.time.value=t;
    if(accretionRef.current) accretionRef.current.uniforms.time.value=t;
    if(outerGlowRef.current) outerGlowRef.current.uniforms.time.value=t;
    if(jetRef.current)       jetRef.current.uniforms.time.value=t;
    if(groupRef.current){
      groupRef.current.children.forEach((c,i)=>{if(i===2)c.rotation.z+=.0005;if(i===3)c.rotation.z-=.0003;});
      groupRef.current.lookAt(camera.position);
    }
  });
  return (
    <group ref={groupRef} position={BH_POS}>
      <mesh renderOrder={-1800}><planeGeometry args={[140,140]}/>
        <shaderMaterial ref={horizonRef} vertexShader={BH_VERT} fragmentShader={horizonFrag} uniforms={{time:{value:0}}} transparent depthWrite={false} depthTest/></mesh>
      <mesh renderOrder={-1795}><planeGeometry args={[175,175]}/>
        <shaderMaterial ref={lensRef} vertexShader={BH_VERT} fragmentShader={lensRingFrag} uniforms={{time:{value:0}}} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending}/></mesh>
      <mesh renderOrder={-1790}><planeGeometry args={[340,340]}/>
        <shaderMaterial ref={accretionRef} vertexShader={BH_VERT} fragmentShader={accretionFrag} uniforms={{time:{value:0}}} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending}/></mesh>
      <mesh renderOrder={-1785}><planeGeometry args={[560,560]}/>
        <shaderMaterial ref={outerGlowRef} vertexShader={BH_VERT} fragmentShader={outerGlowFrag} uniforms={{time:{value:0}}} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending}/></mesh>
      <mesh renderOrder={-1783}><planeGeometry args={[40,260]}/>
        <shaderMaterial ref={jetRef} vertexShader={BH_VERT} fragmentShader={jetFrag} uniforms={{time:{value:0}}} transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending}/></mesh>
      <pointLight color="#6600cc" intensity={2.5} distance={1200} decay={2}/>
      <spotLight color="#8a2be2" intensity={1.5} position={[140,210,-310]} angle={0.8} penumbra={1} distance={1000} decay={2} castShadow={false}/>
    </group>
  );
}

// ─── Clouds ───────────────────────────────────────────────────────────────────
function Clouds({ timeOfDay }: { timeOfDay: number }) {
  const t = timeOfDay / DAY_LENGTH;
  const alpha = t > 0.3 && t < 0.7 ? 0.6 : 0.2;
  const positions = useMemo(() => {
    const pts = new Float32Array(80*3);
    for (let i=0;i<80;i++){
      pts[i*3]   = (Math.random()-0.5)*700;
      pts[i*3+1] = 80+Math.random()*60;
      pts[i*3+2] = (Math.random()-0.5)*700;
    }
    return pts;
  }, []);
  const geo = useMemo(()=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(positions,3)); return g; },[positions]);
  return (
    <points geometry={geo} renderOrder={-1400}>
      <pointsMaterial color="#ffffff" size={18} sizeAttenuation transparent opacity={alpha} depthWrite={false}/>
    </points>
  );
}
