import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { WorldManager } from '../world/WorldManager';
import { RoadPlacementPreview } from '../rendering/RoadPlacementPreview';
import { RoadPathGenerator, RoutingMode, GridCoord, RoadCorridorCell } from '../world/RoadPathGenerator';
import { RoadValidationResult } from '../world/RoadConstructionValidator';
import { RoadTypeId, ROAD_DEFINITIONS } from '../data/roadDefinitions';
import { globalEventBus } from '../core/EventBus';
import { globalAudioSynth } from '../audio/SoundSynth';
import { GameState } from '../game/GameState';

export class RoadConstructionController implements IDisposable {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;
  private worldManager: WorldManager;
  private gameState: GameState;
  private preview: RoadPlacementPreview;

  private isActive: boolean = false;
  private subMode: 'build' | 'demolish' = 'build';
  private selectedRoadType: RoadTypeId = 'two_lane_urban';
  private routingMode: RoutingMode = 'horizontal_first';
  private widthBlocks: number = 2;
  private forwardBlocks: number = 1;
  private backwardBlocks: number = 1;

  private startCoord: GridCoord | null = null;
  private currentCoord: GridCoord | null = null;
  private currentPath: GridCoord[] = [];
  private currentCorridorCells: RoadCorridorCell[] = [];
  private latestValidation: RoadValidationResult | null = null;

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer = new THREE.Vector2();

