import { BlockType } from '@/data/blocks';
import { ItemType } from '@/data/items';
import { useGameStore } from '@/stores/gameStore';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function getVolume(multiplier = 1): number {
  return Math.max(0, Math.min(1, useGameStore.getState().soundVolume * multiplier));
}

function isRunningContext(ctx: AudioContext): boolean {
  return ctx.state !== 'closed';
}

export async function ensureAudioUnlocked(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  return ctx.state === 'running';
}

function makeGain(ctx: AudioContext, gainValue: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0.0001, gainValue);
  gain.connect(ctx.destination);
  return gain;
}

function makeNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const falloff = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * falloff;
  }
  return buffer;
}

function stopSource(source: AudioScheduledSourceNode, ctx: AudioContext, duration: number): void {
  source.start();
  source.stop(ctx.currentTime + duration);
}

function playNoise({
  duration,
  volume,
  filterType = 'bandpass',
  frequency = 1200,
  q = 1,
}: {
  duration: number;
  volume: number;
  filterType?: BiquadFilterType;
  frequency?: number;
  q?: number;
}): void {
  const ctx = getAudioContext();
  if (!ctx || !isRunningContext(ctx) || volume <= 0) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, ctx.currentTime);
  filter.Q.value = q;

  const gain = makeGain(ctx, volume);
  gain.gain.setValueAtTime(Math.max(0.0001, volume), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  src.connect(filter);
  filter.connect(gain);
  stopSource(src, ctx, duration + 0.01);
}

function playTone({
  frequencies,
  duration,
  volume,
  wave = 'sine',
  filterFrequency,
  filterType = 'lowpass',
  detune = 0,
}: {
  frequencies: number[];
  duration: number;
  volume: number;
  wave?: OscillatorType;
  filterFrequency?: number;
  filterType?: BiquadFilterType;
  detune?: number;
}): void {
  const ctx = getAudioContext();
  if (!ctx || !isRunningContext(ctx) || volume <= 0) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const out = makeGain(ctx, volume);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency ?? 2200, ctx.currentTime);
  filter.Q.value = 0.8;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(Math.max(0.0001, volume * 0.2), ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  for (const frequency of frequencies) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(30, frequency), ctx.currentTime);
    if (detune !== 0) {
      osc.detune.setValueAtTime(detune, ctx.currentTime);
    }
    osc.connect(filter);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  filter.connect(envelope);
  envelope.connect(out);
}

export function playSpawnSound(): void {
  const volume = getVolume(0.95);
  playTone({
    frequencies: [220, 330],
    duration: 0.28,
    volume: volume * 0.65,
    wave: 'triangle',
    filterFrequency: 1600,
  });
  playNoise({
    duration: 0.05,
    volume: volume * 0.22,
    filterType: 'bandpass',
    frequency: 1800,
    q: 2,
  });
}

export function playBreakSound(blockType?: BlockType | null): void {
  const volume = getVolume(0.9);
  const hardnessBoost =
    blockType === BlockType.STONE ||
    blockType === BlockType.COBBLESTONE ||
    blockType === BlockType.DEEPSLATE ||
    blockType === BlockType.OBSIDIAN
      ? 1.15
      : 1;

  playNoise({
    duration: 0.08,
    volume: volume * 0.35,
    filterType: 'bandpass',
    frequency: 900,
    q: 1.2,
  });
  playTone({
    frequencies: [140 * hardnessBoost, 95 * hardnessBoost],
    duration: 0.09,
    volume: volume * 0.18,
    wave: 'square',
    filterFrequency: 700,
    filterType: 'lowpass',
  });
}

