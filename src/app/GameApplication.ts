import { IDisposable } from '../core/Disposable';
import { Logger } from '../core/Logger';
import { ErrorHandler } from '../core/ErrorHandler';
import { GameState } from '../game/GameState';
import { RendererManager } from '../rendering/RendererManager';
import { WorldManager } from '../world/WorldManager';
import { globalEventBus } from '../core/EventBus';
import { RoadTypeId } from '../data/roadDefinitions';
import { SaveLoadManager, SaveResult, LoadResult } from '../game/SaveLoadManager';
import { VehicleRouteProgressInfo } from '../world/traffic/TrafficTypes';

const logger = new Logger('GameApplication');

export class GameApplication implements IDisposable {
  public readonly gameState: GameState;
  public readonly saveLoadManager: SaveLoadManager = new SaveLoadManager();
  public rendererManager: RendererManager | null = null;
  private container: HTMLElement | null = null;
  private isInitialized: boolean = false;

  public get worldManager(): WorldManager | null {
    return this.rendererManager?.worldManager ?? null;
  }

  public saveGame(slotId?: string, saveName?: string): SaveResult {
    if (!this.worldManager) {
      return { success: false, slotId: slotId || 'default', error: 'World not initialized' };
    }
    return this.saveLoadManager.saveGame(this.worldManager, this.gameState, slotId, saveName);
  }

  public loadGame(slotId?: string): LoadResult {
    if (!this.worldManager) {
      return { success: false, slotId: slotId || 'default', error: 'World not initialized', warnings: [] };
    }
    return this.saveLoadManager.loadGame(this.worldManager, this.gameState, slotId);
  }

  constructor() {
    this.gameState = new GameState();
    ErrorHandler.init();
    logger.info('GameApplication instance created.');
  }

  public init(container: HTMLElement): boolean {
    if (this.isInitialized) {
      logger.warn('GameApplication already initialized.');
      return true;
    }

    // Check WebGL availability
    if (!ErrorHandler.isWebGLAvailable()) {
      const msg = 'WebGL is not supported or is disabled in your browser environment.';
      logger.error(msg);
      globalEventBus.emit('app:error', {
        title: 'WebGL Not Available',
        message: msg,
      });
      return false;
    }

    try {
      this.container = container;
      this.rendererManager = new RendererManager(container, this.gameState);
      this.isInitialized = true;
      logger.info('GameApplication initialized successfully.');
      globalEventBus.emit('app:ready');
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to initialize GameApplication:', err);
      globalEventBus.emit('app:error', {
        title: 'Initialization Error',
        message: `Failed to initialize 3D scene: ${errorMsg}`,
      });
      return false;
    }
  }

  public resetCamera(): void {
    if (this.rendererManager) {
      this.rendererManager.cameraController.resetView();
    }
  }

  public zoomIn(): void {
    if (this.rendererManager) {
      this.rendererManager.cameraController.zoomIn();
    }
  }

  public zoomOut(): void {
    if (this.rendererManager) {
      this.rendererManager.cameraController.zoomOut();
    }
  }

  public rotateCameraLeft(): void {
    if (this.rendererManager) {
      this.rendererManager.cameraController.rotateLeft();
    }
  }

  public rotateCameraRight(): void {
    if (this.rendererManager) {
      this.rendererManager.cameraController.rotateRight();
    }
  }

  public toggleGrid(): boolean {
    if (this.rendererManager) {
      const terrain = this.rendererManager.worldManager.terrainGenerator;
      const next = !terrain.getGridVisible();
      terrain.setGridVisible(next);
      return next;
    }
    return true;
  }

  public setLightingPreset(preset: 'day' | 'golden' | 'dusk'): void {
    if (this.rendererManager) {
      this.rendererManager.lightingSetup.setTimePreset(preset);
    }
  }

  public focusSelectedEntity(): void {
    if (!this.rendererManager) return;
    const selected = this.rendererManager.selectionManager.getSelectedEntity();
    if (selected) {
      const corner = this.rendererManager.worldManager.gridSystem.gridToWorldCenter(
        selected.gridX,
        selected.gridZ
      );
      this.rendererManager.cameraController.focusOn(corner.x, corner.z, 28);
    }
  }