  private pointerDownPos = { x: 0, y: 0 };
  private isPointerDown: boolean = false;
  private maxDragDistanceSquared: number = 36; // 6px threshold

  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnContextMenu: (e: MouseEvent) => void;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    worldManager: WorldManager,
    gameState: GameState
  ) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.worldManager = worldManager;
    this.gameState = gameState;

    this.preview = new RoadPlacementPreview(this.worldManager.gridSystem);
    this.scene.add(this.preview.group);

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnContextMenu = (e) => {
      if (this.isActive) {
        e.preventDefault();
        this.handleCancelStep();
      }
    };

    this.attach();
  }

  private attach(): void {
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.addEventListener('pointermove', this.boundOnPointerMove);
    this.domElement.addEventListener('pointerup', this.boundOnPointerUp);
    this.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
    window.addEventListener('keydown', this.boundOnKeyDown);
  }

  private detach(): void {
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.removeEventListener('pointermove', this.boundOnPointerMove);
    this.domElement.removeEventListener('pointerup', this.boundOnPointerUp);
    this.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);
    window.removeEventListener('keydown', this.boundOnKeyDown);
  }

  public startConstruction(roadType: RoadTypeId = 'two_lane_urban'): void {
    this.isActive = true;
    this.subMode = 'build';
    this.selectedRoadType = roadType;
    this.startCoord = null;
    this.currentPath = [];
    this.currentCorridorCells = [];
    this.latestValidation = null;

    // Initialize width based on road hierarchy
    this.widthBlocks = roadType === 'highway_corridor' ? 4 : 2;
    const alloc = RoadPathGenerator.calculateDirectionalAllocation(this.widthBlocks);
    this.forwardBlocks = alloc.forwardBlocks;
    this.backwardBlocks = alloc.backwardBlocks;

    this.preview.setVisible(true);
    this.preview.setStartAnchor(null);
    this.gameState.setActiveTool(`road_${roadType}`);

    globalAudioSynth.playClick();
    this.emitState();

    globalEventBus.emit('ui:notify', {
      title: 'Roadway Planning Mode',
      message: 'Click on the map to anchor starting point, then drag or click destination.',
      type: 'info',
    });
  }

  public startDemolition(): void {
    this.isActive = true;
    this.subMode = 'demolish';
    this.startCoord = null;
    this.currentPath = [];
    this.currentCorridorCells = [];
    this.latestValidation = null;

    this.preview.setVisible(true);
    this.preview.clearPathMeshes();
    this.preview.setStartAnchor(null);
    this.gameState.setActiveTool('road_demolish');

    globalAudioSynth.playClick();
    this.emitState();

    globalEventBus.emit('ui:notify', {
      title: 'Bulldozer Demolition Mode',
      message: 'Click any road cell to decommission it and salvage 50% construction value.',
      type: 'warning',
    });
  }

  public setRoadType(roadType: RoadTypeId): void {
    if (!this.isActive) return;
    this.selectedRoadType = roadType;
    this.gameState.setActiveTool(`road_${roadType}`);
    globalAudioSynth.playClick();
    this.updatePathAndValidation();
    this.emitState();
  }

  public setWidthBlocks(width: number): void {
    if (!this.isActive) return;
    const clamped = Math.max(1, Math.min(8, Math.round(width)));
    this.widthBlocks = clamped;
    const alloc = RoadPathGenerator.calculateDirectionalAllocation(clamped);
    this.forwardBlocks = alloc.forwardBlocks;
    this.backwardBlocks = alloc.backwardBlocks;
    globalAudioSynth.playClick();
    this.updatePathAndValidation();
    this.emitState();
  }

  public toggleDirectionalAllocation(): void {
    if (!this.isActive || this.widthBlocks <= 1 || this.widthBlocks % 2 === 0) return;
    const temp = this.forwardBlocks;
    this.forwardBlocks = this.backwardBlocks;
    this.backwardBlocks = temp;
    globalAudioSynth.playClick();
    this.updatePathAndValidation();
    this.emitState();
  }

  public toggleRoutingMode(): void {
    if (!this.isActive || this.subMode !== 'build') return;
    this.routingMode = this.routingMode === 'horizontal_first' ? 'vertical_first' : 'horizontal_first';
    globalAudioSynth.playClick();
    this.updatePathAndValidation();
    this.emitState();
  }

  public setRoutingMode(mode: RoutingMode): void {
    if (!this.isActive || this.subMode !== 'build') return;
    this.routingMode = mode;
    this.updatePathAndValidation();
    this.emitState();
  }

  public cancel(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.startCoord = null;
    this.currentPath = [];
    this.latestValidation = null;
    this.preview.setVisible(false);
    this.gameState.setActiveTool(null);

    globalAudioSynth.playDeselect();
    this.emitState();
    globalEventBus.emit('road_tool:cancelled');
  }

  private handleCancelStep(): void {
    if (this.subMode === 'build' && this.startCoord !== null) {
      // Step back from drawing to selecting start
      this.startCoord = null;
      this.currentPath = [];
      this.latestValidation = null;
      this.preview.clearPathMeshes();
      this.preview.setStartAnchor(null);
      globalAudioSynth.playDeselect();
      this.emitState();
      globalEventBus.emit('ui:notify', {
        title: 'Route Cleared',
        message: 'Starting point reset. Select a new road origin.',
        type: 'info',
      });
    } else {
      this.cancel();
    }
  }

  private updatePointerCoord(clientX: number, clientY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastGrid(): GridCoord | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);
    if (!hit) return null;

    const snapped = this.worldManager.gridSystem.snapWorldToGrid(hit.x, hit.z);
    if (!this.worldManager.gridSystem.isWithinBounds(snapped.gridX, snapped.gridZ)) {
      return null;
    }
    return { x: snapped.gridX, z: snapped.gridZ };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.isActive || e.button !== 0) return;
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isActive) return;

    this.updatePointerCoord(e.clientX, e.clientY);
    const cell = this.raycastGrid();
    if (!cell) return;

    if (!this.currentCoord || this.currentCoord.x !== cell.x || this.currentCoord.z !== cell.z) {
      this.currentCoord = cell;

      if (this.subMode === 'demolish') {
        const hasRoad = this.worldManager.roadNetwork.model.hasRoad(cell.x, cell.z);
        this.preview.updateBulldozerPreview(cell.x, cell.z, hasRoad);
        this.emitState();
      } else {
        this.preview.hideBulldozerPreview();
        if (this.startCoord === null) {
          // Hover cursor mode
          const occ = this.worldManager.gridSystem.getOccupancy(cell.x, cell.z);
          const canStart = occ === 'empty' || occ === 'road';
          this.preview.updateHoverCursor(cell.x, cell.z, canStart);
        } else {
          // Drawing route preview
          this.updatePathAndValidation();
        }
        this.emitState();
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isActive || e.button !== 0 || !this.isPointerDown) return;
    this.isPointerDown = false;

    // Reject if pointer was dragged (camera pan)
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > this.maxDragDistanceSquared) {
      return;
    }

    this.updatePointerCoord(e.clientX, e.clientY);
    const cell = this.raycastGrid();
    if (!cell) return;

    if (this.subMode === 'demolish') {
      this.commitDemolition(cell.x, cell.z);
    } else {
      if (this.startCoord === null) {
        // Set starting anchor
        this.startCoord = cell;
        this.preview.setStartAnchor(cell);
        globalAudioSynth.playSelect();
        this.updatePathAndValidation();
        this.emitState();
      } else {
        // Commit route construction
        this.commitRouteConstruction();
      }
    }
  }

  private updatePathAndValidation(): void {
    if (!this.startCoord || !this.currentCoord || this.subMode !== 'build') return;

    const corridor = RoadPathGenerator.generateCorridor(
      this.startCoord,
      this.currentCoord,
      this.widthBlocks,
      this.forwardBlocks,
      this.backwardBlocks,
      this.routingMode
    );
    this.currentCorridorCells = corridor;
    this.currentPath = corridor;

    const roadDef = ROAD_DEFINITIONS[this.selectedRoadType];
    const availableFunds = this.gameState.getCash();
    const validation = this.worldManager.roadValidator.validatePath(corridor, roadDef, availableFunds);
    this.latestValidation = validation;

    const existingLookup = new Set<string>();
    for (const ec of validation.existingCells) {
      existingLookup.add(`${ec.x},${ec.z}`);
    }

    this.preview.updatePathPreview(corridor, validation, existingLookup);
  }

  public commitRouteConstruction(): boolean {
    if (!this.isActive || this.subMode !== 'build' || !this.latestValidation) {
      return false;
    }

    if (!this.latestValidation.isValid) {
      globalAudioSynth.playDeselect();
      globalEventBus.emit('ui:notify', {
        title: 'Road Construction Obstructed',
        message: this.latestValidation.message,
        type: 'warning',
      });
      return false;
    }

    const result = this.worldManager.constructRoadPath(this.currentCorridorCells, this.selectedRoadType);

    if (result.success) {
      globalAudioSynth.playSelect();
      globalEventBus.emit('ui:notify', {
        title: 'Corridor Constructed',
        message: `Built ${result.newSegmentCount} road segments ($${result.cost.toLocaleString()}). Width: ${this.widthBlocks} blocks (${this.forwardBlocks}+${this.backwardBlocks} lanes).`,
        type: 'success',
      });

      // Chain continuous road building: new start is the previous end point
      if (this.currentCoord) {
        this.startCoord = { ...this.currentCoord };
        this.preview.setStartAnchor(this.startCoord);
        this.updatePathAndValidation();
      } else {
        this.startCoord = null;
        this.preview.setStartAnchor(null);
      }
      this.emitState();
      return true;
    } else {
      globalAudioSynth.playDeselect();
      globalEventBus.emit('ui:notify', {
        title: 'Construction Error',
        message: result.error || 'Failed to complete road construction transaction.',
        type: 'warning',
      });
      return false;
    }
  }

  private commitDemolition(x: number, z: number): void {
    const res = this.worldManager.demolishRoadCell(x, z);
    if (res.success) {
      globalAudioSynth.playClick();
      globalEventBus.emit('ui:notify', {
        title: 'Road Demolished',
        message: `Road cell reclaimed. Salvage refund: $${res.refund.toLocaleString()}.`,
        type: 'info',
      });
      // Refresh preview for hovered cell
      if (this.currentCoord) {
        this.preview.updateBulldozerPreview(this.currentCoord.x, this.currentCoord.z, false);
      }
      this.emitState();
    } else {
      globalAudioSynth.playDeselect();
      globalEventBus.emit('ui:notify', {
        title: 'Demolition Blocked',
        message: res.error || 'No road present at this sector cell.',
        type: 'warning',
      });
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return;

    if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.toggleRoutingMode();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.handleCancelStep();
    }
  }

  private emitState(): void {
    globalEventBus.emit('road_tool:state_changed', {
      active: this.isActive,
      subMode: this.subMode,
      roadTypeId: this.selectedRoadType,
      routingMode: this.routingMode,
      widthBlocks: this.widthBlocks,
      forwardBlocks: this.forwardBlocks,
      backwardBlocks: this.backwardBlocks,
      hasStart: this.startCoord !== null,
      startCoord: this.startCoord,
      currentCoord: this.currentCoord,
      pathLength: this.currentPath.length,
      validation: this.latestValidation,
    });
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public dispose(): void {
    this.detach();
    this.preview.dispose();
  }
}
