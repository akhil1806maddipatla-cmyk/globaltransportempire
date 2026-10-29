/**
 * Engineering Diagnostics, Automated Validation, and Regression Protection Engine
 * Global Transport Empire - Phase 1, Prompt 13 of 80
 * 
 * Provides centralized diagnostic reporting, deterministic initialization verification,
 * Level 1 depot preservation, vehicle dimensional fit validation, transport network integrity,
 * facility capacity constraints, and 5-real-world-day maintenance protection.
 */

import { Logger } from './Logger';
import { FacilityManager } from '../facilities/FacilityManager';
import { TruckDepotFacility, IFacilityOperations } from '../facilities/FacilityModel';
import { VehicleDefinition, TrailerDefinition } from '../data/vehicleDefinitions';
import { RoadNetworkModel } from '../world/RoadNetworkModel';
import { TransportNetwork } from '../network/TransportNetwork';
import { GameState } from '../game/GameState';
import { VehicleMaintenanceManager, REAL_WORLD_MAINTENANCE_INTERVAL_MS } from '../game/VehicleMaintenanceManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { ASSET_STANDARDS } from '../rendering/AssetStandards';
import { TerrainModel } from '../world/TerrainModel';
import { WaterSystemModel } from '../world/water/WaterSystemModel';
import { LandParcelManager } from '../world/LandParcelManager';
import { WorldSectorManager } from '../world/WorldSectorManager';
import { SpatialQuerySystem } from '../world/SpatialQuerySystem';
import { PathfindingEngine } from '../navigation/PathfindingEngine';

const logger = new Logger('EngineeringDiagnostics');

export interface DiagnosticIssue {
  readonly severity: 'error' | 'warning' | 'info';
  readonly system: string;
  readonly objectId?: string;
  readonly message: string;
  readonly suggestedRemediation?: string;
  readonly actualValue?: unknown;
  readonly expectedValue?: unknown;
}

export interface EngineeringAuditReport {
  readonly isHealthy: boolean;
  readonly totalChecks: number;
  readonly errors: DiagnosticIssue[];
  readonly warnings: DiagnosticIssue[];
  readonly info: DiagnosticIssue[];
  readonly timestamp: number;
}

export interface AuditContext {
  facilityManager?: FacilityManager;
  roadNetworkModel?: RoadNetworkModel;
  transportNetwork?: TransportNetwork;
  gameState?: GameState;
  maintenanceManager?: VehicleMaintenanceManager;
  entityRegistry?: EntityRegistry;
  terrainModel?: TerrainModel;
  waterModel?: WaterSystemModel;
  parcelManager?: LandParcelManager;
  sectorManager?: WorldSectorManager;
  spatialQuery?: SpatialQuerySystem;
  pathfinder?: PathfindingEngine;
}

export class EngineeringDiagnostics {
  /**
   * Validates the permanent Level 1 Truck Depot requirement:
   * - Exactly one pre-built, owned, available Level 1 truck depot.
   * - Exactly 3 designated heavy truck parking spaces.
   * - Accessible entrance, correct bay dimensions, and unique space indexing.
   * - Intercepts duplicate depot generation attempts.
   */
  public static validateLevel1TruckDepot(
    facilityManager: FacilityManager
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];

    const depot = facilityManager.getPrimaryTruckDepot();
    if (!depot) {
      issues.push({
        severity: 'error',
        system: 'Level1Depot',
        message: 'Primary Level 1 Truck Depot does not exist in FacilityManager.',
        suggestedRemediation: 'Ensure facilityManager.ensureDefaultStartingDepot() runs during world setup.',
      });
      return { isValid: false, issues };
    }

    // 1. Identity & Level Check
    if (depot.level !== 1) {
      issues.push({
        severity: 'error',
        system: 'Level1Depot',
        objectId: depot.id,
        message: `Depot level is ${depot.level}; must be Level 1 at initial game state.`,
        actualValue: depot.level,
        expectedValue: 1,
      });
    }

    // 2. Ownership & Availability
    if (!depot.isPlayerOwned) {
      issues.push({
        severity: 'error',
        system: 'Level1Depot',
        objectId: depot.id,
        message: 'Level 1 Starting Truck Depot must be owned and available to player without purchase.',
        actualValue: depot.isPlayerOwned,
        expectedValue: true,
      });
    }

