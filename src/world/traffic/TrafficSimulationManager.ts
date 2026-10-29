/**
 * Master Traffic Flow Simulation & Multi-Vehicle Coordinator
 * Global Transport Empire - Civil Engineering & Autonomous Traffic Engine
 *
 * Implements realistic car-following spacing, right-hand lane discipline,
 * junction clearance & queuing, smooth kinematic turning, fifth-wheel trailer articulation,
 * dynamic road network expansion rerouting, and starter depot dispatch/arrival cycles.
 */

import { GridSystem } from '../GridSystem';
import { RoadNetworkModel } from '../RoadNetworkModel';
import { PathfindingEngine } from '../../navigation/PathfindingEngine';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { VehicleEntity } from '../../entities/vehicles/VehicleEntity';
import { BuildingEntity } from '../../entities/BuildingEntity';
import { FacilityManager } from '../../facilities/FacilityManager';
import { globalEventBus } from '../../core/EventBus';
import {
  TrafficVehicleState,
  TrafficLaneWaypoint,
  TrafficDiagnosticsSummary,
  DispatchJourneyRequest,
  VehicleRouteProgressInfo,
  OperationalStateBadge,
  RoadCongestionState,
  BlockageCause,
} from './TrafficTypes';
import { TrafficLanePathGenerator } from './TrafficLanePathGenerator';
import { IntersectionCoordinator } from './IntersectionCoordinator';
import { TrafficCongestionMonitor } from './TrafficCongestionMonitor';

export interface SimulatedVehicleData {
  vehicleId: string;
  entity: VehicleEntity;
  state: TrafficVehicleState;
  waypoints: TrafficLaneWaypoint[];
  currentWaypointIndex: number;
  currentSpeedMs: number;
  targetSpeedMs: number;
  currentHeadingDeg: number;
  trailerHeadingDeg: number;
  currentElevation: number;
  assignedBayIndex?: number;
  destinationName: string;
  targetGridX?: number;
  targetGridZ?: number;
  activeJunctionId: string | null;
  waitTimeSeconds: number;
  stationaryTimeSeconds: number;
  blockageCause?: BlockageCause;
  lastRerouteTimestampMs?: number;
  isReturnTrip: boolean;
  totalDistanceMeters: number;
  distanceTraveledMeters: number;
  estimatedTravelTimeSeconds?: number;
  criterion?: 'shortest' | 'fastest';
  accessPoint?: {
    gridX: number;
    gridZ: number;
    worldX: number;
    worldZ: number;
    accessType: string;
  };
}

export class TrafficSimulationManager {
  private gridSystem: GridSystem;
  private roadModel: RoadNetworkModel;
  private pathfinding: PathfindingEngine;
  private entityRegistry: EntityRegistry;
  private facilityManager: FacilityManager;
  public readonly intersectionCoordinator: IntersectionCoordinator;
  public readonly congestionMonitor: TrafficCongestionMonitor;

  private vehicles: Map<string, SimulatedVehicleData> = new Map();
  private rerouteEventsCount: number = 0;

  // Maximum kinematic physical acceleration and deceleration limits
  private static readonly MAX_ACCEL_MS2 = 2.4; // 2.4 m/s^2 smooth commercial truck acceleration
  private static readonly COMFORT_BRAKE_MS2 = 2.8; // 2.8 m/s^2 comfortable service braking
  private static readonly HARD_BRAKE_MS2 = 4.5; // 4.5 m/s^2 emergency braking limit
  private static readonly STANDSTILL_GAP_METERS = 3.5; // Bumper-to-bumper minimum buffer

  constructor(
    gridSystem: GridSystem,
    roadModel: RoadNetworkModel,
    pathfinding: PathfindingEngine,
    entityRegistry: EntityRegistry,
    facilityManager: FacilityManager
  ) {
    this.gridSystem = gridSystem;
    this.roadModel = roadModel;
    this.pathfinding = pathfinding;
    this.entityRegistry = entityRegistry;
    this.facilityManager = facilityManager;
    this.intersectionCoordinator = new IntersectionCoordinator();
    this.congestionMonitor = new TrafficCongestionMonitor(this.gridSystem, this.roadModel);
    this.pathfinding.setIntersectionCoordinator(this.intersectionCoordinator);
    this.pathfinding.setCongestionMonitor(this.congestionMonitor);
  }

  /**
   * Initializes junctions and registers initial fleet entities
   */
  public initialize(): void {
    // 1. Scan road model to register all known junctions
    for (const cell of this.roadModel.getAllRoadCells()) {
      if (
        cell.junctionType === 'crossroad' ||
        cell.junctionType === 't_junction' ||
        cell.junctionType === 'roundabout' ||
        cell.junctionType.startsWith('corner_')
      ) {
        this.intersectionCoordinator.registerJunction(cell.gridX, cell.gridZ, cell.junctionType);
      }
    }

    // 2. Discover vehicles already present in the entity registry
    const registered = this.entityRegistry.getAll().filter((e) => e.entityType === 'vehicle');
    for (const e of registered) {
      if (e instanceof VehicleEntity) {
        this.trackVehicle(e);
      }
    }
  }

