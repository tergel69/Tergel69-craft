'use client';

import dynamic from 'next/dynamic';

// Dynamically import Game component with no SSR (Three.js requires browser)
const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  ),
});

const StaticTextureTest = dynamic(() => import('@/components/StaticTextureTest'), {
  ssr: false,
  loading: () => null,
});

const TextureGallery = dynamic(() => import('@/components/TextureGallery'), {
  ssr: false,
  loading: () => null,
});

const TextureTest = dynamic(() => import('@/components/TextureTest'), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return (
    <div>
      <Game />
      <TextureTest blockTypes={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
      <StaticTextureTest />
      <TextureGallery />
    </div>
  );
}
