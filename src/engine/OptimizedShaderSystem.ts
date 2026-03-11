import * as THREE from 'three';
import { MemoryManager } from '@/utils/MemoryManager';

// Optimized shader system with alpha testing and performance optimizations
export class OptimizedShaderSystem {
  private static instance: OptimizedShaderSystem;
  
  // Shader cache
  private shaderCache: Map<string, THREE.ShaderMaterial> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  
  // Shader configurations
  private shaderConfigs: Map<string, any> = new Map();
  
  // Performance settings
  private enableAlphaTest: boolean = true;
  private alphaTestThreshold: number = 0.5;
  private enableFrustumCulling: boolean = true;
  private maxLights: number = 4;
  
  private constructor() {
    this.initializeShaderConfigs();
  }
  
  static getInstance(): OptimizedShaderSystem {
    if (!OptimizedShaderSystem.instance) {
      OptimizedShaderSystem.instance = new OptimizedShaderSystem();
    }
    return OptimizedShaderSystem.instance;
  }
  
  private initializeShaderConfigs(): void {
    // Block shader with alpha testing
    this.shaderConfigs.set('block', {
      uniforms: {
        time: { value: 0 },
        lightIntensity: { value: 1.0 },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: 10 },
        fogFar: { value: 100 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        uniform float time;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          
          // Fog calculation
          vFogDepth = length(mvPosition.xyz);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightIntensity;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          // Base color from vertex colors
          vec3 color = gl_FrontFacing ? gl_FragColor.rgb : gl_FragColor.rgb * 0.8;
          
          // Simple lighting
          float lightFactor = max(dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))), 0.3);
          color *= lightFactor * lightIntensity;
          
          // Fog
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          color = mix(color, fogColor, fogFactor);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    
    // Transparent block shader with alpha testing
    this.shaderConfigs.set('transparent', {
      uniforms: {
        time: { value: 0 },
        lightIntensity: { value: 1.0 },
        alphaTestThreshold: { value: this.alphaTestThreshold },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: 10 },
        fogFar: { value: 100 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          
          vFogDepth = length(mvPosition.xyz);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
        fragmentShader: `
        uniform vec3 lightIntensity;
        uniform float alphaTestThreshold;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          vec3 color = gl_FrontFacing ? gl_FragColor.rgb : gl_FragColor.rgb * 0.8;
          
          // Alpha testing for performance
          if (gl_FragColor.a < alphaTestThreshold) {
            discard;
          }
          
          // Proper lighting calculation with normalized normals
          vec3 normalizedNormal = normalize(vNormal);
          float lightFactor = max(dot(normalizedNormal, normalize(vec3(1.0, 1.0, 1.0))), 0.3);
          color *= lightFactor * lightIntensity;
          
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          color = mix(color, fogColor, fogFactor);
          
          gl_FragColor = vec4(color, gl_FragColor.a);
        }
      `,
      transparent: true
    });
    
    // Water shader with optimized transparency
    this.shaderConfigs.set('water', {
      uniforms: {
        time: { value: 0 },
        lightIntensity: { value: 1.0 },
        waveSpeed: { value: 0.5 },
        waveHeight: { value: 0.1 },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: 10 },
        fogFar: { value: 100 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          
          vFogDepth = length(mvPosition.xyz);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightIntensity;
        uniform float waveSpeed;
        uniform float waveHeight;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          // Animated water effect
          vec2 waveUv = vUv + sin(time * waveSpeed + vWorldPosition.x * 0.1) * waveHeight;
          float wave = sin(waveUv.x * 10.0) * cos(waveUv.y * 10.0) * 0.1;
          
          vec3 waterColor = vec3(0.1, 0.3, 0.8);
          waterColor += wave * 0.2;
          
          float lightFactor = max(dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))), 0.3);
          waterColor *= lightFactor * lightIntensity;
          
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          waterColor = mix(waterColor, fogColor, fogFactor);
          
          gl_FragColor = vec4(waterColor, 0.7);
        }
      `,
      transparent: true
    });
    
    // Foliage shader with alpha testing
    this.shaderConfigs.set('foliage', {
      uniforms: {
        time: { value: 0 },
        lightIntensity: { value: 1.0 },
        alphaTestThreshold: { value: 0.3 },
        windStrength: { value: 0.1 },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: 10 },
        fogFar: { value: 100 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          
          vFogDepth = length(mvPosition.xyz);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightIntensity;
        uniform float alphaTestThreshold;
        uniform float windStrength;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vFogDepth;
        
        void main() {
          // Wind animation
          float wind = sin(time + vWorldPosition.x * 0.1) * windStrength;
          vec2 animatedUv = vUv + vec2(wind * 0.1, 0.0);
          
          // Alpha testing for foliage
          float alpha = gl_FragColor.a;
          if (alpha < alphaTestThreshold) {
            discard;
          }
          
          vec3 color = gl_FragColor.rgb;
          
          // Slight color variation
          color += sin(animatedUv.x * 20.0) * 0.05;
          color += cos(animatedUv.y * 20.0) * 0.05;
          
          float lightFactor = max(dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))), 0.3);
          color *= lightFactor * lightIntensity;
          
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          color = mix(color, fogColor, fogFactor);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true
    });
  }
  
  // Get or create shader material
  getMaterial(type: string, options: any = {}): THREE.Material {
    const cacheKey = `${type}_${JSON.stringify(options)}`;
    
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey)!;
    }
    
    const config = this.shaderConfigs.get(type);
    if (!config) {
      // Fallback to basic material
      return new THREE.MeshLambertMaterial(options);
    }
    
    let material: THREE.Material;
    
    if (config.transparent) {
      material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(config.uniforms),
        vertexShader: config.vertexShader,
        fragmentShader: config.fragmentShader,
        transparent: true,
        alphaTest: this.enableAlphaTest ? 0.5 : undefined,
        side: THREE.DoubleSide,
        vertexColors: true
      });
    } else {
      material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(config.uniforms),
        vertexShader: config.vertexShader,
        fragmentShader: config.fragmentShader,
        transparent: false,
        side: THREE.FrontSide,
        vertexColors: true
      });
    }
    
    // Apply options
    Object.assign(material, options);
    
    this.materialCache.set(cacheKey, material);
    return material;
  }
  
  // Update shader uniforms
  updateShaders(time: number): void {
    for (const material of this.materialCache.values()) {
      if (material instanceof THREE.ShaderMaterial) {
        if (material.uniforms.time) {
          material.uniforms.time.value = time;
        }
      }
    }
  }
  
  // Performance settings
  setAlphaTest(enabled: boolean, threshold: number = 0.5): void {
    this.enableAlphaTest = enabled;
    this.alphaTestThreshold = threshold;
    
    // Update existing transparent materials
    for (const material of this.materialCache.values()) {
      if (material instanceof THREE.ShaderMaterial && material.transparent) {
        (material as any).alphaTest = enabled ? threshold : undefined;
        material.needsUpdate = true;
      }
    }
  }
  
  setLightingSettings(maxLights: number, intensity: number): void {
    this.maxLights = maxLights;
    
    for (const material of this.materialCache.values()) {
      if (material instanceof THREE.ShaderMaterial) {
        if (material.uniforms.lightIntensity) {
          material.uniforms.lightIntensity.value = intensity;
        }
      }
    }
  }
  
  // Memory management
  clearCache(): void {
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
    this.shaderCache.clear();
  }
  
  // Get cache statistics
  getCacheStats(): {
    materialCount: number;
    shaderCount: number;
    totalMemory: number;
  } {
    return {
      materialCount: this.materialCache.size,
      shaderCount: this.shaderCache.size,
      totalMemory: this.estimateMemoryUsage()
    };
  }
  
  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage
    return this.materialCache.size * 1024 + this.shaderCache.size * 512;
  }
}

// Optimized material factory
export class OptimizedMaterialFactory {
  private static memoryManager = MemoryManager.getInstance();
  private static shaderSystem = OptimizedShaderSystem.getInstance();
  
  static createBlockMaterial(blockType: number, isTransparent: boolean = false): THREE.Material {
    const type = isTransparent ? 'transparent' : 'block';
    
    // Try to get from memory pool first
    const material = this.memoryManager.getMaterial(
      type,
      () => this.shaderSystem.getMaterial(type)
    );
    
    return material;
  }
  
  static createWaterMaterial(): THREE.Material {
    return this.memoryManager.getMaterial(
      'water',
      () => this.shaderSystem.getMaterial('water')
    );
  }
  
  static createFoliageMaterial(): THREE.Material {
    return this.memoryManager.getMaterial(
      'foliage',
      () => this.shaderSystem.getMaterial('foliage')
    );
  }
  
  static releaseMaterial(material: THREE.Material, type: string): void {
    this.memoryManager.releaseMaterial(material, type);
  }
}

// Performance monitoring for shaders
export class ShaderPerformanceMonitor {
  private static instance: ShaderPerformanceMonitor;
  
  private frameTimes: Map<string, number[]> = new Map();
  private renderCalls: Map<string, number> = new Map();
  private maxHistory: number = 60;
  
  static getInstance(): ShaderPerformanceMonitor {
    if (!ShaderPerformanceMonitor.instance) {
      ShaderPerformanceMonitor.instance = new ShaderPerformanceMonitor();
    }
    return ShaderPerformanceMonitor.instance;
  }
  
  recordRenderTime(shaderType: string, time: number): void {
    if (!this.frameTimes.has(shaderType)) {
      this.frameTimes.set(shaderType, []);
    }
    
    const times = this.frameTimes.get(shaderType)!;
    times.push(time);
    
    if (times.length > this.maxHistory) {
      times.shift();
    }
    
    if (!this.renderCalls.has(shaderType)) {
      this.renderCalls.set(shaderType, 0);
    }
    this.renderCalls.set(shaderType, this.renderCalls.get(shaderType)! + 1);
  }
  
  getAverageRenderTime(shaderType: string): number {
    const times = this.frameTimes.get(shaderType);
    if (!times || times.length === 0) return 0;
    
    return times.reduce((a: number, b: number) => a + b, 0) / times.length;
  }
  
  getRenderStats(): Record<string, { averageTime: number; calls: number }> {
    const stats: Record<string, any> = {};
    
    for (const [type, times] of this.frameTimes) {
      stats[type] = {
        averageTime: this.getAverageRenderTime(type),
        calls: this.renderCalls.get(type) || 0
      };
    }
    
    return stats;
  }
  
  reset(): void {
    this.frameTimes.clear();
    this.renderCalls.clear();
  }
}

export default OptimizedShaderSystem.getInstance();
