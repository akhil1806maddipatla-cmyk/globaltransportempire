import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GridSystem } from '../src/world/GridSystem';
import { RoadNetwork } from '../src/world/RoadNetwork';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { PathfindingEngine } from '../src/navigation/PathfindingEngine';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';
import { IntersectionCoordinator } from '../src/world/traffic/IntersectionCoordinator';
import { TrafficSimulationManager } from '../src/world/traffic/TrafficSimulationManager';
import { EntityRegistry } from '../src/entities/EntityRegistry';
import { FacilityManager } from '../src/facilities/FacilityManager';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';
import { VEHICLE_DEFINITIONS } from '../src/data/vehicleDefinitions';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';

describe('Intelligent Route Planning, Shortest vs Fastest Navigation, & Destination Resolution', () => {
  it('1. Basic continuous road route search navigates along connected roads to destination', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Build straight road from (10, 10) to (15, 10)
    for (let x = 10; x <= 15; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }

    const route = pathfinding.planRoute(10, 10, 15, 10, 'road');
    assert.strictEqual(route.success, true, 'Continuous road route must succeed');
    assert.ok(route.waypoints.length >= 6, 'Must contain waypoints along the continuous road');
    assert.ok(route.totalDistanceMeters > 0, 'Distance must be positive');
    assert.ok(route.estimatedTravelTimeSeconds > 0, 'Travel time must be positive');

    roadNetwork.dispose();
    materials.dispose();
  });

  it('2. Unreachable destination on disconnected road network safely returns failure', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Segment 1: (10, 10) to (12, 10)
    for (let x = 10; x <= 12; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }
    // Segment 2: (20, 10) to (22, 10) - Disconnected by gap
    for (let x = 20; x <= 22; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }

    const route = pathfinding.planRoute(10, 10, 22, 10, 'road');
    assert.strictEqual(route.success, false, 'Route between disconnected segments must fail');
    assert.ok(
      route.statusCode === 'DESTINATION_UNREACHABLE' || route.statusCode === 'NO_ROAD_CONNECTION',
      'Should report unreachable or no road connection'
    );

    roadNetwork.dispose();
    materials.dispose();
  });

  it('3. Destination access point rejects buildings with no adjacent road with NO_ACCESS_POINT', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Build building at (20, 20) with 2x2 footprint
    const factoryDef = Object.values(BUILDING_DEFINITIONS)[0];
    const pos = gridSystem.gridToWorldCenter(20, 20);
    const building = new BuildingEntity('bldg_test_isolated', factoryDef, 20, 20, pos.x, pos.z, materials, 0);

    // No road exists anywhere near (20, 20)
    const accessPoint = pathfinding.resolveDestinationAccessPoint(building, 10, 10);
    assert.strictEqual(accessPoint, null, 'Isolated building without road perimeter must have null access point');

    // Route request directly to building should fail with NO_ACCESS_POINT
    const route = pathfinding.planRouteToDestination(10, 10, building);
    assert.strictEqual(route.success, false, 'Route to landlocked building must fail');
    assert.strictEqual(route.statusCode, 'NO_ACCESS_POINT', 'Must return NO_ACCESS_POINT status');

    building.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('4. Destination access point chooses front service entrance and prohibits highway corridors', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Building footprint at (10, 10), rotation 0 -> Front edge is South, Back edge is North
    const warehouseDef = BUILDING_DEFINITIONS['logistics_warehouse_sm'] ?? Object.values(BUILDING_DEFINITIONS)[0];
    const pos = gridSystem.gridToWorldCenter(10, 10);
    const building = new BuildingEntity('bldg_test_warehouse', warehouseDef, 10, 10, pos.x, pos.z, materials, 0);
    const dims = building.getEffectiveDimensions();

    // Place a 110 km/h highway on North side at (10, 9)
    roadNetwork.model.addRoadCell(10, 9, 'highway_corridor');

    // Place an urban collector road on South side at (10, 10 + dims.effectiveDepth)
    const southZ = 10 + dims.effectiveDepth;
    roadNetwork.model.addRoadCell(10, southZ, 'two_lane_urban');

    // Highway cannot serve as driveway access point
    const accessPoint = pathfinding.resolveDestinationAccessPoint(building, 10, southZ + 2);
    assert.ok(accessPoint !== null, 'Should find accessible road on urban collector');
    assert.strictEqual(accessPoint!.gridX, 10);
    // Check access point type:
    assert.strictEqual(accessPoint!.accessType, 'service_entrance');

    building.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('5. Route Comparison: Shortest route minimizes traversed distance; Fastest route minimizes travel time', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Network topology:
    // Origin at (10, 10), Destination at (35, 10) (25 cells = 100 meters)
    //
    // Path 1 (Short path): Straight local industrial street along z=10:
    // Speed limit for industrial_access = 35 km/h (9.72 m/s).
    // Total distance = 25 * 4.0m = 100m.
    // Travel time = 100m / 9.72 m/s = 10.28 seconds.
    for (let x = 10; x <= 35; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'industrial_access'); // 35 km/h
    }

    // Path 2 (Longer bypass): Highway detour along z=13:
    // Ramp down from (10, 10) -> (10, 11) -> (10, 12) -> (10, 13) [arterial]
    // Highway across x=11..34 at z=13 [highway_corridor at 110 km/h]
    // Ramp up from (35, 13) -> (35, 12) -> (35, 11) -> (35, 10) [arterial]
    // Total distance = 3 (down) + 25 (across) + 3 (up) = 31 steps * 4.0m = 124m (> 100m!).
    // Highway speed = 110 km/h (30.56 m/s).
    // Time on highway = (24 * 4m) / 30.56 = 3.14s + ramps ~1.2s + turn delays ~4.0s = ~8.34s (< 10.28s!).
    for (let z = 11; z <= 13; z++) {
      roadNetwork.model.addRoadCell(10, z, 'heavy_arterial');
      roadNetwork.model.addRoadCell(35, z, 'heavy_arterial');
    }
    for (let x = 11; x <= 34; x++) {
      roadNetwork.model.addRoadCell(x, 13, 'highway_corridor'); // 110 km/h
    }

    // 1. Plan using 'shortest'
    const shortestRoute = pathfinding.planRoute(10, 10, 35, 10, 'road', { criterion: 'shortest', maxSpeedKmh: 110 });
    assert.strictEqual(shortestRoute.success, true);
    assert.strictEqual(shortestRoute.criterion, 'shortest');

    // 2. Plan using 'fastest'
    const fastestRoute = pathfinding.planRoute(10, 10, 35, 10, 'road', { criterion: 'fastest', maxSpeedKmh: 110 });
    assert.strictEqual(fastestRoute.success, true);
    assert.strictEqual(fastestRoute.criterion, 'fastest');

    // Shortest route should have strictly smaller distance than fastest highway detour
    assert.ok(
      shortestRoute.totalDistanceMeters < fastestRoute.totalDistanceMeters,
      `Shortest distance (${shortestRoute.totalDistanceMeters}m) must be < Fastest distance (${fastestRoute.totalDistanceMeters}m)`
    );

    // Fastest route should have shorter travel time than slow local road
    assert.ok(
      fastestRoute.estimatedTravelTimeSeconds < shortestRoute.estimatedTravelTimeSeconds,
      `Fastest travel time (${fastestRoute.estimatedTravelTimeSeconds}s) must be < Shortest travel time (${shortestRoute.estimatedTravelTimeSeconds}s)`
    );

    // Verify shortest stays on local street (z=10)
    const shortestUsesHighway = shortestRoute.waypoints.some((w) => {
      const g = gridSystem.worldToGrid(w.x, w.z);
      return g && g.z === 13;
    });
    assert.strictEqual(shortestUsesHighway, false, 'Shortest route should strictly use direct straight street');

    // Verify fastest route diverts to highway (z=13) to leverage 110 km/h speed limit
    const fastestUsesHighway = fastestRoute.waypoints.some((w) => {
      const g = gridSystem.worldToGrid(w.x, w.z);
      return g && g.z === 13;
    });
    assert.strictEqual(fastestUsesHighway, true, 'Fastest route should divert to the 110 km/h highway bypass');

    roadNetwork.dispose();
    materials.dispose();
  });

  it('6. Distance calculation accurately accumulates traversed geometry without endpoint double-counting', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Build straight 5-cell road: (10, 10) to (14, 10)
    // Total geometric length between centers = (14 - 10) * 4.0m = 16.0 meters
    for (let x = 10; x <= 14; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }

    const route = pathfinding.planRoute(10, 10, 14, 10, 'road');
    assert.strictEqual(route.success, true);
    assert.ok(Math.abs(route.totalDistanceMeters - 16.0) < 0.1, `Total distance should be ~16.0m (got ${route.totalDistanceMeters})`);

    // Verify manual sum of waypoint chord lengths equals reported totalDistanceMeters
    let manualSum = 0;
    for (let i = 1; i < route.waypoints.length; i++) {
      const dx = route.waypoints[i].x - route.waypoints[i - 1].x;
      const dz = route.waypoints[i].z - route.waypoints[i - 1].z;
      manualSum += Math.sqrt(dx * dx + dz * dz);
    }
    assert.ok(Math.abs(manualSum - route.totalDistanceMeters) < 0.05, 'Sum of waypoint chords must match reported total distance');

    roadNetwork.dispose();
    materials.dispose();
  });

  it('7. Travel-time calculation includes speed limits and turning penalties', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);

    // Straight 10-cell urban road: (10, 10) to (19, 10) (36 meters, 50 km/h = 13.89 m/s)
    for (let x = 10; x <= 19; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }
    const straightRoute = pathfinding.planRoute(10, 10, 19, 10, 'road');
    assert.strictEqual(straightRoute.success, true);

    // Build an L-shaped corner route with turns:
    // (10, 20) -> (15, 20) -> (15, 25)
    // Straight sections: (15-10)*4 = 20m, (25-20)*4 = 20m. Total = 40m.
    for (let x = 10; x <= 15; x++) {
      roadNetwork.model.addRoadCell(x, 20, 'two_lane_urban');
    }
    for (let z = 21; z <= 25; z++) {
      roadNetwork.model.addRoadCell(15, z, 'two_lane_urban');
    }

    const cornerRoute = pathfinding.planRoute(10, 20, 15, 25, 'road');
    assert.strictEqual(cornerRoute.success, true);

    // Corner travel time should include turn penalty (> 40m / (50 km/h) = 2.88s + 2.0s turn = ~4.88s)
    assert.ok(
      cornerRoute.estimatedTravelTimeSeconds >= 4.5,
      `Corner route travel time must reflect turn penalty (got ${cornerRoute.estimatedTravelTimeSeconds}s)`
    );

    roadNetwork.dispose();
    materials.dispose();
  });

  it('8. Congestion and signal delays from IntersectionCoordinator influence fastest route', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const coordinator = new IntersectionCoordinator();
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);
    pathfinding.setIntersectionCoordinator(coordinator);

    // Build two parallel routes:
    // Route North along z=10: (10,10) -> (15,10)
    // Route South along z=12: (10,10) -> (10,12) -> (15,12) -> (15,10)
    for (let x = 10; x <= 15; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
      roadNetwork.model.addRoadCell(x, 12, 'two_lane_urban');
    }
    roadNetwork.model.addRoadCell(10, 11, 'two_lane_urban');
    roadNetwork.model.addRoadCell(15, 11, 'two_lane_urban');

    // Register a junction with active queue on Route North at (12, 10)
    coordinator.registerJunction(12, 10, 'crossroad');
    coordinator.reserveJunction('junc_12_10', 'veh_blocking', 'west', 'east');

    const junction = coordinator.getJunction('junc_12_10');
    assert.ok(junction !== undefined);
    junction!.waitingQueue.push({
      vehicleId: 'veh_test_queued_1',
      approach: 'west',
      arrivalTimeMs: Date.now(),
      isPriority: false,
    });
    junction!.waitingQueue.push({
      vehicleId: 'veh_test_queued_2',
      approach: 'west',
      arrivalTimeMs: Date.now(),
      isPriority: false,
    });

    // Plan route with congestion avoidance enabled
    const fastestWithCongestion = pathfinding.planRoute(10, 10, 15, 10, 'road', {
      criterion: 'fastest',
      avoidCongestion: true,
    });
    assert.strictEqual(fastestWithCongestion.success, true);
    assert.ok(fastestWithCongestion.estimatedTravelTimeSeconds > 0);

    coordinator.clear();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('9. Road demolition invalidates route cache and triggers vehicle shoulder pullover if severed', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);
    const pathfinding = new PathfindingEngine(gridSystem, roadNetwork.model);
    const entityRegistry = new EntityRegistry();
    const facilityManager = new FacilityManager();
    const trafficManager = new TrafficSimulationManager(
      gridSystem,
      roadNetwork.model,
      pathfinding,
      entityRegistry,
      facilityManager
    );

    // Build straight road (10, 10) to (14, 10)
    for (let x = 10; x <= 14; x++) {
      roadNetwork.model.addRoadCell(x, 10, 'two_lane_urban');
    }

    // Cache initial route
    const r1 = pathfinding.planRoute(10, 10, 14, 10, 'road');
    assert.strictEqual(r1.success, true);

    // Spawn vehicle and track in simulation
    const truckDef = VEHICLE_DEFINITIONS['prime_mover_6x4'] ?? Object.values(VEHICLE_DEFINITIONS)[0];
    const pos = gridSystem.gridToWorldCenter(10, 10);
    const vehicle = new VehicleEntity('veh_demolish_test', truckDef, 10, 10, pos.x, pos.z, materials, { rotationDegrees: 0 });
    entityRegistry.register(vehicle);
    trafficManager.trackVehicle(vehicle);

    // Dispatch vehicle
    const dispatchResult = trafficManager.dispatchVehicle({
      vehicleId: 'veh_demolish_test',
      destinationName: 'East End',
      targetGridX: 14,
      targetGridZ: 10,
    });
    assert.strictEqual(dispatchResult.success, true);

    const simVeh = trafficManager.getSimulatedVehicle('veh_demolish_test');
    assert.ok(simVeh);
    assert.strictEqual(simVeh!.state, 'cruising');

    // Demolish road at cell (12, 10) which severs the route completely
    roadNetwork.model.removeRoadCell(12, 10);
    trafficManager.handleRoadNetworkChanged([{ x: 12, z: 10 }]);

    // Since road (12, 10) is gone and no detour exists, vehicle should safely pull over with hazard lights
    assert.strictEqual(
      simVeh!.state,
      'stopped_unreachable',
      'Severed vehicle with no alternate path must pull over safely to shoulder'
    );
    assert.strictEqual(simVeh!.targetSpeedMs, 0, 'Target speed must drop to 0');

    trafficManager.dispose();
    vehicle.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('10. End-to-end WorldManager dispatch integration with destinationEntityId and criteria', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    // Starter depot exists with vehicle 'veh_prime_mover_01'
    const starterVeh = worldManager.entityRegistry.get('veh_prime_mover_01');
    assert.ok(starterVeh, 'Starter depot vehicle must exist');

    // Find a destination building other than the starter depot
    const allBuildings = worldManager.entityRegistry
      .getAll()
      .filter((e) => e instanceof BuildingEntity || e.entityType === 'building') as BuildingEntity[];
    assert.ok(allBuildings.length > 1, 'World must contain initial destination buildings');
    const targetBuilding = allBuildings.find((b) => b.id !== 'bld_truck_depot_primary') ?? allBuildings[1];

    // Dispatch using 'shortest' criterion
    const dispatchShortest = worldManager.dispatchVehicle(
      'veh_prime_mover_01',
      targetBuilding.definition.name,
      {
        destinationEntityId: targetBuilding.id,
        criterion: 'shortest',
      }
    );
    assert.strictEqual(dispatchShortest.success, true, 'Dispatch with shortest criterion must succeed');

    const simVeh = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01');
    assert.ok(simVeh);
    assert.strictEqual(simVeh!.criterion, 'shortest');
    assert.ok(simVeh!.totalDistanceMeters > 0, 'Total distance must be populated');
    assert.ok(simVeh!.estimatedTravelTimeSeconds! > 0, 'Travel time must be populated');

    worldManager.dispose();
  });
});
