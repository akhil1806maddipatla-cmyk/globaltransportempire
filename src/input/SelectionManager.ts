import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { EntityRegistry } from '../entities/EntityRegistry';
import { GameState } from '../game/GameState';
import { globalAudioSynth } from '../audio/SoundSynth';
import { globalEventBus } from '../core/EventBus';
import { Entity } from '../entities/Entity';

export class SelectionManager implements IDisposable {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;
  private entityRegistry: EntityRegistry;
  private gameState: GameState;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private hoveredEntity: Entity | null = null;
  private selectedEntity: Entity | null = null;

  private pointerDownPos = { x: 0, y: 0 };
  private isPointerDown: boolean = false;
  private maxDragDistanceSquared: number = 25; // 5px movement threshold

  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnWindowKeyDown: (e: KeyboardEvent) => void;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    entityRegistry: EntityRegistry,
    gameState: GameState
  ) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.entityRegistry = entityRegistry;
    this.gameState = gameState;

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnWindowKeyDown = this.onKeyDown.bind(this);

    this.attach();
  }

  private attach(): void {
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.addEventListener('pointermove', this.boundOnPointerMove);
    this.domElement.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('keydown', this.boundOnWindowKeyDown);
  }

  private detach(): void {
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.removeEventListener('pointermove', this.boundOnPointerMove);
    this.domElement.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('keydown', this.boundOnWindowKeyDown);
  }

  private updatePointerCoord(clientX: number, clientY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.gameState.getActiveTool() !== null) return;
    if (e.button !== 0) return; // Left click only
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.gameState.getActiveTool() !== null) {
      if (this.hoveredEntity) {
        this.hoveredEntity.setHovered(false);
        this.hoveredEntity = null;
      }
      return;
    }
    this.updatePointerCoord(e.clientX, e.clientY);

    // Throttle hover raycast if pointer is down/dragging
    if (this.isPointerDown) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let foundVehicle: Entity | null = null;
    let foundBuilding: Entity | null = null;
    for (const hit of intersects) {
      const entity = this.entityRegistry.findEntityFromObject(hit.object);
      if (entity) {
        if (entity.entityType === 'vehicle' && !foundVehicle) {
          foundVehicle = entity;
          break;
        } else if (entity.entityType === 'building' && !foundBuilding) {
          foundBuilding = entity;
        }
      }
    }
    const foundEntity = foundVehicle || foundBuilding;

    if (foundEntity !== this.hoveredEntity) {
      if (this.hoveredEntity) {
        this.hoveredEntity.setHovered(false);
      }
      this.hoveredEntity = foundEntity;
      if (this.hoveredEntity) {
        this.hoveredEntity.setHovered(true);
        this.domElement.style.cursor = 'pointer';
      } else {
        this.domElement.style.cursor = 'default';
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.isPointerDown || this.gameState.getActiveTool() !== null) return;
    this.isPointerDown = false;

    // Verify pointer didn't drag extensively
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > this.maxDragDistanceSquared) {
      return; // Was a camera pan drag, ignore click selection
    }

    this.updatePointerCoord(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let targetVehicle: Entity | null = null;
    let targetBuilding: Entity | null = null;
    for (const hit of intersects) {
      const entity = this.entityRegistry.findEntityFromObject(hit.object);
      if (entity) {
        if (entity.entityType === 'vehicle' && !targetVehicle) {
          targetVehicle = entity;
          break;
        } else if (entity.entityType === 'building' && !targetBuilding) {
          targetBuilding = entity;
        }
      }
    }
    const targetEntity = targetVehicle || targetBuilding;

    if (targetEntity) {
      this.selectEntity(targetEntity);
    } else {
      // Clicked on empty terrain or ground
      this.clearSelection();
    }
  }

  public selectEntity(entity: Entity | null): void {
    if (this.selectedEntity === entity) return;

    if (this.selectedEntity) {
      this.selectedEntity.setSelected(false);
    }

    this.selectedEntity = entity;

    if (this.selectedEntity) {
      this.selectedEntity.setSelected(true);
      this.gameState.selectEntity(this.selectedEntity.id);
      globalAudioSynth.playSelect();
      globalEventBus.emit('ui:notify', {
        title: 'Building Inspected',
        message: `Inspecting ${this.selectedEntity.name}`,
        type: 'info',
      });
    } else {
      this.gameState.selectEntity(null);
      globalAudioSynth.playDeselect();
    }
  }

  public clearSelection(): void {
    if (this.selectedEntity) {
      this.selectEntity(null);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.clearSelection();
    }
  }

  public getSelectedEntity(): Entity | null {
    return this.selectedEntity;
  }

  public dispose(): void {
    this.detach();
    if (this.hoveredEntity) {
      this.hoveredEntity.setHovered(false);
      this.hoveredEntity = null;
    }
    if (this.selectedEntity) {
      this.selectedEntity.setSelected(false);
      this.selectedEntity = null;
    }
  }
}
