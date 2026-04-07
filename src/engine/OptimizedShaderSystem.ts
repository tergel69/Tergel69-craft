import * as THREE from 'three';
// Assuming MemoryManager exists as per your import structure
import { MemoryManager } from '@/utils/MemoryManager'; 

/**
 * Optimized Shader System
 * 
 * Consolidates all shader logic into a single, robust system.
 * Supports Vertex Colors, Texture Atlas, and Custom Effects.
 */
export class OptimizedShaderSystem {
  private static instance: OptimizedShaderSystem;
  
  private materialCache: Map<string, THREE.Material> = new Map();
  private shaderConfigs: Map<string, IShaderConfig> = new Map();
  
  // Global shader settings
  private settings = {
    fogColor: new THREE.Color(0x87CEEB),
    fogNear: 50,
    fogFar: 200,
    sunDirection: new THREE.Vector3(0.5, 1.0, 0.3).normalize(),
    sunIntensity: 1.2,
    ambientIntensity: 0.4
  };

  private constructor() {
    this.initializeShaderConfigs();
  }
  
  public static getInstance(): OptimizedShaderSystem {
    if (!OptimizedShaderSystem.instance) {
      OptimizedShaderSystem.instance = new OptimizedShaderSystem();
    }
    return OptimizedShaderSystem.instance;
  }

  /**
   * Defines the GLSL shaders with improved lighting and structure.
   */
  private initializeShaderConfigs(): void {
    
    // Common GLSL chunks to avoid code repetition
    const commonVertexHeader = `
      attribute vec3 color; // Three.js vertex colors
      varying vec3 vColor;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vFogDepth;
    `;

    const commonVertexMain = `
      void main() {
        vColor = color;
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        vec4 mvPosition = viewMatrix * worldPosition;
        vFogDepth = -mvPosition.z; // Linear fog depth
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const commonFragmentHeader = `
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform float uAmbientIntensity;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uTime;

      varying vec3 vColor;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vFogDepth;
      
      // Simple noise function for water/foliage
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    `;

    const applyFogChunk = `
      vec3 applyFog(vec3 color) {
        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        return mix(color, uFogColor, fogFactor);
      }
    `;

    const lightingChunk = `
      vec3 calculateLight(vec3 normal, vec3 baseColor, float roughness) {
        // Directional Sun Light
        float NdotL = max(dot(normal, uSunDirection), 0.0);
        vec3 diffuse = uSunColor * NdotL * uSunIntensity;
        
        // Simple Ambient
        vec3 ambient = vec3(1.0) * uAmbientIntensity;
        
        // Fake Indirect Diffuse (bottom darker, top lighter)
        float hemisphere = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        ambient *= mix(vec3(0.6, 0.6, 0.7), vec3(1.0), hemisphere);
        
        return baseColor * (diffuse + ambient);
      }
    `;

    // 1. SOLID BLOCK SHADER
    this.shaderConfigs.set('block', {
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.settings.sunDirection },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        uSunIntensity: { value: this.settings.sunIntensity },
        uAmbientIntensity: { value: this.settings.ambientIntensity },
        uFogColor: { value: this.settings.fogColor },
        uFogNear: { value: this.settings.fogNear },
        uFogFar: { value: this.settings.fogFar },
        map: { value: null } // Texture placeholder
      },
      vertexShader: `
        ${commonVertexHeader}
        ${commonVertexMain}
      `,
      fragmentShader: `
        ${commonFragmentHeader}
        uniform sampler2D map;
        
        ${lightingChunk}
        ${applyFogChunk}
        
        void main() {
          vec4 texColor = texture2D(map, vUv);
          if(texColor.a < 0.1) discard;
          
          // Multiply texture by vertex color (AO, biome tint)
          vec3 color = texColor.rgb * vColor;
          
          // Apply lighting
          color = calculateLight(normalize(vNormal), color, 1.0);
          
          // Apply Fog
          color = applyFog(color);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    // 2. TRANSPARENT / CUTOUT SHADER (Leaves, Glass panes)
    this.shaderConfigs.set('transparent', {
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.settings.sunDirection },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        uSunIntensity: { value: this.settings.sunIntensity },
        uAmbientIntensity: { value: this.settings.ambientIntensity },
        uFogColor: { value: this.settings.fogColor },
        uFogNear: { value: this.settings.fogNear },
        uFogFar: { value: this.settings.fogFar },
        map: { value: null },
        uAlphaTest: { value: 0.5 }
      },
      vertexShader: `
        ${commonVertexHeader}
        ${commonVertexMain}
      `,
      fragmentShader: `
        ${commonFragmentHeader}
        uniform sampler2D map;
        uniform float uAlphaTest;
        
        ${lightingChunk}
        ${applyFogChunk}
        
        void main() {
          vec4 texColor = texture2D(map, vUv);
          
          // Alpha Testing
          if(texColor.a < uAlphaTest) discard;
          
          vec3 color = texColor.rgb * vColor;
          color = calculateLight(normalize(vNormal), color, 1.0);
          color = applyFog(color);
          
          gl_FragColor = vec4(color, texColor.a);
        }
      `,
      transparent: false, // Alpha test usually doesn't need blending
      side: THREE.DoubleSide
    });

