import React from 'react';
import {
  Route,
  ArrowRightLeft,
  X,
  Check,
  AlertTriangle,
  Trash2,
  Layers,
  Minus,
  Plus,
} from 'lucide-react';
import { ROAD_DEFINITIONS, RoadTypeId } from '../data/roadDefinitions';
import { RoadValidationResult } from '../world/RoadConstructionValidator';
import { RoutingMode, GridCoord } from '../world/RoadPathGenerator';

interface RoadConstructionBarProps {
  subMode: 'build' | 'demolish';
  selectedRoadType: RoadTypeId;
  routingMode: RoutingMode;
  widthBlocks: number;
  forwardBlocks: number;
  backwardBlocks: number;
  hasStart: boolean;
  startCoord: GridCoord | null;
  currentCoord: GridCoord | null;
  pathLength: number;
  validation: RoadValidationResult | null;
  onSelectRoadType: (type: RoadTypeId) => void;
  onSelectWidthBlocks: (width: number) => void;
  onToggleDirectionalAllocation: () => void;
  onToggleRoutingMode: () => void;
  onSwitchToBulldozer: () => void;
  onSwitchToBuild: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const RoadConstructionBar: React.FC<RoadConstructionBarProps> = ({
  subMode,
  selectedRoadType,
  routingMode,
  widthBlocks,
  forwardBlocks,
  backwardBlocks,
  hasStart,
  startCoord,
  currentCoord,
  pathLength,
  validation,
  onSelectRoadType,
  onSelectWidthBlocks,
  onToggleDirectionalAllocation,
  onToggleRoutingMode,
  onSwitchToBulldozer,
  onSwitchToBuild,
  onCommit,
  onCancel,
}) => {
  const currentDef = ROAD_DEFINITIONS[selectedRoadType];
  const isValid = validation ? validation.isValid : false;
  const isDemolish = subMode === 'demolish';

  // Informative subtitle for lane configuration
  const getWidthDescription = () => {
    if (widthBlocks === 1) return '1 Block (1 lane single carriageway)';
    if (widthBlocks === 2) return '2 Blocks • 2-Way (1+1 lanes, solid centre divider, no dashed lines)';
    if (widthBlocks === 4) return '4 Blocks • Dual 2-Lane (2+2 lanes, dashed lane dividers + centre divider)';
    if (widthBlocks === 3) return `3 Blocks • Asymmetric (${forwardBlocks}+${backwardBlocks} lanes, dashed divider on 2-lane side)`;
    return `${widthBlocks} Blocks • (${forwardBlocks}+${backwardBlocks} directional lanes)`;
  };

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col md:flex-row items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-150"
      aria-label="Road Network Construction Bar"
    >
      {/* Category Header */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDemolish ? '#ef444425' : `${currentDef.colorAccent}25`,
            border: `1px solid ${isDemolish ? '#ef444460' : `${currentDef.colorAccent}60`}`,
          }}
        >
          {isDemolish ? (
            <Trash2 className="w-4 h-4 text-rose-400" />
          ) : (
            <Route className="w-4 h-4" style={{ color: currentDef.colorAccent }} />
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isDemolish ? 'Demolition Service' : 'Road Construction'}
          </div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>{isDemolish ? 'Bulldozer Tool' : currentDef.name}</span>
            {!isDemolish && (
              <span className="text-[10px] text-slate-400 font-mono">
                (${currentDef.costPerCell}/cell)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Road Type Selector Pills */}
      <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
        {(Object.keys(ROAD_DEFINITIONS) as RoadTypeId[]).map((typeId) => {
          const def = ROAD_DEFINITIONS[typeId];
          const isSelected = !isDemolish && selectedRoadType === typeId;
          return (
            <button
              key={typeId}
              onClick={() => {
                if (isDemolish) onSwitchToBuild();
                onSelectRoadType(typeId);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                isSelected
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-sky-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title={`${def.name} - ${def.description}`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: def.colorAccent }}
              />
              <span className="truncate max-w-[110px]">{def.name.split(' ')[0]}</span>
              <span className="text-[10px] opacity-60 font-mono">${def.costPerCell}</span>
            </button>
          );
        })}

        {/* Bulldozer Tab */}
        <button
          onClick={onSwitchToBulldozer}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            isDemolish
              ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/60 shadow-sm'
              : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800/50'
          }`}
          title="Demolish road segments (Salvage 50% refund)"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Bulldozer</span>
        </button>
      </div>

      {/* Player-Controlled Width Controls (Prompt 1/3) */}
      {!isDemolish && (
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-bold text-slate-300">Width:</span>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-700/60">
            <button
              onClick={() => onSelectWidthBlocks(Math.max(1, widthBlocks - 1))}
              disabled={widthBlocks <= 1}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Decrease width by 1 block"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-1.5 text-xs font-mono font-bold text-sky-300 min-w-[54px] text-center">
              {widthBlocks} {widthBlocks === 1 ? 'block' : 'blocks'}
            </span>
            <button
              onClick={() => onSelectWidthBlocks(Math.min(8, widthBlocks + 1))}
              disabled={widthBlocks >= 8}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Increase width by 1 block"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1">
            {[2, 3, 4, 5].map((w) => (
              <button
                key={w}
                onClick={() => onSelectWidthBlocks(w)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                  widthBlocks === w
                    ? 'bg-sky-500 text-white font-bold shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={`Set width to ${w} grid blocks`}
              >
                {w}B
              </button>
            ))}
          </div>

          {/* Asymmetric Width Allocation Toggle (e.g. for 3-block road) */}
          {widthBlocks % 2 !== 0 && widthBlocks > 1 && (
            <button
              onClick={onToggleDirectionalAllocation}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 hover:bg-amber-900/60 border border-amber-600/50 text-amber-300 text-[10px] font-mono transition"
              title="Toggle directional lane split (e.g. 2+1 vs 1+2)"
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span>
                {forwardBlocks}+{backwardBlocks}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Contextual Status / Validation */}
      {!isDemolish ? (
        <div className="flex items-center gap-2">
          {hasStart ? (
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
              <div className="flex flex-col">
                <span className="truncate max-w-[200px]">
                  {validation ? validation.message : 'Tracing road route...'}
                </span>
                {validation && validation.totalCost > 0 && (
                  <span className="text-[10px] opacity-80 font-mono">
                    {validation.newCells.length} cells ({widthBlocks} wide) • ${validation.totalCost.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col px-3 py-1.5 rounded-xl text-xs bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Click map to anchor road starting point</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">{getWidthDescription()}</span>
            </div>
          )}

          {/* Orthogonal Mode Toggle Button */}
          {hasStart && (
            <button
              onClick={onToggleRoutingMode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/50 transition"
              title="Toggle Curve Direction (Key T)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px]">
                {routingMode === 'horizontal_first' ? 'H → V' : 'V → H'}
              </span>
            </button>
          )}

          {/* Quick Commit button if valid */}
          {hasStart && isValid && (
            <button
              onClick={onCommit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 transition"
              title="Confirm Road Construction"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Construct</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-rose-950/40 border border-rose-500/50 text-rose-300">
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Click any existing road cell to demolish and claim 50% salvage refund.</span>
        </div>
      )}

      {/* Cancel Button */}
      <div className="flex items-center pl-2 border-l border-slate-800">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/50 transition"
          title="Exit Tool (Escape)"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};