  /**
   * Begins tracking a newly spawned vehicle in the traffic simulation
   */
  public trackVehicle(entity: VehicleEntity): void {
    if (this.vehicles.has(entity.id)) return;

    // Check if parked in starter depot
    const isStarterDepot = entity.gridX === 12 && entity.gridZ === 13;
    const initialSpeedKmh = isStarterDepot ? 0 : 50;

    let initialBay = 2;
    if (entity.id === 'veh_prime_mover_01') initialBay = 2;

    this.vehicles.set(entity.id, {
      vehicleId: entity.id,
      entity,
      state: isStarterDepot ? 'idle_parked' : 'cruising',
      waypoints: [],
      currentWaypointIndex: 0,
      currentSpeedMs: (initialSpeedKmh * 1000) / 3600,
      targetSpeedMs: (initialSpeedKmh * 1000) / 3600,
      currentHeadingDeg: (entity.group.rotation.y * 180) / Math.PI,
      trailerHeadingDeg: (entity.group.rotation.y * 180) / Math.PI,
      currentElevation: entity.group.position.y || (isStarterDepot ? 0.28 : 0.042),
      assignedBayIndex: isStarterDepot ? initialBay : undefined,
      destinationName: isStarterDepot ? 'Staged at Starter Depot' : 'Patrolling Corridor',
      activeJunctionId: null,
      waitTimeSeconds: 0,
      stationaryTimeSeconds: 0,
      blockageCause: undefined,
      lastRerouteTimestampMs: 0,
      isReturnTrip: false,
      totalDistanceMeters: 0,
      distanceTraveledMeters: 0,
    });
  }

  public untrackVehicle(vehicleId: string): void {
    const data = this.vehicles.get(vehicleId);
    if (data && data.activeJunctionId) {
      this.intersectionCoordinator.releaseJunction(data.activeJunctionId, vehicleId);
    }
    this.vehicles.delete(vehicleId);
  }

  /**
   * Dispatches a vehicle on an active delivery assignment along the road network
   */
  public dispatchVehicle(request: DispatchJourneyRequest): { success: boolean; error?: string } {
    const sim = this.vehicles.get(request.vehicleId);
    if (!sim) {
      // Attempt to retrieve from entity registry
      const entity = this.entityRegistry.get(request.vehicleId);
      if (entity && entity instanceof VehicleEntity) {
        this.trackVehicle(entity);
      } else {
        return { success: false, error: `Vehicle '${request.vehicleId}' not registered.` };
      }
    }

    const vehicle = this.vehicles.get(request.vehicleId)!;

    // 1. Determine origin and destination grid coordinates
    let startGX = vehicle.entity.gridX;
    let startGZ = vehicle.entity.gridZ;
    const isAtDepot = vehicle.state === 'idle_parked' || (startGX === 12 && startGZ === 13);
    const originGX = isAtDepot ? 11 : startGX;
    const originGZ = isAtDepot ? 14 : startGZ;

    // Resolve target entity or target coordinates
    let destEntity = request.destinationEntityId ? this.entityRegistry.get(request.destinationEntityId) : undefined;
    if (!destEntity && request.destinationName) {
      for (const ent of this.entityRegistry.getAll()) {
        if (ent instanceof BuildingEntity) {
          if (
            ent.definition.name.toLowerCase().includes(request.destinationName.toLowerCase()) ||
            ent.id.toLowerCase() === request.destinationName.toLowerCase()
          ) {
            destEntity = ent;
            break;
          }
        }
      }
    }

    let targetGX = request.targetGridX;
    let targetGZ = request.targetGridZ;
    let targetAccessPoint: {
      gridX: number;
      gridZ: number;
      worldX: number;
      worldZ: number;
      accessType: string;
    } | null = null;

    if (destEntity && destEntity instanceof BuildingEntity) {
      targetAccessPoint = this.pathfinding.resolveDestinationAccessPoint(
        destEntity,
        originGX,
        originGZ,
        request.criterion ?? 'fastest'
      );
      if (!targetAccessPoint) {
        return {
          success: false,
          error: `Facility '${destEntity.definition.name}' has no accessible road connection or driveway entrance.`,
        };
      }
      targetGX = targetAccessPoint.gridX;
      targetGZ = targetAccessPoint.gridZ;
    } else {
      if (targetGX === undefined || targetGZ === undefined) {
        if (request.destinationName.includes('Apex') || request.destinationName.includes('Factory')) {
          targetGX = 8;
          targetGZ = 5;
        } else if (request.destinationName.includes('Logistics') || request.destinationName.includes('Warehouse')) {
          targetGX = 5;
          targetGZ = 12;
        } else if (request.destinationName.includes('Commercial') || request.destinationName.includes('HQ')) {
          targetGX = 12;
          targetGZ = 6;
        } else {
          // Default East Gateway portal on Interstate highway corridor (23, 11)
          targetGX = 23;
          targetGZ = 11;
        }
      }

      // If target coordinate is not a road cell, attempt resolving nearby perimeter access
      if (!this.roadModel.hasRoad(targetGX, targetGZ)) {
        targetAccessPoint = this.pathfinding.resolveDestinationAccessPoint(
          { gridX: targetGX, gridZ: targetGZ },
          originGX,
          originGZ,
          request.criterion ?? 'fastest'
        );
        if (targetAccessPoint) {
          targetGX = targetAccessPoint.gridX;
          targetGZ = targetAccessPoint.gridZ;
        }
      }
    }

    // 2. Plan high-level road route using PathfindingEngine with criterion & specs
    const routePlan = this.pathfinding.planRoute(
      originGX,
      originGZ,
      targetGX,
      targetGZ,
      'road',
      {
        lengthMeters: 16.5,
        criterion: request.criterion ?? 'fastest',
        avoidCongestion: request.avoidCongestion ?? true,
        destinationEntityId: request.destinationEntityId ?? (destEntity ? destEntity.id : undefined),
        maxSpeedKmh: vehicle.entity.truckDefinition.specs?.maxSpeedKmh ?? 80,
      }
    );

    if (!routePlan.success || routePlan.waypoints.length === 0) {
      return {
        success: false,
        error: routePlan.message || 'No continuous road connection to target destination.',
      };
    }

    // 3. Extract cell path from route plan
    const cellPath: Array<{ x: number; z: number }> = [];
    for (const wp of routePlan.waypoints) {
      const g = this.gridSystem.worldToGrid(wp.x, wp.z);
      if (g) {
        if (cellPath.length === 0 || cellPath[cellPath.length - 1].x !== g.x || cellPath[cellPath.length - 1].z !== g.z) {
          cellPath.push(g);
        }
      }
    }

    // 4. Generate lane-accurate 3D trajectory
    const laneWaypoints = TrafficLanePathGenerator.generateLaneTrajectory(
      cellPath,
      this.roadModel,
      this.gridSystem,
      {
        depotBayIndex: vehicle.assignedBayIndex ?? 2,
        isDepartingDepot: isAtDepot,
        isArrivingDepot: false,
      }
    );

    if (laneWaypoints.length === 0) {
      return { success: false, error: 'Failed to generate lane-disciplined trajectory.' };
    }

    // 5. Update vehicle state
    vehicle.waypoints = laneWaypoints;
    vehicle.currentWaypointIndex = 0;
    vehicle.state = isAtDepot ? 'pulling_out_depot' : 'cruising';
    vehicle.destinationName = request.destinationName;
    vehicle.targetGridX = targetGX;
    vehicle.targetGridZ = targetGZ;
    vehicle.isReturnTrip = false;
    vehicle.distanceTraveledMeters = 0;
    vehicle.waitTimeSeconds = 0;
    vehicle.stationaryTimeSeconds = 0;
    vehicle.blockageCause = undefined;
    vehicle.lastRerouteTimestampMs = 0;
    vehicle.totalDistanceMeters = routePlan.totalDistanceMeters;
    vehicle.estimatedTravelTimeSeconds = routePlan.estimatedTravelTimeSeconds;
    vehicle.criterion = request.criterion ?? 'fastest';
    if (targetAccessPoint) {
      vehicle.accessPoint = targetAccessPoint;
    }
    vehicle.entity.setHeadlights(true);
    vehicle.entity.setHazardLights(false);
    vehicle.entity.setBrakeLights(false);

    // Free facility bay while en route
    if (isAtDepot) {
      this.facilityManager.releaseVehicleFromAllFacilities(request.vehicleId);
    }

    globalEventBus.emit('dispatch:vehicle_dispatched', {
      vehicleId: request.vehicleId,
      destinationName: request.destinationName,
      waypointsCount: laneWaypoints.length,
      estimatedDistanceMeters: routePlan.totalDistanceMeters,
      estimatedTravelTimeSeconds: routePlan.estimatedTravelTimeSeconds,
      criterion: request.criterion ?? 'fastest',
      accessPoint: targetAccessPoint,
    });

    return { success: true };
  }

