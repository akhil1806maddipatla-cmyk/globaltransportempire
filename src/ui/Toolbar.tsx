import React from 'react';
import { Route, Building2, Package, Truck, Compass, Hammer, Trash2, Ruler } from 'lucide-react';
import { globalEventBus } from '../core/EventBus';
import { globalAudioSynth } from '../audio/SoundSynth';

interface ToolbarProps {
  activeTool: string | null;
  onOpenBuildingCatalog: () => void;
  onStartRoadConstruction: () => void;
  onStartRoadDemolition: () => void;
  onOpenFleetStudio?: () => void;
  onOpenScaleValidator?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onOpenBuildingCatalog,
  onStartRoadConstruction,
  onStartRoadDemolition,
  onOpenFleetStudio,
  onOpenScaleValidator,
}) => {
  const isBuildingActive = activeTool !== null && activeTool.startsWith('place_');
  const isRoadActive = activeTool !== null && activeTool.startsWith('road_') && activeTool !== 'road_demolish';
  const isDemolishActive = activeTool === 'road_demolish';
  const isSelectActive = activeTool === null;

  const handleSelectClick = () => {
    globalAudioSynth.playClick();
    if (activeTool !== null) {
      globalEventBus.emit('tool:cancel');
    }
  };

  const handleRoadsClick = () => {
    globalAudioSynth.playClick();
    if (isRoadActive) {
      globalEventBus.emit('tool:cancel');
    } else {
      onStartRoadConstruction();
    }
  };

  const handleBulldozerClick = () => {
    globalAudioSynth.playClick();
    if (isDemolishActive) {
      globalEventBus.emit('tool:cancel');
    } else {
      onStartRoadDemolition();
    }
  };

  const handleBuildingsClick = () => {
    globalAudioSynth.playClick();
    onOpenBuildingCatalog();
  };

  const handleLogisticsClick = () => {
    globalAudioSynth.playClick();
    globalEventBus.emit('ui:notify', {
      title: 'Logistics Infrastructure',
      message: 'Freight routes and cargo allocation active across Sector Logistics Hubs.',
      type: 'info',
    });
  };

  const handleVehiclesClick = () => {
    globalAudioSynth.playClick();
    if (onOpenFleetStudio) {
      onOpenFleetStudio();
    } else {
      globalEventBus.emit('ui:notify', {
        title: 'Fleet Operations',
        message: 'Heavy transport carriers and dispatch routing available once secondary road extensions are commissioned.',
        type: 'info',
      });
    }
  };

  return (
    <aside
      className="fixed left-5 top-24 z-30 flex flex-col gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-2xl pointer-events-auto backdrop-blur-md"
      aria-label="Construction and Navigation Tools"
    >
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Hammer className="w-3.5 h-3.5 text-sky-400" />
        <span>Tools</span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {/* Normal Select / Inspect Tool */}
        <button
          onClick={handleSelectClick}
          title="Inspect & Select — Click structures to inspect operational specs"
          className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${
            isSelectActive
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-400'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Compass className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Inspect & Select</div>
            <div className="text-[11px] text-slate-400">Inspect buildings, plots, and road networks</div>
          </div>
        </button>

        {/* Roadways Tool */}
        <button
          onClick={handleRoadsClick}
          title="Construct Roadways — Draw urban roads, freight avenues, and service tracks"
          className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${
            isRoadActive
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-400'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Route className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Road Construction</div>
            <div className="text-[11px] text-slate-400">Draw 2-lane roads, arterials & service tracks</div>
          </div>
        </button>

        {/* Industrial & Logistics Construction Tool */}
        <button
          onClick={handleBuildingsClick}
          title="Construct Facilities — Open catalog to build warehouses, plants, and depots"
          className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${
            isBuildingActive
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Construct Facilities</div>
            <div className="text-[11px] text-slate-400">Place warehouses, factories, and depots</div>
          </div>
        </button>

        {/* Bulldozer / Demolition Tool */}
        <button
          onClick={handleBulldozerClick}
          title="Bulldozer Demolition — Remove roads and claim salvage refund"
          className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${
            isDemolishActive
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400'
              : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
          }`}
        >
          <Trash2 className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Bulldozer / Demolish</div>
            <div className="text-[11px] text-slate-400">Demolish road cells (50% salvage refund)</div>
          </div>
        </button>

        {/* Logistics Tool */}
        <button
          onClick={handleLogisticsClick}
          title="Freight Logistics"
          className="group relative flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Package className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Freight Logistics</div>
            <div className="text-[11px] text-slate-400">Supply chains & cargo throughput</div>
          </div>
        </button>

        {/* Vehicles Tool */}
        <button
          onClick={handleVehiclesClick}
          title="Fleet Operations"
          className="group relative flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Truck className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Fleet Operations</div>
            <div className="text-[11px] text-slate-400">Heavy transport & delivery schedules</div>
          </div>
        </button>

        {/* World Scale & Spatial Standards Inspector */}
        <button
          onClick={() => {
            globalAudioSynth.playClick();
            if (onOpenScaleValidator) onOpenScaleValidator();
          }}
          title="World Scale & Spatial Inspector"
          className="group relative flex items-center justify-center w-11 h-11 rounded-xl text-sky-400 hover:text-white hover:bg-slate-800 transition border border-sky-500/20 bg-sky-500/10"
        >
          <Ruler className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            <div className="text-xs font-semibold text-slate-100">Spatial Scale Validator</div>
            <div className="text-[11px] text-slate-400">1:1 Metric proportions & 3D bounding boxes</div>
          </div>
        </button>
      </nav>
    </aside>
  );
};
