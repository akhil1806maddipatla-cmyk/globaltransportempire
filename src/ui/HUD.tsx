import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, DollarSign, Calendar, HelpCircle, Layers, Save, FolderDown, Award } from 'lucide-react';
import { globalEventBus } from '../core/EventBus';
import { GameDate, GameSpeed } from '../game/GameClock';
import { globalAudioSynth } from '../audio/SoundSynth';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';

interface HUDProps {
  onTogglePause: () => void;
  onSetSpeed: (speed: GameSpeed) => void;
  onOpenHelp: () => void;
  onQuickSave?: () => void;
  onQuickLoad?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  onTogglePause,
  onSetSpeed,
  onOpenHelp,
  onQuickSave,
  onQuickLoad,
}) => {
  const [cash, setCash] = useState<number>(DEFAULT_GAME_CONFIG.company.startingCash);
  const [date, setDate] = useState<GameDate>({
    day: 1,
    month: 1,
    year: 2026,
    formatted: '1 Jan 2026',
  });
  const [speed, setSpeed] = useState<GameSpeed>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [counts, setCounts] = useState<{ buildings: number; roads: number; vehicles: number }>({
    buildings: 3,
    roads: 3,
    vehicles: 3,
  });
  const [level, setLevel] = useState<number>(1);
  const [experience, setExperience] = useState<number>(0);
  const [nextLevelExp, setNextLevelExp] = useState<number>(1000);

  useEffect(() => {
    const unsubCash = globalEventBus.on<number>('game:cash_changed', (c) => setCash(c));
    const unsubDate = globalEventBus.on<GameDate>('game:date_tick', (d) => setDate(d));
    const unsubSpeed = globalEventBus.on<{ speed: GameSpeed; isPaused: boolean }>('game:speed_changed', (s) => {
      setSpeed(s.speed);
      setIsPaused(s.isPaused);
    });
    const unsubCounts = globalEventBus.on<{ buildings: number; roads: number; vehicles?: number }>('world:counts_changed', (c) => {
      setCounts({
        buildings: c.buildings,
        roads: c.roads,
        vehicles: c.vehicles ?? 3,
      });
    });
    const unsubLevel = globalEventBus.on<{ level: number }>('game:level_up', (l) => {
      setLevel(l.level);
      setNextLevelExp(l.level * 1000);
    });
    const unsubExp = globalEventBus.on<{ experience: number; level: number; nextLevelExp: number }>(
      'game:experience_gained',
      (e) => {
        setExperience(e.experience);
        setLevel(e.level);
        setNextLevelExp(e.nextLevelExp);
      }
    );

    return () => {
      unsubCash();
      unsubDate();
      unsubSpeed();
      unsubCounts();
      unsubLevel();
      unsubExp();
    };
  }, []);

  const handleSpeedClick = (newSpeed: GameSpeed) => {
    globalAudioSynth.playClick();
    onSetSpeed(newSpeed);
  };

  const handlePauseClick = () => {
    globalAudioSynth.playClick();
    onTogglePause();
  };

  return (
    <header
      className="fixed top-4 left-5 right-5 z-30 flex items-center justify-between gap-4 pointer-events-none select-none"
      aria-label="Simulation Status Bar"
    >
      {/* Brand & Empire Lockup */}
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold tracking-tight text-white uppercase">
              Global Transport Empire
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Alpha v0.2.0
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>{DEFAULT_GAME_CONFIG.company.companyName}</span>
            <span className="text-slate-600">•</span>
            <span>{counts.buildings} Facilities · {counts.roads} Roads · {counts.vehicles} Fleet</span>
          </div>
        </div>
      </div>

      {/* Central Economic, Progression & Calendar Cluster */}
      <div className="pointer-events-auto flex items-center gap-3">
        {/* Level & Progression */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Empire Level {level}</span>
            </div>
            <div className="text-xs font-bold tabular-nums text-amber-300">
              {experience} / {nextLevelExp} XP
            </div>
          </div>
        </div>

        {/* Treasury */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Company Treasury</span>
            </div>
            <div className="text-sm font-bold tabular-nums text-emerald-300">
              ${cash.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Date & Calendar */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Simulation Date
            </div>
            <div className="text-sm font-bold tabular-nums text-slate-200">
              {date.formatted}
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Controls & Shortcuts */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Clock Speed Controls */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
          <button
            onClick={handlePauseClick}
            className={`flex items-center justify-center w-8 h-8 rounded-xl transition ${
              isPaused
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Pause / Resume (Spacebar)"
            aria-label="Pause or Resume Simulation"
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={() => handleSpeedClick(1)}
            className={`px-2.5 h-8 text-xs font-bold rounded-xl transition ${
              !isPaused && speed === 1
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="1x Realtime Speed (Key 1)"
          >
            1x
          </button>

          <button
            onClick={() => handleSpeedClick(2)}
            className={`px-2.5 h-8 text-xs font-bold rounded-xl transition ${
              !isPaused && speed === 2
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="2x Fast Speed (Key 2)"
          >
            2x
          </button>

          <button
            onClick={() => handleSpeedClick(5)}
            className={`flex items-center gap-1 px-2.5 h-8 text-xs font-bold rounded-xl transition ${
              !isPaused && speed === 5
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="5x Warp Speed (Key 3)"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>5x</span>
          </button>
        </div>

        {/* Persistence Cluster: Quick Save / Quick Load */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-xl">
          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onQuickSave?.();
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition"
            title="Quick Save (F5 / Ctrl+S)"
            aria-label="Quick Save Game"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onQuickLoad?.();
            }}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition"
            title="Quick Load (F9 / Ctrl+L)"
            aria-label="Quick Load Game"
          >
            <FolderDown className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Help Modal Toggle */}
        <button
          onClick={onOpenHelp}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 shadow-xl text-slate-300 hover:text-white transition"
          title="Controls Guide & Shortcuts (?)"
          aria-label="Controls Guide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
