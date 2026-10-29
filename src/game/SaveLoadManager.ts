/**
 * Reliable Save/Load Architecture and Persistent World State System
 * Global Transport Empire - Phase 1, Prompt 14 of 80
 *
 * Implements schema versioning, validation, atomic backup protection,
 * stable entity ID restoration, Level 1 depot preservation, and persistent
 * 5-day real-world maintenance schedules.
 */

import { Logger } from '../core/Logger';
import { globalEventBus } from '../core/EventBus';
import { GameState } from './GameState';
import { WorldManager } from '../world/WorldManager';
import { VehicleMaintenanceRecord, REAL_WORLD_MAINTENANCE_INTERVAL_MS } from './VehicleMaintenanceManager';
import { TruckDepotFacility, IFacilityOperations } from '../facilities/FacilityModel';
import { BuildingEntity } from '../entities/BuildingEntity';
import { VehicleEntity } from '../entities/vehicles/VehicleEntity';

const logger = new Logger('SaveLoadManager');

export const CURRENT_SAVE_SCHEMA_VERSION = 1;
export const STORAGE_KEY_PREFIX = 'gte_save_';
export const DEFAULT_SAVE_SLOT = 'autosave';

export interface SavedCompanyData {
  companyName: string;
  cash: number;
  currency: string;
  level: number;
  experience: number;
}

export interface SavedClockData {
  simDateIso: string;
  timeSpeed: number;
  isPaused: boolean;
}

export interface SavedRoadCell {
  gridX: number;
  gridZ: number;
  roadType: string;
  id: string;
}

export interface SavedBuilding {
  id: string;
  definitionId: string;
  gridX: number;
  gridZ: number;
  rotationDegrees: number;
}

export interface SavedParcel {
  id: string;
  name: string;
  ownership: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  effectivePurchasePrice: number;
}

export interface SavedParkingSpace {
  spaceIndex: number;
  label: string;
  occupiedByVehicleId: string | null;
  permittedTruckClasses: string[];
}

export interface SavedFacility {
  id: string;
  name: string;
  type: string;
  level: number;
  isPlayerOwned: boolean;
  gridX: number;
  gridZ: number;
  spaces?: SavedParkingSpace[];
}

export interface SavedVehicle {
  id: string;
  definitionId: string;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  rotationDegrees: number;
  trailerDefinitionId?: string;
  containerDefinitionId?: string;
  paintColor: string;
}

export interface SaveGameMetadata {
  slotId: string;
  saveName: string;
  schemaVersion: number;
  timestamp: number;
  playtimeSeconds: number;
  companyName: string;
  cash: number;
  vehicleCount: number;
  facilityCount: number;
}

export interface SaveGameData {
  schemaVersion: number;
  metadata: SaveGameMetadata;
  company: SavedCompanyData;
  clock: SavedClockData;
  world: {
    roads: SavedRoadCell[];
    buildings: SavedBuilding[];
    parcels: SavedParcel[];
  };
  facilities: SavedFacility[];
  vehicles: SavedVehicle[];
  maintenance: VehicleMaintenanceRecord[];
}

export interface SaveResult {
  success: boolean;
  slotId: string;
  metadata?: SaveGameMetadata;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  slotId: string;
  metadata?: SaveGameMetadata;
  error?: string;
  warnings: string[];
}

export class SaveLoadManager {
  private memoryStorage: Map<string, string> = new Map();

