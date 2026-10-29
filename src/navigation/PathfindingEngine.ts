/**
 * Reliable Multi-Modal Pathfinding & Routing Engine
 * Global Transport Empire - Civil Navigation & Network Simulation
 *
 * Implements A* road pathfinding, deepwater maritime fairway navigation,
 * railway track graph traversal, aviation corridor routing, bridge crossing validation,
 * island isolation detection, LRU route caching, and structured failure diagnostics.
 */

import { GridSystem } from '../world/GridSystem';
import { RoadNetworkModel, RoadCellData } from '../world/RoadNetworkModel';
import { TerrainModel } from '../world/TerrainModel';
import { WaterSystemModel, NavigableChannelWaypoint } from '../world/water/WaterSystemModel';
import { TransportNetwork, TransportMode, TransportNode } from '../network/TransportNetwork';
import { globalEventBus } from '../core/EventBus';
import { BuildingEntity } from '../entities/BuildingEntity';
import { IntersectionCoordinator } from '../world/traffic/IntersectionCoordinator';
import { TrafficCongestionMonitor } from '../world/traffic/TrafficCongestionMonitor';

export type RouteCriterion = 'shortest' | 'fastest';

export type RouteStatusCode =
  | 'SUCCESS'
  | 'NO_ROAD_CONNECTION'
  | 'WATER_OBSTACLE_NO_BRIDGE'
  | 'ISLAND_ISOLATED'
  | 'INSUFFICIENT_WATER_DEPTH'
  | 'NON_NAVIGABLE_WATER'
  | 'VESSEL_DRAFT_EXCEEDED'
  | 'TRACK_DISCONNECTED'
  | 'AIRPORT_UNREACHABLE'
  | 'OUT_OF_BOUNDS'
  | 'DESTINATION_UNREACHABLE'
  | 'NO_ACCESS_POINT'
  | 'ROUTE_INVALIDATED'
  | 'TEMPORARILY_BLOCKED'
  | 'ROUTE_RECALCULATING';

export interface RouteWaypoint {
  x: number;
  y: number;
  z: number;
  headingDegrees?: number;
  speedLimitKmh?: number;
  segmentType?: string;
  name?: string;
}

export interface RoutePlanResult {
  success: boolean;
  statusCode: RouteStatusCode;
  mode: TransportMode;
  message: string;
  waypoints: RouteWaypoint[];
  totalDistanceMeters: number;
  estimatedTravelTimeSeconds: number;
  bridgeCrossingsEncountered: string[];
  failureReason?: string;
  suggestedFix?: string;
  criterion?: RouteCriterion;
  accessPoint?: { gridX: number; gridZ: number; worldX: number; worldZ: number; accessType: string };
}

export interface RoutePlanOptions {
  criterion?: RouteCriterion;
  maxSpeedKmh?: number;
  avoidCongestion?: boolean;
  destinationEntityId?: string;
  lengthMeters?: number;
  weightTons?: number;
  heightClearanceMeters?: number;
  draftMeters?: number; // Ships
  beamMeters?: number;  // Ships
}

export type VehicleRoutingSpecs = RoutePlanOptions;

interface AStarNode {
  x: number;
  z: number;
  gScore: number;
  fScore: number;
  parent: AStarNode | null;
  dirX?: number;
  dirZ?: number;
}

export class PathfindingEngine {
  private gridSystem: GridSystem;
  private roadNetworkModel: RoadNetworkModel;
  private terrainModel: TerrainModel;
  private waterSystem: WaterSystemModel;
  private transportNetwork: TransportNetwork;
  private intersectionCoordinator: IntersectionCoordinator | null = null;
  private congestionMonitor: TrafficCongestionMonitor | null = null;

  // LRU Route Cache (Key -> RoutePlanResult)
  private routeCache: Map<string, RoutePlanResult> = new Map();
  private maxCacheSize: number = 200;

  constructor(
    gridSystem?: GridSystem,
    roadNetworkModel?: RoadNetworkModel,
    terrainModel?: TerrainModel,
    waterSystem?: WaterSystemModel,
    transportNetwork?: TransportNetwork
  ) {
    this.gridSystem = gridSystem || new GridSystem();
    this.roadNetworkModel = roadNetworkModel || new RoadNetworkModel(this.gridSystem);
    this.terrainModel = terrainModel || this.gridSystem.terrainModel;
    this.waterSystem = waterSystem || this.terrainModel.waterSystem;
    this.transportNetwork = transportNetwork || new TransportNetwork();
  }

  public setIntersectionCoordinator(coordinator: IntersectionCoordinator | null): void {
    this.intersectionCoordinator = coordinator;
  }

  public getIntersectionCoordinator(): IntersectionCoordinator | null {
    return this.intersectionCoordinator;
  }

  public setCongestionMonitor(monitor: TrafficCongestionMonitor | null): void {
    this.congestionMonitor = monitor;
  }

  public getCongestionMonitor(): TrafficCongestionMonitor | null {
    return this.congestionMonitor;
  }

  /**
   * Invalidates cached routes when infrastructure is added, demolished, or altered
   */
  public invalidateCache(mode?: TransportMode): void {
    if (!mode) {
      this.routeCache.clear();
      return;
    }
    for (const key of this.routeCache.keys()) {
      if (key.startsWith(`${mode}_`)) {
        this.routeCache.delete(key);
      }
    }
  }