  /**
   * Orders an en-route vehicle to return to its home depot
   */
  public returnVehicleToDepot(vehicleId: string): { success: boolean; error?: string } {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return { success: false, error: `Vehicle '${vehicleId}' not found.` };

    const currentG = this.gridSystem.worldToGrid(vehicle.entity.group.position.x, vehicle.entity.group.position.z) ?? {
      x: vehicle.entity.gridX,
      z: vehicle.entity.gridZ,
    };

    // Route to Starter Depot spur entrance at (11, 14)
    const routePlan = this.pathfinding.planRoute(currentG.x, currentG.z, 11, 14, 'road');
    if (!routePlan.success) {
      return { success: false, error: 'Cannot find return road route to depot.' };
    }

    const cellPath: Array<{ x: number; z: number }> = [];
    for (const wp of routePlan.waypoints) {
      const g = this.gridSystem.worldToGrid(wp.x, wp.z);
      if (g) {
        if (cellPath.length === 0 || cellPath[cellPath.length - 1].x !== g.x || cellPath[cellPath.length - 1].z !== g.z) {
          cellPath.push(g);
        }
      }
    }

    const laneWaypoints = TrafficLanePathGenerator.generateLaneTrajectory(
      cellPath,
      this.roadModel,
      this.gridSystem,
      {
        depotBayIndex: vehicle.assignedBayIndex ?? 2,
        isDepartingDepot: false,
        isArrivingDepot: true,
      }
    );

    vehicle.waypoints = laneWaypoints;
    vehicle.currentWaypointIndex = 0;
    vehicle.state = 'cruising';
    vehicle.isReturnTrip = true;
    vehicle.destinationName = 'Returning to Starter Depot';

    return { success: true };
  }

