'use client';

import { usePlayerStore } from '@/stores/playerStore';
import { useWorldStore } from '@/stores/worldStore';
import { BlockType } from '@/data/blocks';
import { PLAYER_EYE_HEIGHT } from '@/utils/constants';

export default function UnderwaterUI() {
  const position = usePlayerStore((state) => state.position);
  const isInWater = usePlayerStore((state) => state.isInWater);
  const oxygen = usePlayerStore((state) => state.oxygen);
  const isSwimming = usePlayerStore((state) => state.isSwimming);

  // Check if player's head is underwater
  const isHeadUnderwater = isInWater && isSwimming;
  
  // Calculate oxygen percentage (300 is full, 0 is empty)
  const oxygenPercentage = Math.max(0, Math.min(100, (oxygen / 300) * 100));

  if (!isHeadUnderwater) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Underwater screen tint */}
      <div 
        className="absolute inset-0 bg-blue-900/20"
        style={{
          animation: 'underwaterPulse 2s ease-in-out infinite',
        }}
      />

      {/* Remove useless bubble overlay - keeping only essential UI elements */}

      {/* Oxygen bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
        <div className="relative w-48 h-4 bg-gray-800/80 border-2 border-blue-400/50 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 ${
              oxygenPercentage < 20 ? 'animate-pulse bg-red-500' : ''
            }`}
            style={{
              width: `${oxygenPercentage}%`,
              boxShadow: oxygenPercentage < 20 ? '0 0 10px rgba(255, 0, 0, 0.5)' : '0 0 10px rgba(59, 130, 246, 0.5)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/80">
            {Math.ceil(oxygenPercentage)}%
          </div>
        </div>
        <div className="mt-2 text-center text-blue-300 text-sm font-medium">
          Oxygen
        </div>
      </div>

      {/* Drowning warning */}
      {oxygenPercentage < 20 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-red-400 text-2xl font-bold animate-pulse">
          DROWNING!
        </div>
      )}

      {/* Remove top bubbles - keeping only essential UI elements */}
    </div>
  );
}

// Add CSS animations
const styles = `
  @keyframes underwaterPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.5; }
  }

  @keyframes float {
    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
  }

  @keyframes bubble {
    0% { transform: translateY(0) scale(0); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}