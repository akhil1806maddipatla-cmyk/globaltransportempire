import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Grid,
  Sun,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import { globalAudioSynth } from '../audio/SoundSynth';
import { globalEventBus } from '../core/EventBus';

interface BottomControlDockProps {
  onResetCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onToggleGrid: () => void;
  onSetLighting: (preset: 'day' | 'golden' | 'dusk') => void;
  isGridVisible: boolean;
  lightingPreset: 'day' | 'golden' | 'dusk';
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  onResetCamera,
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onToggleGrid,
  onSetLighting,
  isGridVisible,
  lightingPreset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(globalAudioSynth.getIsMuted());

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    globalAudioSynth.setMuted(next);
    if (!next) {
      globalAudioSynth.playClick();
    }
    globalEventBus.emit('ui:notify', {
      title: 'Audio Synth',
      message: next ? 'Synthesizer muted' : 'Synthesizer unmuted',
      type: 'info',
    });
  };

  const handleLighting = (preset: 'day' | 'golden' | 'dusk') => {
    globalAudioSynth.playClick();
    onSetLighting(preset);
    globalEventBus.emit('ui:notify', {
      title: 'Atmosphere Changed',
      message: `Lighting profile set to ${preset.toUpperCase()}`,
      type: 'info',
    });
  };

  const handleResetCamera = () => {
    globalAudioSynth.playClick();
    onResetCamera();
    globalEventBus.emit('ui:notify', {
      title: 'Camera Reset',
      message: 'Returned to default isometric overview',
      type: 'info',
    });
  };

  const handleGrid = () => {
    globalAudioSynth.playClick();
    onToggleGrid();
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-auto transition-transform duration-300 ease-out"
      style={{
        transform: `translateX(-50%) translateY(${isCollapsed ? 'calc(100% - 28px)' : '0'})`,
      }}
    >
      {/* Drawer Toggle Tab */}
      <button
        onClick={() => {
          globalAudioSynth.playClick();
          setIsCollapsed(!isCollapsed);
        }}
        className="flex items-center gap-1.5 px-3 py-1 rounded-t-xl bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700/60 text-[11px] font-semibold text-slate-300 hover:text-white shadow-lg transition"
        title="Toggle HUD Dock Visibility (H)"
        aria-label="Toggle Bottom Dock Visibility"
      >
        <Sliders className="w-3 h-3 text-sky-400" />
        <span>{isCollapsed ? 'Show Dock' : 'Hide Dock'}</span>
        {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Main Control Strip */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl backdrop-blur-none text-slate-200">
        {/* Navigation & Zoom */}
        <div className="flex items-center gap-1 pr-3 border-r border-slate-800">
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Reset Camera (Key R)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onZoomIn();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Zoom In (Scroll Up)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onZoomOut();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Zoom Out (Scroll Down)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {onRotateLeft && (
            <button
              onClick={() => {
                globalAudioSynth.playClick();
                onRotateLeft();
              }}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Rotate Left 45° (Key Q)"
              aria-label="Rotate Left"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {onRotateRight && (
            <button
              onClick={() => {
                globalAudioSynth.playClick();
                onRotateRight();
              }}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Rotate Right 45° (Key E)"
              aria-label="Rotate Right"
            >
              <RotateCw className="w-4 h-4 text-emerald-400" />
            </button>
          )}
        </div>

        {/* Viewport Toggles: Grid */}
        <div className="flex items-center gap-1 pr-3 border-r border-slate-800">
          <button
            onClick={handleGrid}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              isGridVisible
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Tactical Grid (Key G)"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
        </div>

        {/* Atmosphere Presets */}
        <div className="flex items-center gap-1 pr-3 border-r border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Lighting</span>
          <button
            onClick={() => handleLighting('day')}
            className={`p-1.5 rounded-xl transition ${
              lightingPreset === 'day'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Daytime Sun"
            aria-label="Daytime Sun"
          >
            <Sun className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleLighting('golden')}
            className={`p-1.5 rounded-xl transition ${
              lightingPreset === 'golden'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Golden Hour"
            aria-label="Golden Hour"
          >
            <Sunset className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleLighting('dusk')}
            className={`p-1.5 rounded-xl transition ${
              lightingPreset === 'dusk'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Dusk / Twilight"
            aria-label="Dusk / Twilight"
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Mute Toggle */}
        <div>
          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded-xl transition ${
              isMuted
                ? 'text-rose-400 hover:bg-rose-950/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            aria-label="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
