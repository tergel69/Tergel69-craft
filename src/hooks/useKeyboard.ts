'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

export function useKeyboard(enabled: boolean = true) {
  const keys = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sneak: false,
    sprint: false,
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    switch (e.code) {
      case 'KeyW':
        keys.current.forward = true;
        break;
      case 'KeyS':
        keys.current.backward = true;
        break;
      case 'KeyA':
        keys.current.left = true;
        break;
      case 'KeyD':
        keys.current.right = true;
        break;
      case 'Space':
        keys.current.jump = true;
        e.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.current.sneak = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        keys.current.sprint = true;
        break;
    }
  }, [enabled]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
        keys.current.forward = false;
        break;
      case 'KeyS':
        keys.current.backward = false;
        break;
      case 'KeyA':
        keys.current.left = false;
        break;
      case 'KeyD':
        keys.current.right = false;
        break;
      case 'Space':
        keys.current.jump = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.current.sneak = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        keys.current.sprint = false;
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return keys;
}

// Hook for single key press detection (for toggling)
export function useKeyPress(targetKey: string, callback: () => void, enabled: boolean = true) {
  const pressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.code === targetKey && !pressedRef.current) {
        pressedRef.current = true;
        callback();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === targetKey) {
        pressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [targetKey, callback, enabled]);
}

// Hook for number key selection (hotbar)
export function useNumberKeys(callback: (slot: number) => void, enabled: boolean = true) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        callback(num - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback, enabled]);
}
