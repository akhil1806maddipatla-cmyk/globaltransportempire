import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { TerrainGenerator } from './TerrainGenerator';
import { RoadNetwork } from './RoadNetwork';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { BuildingEntity } from '../entities/BuildingEntity';
import { PlacementValidator } from './PlacementValidator';
import { DistrictManager } from './DistrictManager';
import { RoadConstructionValidator } from './RoadConstructionValidator';
import { BUILDING_DEFINITIONS } from '../data/buildingDefinitions';
import { ROAD_DEFINITIONS, RoadTypeId } from '../data/roadDefinitions';
import { INITIAL_WORLD_DATA } from '../data/initialWorldData';
import { GameState } from '../game/GameState';
import { globalEventBus } from '../core/EventBus';
import { GridCoord } from './RoadPathGenerator';
import { EnvironmentalPropsManager } from './EnvironmentalPropsManager';
import { VehicleEntity } from '../entities/vehicles/VehicleEntity';
import {
  VEHICLE_DEFINITIONS,
  TRAILER_DEFINITIONS,
  CONTAINER_DEFINITIONS,
  FleetColor,
} from '../data/vehicleDefinitions';

import { SpatialScaleInspector } from './SpatialScaleInspector';
import { FacilityManager } from '../facilities/FacilityManager';
import { LandParcelManager } from './LandParcelManager';
import { TransportNetwork } from '../network/TransportNetwork';
import { WorldSectorManager } from './WorldSectorManager';
import { VehicleMaintenanceManager } from '../game/VehicleMaintenanceManager';
import { EngineeringDiagnostics, EngineeringAuditReport } from '../core/EngineeringDiagnostics';
import { SpatialQuerySystem } from './SpatialQuerySystem';
import { PathfindingEngine } from '../navigation/PathfindingEngine';
import { RoadNetworkDiagnostics, RoadNetworkAuditReport } from './RoadNetworkDiagnostics';

import { RoadsideDetailingManager } from './RoadsideDetailingManager';
import { TrafficSimulationManager } from './traffic/TrafficSimulationManager';
import { VehicleRouteProgressInfo } from './traffic/TrafficTypes';

export class WorldManager implements IDisposable {
  public readonly scene: THREE.Scene;
  public readonly gridSystem: GridSystem;
  public readonly materialsManager: MaterialsManager;
  public readonly entityRegistry: EntityRegistry;
  public readonly terrainGenerator: TerrainGenerator;
  public readonly roadNetwork: RoadNetwork;
  public readonly environmentalProps: EnvironmentalPropsManager;
  public readonly roadsideDetailing: RoadsideDetailingManager;
  public readonly scaleInspector: SpatialScaleInspector;
  public readonly placementValidator: PlacementValidator;
  public readonly roadValidator: RoadConstructionValidator;
  public readonly districtManager: DistrictManager;
  public readonly facilityManager: FacilityManager;
  public readonly landParcelManager: LandParcelManager;
  public readonly transportNetwork: TransportNetwork;
  public readonly sectorManager: WorldSectorManager;
  public readonly maintenanceManager: VehicleMaintenanceManager;
  public readonly spatialQuery: SpatialQuerySystem;
  public readonly pathfinding: PathfindingEngine;
  public readonly trafficManager: TrafficSimulationManager;

  private gameState: GameState;

  constructor(scene: THREE.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;

    this.gridSystem = new GridSystem();
    this.materialsManager = new MaterialsManager();
    this.entityRegistry = new EntityRegistry();
    this.terrainGenerator = new TerrainGenerator(this.gridSystem, this.materialsManager);
    this.roadNetwork = new RoadNetwork(this.gridSystem, this.materialsManager);
    this.environmentalProps = new EnvironmentalPropsManager(
      this.gridSystem,
      this.materialsManager,
      this.roadNetwork.model
    );
    this.roadsideDetailing = new RoadsideDetailingManager(
      this.gridSystem,
      this.roadNetwork.model,
      this.materialsManager
    );
    this.scaleInspector = new SpatialScaleInspector(
      this.scene,
      this.gridSystem,
      this.entityRegistry,
      this.roadNetwork
    );
    this.districtManager = new DistrictManager();
    this.facilityManager = new FacilityManager();
    this.landParcelManager = new LandParcelManager();
    this.placementValidator = new PlacementValidator(
      this.gridSystem,
      this.roadNetwork.model,
      this.gridSystem.terrainModel,
      this.gridSystem.terrainModel.waterSystem,
      this.landParcelManager
    );
    this.roadValidator = new RoadConstructionValidator(this.gridSystem, this.roadNetwork.model);
    this.transportNetwork = new TransportNetwork();
    this.sectorManager = new WorldSectorManager();
    this.maintenanceManager = new VehicleMaintenanceManager();
    this.spatialQuery = new SpatialQuerySystem(
      this.gridSystem,
      this.gridSystem.terrainModel,
      this.gridSystem.terrainModel.waterSystem,
      this.landParcelManager,
      this.roadNetwork.model,
      this.entityRegistry
    );
    this.pathfinding = new PathfindingEngine(
      this.gridSystem,
      this.roadNetwork.model,
      this.gridSystem.terrainModel,
      this.gridSystem.terrainModel.waterSystem,
      this.transportNetwork
    );
    this.trafficManager = new TrafficSimulationManager(
      this.gridSystem,
      this.roadNetwork.model,
      this.pathfinding,
      this.entityRegistry,
      this.facilityManager
    );

    this.scene.add(this.terrainGenerator.group);
    this.scene.add(this.roadNetwork.group);
    this.scene.add(this.environmentalProps.group);
    this.scene.add(this.roadsideDetailing.group);
  }

