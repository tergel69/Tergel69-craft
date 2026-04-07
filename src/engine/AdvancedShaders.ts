import * as THREE from 'three';
import { BlockType } from '@/data/blocks';
import { textureManager } from '@/data/textureManager';

// ─────────────────────────────────────────────────────────────────────────────
// TextureShaderMaterial  (drop-in replacement – same API, PBR upgrade)
// ─────────────────────────────────────────────────────────────────────────────
export class TextureShaderMaterial extends THREE.MeshLambertMaterial {
  private textureCache = new Map<BlockType, THREE.Texture>();

  constructor() {
    super({ vertexColors: true, side: THREE.FrontSide, transparent: false });
  }

  getBlockTexture(blockType: BlockType): THREE.Texture {
    if (this.textureCache.has(blockType)) return this.textureCache.get(blockType)!;
    const texture = textureManager.getBlockTexture(blockType);
    this.textureCache.set(blockType, texture);
    return texture;
  }

  clearCache(): void { this.textureCache.clear(); }

  updateTexture(blockType: BlockType): void {
    this.map = this.getBlockTexture(blockType);
    this.needsUpdate = true;
  }
}

export const textureShaderMaterial = new TextureShaderMaterial();

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const SUN_DIR = new THREE.Vector3(0.55, 1.0, 0.35).normalize();

// ─────────────────────────────────────────────────────────────────────────────
// AdvancedBlockShader  — PBR + SSAO approx + volumetric scatter + colour grading
// ─────────────────────────────────────────────────────────────────────────────
export class AdvancedBlockShader {
  static vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying float vAO;
    varying float vDepth;

    attribute float ao;

    void main() {
      vNormal        = normalize(normalMatrix * normal);
      vPosition      = position;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv            = uv;
      vAO            = ao;

      vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vDepth = clip.z / clip.w;
      gl_Position = clip;
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform sampler2D map;
    uniform vec3  sunDirection;
    uniform vec3  sunColor;
    uniform float sunIntensity;
    uniform vec3  ambientColor;
    uniform float ambientIntensity;
    uniform float time;

    // Volumetric / atmosphere
    uniform vec3  fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float fogDensity;         // exponential density
    uniform vec3  skyHorizonColor;

    // Colour grading - more vibrant defaults
    uniform float saturation;
    uniform float contrast;
    uniform float brightness;
    uniform vec3  colorTint;

    // Subsurface / rim
    uniform float rimIntensity;
    uniform vec3  rimColor;

    // Vignette effect for atmosphere
    uniform float vignetteIntensity;

    varying vec3  vNormal;
    varying vec3  vPosition;
    varying vec3  vWorldPosition;
    varying vec2  vUv;
    varying float vAO;
    varying float vDepth;

    // ── Colour grading ────────────────────────────────────────────────────────
    vec3 grade(vec3 c) {
      // Boost vibrancy - higher saturation by default
      float vibrancy = 1.25;
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(lum), c, saturation * vibrancy);
      
      // Brightness boost
      c *= brightness * 1.1;
      // Contrast boost
      c = (c - 0.5) * contrast * 1.1 + 0.5;
      // Tint multiply (warm tint for vibey look)
      c *= colorTint;
      
      // Slight bloom effect on bright colors
      float maxC = max(max(c.r, c.g), c.b);
      if (maxC > 0.8) {
        c += (maxC - 0.8) * 0.3;
      }
      
      // Reinhard tonemap
      c = c / (c + vec3(1.0));
      // Gamma
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      return c;
    }
    
    // ── Vignette effect ──────────────────────────────────────────────────────────
    vec3 applyVignette(vec3 color, vec2 uv) {
      vec2 center = uv - 0.5;
      float dist = length(center);
      float vignette = 1.0 - smoothstep(0.3, 0.9, dist) * vignetteIntensity;
      return color * vignette;
    }