export function playPlaceSound(blockType?: BlockType | null): void {
  const volume = getVolume(0.75);
  const pitch =
    blockType === BlockType.OAK_LOG ||
    blockType === BlockType.OAK_PLANKS ||
    blockType === BlockType.CRAFTING_TABLE
      ? 1
      : 0.9;

  playNoise({
    duration: 0.03,
    volume: volume * 0.18,
    filterType: 'highpass',
    frequency: 1200,
    q: 0.9,
  });
  playTone({
    frequencies: [260 * pitch, 180 * pitch],
    duration: 0.06,
    volume: volume * 0.14,
    wave: 'triangle',
    filterFrequency: 1800,
  });
}

export function playFootstepSound(surface: 'normal' | 'sprint' | 'water' = 'normal'): void {
  const volume = getVolume(0.55);
  if (surface === 'water') {
    playNoise({
      duration: 0.04,
      volume: volume * 0.16,
      filterType: 'bandpass',
      frequency: 700,
      q: 1.5,
    });
    return;
  }

  const pitch = surface === 'sprint' ? 1.1 : 0.95;
  playNoise({
    duration: 0.025,
    volume: volume * 0.12,
    filterType: 'bandpass',
    frequency: 650,
    q: 1.1,
  });
  playTone({
    frequencies: [120 * pitch],
    duration: 0.03,
    volume: volume * 0.08,
    wave: 'square',
    filterFrequency: 900,
  });
}

export function playJumpSound(): void {
  const volume = getVolume(0.7);
  playTone({
    frequencies: [300, 420, 520],
    duration: 0.08,
    volume: volume * 0.15,
    wave: 'triangle',
    filterFrequency: 2200,
  });
}

export function playLandSound(intensity = 1): void {
  const volume = getVolume(0.8) * Math.max(0.2, Math.min(1, intensity / 4));
  playNoise({
    duration: 0.05,
    volume: volume * 0.25,
    filterType: 'lowpass',
    frequency: 500,
    q: 0.8,
  });
  playTone({
    frequencies: [90, 60],
    duration: 0.07,
    volume: volume * 0.18,
    wave: 'sine',
    filterFrequency: 500,
  });
}

export function playEatSound(foodItem?: ItemType | null): void {
  const volume = getVolume(0.7);
  const sweetFood =
    foodItem === ItemType.APPLE ||
    foodItem === ItemType.BREAD ||
    foodItem === ItemType.CARROT ||
    foodItem === ItemType.GOLDEN_CARROT ||
    foodItem === ItemType.GOLDEN_APPLE ||
    foodItem === ItemType.ENCHANTED_GOLDEN_APPLE;

  playNoise({
    duration: 0.06,
    volume: volume * 0.14,
    filterType: 'bandpass',
    frequency: sweetFood ? 1400 : 900,
    q: 1.3,
  });
  playTone({
    frequencies: sweetFood ? [520, 660] : [320, 240],
    duration: 0.08,
    volume: volume * 0.12,
    wave: 'sine',
    filterFrequency: sweetFood ? 2600 : 1600,
  });
}

export function playDamageSound(kind: 'hurt' | 'fire' | 'splash' = 'hurt'): void {
  const volume = getVolume(0.75);
  if (kind === 'splash') {
    playNoise({
      duration: 0.08,
      volume: volume * 0.18,
      filterType: 'bandpass',
      frequency: 500,
      q: 1.2,
    });
    return;
  }

  playTone({
    frequencies: kind === 'fire' ? [180, 130] : [160, 110],
    duration: 0.12,
    volume: volume * 0.16,
    wave: 'sawtooth',
    filterFrequency: 900,
  });
  playNoise({
    duration: 0.04,
    volume: volume * 0.08,
    filterType: 'highpass',
    frequency: 300,
    q: 0.8,
  });
}

// Player attack hit sound
export function playHitSound(): void {
  const volume = getVolume(0.65);
  playTone({
    frequencies: [180, 120],
    duration: 0.06,
    volume: volume * 0.2,
    wave: 'square',
    filterFrequency: 600,
  });
  playNoise({
    duration: 0.03,
    volume: volume * 0.1,
    filterType: 'highpass',
    frequency: 400,
  });
}
