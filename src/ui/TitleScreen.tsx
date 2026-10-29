import React, { useEffect } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { globalAudioSynth } from '../audio/SoundSynth';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        globalAudioSynth.playClick();
        onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  const handleStartClick = () => {
    globalAudioSynth.playClick();
    onStart();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between p-8 pointer-events-auto bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-950/60 animate-in fade-in duration-300">
      {/* Top Brand Subtitle */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Logistics Simulation & Spatial Architecture</span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Industrial Transport Engine
        </div>
      </div>

      {/* Centerpiece Title Lockup */}
      <div className="max-w-2xl mx-auto text-center flex flex-col items-center">
        {/* Bespoke SVG Logo Lockup */}
        <div className="mb-4">
          <svg width="68" height="68" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="68" height="68" rx="20" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
            {/* Stylized Isometric Road & Node Lattice */}
            <path d="M16 46L34 22L52 46" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 38L46 38" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <circle cx="34" cy="22" r="5" fill="#38BDF8" />
            <circle cx="16" cy="46" r="4" fill="#10B981" />
            <circle cx="52" cy="46" r="4" fill="#E06A3B" />
          </svg>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-md">
          Global Transport
          <span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 bg-clip-text text-transparent">
            Empire
          </span>
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed drop-shadow">
          A stylized 3D transport management and logistics tycoon simulation. Establish arterial networks, operate supply chains, and build an industrial superpower.
        </p>

        {/* Start CTA Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleStartClick}
            className="group flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-sm sm:text-base transition shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Enter Simulation</span>
            <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded bg-sky-600/60 text-sky-100 text-[10px] font-mono border border-sky-400/40">
              Space / Enter
            </kbd>
          </button>
        </div>
      </div>

      {/* Flat Control Hint Line */}
      <div className="text-center">
        <p className="text-xs text-slate-300 font-medium tracking-wide">
          <span className="text-sky-400 font-bold">WASD / Drag</span> Pan View ·{' '}
          <span className="text-sky-400 font-bold">Mouse Wheel</span> Zoom ·{' '}
          <span className="text-sky-400 font-bold">Click</span> Select Building ·{' '}
          <span className="text-sky-400 font-bold">Space</span> Pause
        </p>
      </div>
    </div>
  );
};