    // 3. Exactly 3 Designated Spaces Invariant
    const totalCapacity = depot.getTotalCapacity();
    if (totalCapacity !== 3) {
      issues.push({
        severity: 'error',
        system: 'Level1Depot',
        objectId: depot.id,
        message: `Depot capacity is ${totalCapacity}; starting depot must have exactly 3 designated truck spaces.`,
        actualValue: totalCapacity,
        expectedValue: 3,
        suggestedRemediation: 'Ensure Level 1 UPGRADE_TIERS[1].capacity is 3 and space allocation matches.',
      });
    }

    // 4. Space Structure and Unique Indexing
    const spaces = depot.getSpaces();
    if (spaces.length !== 3) {
      issues.push({
        severity: 'error',
        system: 'Level1Depot',
        objectId: depot.id,
        message: `Depot spaces array length is ${spaces.length}; expected exactly 3.`,
        actualValue: spaces.length,
        expectedValue: 3,
      });
    }

    const seenIndices = new Set<number>();
    for (const space of spaces) {
      if (seenIndices.has(space.spaceIndex)) {
        issues.push({
          severity: 'error',
          system: 'Level1Depot',
          objectId: depot.id,
          message: `Duplicate parking space index detected: ${space.spaceIndex}.`,
        });
      }
      seenIndices.add(space.spaceIndex);

      if (space.nominalDimensions.width < 3.0) {
        issues.push({
          severity: 'warning',
          system: 'Level1Depot',
          objectId: depot.id,
          message: `Parking bay width (${space.nominalDimensions.width}m) is less than 3.0m standard.`,
        });
      }
    }

