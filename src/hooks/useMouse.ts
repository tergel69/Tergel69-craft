'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface MouseState {
  movementX: number;
  movementY: number;
  leftButton: boolean;
  rightButton: boolean;
  middleButton: boolean;
}

function normalizeSensitivity(value: number): number {
  if (!Number.isFinite(value)) return 0.0008;
  return Math.max(0.0002, Math.min(0.01, value > 0.05 ? value / 1000 : value));
}

export function useMouse(sensitivity: number = 0.0008) {
  const [isLocked, setIsLocked] = useState(false);
  const movement = useRef({ x: 0, y: 0 });
  const buttons = useRef({ left: false, right: false, middle: false });
  const sensitivityRef = useRef(sensitivity);

  // Keep sensitivity ref up to date without recreating callbacks
  useEffect(() => {
    sensitivityRef.current = normalizeSensitivity(sensitivity);
  }, [sensitivity]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (document.pointerLockElement) {
      movement.current.x += e.movementX * sensitivityRef.current;
      movement.current.y += e.movementY * sensitivityRef.current;
    }
  }, []); // No dependency on sensitivity - uses ref instead

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Allow mouse buttons even if pointer lock is being acquired
    switch (e.button) {
      case 0: buttons.current.left = true; break;
      case 1: buttons.current.middle = true; break;
      case 2: buttons.current.right = true; break;
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    switch (e.button) {
      case 0: buttons.current.left = false; break;
      case 1: buttons.current.middle = false; break;
      case 2: buttons.current.right = false; break;
    }
  }, []);

  const handlePointerLockChange = useCallback(() => {
    const locked = document.pointerLockElement !== null;
    setIsLocked(locked);
    // Clear movement and buttons on unlock to prevent ghost inputs
    if (!locked) {
      movement.current = { x: 0, y: 0 };
      buttons.current = { left: false, right: false, middle: false };
    }
  }, []);

  const handlePointerLockError = useCallback(() => {
    console.warn('Pointer lock failed. User may need to interact with the page first.');
    setIsLocked(false);
  }, []);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp, handlePointerLockChange, handlePointerLockError, handleContextMenu]);

  const requestPointerLock = useCallback(() => {
    if (!document.pointerLockElement) {
      document.body.requestPointerLock();
    }
  }, []);

  const exitPointerLock = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const consumeMovement = useCallback(() => {
    const m = { ...movement.current };
    movement.current = { x: 0, y: 0 };
    return m;
  }, []);

  const getButtons = useCallback(() => {
    return { ...buttons.current };
  }, []);

  return {
    isLocked,
    requestPointerLock,
    exitPointerLock,
    consumeMovement,
    getButtons,
  };
}

export function useMouseWheel(callback: (delta: number) => void, enabled: boolean = true) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!enabled) return;
      callbackRef.current(e.deltaY > 0 ? 1 : -1);
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [enabled]);
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  callback: () => void
) {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, callback]);
}
