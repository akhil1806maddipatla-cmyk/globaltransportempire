import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  X,
  Truck,
  RotateCw,
  Sun,
  AlertTriangle,
  Flame,
  Layers,
  Palette,
  Sliders,
  CheckCircle2,
  Maximize2,
  Gauge,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  VEHICLE_DEFINITIONS,
  TRAILER_DEFINITIONS,
  CONTAINER_DEFINITIONS,
  FleetColor,
  VehicleDefinition,
  TrailerDefinition,
  ContainerDefinition,
} from '../data/vehicleDefinitions';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { CargoTruckModel } from '../entities/vehicles/CargoTruckModel';
import { TrailerModel } from '../entities/vehicles/TrailerModel';
import { ShippingContainerModel } from '../entities/vehicles/ShippingContainerModel';
import { globalAudioSynth } from '../audio/SoundSynth';

interface VehicleShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleShowcaseModal: React.FC<VehicleShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Configuration state
  const [selectedTruckId, setSelectedTruckId] = useState<string>('prime_mover_6x4');
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>('skeletal_container_chassis_40ft');
  const [selectedContainerId, setSelectedContainerId] = useState<string>('iso_container_dry_40ft');
  const [fleetColor, setFleetColor] = useState<FleetColor>('blue');

  // Simulation controls state
  const [steerAngle, setSteerAngle] = useState<number>(0);
  const [articulationAngle, setArticulationAngle] = useState<number>(0);
  const [headlightsOn, setHeadlightsOn] = useState<boolean>(true);
  const [hazardsOn, setHazardsOn] = useState<boolean>(false);
  const [brakeLightsOn, setBrakeLightsOn] = useState<boolean>(false);
  const [landingLegsDeployed, setLandingLegsDeployed] = useState<boolean>(false);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialsRef = useRef<MaterialsManager | null>(null);

  const truckModelRef = useRef<CargoTruckModel | null>(null);
  const trailerModelRef = useRef<TrailerModel | null>(null);
  const containerModelRef = useRef<ShippingContainerModel | null>(null);
  const articulationPivotRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Orbit camera drag state
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraThetaRef = useRef<number>(Math.PI * 0.25); // horizontal angle
  const cameraPhiRef = useRef<number>(Math.PI * 0.32);   // vertical angle
  const cameraDistRef = useRef<number>(14);

  const activeTruckDef: VehicleDefinition = VEHICLE_DEFINITIONS[selectedTruckId] || VEHICLE_DEFINITIONS.prime_mover_6x4;
  const activeTrailerDef: TrailerDefinition | null = selectedTrailerId ? TRAILER_DEFINITIONS[selectedTrailerId] ?? null : null;
  const activeContainerDef: ContainerDefinition | null = selectedContainerId ? CONTAINER_DEFINITIONS[selectedContainerId] ?? null : null;

  // Initialize 3D Studio Scene
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 700;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a); // Deep studio navy

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const materials = new MaterialsManager();
    materialsRef.current = materials;

    // Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x1e293b, 1.2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(12, 18, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-14, 10, -12);
    scene.add(rimLight);

    // Studio Turntable Floor
    const floorGeo = new THREE.CircleGeometry(16, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.position.y = -0.01;
    scene.add(floor);

    // Circular studio demarcation ring
    const ringGeo = new THREE.RingGeometry(8, 8.08, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(ring);

    // Articulation Pivot Group
    const articulationPivot = new THREE.Group();
    articulationPivot.name = 'showcase_articulation_pivot';
    scene.add(articulationPivot);
    articulationPivotRef.current = articulationPivot;

    // Animation & Render Loop
    let lastTime = performance.now();
    let flashTimer = 0;
    let flashState = false;

    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Update hazard flashing
      flashTimer += dt;
      if (flashTimer >= 0.5) {
        flashTimer -= 0.5;
        flashState = !flashState;
        if (truckModelRef.current) {
          truckModelRef.current.updateLightsFlash(flashState);
        }
      }

      // Update camera position from spherical angles
      const phi = cameraPhiRef.current;
      const theta = cameraThetaRef.current;
      const dist = cameraDistRef.current;

      camera.position.x = dist * Math.sin(phi) * Math.sin(theta);
      camera.position.y = dist * Math.cos(phi);
      camera.position.z = dist * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 1.5, 0);

      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Window resize handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      materials.dispose();
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [isOpen]);

  // Rebuild 3D Vehicle Assembly whenever configuration changes
  useEffect(() => {
    if (!sceneRef.current || !materialsRef.current || !articulationPivotRef.current) return;

    const scene = sceneRef.current;
    const materials = materialsRef.current;
    const articulationPivot = articulationPivotRef.current;

    // 1. Remove previous models
    if (truckModelRef.current) {
      scene.remove(truckModelRef.current.group);
      truckModelRef.current = null;
    }
    if (trailerModelRef.current) {
      articulationPivot.remove(trailerModelRef.current.group);
      trailerModelRef.current = null;
    }
    if (containerModelRef.current) {
      if (containerModelRef.current.group.parent) {
        containerModelRef.current.group.parent.remove(containerModelRef.current.group);
      }
      containerModelRef.current = null;
    }

    // 2. Build Cargo Truck Model
    const truckDef = VEHICLE_DEFINITIONS[selectedTruckId] || VEHICLE_DEFINITIONS.prime_mover_6x4;
    const truck = new CargoTruckModel(truckDef, materials, fleetColor);
    truckModelRef.current = truck;
    scene.add(truck.group);

    // Apply lighting states
    truck.setHeadlights(headlightsOn);
    truck.setHazardLights(hazardsOn);
    truck.setBrakeLights(brakeLightsOn);
    truck.setSteeringAngle((steerAngle * Math.PI) / 180);

    // Position articulation pivot at fifth wheel
    articulationPivot.position.set(
      truckDef.fifthWheelOffset.x,
      truckDef.fifthWheelOffset.y,
      truckDef.fifthWheelOffset.z
    );
    articulationPivot.rotation.y = (articulationAngle * Math.PI) / 180;

    // 3. Build Trailer Model (if selected)
    if (selectedTrailerId && TRAILER_DEFINITIONS[selectedTrailerId]) {
      const trailerDef = TRAILER_DEFINITIONS[selectedTrailerId];
      const trailer = new TrailerModel(trailerDef, materials);
      trailerModelRef.current = trailer;

      const kp = trailerDef.kingpinOffset;
      trailer.group.position.set(-kp.x, -kp.y, -kp.z);
      trailer.setLandingLegs(landingLegsDeployed);

      articulationPivot.add(trailer.group);

      // 4. Mount Shipping Container onto Trailer (if selected)
      if (selectedContainerId && CONTAINER_DEFINITIONS[selectedContainerId]) {
        const contDef = CONTAINER_DEFINITIONS[selectedContainerId];
        const container = new ShippingContainerModel(contDef, materials, fleetColor);
        containerModelRef.current = container;

        const deckY = 1.45 + contDef.dimensions.height / 2;
        container.group.position.set(0, deckY, 0);
        trailer.group.add(container.group);
      }
    } else if (selectedContainerId && CONTAINER_DEFINITIONS[selectedContainerId]) {
      // Container on bare truck deck
      const contDef = CONTAINER_DEFINITIONS[selectedContainerId];
      const container = new ShippingContainerModel(contDef, materials, fleetColor);
      containerModelRef.current = container;

      const deckY = 1.25 + contDef.dimensions.height / 2;
      container.group.position.set(0, deckY, -1.2);
      truck.group.add(container.group);
    }
  }, [
    isOpen,
    selectedTruckId,
    selectedTrailerId,
    selectedContainerId,
    fleetColor,
    headlightsOn,
    hazardsOn,
    brakeLightsOn,
    landingLegsDeployed,
    steerAngle,
    articulationAngle,
  ]);

  // Orbit Drag Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    cameraThetaRef.current -= dx * 0.008;
    cameraPhiRef.current = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraPhiRef.current - dy * 0.008));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    cameraDistRef.current = Math.max(6, Math.min(26, cameraDistRef.current + e.deltaY * 0.02));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-title"
    >
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                <span>3D Fleet Asset Studio</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Road Freight Engineering & Modular Config</span>
              </div>
              <h2 id="showcase-title" className="text-lg font-bold text-white leading-tight">
                Commercial Cargo Truck, Trailer & Shipping Container Visualizer
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              globalAudioSynth.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Asset Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left 3D Viewport, Right Control & Technical Spec Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* 3D Viewport (7 Cols) */}
          <div className="relative lg:col-span-7 bg-slate-950 flex flex-col min-h-[380px] lg:min-h-0">
            <div
              ref={mountRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            />

            {/* Orbit Instructions Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/50 text-[11px] text-slate-300 backdrop-blur-sm pointer-events-none">
              <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
              <span>Drag to Orbit 360° · Scroll to Zoom</span>
            </div>

            {/* Quick Lighting & Visual Toggles floating at bottom of viewport */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-900/85 border border-slate-700/60 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    globalAudioSynth.playClick();
                    setHeadlightsOn(!headlightsOn);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    headlightsOn
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Headlights</span>
                </button>

                <button
                  onClick={() => {
                    globalAudioSynth.playClick();
                    setHazardsOn(!hazardsOn);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    hazardsOn
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-400/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Hazards</span>
                </button>

                <button
                  onClick={() => {
                    globalAudioSynth.playClick();
                    setBrakeLightsOn(!brakeLightsOn);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    brakeLightsOn
                      ? 'bg-red-500/20 text-red-300 border border-red-400/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Brake Lights</span>
                </button>
              </div>

              {selectedTrailerId && (
                <button
                  onClick={() => {
                    globalAudioSynth.playClick();
                    setLandingLegsDeployed(!landingLegsDeployed);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    landingLegsDeployed
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Landing Legs: {landingLegsDeployed ? 'Down' : 'Stowed'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Configuration Dashboard & Specs (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col p-6 overflow-y-auto gap-5 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60">
            {/* 1. Fleet Livery Palette Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Palette className="w-3.5 h-3.5 text-sky-400" />
                  <span>Fleet Livery & Enamel Paint</span>
                </label>
                <span className="text-[11px] text-slate-400 capitalize">{fleetColor} Finish</span>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { id: 'blue', label: 'Apex Blue', hex: '#1d4ed8' },
                  { id: 'red', label: 'Crimson Red', hex: '#dc2626' },
                  { id: 'orange', label: 'Logistics Orange', hex: '#ea580c' },
                  { id: 'white', label: 'Arctic White', hex: '#f8fafc' },
                  { id: 'dark', label: 'Stealth Dark', hex: '#1e293b' },
                ].map((col) => (
                  <button
                    key={col.id}
                    onClick={() => {
                      globalAudioSynth.playClick();
                      setFleetColor(col.id as FleetColor);
                    }}
                    title={col.label}
                    className={`w-8 h-8 rounded-xl transition flex items-center justify-center border-2 ${
                      fleetColor === col.id
                        ? 'border-sky-400 scale-110 shadow-lg shadow-sky-500/30'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: col.hex }}
                  >
                    {fleetColor === col.id && (
                      <CheckCircle2
                        className={`w-4 h-4 ${col.id === 'white' ? 'text-slate-900' : 'text-white'}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Model Selection Selectors */}
            <div className="space-y-3">
              {/* Prime Mover Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Truck Tractor Unit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(VEHICLE_DEFINITIONS).map((truck) => (
                    <button
                      key={truck.id}
                      onClick={() => {
                        globalAudioSynth.playClick();
                        setSelectedTruckId(truck.id);
                      }}
                      className={`p-3 rounded-2xl text-left border transition ${
                        selectedTruckId === truck.id
                          ? 'bg-sky-500/15 border-sky-400/60 text-white'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{truck.name}</div>
                      <div className="text-[10px] text-sky-400 font-medium mt-0.5">
                        {truck.axleConfig} · {truck.specs.horsepower} HP
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modular Trailer Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Coupled Freight Trailer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      globalAudioSynth.playClick();
                      setSelectedTrailerId('');
                    }}
                    className={`p-2.5 rounded-2xl text-center border transition ${
                      selectedTrailerId === ''
                        ? 'bg-sky-500/15 border-sky-400/60 text-white'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold">Bobtail</div>
                    <div className="text-[10px] text-slate-500">No Trailer</div>
                  </button>

                  {Object.values(TRAILER_DEFINITIONS).map((trailer) => (
                    <button
                      key={trailer.id}
                      onClick={() => {
                        globalAudioSynth.playClick();
                        setSelectedTrailerId(trailer.id);
                      }}
                      className={`p-2.5 rounded-2xl text-left border transition ${
                        selectedTrailerId === trailer.id
                          ? 'bg-sky-500/15 border-sky-400/60 text-white'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{trailer.categoryLabel}</div>
                      <div className="text-[10px] text-sky-400 font-medium mt-0.5">
                        {trailer.specs.maxPayloadKg / 1000}T Payload
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shipping Container Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Intermodal Shipping Container
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      globalAudioSynth.playClick();
                      setSelectedContainerId('');
                    }}
                    className={`p-2 rounded-xl text-center border text-xs transition ${
                      selectedContainerId === ''
                        ? 'bg-sky-500/15 border-sky-400/60 text-white font-bold'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                    }`}
                  >
                    Empty / No Container
                  </button>

                  {Object.values(CONTAINER_DEFINITIONS).map((cont) => (
                    <button
                      key={cont.id}
                      onClick={() => {
                        globalAudioSynth.playClick();
                        setSelectedContainerId(cont.id);
                      }}
                      className={`p-2 rounded-xl text-left border transition ${
                        selectedContainerId === cont.id
                          ? 'bg-sky-500/15 border-sky-400/60 text-white font-bold'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{cont.categoryLabel}</div>
                      <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                        {cont.bicPrefix} · {cont.specs.cubicCapacityCbm} m³
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Steering & Articulation Sliders */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/40 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Kinematic Simulation Sliders</span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Front Wheel Steer Angle</span>
                  <span className="font-mono text-sky-400">{steerAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-34"
                  max="34"
                  value={steerAngle}
                  onChange={(e) => setSteerAngle(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {selectedTrailerId && (
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Trailer Articulation Hitch Angle</span>
                    <span className="font-mono text-sky-400">{articulationAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    value={articulationAngle}
                    onChange={(e) => setArticulationAngle(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* 4. Engineering Specifications Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span>Technical Specifications</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Engine Rating</div>
                  <div className="font-bold text-slate-100 mt-0.5">{activeTruckDef.specs.horsepower} HP Turbo Diesel</div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Max Gross Weight</div>
                  <div className="font-bold text-slate-100 mt-0.5">
                    {(activeTruckDef.specs.maxGrossCombinedWeightKg / 1000).toFixed(1)} Metric Tons
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Chassis Drivetrain</div>
                  <div className="font-bold text-slate-100 mt-0.5">{activeTruckDef.axleConfig} Tandem Bogie</div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Fuel Storage</div>
                  <div className="font-bold text-slate-100 mt-0.5">
                    {activeTruckDef.specs.fuelTankCapacityLiters} Liters Dual Tank
                  </div>
                </div>
              </div>

              {activeContainerDef && (
                <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/50 text-xs">
                  <div className="flex items-center gap-1.5 text-sky-300 font-bold text-[11px] mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>ISO Intermodal Cargo Rating</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {activeContainerDef.name} ({activeContainerDef.specs.cubicCapacityCbm} m³ /{' '}
                    {(activeContainerDef.specs.payloadCapacityKg / 1000).toFixed(1)}T payload) mounted to standard ISO corner twistlocks.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