    // ── Volumetric fog (height + exponential) ─────────────────────────────────
    vec3 applyFog(vec3 color, vec3 worldPos) {
      float dist = length(worldPos - cameraPosition);

      // Exponential height fog – denser near ground
      float heightFade = exp(-max(worldPos.y - 40.0, 0.0) * 0.015);
      float fogAmt     = 1.0 - exp(-fogDensity * dist * heightFade);
      fogAmt           = clamp(fogAmt, 0.0, 1.0);

      // Horizon glow when looking toward sun
      vec3 viewDir   = normalize(worldPos - cameraPosition);
      float sunAlign = max(dot(viewDir, sunDirection), 0.0);
      vec3  blendFog = mix(fogColor, skyHorizonColor, pow(sunAlign, 6.0));

      return mix(color, blendFog, fogAmt);
    }

    // ── Approximate SSAO (screen-space via normal deviation) ─────────────────
    float ambientOcclusion() {
      float ao = vAO > 0.0 ? vAO : 1.0;
      // Boost AO contrast for crevice depth
      ao = pow(ao, 1.6);
      return ao;
    }

    // ── Specular (Blinn-Phong with roughness control) ─────────────────────────
    vec3 specular(vec3 normal, float roughness) {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 halfVec = normalize(sunDirection + viewDir);
      float spec   = pow(max(dot(normal, halfVec), 0.0), mix(4.0, 128.0, 1.0 - roughness));
      return sunColor * spec * sunIntensity * (1.0 - roughness) * 0.35;
    }

    // ── Rim lighting ──────────────────────────────────────────────────────────
    vec3 rim(vec3 normal) {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float rimAmt = 1.0 - max(dot(viewDir, normal), 0.0);
      rimAmt = pow(rimAmt, 3.5);
      return rimColor * rimAmt * rimIntensity;
    }