  public initializeWorld(): void {
    // 0. Apply natural terrain water obstacles & geographic constraints
    this.gridSystem.applyNaturalTerrainFeatures();

    // 1. Generate base terrain, natural water bodies, and tactical grid
    this.terrainGenerator.generate();

    // 2. Generate gapless roads and register road grid occupancy
    this.roadNetwork.buildFromInitialData(INITIAL_WORLD_DATA.roads);

    // 2B. Configure bridge deck elevations and approach transitions
    for (const bridge of this.waterSystem.bridgeCrossings) {
      const minX = Math.min(bridge.startCoord.gridX, bridge.endCoord.gridX);
      const maxX = Math.max(bridge.startCoord.gridX, bridge.endCoord.gridX);
      const minZ = Math.min(bridge.startCoord.gridZ, bridge.endCoord.gridZ);
      const maxZ = Math.max(bridge.startCoord.gridZ, bridge.endCoord.gridZ);
      for (let bx = minX; bx <= maxX; bx++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.roadNetwork.model.hasRoad(bx, bz)) {
            const isDeckEnd = (bx === minX && bz === minZ) || (bx === maxX && bz === maxZ);
            this.roadNetwork.model.setRoadElevationAndLayer(
              bx,
              bz,
              bridge.deckElevation,
              'bridge',
              isDeckEnd
            );
          }
        }
      }
    }
    this.roadNetwork.rebuildAllMeshes();

    // 3. Build designated future expansion plots
    this.terrainGenerator.buildConstructionPlots(INITIAL_WORLD_DATA.constructionPlots);

    // 4. Build roadside trees and greenery
    this.terrainGenerator.buildTrees(INITIAL_WORLD_DATA.trees);

    // 5. Build initial deliberate buildings using atomic placement
    INITIAL_WORLD_DATA.buildings.forEach((inst) => {
      this.placeBuilding(inst.definitionId, inst.gridX, inst.gridZ, (inst.rotation * 180) / Math.PI, inst.id);
    });

    // 6. Generate environmental props & roadside detailing infrastructure
    this.environmentalProps.generate();
    this.roadsideDetailing.generate();

    // 7. Spawn initial road freight fleet & intermodal carriers
    INITIAL_WORLD_DATA.vehicles.forEach((inst) => {
      this.placeVehicle(
        inst.definitionId,
        inst.gridX,
        inst.gridZ,
        {
          id: inst.id,
          rotationDegrees: inst.rotationDegrees,
          trailerDefinitionId: inst.trailerDefinitionId,
          containerDefinitionId: inst.containerDefinitionId,
          paintColor: inst.paintColor,
          worldX: inst.worldX,
          worldY: inst.worldY,
          worldZ: inst.worldZ,
          offsetX: inst.offsetX,
          offsetZ: inst.offsetZ,
        }
      );
      // Register initial fleet vehicles into the 5-day real-world maintenance schedule
      this.maintenanceManager.registerVehicle(inst.id, 'road', 320);
    });

    // 8. Ensure pre-built Level 1 Truck Depot exists automatically in new game
    const starterDepot = this.facilityManager.ensureDefaultStartingDepot(12, 13);
    this.facilityManager.assignVehicleToPrimaryDepot('veh_prime_mover_01', 'prime_mover_6x4');
    this.sectorManager.registerFacility(starterDepot.id, starterDepot.gridX, starterDepot.gridZ, starterDepot.footprintWidth, starterDepot.footprintDepth);

    // 9. Initialize multi-modal transport network topology & visual gateways
    this.transportNetwork.initializeStartingTopology(11, 14);

    // 10. Populate spatial partition sectors & initialize world streaming
    for (const seg of INITIAL_WORLD_DATA.roads) {
      for (let i = 0; i < seg.length; i++) {
        const rx = seg.direction === 'horizontal' ? seg.gridX + i : seg.gridX;
        const rz = seg.direction === 'vertical' ? seg.gridZ + i : seg.gridZ;
        this.sectorManager.registerRoadCell(rx, rz);
      }
    }
    this.sectorManager.initializeDefaultSectorGrid(this.gridSystem.width, this.gridSystem.height);
    this.sectorManager.updateStreaming(0, 0);

    // Update game state counts
    this.updateWorldCounts();

    // 11. Rebuild spatial query hash index
    this.spatialQuery.rebuildIndex();

    // 12. Initialize autonomous traffic flow & intersection coordinator
    this.trafficManager.initialize();
    this.pathfinding.setIntersectionCoordinator(this.trafficManager.intersectionCoordinator);

    // 13. Run engineering diagnostics validation
    this.runEngineeringDiagnostics();
  }

  /**
   * Runs an authoritative engineering audit across all world subsystems.
   */
  public runEngineeringDiagnostics(): EngineeringAuditReport {
    return EngineeringDiagnostics.runFullSystemAudit({
      facilityManager: this.facilityManager,
      roadNetworkModel: this.roadNetwork.model,
      transportNetwork: this.transportNetwork,
      gameState: this.gameState,
      maintenanceManager: this.maintenanceManager,
      entityRegistry: this.entityRegistry,
      terrainModel: this.terrainModel,
      waterModel: this.waterSystem,
      parcelManager: this.landParcelManager,
      sectorManager: this.sectorManager,
      spatialQuery: this.spatialQuery,
      pathfinder: this.pathfinding,
    });
  }

  /**
   * Runs an authoritative civil engineering audit across the road network and junctions.
   */
  public runRoadNetworkAudit(): RoadNetworkAuditReport {
    return RoadNetworkDiagnostics.runComprehensiveAudit({
      roadNetworkModel: this.roadNetwork.model,
      gridSystem: this.gridSystem,
      transportNetwork: this.transportNetwork,
      pathfinding: this.pathfinding,
      worldManager: this,
    });
  }

  /**
   * Automatically repairs asymmetric or desynchronized road connections and refreshes 3D meshes.
   */
  public autoRepairRoadNetwork(): { repairedCount: number; actionsTaken: string[] } {
    const res = RoadNetworkDiagnostics.autoHealNetwork(this.roadNetwork.model);
    this.roadNetwork.rebuildAllMeshes();
    this.pathfinding.invalidateCache('road');
    return res;
  }

  /**
   * Atomic Road Path Construction Transaction
   */
  public constructRoadPath(
    path: GridCoord[],
    roadTypeId: RoadTypeId = 'two_lane_urban'
  ): { success: boolean; cost: number; newSegmentCount: number; error?: string } {
    const roadDef = ROAD_DEFINITIONS[roadTypeId];
    if (!roadDef) {
      return { success: false, cost: 0, newSegmentCount: 0, error: `Invalid road type '${roadTypeId}'.` };
    }

    // 1. Pure validation
    const currentFunds = this.gameState.getCash();
    const validation = this.roadValidator.validatePath(path, roadDef, currentFunds);

    if (!validation.isValid) {
      return { success: false, cost: 0, newSegmentCount: 0, error: validation.message };
    }

    if (validation.newCells.length === 0) {
      return { success: true, cost: 0, newSegmentCount: 0 };
    }

    // 2. Atomic state mutation
    try {
      // Deduct funds
      this.gameState.setCash(currentFunds - validation.totalCost);

      // Add road cells & delta-refresh meshes
      this.roadNetwork.addRoadCellsAndRefresh(validation.newCells, roadTypeId);
      for (const cell of validation.newCells) {
        this.sectorManager.registerRoadCell(cell.x, cell.z);
      }

      // Invalidate road path cache and register new cells in spatialQuery
      this.pathfinding.invalidateCache('road');
      for (const cell of validation.newCells) {
        const center = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
        const halfSize = this.gridSystem.cellSize / 2;
        this.spatialQuery.insertEntry({
          id: `road_${cell.x}_${cell.z}`,
          entityType: 'road',
          worldX: center.x,
          worldZ: center.z,
          radiusMeters: halfSize * 1.414,
          minX: center.x - halfSize,
          maxX: center.x + halfSize,
          minZ: center.z - halfSize,
          maxZ: center.z + halfSize,
        });
      }

      // Update counts
      this.updateWorldCounts();

      // Notify traffic simulation of topology expansion
      this.trafficManager.handleRoadNetworkChanged(validation.newCells);

      // Emit event
      globalEventBus.emit('world:road_constructed', {
        newCells: validation.newCells,
        totalCost: validation.totalCost,
        roadType: roadTypeId,
      });

      return {
        success: true,
        cost: validation.totalCost,
        newSegmentCount: validation.newCells.length,
      };
    } catch (err: unknown) {
      // Rollback on failure
      this.gameState.setCash(currentFunds);
      for (const cell of validation.newCells) {
        this.roadNetwork.removeRoadCellAndRefresh(cell.x, cell.z);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, cost: 0, newSegmentCount: 0, error: `Road construction failed: ${msg}` };
    }
  }

  /**
   * Safe Road Demolition Transaction
   */
  public demolishRoadCell(x: number, z: number): { success: boolean; refund: number; error?: string } {
    if (!this.roadNetwork.model.hasRoad(x, z)) {
      return { success: false, refund: 0, error: `No road structure exists at (${x}, ${z}).` };
    }

    const cellData = this.roadNetwork.model.getRoadCell(x, z);
    const roadDef = cellData ? ROAD_DEFINITIONS[cellData.roadType as RoadTypeId] || ROAD_DEFINITIONS['two_lane_urban'] : ROAD_DEFINITIONS['two_lane_urban'];
    const refund = Math.floor(roadDef.costPerCell * 0.5); // 50% salvage salvage refund

    try {
      const removed = this.roadNetwork.removeRoadCellAndRefresh(x, z);
      if (!removed) {
        return { success: false, refund: 0, error: 'Failed to remove road segment from topology.' };
      }

      // Refund funds
      this.gameState.setCash(this.gameState.getCash() + refund);

      // Invalidate road path cache and update spatial partition
      this.pathfinding.invalidateCache('road');
      this.spatialQuery.removeEntry(`road_${x}_${z}`);
      this.sectorManager.unregisterRoadCell(x, z);
      this.updateWorldCounts();

      // Notify traffic simulation to invalidate active routes traversing demolished cell
      this.trafficManager.handleRoadNetworkChanged([{ x, z }]);

      globalEventBus.emit('world:road_demolished', { x, z, refund });
      return { success: true, refund };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, refund: 0, error: `Demolition error: ${msg}` };
    }
  }

  /**
   * Atomic Building Placement Transaction
   */
  public placeBuilding(
    definitionId: string,
    gridX: number,
    gridZ: number,
    rotationDegrees: number = 0,
    forcedId?: string
  ): { success: boolean; entity?: BuildingEntity; error?: string } {
    const def = BUILDING_DEFINITIONS[definitionId];
    if (!def) {
      return { success: false, error: `Building definition '${definitionId}' not found.` };
    }

    const isInitialSetup = !!forcedId;
    const currentFunds = this.gameState.getCash();

    // 1. Validate placement purely with funds check
    const validation = this.placementValidator.validate(
      def,
      gridX,
      gridZ,
      rotationDegrees,
      isInitialSetup ? undefined : currentFunds
    );

    if (!validation.isValid) {
      return { success: false, error: validation.message };
    }

    const buildingId = forcedId || `bld_${def.category}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const { effectiveWidth, effectiveDepth } = this.gridSystem.calculateRotatedFootprint(
      def.footprintWidth,
      def.footprintDepth,
      rotationDegrees
    );

    try {
      // 2. Deduct funds if active gameplay placement
      if (!isInitialSetup) {
        this.gameState.setCash(currentFunds - def.cost);
      }

      // 3. Reserve grid cells
      this.gridSystem.setAreaOccupancy(
        gridX,
        gridZ,
        effectiveWidth,
        effectiveDepth,
        'building',
        buildingId
      );

      // 4. Calculate world center
      const worldCenter = this.gridSystem.getFootprintWorldCenter(
        gridX,
        gridZ,
        def.footprintWidth,
        def.footprintDepth,
        rotationDegrees
      );

      // 5. Instantiate 3D building entity
      const building = new BuildingEntity(
        buildingId,
        def,
        gridX,
        gridZ,
        worldCenter.x,
        worldCenter.z,
        this.materialsManager,
        rotationDegrees
      );

      // 6. Register in spatial entity registry and spatial query index
      this.entityRegistry.register(building);
      this.spatialQuery.registerEntity(building);
      this.scene.add(building.group);

      // 7. Update counts, partition sectors, and notify
      this.sectorManager.registerBuilding(buildingId, gridX, gridZ, effectiveWidth, effectiveDepth);
      this.updateWorldCounts();
      globalEventBus.emit('world:building_placed', {
        id: buildingId,
        name: def.name,
        gridX,
        gridZ,
        width: effectiveWidth,
        depth: effectiveDepth,
        cost: isInitialSetup ? 0 : def.cost,
      });

      return { success: true, entity: building };
    } catch (err: unknown) {
      // Rollback on failure
      if (!isInitialSetup) {
        this.gameState.setCash(currentFunds);
      }
      this.gridSystem.clearAreaOccupancy(gridX, gridZ, effectiveWidth, effectiveDepth, buildingId);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Placement transaction failed: ${msg}` };
    }
  }

  /**
   * Safe Building Removal with Salvage Refund
   */
  public removeBuilding(buildingId: string): { success: boolean; refund: number; error?: string } {
    const entity = this.entityRegistry.get(buildingId);
    if (!entity || !(entity instanceof BuildingEntity)) {
      return { success: false, refund: 0, error: `Building '${buildingId}' not found.` };
    }

    const refund = Math.floor(entity.definition.cost * 0.5);

    try {
      // Free only cells owned by this specific building
      this.gridSystem.clearAreaOccupancy(
        entity.gridX,
        entity.gridZ,
        entity.width,
        entity.depth,
        buildingId
      );

      // If currently selected, clear selection
      if (this.gameState.getSelectedEntityId() === buildingId) {
        this.gameState.selectEntity(null);
      }

      // Remove from scene, spatial index, and unregister
      this.scene.remove(entity.group);
      this.spatialQuery.unregisterEntity(buildingId);
      this.entityRegistry.unregister(buildingId);
      this.sectorManager.unregisterBuilding(buildingId);
      entity.dispose();

      // Credit salvage refund
      this.gameState.setCash(this.gameState.getCash() + refund);

      this.updateWorldCounts();
      globalEventBus.emit('world:building_removed', {
        id: buildingId,
        name: entity.definition.name,
        refund,
      });

      return { success: true, refund };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, refund: 0, error: `Demolition failed: ${msg}` };
    }
  }

  /**
   * Spawns a Road Freight Vehicle Entity into the World Scene & Entity Registry
   */
  public placeVehicle(
    definitionId: string,
    gridX: number,
    gridZ: number,
    options: {
      id?: string;
      rotationDegrees?: number;
      trailerDefinitionId?: string;
      containerDefinitionId?: string;
      paintColor?: FleetColor;
      worldX?: number;
      worldY?: number;
      worldZ?: number;
      offsetX?: number;
      offsetZ?: number;
    } = {}
  ): { success: boolean; entity?: VehicleEntity; error?: string } {
    const truckDef = VEHICLE_DEFINITIONS[definitionId];
    if (!truckDef) {
      return { success: false, error: `Vehicle definition '${definitionId}' not found.` };
    }

    const trailerDef = options.trailerDefinitionId
      ? TRAILER_DEFINITIONS[options.trailerDefinitionId] ?? null
      : null;

    const containerDef = options.containerDefinitionId
      ? CONTAINER_DEFINITIONS[options.containerDefinitionId] ?? null
      : null;

    const vehicleId =
      options.id ||
      `veh_${definitionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const worldCenter = this.gridSystem.gridToWorldCenter(gridX, gridZ);
      const spawnX = options.worldX !== undefined ? options.worldX : worldCenter.x + (options.offsetX ?? 0);
      const spawnZ = options.worldZ !== undefined ? options.worldZ : worldCenter.z + (options.offsetZ ?? 0);

      const vehicle = new VehicleEntity(
        vehicleId,
        truckDef,
        gridX,
        gridZ,
        spawnX,
        spawnZ,
        this.materialsManager,
        {
          rotationDegrees: options.rotationDegrees ?? 0,
          trailerDefinition: trailerDef,
          containerDefinition: containerDef,
          paintColor: options.paintColor ?? truckDef.defaultColor,
          worldY: options.worldY,
        }
      );

      this.entityRegistry.register(vehicle);
      this.spatialQuery.registerEntity(vehicle);
      this.scene.add(vehicle.group);
      this.sectorManager.registerVehicle(vehicleId, spawnX, spawnZ);
      this.trafficManager.trackVehicle(vehicle);

      globalEventBus.emit('world:vehicle_spawned', {
        id: vehicleId,
        name: truckDef.name,
        gridX,
        gridZ,
      });

      return { success: true, entity: vehicle };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Vehicle placement failed: ${msg}` };
    }
  }

  /**
   * Atomic Land Parcel Purchase Transaction
   */
  public purchaseLandParcel(parcelId: string): { success: boolean; cost: number; error?: string } {
    const parcel = this.landParcelManager.getParcel(parcelId);
    if (!parcel) {
      return { success: false, cost: 0, error: `Land parcel '${parcelId}' not found.` };
    }

    if (parcel.ownership === 'player_owned') {
      return { success: false, cost: 0, error: 'You already own this land parcel.' };
    }

    if (parcel.ownership === 'municipal_public' || parcel.ownership === 'protected_reserve') {
      return { success: false, cost: 0, error: 'Municipal and public infrastructure easements cannot be privatized.' };
    }

    const cost = parcel.effectivePurchasePrice;
    if (!this.gameState.canAfford(cost)) {
      return {
        success: false,
        cost: 0,
        error: `Insufficient funds: $${cost.toLocaleString()} required, $${this.gameState.getCash().toLocaleString()} available.`,
      };
    }

    const previousOwnership = parcel.ownership;
    const previousBuildAllowed = parcel.isBuildAllowed;

    try {
      this.gameState.deductCash(cost, `Land Acquisition: ${parcel.name}`);
      parcel.ownership = 'player_owned';
      parcel.isBuildAllowed = true;

      globalEventBus.emit('world:parcel_purchased', {
        id: parcel.id,
        name: parcel.name,
        cost,
        bounds: parcel.bounds,
      });

      return { success: true, cost };
    } catch (err: unknown) {
      parcel.ownership = previousOwnership;
      parcel.isBuildAllowed = previousBuildAllowed;
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, cost: 0, error: `Land purchase transaction failed: ${msg}` };
    }
  }

  /**
   * Atomic Vehicle Purchase Transaction
   * Invariant: Requires available, compatible facility parking space.
   * Invariant: Never deducts money if depot is full or vehicle cannot be housed.
   */
  public purchaseVehicle(
    definitionId: string,
    options: {
      gridX?: number;
      gridZ?: number;
      trailerDefinitionId?: string;
      containerDefinitionId?: string;
      paintColor?: FleetColor;
      customCost?: number;
    } = {}
  ): { success: boolean; entity?: VehicleEntity; cost: number; error?: string } {
    const truckDef = VEHICLE_DEFINITIONS[definitionId];
    if (!truckDef) {
      return { success: false, cost: 0, error: `Vehicle definition '${definitionId}' not found.` };
    }

    const depot = this.facilityManager.getPrimaryTruckDepot();
    if (!depot) {
      return { success: false, cost: 0, error: 'No active truck depot facility available to receive vehicle.' };
    }

    if (depot.isFull()) {
      return {
        success: false,
        cost: 0,
        error: `Starting truck depot is at full capacity (${depot.getTotalCapacity()}/${depot.getTotalCapacity()} bays occupied). Upgrade facility or free a parking space.`,
      };
    }

    const truckClass = definitionId === 'courier_truck_4x2' ? 'rigid_courier' : 'prime_mover_6x4';
    if (!depot.canAccommodate(truckClass)) {
      return {
        success: false,
        cost: 0,
        error: `Facility '${depot.name}' cannot accommodate vehicle class '${truckClass}'.`,
      };
    }

    const vehicleCost = options.customCost ?? (definitionId === 'courier_truck_4x2' ? 28000 : 45000);
    if (!this.gameState.canAfford(vehicleCost)) {
      return {
        success: false,
        cost: 0,
        error: `Insufficient treasury funds: $${vehicleCost.toLocaleString()} required, $${this.gameState.getCash().toLocaleString()} available.`,
      };
    }

    const targetGridX = options.gridX ?? depot.gridX;
    const targetGridZ = options.gridZ ?? depot.gridZ;
    const vehicleId = `veh_${definitionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Deduct funds atomically
    this.gameState.deductCash(vehicleCost, `Vehicle Purchase: ${truckDef.name}`);

    // 2. Spawn vehicle entity
    const spawnRes = this.placeVehicle(definitionId, targetGridX, targetGridZ, {
      id: vehicleId,
      trailerDefinitionId: options.trailerDefinitionId,
      containerDefinitionId: options.containerDefinitionId,
      paintColor: options.paintColor ?? truckDef.defaultColor,
    });

    if (!spawnRes.success || !spawnRes.entity) {
      this.gameState.addCash(vehicleCost, 'Purchase Refund (Spawn Failure)');
      return { success: false, cost: 0, error: spawnRes.error || 'Failed to instantiate vehicle in world.' };
    }

    // 3. Assign to depot parking space
    const assigned = this.facilityManager.assignVehicleToPrimaryDepot(vehicleId, truckClass);
    if (!assigned) {
      this.removeVehicle(vehicleId);
      this.gameState.addCash(vehicleCost, 'Purchase Refund (Depot Allocation Failure)');
      return { success: false, cost: 0, error: 'Could not allocate parking space in depot.' };
    }

    // 4. Register in 5-day real-world maintenance schedule
    this.maintenanceManager.registerVehicle(vehicleId, 'road', 320);

    // 5. Award progression experience
    this.gameState.addExperience(75);

    // 6. Update counts and notify
    this.updateWorldCounts();
    globalEventBus.emit('world:vehicle_purchased', {
      vehicleId,
      name: truckDef.name,
      cost: vehicleCost,
    });

    return {
      success: true,
      entity: spawnRes.entity,
      cost: vehicleCost,
    };
  }

  /**
   * Safe Vehicle Removal & Reference Cleanup
   * Cleans scene mesh, registry, facility parking assignment, maintenance records, and selection.
   */
  public removeVehicle(vehicleId: string): boolean {
    const entity = this.entityRegistry.get(vehicleId);
    if (!entity || !(entity instanceof VehicleEntity)) {
      return false;
    }

    // 1. Clear selection if this vehicle was active
    if (this.gameState.getSelectedEntityId() === vehicleId) {
      this.gameState.selectEntity(null);
    }

    // 2. Free any facility parking space occupied by this vehicle
    this.facilityManager.releaseVehicleFromAllFacilities(vehicleId);

    // 3. Unregister from 5-day maintenance schedule
    this.maintenanceManager.unregisterVehicle(vehicleId);

    // 4. Remove mesh from scene and dispose geometry/materials
    this.scene.remove(entity.group);
    entity.dispose();

    // 5. Remove from entity registry, spatial index, and spatial partition
    this.trafficManager.untrackVehicle(vehicleId);
    this.entityRegistry.unregister(vehicleId);
    this.spatialQuery.unregisterEntity(vehicleId);
    this.sectorManager.unregisterVehicle(vehicleId);

    // 6. Update world counts
    this.updateWorldCounts();

    // 7. Emit cleanup notification
    globalEventBus.emit('world:vehicle_removed', {
      id: vehicleId,
      name: entity.truckDefinition.name,
    });

    return true;
  }

  /**
   * Salvages an owned vehicle for 50% cash refund
   */
  public salvageVehicle(vehicleId: string): { success: boolean; refund: number; error?: string } {
    const entity = this.entityRegistry.get(vehicleId);
    if (!entity || !(entity instanceof VehicleEntity)) {
      return { success: false, refund: 0, error: `Vehicle '${vehicleId}' not found.` };
    }

    const estimatedBasePrice = entity.truckDefinition.category === 'heavy_freight' ? 45000 : 28000;
    const refund = Math.floor(estimatedBasePrice * 0.5);

    const removed = this.removeVehicle(vehicleId);
    if (!removed) {
      return { success: false, refund: 0, error: 'Failed to decommission vehicle.' };
    }

    this.gameState.addCash(refund, `Vehicle Salvage: ${entity.truckDefinition.name}`);
    return { success: true, refund };
  }

  /**
   * Dispatches a vehicle from depot on an active assignment
   */
  public dispatchVehicle(
    vehicleId: string,
    destinationName: string = 'Regional Gateway',
    options?: {
      targetGridX?: number;
      targetGridZ?: number;
      destinationEntityId?: string;
      criterion?: 'shortest' | 'fastest';
      avoidCongestion?: boolean;
    }
  ): { success: boolean; error?: string } {
    const entity = this.entityRegistry.get(vehicleId);
    if (!entity || !(entity instanceof VehicleEntity)) {
      return { success: false, error: `Vehicle '${vehicleId}' not found.` };
    }

    const maint = this.maintenanceManager.evaluateStatus(vehicleId);
    if (maint.exists && maint.isOverdue) {
      return {
        success: false,
        error: `Vehicle '${entity.truckDefinition.name}' is overdue for 5-day required maintenance. Service required before dispatch.`,
      };
    }

    // Delegate autonomous traffic trajectory navigation
    return this.trafficManager.dispatchVehicle({
      vehicleId,
      destinationName,
      targetGridX: options?.targetGridX,
      targetGridZ: options?.targetGridZ,
      destinationEntityId: options?.destinationEntityId,
      criterion: options?.criterion,
      avoidCongestion: options?.avoidCongestion,
    });
  }

  /**
   * Returns a dispatched vehicle to a facility parking space
   */
  public returnVehicle(
    vehicleId: string,
    _targetFacilityId?: string
  ): { success: boolean; error?: string } {
    const entity = this.entityRegistry.get(vehicleId);
    if (!entity || !(entity instanceof VehicleEntity)) {
      return { success: false, error: `Vehicle '${vehicleId}' not found.` };
    }

    return this.trafficManager.returnVehicleToDepot(vehicleId);
  }

  /**
   * Retrieves active delivery progress, operational status, and route waypoints
   */
  public getVehicleRouteProgress(vehicleId: string): VehicleRouteProgressInfo | null {
    return this.trafficManager.getVehicleRouteProgress(vehicleId);
  }

  /**
   * Recalculates carrier route to detour around congestion or blockages
   */
  public rerouteVehicle(vehicleId: string): { success: boolean; message: string } {
    return this.trafficManager.rerouteVehicle(vehicleId);
  }

  /**
   * Completes a transport contract or task, granting verified one-time reward
   */
  public completeContract(
    contractId: string,
    rewardCash: number,
    rewardXp: number
  ): { success: boolean; error?: string } {
    return this.gameState.claimTaskReward(contractId, rewardCash, rewardXp);
  }

  private updateWorldCounts(): void {
    const buildings = this.entityRegistry.getAll().filter((e) => e.entityType === 'building');
    const vehicles = this.entityRegistry.getAll().filter((e) => e.entityType === 'vehicle');
    this.gameState.updateCounts(buildings.length, this.roadNetwork.getSegmentCount(), vehicles.length);
  }

  public update(deltaTime: number, cameraFocus?: { x: number; z: number }): void {
    this.trafficManager.update(deltaTime);
    this.entityRegistry.update(deltaTime);
    this.terrainGenerator.update(deltaTime);
    if (cameraFocus) {
      this.sectorManager.updateStreaming(cameraFocus.x, cameraFocus.z);
    }
  }

  // --- Large-World Streaming & Partitioning Utilities ---

  public updateStreaming(cameraFocusX: number, cameraFocusZ: number, activeRadius?: number, hysteresis?: number) {
    return this.sectorManager.updateStreaming(cameraFocusX, cameraFocusZ, activeRadius, hysteresis);
  }

  public getStreamingDiagnostics() {
    return this.sectorManager.getStreamingDiagnostics();
  }

  public isSectorActive(sectorX: number, sectorZ: number): boolean {
    return this.sectorManager.isSectorActive(sectorX, sectorZ);
  }

  public isWorldPointActive(worldX: number, worldZ: number): boolean {
    return this.sectorManager.isWorldPointActive(worldX, worldZ);
  }

  // --- High-Performance Spatial Query Utilities ---

  public queryNearbyBuildings(worldX: number, worldZ: number, radiusMeters: number = 32.0): BuildingEntity[] {
    const ids = this.sectorManager.queryNearbyBuildings(worldX, worldZ, radiusMeters);
    return ids
      .map((id) => this.entityRegistry.get(id))
      .filter((e): e is BuildingEntity => e instanceof BuildingEntity);
  }

  public queryNearbyVehicles(worldX: number, worldZ: number, radiusMeters: number = 32.0): VehicleEntity[] {
    const ids = this.sectorManager.queryNearbyVehicles(worldX, worldZ, radiusMeters);
    return ids
      .map((id) => this.entityRegistry.get(id))
      .filter((e): e is VehicleEntity => e instanceof VehicleEntity);
  }

  public queryNearbyRoadCells(worldX: number, worldZ: number, radiusMeters: number = 32.0): { gridX: number; gridZ: number }[] {
    return this.sectorManager.queryNearbyRoadCells(worldX, worldZ, radiusMeters);
  }

  public querySpatialBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    return this.sectorManager.queryInBoundingBox(bounds);
  }

  public get terrainModel() {
    return this.gridSystem.terrainModel;
  }

  public get waterSystem() {
    return this.gridSystem.terrainModel.waterSystem;
  }

  public getSurfaceElevation(worldX: number, worldZ: number): number {
    return this.gridSystem.getTerrainHeight(worldX, worldZ);
  }

  public getTerrainClassification(gridX: number, gridZ: number) {
    return this.gridSystem.terrainModel.getClassification(gridX, gridZ);
  }

  public isWaterArea(gridX: number, gridZ: number): boolean {
    return this.gridSystem.terrainModel.isWaterCell(gridX, gridZ);
  }

  public getRoadsideDetailingManager(): RoadsideDetailingManager {
    return this.roadsideDetailing;
  }

  public getTrafficSimulationManager(): TrafficSimulationManager {
    return this.trafficManager;
  }

  public dispose(): void {
    this.trafficManager.dispose();
    this.scaleInspector.dispose();
    this.roadsideDetailing.dispose();
    this.environmentalProps.dispose();
    this.terrainGenerator.dispose();
    this.roadNetwork.dispose();
    this.entityRegistry.dispose();
    this.materialsManager.dispose();
  }
}