  /**
   * Main per-frame traffic simulation update loop
   */
  public update(deltaTime: number): void {
    if (deltaTime <= 0) return;
    const dt = Math.min(deltaTime, 0.1); // Clamp to prevent numerical explosion during pauses

    // 1. Update intersection signal cycles, queue timeouts, and deadlock breakers
    this.intersectionCoordinator.update(dt);

    // 2. Aggregate road traffic conditions across network (congestion, average speeds, blockages)
    this.congestionMonitor.update(dt, this.vehicles.values());

    // 3. Build spatial map of travelling vehicles to evaluate car-following headway
    const activeVehicles: SimulatedVehicleData[] = [];
    for (const v of this.vehicles.values()) {
      if (
        v.state === 'cruising' ||
        v.state === 'following_lead' ||
        v.state === 'approaching_junction' ||
        v.state === 'waiting_intersection' ||
        v.state === 'traversing_junction' ||
        v.state === 'pulling_out_depot' ||
        v.state === 'entering_depot' ||
        v.state === 'stopped_unreachable'
      ) {
        activeVehicles.push(v);
      }
    }

    // 4. Update each active vehicle
    for (const v of activeVehicles) {
      this.updateVehicleTraffic(v, activeVehicles, dt);
    }
  }

  /**
   * Updates an individual vehicle's car-following, intersection checks, and kinematics
   */
  private updateVehicleTraffic(
    v: SimulatedVehicleData,
    allVehicles: SimulatedVehicleData[],
    dt: number
  ): void {
    // If vehicle was stopped unreachable due to a temporary obstacle, periodically attempt recovery
    if (v.state === 'stopped_unreachable') {
      v.stationaryTimeSeconds += dt;
      if (v.stationaryTimeSeconds >= 8.0) {
        v.stationaryTimeSeconds = 0;
        this.attemptIntelligentReroute(v, 'no_route_forward');
      }
      return;
    }

    if (v.waypoints.length === 0 || v.currentWaypointIndex >= v.waypoints.length) {
      this.handleRouteFinished(v);
      return;
    }

    const currentWp = v.waypoints[v.currentWaypointIndex];
    const pos = v.entity.group.position;

    // Track stationary duration
    if (v.currentSpeedMs < 0.25) {
      v.stationaryTimeSeconds += dt;
    } else {
      v.stationaryTimeSeconds = Math.max(0, v.stationaryTimeSeconds - dt * 2.0);
      if (v.currentSpeedMs > 2.0 && v.stationaryTimeSeconds <= 0.5) {
        v.blockageCause = undefined;
      }
    }

    // Verify upcoming road segment is not marked unavailable or severed
    const curG = this.gridSystem.worldToGrid(currentWp.x, currentWp.z);
    if (curG && this.congestionMonitor.isRoadUnavailable(curG.x, curG.z)) {
      this.attemptIntelligentReroute(v, 'road_demolished');
      return;
    }

    // --- A. CAR-FOLLOWING MODEL (Intelligent Headway Control) ---
    let headwayGapMeters = Infinity;
    let leadSpeedMs = Infinity;

    for (const other of allVehicles) {
      if (other.vehicleId === v.vehicleId) continue;

      const dx = other.entity.group.position.x - pos.x;
      const dz = other.entity.group.position.z - pos.z;
      const dist = Math.hypot(dx, dz);

      // Check if other vehicle is in front (dot product with heading)
      const headingRad = (v.currentHeadingDeg * Math.PI) / 180;
      const fwdX = Math.sin(headingRad);
      const fwdZ = -Math.cos(headingRad);
      const dot = (dx * fwdX + dz * fwdZ) / (dist || 1);

      if (dot > 0.75 && dist < 25.0) {
        if (dist < headwayGapMeters) {
          headwayGapMeters = dist;
          leadSpeedMs = other.currentSpeedMs;
        }
      }
    }

    // --- B. INTERSECTION COORDINATION & STOP LINE HANDLING ---
    let isIntersectionBlocked = false;

    if (currentWp.isJunction && currentWp.junctionId) {
      const distToWp = Math.hypot(currentWp.x - pos.x, currentWp.z - pos.z);

      if (currentWp.isStopLine && distToWp < 6.0) {
        // Approaching stop line: check clearance
        const check = this.intersectionCoordinator.canEnterJunction(
          currentWp.junctionId,
          v.vehicleId,
          this.inferApproachDirection(currentWp.headingDegrees),
          this.inferApproachDirection(currentWp.headingDegrees),
          currentWp.roadType === 'highway_corridor' || currentWp.roadType === 'heavy_arterial'
        );

        if (!check.canEnter) {
          isIntersectionBlocked = true;
          v.state = 'waiting_intersection';
          v.waitTimeSeconds += dt;
          v.activeJunctionId = currentWp.junctionId;

          // Blockage escalation logic:
          if (v.waitTimeSeconds >= 8.0) {
            v.blockageCause = 'intersection_conflict';
          }
          if (v.waitTimeSeconds >= 12.0) {
            // Escalate to intersection coordinator deadlock resolution
            this.intersectionCoordinator.resolveJunctionDeadlock(currentWp.junctionId, v.vehicleId);
          }
          if (v.waitTimeSeconds >= 18.0) {
            // Attempt detour around jammed intersection
            this.attemptIntelligentReroute(v, 'intersection_conflict');
          }
        } else {
          // Clear to enter: reserve
          this.intersectionCoordinator.reserveJunction(
            currentWp.junctionId,
            v.vehicleId,
            this.inferApproachDirection(currentWp.headingDegrees),
            this.inferApproachDirection(currentWp.headingDegrees)
          );
          v.state = 'traversing_junction';
          v.activeJunctionId = currentWp.junctionId;
          v.waitTimeSeconds = 0;
          v.blockageCause = undefined;
        }
      } else if (!currentWp.isStopLine && v.activeJunctionId && distToWp < 2.0 && v.currentWaypointIndex >= v.waypoints.length - 2) {
        // Exiting junction
        this.intersectionCoordinator.releaseJunction(v.activeJunctionId, v.vehicleId);
        v.activeJunctionId = null;
        v.state = 'cruising';
      }
    }

    // --- C. SPEED SELECTION & ACCELERATION / BRAKING ---
    const wpSpeedMs = (currentWp.speedLimitKmh * 1000) / 3600;
    let targetSpeedMs = wpSpeedMs;

    if (isIntersectionBlocked) {
      targetSpeedMs = 0.0;
    } else if (headwayGapMeters <= TrafficSimulationManager.STANDSTILL_GAP_METERS) {
      // Must stop behind leading vehicle
      targetSpeedMs = 0.0;
      v.state = 'following_lead';

      if (v.stationaryTimeSeconds >= 8.0) {
        v.blockageCause = 'lead_vehicle_standstill';
      }
      if (v.stationaryTimeSeconds >= 14.0) {
        // Attempt intelligent reroute if blocked behind a stationary vehicle
        this.attemptIntelligentReroute(v, 'lead_vehicle_standstill');
      }
    } else if (headwayGapMeters < 18.0) {
      // Smooth deceleration to match lead vehicle
      targetSpeedMs = Math.min(leadSpeedMs * 0.9, wpSpeedMs);
      v.state = 'following_lead';
    } else {
      if (v.state === 'following_lead') {
        v.state = 'cruising';
      }
    }

    v.targetSpeedMs = targetSpeedMs;

    // Apply acceleration / deceleration
    let accel = 0;
    if (v.currentSpeedMs < v.targetSpeedMs) {
      accel = Math.min(TrafficSimulationManager.MAX_ACCEL_MS2, (v.targetSpeedMs - v.currentSpeedMs) / dt);
      v.entity.setBrakeLights(false);
    } else if (v.currentSpeedMs > v.targetSpeedMs) {
      const brakeRate = targetSpeedMs === 0 ? TrafficSimulationManager.HARD_BRAKE_MS2 : TrafficSimulationManager.COMFORT_BRAKE_MS2;
      accel = -Math.min(brakeRate, (v.currentSpeedMs - v.targetSpeedMs) / dt);
      v.entity.setBrakeLights(true);
    } else {
      v.entity.setBrakeLights(false);
    }

    v.currentSpeedMs = Math.max(0, v.currentSpeedMs + accel * dt);
    const stepDist = v.currentSpeedMs * dt;

    // --- D. KINEMATIC ADVANCEMENT & WAYPOINT TRACKING ---
    if (stepDist > 0) {
      const toWpX = currentWp.x - pos.x;
      const toWpZ = currentWp.z - pos.z;
      const distToWp = Math.hypot(toWpX, toWpZ);

      if (distToWp <= Math.max(stepDist * 1.2, 0.45)) {
        // Advance to next waypoint
        v.currentWaypointIndex++;
        if (v.currentWaypointIndex < v.waypoints.length) {
          const nextWp = v.waypoints[v.currentWaypointIndex];
          pos.x = nextWp.x;
          pos.z = nextWp.z;
          v.currentElevation = nextWp.y;
        }
      } else {
        // Move towards current waypoint
        const normX = toWpX / distToWp;
        const normZ = toWpZ / distToWp;
        pos.x += normX * stepDist;
        pos.z += normZ * stepDist;

        // Smooth elevation transition
        v.currentElevation += (currentWp.y - v.currentElevation) * Math.min(1, 8.0 * dt);
      }

      v.distanceTraveledMeters += stepDist;
      v.entity.rollWheels(stepDist);

      // --- E. SMOOTH HEADING & ARTICULATION ROTATION ---
      const targetHeading = currentWp.headingDegrees;
      v.currentHeadingDeg = this.lerpAngleDegrees(v.currentHeadingDeg, targetHeading, Math.min(1, 7.5 * dt));

      // Steer angle based on heading delta
      const steerDeltaDeg = this.angleDeltaDegrees(v.currentHeadingDeg, targetHeading);
      const steerRad = (steerDeltaDeg * Math.PI) / 180;
      v.entity.setSteeringAngle(Math.max(-0.6, Math.min(0.6, steerRad * 1.5)));

      // Trailer hitch articulation physics:
      // dTheta/dt = (v / L) * sin(theta_cab - theta_trailer)
      const cabHeadingRad = (v.currentHeadingDeg * Math.PI) / 180;
      const trailerHeadingRad = (v.trailerHeadingDeg * Math.PI) / 180;
      const headingDiff = cabHeadingRad - trailerHeadingRad;
      const wheelbaseL = 7.5; // effective semi-trailer wheelbase
      const articulationSpeed = (v.currentSpeedMs / wheelbaseL) * Math.sin(headingDiff);

      v.trailerHeadingDeg += ((articulationSpeed * 180) / Math.PI) * dt;
      const articulationAngleRad = (v.trailerHeadingDeg - v.currentHeadingDeg) * (Math.PI / 180);
      v.entity.setArticulationAngle(articulationAngleRad);
    } else {
      v.entity.setSteeringAngle(0);
    }

    // Apply transform to vehicle group
    v.entity.group.position.set(pos.x, v.currentElevation, pos.z);
    v.entity.group.rotation.y = (v.currentHeadingDeg * Math.PI) / 180;

    // Hazard lights if blocked or waiting at intersection
    if (v.blockageCause !== undefined || isIntersectionBlocked) {
      v.entity.setHazardLights(true);
    } else {
      v.entity.setHazardLights(false);
    }
  }