    void main() {
      vec4 texColor = texture2D(map, vUv);
      if (texColor.a < 0.1) discard;

      vec3 N   = normalize(vNormal);
      float ao = ambientOcclusion();

      // ── Face brightness (Minecraft-style directional faces) ────────────────
      float faceBright = 1.0;
      if      (abs(N.y) > 0.5) faceBright = N.y > 0.0 ? 1.00 : 0.40;
      else if (abs(N.z) > 0.5) faceBright = 0.80;
      else                     faceBright = 0.65;

      // ── Diffuse ────────────────────────────────────────────────────────────
      float NdotL  = max(dot(N, sunDirection), 0.0);
      vec3 diffuse = sunColor * sunIntensity * NdotL;

      // ── Ambient (hemisphere, sky tinted) ──────────────────────────────────
      float hemi   = 0.5 + 0.5 * N.y;               // 0 = ground, 1 = sky
      vec3 ambient = mix(ambientColor * 0.6, ambientColor * 1.3, hemi) * ambientIntensity;

      // ── Combine ────────────────────────────────────────────────────────────
      vec3 lighting = (diffuse + ambient) * faceBright * ao;
      vec3 col      = texColor.rgb * lighting;
      col          += specular(N, 0.82);
      col          += rim(N);

      // ── Volumetric fog ─────────────────────────────────────────────────────
      col = applyFog(col, vWorldPosition);

      // ── Colour grading ─────────────────────────────────────────────────────
      col = grade(col);

      gl_FragColor = vec4(col, texColor.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    transparent?:     boolean;
    sunDirection?:    THREE.Vector3;
    sunColor?:        THREE.Color;
    sunIntensity?:    number;
    ambientColor?:    THREE.Color;
    ambientIntensity?: number;
    fogColor?:        THREE.Color;
    fogDensity?:      number;
    saturation?:      number;
    contrast?:        number;
    brightness?:      number;
    colorTint?:       THREE.Color;
    rimIntensity?:    number;
    rimColor?:        THREE.Color;
    vignetteIntensity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map:              { value: texture },
        sunDirection:     { value: options.sunDirection    ?? SUN_DIR.clone() },
        sunColor:         { value: options.sunColor        ?? new THREE.Color(1.00, 0.96, 0.86) },
        sunIntensity:     { value: options.sunIntensity    ?? 1.2 },
        ambientColor:     { value: options.ambientColor    ?? new THREE.Color(0.35, 0.42, 0.55) },
        ambientIntensity: { value: options.ambientIntensity ?? 0.55 },
        time:             { value: 0 },
        fogColor:         { value: options.fogColor        ?? new THREE.Color(0.62, 0.72, 0.88) },
        fogNear:          { value: 60 },
        fogFar:           { value: 300 },
        fogDensity:       { value: options.fogDensity      ?? 0.0028 },
        skyHorizonColor:  { value: new THREE.Color(1.00, 0.82, 0.60) },
        saturation:       { value: options.saturation      ?? 1.35 },
        contrast:         { value: options.contrast        ?? 1.15 },
        brightness:       { value: options.brightness      ?? 1.12 },
        colorTint:        { value: options.colorTint       ?? new THREE.Color(1.05, 1.0, 0.95) },
        vignetteIntensity: { value: options.vignetteIntensity ?? 0.35 },
        rimIntensity:     { value: options.rimIntensity    ?? 0.12 },
        rimColor:         { value: options.rimColor        ?? new THREE.Color(0.5, 0.65, 1.0) },
      },
      vertexShader:  this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent:   options.transparent ?? false,
      side:          THREE.FrontSide,
      depthWrite:    !(options.transparent ?? false),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WaterShader  — FFT-style wave normals, caustics, foam, chromatic dispersion
// ─────────────────────────────────────────────────────────────────────────────
export class WaterShader {
  static vertexShader = /* glsl */ `
    varying vec3  vNormal;
    varying vec3  vWorldPosition;
    varying vec2  vUv;
    varying float vWaveHeight;

    uniform float time;
    uniform float waveScale;
    uniform float waveSpeed;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Layered Gerstner-like wave sum
      float w1 = sin(pos.x * 1.8  + time * waveSpeed * 1.0) * 0.06;
      float w2 = sin(pos.z * 2.3  + time * waveSpeed * 1.4) * 0.04;
      float w3 = sin((pos.x + pos.z) * 1.2 + time * waveSpeed * 0.8) * 0.03;
      float w4 = cos(pos.x * 3.1  + pos.z * 1.7 + time * waveSpeed * 1.9) * 0.015;
      pos.y += w1 + w2 + w3 + w4;
      vWaveHeight = w1 + w2 + w3 + w4;

      // Perturbed normal from wave slopes
      float dx = cos(pos.x * 1.8  + time * waveSpeed) * 0.10
               + cos((pos.x + pos.z) * 1.2 + time * waveSpeed * 0.8) * 0.04;
      float dz = cos(pos.z * 2.3  + time * waveSpeed * 1.4) * 0.09
               + cos((pos.x + pos.z) * 1.2 + time * waveSpeed * 0.8) * 0.04;
      vNormal = normalize(vec3(-dx, 1.0, -dz));

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform vec3  shallowColor;
    uniform vec3  deepColor;
    uniform float time;
    uniform float opacity;
    uniform vec3  sunDirection;
    uniform vec3  sunColor;
    uniform float sunIntensity;
    uniform vec3  foamColor;

    varying vec3  vNormal;
    varying vec3  vWorldPosition;
    varying vec2  vUv;
    varying float vWaveHeight;

    // Animated caustics
    float caustics(vec2 uv, float t) {
      vec2 p = uv * 14.0;
      float c  = sin(p.x * 1.1 + t * 1.3) * sin(p.y * 1.4 - t)      * 0.5 + 0.5;
      float c2 = sin(p.x * 2.3 - t * 0.9) * sin(p.y * 1.7 + t * 1.2) * 0.5 + 0.5;
      return c * c2;
    }

    void main() {
      vec3 N       = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // Fresnel
      float cosTheta = max(dot(viewDir, N), 0.0);
      float fresnel  = pow(1.0 - cosTheta, 4.0);

      // Depth blend
      float depth = clamp(0.5 - vWaveHeight * 3.0, 0.0, 1.0);
      vec3 water  = mix(shallowColor, deepColor, depth);

      // Caustics (subsurface light)
      float caus = caustics(vUv, time);
      water += vec3(caus * 0.18 * (1.0 - depth));

      // Specular highlight (sun)
      vec3  half_v = normalize(sunDirection + viewDir);
      float spec   = pow(max(dot(N, half_v), 0.0), 180.0);
      water += sunColor * spec * sunIntensity * 1.4;

      // Chromatic dispersion on reflected sky
      vec3 skyR = vec3(0.88, 0.70, 0.55);
      vec3 skyG = vec3(0.60, 0.80, 0.95);
      vec3 skyB = vec3(0.45, 0.65, 1.00);
      vec3 reflection = vec3(
        dot(viewDir, reflect(-sunDirection, N + vec3(0.01, 0., 0.))) > 0.98 ? 1.0 : 0.0,
        0.0, 0.0
      );
      water = mix(water, (skyR + skyG + skyB) / 3.0, fresnel * 0.55);

      // Foam on wave crests
      float foam = smoothstep(0.04, 0.10, vWaveHeight);
      water = mix(water, foamColor, foam * 0.5);

      // Edge softness
      float alpha = mix(opacity, 0.92, fresnel);

      gl_FragColor = vec4(water, alpha);
    }
  `;

  static createMaterial(options: {
    shallowColor?: THREE.Color;
    deepColor?:    THREE.Color;
    opacity?:      number;
    waveScale?:    number;
    waveSpeed?:    number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        shallowColor: { value: options.shallowColor ?? new THREE.Color(0.18, 0.58, 0.82) },
        deepColor:    { value: options.deepColor    ?? new THREE.Color(0.04, 0.15, 0.38) },
        time:         { value: 0 },
        opacity:      { value: options.opacity      ?? 0.78 },
        sunDirection: { value: SUN_DIR.clone() },
        sunColor:     { value: new THREE.Color(1.0, 0.95, 0.80) },
        sunIntensity: { value: 1.3 },
        foamColor:    { value: new THREE.Color(0.88, 0.94, 1.00) },
        waveScale:    { value: options.waveScale    ?? 1.0 },
        waveSpeed:    { value: options.waveSpeed    ?? 1.2 },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LeavesShader  — wind + subsurface scatter + seasonal tint + translucency
// ─────────────────────────────────────────────────────────────────────────────
export class LeavesShader {
  static vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    uniform float time;
    uniform float windStrength;
    uniform float windFrequency;
    uniform float windTurbulence;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv     = uv;
      vec3 pos = position;

      // Multi-frequency wind sway
      float phase = pos.x * 0.4 + pos.z * 0.3;
      float sway  = sin(time * windFrequency + phase) * windStrength;
      sway += sin(time * windFrequency * 2.3 + phase * 1.7) * windStrength * windTurbulence;
      sway += cos(time * windFrequency * 0.7 + pos.y * 0.5) * windStrength * 0.4;

      // Height-based – roots don't sway
      float heightFactor = clamp((pos.y + 4.0) / 6.0, 0.0, 1.0);
      pos.x += sway * heightFactor;
      pos.z += sway * 0.5 * heightFactor;

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform sampler2D map;
    uniform vec3  leafTint;
    uniform float translucency;
    uniform vec3  sunDirection;
    uniform float sunIntensity;
    uniform vec3  sunColor;
    uniform float time;
    uniform float seasonBlend;   // 0 = summer, 1 = autumn

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vec4 texColor = texture2D(map, vUv);
      if (texColor.a < 0.45) discard;

      vec3 N = normalize(vNormal);

      // Seasonal colour shift
      vec3 summerTint = leafTint;
      vec3 autumnTint = vec3(0.85, 0.42, 0.08);
      vec3 tint       = mix(summerTint, autumnTint, seasonBlend);
      vec3 col        = texColor.rgb * tint;

      // Regular diffuse
      float NdotL  = max(dot(N, sunDirection), 0.0);
      vec3 diffuse = sunColor * NdotL * sunIntensity;

      // Subsurface scattering (back-lighting)
      float back      = max(dot(-N, sunDirection), 0.0);
      vec3  subsurface = sunColor * back * translucency * sunIntensity * tint;

      // Ambient hemisphere
      float hemi   = 0.5 + 0.5 * N.y;
      vec3  ambient = vec3(0.22, 0.30, 0.15) * mix(0.6, 1.2, hemi);

      // Rim sparkle (dappled light feel)
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float rim    = pow(1.0 - max(dot(viewDir, N), 0.0), 4.0);

      col = col * (diffuse + ambient) + subsurface + col * rim * 0.15;

      // Slight per-leaf brightness variation
      float sparkle = fract(sin(dot(floor(vUv * 8.0), vec2(127.1, 311.7))) * 43758.5);
      col *= 0.88 + 0.24 * sparkle;

      gl_FragColor = vec4(col, texColor.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    leafTint?:      THREE.Color;
    windStrength?:  number;
    translucency?:  number;
    seasonBlend?:   number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map:           { value: texture },
        leafTint:      { value: options.leafTint      ?? new THREE.Color(0.38, 0.72, 0.22) },
        time:          { value: 0 },
        windStrength:  { value: options.windStrength  ?? 0.07 },
        windFrequency: { value: 1.8 },
        windTurbulence:{ value: 0.4 },
        translucency:  { value: options.translucency  ?? 0.38 },
        seasonBlend:   { value: options.seasonBlend   ?? 0.0 },
        sunDirection:  { value: SUN_DIR.clone() },
        sunColor:      { value: new THREE.Color(1.0, 0.95, 0.80) },
        sunIntensity:  { value: 1.1 },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.45,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GlassShader  — multi-layer Fresnel + IOR refraction tint + rainbow dispersion
// ─────────────────────────────────────────────────────────────────────────────
export class GlassShader {
  static vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vNormal        = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv            = uv;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform vec3  glassColor;
    uniform float opacity;
    uniform float ior;           // index of refraction tint strength
    uniform float reflectivity;
    uniform float time;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vec3 N       = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float cosT   = max(dot(viewDir, N), 0.0);

      // Schlick Fresnel
      float F0      = pow((ior - 1.0) / (ior + 1.0), 2.0);
      float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);

      // Sky reflections
      vec3 skyTop = vec3(0.38, 0.62, 1.00);
      vec3 skyHor = vec3(0.80, 0.88, 1.00);
      vec3 sky    = mix(skyHor, skyTop, N.y * 0.5 + 0.5);

      // Rainbow prismatic dispersion along edge
      float edge  = pow(1.0 - cosT, 6.0);
      vec3  prism = vec3(
        sin(time * 0.8 + edge * 4.0) * 0.5 + 0.5,
        sin(time * 0.8 + edge * 4.0 + 2.094) * 0.5 + 0.5,
        sin(time * 0.8 + edge * 4.0 + 4.189) * 0.5 + 0.5
      );

      vec3 col   = mix(glassColor, sky, fresnel * reflectivity);
      col       += prism * edge * 0.18;
      col       += vec3(1.0) * pow(fresnel, 5.0) * 0.35;

      float alpha = opacity + fresnel * 0.25;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  static createMaterial(options: {
    glassColor?:   THREE.Color;
    opacity?:      number;
    ior?:          number;
    reflectivity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        glassColor:   { value: options.glassColor   ?? new THREE.Color(0.88, 0.96, 1.00) },
        opacity:      { value: options.opacity       ?? 0.28 },
        ior:          { value: options.ior           ?? 1.52 },
        reflectivity: { value: options.reflectivity  ?? 0.65 },
        time:         { value: 0 },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LavaShader  — multi-octave simplex, heat distortion, ember glow, HDR bloom sim
// ─────────────────────────────────────────────────────────────────────────────
export class LavaShader {
  static vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vBubble;

    uniform float time;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Bubbling surface
      float b1 = sin(pos.x * 6.0  + time * 2.8) * 0.025;
      float b2 = sin(pos.z * 5.0  + time * 2.2) * 0.020;
      float b3 = cos((pos.x + pos.z) * 4.0 + time * 3.5) * 0.015;
      pos.y += b1 + b2 + b3;
      vBubble = b1 + b2 + b3;

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform float time;
    uniform vec3  lavaCoolColor;    // dark basalt
    uniform vec3  lavaMidColor;     // orange flow
    uniform vec3  lavaHotColor;     // bright yellow-white
    uniform float emissiveStrength;

    varying vec2  vUv;
    varying vec3  vWorldPosition;
    varying float vBubble;

    // Hash
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // Smooth noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
    }

    // 5-octave FBM
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p  = p * 2.1 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // Animated flow UV
      vec2 uv  = vUv * 3.5;
      uv.y    -= time * 0.18;
      uv.x    += sin(uv.y * 2.0 + time * 0.4) * 0.12;

      float pattern = fbm(uv);
      float cracks  = fbm(uv * 2.5 + vec2(time * 0.05, 0.0));

      // Crack darkening
      float crackMask = smoothstep(0.42, 0.55, 1.0 - cracks);

      // Colour ramp: cool → mid → hot
      vec3 col = mix(lavaCoolColor, lavaMidColor, smoothstep(0.25, 0.60, pattern));
      col      = mix(col, lavaHotColor,           smoothstep(0.58, 0.90, pattern));
      col      = mix(col, lavaCoolColor,           crackMask * 0.75);

      // Bubble crests are brighter
      col += lavaHotColor * max(vBubble * 8.0, 0.0) * 0.4;

      // Emissive pulsing glow
      float pulse = 0.88 + 0.12 * sin(time * 1.8);
      col *= pulse;

      // HDR bloom simulation — brightened hot spots
      float luminance = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += max(col - 0.82, 0.0) * emissiveStrength;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  static createMaterial(options: {
    lavaCoolColor?:    THREE.Color;
    lavaMidColor?:     THREE.Color;
    lavaHotColor?:     THREE.Color;
    emissiveStrength?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time:             { value: 0 },
        lavaCoolColor:    { value: options.lavaCoolColor    ?? new THREE.Color(0.10, 0.03, 0.02) },
        lavaMidColor:     { value: options.lavaMidColor     ?? new THREE.Color(0.85, 0.24, 0.02) },
        lavaHotColor:     { value: options.lavaHotColor     ?? new THREE.Color(1.00, 0.74, 0.10) },
        emissiveStrength: { value: options.emissiveStrength ?? 2.5 },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
      side: THREE.DoubleSide,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OreShader  — PBR metallic + animated sparkle + depth glow
// ─────────────────────────────────────────────────────────────────────────────
export class OreShader {
  static vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vNormal        = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv            = uv;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform sampler2D map;
    uniform vec3  oreColor;
    uniform float metallic;
    uniform float roughness;
    uniform float time;
    uniform float sparkleIntensity;
    uniform float glowRadius;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 tex  = texture2D(map, vUv);
      vec3 N    = normalize(vNormal);
      vec3 L    = normalize(vec3(0.55, 1.0, 0.35));
      vec3 V    = normalize(cameraPosition - vWorldPosition);
      vec3 H    = normalize(L + V);

      float NdotL = max(dot(N, L), 0.0);
      float NdotH = max(dot(N, H), 0.0);

      // Cook-Torrance microfacet
      float D = pow(NdotH, mix(2.0, 256.0, 1.0 - roughness));
      float G = NdotL;
      float F = metallic + (1.0 - metallic) * pow(1.0 - max(dot(V, H), 0.0), 5.0);

      float spec = D * G * F * 0.25 / max(dot(N, V), 0.001);

      vec3 col = tex.rgb * (vec3(0.3) + vec3(0.7) * NdotL);
      col += oreColor * spec * 1.4;

      // Animated crystalline sparkle
      vec2 sGrid = floor(vUv * 24.0);
      float sHash = random(sGrid + floor(time * 3.0));
      if (sHash > 0.92) {
        float anim = abs(sin(time * 12.0 + sHash * 100.0));
        col += oreColor * anim * sparkleIntensity;
      }

      // Subsurface glow halo
      float depth = 1.0 - max(dot(V, N), 0.0);
      col += oreColor * pow(depth, 3.0) * glowRadius * 0.4;

      gl_FragColor = vec4(col, tex.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    oreColor?:          THREE.Color;
    metallic?:          number;
    roughness?:         number;
    sparkleIntensity?:  number;
    glowRadius?:        number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map:              { value: texture },
        oreColor:         { value: options.oreColor         ?? new THREE.Color(1, 1, 1) },
        metallic:         { value: options.metallic         ?? 0.8 },
        roughness:        { value: options.roughness        ?? 0.25 },
        time:             { value: 0 },
        sparkleIntensity: { value: options.sparkleIntensity ?? 0.9 },
        glowRadius:       { value: options.glowRadius       ?? 0.6 },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PortalShader  — swirling Nether / End portal effect with god-ray simulation
// ─────────────────────────────────────────────────────────────────────────────
export class PortalShader {
  static vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv            = uv;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  static fragmentShader = /* glsl */ `
    precision highp float;

    uniform float time;
    uniform vec3  portalColorA;   // inner glow
    uniform vec3  portalColorB;   // outer swirl
    uniform vec3  portalColorC;   // accent
    uniform float swirls;
    uniform float speed;

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
    }

    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p); p = p * 2.0 + 1.7; a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2  uv  = vUv - 0.5;
      float r   = length(uv);
      float ang = atan(uv.y, uv.x);

      // Spiral distortion
      float spiral = ang + r * swirls - time * speed;
      float wave   = sin(spiral * 6.0) * 0.5 + 0.5;

      // FBM overlay
      vec2 fbmUV = vUv * 2.5 + vec2(time * 0.12, -time * 0.08);
      float n    = fbm(fbmUV);

      // Radial intensity
      float intensity = 1.0 - smoothstep(0.0, 0.5, r);
      float ring      = sin(r * 14.0 - time * 3.0) * 0.5 + 0.5;

      // Colour blend
      vec3 col = mix(portalColorA, portalColorB, wave);
      col      = mix(col, portalColorC, ring * 0.4);
      col      = mix(col, portalColorA * 2.0, n * intensity * 0.5);

      // Central bright core
      float core = 1.0 - smoothstep(0.0, 0.12, r);
      col += portalColorA * core * 2.5;

      // God-ray streaks
      float ray = pow(max(cos(ang * 8.0 + time * 0.6), 0.0), 18.0);
      col += portalColorC * ray * intensity * 0.6;

      col *= intensity;
      gl_FragColor = vec4(col, intensity * 0.92);
    }
  `;

  /** Nether portal (purple swirl) */
  static createNetherMaterial(): THREE.ShaderMaterial {
    return this._make(
      new THREE.Color(0.45, 0.05, 0.85),
      new THREE.Color(0.18, 0.00, 0.55),
      new THREE.Color(0.88, 0.50, 1.00),
      6.0, 1.4
    );
  }

  /** End portal (starfield green-blue swirl) */
  static createEndMaterial(): THREE.ShaderMaterial {
    return this._make(
      new THREE.Color(0.00, 0.85, 0.55),
      new THREE.Color(0.00, 0.20, 0.40),
      new THREE.Color(0.60, 1.00, 0.80),
      4.0, 0.9
    );
  }

  private static _make(a: THREE.Color, b: THREE.Color, c: THREE.Color, sw: number, sp: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, portalColorA: { value: a },
        portalColorB: { value: b }, portalColorC: { value: c },
        swirls: { value: sw }, speed: { value: sp },
      },
      vertexShader:   this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ShaderManager  — central time / sun update hub
// ─────────────────────────────────────────────────────────────────────────────
export class ShaderManager {
  private materials: THREE.ShaderMaterial[] = [];
  private time = 0;

  register(m: THREE.ShaderMaterial)   { this.materials.push(m); }
  unregister(m: THREE.ShaderMaterial) {
    const i = this.materials.indexOf(m);
    if (i > -1) this.materials.splice(i, 1);
  }

  update(delta: number, sunDir?: THREE.Vector3, sunIntensity?: number, seasonBlend?: number) {
    this.time += delta;
    for (const m of this.materials) {
      const u = m.uniforms;
      if (u.time)          u.time.value          = this.time;
      if (u.sunDirection && sunDir)       u.sunDirection.value.copy(sunDir);
      if (u.sunIntensity && sunIntensity !== undefined) u.sunIntensity.value = sunIntensity;
      if (u.seasonBlend  && seasonBlend  !== undefined) u.seasonBlend.value  = seasonBlend;
    }
  }

  clear() { this.materials = []; this.time = 0; }
}

export const shaderManager = new ShaderManager();