'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <div className="text-xl text-white">Loading...</div>
    </div>
  ),
});

export default function HomeClient() {
  return <Game />;
}
