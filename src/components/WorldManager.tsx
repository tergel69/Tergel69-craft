import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useWorldStore } from '@/stores/worldStore';
import { worldManager } from '@/utils/WorldManager';
import { worldDatabase } from '@/utils/WorldDatabase';
import { WorldMetadata } from '@/utils/WorldDatabase';
import { GameMode } from '@/stores/gameStore';

interface WorldManagerProps {
  onWorldSelected: (worldId: string) => void;
  onBack: () => void;
}

export const WorldManager: React.FC<WorldManagerProps> = ({ onWorldSelected, onBack }) => {
  const [worlds, setWorlds] = useState<WorldMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [newWorldGameMode, setNewWorldGameMode] = useState<'survival' | 'creative'>('survival');
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const worldList = worldDatabase.getWorlds();
      setWorlds(worldList);
    } catch (err) {
      console.error('Failed to load worlds:', err);
      setError('Failed to load worlds. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorld = async () => {
    if (!newWorldName.trim()) {
      setError('Please enter a world name.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const seed = newWorldSeed.trim() ? parseInt(newWorldSeed) : Date.now();
      const worldId = await worldManager.createNewWorld(newWorldName.trim(), seed, newWorldGameMode);
      
      // Reset form
      setNewWorldName('');
      setNewWorldSeed('');
      setShowCreateForm(false);
      
      // Load the new world
      onWorldSelected(worldId);
    } catch (err) {
      console.error('Failed to create world:', err);
      setError(err instanceof Error ? err.message : 'Failed to create world.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadWorld = async (worldId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedWorld(worldId);
      
      await worldManager.loadWorld(worldId);
      onWorldSelected(worldId);
    } catch (err) {
      console.error('Failed to load world:', err);
      setError(err instanceof Error ? err.message : 'Failed to load world.');
      setSelectedWorld(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorld = async (worldId: string, worldName: string) => {
    if (!confirm(`Are you sure you want to delete "${worldName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await worldManager.deleteWorld(worldId);
      await loadWorlds();
    } catch (err) {
      console.error('Failed to delete world:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete world.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWorld = (worldId: string) => {
    try {
      const exportData = worldManager.exportWorld(worldId);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `world_${worldId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export world:', err);
      setError('Failed to export world.');
    }
  };

  const formatPlayTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (showCreateForm) {
    return (
      <div className="world-manager">
        <div className="world-manager-header">
          <h2>Create New World</h2>
          <button onClick={() => setShowCreateForm(false)} className="btn-secondary">
            Back
          </button>
        </div>
        
        <div className="world-form">
          <div className="form-group">
            <label htmlFor="world-name">World Name</label>
            <input
              id="world-name"
              type="text"
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              placeholder="Enter world name"
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="world-seed">Seed (optional)</label>
            <input
              id="world-seed"
              type="number"
              value={newWorldSeed}
              onChange={(e) => setNewWorldSeed(e.target.value)}
              placeholder="Leave empty for random seed"
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label>Game Mode</label>
            <div className="game-mode-options">
              <label className={`mode-option ${newWorldGameMode === 'survival' ? 'active' : ''}`}>
                <input
                  type="radio"
                  value="survival"
                  checked={newWorldGameMode === 'survival'}
                  onChange={(e) => setNewWorldGameMode(e.target.value as 'survival' | 'creative')}
                  disabled={isLoading}
                />
                <span>Survival</span>
              </label>
              <label className={`mode-option ${newWorldGameMode === 'creative' ? 'active' : ''}`}>
                <input
                  type="radio"
                  value="creative"
                  checked={newWorldGameMode === 'creative'}
                  onChange={(e) => setNewWorldGameMode(e.target.value as 'survival' | 'creative')}
                  disabled={isLoading}
                />
                <span>Creative</span>
              </label>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-actions">
            <button onClick={handleCreateWorld} disabled={isLoading} className="btn-primary">
              {isLoading ? 'Creating...' : 'Create World'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="world-manager">
      <div className="world-manager-header">
        <h2>World Manager</h2>
        <div className="header-actions">
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            Create World
          </button>
          <button onClick={onBack} className="btn-secondary">
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn-close">×</button>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Loading worlds...</span>
        </div>
      )}

      <div className="world-list">
        {worlds.length === 0 ? (
          <div className="empty-state">
            <p>No worlds found. Create your first world to get started!</p>
          </div>
        ) : (
          worlds.map((world) => (
            <div key={world.id} className="world-card">
              <div className="world-info">
                <div className="world-header">
                  <h3>{world.name}</h3>
                  <div className="world-meta">
                    <span className="seed">Seed: {world.seed}</span>
                    <span className={`game-mode ${world.gameMode}`}>{world.gameMode}</span>
                  </div>
                </div>
                
                <div className="world-details">
                  <span className="detail">Created: {formatDate(world.creationDate)}</span>
                  <span className="detail">Last Played: {formatDate(world.lastPlayed)}</span>
                  <span className="detail">Play Time: {formatPlayTime(world.playTime)}</span>
                  <span className="detail">Difficulty: {world.difficulty}</span>
                </div>
              </div>
              
              <div className="world-actions">
                <button
                  onClick={() => handleLoadWorld(world.id)}
                  disabled={isLoading || selectedWorld === world.id}
                  className="btn-primary"
                >
                  {selectedWorld === world.id ? 'Loading...' : 'Load'}
                </button>
                
                <div className="action-buttons">
                  <button
                    onClick={() => handleExportWorld(world.id)}
                    disabled={isLoading}
                    className="btn-secondary"
                    title="Export World"
                  >
                    Export
                  </button>
                  
                  <button
                    onClick={() => handleDeleteWorld(world.id, world.name)}
                    disabled={isLoading}
                    className="btn-danger"
                    title="Delete World"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .world-manager {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          color: white;
        }

        .world-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 2px solid #444;
          padding-bottom: 1rem;
        }

        .world-manager-header h2 {
          margin: 0;
          font-size: 2rem;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .world-form {
          background: rgba(0, 0, 0, 0.8);
          padding: 2rem;
          border-radius: 8px;
          border: 1px solid #444;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: #ccc;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #555;
          border-radius: 4px;
          background: #222;
          color: white;
          font-size: 1rem;
        }

        .game-mode-options {
          display: flex;
          gap: 1rem;
        }

        .mode-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
          background: #222;
          transition: all 0.2s;
        }

        .mode-option.active {
          border-color: #007bff;
          background: #1a3d66;
        }

        .mode-option input {
          margin: 0;
        }

        .form-actions {
          margin-top: 2rem;
          display: flex;
          justify-content: flex-end;
        }

        .world-list {
          display: grid;
          gap: 1rem;
        }

        .world-card {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.8);
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #444;
          transition: all 0.2s;
        }

        .world-card:hover {
          border-color: #666;
          transform: translateY(-2px);
        }

        .world-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .world-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .world-header h3 {
          margin: 0;
          font-size: 1.5rem;
        }

        .world-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .seed {
          font-family: 'Courier New', monospace;
          background: #333;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.8rem;
        }

        .game-mode {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .game-mode.survival {
          background: #4CAF50;
          color: white;
        }

        .game-mode.creative {
          background: #2196F3;
          color: white;
        }

        .world-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.5rem;
          color: #ccc;
          font-size: 0.9rem;
        }

        .detail {
          background: #333;
          padding: 4px 8px;
          border-radius: 3px;
        }

        .world-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: flex-end;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .btn-primary, .btn-secondary, .btn-danger {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
          text-transform: uppercase;
          font-size: 0.8rem;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c82333;
        }

        .btn-primary:disabled, .btn-secondary:disabled, .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
          font-style: italic;
        }

        .error-banner {
          background: #dc3545;
          color: white;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-message {
          color: #dc3545;
          background: #fff;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }

        .loading-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          color: #ccc;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 2px solid #444;
          border-top: 2px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .world-card {
            grid-template-columns: 1fr;
          }
          
          .world-actions {
            align-items: stretch;
          }
          
          .action-buttons {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};