  public startBuildingPlacement(definitionId: string): boolean {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.cancel();
      this.rendererManager.selectionManager.clearSelection();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(true);
      return this.rendererManager.constructionController.startPlacement(definitionId);
    }
    return false;
  }

  public rotatePlacement(): void {
    if (this.rendererManager) {
      this.rendererManager.constructionController.rotateBuilding();
    }
  }

  public cancelPlacement(): void {
    if (this.rendererManager) {
      this.rendererManager.constructionController.cancelPlacement();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(false);
    }
  }

  public startRoadConstruction(type: RoadTypeId = 'two_lane_urban'): void {
    if (this.rendererManager) {
      this.rendererManager.constructionController.cancelPlacement();
      this.rendererManager.selectionManager.clearSelection();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(true);
      this.rendererManager.roadConstructionController.startConstruction(type);
    }
  }

  public startRoadDemolition(): void {
    if (this.rendererManager) {
      this.rendererManager.constructionController.cancelPlacement();
      this.rendererManager.selectionManager.clearSelection();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(true);
      this.rendererManager.roadConstructionController.startDemolition();
    }
  }

  public cancelRoadWork(): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.cancel();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(false);
    }
  }

  public setRoadType(type: RoadTypeId): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.setRoadType(type);
    }
  }

  public toggleRoadRoutingMode(): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.toggleRoutingMode();
    }
  }

  public setRoadWidthBlocks(width: number): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.setWidthBlocks(width);
    }
  }

  public toggleRoadDirectionalAllocation(): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.toggleDirectionalAllocation();
    }
  }

  public cancelRoadConstruction(): void {
    if (this.rendererManager) {
      this.rendererManager.roadConstructionController.cancel();
      this.rendererManager.worldManager.terrainGenerator.setConstructionMode(false);
    }
  }

  public commitRoadConstruction(): boolean {
    if (this.rendererManager) {
      return this.rendererManager.roadConstructionController.commitRouteConstruction();
    }
    return false;
  }

  public removeSelectedBuilding(): { success: boolean; refund: number; error?: string } {
    if (!this.rendererManager) return { success: false, refund: 0, error: 'Engine offline' };
    const selectedId = this.gameState.getSelectedEntityId();
    if (!selectedId) return { success: false, refund: 0, error: 'No entity selected' };
    return this.rendererManager.worldManager.removeBuilding(selectedId);
  }

  public purchaseLandParcel(parcelId: string): { success: boolean; cost: number; error?: string } {
    if (!this.worldManager) return { success: false, cost: 0, error: 'World not ready' };
    return this.worldManager.purchaseLandParcel(parcelId);
  }

  public purchaseVehicle(
    definitionId: string,
    options?: Parameters<WorldManager['purchaseVehicle']>[1]
  ): ReturnType<WorldManager['purchaseVehicle']> {
    if (!this.worldManager) return { success: false, cost: 0, error: 'World not ready' };
    return this.worldManager.purchaseVehicle(definitionId, options);
  }

  public salvageVehicle(vehicleId: string): { success: boolean; refund: number; error?: string } {
    if (!this.worldManager) return { success: false, refund: 0, error: 'World not ready' };
    return this.worldManager.salvageVehicle(vehicleId);
  }

  public dispatchVehicle(vehicleId: string, destination?: string): { success: boolean; error?: string } {
    if (!this.worldManager) return { success: false, error: 'World not ready' };
    return this.worldManager.dispatchVehicle(vehicleId, destination);
  }

  public returnVehicle(vehicleId: string, targetFacilityId?: string): { success: boolean; error?: string } {
    if (!this.worldManager) return { success: false, error: 'World not ready' };
    return this.worldManager.returnVehicle(vehicleId, targetFacilityId);
  }

  public getVehicleRouteProgress(vehicleId: string): VehicleRouteProgressInfo | null {
    if (!this.worldManager) return null;
    return this.worldManager.getVehicleRouteProgress(vehicleId);
  }

  public rerouteVehicle(vehicleId: string): { success: boolean; message: string } {
    if (!this.worldManager) return { success: false, message: 'World engine offline' };
    return this.worldManager.rerouteVehicle(vehicleId);
  }

  public performVehicleMaintenance(vehicleId: string): ReturnType<WorldManager['maintenanceManager']['performMaintenance']> {
    if (!this.worldManager) {
      return { success: false, vehicleId, cost: 0, error: 'World not ready' };
    }
    return this.worldManager.maintenanceManager.performMaintenance(vehicleId, this.gameState);
  }

  public completeContract(contractId: string, rewardCash: number, rewardXp: number): { success: boolean; error?: string } {
    return this.gameState.claimTaskReward(contractId, rewardCash, rewardXp);
  }

  public dispose(): void {
    if (this.rendererManager) {
      this.rendererManager.dispose();
      this.rendererManager = null;
    }
    this.isInitialized = false;
    logger.info('GameApplication disposed.');
  }
}
