import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameApplication } from './app/GameApplication';
import { HUD } from './ui/HUD';
import { Toolbar } from './ui/Toolbar';
import { InspectorPanel } from './ui/InspectorPanel';
import { BottomControlDock } from './ui/BottomControlDock';
import { NotificationSystem } from './ui/NotificationSystem';
import { HelpModal } from './ui/HelpModal';
import { TitleScreen } from './ui/TitleScreen';
import { ConstructionBar } from './ui/ConstructionBar';
import { RoadConstructionBar } from './ui/RoadConstructionBar';
import { BuildingCatalogModal } from './ui/BuildingCatalogModal';
import { BuildingEntity } from './entities/BuildingEntity';
import { BuildingDefinition } from './data/buildingDefinitions';
import { VehicleEntity } from './entities/vehicles/VehicleEntity';
import { VehicleShowcaseModal } from './ui/VehicleShowcaseModal';
import { InspectedBuildingData, InspectedVehicleData } from './ui/InspectorPanel';
import { RoadTypeId } from './data/roadDefinitions';
import { PlacementValidationResult } from './world/PlacementValidator';
import { RoadValidationResult } from './world/RoadConstructionValidator';
import { RoutingMode, GridCoord } from './world/RoadPathGenerator';
import { globalEventBus } from './core/EventBus';
import { GameSpeed } from './game/GameClock';
import { AlertCircle } from 'lucide-react';
import { ScaleInspectionModal } from './ui/ScaleInspectionModal';
import { SpatialScaleAuditSummary } from './world/SpatialScaleInspector';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApplication | null>(null);

  const [gameMode, setGameMode] = useState<'title' | 'playing'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });
  const [webGlError, setWebGlError] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<InspectedBuildingData | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<InspectedVehicleData | null>(null);
  const [isFleetStudioOpen, setIsFleetStudioOpen] = useState<boolean>(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState<boolean>(false);
  const [is3dScaleOverlayActive, setIs3dScaleOverlayActive] = useState<boolean>(false);
  const [auditSummary, setAuditSummary] = useState<SpatialScaleAuditSummary | null>(null);

  const [isGridVisible, setIsGridVisible] = useState<boolean>(false);
  const [lightingPreset, setLightingPreset] = useState<'day' | 'golden' | 'dusk'>('day');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

  // Building Construction Mode State
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [constructionDef, setConstructionDef] = useState<BuildingDefinition | null>(null);
  const [constructionRotation, setConstructionRotation] = useState<number>(0);
  const [constructionValidation, setConstructionValidation] = useState<PlacementValidationResult | null>(null);

  // Road Construction Mode State
  const [roadToolState, setRoadToolState] = useState<{
    active: boolean;
    subMode: 'build' | 'demolish';
    roadTypeId: RoadTypeId;
    routingMode: RoutingMode;
    widthBlocks?: number;
    forwardBlocks?: number;
    backwardBlocks?: number;
    hasStart: boolean;
    startCoord: GridCoord | null;
    currentCoord: GridCoord | null;
    pathLength: number;
    validation: RoadValidationResult | null;
  } | null>(null);

  // Initialize GameApplication lifecycle
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const app = new GameApplication();
    appRef.current = app;

    const success = app.init(canvasMountRef.current);
    if (!success) {
      setWebGlError('WebGL hardware acceleration is unavailable or disabled in this browser.');
    }

    // Subscribe to selection events
    const unsubSelection = globalEventBus.on<string | null>('selection:changed', (entityId) => {
      if (!entityId || !app.rendererManager) {
        setSelectedBuilding(null);
        setSelectedVehicle(null);
        return;
      }

      const entity = app.rendererManager.worldManager.entityRegistry.get(entityId);
      if (entity && entity instanceof BuildingEntity) {
        setSelectedVehicle(null);
        const district = app.rendererManager.worldManager.districtManager.getDistrictAt(
          entity.gridX,
          entity.gridZ
        );

        setSelectedBuilding({
          id: entity.id,
          definition: entity.definition,
          gridX: entity.gridX,
          gridZ: entity.gridZ,
          rotationDegrees: entity.rotationDegrees,
          effectiveWidth: entity.width,
          effectiveDepth: entity.depth,
          districtName: district ? district.name : undefined,
        });
      } else if (entity && entity instanceof VehicleEntity) {
        setSelectedBuilding(null);
        const district = app.rendererManager.worldManager.districtManager.getDistrictAt(
          entity.gridX,
          entity.gridZ
        );

        setSelectedVehicle({
          id: entity.id,
          vehicleEntity: entity,
          definition: entity.truckDefinition,
          trailerDefinition: entity.trailerDefinition,
          containerDefinition: entity.containerDefinition,
          gridX: entity.gridX,
          gridZ: entity.gridZ,
          districtName: district ? district.name : undefined,
        });
      } else {
        setSelectedBuilding(null);
        setSelectedVehicle(null);
      }
    });

    const unsubError = globalEventBus.on<{ title: string; message: string }>('app:error', (err) => {
      setWebGlError(`${err.title}: ${err.message}`);
    });

    // Construction state events
    const unsubTool = globalEventBus.on<string | null>('tool:changed', (tool) => {
      setActiveTool(tool);
    });

    const unsubCancelTool = globalEventBus.on('tool:cancel', () => {
      app.cancelPlacement();
      app.cancelRoadConstruction();
    });

    const unsubConstStarted = globalEventBus.on<{
      definition: BuildingDefinition;
      rotation: number;
    }>('construction:started', (payload) => {
      setConstructionDef(payload.definition);
      setConstructionRotation(payload.rotation);
      setSelectedBuilding(null);
      setRoadToolState(null);
    });

    const unsubConstValidation = globalEventBus.on<{
      validation: PlacementValidationResult;
      gridX: number;
      gridZ: number;
      rotation: number;
    }>('construction:validation_updated', (payload) => {
      setConstructionValidation(payload.validation);
      setConstructionRotation(payload.rotation);
    });

    const unsubConstCancelled = globalEventBus.on('construction:cancelled', () => {
      setConstructionDef(null);
      setConstructionValidation(null);
      setActiveTool(null);
    });

    // Road Tool Events
    const unsubRoadTool = globalEventBus.on<{
      active: boolean;
      subMode: 'build' | 'demolish';
      roadTypeId: RoadTypeId;
      routingMode: RoutingMode;
      widthBlocks?: number;
      forwardBlocks?: number;
      backwardBlocks?: number;
      hasStart: boolean;
      startCoord: GridCoord | null;
      currentCoord: GridCoord | null;
      pathLength: number;
      validation: RoadValidationResult | null;
    }>('road_tool:state_changed', (state) => {
      if (state.active) {
        setRoadToolState(state);
        setSelectedBuilding(null);
        setConstructionDef(null);
      } else {
        setRoadToolState(null);
      }
    });

    const unsubRoadCancelled = globalEventBus.on('road_tool:cancelled', () => {
      setRoadToolState(null);
      setActiveTool(null);
    });

    return () => {
      unsubSelection();
      unsubError();
      unsubTool();
      unsubCancelTool();
      unsubConstStarted();
      unsubConstValidation();
      unsubConstCancelled();
      unsubRoadTool();
      unsubRoadCancelled();
      app.dispose();
      appRef.current = null;
    };
  }, []);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const isBuilding = appRef.current?.rendererManager?.constructionController.getIsActive();
      const isRoad = appRef.current?.rendererManager?.roadConstructionController.getIsActive();

      if (e.code === 'F5' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyS')) {
        e.preventDefault();
        handleQuickSave();
      } else if (e.code === 'F9' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyL')) {
        e.preventDefault();
        handleQuickLoad();
      } else if (e.code === 'Space') {
        if (gameMode === 'playing' && !isBuilding && !isRoad) {
          e.preventDefault();
          handleTogglePause();
        }
      } else if (e.code === 'Digit1') {
        handleSetSpeed(1);
      } else if (e.code === 'Digit2') {
        handleSetSpeed(2);
      } else if (e.code === 'Digit3') {
        handleSetSpeed(5);
      } else if (e.code === 'KeyG') {
        handleToggleGrid();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        if (!isBuilding && !isRoad) {
          handleResetCamera();
        }
      } else if (e.code === 'KeyF') {
        handleFocusBuilding();
      } else if (e.key === '?') {
        setIsHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameMode]);

  const handleQuickSave = useCallback(() => {
    if (!appRef.current) return;
    const res = appRef.current.saveGame('quick_save', 'Quick Save');
    if (res.success) {
      globalEventBus.emit('ui:notify', {
        title: 'Game Saved',
        message: 'Your transport empire state was saved successfully.',
        type: 'success',
      });
    } else {
      globalEventBus.emit('ui:notify', {
        title: 'Save Failed',
        message: res.error || 'Failed to save game.',
        type: 'warning',
      });
    }
  }, []);

  const handleQuickLoad = useCallback(() => {
    if (!appRef.current) return;
    const res = appRef.current.loadGame('quick_save');
    if (res.success) {
      globalEventBus.emit('ui:notify', {
        title: 'Game Loaded',
        message: 'Transport empire restored from quick save.',
        type: 'success',
      });
      setSelectedBuilding(null);
      setSelectedVehicle(null);
    } else {
      const fallbackRes = appRef.current.loadGame('autosave');
      if (fallbackRes.success) {
        globalEventBus.emit('ui:notify', {
          title: 'Game Loaded',
          message: 'Transport empire restored from autosave.',
          type: 'success',
        });
        setSelectedBuilding(null);
        setSelectedVehicle(null);
      } else {
        globalEventBus.emit('ui:notify', {
          title: 'No Save Found',
          message: res.error || 'No previous save state found in storage.',
          type: 'warning',
        });
      }
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (appRef.current) {
      appRef.current.gameState.clock.togglePause();
    }
  }, []);

  const handleSetSpeed = useCallback((speed: GameSpeed) => {
    if (appRef.current) {
      appRef.current.gameState.clock.setSpeed(speed);
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    if (appRef.current) {
      appRef.current.resetCamera();
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (appRef.current) {
      appRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (appRef.current) {
      appRef.current.zoomOut();
    }
  }, []);

  const handleRotateLeft = useCallback(() => {
    if (appRef.current) {
      appRef.current.rotateCameraLeft();
    }
  }, []);

  const handleRotateRight = useCallback(() => {
    if (appRef.current) {
      appRef.current.rotateCameraRight();
    }
  }, []);

  const handleToggleGrid = useCallback(() => {
    if (appRef.current) {
      const next = appRef.current.toggleGrid();
      setIsGridVisible(next);
      globalEventBus.emit('ui:notify', {
        title: 'Tactical Grid',
        message: next ? 'Grid overlay enabled' : 'Grid overlay hidden',
        type: 'info',
      });
    }
  }, []);

  const handleSetLighting = useCallback((preset: 'day' | 'golden' | 'dusk') => {
    if (appRef.current) {
      appRef.current.setLightingPreset(preset);
      setLightingPreset(preset);
    }
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedBuilding(null);
    setSelectedVehicle(null);
    if (appRef.current && appRef.current.rendererManager) {
      appRef.current.rendererManager.selectionManager.clearSelection();
    }
  }, []);

  const handleFocusBuilding = useCallback(() => {
    if (appRef.current) {
      appRef.current.focusSelectedEntity();
    }
  }, []);

  const handleDemolishBuilding = useCallback((_id: string) => {
    if (appRef.current) {
      const res = appRef.current.removeSelectedBuilding();
      if (res.success) {
        globalEventBus.emit('ui:notify', {
          title: 'Structure Decommissioned',
          message: `Facility salvaged for 50% refund (+$${res.refund.toLocaleString()}). Grid cells reclaimed.`,
          type: 'info',
        });
        setSelectedBuilding(null);
      } else {
        globalEventBus.emit('ui:notify', {
          title: 'Demolition Blocked',
          message: res.error || 'Failed to decommission structure.',
          type: 'warning',
        });
      }
    }
  }, []);

  const handleSelectFromCatalog = useCallback((def: BuildingDefinition) => {
    if (appRef.current) {
      appRef.current.startBuildingPlacement(def.id);
    }
  }, []);

  const handleRotatePlacement = useCallback(() => {
    if (appRef.current) {
      appRef.current.rotatePlacement();
    }
  }, []);

  const handleCancelPlacement = useCallback(() => {
    if (appRef.current) {
      appRef.current.cancelPlacement();
    }
  }, []);

  // Road Construction Handlers
  const handleStartRoadConstruction = useCallback((type: RoadTypeId = 'two_lane_urban') => {
    if (appRef.current) {
      appRef.current.startRoadConstruction(type);
    }
  }, []);

  const handleStartRoadDemolition = useCallback(() => {
    if (appRef.current) {
      appRef.current.startRoadDemolition();
    }
  }, []);

  const handleSelectRoadType = useCallback((type: RoadTypeId) => {
    if (appRef.current) {
      appRef.current.setRoadType(type);
    }
  }, []);

  const handleToggleRoadRoutingMode = useCallback(() => {
    if (appRef.current) {
      appRef.current.toggleRoadRoutingMode();
    }
  }, []);

  const handleCommitRoadConstruction = useCallback(() => {
    if (appRef.current) {
      appRef.current.commitRoadConstruction();
    }
  }, []);

  const handleCancelRoadConstruction = useCallback(() => {
    if (appRef.current) {
      appRef.current.cancelRoadConstruction();
    }
  }, []);

  // World Scale & Spatial Validation Handlers
  const handleOpenScaleValidator = useCallback(() => {
    const wm = appRef.current?.worldManager;
    if (wm) {
      const summary = wm.scaleInspector.performFullAudit();
      setAuditSummary(summary);
      setIs3dScaleOverlayActive(wm.scaleInspector.isEnabled);
    }
    setIsScaleModalOpen(true);
  }, []);

  const handleToggle3dScaleOverlay = useCallback(() => {
    const wm = appRef.current?.worldManager;
    if (wm) {
      const active = wm.scaleInspector.toggle();
      setIs3dScaleOverlayActive(active);
    }
  }, []);

  const handleRefreshAudit = useCallback(() => {
    const wm = appRef.current?.worldManager;
    if (wm) {
      const summary = wm.scaleInspector.performFullAudit();
      setAuditSummary(summary);
      if (wm.scaleInspector.isEnabled) {
        wm.scaleInspector.refreshVisuals();
      }
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* 3D WebGL Canvas Container (Stable Ref, un-re-rendered) */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* WebGL Error State Fallback */}
      {webGlError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 text-white">
          <div className="max-w-md p-6 rounded-2xl bg-slate-900 border border-rose-500/50 shadow-2xl text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-rose-400">Rendering Initialization Error</h2>
            <p className="text-sm text-slate-300 mt-2">{webGlError}</p>
            <p className="text-xs text-slate-400 mt-4">
              Please ensure your browser supports WebGL 2.0 with hardware acceleration enabled.
            </p>
          </div>
        </div>
      )}

      {/* Full-Viewport Game Shell: Title Screen Mode */}
      {gameMode === 'title' && (
        <TitleScreen onStart={() => setGameMode('playing')} />
      )}

      {/* Playing Game HUD & Overlays */}
      {gameMode === 'playing' && (
        <>
          {/* Top Status & Economy Bar */}
          <HUD
            onTogglePause={handleTogglePause}
            onSetSpeed={handleSetSpeed}
            onOpenHelp={() => setIsHelpOpen(true)}
            onQuickSave={handleQuickSave}
            onQuickLoad={handleQuickLoad}
          />

          {/* Building Construction Mode Floating Bar */}
          {constructionDef && (
            <ConstructionBar
              definition={constructionDef}
              rotation={constructionRotation}
              validation={constructionValidation}
              onRotate={handleRotatePlacement}
              onCancel={handleCancelPlacement}
            />
          )}

          {/* Road Construction & Bulldozer Active Floating Bar */}
          {roadToolState && (
            <RoadConstructionBar
              subMode={roadToolState.subMode}
              selectedRoadType={roadToolState.roadTypeId}
              routingMode={roadToolState.routingMode}
              widthBlocks={roadToolState.widthBlocks || 2}
              forwardBlocks={roadToolState.forwardBlocks || 1}
              backwardBlocks={roadToolState.backwardBlocks || 1}
              hasStart={roadToolState.hasStart}
              startCoord={roadToolState.startCoord}
              currentCoord={roadToolState.currentCoord}
              pathLength={roadToolState.pathLength}
              validation={roadToolState.validation}
              onSelectRoadType={handleSelectRoadType}
              onSelectWidthBlocks={(w) => appRef.current?.setRoadWidthBlocks(w)}
              onToggleDirectionalAllocation={() => appRef.current?.toggleRoadDirectionalAllocation()}
              onToggleRoutingMode={handleToggleRoadRoutingMode}
              onSwitchToBulldozer={handleStartRoadDemolition}
              onSwitchToBuild={() => handleStartRoadConstruction(roadToolState.roadTypeId)}
              onCommit={handleCommitRoadConstruction}
              onCancel={handleCancelRoadConstruction}
            />
          )}

          {/* Left Construction & Inspection Toolbar */}
          <Toolbar
            activeTool={activeTool}
            onOpenBuildingCatalog={() => setIsCatalogOpen(true)}
            onStartRoadConstruction={() => handleStartRoadConstruction('two_lane_urban')}
            onStartRoadDemolition={handleStartRoadDemolition}
            onOpenFleetStudio={() => setIsFleetStudioOpen(true)}
            onOpenScaleValidator={handleOpenScaleValidator}
          />

          {/* Contextual Entity Inspector (Buildings & Road Freight Vehicles) */}
          {!constructionDef && !roadToolState && (
            <InspectorPanel
              building={selectedBuilding}
              vehicle={selectedVehicle}
              onClose={handleCloseInspector}
              onFocus={handleFocusBuilding}
              onDemolish={handleDemolishBuilding}
              app={appRef.current}
            />
          )}

          {/* Collapsible Unified Bottom Control Dock */}
          <BottomControlDock
            onResetCamera={handleResetCamera}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onToggleGrid={handleToggleGrid}
            onSetLighting={handleSetLighting}
            isGridVisible={isGridVisible}
            lightingPreset={lightingPreset}
          />

          {/* Facility Construction Catalog Modal */}
          <BuildingCatalogModal
            isOpen={isCatalogOpen}
            onClose={() => setIsCatalogOpen(false)}
            onSelectBuilding={handleSelectFromCatalog}
            playerCash={appRef.current?.gameState.getCash() ?? 250000}
          />

          {/* 3D Fleet Vehicle & Intermodal Asset Studio Modal */}
          <VehicleShowcaseModal
            isOpen={isFleetStudioOpen}
            onClose={() => setIsFleetStudioOpen(false)}
          />

          {/* World-Scale & Spatial Standards Validation Modal */}
          <ScaleInspectionModal
            isOpen={isScaleModalOpen}
            onClose={() => setIsScaleModalOpen(false)}
            is3dOverlayActive={is3dScaleOverlayActive}
            onToggle3dOverlay={handleToggle3dScaleOverlay}
            auditSummary={auditSummary}
            onRefreshAudit={handleRefreshAudit}
          />

          {/* Notifications Toasts */}
          <NotificationSystem />

          {/* Help & Controls Modal */}
          <HelpModal
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />
        </>
      )}
    </div>
  );
}