    // 5. Duplicate Depot Check (Singleton Guarantee)
    const allDepots = facilityManager.getAllTruckDepots();
    if (allDepots.length > 1) {
      issues.push({
        severity: 'warning',
        system: 'Level1Depot',
        message: `Found ${allDepots.length} truck depots in world; initial game state should have only 1 starting depot.`,
        actualValue: allDepots.length,
        expectedValue: 1,
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates vehicle dimensions against single-lane standards, fifth-wheel coupling,
   * and Level 1 Depot bay clearance.
   */
  public static validateVehicleSpatialFit(
    truckDef: VehicleDefinition,
    trailerDef?: TrailerDefinition | null
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];

    // 1. Single Lane Envelope Check (Width <= 3.0m with mirrors)
    const maxWidth = ASSET_STANDARDS.envelopes.roadVehicles.maxTotalWidthWithMirrors;
    if (truckDef.dimensions.width > maxWidth) {
      issues.push({
        severity: 'error',
        system: 'VehicleScale',
        objectId: truckDef.id,
        message: `Truck width (${truckDef.dimensions.width}m) exceeds single-lane envelope (${maxWidth}m).`,
        actualValue: truckDef.dimensions.width,
        expectedValue: maxWidth,
      });
    }

    // 2. Height vs Bridge / Overhead Clearance (Height <= 4.2m)
    const maxHeight = ASSET_STANDARDS.envelopes.roadVehicles.maxSingleRigidHeight;
    if (truckDef.dimensions.height > maxHeight) {
      issues.push({
        severity: 'error',
        system: 'VehicleScale',
        objectId: truckDef.id,
        message: `Truck height (${truckDef.dimensions.height}m) exceeds bridge clearance envelope (${maxHeight}m).`,
        actualValue: truckDef.dimensions.height,
        expectedValue: maxHeight,
      });
    }

    // 3. Fifth Wheel Height Standard (Y = 1.15m ± 0.08m)
    if (truckDef.hasFifthWheel) {
      const fwY = truckDef.fifthWheelOffset.y;
      const expectedY = ASSET_STANDARDS.pivots.fifthWheelHeightY;
      if (Math.abs(fwY - expectedY) > 0.08) {
        issues.push({
          severity: 'error',
          system: 'VehicleScale',
          objectId: truckDef.id,
          message: `Fifth-wheel height (${fwY}m) deviates from standard ${expectedY}m.`,
          actualValue: fwY,
          expectedValue: expectedY,
        });
      }
    }

    // 4. Trailer Kingpin Match
    if (trailerDef) {
      const kpY = trailerDef.kingpinOffset.y;
      const expectedKpY = ASSET_STANDARDS.pivots.trailerKingpinHeightY;
      if (Math.abs(kpY - expectedKpY) > 0.08) {
        issues.push({
          severity: 'error',
          system: 'VehicleScale',
          objectId: trailerDef.id,
          message: `Trailer kingpin height (${kpY}m) deviates from standard ${expectedKpY}m.`,
          actualValue: kpY,
          expectedValue: expectedKpY,
        });
      }

      if (trailerDef.dimensions.width > maxWidth) {
        issues.push({
          severity: 'error',
          system: 'VehicleScale',
          objectId: trailerDef.id,
          message: `Trailer width (${trailerDef.dimensions.width}m) exceeds single-lane envelope (${maxWidth}m).`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates road network connectivity, detecting disconnected islands or broken topology.
   */
  public static validateRoadTopology(
    roadNetworkModel: RoadNetworkModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    const report = roadNetworkModel.validateNetwork();

    if (!report.isValid) {
      issues.push({
        severity: 'error',
        system: 'RoadNetwork',
        message: `Road network has ${report.connectedComponents} disconnected clusters.`,
        actualValue: report.connectedComponents,
        expectedValue: 1,
        suggestedRemediation: 'Ensure all newly placed road segments link orthogonally to existing road cells.',
      });
    }

    return {
      isValid: report.isValid,
      issues,
    };
  }

  /**
   * Validates multi-modal network separation:
   * Roads, Rail, Waterways, and Air corridors must never illegally cross-connect.
   */
  public static validateTransportModeIsolation(
    transportNetwork: TransportNetwork
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    const edges = transportNetwork.getAllEdges();

    for (const edge of edges) {
      const fromNode = transportNetwork.getNode(edge.fromNodeId);
      const toNode = transportNetwork.getNode(edge.toNodeId);

      if (!fromNode || !toNode) {
        issues.push({
          severity: 'error',
          system: 'TransportNetwork',
          objectId: edge.id,
          message: `Edge references non-existent node (${edge.fromNodeId} -> ${edge.toNodeId}).`,
        });
        continue;
      }

      if (fromNode.mode !== toNode.mode || edge.mode !== fromNode.mode) {
        issues.push({
          severity: 'error',
          system: 'TransportNetwork',
          objectId: edge.id,
          message: `Illegal cross-modal connection: Edge (${edge.mode}) links ${fromNode.mode} to ${toNode.mode}.`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validates capacity constraints and prevents over-allocation or duplicate bookings.
   */
  public static validateFacilityCapacityRules(
    facility: IFacilityOperations
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];

    const totalCap = facility.getTotalCapacity();
    const occupiedCap = facility.getOccupiedCapacity();
    const availableCap = facility.getAvailableCapacity();

    if (occupiedCap > totalCap) {
      issues.push({
        severity: 'error',
        system: 'FacilityCapacity',
        objectId: facility.id,
        message: `Occupancy (${occupiedCap}) exceeds facility capacity (${totalCap}).`,
        actualValue: occupiedCap,
        expectedValue: totalCap,
      });
    }

    if (occupiedCap + availableCap !== totalCap) {
      issues.push({
        severity: 'error',
        system: 'FacilityCapacity',
        objectId: facility.id,
        message: `Capacity arithmetic mismatch: occupied (${occupiedCap}) + available (${availableCap}) != total (${totalCap}).`,
      });
    }

    if (facility instanceof TruckDepotFacility) {
      const spaces = facility.getSpaces();
      const assignedVehicles = new Set<string>();

      for (const space of spaces) {
        if (space.occupiedByVehicleId) {
          if (assignedVehicles.has(space.occupiedByVehicleId)) {
            issues.push({
              severity: 'error',
              system: 'FacilityCapacity',
              objectId: facility.id,
              message: `Vehicle '${space.occupiedByVehicleId}' is assigned to multiple parking spaces simultaneously.`,
            });
          }
          assignedVehicles.add(space.occupiedByVehicleId);
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates economy treasury and the 5-real-world-day vehicle maintenance requirement.
   */
  public static validateEconomyAndMaintenance(
    gameState?: GameState,
    maintenanceManager?: VehicleMaintenanceManager
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];

    // 1. Treasury check
    if (gameState) {
      const cash = gameState.getCash();
      if (isNaN(cash) || !isFinite(cash)) {
        issues.push({
          severity: 'error',
          system: 'Economy',
          message: `Treasury cash balance is invalid (${cash}).`,
        });
      } else if (cash < 0) {
        issues.push({
          severity: 'warning',
          system: 'Economy',
          message: `Company treasury is overdrawn (Balance: $${cash}).`,
        });
      }
    }

    // 2. 5-Day Real-World Maintenance Invariant Check
    if (maintenanceManager) {
      const records = maintenanceManager.getAllRecords();
      for (const rec of records) {
        const calculatedInterval = rec.nextDueTimestamp - rec.lastServiceTimestamp;
        if (calculatedInterval !== REAL_WORLD_MAINTENANCE_INTERVAL_MS) {
          issues.push({
            severity: 'error',
            system: 'MaintenanceSchedule',
            objectId: rec.vehicleId,
            message: `Maintenance interval for vehicle '${rec.vehicleId}' (${calculatedInterval}ms) violates 5-real-world-day standard (${REAL_WORLD_MAINTENANCE_INTERVAL_MS}ms).`,
            actualValue: calculatedInterval,
            expectedValue: REAL_WORLD_MAINTENANCE_INTERVAL_MS,
          });
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates terrain and water intersections:
   * Roads and buildings must never illegally intersect natural water bodies without an authorized bridge or quay structure.
   */
  public static validateTerrainWaterIntersections(
    roadNetworkModel?: RoadNetworkModel,
    entityRegistry?: EntityRegistry,
    terrainModel?: TerrainModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!terrainModel) return { isValid: true, issues };

    // 1. Road Network Water Intersections
    if (roadNetworkModel) {
      const roadCells = roadNetworkModel.getAllRoadCells();
      for (const road of roadCells) {
        if (terrainModel.isWaterCell(road.gridX, road.gridZ)) {
          // Check if authorized bridge crossing (e.g. at gridX=0, gridZ=0..3)
          const isBridge = terrainModel.waterSystem.bridgeCrossings.some(
            (b) =>
              (b.startCoord.gridX === road.gridX && b.startCoord.gridZ === road.gridZ) ||
              (b.endCoord.gridX === road.gridX && b.endCoord.gridZ === road.gridZ)
          );
          if (!isBridge) {
            issues.push({
              severity: 'error',
              system: 'TerrainWaterIntersection',
              objectId: `road_${road.gridX}_${road.gridZ}`,
              message: `Road cell (${road.gridX}, ${road.gridZ}) intersects natural water body without an authorized bridge.`,
            });
          }
        }
      }
    }

    // 2. Building Water Intersections
    if (entityRegistry) {
      const buildings = entityRegistry.getAll().filter((e) => e.entityType === 'building');
      for (const b of buildings) {
        const fpWidth = (b as any).width ?? (b as any).definition?.footprintWidth ?? 1;
        const fpDepth = (b as any).depth ?? (b as any).definition?.footprintDepth ?? 1;
        for (let x = b.gridX; x < b.gridX + fpWidth; x++) {
          for (let z = b.gridZ; z < b.gridZ + fpDepth; z++) {
            if (terrainModel.isWaterCell(x, z)) {
              issues.push({
                severity: 'error',
                system: 'TerrainWaterIntersection',
                objectId: b.id,
                message: `Building '${b.name}' footprint overlaps water at cell (${x}, ${z}).`,
              });
            }
          }
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates bridge crossings against statutory clearance standards, pier footings, and approach connections.
   */
  public static validateBridgeAlignment(
    waterModel?: WaterSystemModel,
    roadNetworkModel?: RoadNetworkModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!waterModel) return { isValid: true, issues };

    for (const bridge of waterModel.bridgeCrossings) {
      // 1. Vertical clearance check (>= 0.65m standard)
      const clearance = bridge.deckUndersideElevation - bridge.waterSurfaceElevation;
      if (clearance < WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS) {
        issues.push({
          severity: 'error',
          system: 'BridgeAlignment',
          objectId: bridge.id,
          message: `Bridge '${bridge.name}' vertical clearance (${clearance.toFixed(2)}m) is below statutory minimum (${WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS}m).`,
          actualValue: clearance,
          expectedValue: WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS,
        });
      }

      // 2. Pier footing grounding check
      for (const pier of bridge.piers) {
        if (pier.footingElevation > bridge.waterSurfaceElevation) {
          issues.push({
            severity: 'error',
            system: 'BridgeAlignment',
            objectId: bridge.id,
            message: `Bridge pier footing at (${pier.worldX}, ${pier.worldZ}) is elevated above water surface datum.`,
          });
        }
      }

      // 3. Approach alignment check
      if (roadNetworkModel) {
        // Start coordinate check
        const startRoad = roadNetworkModel.hasRoad(bridge.startCoord.gridX, bridge.startCoord.gridZ);
        if (!startRoad) {
          issues.push({
            severity: 'info',
            system: 'BridgeAlignment',
            objectId: bridge.id,
            message: `Bridge start coordinate (${bridge.startCoord.gridX}, ${bridge.startCoord.gridZ}) is awaiting road network tie-in.`,
          });
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates building foundations and ground contact (no floating or buried structures).
   */
  public static validateBuildingTerrainContact(
    entityRegistry?: EntityRegistry,
    terrainModel?: TerrainModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!entityRegistry || !terrainModel) return { isValid: true, issues };

    const buildings = entityRegistry.getAll().filter((e) => e.entityType === 'building');
    for (const b of buildings) {
      const elev = terrainModel.getElevationAt(b.group.position.x, b.group.position.z, false);
      if (elev < 0.0 && !terrainModel.isGradedPadCell(b.gridX, b.gridZ)) {
        issues.push({
          severity: 'error',
          system: 'BuildingTerrainContact',
          objectId: b.id,
          message: `Building '${b.name}' at (${b.gridX}, ${b.gridZ}) sits on negative terrain elevation (${elev}m).`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates starter truck depot entrance alignment and direct road access.
   */
  public static validateDepotEntranceAndAccess(
    facilityManager?: FacilityManager,
    roadNetworkModel?: RoadNetworkModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!facilityManager) return { isValid: true, issues };

    const depot = facilityManager.getPrimaryTruckDepot();
    if (!depot) {
      issues.push({
        severity: 'error',
        system: 'DepotAccess',
        message: 'Primary truck depot missing for access validation.',
      });
      return { isValid: false, issues };
    }

    const entrance = depot.getEntranceCoordinate();
    if (roadNetworkModel) {
      // Check neighbors of entrance coordinate for active road
      const neighbors = [
        { x: entrance.gridX - 1, z: entrance.gridZ },
        { x: entrance.gridX + 1, z: entrance.gridZ },
        { x: entrance.gridX, z: entrance.gridZ - 1 },
        { x: entrance.gridX, z: entrance.gridZ + 1 },
      ];
      const hasAdjacentRoad = neighbors.some((n) => roadNetworkModel.hasRoad(n.x, n.z));
      if (!hasAdjacentRoad) {
        issues.push({
          severity: 'error',
          system: 'DepotAccess',
          objectId: depot.id,
          message: `Depot entrance at (${entrance.gridX}, ${entrance.gridZ}) does not connect to an active road cell.`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates maritime port berths and navigational waterway access.
   */
  public static validatePortBerthsAndNavigability(
    waterModel?: WaterSystemModel,
    transportNetwork?: TransportNetwork
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!waterModel) return { isValid: true, issues };

    for (const berth of waterModel.portBerths) {
      // Depth check
      if (berth.berthDepthMeters < WaterSystemModel.DEEPWATER_PORT_MIN_DEPTH_METERS) {
        issues.push({
          severity: 'error',
          system: 'PortNavigability',
          objectId: berth.id,
          message: `Berth '${berth.name}' depth (${berth.berthDepthMeters}m) is below deepwater minimum (${WaterSystemModel.DEEPWATER_PORT_MIN_DEPTH_METERS}m).`,
        });
      }

      // Wharf frontage check
      if (berth.wharfFrontageLengthMeters < 16.0) {
        issues.push({
          severity: 'warning',
          system: 'PortNavigability',
          objectId: berth.id,
          message: `Berth '${berth.name}' wharf frontage (${berth.wharfFrontageLengthMeters}m) is below 16m cargo ship standard.`,
        });
      }

      // Mooring bollards check
      if (berth.bollardPositions.length < 3) {
        issues.push({
          severity: 'error',
          system: 'PortNavigability',
          objectId: berth.id,
          message: `Berth '${berth.name}' has fewer than 3 mooring bollards.`,
        });
      }

      // Navigable fairway connection check
      const midZ = (berth.quayWallBounds.minZ + berth.quayWallBounds.maxZ) / 2;
      const seawardX = berth.quayWallBounds.maxX + 3.0;
      const navCheck = waterModel.isNavigableAt(seawardX, midZ, 2.5);
      if (!navCheck.canNavigate) {
        issues.push({
          severity: 'error',
          system: 'PortNavigability',
          objectId: berth.id,
          message: `Berth '${berth.name}' fairway approach is non-navigable: ${navCheck.reason}`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates land parcel buildability and environmental protection constraints.
   */
  public static validateLandParcelSuitability(
    parcelManager?: LandParcelManager,
    terrainModel?: TerrainModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!parcelManager) return { isValid: true, issues };

    for (const parcel of parcelManager.getAllParcels()) {
      const validation = parcelManager.validateParcelBuildability(parcel.id, terrainModel);
      if (parcel.ownership === 'protected_reserve' && parcel.isBuildAllowed) {
        issues.push({
          severity: 'error',
          system: 'LandParcelSuitability',
          objectId: parcel.id,
          message: `Protected ecological reserve '${parcel.name}' incorrectly has building enabled.`,
        });
      }
      if (parcel.terrainSuitability === 'protected_wetland' && validation.isValid) {
        issues.push({
          severity: 'error',
          system: 'LandParcelSuitability',
          objectId: parcel.id,
          message: `Protected wetland parcel '${parcel.name}' cannot be approved for general construction.`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Validates spatial sector boundaries and cross-chunk infrastructure continuity.
   */
  public static validateSectorBoundaryContinuity(
    sectorManager?: WorldSectorManager,
    roadNetworkModel?: RoadNetworkModel
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];
    if (!sectorManager || !roadNetworkModel) return { isValid: true, issues };

    const roadCells = roadNetworkModel.getAllRoadCells();
    const continuity = sectorManager.verifyRoadNetworkContinuity(roadCells);
    if (!continuity.isContinuous) {
      issues.push({
        severity: 'error',
        system: 'SectorContinuity',
        message: 'Road network continuity broken across sector chunk boundaries.',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Runs an aggregate system audit across all active game subsystems.
   */
  public static runFullSystemAudit(context: AuditContext): EngineeringAuditReport {
    const allIssues: DiagnosticIssue[] = [];
    let totalChecks = 0;

    // 1. Level 1 Depot Audit
    if (context.facilityManager) {
      totalChecks++;
      const res = this.validateLevel1TruckDepot(context.facilityManager);
      allIssues.push(...res.issues);

      // Facility capacities audit
      for (const fac of context.facilityManager.getAllFacilities()) {
        totalChecks++;
        const capRes = this.validateFacilityCapacityRules(fac);
        allIssues.push(...capRes.issues);
      }
    }

    // 2. Road Topology Audit
    if (context.roadNetworkModel) {
      totalChecks++;
      const res = this.validateRoadTopology(context.roadNetworkModel);
      allIssues.push(...res.issues);
    }

    // 3. Transport Mode Isolation Audit
    if (context.transportNetwork) {
      totalChecks++;
      const res = this.validateTransportModeIsolation(context.transportNetwork);
      allIssues.push(...res.issues);
    }

    // 4. Economy and 5-Day Maintenance Audit
    if (context.gameState || context.maintenanceManager) {
      totalChecks++;
      const res = this.validateEconomyAndMaintenance(context.gameState, context.maintenanceManager);
      allIssues.push(...res.issues);
    }

    // 5. Entity Registry Identity Audit
    if (context.entityRegistry) {
      totalChecks++;
      const entities = context.entityRegistry.getAll();
      const seenIds = new Set<string>();
      for (const ent of entities) {
        if (!ent.id) {
          allIssues.push({
            severity: 'error',
            system: 'EntityRegistry',
            message: 'Entity with missing or empty ID found in EntityRegistry.',
          });
        } else if (seenIds.has(ent.id)) {
          allIssues.push({
            severity: 'error',
            system: 'EntityRegistry',
            objectId: ent.id,
            message: `Duplicate entity ID registered in EntityRegistry: '${ent.id}'.`,
          });
        }
        seenIds.add(ent.id);
      }
    }

    // 6. Terrain and Water Intersections Audit
    if (context.terrainModel) {
      totalChecks++;
      const twRes = this.validateTerrainWaterIntersections(
        context.roadNetworkModel,
        context.entityRegistry,
        context.terrainModel
      );
      allIssues.push(...twRes.issues);
    }

    // 7. Bridge Alignment & Clearance Audit
    if (context.waterModel) {
      totalChecks++;
      const bridgeRes = this.validateBridgeAlignment(context.waterModel, context.roadNetworkModel);
      allIssues.push(...bridgeRes.issues);
    }

    // 8. Building Terrain Contact Audit
    if (context.entityRegistry && context.terrainModel) {
      totalChecks++;
      const contactRes = this.validateBuildingTerrainContact(context.entityRegistry, context.terrainModel);
      allIssues.push(...contactRes.issues);
    }

    // 9. Depot Entrance & Road Access Audit
    if (context.facilityManager) {
      totalChecks++;
      const depotAccessRes = this.validateDepotEntranceAndAccess(
        context.facilityManager,
        context.roadNetworkModel
      );
      allIssues.push(...depotAccessRes.issues);
    }

    // 10. Port Berths & Navigability Audit
    if (context.waterModel) {
      totalChecks++;
      const portRes = this.validatePortBerthsAndNavigability(context.waterModel, context.transportNetwork);
      allIssues.push(...portRes.issues);
    }

    // 11. Land Parcel Suitability Audit
    if (context.parcelManager) {
      totalChecks++;
      const parcelRes = this.validateLandParcelSuitability(context.parcelManager, context.terrainModel);
      allIssues.push(...parcelRes.issues);
    }

    // 12. Sector Boundary Infrastructure Continuity Audit
    if (context.sectorManager && context.roadNetworkModel) {
      totalChecks++;
      const sectorRes = this.validateSectorBoundaryContinuity(
        context.sectorManager,
        context.roadNetworkModel
      );
      allIssues.push(...sectorRes.issues);
    }

    // 13. Spatial Query & Multi-Modal Routing Audit
    if (context.pathfinder || context.spatialQuery) {
      totalChecks++;
      const spatialRes = this.validateSpatialAndRoutingHealth(context.pathfinder, context.spatialQuery);
      allIssues.push(...spatialRes.issues);
    }

    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');
    const info = allIssues.filter((i) => i.severity === 'info');

    const isHealthy = errors.length === 0;

    if (!isHealthy) {
      logger.warnThrottled(
        'audit_unhealthy',
        5000,
        `System audit detected ${errors.length} errors and ${warnings.length} warnings.`,
        errors
      );
    }

    return {
      isHealthy,
      totalChecks,
      errors,
      warnings,
      info,
      timestamp: Date.now(),
    };
  }

  /**
   * Validates spatial query performance, bucket index integrity, and multi-modal routing connectivity.
   */
  public static validateSpatialAndRoutingHealth(
    pathfinder?: PathfindingEngine,
    spatialQuery?: SpatialQuerySystem
  ): { isValid: boolean; issues: DiagnosticIssue[] } {
    const issues: DiagnosticIssue[] = [];

    // 1. Spatial Hash Index Audit
    if (spatialQuery) {
      const benchmark = spatialQuery.runBenchmark(100);
      if (benchmark.totalDurationMs > 100) {
        issues.push({
          severity: 'warning',
          system: 'SpatialQuerySystem',
          message: `Spatial query benchmark latency elevated: ${benchmark.totalDurationMs.toFixed(2)}ms for 100 radius queries.`,
        });
      }
    }

    // 2. Multi-Modal Routing Audit
    if (pathfinder) {
      // Test 1: Starter Depot Road Route (12, 12) -> Industrial North (11, 3)
      const roadRoute = pathfinder.planRoute(12, 12, 11, 3, 'road');
      if (!roadRoute.success) {
        issues.push({
          severity: 'error',
          system: 'PathfindingEngine',
          message: `Starter depot failed to route road vehicles to Northern Industrial Terminal: ${roadRoute.message}`,
        });
      }

      // Test 2: Unreachable Island Isolation Validation (12, 12) -> Scenic River Island (1, 1)
      const islandRoute = pathfinder.planRoute(12, 12, 1, 1, 'road');
      if (islandRoute.success) {
        issues.push({
          severity: 'error',
          system: 'PathfindingEngine',
          message: 'Road vehicle illegally routed to isolated island without bridge crossing.',
        });
      }

      // Test 3: Deepwater Fairway Ship Route
      const shipRoute = pathfinder.planRoute(44.5, 14.5, 45.5, 28.0, 'waterway', { draftMeters: 2.5 });
      if (!shipRoute.success) {
        issues.push({
          severity: 'error',
          system: 'PathfindingEngine',
          message: `Commercial seaway navigation route failed: ${shipRoute.message}`,
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }
}