  /**
   * Intelligently recalculates a route around a detected blockage or obstruction.
   * Enforces an 8-second cooldown between autonomous reroutes to prevent route flapping.
   */
  public attemptIntelligentReroute(v: SimulatedVehicleData, cause: BlockageCause): boolean {
    const now = Date.now();
    if (v.lastRerouteTimestampMs && now - v.lastRerouteTimestampMs < 8000) {
      return false; // In cooldown
    }

    const curG = this.gridSystem.worldToGrid(v.entity.group.position.x, v.entity.group.position.z) ?? {
      x: v.entity.gridX,
      z: v.entity.gridZ,
    };

    const targetGX = v.targetGridX ?? (v.isReturnTrip ? 11 : 23);
    const targetGZ = v.targetGridZ ?? (v.isReturnTrip ? 14 : 11);

    // If standing in an intersection, release reservation before computing detour
    if (v.activeJunctionId) {
      this.intersectionCoordinator.releaseJunction(v.activeJunctionId, v.vehicleId);
      v.activeJunctionId = null;
    }

    // Plan alternate route with congestion avoidance enabled
    const newRoute = this.pathfinding.planRoute(curG.x, curG.z, targetGX, targetGZ, 'road', {
      criterion: v.criterion ?? 'fastest',
      avoidCongestion: true,
      maxSpeedKmh: v.entity.truckDefinition?.specs?.maxSpeedKmh ?? 80,
    });

    if (newRoute.success && newRoute.waypoints.length > 0) {
      const cellPath: Array<{ x: number; z: number }> = [];
      for (const wp of newRoute.waypoints) {
        const g = this.gridSystem.worldToGrid(wp.x, wp.z);
        if (g && (cellPath.length === 0 || cellPath[cellPath.length - 1].x !== g.x || cellPath[cellPath.length - 1].z !== g.z)) {
          cellPath.push(g);
        }
      }

      const laneWps = TrafficLanePathGenerator.generateLaneTrajectory(cellPath, this.roadModel, this.gridSystem, {
        isArrivingDepot: v.isReturnTrip,
      });

      if (laneWps.length > 0) {
        v.waypoints = laneWps;
        v.currentWaypointIndex = 0;
        v.totalDistanceMeters = v.distanceTraveledMeters + newRoute.totalDistanceMeters;
        v.estimatedTravelTimeSeconds = newRoute.estimatedTravelTimeSeconds;
        v.lastRerouteTimestampMs = now;
        v.waitTimeSeconds = 0;
        v.stationaryTimeSeconds = 0;
        v.blockageCause = undefined;
        v.state = 'cruising';
        v.entity.setHazardLights(false);
        this.rerouteEventsCount++;

        globalEventBus.emit('traffic:vehicle_rerouted', {
          vehicleId: v.vehicleId,
          cause,
          newTotalDistance: v.totalDistanceMeters,
          timestamp: now,
        });

        return true;
      }
    }

    // No alternative road connection exists; safely pull over onto the road shoulder
    v.state = 'stopped_unreachable';
    v.blockageCause = cause;
    v.targetSpeedMs = 0;
    v.entity.setHazardLights(true);

    globalEventBus.emit('dispatch:route_obstructed', {
      vehicleId: v.vehicleId,
      cause,
      message: `Carrier ${v.vehicleId} stopped on shoulder: no viable alternate path (${cause}).`,
    });

    return false;
  }

