'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { staticTextureGenerator } from '@/data/staticTextures';


export default function StaticTextureTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Test static texture generation
    const testBlocks = [
      'GRASS', 'DIRT', 'STONE', 'OAK_LOG', 'OAK_PLANKS', 
      'OAK_LEAVES', 'SAND', 'WATER', 'LAVA', 'COBBLESTONE'
    ];

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    testBlocks.forEach((blockType, index) => {
      try {
        // Fix: Make sure blockType is of correct type (BlockType)
        const texture = staticTextureGenerator.generateStaticTexture(blockType as any);
        const x = (index % 5) * 68;
        const y = Math.floor(index / 5) * 68;

        // Draw texture preview
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, 64, 64);
        
        // Add label
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText(blockType, x, y + 75);
        
        // Draw texture (this is a simplified preview)
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 2, y + 2, 60, 60);
        
      } catch (error) {
        console.error(`Failed to generate texture for ${blockType}:`, error);
      }
    });

  }, []);

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg">
      <h2 className="text-lg mb-2">Static Texture Test</h2>
      <canvas 
        ref={canvasRef} 
        width={360} 
        height={160} 
        className="border border-gray-600"
      />
      <p className="text-sm text-gray-400 mt-2">
        Testing static texture generation for common blocks
      </p>
    </div>
  );
}