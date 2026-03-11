import * as THREE from 'three';

// Advanced shader material for blocks with better lighting and effects
export class AdvancedBlockShader {
  // Vertex shader for blocks with ambient occlusion and lighting
  static vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying float vAO;

    attribute float ao;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      vAO = ao;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Fragment shader with advanced lighting
  static fragmentShader = `
    uniform sampler2D map;
    uniform vec3 sunDirection;
    uniform vec3 sunColor;
    uniform float sunIntensity;
    uniform vec3 ambientColor;
    uniform float ambientIntensity;
    uniform float time;
    uniform bool isTransparent;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying float vAO;

    void main() {
      vec4 texColor = texture2D(map, vUv);

      if (texColor.a < 0.1) discard;

      // Ambient occlusion
      float ao = vAO > 0.0 ? vAO : 1.0;

      // Directional lighting (sun)
      float NdotL = max(dot(vNormal, sunDirection), 0.0);
      vec3 diffuse = sunColor * sunIntensity * NdotL;

      // Ambient lighting with slight color variation based on normal
      vec3 ambient = ambientColor * ambientIntensity;
      ambient += vNormal.y * 0.1 * ambientColor; // Top faces slightly brighter

      // Face-based shading (like Minecraft)
      float faceBrightness = 1.0;
      if (abs(vNormal.y) > 0.5) {
        faceBrightness = vNormal.y > 0.0 ? 1.0 : 0.5; // Top bright, bottom dark
      } else if (abs(vNormal.z) > 0.5) {
        faceBrightness = 0.8; // North/South faces
      } else {
        faceBrightness = 0.6; // East/West faces
      }

      // Combine lighting
      vec3 lighting = (diffuse + ambient) * faceBrightness * ao;

      // Apply lighting to texture
      vec3 finalColor = texColor.rgb * lighting;

      // Slight distance fog for depth
      float fogDistance = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(100.0, 250.0, fogDistance);
      vec3 fogColor = vec3(0.7, 0.8, 1.0);
      finalColor = mix(finalColor, fogColor, fogFactor * 0.3);

      gl_FragColor = vec4(finalColor, texColor.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    transparent?: boolean;
    sunDirection?: THREE.Vector3;
    sunColor?: THREE.Color;
    sunIntensity?: number;
    ambientColor?: THREE.Color;
    ambientIntensity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        sunDirection: { value: options.sunDirection || new THREE.Vector3(0.5, 1, 0.3).normalize() },
        sunColor: { value: options.sunColor || new THREE.Color(1, 0.98, 0.9) },
        sunIntensity: { value: options.sunIntensity ?? 1.0 },
        ambientColor: { value: options.ambientColor || new THREE.Color(0.4, 0.45, 0.5) },
        ambientIntensity: { value: options.ambientIntensity ?? 0.4 },
        time: { value: 0 },
        isTransparent: { value: options.transparent ?? false },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: options.transparent ?? false,
      side: THREE.FrontSide,
      depthWrite: !options.transparent,
    });
  }
}

// Water shader with animated waves and reflections
export class WaterShader {
  static vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying float vWave;

    uniform float time;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;

      // Animated wave displacement
      vec3 pos = position;
      float wave1 = sin(position.x * 2.0 + time * 2.0) * 0.05;
      float wave2 = sin(position.z * 3.0 + time * 1.5) * 0.03;
      pos.y += wave1 + wave2;
      vWave = wave1 + wave2;

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = `
    uniform vec3 waterColor;
    uniform vec3 deepWaterColor;
    uniform float time;
    uniform float opacity;
    uniform vec3 sunDirection;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying float vWave;

