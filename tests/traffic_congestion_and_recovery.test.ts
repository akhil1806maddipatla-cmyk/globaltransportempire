import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { TrafficCongestionMonitor } from '../src/world/traffic/TrafficCongestionMonitor';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { GridSystem } from '../src/world/GridSystem';
import { IntersectionCoordinator } from '../src/world/traffic/IntersectionCoordinator';

describe('Prompt 28: Traffic Congestion Monitoring, Road Blockage Detection, and Intelligent Recovery', () => {
  it('1. Congestion monitor registers road network cells and defaults to free_flowing condition', () => {
    const gridSystem = new GridSystem();
    const roadModel = new RoadNetworkModel(gridSystem);
    roadModel.addRoadCell(10, 10, 'two_lane_urban');
    roadModel.addRoadCell(11, 10, 'two_lane_urban');

    const monitor = new TrafficCongestionMonitor(gridSystem, roadModel);
    assert.strictEqual(monitor.getConditionAt(10, 10), 'free_flowing');
    assert.strictEqual(monitor.getCongestionMultiplier(10, 10), 1.0);
    assert.strictEqual(monitor.isRoadUnavailable(10, 10), false);
  });

  it('2. Traffic conditions escalate from free_flowing to congested under high occupancy and low speed', () => {
    const gridSystem = new GridSystem();
    const roadModel = new RoadNetworkModel(gridSystem);
    roadModel.addRoadCell(10, 10, 'two_lane_urban');

    const monitor = new TrafficCongestionMonitor(gridSystem, roadModel);

    const worldPos = gridSystem.gridToWorldCenter(10, 10);
    // Simulated vehicle moving at only 1 m/s (3.6 km/h) in a 40 km/h zone
    const mockVehicle: any = {
      vehicleId: 'veh_test_01',
      entity: { group: { position: { x: worldPos.x, y: 0.04, z: worldPos.z } } },
      currentSpeedMs: 1.0,
      state: 'cruising',
    };

    // Update for 0.6s (first sample triggers pending transition)
    monitor.update(0.6, [mockVehicle]);
    // Allow hysteresis confirmation window (1.2s) to confirm state change
    monitor.update(1.3, [mockVehicle]);

    const cond = monitor.getConditionAt(10, 10);
    assert.ok(
      cond === 'busy' || cond === 'congested',
      `Condition should escalate to busy or congested, got ${cond}`
    );
    const multiplier = monitor.getCongestionMultiplier(10, 10);
    assert.ok(multiplier > 1.0, `Congestion multiplier (${multiplier}) should be greater than 1.0`);
  });

  it('3. Manual road closure marks segment unavailable and provides route avoidance', () => {
    const gridSystem = new GridSystem();
    const roadModel = new RoadNetworkModel(gridSystem);
    roadModel.addRoadCell(15, 15, 'heavy_arterial');

    const monitor = new TrafficCongestionMonitor(gridSystem, roadModel);
    monitor.markRoadUnavailable(15, 15, true, 'road_demolished');

    assert.strictEqual(monitor.isRoadUnavailable(15, 15), true);
    assert.strictEqual(monitor.getConditionAt(15, 15), 'unavailable');
    assert.ok(monitor.getCongestionMultiplier(15, 15) >= 10.0);

    // Unmark
    monitor.markRoadUnavailable(15, 15, false);
    assert.strictEqual(monitor.isRoadUnavailable(15, 15), false);
  });

  it('4. Intersection coordinator detects and resolves deadlocks exceeding threshold', () => {
    const coordinator = new IntersectionCoordinator();
    const juncId = coordinator.registerJunction(10, 10, 'crossroad');

    // Vehicle A reserves junction
    coordinator.reserveJunction(juncId, 'veh_A', 'north', 'south');
    const j1 = coordinator.getJunctionInfo(juncId);
    assert.strictEqual(j1?.activeReservation?.occupyingVehicleId, 'veh_A');

    // Simulate 9 seconds of elapsed time without clearance
    coordinator.update(9.0);

    // Vehicle B approaches and attempts entry
    const checkB = coordinator.canEnterJunction(juncId, 'veh_B', 'east', 'west');
    // Stale lock should either be broken automatically or resolvable via deadlock resolution
    if (!checkB.canEnter) {
      const resolved = coordinator.resolveJunctionDeadlock(juncId, 'veh_B');
      assert.strictEqual(resolved, true, 'Deadlock breaker must release stale reservation');
    }

    const j2 = coordinator.getJunctionInfo(juncId);
    assert.notStrictEqual(j2?.activeReservation?.occupyingVehicleId, 'veh_A', 'Stale vehicle A must be cleared');
  });

  it('5. Dispatched vehicle tracks real-time traffic conditions, delay, and allows manual detour reroute', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    assert.ok(targetBuilding, 'Industrial destination must exist');

    const dispatchRes = worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
      criterion: 'fastest',
      avoidCongestion: true,
    });
    assert.strictEqual(dispatchRes.success, true);

    // Progress info should have congestionLevel populated
    const prog1 = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(prog1);
    assert.strictEqual(prog1.congestionLevel, 'free_flowing');

    // Manual detour reroute command should execute cleanly
    const rerouteRes = worldManager.rerouteVehicle('veh_prime_mover_01');
    assert.strictEqual(rerouteRes.success, true);
    assert.ok(rerouteRes.message.includes('successfully'));

    // Traversed distance and destination integrity must be preserved
    const prog2 = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(prog2);
    assert.strictEqual(prog2.destinationName, targetBuilding.definition.name);
    assert.ok(prog2.totalDistanceMeters > 0);

    worldManager.dispose();
  });

  it('6. Severed road connection safely pulls vehicle over onto shoulder with hazard flashers', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name, {
      destinationEntityId: targetBuilding.id,
      criterion: 'fastest',
    });

    const simVeh = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01');
    assert.ok(simVeh);

    // Simulate sudden obstacle where target road is unreachable
    simVeh.targetGridX = 999;
    simVeh.targetGridZ = 999;
    const rerouteOk = worldManager.trafficManager.attemptIntelligentReroute(simVeh, 'no_route_forward');
    assert.strictEqual(rerouteOk, false, 'Reroute to unreachable island coordinates should fail');
    assert.strictEqual(simVeh.state, 'stopped_unreachable', 'Vehicle must stop safely on shoulder');
    assert.strictEqual(simVeh.blockageCause, 'no_route_forward');

    const progress = worldManager.getVehicleRouteProgress('veh_prime_mover_01');
    assert.ok(progress);
    assert.strictEqual(progress.operationalStatus, 'Route Blocked');
    assert.strictEqual(progress.blockageReason, 'no_route_forward');

    worldManager.dispose();
  });

  it('7. Reroute cooldown prevents rapid path flapping within 8 seconds', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    const targetBuilding = worldManager.entityRegistry.get('bld_industry_01') as BuildingEntity;
    worldManager.dispatchVehicle('veh_prime_mover_01', targetBuilding.definition.name);

    const simVeh = worldManager.trafficManager.getSimulatedVehicle('veh_prime_mover_01');
    assert.ok(simVeh);

    // First autonomous reroute
    simVeh.lastRerouteTimestampMs = 0;
    const ok1 = worldManager.trafficManager.attemptIntelligentReroute(simVeh, 'queue_timeout');
    assert.strictEqual(ok1, true);

    // Immediate second autonomous reroute within 100ms should be rejected by 8s cooldown
    const ok2 = worldManager.trafficManager.attemptIntelligentReroute(simVeh, 'queue_timeout');
    assert.strictEqual(ok2, false, 'Autonomous reroute must be rate-limited by 8s cooldown');

    worldManager.dispose();
  });
});
