import React, { useState, useEffect } from 'react';
import {
  X,
  Crosshair,
  Building,
  Boxes,
  DollarSign,
  Activity,
  Trash2,
  MapPin,
  Route,
  Truck,
  Sun,
  AlertTriangle,
  Flame,
  Palette,
  Package,
  Navigation,
  Clock,
  Gauge,
  ArrowRight,
  RotateCcw,
  Send,
  CheckCircle2,
  Flag,
} from 'lucide-react';
import { BuildingDefinition } from '../data/buildingDefinitions';
import {
  VehicleDefinition,
  TrailerDefinition,
  ContainerDefinition,
  FleetColor,
} from '../data/vehicleDefinitions';
import { VehicleEntity } from '../entities/vehicles/VehicleEntity';
import { globalAudioSynth } from '../audio/SoundSynth';
import { GameApplication } from '../app/GameApplication';
import { VehicleRouteProgressInfo, OperationalStateBadge, RoadCongestionState, BlockageCause } from '../world/traffic/TrafficTypes';

export interface InspectedBuildingData {
  id: string;
  definition: BuildingDefinition;
  gridX: number;
  gridZ: number;
  rotationDegrees?: number;
  effectiveWidth?: number;
  effectiveDepth?: number;
  districtName?: string;
}

export interface InspectedVehicleData {
  id: string;
  vehicleEntity: VehicleEntity;
  definition: VehicleDefinition;
  trailerDefinition: TrailerDefinition | null;
  containerDefinition: ContainerDefinition | null;
  gridX: number;
  gridZ: number;
  districtName?: string;
}

function getStatusBadgeStyle(status: OperationalStateBadge): string {
  switch (status) {
    case 'Available':
      return 'bg-slate-700/80 text-slate-300 border-slate-600';
    case 'Preparing Departure':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50';
    case 'Travelling':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50';
    case 'Waiting at Intersection':
      return 'bg-amber-500/20 text-amber-300 border-amber-400/50';
    case 'Temporarily Blocked':
      return 'bg-orange-500/20 text-orange-300 border-orange-400/50';
    case 'Arrived at Destination':
      return 'bg-teal-500/20 text-teal-300 border-teal-400/50';
    case 'Returning to Depot':
      return 'bg-sky-500/20 text-sky-300 border-sky-400/50';
    case 'Route Blocked':
      return 'bg-rose-500/20 text-rose-300 border-rose-400/50';
    default:
      return 'bg-slate-700/80 text-slate-300 border-slate-600';
  }
}