  /**
   * Manual player command to force recalculation of carrier's route (detour)
   */
  public rerouteVehicle(vehicleId: string): { success: boolean; message: string } {
    const v = this.vehicles.get(vehicleId);
    if (!v) {
      return { success: false, message: `Carrier '${vehicleId}' not found.` };
    }
    if (v.state === 'idle_parked') {
      return { success: false, message: `Carrier '${vehicleId}' is currently parked at depot.` };
    }

    // Reset cooldown to respect player's manual command
    v.lastRerouteTimestampMs = 0;
    const ok = this.attemptIntelligentReroute(v, 'queue_timeout');
    if (ok) {
      return { success: true, message: `Carrier '${vehicleId}' successfully detoured around congestion.` };
    } else {
      return { success: false, message: `Unable to find viable detour route for carrier '${vehicleId}'.` };
    }
  }

  /**
   * Handles completion of vehicle route (arrival at destination or depot parking)
   */
  private handleRouteFinished(v: SimulatedVehicleData): void {
    if (v.activeJunctionId) {
      this.intersectionCoordinator.releaseJunction(v.activeJunctionId, v.vehicleId);
      v.activeJunctionId = null;
    }

    v.currentSpeedMs = 0;
    v.targetSpeedMs = 0;
    v.entity.setBrakeLights(false);
    v.entity.setHazardLights(false);

    if (v.isReturnTrip || v.destinationName.includes('Starter Depot')) {
      v.state = 'idle_parked';
      const bayIdx = v.assignedBayIndex ?? 2;
      const bay = TrafficLanePathGenerator.STARTER_DEPOT_BAYS[bayIdx] ?? TrafficLanePathGenerator.STARTER_DEPOT_BAYS[2];
      v.entity.group.position.set(bay.x, bay.y, bay.z);
      v.entity.group.rotation.y = (bay.heading * Math.PI) / 180;
      v.currentHeadingDeg = bay.heading;
      v.trailerHeadingDeg = bay.heading;
      v.entity.setArticulationAngle(0);

      // Re-register in Starter Depot facility
      this.facilityManager.assignVehicleToPrimaryDepot(v.vehicleId, 'prime_mover_6x4');

      globalEventBus.emit('dispatch:vehicle_returned', {
        vehicleId: v.vehicleId,
        facilityId: 'facility_truck_depot_01',
        bayIndex: bayIdx,
        timestamp: Date.now(),
      });
    } else {
      // Reached outward destination
      v.state = 'parking';
      globalEventBus.emit('dispatch:journey_completed', {
        vehicleId: v.vehicleId,
        destinationName: v.destinationName,
        totalDistanceMeters: v.distanceTraveledMeters,
      });

      // Automatically return after a short delivery pause (3 seconds)
      setTimeout(() => {
        if (this.vehicles.has(v.vehicleId)) {
          this.returnVehicleToDepot(v.vehicleId);
        }
      }, 3000);
    }
  }

