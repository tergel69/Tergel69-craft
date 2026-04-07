'use client';
/**
 * PauseMenu.tsx — Redesigned
 * ESC opens this. Two panels: Pause actions & Settings tab.
 * Settings: render distance, FOV, mouse sensitivity, sound (placeholder), video.
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useWorldStore } from '@/stores/worldStore';
import { normalizeMouseSensitivity } from '@/stores/gameStore';

type Tab = 'pause' | 'settings';

export function PauseMenu() {
  const gameState    = useGameStore(s => s.gameState);
  const setGameState = useGameStore(s => s.setGameState);
  const worldName    = useGameStore(s => s.worldName);
  const gameMode     = useGameStore(s => s.gameMode);
  const worldTime    = useGameStore(s => s.worldTime);
  const mouseSens    = useGameStore(s => normalizeMouseSensitivity(s.mouseSensitivity));
  const setMouseSens = useGameStore(s => s.setMouseSensitivity);
  const fov          = useGameStore(s => s.fov);
  const setFov       = useGameStore(s => s.setFov);
  const renderDist   = useGameStore(s => s.renderDistance);
  const setRenderDist= useGameStore(s => s.setRenderDistance);

  const [tab, setTab] = useState<Tab>('pause');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [renderValue, setRenderValue]   = useState(renderDist);
  const [fovValue, setFovValue]         = useState(fov);
  const [sensValue, setSensValue]       = useState(mouseSens);

  // Sync sliders when menu opens
  useEffect(() => {
    if (gameState === 'paused') {
      setRenderValue(useGameStore.getState().renderDistance);
      setFovValue(useGameStore.getState().fov);
      setSensValue(normalizeMouseSensitivity(useGameStore.getState().mouseSensitivity));
      setTab('pause');
    }
  }, [gameState]);

  if (gameState !== 'paused') return null;

  const resume = () => setGameState('playing');

  const saveGame = async () => {
    setSaving(true);
    try {
      const { worldManager } = await import('@/utils/WorldManager');
      await worldManager.manualSave?.();
    } catch { /* ignore if no world manager */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exitToMenu = () => {
    try { usePlayerStore.getState().reset(); } catch {}
    try { useInventoryStore.getState().reset(); } catch {}
    try { useWorldStore.getState().reset(); } catch {}
    try { useGameStore.getState().openContainer(null); } catch {}
    setGameState('menu');
  };

  const saveAndQuit = async () => {
    await saveGame();
    exitToMenu();
  };

  const applySettings = () => {
    if (setRenderDist) setRenderDist(renderValue);
    if (setFov) setFov(fovValue);
    if (setMouseSens) setMouseSens(sensValue);
    setTab('pause');
  };

  const timeStr = (() => {
    const t = (worldTime ?? 0);
    const h = Math.floor(t / 1000);
    const m = Math.floor((t % 1000) / (1000 / 60));
    return `Day ${Math.floor(h / 24) + 1}, ${String(h % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  })();

  // ─── Shared style helpers ──────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #2e2e2e 0%, #1c1c1c 100%)',
    border: '2px solid #111',
    boxShadow: '0 12px 48px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: 28,
    width: 420,
    fontFamily: 'monospace',
    color: '#d0c8b0',
    userSelect: 'none',
  };

  const btnBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'filter 0.12s, transform 0.08s',
    marginBottom: 6,
  };

  const btn = (bg: string, border: string, color = '#fff'): React.CSSProperties => ({
    ...btnBase, background: bg, borderColor: border, color,
  });

  // ── PAUSE TAB ──────────────────────────────────────────────────────────────
  if (tab === 'pause') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 2, marginBottom: 4 }}>PAUSED</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {worldName && <span>{worldName} • </span>}
            <span style={{ textTransform: 'capitalize' }}>{gameMode}</span>
            {worldTime !== undefined && <span> • {timeStr}</span>}
          </div>
        </div>

        {/* Buttons */}
        <button style={btn('#2d6a4f', '#1b4332')} onClick={resume}>
          ▶  Resume Game
        </button>
        <button style={btn('#1d4ed8', '#1e3a8a')} onClick={saveGame} disabled={saving}>
          {saving ? '💾 Saving…' : saved ? '✓ Saved!' : '💾  Save World'}
        </button>
        <button style={btn('#4c1d95', '#3b0764')} onClick={() => setTab('settings')}>
          ⚙  Settings
        </button>
        <div style={{ height: 8 }} />
        <button style={btn('#92400e', '#78350f')} onClick={saveAndQuit}>
          🚪  Save & Quit to Menu
        </button>
        <button style={btn('#374151', '#1f2937', '#aaa')} onClick={exitToMenu}>
          ✕  Quit without Saving
        </button>

        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: '#444' }}>
          Press ESC to resume
        </div>
      </div>
    </div>
  );

  // ── SETTINGS TAB ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      <div style={{ ...panelStyle, width: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>⚙ SETTINGS</div>
        </div>

        <SettingSection label="GRAPHICS">
          <SliderRow
            label="Render Distance"
            value={renderValue}
            min={4} max={24} step={2}
            display={`${renderValue} chunks`}
            onChange={setRenderValue}
          />
          <SliderRow
            label="Field of View"
            value={fovValue}
            min={60} max={110} step={5}
            display={`${fovValue}°`}
            onChange={setFovValue}
          />
        </SettingSection>

        <SettingSection label="CONTROLS">
          <SliderRow
            label="Mouse Sensitivity"
            value={sensValue}
            min={0.0002} max={0.01} step={0.0001}
            display={`${(sensValue * 1000).toFixed(1)}`}
            onChange={setSensValue}
          />
        </SettingSection>

        <SettingSection label="GAMEPLAY">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Game Mode</span>
            <span style={{
              padding: '2px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700,
              background: gameMode === 'creative' ? '#1d4ed8' : '#2d6a4f',
              color: '#fff', textTransform: 'uppercase',
            }}>{gameMode}</span>
          </div>
        </SettingSection>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...btnBase, flex: 1, background: '#2d6a4f', borderColor: '#1b4332', color: '#fff', marginBottom: 0 }} onClick={applySettings}>
            ✓ Apply
          </button>
          <button style={{ ...btnBase, flex: 1, background: '#374151', borderColor: '#1f2937', color: '#aaa', marginBottom: 0 }} onClick={() => setTab('pause')}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: '#aaa', width: 140, flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#4ade80', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 12, color: '#d0c8b0', width: 68, textAlign: 'right', fontFamily: 'monospace' }}>
        {display}
      </span>
    </div>
  );
}