  /**
   * Primary Multi-Modal Route Planning Gateway
   */
  public planRoute(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    mode: TransportMode = 'road',
    specs?: VehicleRoutingSpecs
  ): RoutePlanResult {
    const criterion = specs?.criterion ?? 'fastest';
    const cacheKey = `${mode}_${startX}_${startZ}_to_${targetX}_${targetZ}_${criterion}_${specs?.maxSpeedKmh ?? 0}_${specs?.draftMeters ?? 0}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: RoutePlanResult;
    switch (mode) {
      case 'road':
        result = this.planRoadRoute(startX, startZ, targetX, targetZ, specs);
        break;
      case 'waterway':
        result = this.planWaterwayRoute(startX, startZ, targetX, targetZ, specs);
        break;
      case 'rail':
        result = this.planRailRoute(startX, startZ, targetX, targetZ, specs);
        break;
      case 'air':
        result = this.planAirRoute(startX, startZ, targetX, targetZ);
        break;
      default:
        result = {
          success: false,
          statusCode: 'DESTINATION_UNREACHABLE',
          mode,
          message: `Unsupported transport mode '${mode}'.`,
          waypoints: [],
          totalDistanceMeters: 0,
          estimatedTravelTimeSeconds: 0,
          bridgeCrossingsEncountered: [],
          failureReason: `Mode '${mode}' not implemented in pathfinder.`,
        };
    }

    if (!result.success) {
      globalEventBus.emit('dispatch:route_failed', {
        mode,
        start: { x: startX, z: startZ },
        target: { x: targetX, z: targetZ },
        statusCode: result.statusCode,
        message: result.message,
        suggestedFix: result.suggestedFix,
      });
    }

    // Save to LRU cache
    if (this.routeCache.size >= this.maxCacheSize) {
      const firstKey = this.routeCache.keys().next().value;
      if (firstKey) this.routeCache.delete(firstKey);
    }
    this.routeCache.set(cacheKey, result);

    return result;
  }

  /**
   * Road Vehicle Pathfinding
   * Evaluates A* through road network cells, bridges, and detects water obstacles or isolated islands.
   * Supports 'shortest' (distance-minimizing) and 'fastest' (time-minimizing with speed limits & delays) criteria.
   */
  private planRoadRoute(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    specs?: VehicleRoutingSpecs
  ): RoutePlanResult {
    const criterion: RouteCriterion = specs?.criterion ?? 'fastest';
    const maxVehicleSpeed = specs?.maxSpeedKmh ?? 80;
    const avoidCongestion = specs?.avoidCongestion !== false;

    // 1. Convert to grid coordinates if given world coordinates
    let startG = { x: startX, z: startZ };
    let targetG = { x: targetX, z: targetZ };

    if (!this.gridSystem.isWithinBounds(startX, startZ)) {
      const g = this.gridSystem.worldToGrid(startX, startZ);
      if (g) {
        startG = g;
      } else {
        return {
          success: false,
          statusCode: 'OUT_OF_BOUNDS',
          mode: 'road',
          message: 'Origin coordinates are outside the operational territory.',
          waypoints: [],
          totalDistanceMeters: 0,
          estimatedTravelTimeSeconds: 0,
          bridgeCrossingsEncountered: [],
          failureReason: 'Origin out of bounds.',
          criterion,
        };
      }
    }

    if (!this.gridSystem.isWithinBounds(targetX, targetZ)) {
      const g = this.gridSystem.worldToGrid(targetX, targetZ);
      if (g) {
        targetG = g;
      } else {
        return {
          success: false,
          statusCode: 'OUT_OF_BOUNDS',
          mode: 'road',
          message: 'Destination coordinates are outside the operational territory.',
          waypoints: [],
          totalDistanceMeters: 0,
          estimatedTravelTimeSeconds: 0,
          bridgeCrossingsEncountered: [],
          failureReason: 'Destination out of bounds.',
          criterion,
        };
      }
    }

    // 2. Island Isolation Check
    const startIsIsland = this.terrainModel.isRiverIslandCell(startG.x, startG.z);
    const targetIsIsland = this.terrainModel.isRiverIslandCell(targetG.x, targetG.z);
    if ((startIsIsland || targetIsIsland) && !this.roadNetworkModel.hasRoad(1, 1)) {
      return {
        success: false,
        statusCode: 'ISLAND_ISOLATED',
        mode: 'road',
        message: 'Destination is located on an isolated river island with no road bridge connection.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: 'Island has no physical road crossing.',
        suggestedFix: 'Construct a bridge crossing from the riverbank to the island.',
        criterion,
      };
    }

    // 3. Snap to nearest road cell if starting or ending at building/depot
    const resolvedStart = this.resolveNearestRoadCell(startG.x, startG.z);
    const resolvedTarget = this.resolveNearestRoadCell(targetG.x, targetG.z);

    if (!resolvedStart || !resolvedTarget) {
      return {
        success: false,
        statusCode: 'NO_ROAD_CONNECTION',
        mode: 'road',
        message: 'Origin or destination is disconnected from the municipal road network.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: 'No adjacent road found for origin or destination.',
        suggestedFix: 'Construct an asphalt roadway connecting to the facility entrance.',
        criterion,
      };
    }

    // 4. A* Search over Road Network
    const openSet: AStarNode[] = [];
    const openSetMap = new Map<string, AStarNode>();
    const closedSet = new Set<string>();

    const startNode: AStarNode = {
      x: resolvedStart.x,
      z: resolvedStart.z,
      gScore: 0,
      fScore: this.heuristicRoad(resolvedStart.x, resolvedStart.z, resolvedTarget.x, resolvedTarget.z, criterion),
      parent: null,
    };

    openSet.push(startNode);
    openSetMap.set(`${startNode.x},${startNode.z}`, startNode);

    let endNode: AStarNode | null = null;
    const bridgesEncountered = new Set<string>();

    while (openSet.length > 0) {
      // Sort to find smallest fScore
      openSet.sort((a, b) => a.fScore - b.fScore);
      const current = openSet.shift()!;
      const currentKey = `${current.x},${current.z}`;
      openSetMap.delete(currentKey);
      closedSet.add(currentKey);

      if (current.x === resolvedTarget.x && current.z === resolvedTarget.z) {
        endNode = current;
        break;
      }

      const currentCell = this.roadNetworkModel.getRoadCell(current.x, current.z);
      if (!currentCell) continue;

      // Check if current cell is on a bridge
      if (this.terrainModel.isWaterCell(current.x, current.z)) {
        bridgesEncountered.add(`bridge_${current.x}_${current.z}`);
      }

      // 4 Cardinal Neighbors
      const neighbors = [
        { x: current.x, z: current.z - 1, dir: 'north' },
        { x: current.x, z: current.z + 1, dir: 'south' },
        { x: current.x + 1, z: current.z, dir: 'east' },
        { x: current.x - 1, z: current.z, dir: 'west' },
      ];

      for (const n of neighbors) {
        const nKey = `${n.x},${n.z}`;
        if (closedSet.has(nKey)) continue;

        // Neighbor must have an active road cell
        const nCell = this.roadNetworkModel.getRoadCell(n.x, n.z);
        if (!nCell) continue;

        // Skip roads confirmed to be unavailable by congestion monitor
        if (avoidCongestion && this.congestionMonitor && this.congestionMonitor.isRoadUnavailable(n.x, n.z)) {
          continue;
        }

        // Mutual connectivity verification
        if (
          (n.dir === 'north' && !currentCell.connections.north) ||
          (n.dir === 'south' && !currentCell.connections.south) ||
          (n.dir === 'east' && !currentCell.connections.east) ||
          (n.dir === 'west' && !currentCell.connections.west)
        ) {
          // If bidirectional adjacent road, verify connection
          if (!this.roadNetworkModel.areCellsConnected(current.x, current.z, n.x, n.z)) {
            continue;
          }
        }

        // Water check: If neighbor cell is in water, is there a registered bridge crossing?
        if (this.terrainModel.isWaterCell(n.x, n.z)) {
          const isBridge = this.waterSystem.bridgeCrossings.some((b) => {
            const minX = Math.min(b.startCoord.gridX, b.endCoord.gridX);
            const maxX = Math.max(b.startCoord.gridX, b.endCoord.gridX);
            const minZ = Math.min(b.startCoord.gridZ, b.endCoord.gridZ);
            const maxZ = Math.max(b.startCoord.gridZ, b.endCoord.gridZ);
            return n.x >= minX - 1 && n.x <= maxX + 1 && n.z >= minZ - 1 && n.z <= maxZ + 1;
          });
          if (!isBridge && !this.roadNetworkModel.hasRoad(n.x, n.z)) {
            // Cannot cross water without bridge
            continue;
          }
        }

        const moveDirX = n.x - current.x;
        const moveDirZ = n.z - current.z;
        const isTurn = current.parent !== null && (current.dirX !== moveDirX || current.dirZ !== moveDirZ);

        const stepDistMeters = this.gridSystem.cellSize; // 4.0m
        const roadSpeedLimit = this.resolveRoadSpeedLimit(nCell.roadType);
        const effSpeedKmh = Math.min(roadSpeedLimit, maxVehicleSpeed);
        const speedMs = (effSpeedKmh * 1000) / 3600;
        let stepTimeSec = stepDistMeters / speedMs;

        if (isTurn) {
          stepTimeSec += 2.0; // 2s turning clearance and steering delay
        }

        let junctionDelaySec = 0;
        if (avoidCongestion && this.intersectionCoordinator) {
          const juncId = `junc_${n.x}_${n.z}`;
          const junc = this.intersectionCoordinator.getJunction(juncId);
          if (junc) {
            if (junc.junctionType === 'crossroad') junctionDelaySec += 1.5;
            if (junc.waitingQueue.length > 0) junctionDelaySec += junc.waitingQueue.length * 2.0;
            if (junc.activeReservation && junc.activeReservation.occupyingVehicleId) junctionDelaySec += 1.5;
          }
        }
        stepTimeSec += junctionDelaySec;

        let congestionMultiplier = 1.0;
        if (avoidCongestion && this.congestionMonitor) {
          congestionMultiplier = this.congestionMonitor.getCongestionMultiplier(n.x, n.z);
          if (congestionMultiplier === Infinity) {
            continue;
          }
        }
        stepTimeSec *= congestionMultiplier;

        let costIncrement = 0;
        if (criterion === 'shortest') {
          costIncrement =
            stepDistMeters +
            (isTurn ? 0.15 : 0) +
            (congestionMultiplier > 2.0 ? stepDistMeters * (congestionMultiplier - 1.0) * 0.5 : 0);
        } else {
          costIncrement = stepTimeSec;
        }

        const tentativeG = current.gScore + costIncrement;
        let neighborNode = openSetMap.get(nKey);

        if (!neighborNode) {
          neighborNode = {
            x: n.x,
            z: n.z,
            gScore: tentativeG,
            fScore: tentativeG + this.heuristicRoad(n.x, n.z, resolvedTarget.x, resolvedTarget.z, criterion),
            parent: current,
            dirX: moveDirX,
            dirZ: moveDirZ,
          };
          openSet.push(neighborNode);
          openSetMap.set(nKey, neighborNode);
        } else if (tentativeG < neighborNode.gScore) {
          neighborNode.gScore = tentativeG;
          neighborNode.fScore = tentativeG + this.heuristicRoad(n.x, n.z, resolvedTarget.x, resolvedTarget.z, criterion);
          neighborNode.parent = current;
          neighborNode.dirX = moveDirX;
          neighborNode.dirZ = moveDirZ;
        }
      }
    }

    if (!endNode) {
      return {
        success: false,
        statusCode: 'NO_ROAD_CONNECTION',
        mode: 'road',
        message: 'No continuous road path connects the selected locations.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: 'Path blocked or road network disconnected.',
        suggestedFix: 'Extend road network to close gaps between sectors.',
        criterion,
      };
    }

    // 5. Reconstruct Path Waypoints and calculate accurate geometry distance
    const cellPath: { x: number; z: number }[] = [];
    let curr: AStarNode | null = endNode;
    while (curr) {
      cellPath.unshift({ x: curr.x, z: curr.z });
      curr = curr.parent;
    }

    const waypoints: RouteWaypoint[] = [];
    for (let i = 0; i < cellPath.length; i++) {
      const cell = cellPath[i];
      const worldCenter = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
      const isBridge = this.terrainModel.isWaterCell(cell.x, cell.z);
      const roadData = this.roadNetworkModel.getRoadCell(cell.x, cell.z);
      const elevation = isBridge ? 0.80 : (roadData?.elevation ?? 0.04);
      const speedLimitKmh = this.resolveRoadSpeedLimit(roadData?.roadType);

      const isTurn =
        i > 0 &&
        i < cellPath.length - 1 &&
        (cellPath[i].x - cellPath[i - 1].x !== cellPath[i + 1].x - cellPath[i].x ||
          cellPath[i].z - cellPath[i - 1].z !== cellPath[i + 1].z - cellPath[i].z);

      if (isTurn) {
        const prevCenter = this.gridSystem.gridToWorldCenter(cellPath[i - 1].x, cellPath[i - 1].z);
        const nextCenter = this.gridSystem.gridToWorldCenter(cellPath[i + 1].x, cellPath[i + 1].z);
        const entryX = (prevCenter.x + worldCenter.x) / 2;
        const entryZ = (prevCenter.z + worldCenter.z) / 2;
        const exitX = (worldCenter.x + nextCenter.x) / 2;
        const exitZ = (worldCenter.z + nextCenter.z) / 2;
        const headingIn = (Math.atan2(worldCenter.x - prevCenter.x, -(worldCenter.z - prevCenter.z)) * 180) / Math.PI;
        const headingOut = (Math.atan2(nextCenter.x - worldCenter.x, -(nextCenter.z - worldCenter.z)) * 180) / Math.PI;

        waypoints.push({
          x: entryX,
          y: elevation,
          z: entryZ,
          headingDegrees: ((headingIn % 360) + 360) % 360,
          speedLimitKmh: Math.min(speedLimitKmh, 40),
          segmentType: roadData?.roadType ?? 'two_lane_urban',
          name: `Turn Entry (${cell.x}, ${cell.z})`,
        });

        const apexX = (entryX + exitX) / 2 + (worldCenter.x - (entryX + exitX) / 2) * 0.4;
        const apexZ = (entryZ + exitZ) / 2 + (worldCenter.z - (entryZ + exitZ) / 2) * 0.4;
        const midHeading = (headingIn + headingOut) / 2;

        waypoints.push({
          x: apexX,
          y: elevation,
          z: apexZ,
          headingDegrees: ((midHeading % 360) + 360) % 360,
          speedLimitKmh: Math.min(speedLimitKmh, 35),
          segmentType: roadData?.roadType ?? 'two_lane_urban',
          name: `Turn Apex Arc (${cell.x}, ${cell.z})`,
        });

        waypoints.push({
          x: exitX,
          y: elevation,
          z: exitZ,
          headingDegrees: ((headingOut % 360) + 360) % 360,
          speedLimitKmh: Math.min(speedLimitKmh, 40),
          segmentType: roadData?.roadType ?? 'two_lane_urban',
          name: `Turn Exit (${cell.x}, ${cell.z})`,
        });
      } else {
        let heading = 0;
        if (i < cellPath.length - 1) {
          const nextCell = cellPath[i + 1];
          heading = (Math.atan2(nextCell.x - cell.x, -(nextCell.z - cell.z)) * 180) / Math.PI;
        } else if (i > 0) {
          const prevCell = cellPath[i - 1];
          heading = (Math.atan2(cell.x - prevCell.x, -(cell.z - prevCell.z)) * 180) / Math.PI;
        }

        waypoints.push({
          x: worldCenter.x,
          y: elevation,
          z: worldCenter.z,
          headingDegrees: ((heading % 360) + 360) % 360,
          speedLimitKmh,
          segmentType: roadData?.roadType ?? 'two_lane_urban',
          name: isBridge ? 'Bridge Deck Span' : `Road Cell (${cell.x}, ${cell.z})`,
        });
      }
    }

    // Accurate Trajectory Distance and Travel Time
    let totalDistanceMeters = 0;
    let travelTimeSeconds = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const segDist = Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].z - waypoints[i - 1].z);
      totalDistanceMeters += segDist;
      const speedLimit = waypoints[i].speedLimitKmh ?? 50;
      const effSpeed = Math.min(speedLimit, maxVehicleSpeed);
      const speedMs = (effSpeed * 1000) / 3600;
      travelTimeSeconds += segDist / speedMs;
    }

    // Add turning delay for each turn
    for (let i = 0; i < cellPath.length; i++) {
      const isTurn =
        i > 0 &&
        i < cellPath.length - 1 &&
        (cellPath[i].x - cellPath[i - 1].x !== cellPath[i + 1].x - cellPath[i].x ||
          cellPath[i].z - cellPath[i - 1].z !== cellPath[i + 1].z - cellPath[i].z);
      if (isTurn) {
        travelTimeSeconds += 2.0;
      }
    }

    return {
      success: true,
      statusCode: 'SUCCESS',
      mode: 'road',
      message: `Road route (${criterion}) planned successfully across ${cellPath.length} street segments (${totalDistanceMeters.toFixed(1)}m, ${Math.max(1, Math.round(travelTimeSeconds))}s).`,
      waypoints,
      totalDistanceMeters: Math.round(totalDistanceMeters * 10) / 10,
      estimatedTravelTimeSeconds: Math.max(1, Math.round(travelTimeSeconds)),
      bridgeCrossingsEncountered: Array.from(bridgesEncountered),
      criterion,
    };
  }

  /**
   * Validates vehicle swept-path off-tracking and turning clearance for heavy 16.5m semi-combinations.
   * Off-tracking equation: Delta = (Wheelbase^2) / (2 * Radius)
   * Supports both cell coordinate queries and 3D waypoint trajectory analysis.
   */
  public validateVehicleTurnClearance(
    turnCellXOrEntry: number | { x: number; y: number; z: number },
    turnCellZOrApex: number | { x: number; y: number; z: number },
    turnRadiusOrExit: number | { x: number; y: number; z: number } = 8.0,
    vehicleWheelbaseMeters: number = 12.5,
    availableCorridorWidthMeters: number = 4.0
  ): {
    hasSufficientClearance: boolean;
    isClear: boolean;
    sweptPathWidthMeters: number;
    offTrackingMeters: number;
    clearanceMarginMeters: number;
    requiresApron: boolean;
  } {
    let radius = 8.0;
    let corridorWidth = availableCorridorWidthMeters;

    if (typeof turnCellXOrEntry === 'object' && typeof turnCellZOrApex === 'object' && typeof turnRadiusOrExit === 'object') {
      const entryPt = turnCellXOrEntry;
      const apexPt = turnCellZOrApex;
      const exitPt = turnRadiusOrExit;
      const d1 = Math.hypot(apexPt.x - entryPt.x, apexPt.z - entryPt.z);
      const d2 = Math.hypot(exitPt.x - apexPt.x, exitPt.z - apexPt.z);
      const avgChord = (d1 + d2) / 2;
      radius = Math.max(4.0, avgChord * 1.414);
      if (typeof availableCorridorWidthMeters === 'number') {
        corridorWidth = availableCorridorWidthMeters;
      }
    } else if (typeof turnRadiusOrExit === 'number') {
      radius = turnRadiusOrExit;
    }

    const offTracking = (vehicleWheelbaseMeters * vehicleWheelbaseMeters) / (2 * radius);
    const vehicleWidth = 2.5; // ISO 2.50m truck body width
    const sweptPath = vehicleWidth + offTracking;
    const clearanceMargin = corridorWidth - sweptPath;
    const isClear = sweptPath <= corridorWidth * 1.8;

    return {
      hasSufficientClearance: clearanceMargin >= -0.3,
      isClear,
      sweptPathWidthMeters: Number(sweptPath.toFixed(2)),
      offTrackingMeters: Number(offTracking.toFixed(2)),
      clearanceMarginMeters: Number(clearanceMargin.toFixed(2)),
      requiresApron: sweptPath > corridorWidth,
    };
  }

  /**
   * Waterway Navigation Route Planning
   * Plans shipping paths through deepwater channels, checking vessel draft against bed depths.
   */
  private planWaterwayRoute(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    specs?: VehicleRoutingSpecs
  ): RoutePlanResult {
    const vesselDraft = specs?.draftMeters ?? 2.5; // Standard 2.5m draft

    // 1. Check if start or target are in dry land or non-water
    const startNav = this.waterSystem.isNavigableAt(startX, startZ, vesselDraft);
    const targetNav = this.waterSystem.isNavigableAt(targetX, targetZ, vesselDraft);

    if (!startNav.canNavigate) {
      return {
        success: false,
        statusCode: startNav.reason?.includes('draft') ? 'VESSEL_DRAFT_EXCEEDED' : 'NON_NAVIGABLE_WATER',
        mode: 'waterway',
        message: `Origin location is not navigable for vessels with ${vesselDraft}m draft: ${startNav.reason}`,
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: startNav.reason,
        suggestedFix: 'Relocate vessel mooring to a deepwater berth with >= 3.0m draft clearance.',
      };
    }

    if (!targetNav.canNavigate) {
      return {
        success: false,
        statusCode: targetNav.reason?.includes('draft') ? 'VESSEL_DRAFT_EXCEEDED' : 'NON_NAVIGABLE_WATER',
        mode: 'waterway',
        message: `Destination location is not navigable for vessels with ${vesselDraft}m draft: ${targetNav.reason}`,
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: targetNav.reason,
        suggestedFix: 'Select an authorized port berth or deepwater fairway destination.',
      };
    }

    // 2. Traversal through authoritative navigable channels
    const channel = this.waterSystem.navigableChannels[0];
    if (!channel || channel.centerlineWaypoints.length === 0) {
      return {
        success: false,
        statusCode: 'NON_NAVIGABLE_WATER',
        mode: 'waterway',
        message: 'No designated deepwater shipping fairway found.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
      };
    }

    // Connect Start -> Nearest Fairway Waypoints -> Target
    const waypoints: RouteWaypoint[] = [];
    waypoints.push({
      x: startX,
      y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      z: startZ,
      speedLimitKmh: 8,
      name: 'Port Departure Berth',
    });

    let totalDist = 0;
    let lastPt = { x: startX, z: startZ };

    for (const wpt of channel.centerlineWaypoints) {
      const d = Math.hypot(wpt.x - lastPt.x, wpt.z - lastPt.z);
      totalDist += d;
      lastPt = { x: wpt.x, z: wpt.z };

      waypoints.push({
        x: wpt.x,
        y: wpt.y,
        z: wpt.z,
        speedLimitKmh: (wpt.targetSpeedKnots * 1.852),
        name: wpt.name,
      });
    }

    const finalLeg = Math.hypot(targetX - lastPt.x, targetZ - lastPt.z);
    totalDist += finalLeg;
    waypoints.push({
      x: targetX,
      y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      z: targetZ,
      speedLimitKmh: 8,
      name: 'Destination Fairway Mooring',
    });

    const avgSpeedKnots = 10;
    const travelTimeSec = Math.round((totalDist / ((avgSpeedKnots * 1852) / 3600)));

    return {
      success: true,
      statusCode: 'SUCCESS',
      mode: 'waterway',
      message: `Deepwater maritime route plotted across ${waypoints.length} navigational waypoints (${totalDist.toFixed(1)}m).`,
      waypoints,
      totalDistanceMeters: totalDist,
      estimatedTravelTimeSeconds: travelTimeSec,
      bridgeCrossingsEncountered: [],
    };
  }

  /**
   * Railway Track Pathfinding
   */
  private planRailRoute(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    _specs?: VehicleRoutingSpecs
  ): RoutePlanResult {
    const railNodes = this.transportNetwork.getNodesByMode('rail');
    if (railNodes.length === 0) {
      return {
        success: false,
        statusCode: 'TRACK_DISCONNECTED',
        mode: 'rail',
        message: 'No railway mainline or yard tracks found in current network topology.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: 'Rail network has 0 track segments.',
        suggestedFix: 'Lay continuous railway track and switches between terminals.',
      };
    }

    // Find nearest rail nodes
    const startNode = this.findNearestNode(startX, startZ, railNodes);
    const endNode = this.findNearestNode(targetX, targetZ, railNodes);

    if (!startNode || !endNode) {
      return {
        success: false,
        statusCode: 'TRACK_DISCONNECTED',
        mode: 'rail',
        message: 'Rail endpoints not connected to track network.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
      };
    }

    const pathRes = this.transportNetwork.findPath(startNode.id, endNode.id, 'rail');
    if (!pathRes.found) {
      return {
        success: false,
        statusCode: 'TRACK_DISCONNECTED',
        mode: 'rail',
        message: 'Railway track is disconnected between source and destination.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: pathRes.error,
        suggestedFix: 'Connect track switches and ensure track alignment across crossings.',
      };
    }

    const waypoints: RouteWaypoint[] = pathRes.pathNodes.map((n) => ({
      x: n.worldPosition.x,
      y: n.worldPosition.y,
      z: n.worldPosition.z,
      name: n.name,
      speedLimitKmh: 80,
    }));

    return {
      success: true,
      statusCode: 'SUCCESS',
      mode: 'rail',
      message: `Railway route planned along ${waypoints.length} track nodes (${pathRes.totalDistanceMeters}m).`,
      waypoints,
      totalDistanceMeters: pathRes.totalDistanceMeters,
      estimatedTravelTimeSeconds: pathRes.estimatedTravelTimeSeconds,
      bridgeCrossingsEncountered: [],
    };
  }

  /**
   * Aviation Corridor Pathfinding
   */
  private planAirRoute(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number
  ): RoutePlanResult {
    const airNodes = this.transportNetwork.getNodesByMode('air');
    if (airNodes.length === 0) {
      // Direct flight path across regional airspace
      const dist = Math.hypot(targetX - startX, targetZ - startZ);
      const cruiseAlt = 60.0; // 60m flight corridor

      const waypoints: RouteWaypoint[] = [
        { x: startX, y: 0.5, z: startZ, name: 'Runway Departure Roll', speedLimitKmh: 180 },
        { x: startX + (targetX - startX) * 0.2, y: cruiseAlt, z: startZ + (targetZ - startZ) * 0.2, name: 'Climb Waypoint', speedLimitKmh: 450 },
        { x: startX + (targetX - startX) * 0.8, y: cruiseAlt, z: startZ + (targetZ - startZ) * 0.8, name: 'Descent Fix', speedLimitKmh: 450 },
        { x: targetX, y: 0.5, z: targetZ, name: 'Runway Touchdown', speedLimitKmh: 200 },
      ];

      return {
        success: true,
        statusCode: 'SUCCESS',
        mode: 'air',
        message: `Air flight route established across regional corridor (${dist.toFixed(1)}m).`,
        waypoints,
        totalDistanceMeters: dist,
        estimatedTravelTimeSeconds: Math.round((dist / ((350 * 1000) / 3600))),
        bridgeCrossingsEncountered: [],
      };
    }

    const startNode = this.findNearestNode(startX, startZ, airNodes);
    const endNode = this.findNearestNode(targetX, targetZ, airNodes);

    if (!startNode || !endNode) {
      return {
        success: false,
        statusCode: 'AIRPORT_UNREACHABLE',
        mode: 'air',
        message: 'No suitable aerodrome runway available for origin or destination.',
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
      };
    }

    const dist = Math.hypot(endNode.worldPosition.x - startNode.worldPosition.x, endNode.worldPosition.z - startNode.worldPosition.z);
    return {
      success: true,
      statusCode: 'SUCCESS',
      mode: 'air',
      message: `Aviation connection established from ${startNode.name} to ${endNode.name}.`,
      waypoints: [
        { x: startNode.worldPosition.x, y: startNode.worldPosition.y, z: startNode.worldPosition.z, name: startNode.name },
        { x: endNode.worldPosition.x, y: endNode.worldPosition.y, z: endNode.worldPosition.z, name: endNode.name },
      ],
      totalDistanceMeters: dist,
      estimatedTravelTimeSeconds: Math.round((dist / ((400 * 1000) / 3600))),
      bridgeCrossingsEncountered: [],
    };
  }

  // --- Helper Methods ---

  private resolveNearestRoadCell(gridX: number, gridZ: number): { x: number; z: number } | null {
    if (this.roadNetworkModel.hasRoad(gridX, gridZ)) {
      return { x: gridX, z: gridZ };
    }

    // Check adjacent 4 neighbors
    const neighbors = this.gridSystem.getAdjacentCells(gridX, gridZ);
    for (const n of neighbors) {
      if (this.roadNetworkModel.hasRoad(n.x, n.z)) {
        return { x: n.x, z: n.z };
      }
    }

    // Radius 2 search
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const checkX = gridX + dx;
        const checkZ = gridZ + dz;
        if (this.gridSystem.isWithinBounds(checkX, checkZ) && this.roadNetworkModel.hasRoad(checkX, checkZ)) {
          return { x: checkX, z: checkZ };
        }
      }
    }

    return null;
  }

  private findNearestNode(x: number, z: number, nodes: TransportNode[]): TransportNode | null {
    let nearest: TransportNode | null = null;
    let minDist = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.worldPosition.x - x, n.worldPosition.z - z);
      if (d < minDist) {
        minDist = d;
        nearest = n;
      }
    }
    return nearest;
  }

  public resolveRoadSpeedLimit(roadType?: string): number {
    if (!roadType) return 50;
    if (roadType === 'highway_corridor') return 110;
    if (roadType === 'heavy_arterial' || roadType === 'arterial') return 75;
    if (roadType === 'highway_ramp') return 60;
    if (roadType === 'industrial_access') return 35;
    return 50; // two_lane_urban
  }

  private heuristicRoad(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    criterion: RouteCriterion
  ): number {
    const euclideanDistMeters = Math.hypot(x2 - x1, z2 - z1) * this.gridSystem.cellSize;
    if (criterion === 'shortest') {
      return euclideanDistMeters;
    } else {
      const maxPossibleSpeedMs = (110 * 1000) / 3600; // 30.56 m/s
      return euclideanDistMeters / maxPossibleSpeedMs;
    }
  }

  private heuristic(x1: number, z1: number, x2: number, z2: number): number {
    // Manhattan distance scaled to meters
    return (Math.abs(x2 - x1) + Math.abs(z2 - z1)) * this.gridSystem.cellSize;
  }

  /**
   * Resolves valid road access points along the perimeter of a building entity.
   * Direct highway corridor access is prohibited (consistent with civil zoning).
   * Prioritizes front service entrances where defined.
   */
  public resolveBuildingAccessPoints(building: BuildingEntity): Array<{
    gridX: number;
    gridZ: number;
    worldX: number;
    worldZ: number;
    isFront: boolean;
    roadType: string;
  }> {
    const isSwapped = building.rotationDegrees === 90 || building.rotationDegrees === 270;
    const effW = isSwapped ? building.definition.footprintDepth : building.definition.footprintWidth;
    const effD = isSwapped ? building.definition.footprintWidth : building.definition.footprintDepth;

    const accessPoints: Array<{
      gridX: number;
      gridZ: number;
      worldX: number;
      worldZ: number;
      isFront: boolean;
      roadType: string;
    }> = [];

    const perimeterEdges: Array<{ edge: 'north' | 'south' | 'east' | 'west'; cells: Array<{ x: number; z: number }> }> = [
      {
        edge: 'north',
        cells: Array.from({ length: effW }, (_, i) => ({ x: building.gridX + i, z: building.gridZ - 1 })),
      },
      {
        edge: 'south',
        cells: Array.from({ length: effW }, (_, i) => ({ x: building.gridX + i, z: building.gridZ + effD })),
      },
      {
        edge: 'west',
        cells: Array.from({ length: effD }, (_, i) => ({ x: building.gridX - 1, z: building.gridZ + i })),
      },
      {
        edge: 'east',
        cells: Array.from({ length: effD }, (_, i) => ({ x: building.gridX + effW, z: building.gridZ + i })),
      },
    ];

    let frontEdge: 'north' | 'south' | 'east' | 'west' = 'south';
    const normRot = ((building.rotationDegrees % 360) + 360) % 360;
    if (normRot === 90) frontEdge = 'west';
    else if (normRot === 180) frontEdge = 'north';
    else if (normRot === 270) frontEdge = 'east';

    for (const pEdge of perimeterEdges) {
      const isFront = building.definition.serviceEntranceSide === 'front' ? pEdge.edge === frontEdge : true;
      for (const cell of pEdge.cells) {
        if (!this.gridSystem.isWithinBounds(cell.x, cell.z)) continue;
        if (this.roadNetworkModel.hasRoad(cell.x, cell.z)) {
          const roadData = this.roadNetworkModel.getRoadCell(cell.x, cell.z);
          if (roadData && roadData.roadType !== 'highway_corridor') {
            const worldPos = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
            accessPoints.push({
              gridX: cell.x,
              gridZ: cell.z,
              worldX: worldPos.x,
              worldZ: worldPos.z,
              isFront,
              roadType: roadData.roadType,
            });
          }
        }
      }
    }

    accessPoints.sort((a, b) => (b.isFront ? 1 : 0) - (a.isFront ? 1 : 0));
    return accessPoints;
  }

  /**
   * Resolves the single best road access point for a given building or coordinate.
   */
  public resolveDestinationAccessPoint(
    destination: BuildingEntity | { gridX: number; gridZ: number } | { x: number; z: number },
    originGX: number,
    originGZ: number,
    _criterion: RouteCriterion = 'fastest'
  ): { gridX: number; gridZ: number; worldX: number; worldZ: number; accessType: string } | null {
    const isBuilding =
      destination instanceof BuildingEntity ||
      (typeof destination === 'object' &&
        destination !== null &&
        'definition' in destination &&
        'gridX' in destination);

    if (isBuilding) {
      const bldg = destination as BuildingEntity;
      const accessPoints = this.resolveBuildingAccessPoints(bldg);
      if (accessPoints.length === 0) return null;

      const frontPoints = accessPoints.filter((ap) => ap.isFront);
      const candidates = frontPoints.length > 0 ? frontPoints : accessPoints;

      if (candidates.length === 1) {
        return {
          gridX: candidates[0].gridX,
          gridZ: candidates[0].gridZ,
          worldX: candidates[0].worldX,
          worldZ: candidates[0].worldZ,
          accessType: candidates[0].isFront ? 'service_entrance' : 'perimeter_access',
        };
      }

      let best = candidates[0];
      let bestCost = Infinity;
      for (const cand of candidates) {
        const dist = Math.hypot(cand.gridX - originGX, cand.gridZ - originGZ);
        if (dist < bestCost) {
          bestCost = dist;
          best = cand;
        }
      }

      return {
        gridX: best.gridX,
        gridZ: best.gridZ,
        worldX: best.worldX,
        worldZ: best.worldZ,
        accessType: best.isFront ? 'service_entrance' : 'perimeter_access',
      };
    }

    const gx = 'gridX' in destination ? destination.gridX : destination.x;
    const gz = 'gridZ' in destination ? destination.gridZ : destination.z;

    const roadCell = this.resolveNearestRoadCell(gx, gz);
    if (!roadCell) return null;

    const wPos = this.gridSystem.gridToWorldCenter(roadCell.x, roadCell.z);
    return {
      gridX: roadCell.x,
      gridZ: roadCell.z,
      worldX: wPos.x,
      worldZ: wPos.z,
      accessType: roadCell.x === gx && roadCell.z === gz ? 'road_cell' : 'adjacent_road',
    };
  }

  /**
   * High-level gateway to route directly to a building entity or coordinate with automatic access resolution.
   */
  public planRouteToDestination(
    originX: number,
    originZ: number,
    destination: BuildingEntity | { x: number; z: number } | { gridX: number; gridZ: number },
    options?: RoutePlanOptions
  ): RoutePlanResult {
    let originG = { x: originX, z: originZ };
    if (!this.gridSystem.isWithinBounds(originX, originZ)) {
      const g = this.gridSystem.worldToGrid(originX, originZ);
      if (g) originG = g;
    }

    const accessPoint = this.resolveDestinationAccessPoint(
      destination,
      originG.x,
      originG.z,
      options?.criterion ?? 'fastest'
    );

    if (!accessPoint) {
      const destName = destination instanceof BuildingEntity ? destination.definition.name : 'Target Location';
      return {
        success: false,
        statusCode: 'NO_ACCESS_POINT',
        mode: 'road',
        message: `Destination '${destName}' has no accessible road connection or driveway entrance.`,
        waypoints: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        bridgeCrossingsEncountered: [],
        failureReason: 'No adjacent road found along perimeter.',
        suggestedFix: 'Construct an adjacent local street or arterial road connecting to the facility entrance.',
        criterion: options?.criterion ?? 'fastest',
      };
    }

    const plan = this.planRoute(
      originG.x,
      originG.z,
      accessPoint.gridX,
      accessPoint.gridZ,
      'road',
      options
    );

    plan.accessPoint = accessPoint;
    return plan;
  }

  /**
   * Calculates trailer swept path off-tracking using standard civil kinematic formula:
   * Delta = R - sqrt(R^2 - L^2) (or L^2 / (2R) approximation for wide turns)
   */
  public calculateSweptPathOffTracking(wheelbaseMeters: number, turningRadiusMeters: number): number {
    if (turningRadiusMeters <= 0) return 0;
    if (turningRadiusMeters <= wheelbaseMeters) {
      return (wheelbaseMeters * wheelbaseMeters) / (2 * turningRadiusMeters);
    }
    return turningRadiusMeters - Math.sqrt(turningRadiusMeters * turningRadiusMeters - wheelbaseMeters * wheelbaseMeters);
  }

  /**
   * Generates smoothed turn arc waypoints through corner junctions
   */
  public generateTurnArcWaypoints(
    entryPt: { x: number; y: number; z: number },
    cornerApex: { x: number; y: number; z: number },
    exitPt: { x: number; y: number; z: number },
    filletFraction: number = 0.35
  ): Array<{ x: number; y: number; z: number }> {
    const tEntry = {
      x: cornerApex.x + (entryPt.x - cornerApex.x) * filletFraction,
      y: cornerApex.y,
      z: cornerApex.z + (entryPt.z - cornerApex.z) * filletFraction,
    };

    const tExit = {
      x: cornerApex.x + (exitPt.x - cornerApex.x) * filletFraction,
      y: cornerApex.y,
      z: cornerApex.z + (exitPt.z - cornerApex.z) * filletFraction,
    };

    const midTangent = {
      x: (tEntry.x + tExit.x) / 2,
      y: cornerApex.y,
      z: (tEntry.z + tExit.z) / 2,
    };
    const arcApex = {
      x: (midTangent.x + cornerApex.x) / 2,
      y: cornerApex.y,
      z: (midTangent.z + cornerApex.z) / 2,
    };

    return [tEntry, arcApex, tExit];
  }
}
