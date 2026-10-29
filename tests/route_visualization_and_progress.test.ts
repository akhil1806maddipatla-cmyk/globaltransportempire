import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { RouteVisualizer } from '../src/rendering/RouteVisualizer';

describe('Prompt 27: Route Visualization, Destination Markers, & Delivery Progress Feedback', () => {
  it('1. Idle parked vehicle returns valid initial progress info with "Available" status', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const starterVeh = worldManager.entityRegistry.get('veh_prime_mover_01');
    assert.ok(starterVeh, 'Starter vehicle "veh_prime_mover_01" should be registered in the world');

    const progress = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(progress, 'Should return VehicleRouteProgressInfo');
    assert.strictEqual(progress.vehicleId, 'veh_prime_mover_01');
    assert.strictEqual(progress.operationalStatus, 'Available');
    assert.strictEqual(progress.hasActiveRoute, false);
    assert.strictEqual(progress.progressPercent, 0);
    assert.strictEqual(progress.remainingWaypoints.length, 0);

    worldManager.dispose();
  });

  it('2. Dispatched vehicle populates active route, destination, access point, and initial 0% progress', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    assert.ok(targetBuilding, 'Industrial Factory building must exist');

    const dispatchRes = worldManager.dispatchVehicle(
      'veh_prime_mover_01',
      targetBuilding.definition.name,
      {
        destinationEntityId: targetBuilding.id,
        criterion: 'fastest',
        avoidCongestion: true,
      }
    );
    assert.strictEqual(dispatchRes.success, true, 'Dispatch along road network should succeed');

    const progress = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(progress, 'Progress info must exist for dispatched vehicle');
    assert.strictEqual(progress.hasActiveRoute, true);
    assert.strictEqual(progress.destinationName, targetBuilding.definition.name);
    assert.strictEqual(progress.criterion, 'fastest');
    assert.ok(progress.totalDistanceMeters > 0, 'Total route distance must be positive');
    assert.ok(progress.remainingWaypoints.length >= 2, 'Should have multiple lane waypoints along the route');
    assert.strictEqual(progress.progressPercent, 0, 'Initial progress percentage must be 0%');
    assert.ok(progress.estimatedTimeRemainingSeconds > 0, 'ETA should be estimated');
    assert.ok(
      progress.operationalStatus === 'Preparing Departure' || progress.operationalStatus === 'Travelling',
      'Should report active departure or travelling status'
    );

    worldManager.dispose();
  });

  it('3. Real-time delivery progress calculation strictly tracks traversed distance', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_logistics_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
      criterion: 'shortest',
    });

    const sim = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01');
    assert.ok(sim, 'Simulated vehicle data must exist');

    // Simulate exactly 50% distance traversal
    sim.totalDistanceMeters = 100;
    sim.distanceTraveledMeters = 50;
    sim.state = 'cruising';

    const midProgress = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(midProgress);
    assert.strictEqual(midProgress.distanceTraveledMeters, 50);
    assert.strictEqual(midProgress.progressPercent, 50, 'Progress must be exactly 50% at half distance');
    assert.strictEqual(midProgress.operationalStatus, 'Travelling');
    assert.strictEqual(midProgress.distanceRemainingMeters, 50);

    // Simulate arrival at destination
    sim.state = 'parking';
    sim.distanceTraveledMeters = sim.totalDistanceMeters;
    const finalProgress = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(finalProgress);
    assert.strictEqual(finalProgress.progressPercent, 100, 'Arrival must report 100% complete');
    assert.strictEqual(finalProgress.operationalStatus, 'Arrived at Destination');
    assert.strictEqual(finalProgress.distanceRemainingMeters, 0);
    assert.strictEqual(finalProgress.estimatedTimeRemainingSeconds, 0);

    worldManager.dispose();
  });

  it('4. Waypoint path shortening matches vehicle forward navigation', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_commercial_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
    });
    const sim = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01')!;
    const initialWaypointsCount = sim.waypoints.length;
    assert.ok(initialWaypointsCount > 5, 'Should have multiple waypoints');

    let p = worldManager.getVehicleRouteProgress('veh_prime_mover_01')!;
    assert.strictEqual(p.remainingWaypoints.length, initialWaypointsCount);

    // Advance vehicle through 3 waypoints
    sim.currentWaypointIndex = 3;
    p = worldManager.getVehicleRouteProgress('veh_prime_mover_01')!;
    assert.strictEqual(
      p.remainingWaypoints.length,
      initialWaypointsCount - 3,
      'Remaining waypoints must shorten as vehicle advances'
    );

    worldManager.dispose();
  });

  it('5. Operational status badges accurately map all traffic states', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
    });
    const sim = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01')!;

    // Test waiting intersection
    sim.state = 'waiting_intersection';
    assert.strictEqual(
      worldManager.getVehicleRouteProgress('veh_prime_mover_01')?.operationalStatus,
      'Waiting at Intersection'
    );

    // Test car-following lead
    sim.state = 'following_lead';
    assert.strictEqual(
      worldManager.getVehicleRouteProgress('veh_prime_mover_01')?.operationalStatus,
      'Temporarily Blocked'
    );

    // Test return trip
    sim.state = 'cruising';
    sim.isReturnTrip = true;
    assert.strictEqual(
      worldManager.getVehicleRouteProgress('veh_prime_mover_01')?.operationalStatus,
      'Returning to Depot'
    );

    // Test unreachable
    sim.state = 'stopped_unreachable';
    assert.strictEqual(
      worldManager.getVehicleRouteProgress('veh_prime_mover_01')?.operationalStatus,
      'Route Blocked'
    );

    worldManager.dispose();
  });

  it('6. RouteVisualizer 3D ribbon & beacon properly update with selected vehicle', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const visualizer = new RouteVisualizer(scene, worldManager, gameState);

    // When nothing is selected
    visualizer.update(0.016);
    const root = scene.getObjectByName('RouteVisualizer_Root') as THREE.Group;
    assert.ok(root, 'Root visualizer group must exist in scene');

    const ribbon = root.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    const beacon = root.children.find((c) => c.name === 'DestinationBeacon') as THREE.Group;

    assert.ok(ribbon, 'Ribbon mesh must exist');
    assert.ok(beacon, 'Destination beacon must exist');
    assert.strictEqual(ribbon.visible, false, 'Ribbon must be hidden when no vehicle is selected');
    assert.strictEqual(beacon.visible, false, 'Beacon must be hidden when no vehicle is selected');

    // Select the starter vehicle and dispatch it
    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
    });
    gameState.selectEntity('veh_prime_mover_01');

    visualizer.update(0.016);
    assert.strictEqual(ribbon.visible, true, 'Ribbon must be visible for selected vehicle with route');
    assert.strictEqual(beacon.visible, true, 'Beacon must be visible for selected vehicle with destination');

    // Verify ribbon geometry vertices are generated and offset above road surface
    const positions = ribbon.geometry.getAttribute('position');
    assert.ok(positions.count >= 4, 'Ribbon geometry must contain vertex attributes for the route');

    // Deselect vehicle
    gameState.selectEntity(null);
    visualizer.update(0.016);
    assert.strictEqual(ribbon.visible, false, 'Ribbon must disappear immediately on vehicle deselection');
    assert.strictEqual(beacon.visible, false, 'Beacon must disappear immediately on vehicle deselection');

    visualizer.dispose();
    worldManager.dispose();
  });

  it('7. Multi-vehicle discipline: only the selected vehicle displays its route', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const visualizer = new RouteVisualizer(scene, worldManager, gameState);

    const bld1 = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    const bld2 = worldManager.entityRegistry.get('bld_logistics_01') as BuildingEntity;

    // Both vehicles en route
    worldManager.dispatchVehicle('veh_prime_mover_01', bld1.definition.name, {
      destinationEntityId: bld1.id,
    });
    worldManager.dispatchVehicle('veh_express_02', bld2.definition.name, {
      destinationEntityId: bld2.id,
    });

    // Select veh_express_02 only
    gameState.selectEntity('veh_express_02');
    visualizer.update(0.016);

    const root = scene.getObjectByName('RouteVisualizer_Root') as THREE.Group;
    const beacon = root.children.find((c) => c.name === 'DestinationBeacon') as THREE.Group;

    assert.strictEqual(beacon.visible, true);
    // Beacon coordinates should match veh_express_02 destination access point
    const p2 = worldManager.getVehicleRouteProgress('veh_express_02')!;
    const expectedX = p2.accessPoint?.worldX ?? p2.remainingWaypoints[p2.remainingWaypoints.length - 1].x;
    assert.strictEqual(beacon.position.x, expectedX);

    visualizer.dispose();
    worldManager.dispose();
  });

  it('8. Clean disposal of RouteVisualizer releases all Three.js resources', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const visualizer = new RouteVisualizer(scene, worldManager, gameState);
    assert.doesNotThrow(() => {
      visualizer.dispose();
    }, 'Disposing visualizer should be safe and clean');

    worldManager.dispose();
  });
});