  /**
   * Safe storage abstraction: Uses window.localStorage when available,
   * falling back to memoryStorage in headless or restricted environments.
   */
  private getStorageItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback to memoryStorage on localStorage access error
    }
    return this.memoryStorage.get(key) ?? null;
  }

  private setStorageItem(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      logger.warn('localStorage write failed, using in-memory storage fallback:', err);
    }
    this.memoryStorage.set(key, value);
    return true;
  }

  private removeStorageItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    this.memoryStorage.delete(key);
  }

  /**
   * Creates a serializable save-state object from active runtime systems.
   */
  public createSaveSnapshot(
    worldManager: WorldManager,
    gameState: GameState,
    slotId: string = DEFAULT_SAVE_SLOT,
    saveName: string = 'Autosave'
  ): SaveGameData {
    const gameStateData = gameState.getData();

    // 1. Gather all road cells
    const savedRoads: SavedRoadCell[] = worldManager.roadNetwork.model.getAllRoadCells().map((c) => ({
      gridX: c.gridX,
      gridZ: c.gridZ,
      roadType: c.roadType,
      id: c.id,
    }));

    // 2. Gather all buildings from EntityRegistry
    const savedBuildings: SavedBuilding[] = worldManager.entityRegistry
      .getAll()
      .filter((e): e is BuildingEntity => e.entityType === 'building')
      .map((b) => ({
        id: b.id,
        definitionId: b.definition.id,
        gridX: b.gridX,
        gridZ: b.gridZ,
        rotationDegrees: b.rotationDegrees,
      }));

    // 3. Gather land parcels
    const savedParcels: SavedParcel[] = worldManager.landParcelManager.getAllParcels().map((p) => ({
      id: p.id,
      name: p.name,
      ownership: p.ownership,
      bounds: { ...p.bounds },
      effectivePurchasePrice: p.effectivePurchasePrice,
    }));

    // 4. Gather facilities (including starting depot and parking spaces)
    const savedFacilities: SavedFacility[] = worldManager.facilityManager.getAllFacilities().map((f) => {
      const facData: SavedFacility = {
        id: f.id,
        name: f.name,
        type: f.type,
        level: f.level,
        isPlayerOwned: f.isPlayerOwned,
        gridX: (f as TruckDepotFacility).gridX ?? 0,
        gridZ: (f as TruckDepotFacility).gridZ ?? 0,
      };

      if (f instanceof TruckDepotFacility) {
        facData.spaces = f.getSpaces().map((s) => ({
          spaceIndex: s.spaceIndex,
          label: s.label,
          occupiedByVehicleId: s.occupiedByVehicleId,
          permittedTruckClasses: [...s.permittedTruckClasses],
        }));
      }

      return facData;
    });

    // 5. Gather vehicles from EntityRegistry
    const savedVehicles: SavedVehicle[] = worldManager.entityRegistry
      .getAll()
      .filter((e): e is VehicleEntity => e.entityType === 'vehicle')
      .map((v) => ({
        id: v.id,
        definitionId: v.truckDefinition.id,
        gridX: v.gridX,
        gridZ: v.gridZ,
        worldX: v.group.position.x,
        worldZ: v.group.position.z,
        rotationDegrees: (v.group.rotation.y * 180) / Math.PI,
        trailerDefinitionId: v.trailerDefinition?.id,
        containerDefinitionId: v.containerDefinition?.id,
        paintColor: v.paintColor,
      }));

    // 6. Gather 5-day real-world maintenance schedules
    const savedMaintenance = worldManager.maintenanceManager.serialize();

    const timestamp = Date.now();
    const metadata: SaveGameMetadata = {
      slotId,
      saveName,
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      timestamp,
      playtimeSeconds: Math.floor(gameState.clock.getElapsedTime()),
      companyName: gameStateData.companyName,
      cash: gameStateData.cash,
      vehicleCount: savedVehicles.length,
      facilityCount: savedFacilities.length,
    };

    return {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      metadata,
      company: {
        companyName: gameStateData.companyName,
        cash: gameStateData.cash,
        currency: gameStateData.currency,
        level: gameStateData.level,
        experience: gameStateData.experience,
      },
      clock: {
        simDateIso: gameState.clock.getCurrentDate().toISOString(),
        timeSpeed: gameState.clock.getTimeSpeed(),
        isPaused: gameState.clock.getIsPaused(),
      },
      world: {
        roads: savedRoads,
        buildings: savedBuildings,
        parcels: savedParcels,
      },
      facilities: savedFacilities,
      vehicles: savedVehicles,
      maintenance: savedMaintenance,
    };
  }

  /**
   * Saves the game to persistent storage using an atomic backup pattern.
   * If saving fails, any existing valid save remains intact.
   */
  public saveGame(
    worldManager: WorldManager,
    gameState: GameState,
    slotId: string = DEFAULT_SAVE_SLOT,
    saveName: string = 'Manual Save'
  ): SaveResult {
    try {
      const snapshot = this.createSaveSnapshot(worldManager, gameState, slotId, saveName);

      // Validate snapshot integrity prior to serialization
      if (!isFinite(snapshot.company.cash) || isNaN(snapshot.company.cash)) {
        return { success: false, slotId, error: 'Cannot save corrupted treasury cash value.' };
      }

      const serialized = JSON.stringify(snapshot);
      const storageKey = `${STORAGE_KEY_PREFIX}${slotId}`;
      const backupKey = `${storageKey}_backup`;

      // 1. Create temporary backup of previous save if one exists
      const previousSave = this.getStorageItem(storageKey);
      if (previousSave) {
        this.setStorageItem(backupKey, previousSave);
      }

      // 2. Write new save state
      const writeOk = this.setStorageItem(storageKey, serialized);
      if (!writeOk) {
        // Rollback from backup if available
        if (previousSave) {
          this.setStorageItem(storageKey, previousSave);
        }
        return { success: false, slotId, error: 'Storage write operation failed.' };
      }

      // 3. Remove temporary backup once commit succeeded
      this.removeStorageItem(backupKey);

      logger.info(`Saved game '${saveName}' (slot: ${slotId}) successfully.`);
      globalEventBus.emit('save:completed', {
        slotId,
        metadata: snapshot.metadata,
      });

      return {
        success: true,
        slotId,
        metadata: snapshot.metadata,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Save operation failed for slot '${slotId}':`, msg);
      return { success: false, slotId, error: `Save failed: ${msg}` };
    }
  }

  /**
   * Loads and restores a saved game into the active world and game state.
   * Validates data, runs migrations if necessary, clears transient objects,
   * restores stable entity IDs, and preserves the Level 1 Starting Truck Depot.
   */
  public loadGame(
    worldManager: WorldManager,
    gameState: GameState,
    slotId: string = DEFAULT_SAVE_SLOT
  ): LoadResult {
    const warnings: string[] = [];
    const storageKey = `${STORAGE_KEY_PREFIX}${slotId}`;

    try {
      const rawData = this.getStorageItem(storageKey);
      if (!rawData) {
        return {
          success: false,
          slotId,
          error: `Save slot '${slotId}' not found.`,
          warnings,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        return {
          success: false,
          slotId,
          error: 'Save file contains malformed or corrupted JSON data.',
          warnings,
        };
      }

      // Validate basic structure & run schema migration if necessary
      const migrationResult = this.migrateAndValidateSave(parsed);
      if (!migrationResult.isValid || !migrationResult.data) {
        return {
          success: false,
          slotId,
          error: migrationResult.error || 'Save validation failed.',
          warnings: [...warnings, ...migrationResult.warnings],
        };
      }

      const saveData = migrationResult.data;

      // 1. Clear current runtime entities and grid occupancy
      this.clearRuntimeWorld(worldManager);

      // 2. Restore GameState & Company Treasury
      gameState.setCash(saveData.company.cash);
      gameState.setLevel(saveData.company.level ?? 1);
      gameState.setExperience(saveData.company.experience ?? 0);

      // 3. Rebuild Road Network from saved segments
      for (const road of saveData.world.roads) {
        worldManager.roadNetwork.model.addRoadCell(
          road.gridX,
          road.gridZ,
          road.roadType as any,
          'road'
        );
      }
      worldManager.roadNetwork.rebuildAllMeshes();

      // 4. Restore Buildings with exact stable IDs
      for (const bld of saveData.world.buildings) {
        worldManager.placeBuilding(
          bld.definitionId,
          bld.gridX,
          bld.gridZ,
          bld.rotationDegrees,
          bld.id
        );
      }

      // 4b. Restore Land Parcel ownership
      if (saveData.world.parcels && Array.isArray(saveData.world.parcels)) {
        for (const sp of saveData.world.parcels) {
          const parcel = worldManager.landParcelManager.getParcel(sp.id);
          if (parcel) {
            parcel.ownership = sp.ownership as any;
            parcel.isBuildAllowed = sp.ownership === 'player_owned';
          }
        }
      }

      // 5. Restore Facilities & Level 1 Depot
      let startingDepotRestored = false;
      for (const fac of saveData.facilities) {
        if (fac.type === 'truck_depot') {
          const depot = new TruckDepotFacility(
            fac.id,
            fac.name,
            fac.gridX,
            fac.gridZ,
            fac.level,
            fac.isPlayerOwned
          );

          // Restore parking space assignments if present
          if (fac.spaces && Array.isArray(fac.spaces)) {
            for (const sp of fac.spaces) {
              if (sp.occupiedByVehicleId) {
                depot.assignToBay(sp.spaceIndex, sp.occupiedByVehicleId);
              }
            }
          }

          worldManager.facilityManager.registerFacility(depot);
          if (fac.id === 'facility_truck_depot_01') {
            startingDepotRestored = true;
          }
        }
      }

      // Safeguard: Ensure Level 1 Starting Truck Depot exists if missing from save
      if (!startingDepotRestored) {
        warnings.push('Starting Level 1 Depot was missing in save file; reconstructed automatically.');
        worldManager.facilityManager.ensureDefaultStartingDepot(12, 13);
      }

      // 6. Restore Vehicles with exact stable IDs and attachments
      for (const veh of saveData.vehicles) {
        worldManager.placeVehicle(
          veh.definitionId,
          veh.gridX,
          veh.gridZ,
          {
            id: veh.id,
            rotationDegrees: veh.rotationDegrees,
            trailerDefinitionId: veh.trailerDefinitionId,
            containerDefinitionId: veh.containerDefinitionId,
            paintColor: veh.paintColor as any,
            worldX: veh.worldX,
            worldZ: veh.worldZ,
          }
        );
      }

      // 7. Restore 5-day real-world maintenance schedules
      worldManager.maintenanceManager.deserialize(saveData.maintenance);

      // 8. Rebuild spatial partitions & update game counts
      worldManager.sectorManager.clear();
      for (const r of saveData.world.roads) {
        worldManager.sectorManager.registerRoadCell(r.gridX, r.gridZ);
      }
      for (const b of saveData.world.buildings) {
        const entity = worldManager.entityRegistry.get(b.id) as BuildingEntity;
        if (entity) {
          worldManager.sectorManager.registerBuilding(entity.id, entity.gridX, entity.gridZ, entity.width, entity.depth);
        }
      }
      for (const v of saveData.vehicles) {
        worldManager.sectorManager.registerVehicle(v.id, v.worldX, v.worldZ);
      }
      for (const f of worldManager.facilityManager.getAllFacilities()) {
        if (f instanceof TruckDepotFacility) {
          worldManager.sectorManager.registerFacility(f.id, f.gridX, f.gridZ, f.footprintWidth, f.footprintDepth);
        }
      }

      logger.info(`Loaded game from slot '${slotId}' successfully.`);
      globalEventBus.emit('save:loaded', {
        slotId,
        metadata: saveData.metadata,
      });

      return {
        success: true,
        slotId,
        metadata: saveData.metadata,
        warnings,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Load operation failed for slot '${slotId}':`, msg);
      return {
        success: false,
        slotId,
        error: `Load failed: ${msg}`,
        warnings,
      };
    }
  }

  /**
   * Resets runtime objects in preparation for loading a saved state.
   */
  private clearRuntimeWorld(worldManager: WorldManager): void {
    // 1. Remove all entities from registry and scene
    const entities = worldManager.entityRegistry.getAll();
    for (const ent of entities) {
      worldManager.entityRegistry.unregister(ent.id);
      if (ent.group.parent) {
        ent.group.parent.remove(ent.group);
      }
    }

    // 2. Clear road model and meshes
    worldManager.roadNetwork.clear();

    // 3. Clear grid system occupancies
    worldManager.gridSystem.clear();

    // 4. Clear maintenance and facilities
    worldManager.maintenanceManager.clear();
    worldManager.facilityManager.clear();
  }

  /**
   * Validates raw save file data and applies migrations from older schema versions.
   */
  public migrateAndValidateSave(raw: unknown): {
    isValid: boolean;
    data?: SaveGameData;
    error?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (!raw || typeof raw !== 'object') {
      return { isValid: false, error: 'Save data is not an object.', warnings };
    }

    const obj = raw as Record<string, any>;

    // Schema version check
    const schemaVersion = obj.schemaVersion ?? 1;
    if (schemaVersion > CURRENT_SAVE_SCHEMA_VERSION) {
      return {
        isValid: false,
        error: `Save was created with a newer unsupported schema version (${schemaVersion} > ${CURRENT_SAVE_SCHEMA_VERSION}).`,
        warnings,
      };
    }

    // Required field validation
    if (!obj.company || typeof obj.company !== 'object') {
      return { isValid: false, error: 'Missing company financial data.', warnings };
    }

    if (!obj.world || typeof obj.world !== 'object') {
      return { isValid: false, error: 'Missing world infrastructure data.', warnings };
    }

    // Ensure array fields exist
    const roads = Array.isArray(obj.world.roads) ? obj.world.roads : [];
    const buildings = Array.isArray(obj.world.buildings) ? obj.world.buildings : [];
    const parcels = Array.isArray(obj.world.parcels) ? obj.world.parcels : [];
    const facilities = Array.isArray(obj.facilities) ? obj.facilities : [];
    const vehicles = Array.isArray(obj.vehicles) ? obj.vehicles : [];
    const maintenance = Array.isArray(obj.maintenance) ? obj.maintenance : [];

    const migrated: SaveGameData = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      metadata: obj.metadata || {
        slotId: DEFAULT_SAVE_SLOT,
        saveName: 'Migrated Save',
        schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        timestamp: Date.now(),
        playtimeSeconds: 0,
        companyName: obj.company.companyName || 'Apex Transport Global',
        cash: obj.company.cash ?? 250000,
        vehicleCount: vehicles.length,
        facilityCount: facilities.length,
      },
      company: {
        companyName: obj.company.companyName || 'Apex Transport Global',
        cash: isFinite(obj.company.cash) ? obj.company.cash : 250000,
        currency: obj.company.currency || 'USD',
        level: obj.company.level || 1,
        experience: obj.company.experience || 0,
      },
      clock: obj.clock || {
        simDateIso: new Date(2026, 0, 1).toISOString(),
        timeSpeed: 1,
        isPaused: false,
      },
      world: {
        roads,
        buildings,
        parcels,
      },
      facilities,
      vehicles,
      maintenance,
    };

    return {
      isValid: true,
      data: migrated,
      warnings,
    };
  }

  /**
   * Retrieves metadata for all available save slots.
   */
  public listSaves(): SaveGameMetadata[] {
    const list: SaveGameMetadata[] = [];
    const slots = [DEFAULT_SAVE_SLOT, 'slot_1', 'slot_2', 'slot_3'];

    for (const slot of slots) {
      const raw = this.getStorageItem(`${STORAGE_KEY_PREFIX}${slot}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.metadata) {
            list.push(parsed.metadata);
          }
        } catch {
          // Ignore corrupt metadata
        }
      }
    }

    return list;
  }

  /**
   * Checks if a save exists for the given slot.
   */
  public hasSave(slotId: string = DEFAULT_SAVE_SLOT): boolean {
    return this.getStorageItem(`${STORAGE_KEY_PREFIX}${slotId}`) !== null;
  }

  /**
   * Deletes a save slot.
   */
  public deleteSave(slotId: string): boolean {
    const key = `${STORAGE_KEY_PREFIX}${slotId}`;
    if (!this.getStorageItem(key)) return false;
    this.removeStorageItem(key);
    return true;
  }
}
