import React, { useState } from 'react';
import {
  X,
  Building2,
  Boxes,
  DollarSign,
  Activity,
  Check,
  Route,
  RotateCw,
  Search,
  Filter,
  AlertCircle,
  Truck,
  Warehouse,
  Factory,
  Layers,
} from 'lucide-react';
import {
  BUILDING_DEFINITIONS,
  BUILDING_CATEGORIES,
  BuildingDefinition,
  BuildingCategory,
} from '../data/buildingDefinitions';
import { globalAudioSynth } from '../audio/SoundSynth';

interface BuildingCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBuilding: (def: BuildingDefinition) => void;
  playerCash?: number;
}

export const BuildingCatalogModal: React.FC<BuildingCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectBuilding,
  playerCash = 250000,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const allBuildings = Object.values(BUILDING_DEFINITIONS);

  const filteredBuildings = allBuildings.filter((bld) => {
    const matchesCategory = selectedCategory === 'all' || bld.category === selectedCategory;
    const matchesSearch =
      bld.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bld.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bld.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelect = (def: BuildingDefinition) => {
    globalAudioSynth.playSelect();
    onSelectBuilding(def);
    onClose();
  };

  const handleClose = () => {
    globalAudioSynth.playClick();
    onClose();
  };

  const getCategoryIcon = (category: BuildingCategory) => {
    switch (category) {
      case 'logistics':
        return <Warehouse className="w-4 h-4" />;
      case 'industrial':
        return <Factory className="w-4 h-4" />;
      case 'depot':
        return <Truck className="w-4 h-4" />;
      case 'storage':
        return <Layers className="w-4 h-4" />;
      case 'commercial':
        return <Building2 className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-catalog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 pointer-events-auto backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="facility-catalog-title" className="text-lg font-bold text-white">
                  Industrial Facilities Catalog
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                  {allBuildings.length} Available Types
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Commission distribution hubs, automated manufacturing plants, freight depots, and terminals
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Catalog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
            {BUILDING_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  globalAudioSynth.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition"
            />
          </div>
        </div>

        {/* Facility Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4 overflow-y-auto pr-1">
          {filteredBuildings.map((bld) => {
            const isAffordable = playerCash >= bld.cost;
            return (
              <div
                key={bld.id}
                className="flex flex-col justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-sky-500/50 hover:bg-slate-800 transition duration-150 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${bld.colorAccent}25`,
                          border: `1px solid ${bld.colorAccent}60`,
                          color: bld.colorAccent,
                        }}
                      >
                        {getCategoryIcon(bld.category)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {bld.categoryLabel}
                        </span>
                        <h3 className="text-xs font-bold text-white group-hover:text-sky-300 transition line-clamp-1">
                          {bld.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-2.5 line-clamp-2 leading-relaxed">
                    {bld.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/40 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-medium">
                        Footprint
                      </span>
                      <span className="font-bold text-slate-200">
                        {bld.footprintWidth}×{bld.footprintDepth} cells
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-medium">
                        Upkeep
                      </span>
                      <span className="font-bold text-amber-300 font-mono">
                        ${bld.dailyUpkeep}/d
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-medium">
                        Capacity
                      </span>
                      <span className="font-bold text-purple-300 font-mono">
                        {bld.capacityUnits}u
                      </span>
                    </div>
                  </div>

                  {/* Road Access Requirement Indicator */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <Route className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>
                      {bld.requiresRoadAccess
                        ? 'Requires Adjacent Roadway Access'
                        : 'Autonomous Site (No Road Needed)'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-medium">Cost</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        isAffordable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ${bld.cost.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleSelect(bld)}
                    disabled={!isAffordable}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-xs transition ${
                      isAffordable
                        ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAffordable ? 'Select Site' : 'Low Funds'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">R</kbd> during preview to rotate building footprint 90 degrees.
            </span>
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
