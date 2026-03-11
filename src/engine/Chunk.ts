import * as THREE from 'three';
import { BlockType, BLOCKS, isTransparent, isSolid } from '@/data/blocks';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/utils/constants';
import { textureAtlas } from './TextureAtlas';

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;
  needsUpdate = true;
  private geometry: THREE.BufferGeometry | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.blocks[this.getIndex(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[this.getIndex(x, y, z)] = type;
    this.needsUpdate = true;
  }

  private getIndex(x: number, y: number, z: number): number {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  generateMesh(neighbors: { px?: Chunk; nx?: Chunk; pz?: Chunk; nz?: Chunk }): THREE.Mesh | null {
    if (!this.needsUpdate && this.mesh) {
      return this.mesh;
    }

    // Dispose old mesh
    if (this.mesh) {
      this.geometry?.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }

    const { vertices, indices, uvs, colors, normals } = this.generateGeometryData(neighbors);
    
    if (vertices.length === 0) {
      this.mesh = null;
      this.needsUpdate = false;
      return null;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    this.geometry.setIndex(indices);

    const material = new THREE.MeshLambertMaterial({
      map: textureAtlas.getTexture(),
      vertexColors: true,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.needsUpdate = false;

    return this.mesh;
  }

  private generateGeometryData(neighbors: { px?: Chunk; nx?: Chunk; pz?: Chunk; nz?: Chunk }) {
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    let vertexCount = 0;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = this.getBlock(x, y, z);
          if (block === BlockType.AIR) continue;

          // Check each face
          this.addFaceIfVisible(x, y, z, block, 'px', neighbors.px, vertices, indices, uvs, colors, normals, vertexCount);
          this.addFaceIfVisible(x, y, z, block, 'nx', neighbors.nx, vertices, indices, uvs, colors, normals, vertexCount);
          this.addFaceIfVisible(x, y, z, block, 'py', undefined, vertices, indices, uvs, colors, normals, vertexCount);
          this.addFaceIfVisible(x, y, z, block, 'ny', undefined, vertices, indices, uvs, colors, normals, vertexCount);
          this.addFaceIfVisible(x, y, z, block, 'pz', neighbors.pz, vertices, indices, uvs, colors, normals, vertexCount);
          this.addFaceIfVisible(x, y, z, block, 'nz', neighbors.nz, vertices, indices, uvs, colors, normals, vertexCount);
        }
      }
    }

    return { vertices, indices, uvs, colors, normals };
  }

  private addFaceIfVisible(
    x: number, y: number, z: number,
    block: BlockType,
    dir: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz',
    neighborChunk: Chunk | undefined,
    vertices: number[],
    indices: number[],
    uvs: number[],
    colors: number[],
    normals: number[],
    vertexCount: number
  ): void {
    let neighbor: BlockType;
    let nx = x, ny = y, nz = z;

    switch (dir) {
      case 'px': nx = x + 1; break;
      case 'nx': nx = x - 1; break;
      case 'py': ny = y + 1; break;
      case 'ny': ny = y - 1; break;
      case 'pz': nz = z + 1; break;
      case 'nz': nz = z - 1; break;
    }

    // Get neighbor block
    if (nx < 0) neighbor = neighborChunk?.getBlock(CHUNK_SIZE - 1, ny, nz) ?? BlockType.AIR;
    else if (nx >= CHUNK_SIZE) neighbor = neighborChunk?.getBlock(0, ny, nz) ?? BlockType.AIR;
    else if (nz < 0) neighbor = neighborChunk?.getBlock(nx, ny, CHUNK_SIZE - 1) ?? BlockType.AIR;
    else if (nz >= CHUNK_SIZE) neighbor = neighborChunk?.getBlock(nx, ny, 0) ?? BlockType.AIR;
    else if (ny < 0 || ny >= CHUNK_HEIGHT) neighbor = BlockType.AIR;
    else neighbor = this.getBlock(nx, ny, nz);

    // Skip if neighbor is solid and opaque
    if (isSolid(neighbor) && !isTransparent(neighbor)) return;

    // Add face
    const uv = textureAtlas.getUVs(block);
    if (!uv) return;

    const { positions, normal, faceUVs } = this.getFaceData(x, y, z, dir, uv);

    // Add vertices
    for (let i = 0; i < 4; i++) {
      vertices.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      uvs.push(faceUVs[i * 2], faceUVs[i * 2 + 1]);
      normals.push(normal[0], normal[1], normal[2]);

      // Lighting
      const light = this.getLightLevel(dir);
      colors.push(light, light, light);
    }

    // Add indices
    const base = vertexCount + vertices.length / 3 - 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  private getFaceData(x: number, y: number, z: number, dir: string, uv: { u1: number; u2: number; v1: number; v2: number }) {
    const positions: number[] = [];
    let normal: number[] = [];
    let faceUVs: number[] = [];

    switch (dir) {
      case 'px': // East (+X)
        positions.push(x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1);
        normal = [1, 0, 0];
        faceUVs = [uv.u1, uv.v1, uv.u2, uv.v1, uv.u2, uv.v2, uv.u1, uv.v2];
        break;
      case 'nx': // West (-X)
        positions.push(x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z);
        normal = [-1, 0, 0];
        faceUVs = [uv.u2, uv.v1, uv.u1, uv.v1, uv.u1, uv.v2, uv.u2, uv.v2];
        break;
      case 'py': // Top (+Y)
        positions.push(x, y + 1, z, x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z);
        normal = [0, 1, 0];
        faceUVs = [uv.u1, uv.v1, uv.u2, uv.v1, uv.u2, uv.v2, uv.u1, uv.v2];
        break;
      case 'ny': // Bottom (-Y)
        positions.push(x, y, z + 1, x, y, z, x + 1, y, z, x + 1, y, z + 1);
        normal = [0, -1, 0];
        faceUVs = [uv.u1, uv.v2, uv.u2, uv.v2, uv.u2, uv.v1, uv.u1, uv.v1];
        break;
      case 'pz': // South (+Z)
        positions.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1);
        normal = [0, 0, 1];
        faceUVs = [uv.u1, uv.v1, uv.u2, uv.v1, uv.u2, uv.v2, uv.u1, uv.v2];
        break;
      case 'nz': // North (-Z)
        positions.push(x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z);
        normal = [0, 0, -1];
        faceUVs = [uv.u1, uv.v1, uv.u2, uv.v1, uv.u2, uv.v2, uv.u1, uv.v2];
        break;
    }

    return { positions, normal, faceUVs };
  }

  private getLightLevel(dir: string): number {
    const lightLevels: Record<string, number> = {
      'py': 1.0,    // Top - full light
      'px': 0.8,    // East
      'nx': 0.8,    // West
      'pz': 0.8,    // South
      'nz': 0.8,    // North
      'ny': 0.5,    // Bottom - darker
    };
    return lightLevels[dir] || 0.8;
  }

  dispose(): void {
    this.geometry?.dispose();
    if (this.mesh) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }
    this.mesh = null;
  }
}
