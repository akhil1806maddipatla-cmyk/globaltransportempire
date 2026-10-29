import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { WorldManager } from '../world/WorldManager';
import { PlacementPreview } from '../rendering/PlacementPreview';
import { BuildingDefinition, BUILDING_DEFINITIONS } from '../data/buildingDefinitions';
import { PlacementValidationResult } from '../world/PlacementValidator';
import { globalEventBus } from '../core/EventBus';
import { globalAudioSynth } from '../audio/SoundSynth';
import { GameState } from '../game/GameState';

export class ConstructionController implements IDisposable {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;
  private worldManager: WorldManager;
  private gameState: GameState;
  private preview: PlacementPreview;

  private isActive: boolean = false;
  private currentDefinition: BuildingDefinition | null = null;
  private currentRotation: number = 0; // 0, 90, 180, 270
  private currentGridPos: { x: number; z: number } = { x: 0, z: 0 };
  private latestValidation: PlacementValidationResult | null = null;

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

    this.preview = new PlacementPreview(this.worldManager.gridSystem);
    this.scene.add(this.preview.group);

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnContextMenu = (e) => {
      if (this.isActive) {
        e.preventDefault();
        this.cancelPlacement();
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

  public startPlacement(definitionId: string): boolean {
    const def = BUILDING_DEFINITIONS[definitionId];
    if (!def) {
      console.warn(`Cannot start placement: building definition ${definitionId} not found.`);
      return false;
    }

    this.isActive = true;
    this.currentDefinition = def;
    this.currentRotation = def.defaultRotation || 0;

    this.preview.setBuilding(def, this.currentRotation);
    this.preview.setVisible(true);
    this.gameState.setActiveTool(`place_${definitionId}`);

    globalAudioSynth.playClick();
    globalEventBus.emit('construction:started', {
      definition: def,
      rotation: this.currentRotation,
    });

    this.updatePlacementValidation();
    return true;
  }

  public rotateBuilding(): void {
    if (!this.isActive || !this.currentDefinition) return;
    this.currentRotation = (this.currentRotation + 90) % 360;
    this.preview.setRotation(this.currentRotation);

    globalAudioSynth.playClick();
    this.updatePlacementValidation();
  }

  public cancelPlacement(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.currentDefinition = null;
    this.preview.setVisible(false);
    this.gameState.setActiveTool(null);

    globalAudioSynth.playDeselect();
    globalEventBus.emit('construction:cancelled');
  }

  private updatePointerCoord(clientX: number, clientY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.isActive || e.button !== 0) return;
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isActive || !this.currentDefinition) return;

    this.updatePointerCoord(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);

    if (hit) {
      const snapped = this.worldManager.gridSystem.snapWorldToGrid(hit.x, hit.z);
      if (snapped.gridX !== this.currentGridPos.x || snapped.gridZ !== this.currentGridPos.z) {
        this.currentGridPos = { x: snapped.gridX, z: snapped.gridZ };
        this.updatePlacementValidation();
      }
    }
  }

  private updatePlacementValidation(): void {
    if (!this.isActive || !this.currentDefinition) return;

    const availableFunds = this.gameState.getCash();
    const validation = this.worldManager.placementValidator.validate(
      this.currentDefinition,
      this.currentGridPos.x,
      this.currentGridPos.z,
      this.currentRotation,
      availableFunds
    );

    this.latestValidation = validation;
    this.preview.updateTransform(
      this.currentGridPos.x,
      this.currentGridPos.z,
      validation
    );

    globalEventBus.emit('construction:validation_updated', {
      validation,
      gridX: this.currentGridPos.x,
      gridZ: this.currentGridPos.z,
      rotation: this.currentRotation,
    });
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isActive || !this.currentDefinition || e.button !== 0 || !this.isPointerDown) return;
    this.isPointerDown = false;

    // Check if camera was dragged (pan threshold discrimination)
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > this.maxDragDistanceSquared) {
      return;
    }

    // Check if placement is valid
    if (!this.latestValidation || !this.latestValidation.isValid) {
      globalAudioSynth.playDeselect();
      globalEventBus.emit('ui:notify', {
        title: 'Placement Obstructed',
        message: this.latestValidation ? this.latestValidation.message : 'Cannot place structure here.',
        type: 'warning',
      });
      return;
    }

    // Commit atomic placement
    const result = this.worldManager.placeBuilding(
      this.currentDefinition.id,
      this.currentGridPos.x,
      this.currentGridPos.z,
      this.currentRotation
    );

    if (result.success && result.entity) {
      globalAudioSynth.playSelect();
      globalEventBus.emit('ui:notify', {
        title: 'Facility Commissioned',
        message: `${this.currentDefinition.name} commissioned for $${this.currentDefinition.cost.toLocaleString()} at (${this.currentGridPos.x}, ${this.currentGridPos.z}).`,
        type: 'success',
      });

      // Exit construction mode and select newly placed entity
      const placedId = result.entity.id;
      this.cancelPlacement();
      this.gameState.selectEntity(placedId);
    } else {
      globalAudioSynth.playDeselect();
      globalEventBus.emit('ui:notify', {
        title: 'Placement Failed',
        message: result.error || 'Failed to commit building to sector grid.',
        type: 'warning',
      });
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return;

    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.rotateBuilding();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.cancelPlacement();
    }
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public dispose(): void {
    this.detach();
    this.preview.dispose();
  }
}