function getCongestionBadge(congestion?: RoadCongestionState): { label: string; style: string } {
  switch (congestion) {
    case 'free_flowing':
      return { label: 'Free Flowing', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
    case 'busy':
      return { label: 'Busy (Moderate)', style: 'bg-amber-500/20 text-amber-300 border-amber-400/40' };
    case 'congested':
      return { label: 'Congested (Delay)', style: 'bg-orange-500/20 text-orange-300 border-orange-400/40' };
    case 'temporarily_blocked':
      return { label: 'Temporarily Blocked', style: 'bg-rose-500/20 text-rose-300 border-rose-400/40' };
    case 'unavailable':
      return { label: 'Road Unavailable', style: 'bg-red-500/20 text-red-300 border-red-400/40' };
    default:
      return { label: 'Normal Traffic', style: 'bg-slate-700/80 text-slate-300 border-slate-600' };
  }
}

function formatBlockageCause(cause?: string): string {
  switch (cause) {
    case 'intersection_conflict':
      return 'Waiting on busy intersection clearance';
    case 'lead_vehicle_standstill':
      return 'Held up by stationary lead vehicle';
    case 'road_demolished':
      return 'Forward road connection severed';
    case 'no_route_forward':
      return 'No continuous road connection to destination';
    case 'queue_timeout':
      return 'Queued past wait limit; recalculating';
    case 'stale_reservation':
      return 'Clearing stale junction lock';
    default:
      return 'Traffic slowdown';
  }
}

interface InspectorPanelProps {
  building?: InspectedBuildingData | null;
  vehicle?: InspectedVehicleData | null;
  onClose: () => void;
  onFocus: () => void;
  onDemolish?: (id: string) => void;
  app?: GameApplication | null;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  building,
  vehicle,
  onClose,
  onFocus,
  onDemolish,
  app,
}) => {
  const [confirmDemolish, setConfirmDemolish] = useState<boolean>(false);
  const [headlightsOn, setHeadlightsOn] = useState<boolean>(true);
  const [hazardsOn, setHazardsOn] = useState<boolean>(false);
  const [brakeLightsOn, setBrakeLightsOn] = useState<boolean>(false);

  // Route visualization & delivery feedback state
  const [routeProgress, setRouteProgress] = useState<VehicleRouteProgressInfo | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('Apex Logistics Center');
  const [dispatchCriterion, setDispatchCriterion] = useState<'fastest' | 'shortest'>('fastest');
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [rerouteMessage, setRerouteMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicle || !app) {
      setRouteProgress(null);
      return;
    }

    const poll = () => {
      const prog = app.getVehicleRouteProgress(vehicle.id);
      setRouteProgress(prog);
    };

    poll();
    const timer = setInterval(poll, 250);
    return () => clearInterval(timer);
  }, [vehicle?.id, app]);

  if (!building && !vehicle) return null;

  const handleClose = () => {
    setConfirmDemolish(false);
    globalAudioSynth.playDeselect();
    onClose();
  };

  const handleFocus = () => {
    globalAudioSynth.playClick();
    onFocus();
  };

  const handleDispatch = () => {
    if (!app || !vehicle) return;
    setDispatchError(null);
    globalAudioSynth.playClick();
    const res = app.worldManager?.dispatchVehicle(vehicle.id, selectedDestination, {
      criterion: dispatchCriterion,
      avoidCongestion: true,
    });
    if (!res?.success) {
      setDispatchError(res?.error || 'Dispatch failed.');
    } else {
      const prog = app.getVehicleRouteProgress(vehicle.id);
      setRouteProgress(prog);
    }
  };

  const handleReturnToDepot = () => {
    if (!app || !vehicle) return;
    setDispatchError(null);
    globalAudioSynth.playClick();
    const res = app.returnVehicle(vehicle.id);
    if (!res.success) {
      setDispatchError(res.error || 'Failed to return vehicle.');
    } else {
      const prog = app.getVehicleRouteProgress(vehicle.id);
      setRouteProgress(prog);
    }
  };

  const handleReroute = () => {
    if (!app || !vehicle) return;
    globalAudioSynth.playClick();
    const res = app.rerouteVehicle(vehicle.id);
    setRerouteMessage(res.message);
    const prog = app.getVehicleRouteProgress(vehicle.id);
    setRouteProgress(prog);
    setTimeout(() => setRerouteMessage(null), 4000);
  };

  // -------------------------------------------------------------------------
  // 1. Vehicle Inspector Render
  // -------------------------------------------------------------------------
  if (vehicle) {
    const vDef = vehicle.definition;
    const tDef = vehicle.trailerDefinition;
    const cDef = vehicle.containerDefinition;

    const toggleHeadlights = () => {
      globalAudioSynth.playClick();
      const next = !headlightsOn;
      setHeadlightsOn(next);
      vehicle.vehicleEntity.setHeadlights(next);
    };

    const toggleHazards = () => {
      globalAudioSynth.playClick();
      const next = !hazardsOn;
      setHazardsOn(next);
      vehicle.vehicleEntity.setHazardLights(next);
    };

    const toggleBrakeLights = () => {
      globalAudioSynth.playClick();
      const next = !brakeLightsOn;
      setBrakeLightsOn(next);
      vehicle.vehicleEntity.setBrakeLights(next);
    };

    const handleColorChange = (col: FleetColor) => {
      globalAudioSynth.playClick();
      vehicle.vehicleEntity.setPaintColor(col);
    };

    return (
      <section
        className="fixed bottom-24 right-6 z-30 w-96 max-h-[82vh] overflow-y-auto rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl p-4 text-slate-100 pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
        aria-label="Vehicle Inspector"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 text-sky-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>{vDef.categoryLabel}</span>
                {vehicle.districtName && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-sky-400 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {vehicle.districtName}
                    </span>
                  </>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-100 leading-tight">{vDef.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {routeProgress && (
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border tracking-wide uppercase ${getStatusBadgeStyle(
                  routeProgress.operationalStatus
                )}`}
              >
                {routeProgress.operationalStatus}
              </span>
            )}
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Route & Delivery Progress Card */}
        {routeProgress && (
          <div className="mt-3 p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xs">
            {routeProgress.hasActiveRoute ? (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{routeProgress.isReturnTrip ? 'Return Route' : 'Delivery Destination'}:</span>
                  </div>
                  {routeProgress.criterion && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      {routeProgress.criterion === 'shortest' ? 'Shortest' : 'Fastest'}
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-slate-100 flex items-center gap-1">
                  <span>{routeProgress.destinationName}</span>
                </div>

                {routeProgress.accessPoint && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Flag className="w-2.5 h-2.5 text-amber-400" />
                    <span>{routeProgress.accessPoint.accessType}</span>
                    <span className="font-mono text-slate-500">
                      ({routeProgress.accessPoint.gridX}, {routeProgress.accessPoint.gridZ})
                    </span>
                  </div>
                )}

                {/* Animated Delivery Progress Bar */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mb-1">
                    <span>Route Traversed</span>
                    <span className="text-emerald-400 font-bold">{routeProgress.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        routeProgress.isReturnTrip
                          ? 'bg-gradient-to-r from-sky-500 to-cyan-400'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${routeProgress.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Real-time Distance, ETA, and Speed metrics */}
                <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-slate-700/50 text-[10px]">
                  <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-700/30">
                    <span className="text-slate-400 block text-[9px] uppercase">Traversed</span>
                    <span className="font-bold text-slate-200">{routeProgress.distanceTraveledMeters}m</span>
                    <span className="text-slate-400 block text-[9px]">/ {routeProgress.totalDistanceMeters}m</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-700/30">
                    <span className="text-slate-400 block text-[9px] uppercase">Remaining</span>
                    <span className="font-bold text-amber-300">{routeProgress.distanceRemainingMeters}m</span>
                    <span className="text-slate-400 block text-[9px] flex items-center gap-0.5">
                      <Clock className="w-2 h-2" />
                      {routeProgress.estimatedTimeRemainingSeconds}s ETA
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-700/30">
                    <span className="text-slate-400 block text-[9px] uppercase">Speed</span>
                    <span className="font-bold text-sky-300">{routeProgress.currentSpeedKmh} km/h</span>
                    <span className="text-slate-400 block text-[9px]">Limit {routeProgress.speedLimitKmh}</span>
                  </div>
                </div>

                {/* Road Traffic Condition Badge */}
                {routeProgress.congestionLevel && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/40 text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Route className="w-3 h-3 text-sky-400" />
                      Traffic Flow:
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold border text-[9px] ${getCongestionBadge(routeProgress.congestionLevel).style}`}>
                      {getCongestionBadge(routeProgress.congestionLevel).label}
                    </span>
                  </div>
                )}

                {/* Delay & Blockage Reason Warning */}
                {(routeProgress.blockageReason || (routeProgress.delaySeconds && routeProgress.delaySeconds > 2)) && (
                  <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{routeProgress.delaySeconds ? `Traffic Delay (+${routeProgress.delaySeconds}s)` : 'Road Obstruction'}</span>
                      </div>
                      <div className="text-slate-300 text-[9px] mt-0.5 leading-tight">
                        {formatBlockageCause(routeProgress.blockageReason)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Route Actions: Detour & Return to Depot */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    onClick={handleReroute}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    title="Calculate alternate detour around congestion or road closures"
                  >
                    <Route className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reroute Detour</span>
                  </button>

                  {!routeProgress.isReturnTrip && (
                    <button
                      onClick={handleReturnToDepot}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Return Depot</span>
                    </button>
                  )}
                </div>

                {rerouteMessage && (
                  <div className="mt-1.5 text-[10px] text-cyan-300 font-medium px-1 bg-cyan-950/40 border border-cyan-800/40 rounded-lg p-1">
                    {rerouteMessage}
                  </div>
                )}
              </div>
            ) : routeProgress.state === 'stopped_unreachable' ? (
              <div>
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Route Severed / Unreachable</span>
                </div>
                <p className="text-[11px] text-slate-300 mb-2">
                  Carrier is pulled safely over onto the road shoulder with hazard flashers active.
                  {routeProgress.blockageReason && ` Reason: ${formatBlockageCause(routeProgress.blockageReason)}.`}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleReroute}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Route className="w-3.5 h-3.5 text-amber-400" />
                    <span>Attempt Detour</span>
                  </button>
                  <button
                    onClick={handleReturnToDepot}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                    <span>Return Depot</span>
                  </button>
                </div>
                {rerouteMessage && (
                  <div className="mt-1.5 text-[10px] text-cyan-300 font-medium px-1 bg-cyan-950/40 border border-cyan-800/40 rounded-lg p-1">
                    {rerouteMessage}
                  </div>
                )}
              </div>
            ) : routeProgress.state === 'parking' ? (
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Delivery Completed</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Arrived at {routeProgress.destinationName}. Cargo unloaded at facility driveway.
                </p>
                <button
                  onClick={handleReturnToDepot}
                  className="w-full mt-2.5 py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return to Starter Depot</span>
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>Dispatch Carrier</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Starter Depot</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Select Delivery Destination</label>
                    <select
                      value={selectedDestination}
                      onChange={(e) => setSelectedDestination(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="Apex Logistics Center">Apex Logistics Center (Grid: 8, 5)</option>
                      <option value="Regional Distribution Hub">Regional Distribution Hub (Grid: 5, 12)</option>
                      <option value="East Interstate Gateway">East Interstate Gateway (Grid: 23, 11)</option>
                      <option value="Commercial Logistics HQ">Commercial Logistics HQ (Grid: 12, 6)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDispatchCriterion('fastest')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold border transition ${
                        dispatchCriterion === 'fastest'
                          ? 'bg-sky-500/30 text-sky-200 border-sky-400/60'
                          : 'bg-slate-900/60 text-slate-400 border-slate-700'
                      }`}
                    >
                      Fastest Route
                    </button>
                    <button
                      onClick={() => setDispatchCriterion('shortest')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold border transition ${
                        dispatchCriterion === 'shortest'
                          ? 'bg-sky-500/30 text-sky-200 border-sky-400/60'
                          : 'bg-slate-900/60 text-slate-400 border-slate-700'
                      }`}
                    >
                      Shortest Route
                    </button>
                  </div>

                  {dispatchError && (
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[10px]">
                      {dispatchError}
                    </div>
                  )}

                  <button
                    onClick={handleDispatch}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Carrier Along Road</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{vDef.description}</p>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
          <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
              <Activity className="w-3 h-3 text-sky-400" />
              <span>Drivetrain</span>
            </div>
            <div className="text-xs font-bold text-slate-200 mt-0.5">
              {vDef.axleConfig} · {vDef.specs.horsepower} HP
            </div>
            <div className="text-[10px] text-slate-400">
              Max {(vDef.specs.maxGrossCombinedWeightKg / 1000).toFixed(0)}T GCWR
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
              <Route className="w-3 h-3 text-emerald-400" />
              <span>Location</span>
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Road Corridor
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Grid: ({vehicle.gridX}, {vehicle.gridZ})
            </div>
          </div>
        </div>

        {/* Coupled Trailer & Container Status Card */}
        {tDef && (
          <div className="mt-2.5 p-2.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300 mb-1">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              <span>Coupled Trailer: {tDef.categoryLabel}</span>
            </div>
            <div className="text-slate-400 text-[10px] leading-tight">
              Payload Rating: {(tDef.specs.maxPayloadKg / 1000).toFixed(1)}T · 5th Wheel Kingpin Hitch
            </div>

            {cDef && (
              <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">{cDef.name}</span>
                <span className="font-mono text-amber-300 text-[10px]">{cDef.bicPrefix}</span>
              </div>
            )}
          </div>
        )}

        {/* Live Lighting Toggles */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5">
          <button
            onClick={toggleHeadlights}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition ${
              headlightsOn
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Lights</span>
          </button>

          <button
            onClick={toggleHazards}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition ${
              hazardsOn
                ? 'bg-orange-500/20 text-orange-300 border-orange-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Hazards</span>
          </button>

          <button
            onClick={toggleBrakeLights}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition ${
              brakeLightsOn
                ? 'bg-red-500/20 text-red-300 border-red-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Brakes</span>
          </button>
        </div>

        {/* Fleet Livery Buttons */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Palette className="w-3 h-3 text-sky-400" />
            <span>Fleet Livery</span>
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'blue', hex: '#1d4ed8' },
              { id: 'red', hex: '#dc2626' },
              { id: 'orange', hex: '#ea580c' },
              { id: 'white', hex: '#f8fafc' },
              { id: 'dark', hex: '#1e293b' },
            ].map((col) => (
              <button
                key={col.id}
                onClick={() => handleColorChange(col.id as FleetColor)}
                className="w-5 h-5 rounded-md border border-slate-600 hover:scale-110 transition"
                style={{ backgroundColor: col.hex }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={handleFocus}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition"
            title="Center Camera on Carrier (Key F)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Focus Carrier (F)</span>
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Building Inspector Render
  // -------------------------------------------------------------------------
  if (!building) return null;
  const def = building.definition;
  const effW = building.effectiveWidth || def.footprintWidth;
  const effD = building.effectiveDepth || def.footprintDepth;
  const salvageRefund = Math.floor(def.cost * 0.5);

  const handleDemolish = () => {
    if (!confirmDemolish) {
      setConfirmDemolish(true);
      globalAudioSynth.playClick();
      return;
    }
    globalAudioSynth.playDeselect();
    if (onDemolish) {
      onDemolish(building.id);
    }
  };

  return (
    <section
      className="fixed bottom-24 right-6 z-30 w-88 rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl p-4 text-slate-100 pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
      aria-label="Entity Inspector"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${def.colorAccent}25`,
              border: `1px solid ${def.colorAccent}60`,
            }}
          >
            <Building className="w-4 h-4" style={{ color: def.colorAccent }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>{def.categoryLabel}</span>
              {building.districtName && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-sky-400 flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {building.districtName}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-100 leading-tight">{def.name}</h3>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{def.description}</p>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <Boxes className="w-3 h-3 text-sky-400" />
            <span>Footprint</span>
          </div>
          <div className="text-xs font-bold text-slate-200 mt-0.5">
            {effW}×{effD} cells
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {effW * 2}m × {effD * 2}m • {building.rotationDegrees || 0}°
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <Route className="w-3 h-3 text-emerald-400" />
            <span>Road Access</span>
          </div>
          <div className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Connected
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Grid: ({building.gridX}, {building.gridZ})
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <DollarSign className="w-3 h-3 text-amber-400" />
            <span>Daily Upkeep</span>
          </div>
          <div className="text-xs font-bold text-amber-300 mt-0.5 font-mono">
            ${def.dailyUpkeep}/day
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Cost: ${def.cost.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <Boxes className="w-3 h-3 text-purple-400" />
            <span>Capacity</span>
          </div>
          <div className="text-xs font-bold text-purple-300 mt-0.5 font-mono">
            {def.capacityUnits} units
          </div>
          <div className="text-[10px] text-slate-400">Cargo Staging</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
        <button
          onClick={handleFocus}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition"
          title="Center Camera on Facility (Key F)"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Focus (F)</span>
        </button>

        {onDemolish && (
          <button
            onClick={handleDemolish}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
              confirmDemolish
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-600/30'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
            title="Decommission & Demolish Facility"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {confirmDemolish ? `Confirm (+$${salvageRefund.toLocaleString()})` : 'Decommission'}
            </span>
          </button>
        )}
      </div>
    </section>
  );
};
