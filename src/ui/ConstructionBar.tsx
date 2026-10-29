import React from 'react';
import { RotateCw, X, Check, AlertTriangle, Layers, Route, DollarSign } from 'lucide-react';
import { BuildingDefinition } from '../data/buildingDefinitions';
import { PlacementValidationResult } from '../world/PlacementValidator';

interface ConstructionBarProps {
  definition: BuildingDefinition;
  rotation: number;
  validation: PlacementValidationResult | null;
  onRotate: () => void;
  onCancel: () => void;
}

export const ConstructionBar: React.FC<ConstructionBarProps> = ({
  definition,
  rotation,
  validation,
  onRotate,
  onCancel,
}) => {
  const isValid = validation ? validation.isValid : false;
  const message = validation
    ? validation.message
    : 'Position pointer over sector grid to preview site.';

  const effW = validation?.effectiveWidth || definition.footprintWidth;
  const effD = validation?.effectiveDepth || definition.footprintDepth;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-150"
      aria-label="Active Construction Tool"
    >
      {/* Structure Header */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${definition.colorAccent}25`,
            border: `1px solid ${definition.colorAccent}60`,
          }}
        >
          <Layers className="w-4 h-4" style={{ color: definition.colorAccent }} />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Site Placement Mode
          </div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>{definition.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({effW}×{effD} cells • {effW * 2}m×{effD * 2}m)
            </span>
          </div>
        </div>
      </div>

      {/* Cost Badge */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-mono font-bold text-emerald-400">
        <DollarSign className="w-3.5 h-3.5" />
        <span>{definition.cost.toLocaleString()}</span>
      </div>

      {/* Real-time Validation Feedback Status */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
          isValid
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
        }`}
      >
        {isValid ? (
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="max-w-xs truncate">{message}</span>
      </div>

      {/* Controls: Rotate & Cancel */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
        <button
          onClick={onRotate}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/50 transition"
          title="Rotate Footprint 90° (Key R)"
        >
          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
          <span>{rotation}°</span>
        </button>

        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-rose-300 hover:text-rose-100 border border-rose-500/40 transition"
          title="Cancel Placement (Escape)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};
