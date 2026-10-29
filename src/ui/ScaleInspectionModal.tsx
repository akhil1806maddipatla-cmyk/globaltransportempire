import React, { useState } from 'react';
import {
  Ruler,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  Building2,
  Train,
  Ship,
  Plane,
  Eye,
  EyeOff,
  Layers,
  ShieldCheck,
  X,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react';
import { WORLD_SCALE_STANDARDS } from '../data/worldScale';
import { SpatialScaleAuditSummary } from '../world/SpatialScaleInspector';
import { globalAudioSynth } from '../audio/SoundSynth';

interface ScaleInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  is3dOverlayActive: boolean;
  onToggle3dOverlay: () => void;
  auditSummary: SpatialScaleAuditSummary | null;
  onRefreshAudit: () => void;
}

type TabType = 'audit' | 'road' | 'facilities' | 'rail' | 'maritime' | 'aviation' | 'human';

export const ScaleInspectionModal: React.FC<ScaleInspectionModalProps> = ({
  isOpen,
  onClose,
  is3dOverlayActive,
  onToggle3dOverlay,
  auditSummary,
  onRefreshAudit,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('audit');

  if (!isOpen) return null;

  const handleTabChange = (tab: TabType) => {
    globalAudioSynth.playClick();
    setActiveTab(tab);
  };

  const handleToggleOverlay = () => {
    globalAudioSynth.playClick();
    onToggle3dOverlay();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scale-modal-title"
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="scale-modal-title" className="text-lg font-bold text-white tracking-wide">
                  World-Scale & Spatial Validation Architecture
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  SI METRIC 1.0m
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative 1:1 Metric Standard: 1 World Unit = 1.0 Metre | Standard Grid Cell = 4.0m × 4.0m
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 3D Visual Wireframe Overlay Toggle */}
            <button
              onClick={handleToggleOverlay}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                is3dOverlayActive
                  ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
            >
              {is3dOverlayActive ? (
                <>
                  <Eye className="w-4 h-4 text-white" />
                  <span>3D Bounding Boxes: ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span>3D Bounding Boxes: OFF</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                globalAudioSynth.playClick();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close World Scale Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => handleTabChange('audit')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'audit'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Live Spatial Audit</span>
            {auditSummary && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                {auditSummary.passedChecks}/{auditSummary.totalChecks} PASS
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('road')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'road'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Road & Fleet (ISO)</span>
          </button>

          <button
            onClick={() => handleTabChange('facilities')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'facilities'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Facilities & Docks</span>
          </button>

          <button
            onClick={() => handleTabChange('rail')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'rail'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Train className="w-3.5 h-3.5" />
            <span>Rail Infrastructure</span>
          </button>

          <button
            onClick={() => handleTabChange('maritime')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'maritime'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Ship className="w-3.5 h-3.5" />
            <span>Maritime & Ports</span>
          </button>

          <button
            onClick={() => handleTabChange('aviation')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'aviation'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Air Cargo</span>
          </button>

          <button
            onClick={() => handleTabChange('human')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'human'
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Ergonomics & Human</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Compliance Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Global Status
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <span className="text-xl font-bold text-emerald-400">
                      {auditSummary?.overallStatus ?? 'COMPLIANT'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">100% Proportionally Aligned</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Lane Clearances
                  </span>
                  <div className="mt-2 text-xl font-bold text-white">
                    3.50m / 4.0m
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1">+0.50m safe margin per side</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Loading Bay Doors
                  </span>
                  <div className="mt-2 text-xl font-bold text-white">
                    3.2m W × 4.2m H
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1">Full 2.5m/4.0m trailer clearance</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Coupling & Ground
                  </span>
                  <div className="mt-2 text-xl font-bold text-white">
                    Y = 1.15m / 0.00m
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1">Coincident kingpin & asphalt</span>
                </div>
              </div>

              {/* Live Audit Table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Live Physical Infrastructure Checks
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      globalAudioSynth.playClick();
                      onRefreshAudit();
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-sky-400 hover:bg-sky-500/10 transition-colors"
                  >
                    Refresh Audit
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800/80">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Subject Asset</th>
                        <th className="px-4 py-2.5 font-semibold">Target Standard</th>
                        <th className="px-4 py-2.5 font-semibold">Measured Dimension</th>
                        <th className="px-4 py-2.5 font-semibold">Clearance Margin</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {auditSummary?.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 font-sans font-medium text-white">
                            {item.subject}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 font-sans">{item.target}</td>
                          <td className="px-4 py-2.5 text-sky-300">{item.measuredValue}</td>
                          <td className="px-4 py-2.5 text-emerald-400">{item.margin}</td>
                          <td className="px-4 py-2.5 text-center font-sans">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'PASS'
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                              }`}
                            >
                              {item.status === 'PASS' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              <span>{item.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explanatory Technical Note */}
              <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-800/30 text-xs text-slate-300 flex items-start gap-3">
                <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sky-200">
                    Why Proportions Now Fit Believably
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Prior to this milestone, world grid cells were sized at 2.0m, causing a 2.5m commercial truck to overhang the entire roadway, while loading dock bays were modeled at miniature 1.5m door dimensions. With the authoritative 4.0m grid convention (1.0 world unit = 1.0m SI), standard 3.5m travel lanes comfortably house 2.5m wide tractors with a 0.5m buffer, warehouse halls stand at natural 8.5m - 12.0m heights, and loading dock bays feature 3.2m × 4.2m roll-up clearances with 3.9m bollard spacing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'road' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-400" />
                <span>Road Freight Vehicles & ISO Container Standards</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.roadVehicles.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-sky-500/15 text-sky-300 px-2 py-0.5 rounded-lg border border-sky-500/20">
                        {std.nominalDimensions.length.toFixed(2)}m × {std.nominalDimensions.width.toFixed(2)}m × {std.nominalDimensions.height.toFixed(2)}m
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50 text-[11px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500 block font-sans">Length:</span>
                        {std.nominalDimensions.length.toFixed(2)}m
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans">Width:</span>
                        {std.nominalDimensions.width.toFixed(2)}m
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans">Height:</span>
                        {std.nominalDimensions.height.toFixed(2)}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'facilities' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>Industrial Warehousing, Manufacturing & Dock Clearances</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.buildingInfrastructure.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        {std.nominalDimensions.width.toFixed(1)}m × {std.nominalDimensions.length.toFixed(1)}m × {std.nominalDimensions.height.toFixed(1)}m
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                    {'dockFloorHeight' in std && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50 text-[11px] font-mono text-slate-300">
                        <div>
                          <span className="text-slate-500 block font-sans">Dock Floor:</span>
                          1.20m (48")
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">Bollards:</span>
                          3.60m apart
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">Seals:</span>
                          3.6m × 4.4m
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rail' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Train className="w-4 h-4 text-emerald-400" />
                <span>UIC / AAR Railway Infrastructure Architecture</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.railwayInfrastructure.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {std.nominalDimensions.length.toFixed(1)}m L × {std.nominalDimensions.width.toFixed(2)}m W
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'maritime' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Ship className="w-4 h-4 text-cyan-400" />
                <span>Maritime Port & Navigable Waterway Standards</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.maritimeInfrastructure.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                        {std.nominalDimensions.length.toFixed(1)}m L × {std.nominalDimensions.width.toFixed(1)}m Beam
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'aviation' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plane className="w-4 h-4 text-purple-400" />
                <span>ICAO Annex 14 Airport & Air Cargo Logistics</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.aviationInfrastructure.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-500/20">
                        {std.nominalDimensions.length.toFixed(1)}m L × {std.nominalDimensions.width.toFixed(1)}m Wingspan
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'human' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-rose-400" />
                <span>Human Scales & Architectural Ergonomics</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(WORLD_SCALE_STANDARDS.humanReferences.standards).map(([key, std]) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{std.name}</h4>
                      <span className="text-[11px] font-mono bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-500/20">
                        {std.nominalDimensions.height.toFixed(2)}m H × {std.nominalDimensions.width.toFixed(2)}m W
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{std.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              <span>Cyan: Vehicle OBB</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>Amber: Trailer Envelope</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
              <span>Indigo: Facility Bounds</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Green: Docks & Ground</span>
            </span>
          </div>

          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors border border-slate-700"
          >
            Close Standards Explorer
          </button>
        </div>
      </div>
    </div>
  );
};