  /**
   * Responds dynamically when the player extends or alters the road network.
   * Recalculates affected active routes safely without crashes or teleportation.
   */
  public handleRoadNetworkChanged(affectedCells?: Array<{ x: number; z: number }>): void {
    this.rerouteEventsCount++;
    this.pathfinding.invalidateCache('road');

    // Register any newly created road junctions
    for (const cell of this.roadModel.getAllRoadCells()) {
      if (
        cell.junctionType === 'crossroad' ||
        cell.junctionType === 't_junction' ||
        cell.junctionType === 'roundabout' ||
        cell.junctionType.startsWith('corner_')
      ) {
        this.intersectionCoordinator.registerJunction(cell.gridX, cell.gridZ, cell.junctionType);
      }
    }

    // Inspect active vehicles
    for (const v of this.vehicles.values()) {
      if (v.state === 'cruising' || v.state === 'following_lead' || v.state === 'approaching_junction') {
        const remainingWps = v.waypoints.slice(v.currentWaypointIndex);
        let pathIsBroken = false;

        if (affectedCells && affectedCells.length > 0) {
          for (const wp of remainingWps) {
            const g = this.gridSystem.worldToGrid(wp.x, wp.z);
            if (
              g &&
              affectedCells.some(
                (c) => c.x === g.x && ((c as any).z !== undefined ? (c as any).z === g.z : (c as any).y === g.z)
              )
            ) {
              pathIsBroken = true;
              break;
            }
          }
        }

        if (pathIsBroken) {
          // Recalculate route safely from current location to target using established criterion
          const curG = this.gridSystem.worldToGrid(v.entity.group.position.x, v.entity.group.position.z) ?? {
            x: v.entity.gridX,
            z: v.entity.gridZ,
          };
          const targetGX = v.targetGridX ?? 11;
          const targetGZ = v.targetGridZ ?? 14;

          const newRoute = this.pathfinding.planRoute(curG.x, curG.z, targetGX, targetGZ, 'road', {
            criterion: v.criterion ?? 'fastest',
            maxSpeedKmh: v.entity.truckDefinition?.specs?.maxSpeedKmh ?? 80,
          });

          if (newRoute.success && newRoute.waypoints.length > 0) {
            const cellPath: Array<{ x: number; z: number }> = [];
            for (const wp of newRoute.waypoints) {
              const g = this.gridSystem.worldToGrid(wp.x, wp.z);
              if (g && (cellPath.length === 0 || cellPath[cellPath.length - 1].x !== g.x || cellPath[cellPath.length - 1].z !== g.z)) {
                cellPath.push(g);
              }
            }
            v.waypoints = TrafficLanePathGenerator.generateLaneTrajectory(cellPath, this.roadModel, this.gridSystem, {
              isArrivingDepot: v.isReturnTrip,
            });
            v.currentWaypointIndex = 0;
            v.totalDistanceMeters = newRoute.totalDistanceMeters;
            v.estimatedTravelTimeSeconds = newRoute.estimatedTravelTimeSeconds;
            v.state = 'cruising';
          } else {
            // Target is genuinely unreachable: pull over safely
            v.state = 'stopped_unreachable';
            v.targetSpeedMs = 0;
            v.entity.setHazardLights(true);
            globalEventBus.emit('dispatch:route_obstructed', {
              vehicleId: v.vehicleId,
              message: 'Route disconnected by road network demolition. Vehicle safely stopped on shoulder.',
            });
          }
        }
      }
    }
  }

  public getDiagnosticsSummary(): TrafficDiagnosticsSummary {
    let cruising = 0;
    let following = 0;
    let waiting = 0;
    let parked = 0;
    let totalSpeedKmh = 0;
    let speedSamples = 0;

    for (const v of this.vehicles.values()) {
      if (v.state === 'cruising' || v.state === 'traversing_junction') cruising++;
      else if (v.state === 'following_lead') following++;
      else if (v.state === 'waiting_intersection') waiting++;
      else if (v.state === 'idle_parked') parked++;

      const speedKmh = (v.currentSpeedMs * 3600) / 1000;
      totalSpeedKmh += speedKmh;
      speedSamples++;
    }

    return {
      activeSimulatedVehicles: this.vehicles.size,
      vehiclesCruising: cruising,
      vehiclesFollowing: following,
      vehiclesWaitingIntersection: waiting,
      vehiclesParkedInDepot: parked,
      activeJunctionReservations: this.intersectionCoordinator.getAllJunctions().filter((j) => j.activeReservation !== null).length,
      deadlocksDetectedAndResolved: this.intersectionCoordinator.getDeadlockCount(),
      rerouteEventsCount: this.rerouteEventsCount,
      averageFleetSpeedKmh: speedSamples > 0 ? Math.round(totalSpeedKmh / speedSamples) : 0,
    };
  }