    // 3. WATER SHADER (Dynamic, Reflective, Transparent)
    this.shaderConfigs.set('water', {
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.settings.sunDirection },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        uSunIntensity: { value: this.settings.sunIntensity },
        uAmbientIntensity: { value: this.settings.ambientIntensity },
        uFogColor: { value: this.settings.fogColor },
        uFogNear: { value: this.settings.fogNear },
        uFogFar: { value: this.settings.fogFar },
        uWaterColor: { value: new THREE.Color(0x006994) },
        uWaterDeepColor: { value: new THREE.Color(0x003366) }
      },
      vertexShader: `
        ${commonVertexHeader}
        uniform float uTime;
        
        void main() {
          vColor = color;
          vUv = uv;
          
          // Simple wave displacement
          vec3 pos = position;
          float wave = sin(pos.x * 2.0 + uTime * 2.0) * 0.05;
          wave += sin(pos.z * 3.0 + uTime * 1.5) * 0.03;
          pos.y += wave;
          
          vNormal = normalize(normalMatrix * normal); // Recalculate normal for lighting would be better, but approximating here
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
          vec4 mvPosition = viewMatrix * vec4(vWorldPosition, 1.0);
          vFogDepth = -mvPosition.z;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${commonFragmentHeader}
        uniform vec3 uWaterColor;
        uniform vec3 uWaterDeepColor;
        
        ${applyFogChunk}
        
        void main() {
          // Procedural normals for waves
          float time = uTime * 0.5;
          vec2 uv1 = vUv * 3.0 + time;
          float n1 = hash(uv1);
          vec2 uv2 = vUv * 5.0 - time * 0.5;
          float n2 = hash(uv2);
          float waveN = (n1 + n2) / 2.0 - 0.5; // -0.5 to 0.5
          
          vec3 normal = normalize(vNormal + vec3(waveN, 0.0, waveN));
          
          // Fresnel effect (more reflective at angles)
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
          
          // Lighting
          float NdotL = max(dot(normal, uSunDirection), 0.0);
          
          // Specular (Sun reflection)
          vec3 reflectDir = reflect(-uSunDirection, normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
          
          // Depth color mixing
          vec3 color = mix(uWaterColor, uWaterDeepColor, 0.5 + fresnel);
          color += vec3(1.0, 0.95, 0.8) * spec * 2.0; // Specular highlight
          color = mix(color, uFogColor, fresnel * 0.4); // Reflection of sky/fog
          
          // Fog
          color = applyFog(color);
          
          // Transparency logic: clearer when looking straight down
          float alpha = 0.6 + fresnel * 0.3;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    // 4. FOLIAGE SHADER (Windy, SSS)
    this.shaderConfigs.set('foliage', {
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.settings.sunDirection },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        uSunIntensity: { value: this.settings.sunIntensity },
        uAmbientIntensity: { value: this.settings.ambientIntensity },
        uFogColor: { value: this.settings.fogColor },
        uFogNear: { value: this.settings.fogNear },
        uFogFar: { value: this.settings.fogFar },
        map: { value: null },
        uWindStrength: { value: 0.2 }
      },
      vertexShader: `
        ${commonVertexHeader}
        uniform float uTime;
        uniform float uWindStrength;
        
