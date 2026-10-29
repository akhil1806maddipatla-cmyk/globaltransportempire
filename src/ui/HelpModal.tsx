import React from 'react';
import { X, Navigation, MousePointer, Play, ZoomIn, Eye, Sparkles, Route, Trash2 } from 'lucide-react';
import { globalAudioSynth } from '../audio/SoundSynth';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleClose = () => {
    globalAudioSynth.playClick();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 pointer-events-auto backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="controls-guide-title" className="text-base font-bold text-white">Controls & Shortcuts Guide</h2>
              <p className="text-xs text-slate-400">Global Transport Empire — Operations Manual</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
          {/* Road Construction */}
          <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-500/40 flex items-start gap-3 md:col-span-2">
            <Route className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sky-200">Road Construction Workflow</div>
              <div className="text-slate-300 mt-1 leading-relaxed">
                1. Select Road Tool or Bulldozer from the left toolbar.<br />
                2. <span className="font-semibold text-white">Click map</span> to anchor the start point.<br />
                3. Move pointer to preview route with real-time cost estimate.<br />
                4. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 font-mono text-[11px]">T</kbd> to toggle curve direction (Horizontal-first ⇄ Vertical-first).<br />
                5. <span className="font-semibold text-white">Click destination</span> to commit road construction. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 font-mono text-[11px]">Esc</kbd> or right-click to cancel.
              </div>
            </div>
          </div>

          {/* Bulldozer Demolition */}
          <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex items-start gap-3 md:col-span-2">
            <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-200">Bulldozer Demolition Mode</div>
              <div className="text-slate-300 mt-0.5">
                Click the Bulldozer icon in the toolbar or road bar. Click any existing road cell to demolish it and reclaim a <span className="font-semibold text-emerald-300">50% salvage refund</span>. Intersections re-align automatically.
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3">
            <Navigation className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Camera Pan & Rotation</div>
              <div className="text-slate-400 mt-0.5">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">W</kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">A</kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">S</kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">D</kbd> or <span className="text-slate-300 font-medium">Middle / Right-drag</span><br />
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">Q</kbd> Rotate Left · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">E</kbd> Rotate Right
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3">
            <ZoomIn className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Precision Zoom</div>
              <div className="text-slate-400 mt-0.5">
                <span className="text-slate-300 font-medium">Mouse Scroll Wheel</span> (Anchored Zoom-to-Cursor) or <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">+</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">-</kbd>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3">
            <MousePointer className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Facility Placement</div>
              <div className="text-slate-400 mt-0.5">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">R</kbd> to rotate building footprint 90°. Click valid green site to construct.
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3">
            <Play className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Simulation Speed</div>
              <div className="text-slate-400 mt-0.5">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">Space</kbd> Pause · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">1</kbd> 1x · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">2</kbd> 2x · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">3</kbd> 5x
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-start gap-3 md:col-span-2">
            <Eye className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Quick Shortcuts</div>
              <div className="text-slate-400 mt-0.5">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">F</kbd> Focus Facility · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">R</kbd> Reset View · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">G</kbd> Toggle Grid · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">H</kbd> Collapse Dock · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">M</kbd> Mute Audio · <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px]">?</kbd> Open Guide
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition shadow-lg shadow-sky-500/25"
          >
            Got it, Let's Play
          </button>
        </div>
      </div>
    </div>
  );
};
