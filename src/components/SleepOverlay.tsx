'use client';

/**
 * SleepOverlay.tsx — Fade-to-black sleep screen
 *
 * When the player sleeps, this overlay fades to black,
 * advances time to sunrise, heals the player, and fades back in.
 */

import { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameStore } from '@/stores/gameStore';
import { DAY_LENGTH } from '@/utils/constants';

const SLEEP_DURATION = 2.0; // seconds for the sleep transition
const SUNRISE_TIME = DAY_LENGTH * 0.25; // 6:00 AM

export default function SleepOverlay() {
  const isSleeping = usePlayerStore((s) => s.isSleeping);
  const wakeUp = usePlayerStore((s) => s.wakeUp);
  const setWorldTime = useGameStore((s) => s.setWorldTime);
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSleeping) {
      setOpacity(0);
      return;
    }

    // Fade to black
    setOpacity(0);
    requestAnimationFrame(() => setOpacity(1));

    // After a short delay, skip to sunrise and heal
    timerRef.current = window.setTimeout(() => {
      setWorldTime(SUNRISE_TIME);
      usePlayerStore.setState({
        health: usePlayerStore.getState().maxHealth,
        isSleeping: false,
      });
      setOpacity(0);
    }, SLEEP_DURATION * 700);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isSleeping, setWorldTime, wakeUp]);

  if (!isSleeping) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none transition-opacity duration-1000"
      style={{
        backgroundColor: 'black',
        opacity: opacity,
        transition: 'opacity 1s ease-in-out',
      }}
    />
  );
}