    void main() {
      // Animated caustics pattern
      float caustics = sin(vUv.x * 20.0 + time) * sin(vUv.y * 20.0 + time * 0.7) * 0.5 + 0.5;

      // Depth-based color mixing
      vec3 color = mix(deepWaterColor, waterColor, 0.5 + vWave * 2.0);

      // Specular highlight (sun reflection)
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 reflectDir = reflect(-sunDirection, vNormal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);

      // Fresnel effect for edge highlighting
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      // Combine effects
      color += vec3(1.0) * spec * 0.5;
      color += caustics * 0.1;
      color = mix(color, vec3(0.8, 0.9, 1.0), fresnel * 0.3);

      gl_FragColor = vec4(color, opacity);
    }
  `;

  static createMaterial(options: {
    waterColor?: THREE.Color;
    deepWaterColor?: THREE.Color;
    opacity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        waterColor: { value: options.waterColor || new THREE.Color(0.2, 0.5, 0.8) },
        deepWaterColor: { value: options.deepWaterColor || new THREE.Color(0.1, 0.2, 0.4) },
        time: { value: 0 },
        opacity: { value: options.opacity ?? 0.7 },
        sunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
}

// Leaves shader with wind animation and translucency
export class LeavesShader {
  static vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    uniform float time;
    uniform float windStrength;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;

      vec3 pos = position;

      // Wind animation - sway effect
      float windOffset = sin(time * 2.0 + position.x * 0.5 + position.z * 0.3) * windStrength;
      windOffset += sin(time * 3.0 + position.y * 0.7) * windStrength * 0.5;
      pos.x += windOffset;
      pos.z += windOffset * 0.5;

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = `
    uniform sampler2D map;
    uniform vec3 leafColor;
    uniform float translucency;
    uniform vec3 sunDirection;
    uniform float sunIntensity;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vec4 texColor = texture2D(map, vUv);

      if (texColor.a < 0.5) discard;

      // Apply leaf color tint
      vec3 color = texColor.rgb * leafColor;

      // Subsurface scattering simulation (translucency)
      float backLight = max(dot(-vNormal, sunDirection), 0.0);
      vec3 subsurface = leafColor * backLight * translucency * sunIntensity;

      // Regular diffuse lighting
      float NdotL = max(dot(vNormal, sunDirection), 0.0);
      vec3 diffuse = color * NdotL * sunIntensity;

      // Ambient
      vec3 ambient = color * 0.4;

      // Combine
      vec3 finalColor = diffuse + ambient + subsurface;

      gl_FragColor = vec4(finalColor, texColor.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    leafColor?: THREE.Color;
    windStrength?: number;
    translucency?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        leafColor: { value: options.leafColor || new THREE.Color(0.4, 0.7, 0.2) },
        time: { value: 0 },
        windStrength: { value: options.windStrength ?? 0.05 },
        translucency: { value: options.translucency ?? 0.3 },
        sunDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
        sunIntensity: { value: 1.0 },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
  }
}

// Glass shader with reflections and refraction
export class GlassShader {
  static vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  static fragmentShader = `
    uniform vec3 glassColor;
    uniform float opacity;
    uniform float reflectivity;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // Fresnel effect
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      // Reflection color (simplified - just use sky color approximation)
      vec3 skyColor = vec3(0.5, 0.7, 1.0);
      vec3 reflection = skyColor * fresnel * reflectivity;

      // Combine glass color with reflection
      vec3 color = mix(glassColor, reflection, fresnel * 0.5);

      // Edge highlighting
      color += vec3(1.0) * pow(fresnel, 4.0) * 0.2;

      gl_FragColor = vec4(color, opacity + fresnel * 0.2);
    }
  `;