        void main() {
          vColor = color;
          vUv = uv;
          
          // Wind Animation
          vec3 pos = position;
          float wind = sin(uTime * 2.0 + pos.x * 2.0 + pos.z * 2.0) * uWindStrength;
          // Top vertices move more than bottom
          wind *= uv.y; 
          pos.x += wind;
          pos.z += wind * 0.5;
          
          vNormal = normalize(normalMatrix * normal);
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
          vec4 mvPosition = viewMatrix * vec4(vWorldPosition, 1.0);
          vFogDepth = -mvPosition.z;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${commonFragmentHeader}
        uniform sampler2D map;
        
        ${lightingChunk}
        ${applyFogChunk}
        
        void main() {
          vec4 texColor = texture2D(map, vUv);
          if(texColor.a < 0.5) discard;
          
          vec3 color = texColor.rgb * vColor;
          vec3 normal = normalize(vNormal);
          
          // Subsurface Scattering Approximation (Rim Light)
          // Light passing through the leaf
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float rim = 1.0 - max(dot(viewDir, normal), 0.0);
          vec3 subsurface = uSunColor * pow(rim, 2.0) * 0.5 * uSunIntensity;
          
          // Standard Light
          float NdotL = max(dot(normal, uSunDirection), 0.0);
          vec3 diffuse = color * NdotL * uSunIntensity;
          
          // Ambient
          vec3 ambient = color * uAmbientIntensity * 0.6;
          
          color = diffuse + ambient + subsurface * color; // Tint subsurface by leaf color
          
          color = applyFog(color);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: false,
      side: THREE.DoubleSide
    });
  }

  /**
   * Creates or retrieves a material from the cache.
   */
  // Change the return type to THREE.Material to allow for fallbacks
  public getMaterial(type: string, texture?: THREE.Texture): THREE.Material {
    // Use texture UUID for caching if texture is provided
    const cacheKey = texture ? `${type}_${texture.uuid}` : type;
    
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey)!;
    }

    const config = this.shaderConfigs.get(type);
    
    // Fallback: Return a standard material if no shader config is found
    if (!config) {
      console.warn(`Shader config for "${type}" not found. Creating MeshStandardMaterial fallback.`);
      
      // This returns a MeshStandardMaterial, which is valid because the method returns THREE.Material
      const fallbackMat = new THREE.MeshStandardMaterial({ 
        map: texture,
        vertexColors: true 
      });
      
      this.materialCache.set(cacheKey, fallbackMat);
      return fallbackMat;
    }

    // Standard ShaderMaterial creation
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(config.uniforms),
      vertexShader: config.vertexShader,
      fragmentShader: config.fragmentShader,
      transparent: config.transparent || false,
      side: config.side || THREE.FrontSide,
      vertexColors: true,
      // alphaTest is usually handled inside the shader logic now, 
      // but you can set it here if needed for internal optimizations.
    });

    if (texture) {
      material.uniforms.map = { value: texture };
    }

    this.materialCache.set(cacheKey, material);
    return material;
  }

  /**
   * Updates global uniforms for all cached materials (Time, Lighting, Fog).
   */
  public updateGlobalUniforms(time: number, camera: THREE.Camera): void {
    // Update Time
    for (const [, material] of this.materialCache) {
      if (material instanceof THREE.ShaderMaterial && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }
    
    // Could update sun direction here based on day/night cycle
  }
  
  /**
   * Updates the fog settings for all materials.
   */
  public setFog(color: THREE.Color, near: number, far: number): void {
    this.settings.fogColor.copy(color);
    this.settings.fogNear = near;
    this.settings.fogFar = far;

    for (const [, material] of this.materialCache) {
      if (material instanceof THREE.ShaderMaterial) {
        if(material.uniforms.uFogColor) material.uniforms.uFogColor.value = color;
        if(material.uniforms.uFogNear) material.uniforms.uFogNear.value = near;
        if(material.uniforms.uFogFar) material.uniforms.uFogFar.value = far;
      }
    }
  }

  public clearCache(): void {
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
  }
}

// --- Advanced Factory (Cleaned Up) ---

export class OptimizedMaterialFactory {
  private static shaderSystem = OptimizedShaderSystem.getInstance();

  static createBlockMaterial(texture: THREE.Texture): THREE.Material {
    return this.shaderSystem.getMaterial('block', texture);
  }

  static createWaterMaterial(): THREE.Material {
    return this.shaderSystem.getMaterial('water');
  }

  static createFoliageMaterial(texture: THREE.Texture): THREE.Material {
    return this.shaderSystem.getMaterial('foliage', texture);
  }
  
  static createTransparentMaterial(texture: THREE.Texture): THREE.Material {
    return this.shaderSystem.getMaterial('transparent', texture);
  }
}

// --- Interfaces ---

interface IShaderConfig {
  uniforms: { [key: string]: THREE.IUniform };
  vertexShader: string;
  fragmentShader: string;
  transparent?: boolean;
  side?: THREE.Side;
}

export default OptimizedShaderSystem.getInstance();