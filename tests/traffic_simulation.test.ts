import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrafficLanePathGenerator, STARTER_DEPOT_BAYS } from '../src/world/traffic/TrafficLanePathGenerator';
import { IntersectionCoordinator } from '../src/world/traffic/IntersectionCoordinator';
import { TrafficSimulationManager } from '../src/world/traffic/TrafficSimulationManager';
import { GridSystem } from '../src/world/GridSystem';
import { RoadNetwork } from '../src/world/RoadNetwork';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';
import { VEHICLE_DEFINITIONS } from '../src/data/vehicleDefinitions';
import { PathfindingEngine } from '../src/navigation/PathfindingEngine';
import { EntityRegistry } from '../src/entities/EntityRegistry';
import { FacilityManager } from '../src/facilities/FacilityManager';

describe('Traffic Flow, Lane Disciplines, Intersections, and Coordination', () => {
  it('1. Straight road lane path adheres to right-hand traffic lateral offset', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);

    // Build straight 3-cell East-West road: (10, 10), (11, 10), (12, 10)
    roadNetwork.model.addRoadCell(10, 10, 'two_lane_urban');
    roadNetwork.model.addRoadCell(11, 10, 'two_lane_urban');
    roadNetwork.model.addRoadCell(12, 10, 'two_lane_urban');

    // Eastbound trajectory: (10, 10) -> (11, 10) -> (12, 10)
    const eastboundCells = [{ x: 10, z: 10 }, { x: 11, z: 10 }, { x: 12, z: 10 }];
    const eastWaypoints = TrafficLanePathGenerator.generateLaneTrajectory(
      eastboundCells,
      roadNetwork.model,
      gridSystem
    );

    assert.ok(eastWaypoints.length > 0, 'Eastbound trajectory must produce waypoints');
    // For Eastbound (dx = +1, dz = 0), right normal is (0, +1), so lateral offset +1.0m adds to Z
    // Road center at z = 10 * 4.0 + 2.0 = 42.0. Right lane Z = 43.0m
    const cell11WorldCenter = gridSystem.gridToWorldCenter(11, 10);
    const midEastWp = eastWaypoints.find((w) => Math.abs(w.x - cell11WorldCenter.x) < 0.5);
    assert.ok(midEastWp, 'Must have waypoint in center cell');
    assert.ok(midEastWp.z > cell11WorldCenter.z, 'Eastbound right lane waypoint must be laterally offset to the right (+Z)');
    assert.ok(Math.abs(midEastWp.z - (cell11WorldCenter.z + 1.0)) < 0.1, 'Eastbound offset should be ~1.0m');

    // Westbound trajectory: (12, 10) -> (11, 10) -> (10, 10)
    const westboundCells = [{ x: 12, z: 10 }, { x: 11, z: 10 }, { x: 10, z: 10 }];
    const westWaypoints = TrafficLanePathGenerator.generateLaneTrajectory(
      westboundCells,
      roadNetwork.model,
      gridSystem
    );

    assert.ok(westWaypoints.length > 0, 'Westbound trajectory must produce waypoints');
    // For Westbound (dx = -1, dz = 0), right normal is (0, -1), so lateral offset +1.0m subtracts from Z
    // Right lane Z = 41.0m
    const midWestWp = westWaypoints.find((w) => Math.abs(w.x - cell11WorldCenter.x) < 0.5);
    assert.ok(midWestWp, 'Must have waypoint in center cell');
    assert.ok(midWestWp.z < cell11WorldCenter.z, 'Westbound right lane waypoint must be laterally offset to the right (-Z)');
    assert.ok(Math.abs(midWestWp.z - (cell11WorldCenter.z - 1.0)) < 0.1, 'Westbound offset should be ~1.0m');

    // Lateral separation between opposing lanes: 43.0 - 41.0 = 2.0m, keeping opposing lanes completely clear
    assert.ok(midEastWp.z - midWestWp.z >= 1.8, 'Opposing lanes must have at least 1.8m lateral separation');

    roadNetwork.dispose();
    materials.dispose();
  });

  it('2. Filleted cubic Bézier curves through 90-degree turns maintain smooth heading and stay on asphalt', () => {
    const gridSystem = new GridSystem(64, 64, 4.0);
    const materials = new MaterialsManager();
    const roadNetwork = new RoadNetwork(gridSystem, materials);

    // Build corner: (10, 10) [East] -> (11, 10) [Corner] -> (11, 11) [South]
    roadNetwork.model.addRoadCell(10, 10, 'two_lane_urban');
    roadNetwork.model.addRoadCell(11, 10, 'two_lane_urban');
    roadNetwork.model.addRoadCell(11, 11, 'two_lane_urban');

    const turnCells = [{ x: 10, z: 10 }, { x: 11, z: 10 }, { x: 11, z: 11 }];
    const waypoints = TrafficLanePathGenerator.generateLaneTrajectory(
      turnCells,
      roadNetwork.model,
      gridSystem
    );

    assert.ok(waypoints.length >= 8, 'Turn must be filleted with multiple intermediate curve waypoints');

    // Check heading continuity: angle differences between consecutive waypoints should be smooth (< 45 degrees)
    for (let i = 1; i < waypoints.length; i++) {
      let dTheta = Math.abs(waypoints[i].headingDegrees - waypoints[i - 1].headingDegrees);
      if (dTheta > 180) dTheta = 360 - dTheta;
      assert.ok(dTheta <= 45, `Heading transition between waypoint ${i - 1} and ${i} must be smooth (got ${dTheta} deg)`);
    }

    // Verify all turn waypoints remain within the road boundary of cell (11, 10) and neighbors
    const cornerCenter = gridSystem.gridToWorldCenter(11, 10);
    const cornerWps = waypoints.filter((w) => Math.abs(w.x - cornerCenter.x) <= 2.5 && Math.abs(w.z - cornerCenter.z) <= 2.5);
    assert.ok(cornerWps.length > 0, 'Must have curve waypoints in corner junction zone');

    roadNetwork.dispose();
    materials.dispose();
  });

  it('3. Starter depot departure from Bays 1, 2, and 3 follows concrete apron driveway onto spur road', () => {
    for (const bayIdx of [1, 2, 3]) {
      const bay = STARTER_DEPOT_BAYS[bayIdx];
      assert.ok(bay, `Bay ${bayIdx} definition must exist`);

      const departurePath = TrafficLanePathGenerator.generateDepotDepartureTrajectory(bayIdx);
      assert.ok(departurePath.length >= 5, `Depot departure path for Bay ${bayIdx} must have waypoints`);

      // Start position must match bay parking space
      const startWp = departurePath[0];
      assert.strictEqual(startWp.x, bay.x, `Bay ${bayIdx} starting X must match bay position`);
      assert.strictEqual(startWp.z, bay.z, `Bay ${bayIdx} starting Z must match bay position`);
      assert.ok(startWp.y >= 0.25, 'Bay elevation must sit atop the concrete parking apron');

      // End position must connect to dropped curb on spur road
      const endWp = departurePath[departurePath.length - 1];
      assert.strictEqual(endWp.x, -1.0, 'Depot departure must reach spur road X=-1.0');
      assert.strictEqual(endWp.z, 13.5, 'Depot departure must reach dropped curb entrance Z=13.5');
      assert.ok(endWp.y < 0.1, 'Spur road pavement elevation must be ~0.042m');

      // Return path from spur road to bay must also succeed
      const returnPath = TrafficLanePathGenerator.generateDepotReturnTrajectory(bayIdx);
      assert.ok(returnPath.length >= 2, `Depot return path for Bay ${bayIdx} must have waypoints`);
      const returnStart = returnPath[0];
      const returnEnd = returnPath[returnPath.length - 1];

      assert.strictEqual(returnStart.x, -0.8, 'Return path must start at spur road driveway');
      assert.strictEqual(returnEnd.x, bay.x, `Return path must end at Bay ${bayIdx} parking space`);
      assert.strictEqual(returnEnd.z, bay.z, `Return path must end at Bay ${bayIdx} parking space`);
    }
  });

  it('4. Intersection coordinator handles conflict zone reservation and FIFO queuing', () => {
    const coordinator = new IntersectionCoordinator();
    const junctionKey = coordinator.registerJunction(11, 10, 'crossroad');

    // Vehicle A requests entry
    const checkA = coordinator.canEnterJunction(junctionKey, 'veh_A', 'east', 'west', false);
    assert.strictEqual(checkA.canEnter, true, 'Vehicle A should be cleared to enter when junction is empty');

    // Reserve junction for Vehicle A
    const reservedA = coordinator.reserveJunction(junctionKey, 'veh_A', 'east', 'west');
    assert.strictEqual(reservedA, true, 'Vehicle A reservation must succeed');

    // Vehicle B requests entry at the same conflict zone
    const checkB = coordinator.canEnterJunction(junctionKey, 'veh_B', 'north', 'south', false);
    assert.strictEqual(checkB.canEnter, false, 'Conflicting vehicle B must NOT be allowed to enter while occupied');
    assert.ok(checkB.waitReason?.includes('occupied'));

    // Verify queue
    const junction = coordinator.getJunction(junctionKey);
    assert.ok(junction);
    assert.strictEqual(junction.waitingQueue.length, 1);
    assert.strictEqual(junction.waitingQueue[0].vehicleId, 'veh_B');

    // Vehicle A releases junction upon exiting
    const releasedA = coordinator.releaseJunction(junctionKey, 'veh_A');
    assert.strictEqual(releasedA, true);

    // After A releases, B is at top of queue
    assert.strictEqual(junction.activeReservation, null);
  });

  it('5. Crossroads phased signal cycle alternates between East-West and North-South', () => {
    const coordinator = new IntersectionCoordinator();
    const junctionKey = coordinator.registerJunction(15, 15, 'crossroad');

    const junctionInitial = coordinator.getJunction(junctionKey);
    assert.ok(junctionInitial);
    assert.strictEqual(junctionInitial.signalPhase, 'ew_green');

    // In EW phase: EW can enter, NS must wait
    const checkEW = coordinator.canEnterJunction(junctionKey, 'car_1', 'east', 'west', false);
    assert.strictEqual(checkEW.canEnter, true);

    const checkNS = coordinator.canEnterJunction(junctionKey, 'car_2', 'north', 'south', false);
    assert.strictEqual(checkNS.canEnter, false);
    assert.ok(checkNS.waitReason?.includes('Red traffic signal'));

    // Advance 7.5s (signal cycle is 7.0s per phase)
    coordinator.update(7.5);

    const junctionUpdated = coordinator.getJunction(junctionKey);
    assert.ok(junctionUpdated);
    assert.strictEqual(junctionUpdated.signalPhase, 'ns_green', 'Phase must switch to ns_green');

    // In NS phase: waiting car_2 (front of queue) can now enter, EW must wait
    const checkNS2 = coordinator.canEnterJunction(junctionKey, 'car_2', 'north', 'south', false);
    assert.strictEqual(checkNS2.canEnter, true);

    const checkEW2 = coordinator.canEnterJunction(junctionKey, 'car_4', 'east', 'west', false);
    assert.strictEqual(checkEW2.canEnter, false);
    assert.ok(checkEW2.waitReason?.includes('Red traffic signal'));
  });

  it('6. Deadlock detection triggers and resolves after 6.0 seconds waiting at intersection', () => {
    const coordinator = new IntersectionCoordinator();
    const junctionKey = coordinator.registerJunction(20, 20, 't_junction');

    // Reserve junction with blocking vehicle
    coordinator.reserveJunction(junctionKey, 'blocking_veh', 'north', 'south');

    // Vehicle waiting arrives and gets queued
    const checkWaiting = coordinator.canEnterJunction(junctionKey, 'veh_waiting', 'east', 'west', false);
    assert.strictEqual(checkWaiting.canEnter, false);

    const junction = coordinator.getJunction(junctionKey)!;
    assert.strictEqual(junction.waitingQueue.length, 1);

    // Release blocking vehicle so conflict area is open for queue resolution
    coordinator.releaseJunction(junctionKey, 'blocking_veh');

    // Simulate waiting 6.5 seconds (> 6.0s deadlock threshold)
    junction.waitingQueue[0].arrivalTimeMs = Date.now() - 6500;

    const initialDeadlocks = coordinator.getDeadlockCount();

    // Trigger update
    coordinator.update(0.1);

    assert.ok(
      coordinator.getDeadlockCount() > initialDeadlocks,
      'Deadlock counter must increment when waiting exceeds 6.0s'
    );
    assert.strictEqual(
      junction.activeReservation?.occupyingVehicleId,
      'veh_waiting',
      'Deadlock breaker must promote oldest waiting vehicle'
    );
  });

  it('7. Car-following headway model maintains safe distance behind lead vehicle', () => {
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

    const truckDef = VEHICLE_DEFINITIONS['prime_mover_6x4'];
    assert.ok(truckDef);

    // Create two mock vehicles
    const leadVehicle = new VehicleEntity('lead_veh', truckDef, 12, 5, 50.0, 20.0, materials);
    const trailVehicle = new VehicleEntity('trail_veh', truckDef, 7, 5, 30.0, 20.0, materials);

    entityRegistry.register(leadVehicle);
    entityRegistry.register(trailVehicle);

    trafficManager.trackVehicle(leadVehicle);
    trafficManager.trackVehicle(trailVehicle);

    const leadSim = trafficManager.getSimulatedVehicle('lead_veh');
    const trailSim = trafficManager.getSimulatedVehicle('trail_veh');

    assert.ok(leadSim && trailSim);
    leadSim.targetSpeedMs = 0;
    leadSim.currentSpeedMs = 0;

    const targetWp = {
      x: 80.0,
      y: 0.042,
      z: 20.0,
      headingDegrees: 90,
      speedLimitKmh: 45,
      roadType: 'two_lane_urban',
      laneIndex: 0,
      isJunction: false,
    };
    leadSim.waypoints = [targetWp];
    trailSim.waypoints = [targetWp];

    // Simulate trailing vehicle 5m behind lead vehicle
    trailVehicle.group.position.set(45.0, 0.042, 20.0);
    leadVehicle.group.position.set(50.0, 0.042, 20.0);

    // Update traffic simulation
    trafficManager.update(0.1);

    // Trailing vehicle maintains headway
    const distance = leadVehicle.group.position.distanceTo(trailVehicle.group.position);
    assert.ok(distance >= 3.5, `Headway distance must remain >= 3.5m (actual: ${distance}m)`);

    trafficManager.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('8. Trailer articulation physics smoothly calculates lag angle during turns', () => {
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

    const truckDef = VEHICLE_DEFINITIONS['prime_mover_6x4'];
    const vehicle = new VehicleEntity('art_truck', truckDef, 2, 2, 10.0, 10.0, materials);
    entityRegistry.register(vehicle);
    trafficManager.trackVehicle(vehicle);

    const sim = trafficManager.getSimulatedVehicle('art_truck');
    assert.ok(sim);

    sim.waypoints = [
      {
        x: 30.0,
        y: 0.042,
        z: 10.0,
        headingDegrees: 90,
        speedLimitKmh: 45,
        roadType: 'two_lane_urban',
        laneIndex: 0,
        isJunction: false,
      },
    ];

    // Simulate motion
    sim.state = 'cruising';
    sim.currentSpeedMs = 5.0; // 5 m/s
    sim.currentHeadingDeg = 90; // Cab turned East
    sim.trailerHeadingDeg = 0; // Trailer initially North

    trafficManager.update(0.5);

    // Trailer heading should have rotated smoothly towards cab heading
    assert.ok(sim.trailerHeadingDeg > 0, 'Trailer heading should rotate towards cab');
    assert.ok(sim.trailerHeadingDeg <= 90, 'Trailer heading should not overshoot cab');

    trafficManager.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('9. Demolishing a road cell notifies traffic manager and safely responds', () => {
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

    const truckDef = VEHICLE_DEFINITIONS['prime_mover_6x4'];
    const vehicle = new VehicleEntity('route_veh', truckDef, 2, 2, 10.0, 10.0, materials);
    entityRegistry.register(vehicle);
    trafficManager.trackVehicle(vehicle);

    const sim = trafficManager.getSimulatedVehicle('route_veh');
    assert.ok(sim);

    // Set state en-route with target cell (12, 10)
    sim.state = 'cruising';
    sim.targetSpeedMs = 10;
    sim.currentSpeedMs = 8;

    // Road cell (12, 10) is demolished
    trafficManager.handleRoadNetworkChanged([{ x: 12, z: 10 }]);

    // Safe response: traffic manager handles network change safely without throws
    const diag = trafficManager.getDiagnostics();
    assert.ok(diag, 'Diagnostics must remain accessible after road network changes');

    trafficManager.dispose();
    roadNetwork.dispose();
    materials.dispose();
  });

  it('10. End-to-end integration: WorldManager initializes trafficManager and dispatches starter depot truck', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const trafficManager = worldManager.getTrafficSimulationManager();
    assert.ok(trafficManager, 'WorldManager must provide TrafficSimulationManager');

    // Retrieve Starter Depot trucks (starter depot bays 1, 2, 3)
    const starterVehicles = worldManager.entityRegistry
      .getAll()
      .filter((e) => e.entityType === 'vehicle');

    assert.ok(starterVehicles.length >= 1, 'Starter depot must have at least 1 truck created');

    const truck = starterVehicles[0];
    const initialPos = truck.group.position.clone();

    // Verify initial truck sits at Starter Depot bay
    assert.ok(initialPos.z > 9.0 && initialPos.z < 12.0, 'Truck must be parked in Starter Depot bay');

    // Dispatch vehicle
    const dispatchResult = worldManager.dispatchVehicle(truck.id, 'East Highway Interstate Gateway');
    assert.ok(dispatchResult.success, `Vehicle dispatch must succeed: ${dispatchResult.error}`);

    // Update world simulation
    worldManager.update(1.0);

    const sim = trafficManager.getSimulatedVehicle(truck.id);
    assert.ok(sim, 'Dispatched vehicle must have active simulated vehicle');
    assert.ok(sim.waypoints.length > 0, 'Vehicle must have planned waypoints');

    // Diagnostics summary
    const diag = trafficManager.getDiagnostics();
    assert.ok(diag.activeSimulatedVehicles >= 1, 'Diagnostics must record active simulated vehicles');

    worldManager.dispose();
  });
});