  public getSimulatedVehicle(vehicleId: string): SimulatedVehicleData | undefined {
    return this.vehicles.get(vehicleId);
  }

  private inferApproachDirection(headingDeg: number): 'north' | 'south' | 'east' | 'west' {
    const norm = ((headingDeg % 360) + 360) % 360;
    if (norm >= 315 || norm < 45) return 'south'; // moving North approaches from South
    if (norm >= 45 && norm < 135) return 'west'; // moving East approaches from West
    if (norm >= 135 && norm < 225) return 'north'; // moving South approaches from North
    return 'east'; // moving West approaches from East
  }

  private lerpAngleDegrees(current: number, target: number, t: number): number {
    const diff = this.angleDeltaDegrees(current, target);
    return current + diff * t;
  }

  private angleDeltaDegrees(from: number, to: number): number {
    let diff = ((to - from + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  public getDiagnostics(): TrafficDiagnosticsSummary {
    return this.getDiagnosticsSummary();
  }

  public getVehicleState(vehicleId: string): SimulatedVehicleData | undefined {
    return this.vehicles.get(vehicleId);
  }

  /**
   * Retrieves comprehensive real-time route progress, operational state,
   * distance remaining, and waypoints for the specified vehicle.
   */
  public getVehicleRouteProgress(vehicleId: string): VehicleRouteProgressInfo | null {
    const v = this.vehicles.get(vehicleId);
    if (!v) return null;

    const hasActiveRoute =
      v.waypoints.length > 0 &&
      v.currentWaypointIndex < v.waypoints.length &&
      v.state !== 'idle_parked';

    let operationalStatus: OperationalStateBadge = 'Available';
    switch (v.state) {
      case 'idle_parked':
        operationalStatus = 'Available';
        break;
      case 'pulling_out_depot':
        operationalStatus = 'Preparing Departure';
        break;
      case 'cruising':
      case 'approaching_junction':
      case 'traversing_junction':
      case 'rerouting':
      case 'offscreen_transit':
        operationalStatus = v.isReturnTrip ? 'Returning to Depot' : 'Travelling';
        break;
      case 'following_lead':
        operationalStatus = 'Temporarily Blocked';
        break;
      case 'waiting_intersection':
        operationalStatus = 'Waiting at Intersection';
        break;
      case 'parking':
        operationalStatus = v.isReturnTrip ? 'Available' : 'Arrived at Destination';
        break;
      case 'entering_depot':
        operationalStatus = 'Returning to Depot';
        break;
      case 'stopped_unreachable':
        operationalStatus = 'Route Blocked';
        break;
    }

    const totalDist = v.totalDistanceMeters > 0 ? v.totalDistanceMeters : 1;
    let distTraveled = v.distanceTraveledMeters;
    let distRemaining = Math.max(0, totalDist - distTraveled);
    let progress = 0;

    if (v.state === 'parking' || (v.state === 'idle_parked' && v.isReturnTrip)) {
      progress = 100;
      distRemaining = 0;
    } else if (hasActiveRoute) {
      progress = Math.min(99, Math.max(0, Math.round((distTraveled / totalDist) * 100)));
    }

    const totalEta = v.estimatedTravelTimeSeconds ?? Math.max(5, Math.round(totalDist / 12));
    const etaRemaining =
      progress >= 100
        ? 0
        : Math.max(1, Math.round(totalEta * ((100 - progress) / 100)));

    const remainingWps: Array<{ x: number; y: number; z: number }> = [];
    if (hasActiveRoute) {
      for (let i = v.currentWaypointIndex; i < v.waypoints.length; i++) {
        const wp = v.waypoints[i];
        remainingWps.push({ x: wp.x, y: wp.y, z: wp.z });
      }
    }

    const curSpeedLimit = v.waypoints[v.currentWaypointIndex]?.speedLimitKmh ?? 60;

    // Evaluate congestion level and delay on current segment
    const curG = this.gridSystem.worldToGrid(v.entity.group.position.x, v.entity.group.position.z);
    const congestionLevel: RoadCongestionState = curG
      ? this.congestionMonitor.getConditionAt(curG.x, curG.z)
      : 'free_flowing';

    const delaySec = Math.round(v.waitTimeSeconds + v.stationaryTimeSeconds);

    return {
      vehicleId,
      state: v.state,
      operationalStatus,
      destinationName: v.destinationName || 'Depot Bay',
      hasActiveRoute,
      totalDistanceMeters: Math.round(totalDist),
      distanceTraveledMeters: Math.round(distTraveled),
      distanceRemainingMeters: Math.round(distRemaining),
      progressPercent: progress,
      estimatedTimeRemainingSeconds: etaRemaining,
      currentSpeedKmh: Math.round(v.currentSpeedMs * 3.6),
      speedLimitKmh: curSpeedLimit,
      isReturnTrip: v.isReturnTrip,
      criterion: v.criterion,
      accessPoint: v.accessPoint,
      remainingWaypoints: remainingWps,
      congestionLevel,
      blockageReason: v.blockageCause,
      delaySeconds: delaySec > 1 ? delaySec : undefined,
    };
  }

  public dispose(): void {
    this.vehicles.clear();
    this.intersectionCoordinator.clear();
  }
}