  static createMaterial(options: {
    glassColor?: THREE.Color;
    opacity?: number;
    reflectivity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        glassColor: { value: options.glassColor || new THREE.Color(0.9, 0.95, 1.0) },
        opacity: { value: options.opacity ?? 0.3 },
        reflectivity: { value: options.reflectivity ?? 0.5 },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
}

// Lava shader with animated glow and flow
export class LavaShader {
  static vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    uniform float time;

    void main() {
      vUv = uv;

      vec3 pos = position;
      // Subtle bubbling effect
      pos.y += sin(position.x * 5.0 + time * 3.0) * 0.02;
      pos.y += sin(position.z * 4.0 + time * 2.5) * 0.02;

      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  static fragmentShader = `
    uniform float time;
    uniform vec3 lavaColor;
    uniform vec3 glowColor;

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Simplex noise function for flow pattern
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      // Animated flow pattern
      vec2 flowUV = vUv * 4.0;
      flowUV.y -= time * 0.2;

      float noise1 = snoise(flowUV + time * 0.1) * 0.5 + 0.5;
      float noise2 = snoise(flowUV * 2.0 - time * 0.15) * 0.5 + 0.5;
      float noise3 = snoise(flowUV * 0.5 + time * 0.05) * 0.5 + 0.5;

      float pattern = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;

      // Color mixing based on pattern
      vec3 darkLava = lavaColor * 0.3;
      vec3 brightLava = glowColor;

      vec3 color = mix(darkLava, brightLava, pattern);

      // Add pulsing glow
      float pulse = sin(time * 2.0) * 0.1 + 0.9;
      color *= pulse;

      // Emissive glow
      color += glowColor * pattern * 0.3;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  static createMaterial(options: {
    lavaColor?: THREE.Color;
    glowColor?: THREE.Color;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lavaColor: { value: options.lavaColor || new THREE.Color(0.8, 0.2, 0.0) },
        glowColor: { value: options.glowColor || new THREE.Color(1.0, 0.6, 0.0) },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      side: THREE.DoubleSide,
    });
  }
}

// Ore shader with sparkle effect
export class OreShader {
  static vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  static fragmentShader = `
    uniform sampler2D map;
    uniform vec3 oreColor;
    uniform float time;
    uniform float sparkleIntensity;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec4 texColor = texture2D(map, vUv);

      // Basic lighting
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
      float NdotL = max(dot(vNormal, lightDir), 0.0);

      vec3 color = texColor.rgb * (0.4 + NdotL * 0.6);

      // Sparkle effect on ore
      vec2 sparkleUV = floor(vUv * 16.0);
      float sparkle = random(sparkleUV + floor(time * 2.0));
      if (sparkle > 0.95) {
        float sparkleAnim = sin(time * 10.0 + sparkle * 100.0) * 0.5 + 0.5;
        color += oreColor * sparkleAnim * sparkleIntensity;
      }

      gl_FragColor = vec4(color, texColor.a);
    }
  `;

  static createMaterial(texture: THREE.Texture, options: {
    oreColor?: THREE.Color;
    sparkleIntensity?: number;
  } = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        oreColor: { value: options.oreColor || new THREE.Color(1, 1, 1) },
        time: { value: 0 },
        sparkleIntensity: { value: options.sparkleIntensity ?? 0.5 },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
  }
}

// Shader manager for updating all shader uniforms
export class ShaderManager {
  private shaderMaterials: THREE.ShaderMaterial[] = [];
  private time = 0;

  registerMaterial(material: THREE.ShaderMaterial) {
    this.shaderMaterials.push(material);
  }

  unregisterMaterial(material: THREE.ShaderMaterial) {
    const index = this.shaderMaterials.indexOf(material);
    if (index > -1) {
      this.shaderMaterials.splice(index, 1);
    }
  }

  update(delta: number, sunDirection?: THREE.Vector3, sunIntensity?: number) {
    this.time += delta;

    for (const material of this.shaderMaterials) {
      if (material.uniforms.time) {
        material.uniforms.time.value = this.time;
      }
      if (sunDirection && material.uniforms.sunDirection) {
        material.uniforms.sunDirection.value.copy(sunDirection);
      }
      if (sunIntensity !== undefined && material.uniforms.sunIntensity) {
        material.uniforms.sunIntensity.value = sunIntensity;
      }
    }
  }

  clear() {
    this.shaderMaterials = [];
    this.time = 0;
  }
}

export const shaderManager = new ShaderManager();
