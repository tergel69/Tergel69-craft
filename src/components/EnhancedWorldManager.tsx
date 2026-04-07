'use client';

import { useState, useEffect } from 'react';
import { worldManager } from '@/utils/WorldManager';

interface WorldInfo {
  id: string;
  name: string;
  seed: number;
  gameMode: 'survival' | 'creative';
  playTime: number;
  createdAt: number;
}

export default function EnhancedWorldManager({ onWorldSelected, onBack }: { 
  onWorldSelected: (worldId: string) => void;
  onBack: () => void;
}) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [worldName, setWorldName] = useState('New World');
  const [seed, setSeed] = useState('');
  const [gameMode, setGameMode] = useState<'survival' | 'creative'>('creative');
  const [generationMode, setGenerationMode] = useState<'classic' | 'new_generation'>('classic');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = () => {
    try {
      const worldList = worldManager.getWorlds();
      setWorlds(worldList);
    } catch (error) {
      setErrorMessage('Failed to load worlds: ' + (error as Error).message);
    }
  };

  const handleCreateWorld = async () => {
    if (!worldName.trim()) {
      setErrorMessage('Please enter a world name');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const worldId = await worldManager.createNewWorld(worldName, seed ? parseInt(seed) : Date.now(), gameMode, generationMode);
      onWorldSelected(worldId);
    } catch (error) {
      setErrorMessage('Failed to create world: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadWorld = async (worldId: string) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      await worldManager.loadWorld(worldId);
      onWorldSelected(worldId);
    } catch (error) {
      setErrorMessage('Failed to load world: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    if (!confirm('Are you sure you want to delete this world? This action cannot be undone.')) {
      return;
    }

    try {
      await worldManager.deleteWorld(worldId);
      loadWorlds();
      setErrorMessage('World deleted successfully');
    } catch (error) {
      setErrorMessage('Failed to delete world: ' + (error as Error).message);
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
      setErrorMessage('World exported successfully');
    } catch (error) {
      setErrorMessage('Failed to export world: ' + (error as Error).message);
    }
  };

  const handleImportWorld = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as string;
        const worldId = worldManager.importWorld('Imported World', data);
        loadWorlds();
        setErrorMessage('World imported successfully');
      } catch (error) {
        setErrorMessage('Failed to import world: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const formatPlayTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-600/20 border border-red-500/50 text-red-300 p-3 rounded-lg text-center">
          {errorMessage}
        </div>
      )}

      {/* Create New World */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
          Create New World
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">World Name</label>
            <input
              type="text"
              value={worldName}
              onChange={(e) => setWorldName(e.target.value)}
              placeholder="Enter world name..."
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random seed (optional)"
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Game Mode</label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value as 'survival' | 'creative')}
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="survival">Survival</option>
                <option value="creative">Creative</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Generation</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenerationMode('classic')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  generationMode === 'classic'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                Classic
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('new_generation')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  generationMode === 'new_generation'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                New Generation
              </button>
            </div>
          </div>
          <button
            onClick={handleCreateWorld}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? 'Creating...' : '🌍 Create World'}
          </button>
        </div>
      </div>

      {/* Import World */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
          Import World
        </h3>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2l2 2"/>
              </svg>
              <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-500">World JSON files only</p>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportWorld}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Existing Worlds */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
          Existing Worlds
        </h3>
        {worlds.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4 text-lg">No worlds found</div>
            <div className="text-sm text-gray-500">Create a new world to get started your adventure</div>
          </div>
        ) : (
          <div className="space-y-3">
            {worlds.map((world) => (
              <div key={world.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:bg-gray-650 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white text-lg">{world.name}</h4>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-300">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Seed: {world.seed}
                      </span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Mode: {world.gameMode}
                      </span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        Time: {formatPlayTime(world.playTime)}
                      </span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        Created: {formatDate(world.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleLoadWorld(world.id)}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      🎮 Play
                    </button>
                    <button
                      onClick={() => handleExportWorld(world.id)}
                      className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                    >
                      📤 Export
                    </button>
                    <button
                      onClick={() => handleDeleteWorld(world.id)}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
        >
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
}
