import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FacilityManager } from '../src/facilities/FacilityManager';
import { TruckDepotFacility } from '../src/facilities/FacilityModel';
import { GameState } from '../src/game/GameState';
import {
  VehicleMaintenanceManager,
  REAL_WORLD_MAINTENANCE_INTERVAL_MS,
  REAL_WORLD_MAINTENANCE_INTERVAL_DAYS,
} from '../src/game/VehicleMaintenanceManager';
import { EngineeringDiagnostics } from '../src/core/EngineeringDiagnostics';
import { VEHICLE_DEFINITIONS, TRAILER_DEFINITIONS, VehicleDefinition } from '../src/data/vehicleDefinitions';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { TransportNetwork } from '../src/network/TransportNetwork';
import { EntityRegistry } from '../src/entities/EntityRegistry';
import { GridSystem } from '../src/world/GridSystem';
import { WorldManager } from '../src/world/WorldManager';
import { Logger, LogLevel } from '../src/core/Logger';

test('1. Deterministic New-Game Initialization & World Audit', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);

  // Initialize starting world
  worldManager.initializeWorld();

  // Run full system audit
  const audit = worldManager.runEngineeringDiagnostics();
  assert.equal(audit.isHealthy, true, `New-game world must be 100% healthy: ${audit.errors.map(e => e.message).join(', ')}`);
  assert.equal(audit.errors.length, 0, 'No engineering errors on initial world generation');

  // Verify starting counts
  const data = gameState.getData();
  assert.ok(data.roadSegmentCount > 30, 'Road network generated initial segments');
  assert.ok(data.buildingCount >= 4, 'Initial deliberate buildings placed');

  worldManager.dispose();
});

test('2. Duplicate Depot Prevention (Idempotency Guarantee)', () => {
  const facilityManager = new FacilityManager();

  // First call creates the starting depot
  const depot1 = facilityManager.ensureDefaultStartingDepot(12, 13);
  assert.ok(depot1, 'Starting depot created');
  assert.equal(depot1.id, 'facility_truck_depot_01');

  // Second and third calls must return the identical singleton instance
  const depot2 = facilityManager.ensureDefaultStartingDepot(12, 13);
  const depot3 = facilityManager.ensureDefaultStartingDepot(20, 20); // Different coordinates ignored for singleton

  assert.equal(depot1, depot2, 'Second call must return identical depot instance');
  assert.equal(depot1, depot3, 'Third call must return identical depot instance');
  assert.equal(facilityManager.getAllTruckDepots().length, 1, 'Exactly one truck depot must exist in facility manager');
  assert.equal(facilityManager.getAllFacilities().length, 1, 'Only starting depot registered');
});

test('3. Level 1 Depot 3-Space Capacity Invariant', () => {
  const facilityManager = new FacilityManager();
  const depot = facilityManager.ensureDefaultStartingDepot(12, 13);

  // Validation method
  const validation = EngineeringDiagnostics.validateLevel1TruckDepot(facilityManager);
  assert.equal(validation.isValid, true, `Depot validation must pass: ${validation.issues.map(i => i.message).join(', ')}`);

  // Invariants
  assert.equal(depot.level, 1, 'Starting depot must be Level 1');
  assert.equal(depot.isPlayerOwned, true, 'Starting depot is owned and available without purchase');
  assert.equal(depot.getTotalCapacity(), 3, 'Must have exactly 3 designated truck spaces');

  const spaces = depot.getSpaces();
  assert.equal(spaces.length, 3, 'Spaces list must contain exactly 3 spaces');
  assert.equal(spaces[0].spaceIndex, 0);
  assert.equal(spaces[1].spaceIndex, 1);
  assert.equal(spaces[2].spaceIndex, 2);

  // Check unique space IDs / labels
  const labels = new Set(spaces.map(s => s.label));
  assert.equal(labels.size, 3, 'All 3 parking spaces have unique labels');
});

test('4. Unique Parking-Space Assignments & Prevention of Double Booking', () => {
  const depot = new TruckDepotFacility('test_depot', 'Test Depot', 10, 10, 1, true);

  // Assign vehicle A to Bay #0
  const assignedA = depot.assignToBay(0, 'truck_alpha', 'prime_mover_6x4');
  assert.equal(assignedA, true);
  assert.equal(depot.getOccupiedCapacity(), 1);

  // Attempt to assign vehicle B to already-occupied Bay #0 -> must be rejected!
  const assignedB = depot.assignToBay(0, 'truck_bravo', 'prime_mover_6x4');
  assert.equal(assignedB, false, 'Occupied bay cannot be double-booked by another vehicle');
  assert.equal(depot.getSpace(0)?.occupiedByVehicleId, 'truck_alpha');

  // Assign vehicle A to Bay #2 -> must vacate Bay #0 so vehicle A is never in two bays!
  const reallocatedA = depot.assignToBay(2, 'truck_alpha', 'prime_mover_6x4');
  assert.equal(reallocatedA, true);
  assert.equal(depot.getSpace(0)?.occupiedByVehicleId, null, 'Bay #0 was vacated when vehicle moved to Bay #2');
  assert.equal(depot.getSpace(2)?.occupiedByVehicleId, 'truck_alpha', 'Bay #2 now occupied by vehicle A');
  assert.equal(depot.getOccupiedCapacity(), 1, 'Vehicle A only counts as 1 occupied slot');
});

test('5. Valid World-Scale and Spatial Bounds (Vehicle & Depot Clearance)', () => {
  const primeMover = VEHICLE_DEFINITIONS.prime_mover_6x4;
  const trailer = TRAILER_DEFINITIONS.skeletal_container_chassis_40ft;

  // Standard truck & trailer must pass spatial validation
  const validCheck = EngineeringDiagnostics.validateVehicleSpatialFit(primeMover, trailer);
  assert.equal(validCheck.isValid, true, `Standard truck combination must pass spatial check: ${validCheck.issues.map(i => i.message).join(', ')}`);

  // Oversized truck (> 3.0m width) must be rejected
  const oversizedTruck: VehicleDefinition = {
    ...primeMover,
    id: 'oversized_test_truck',
    dimensions: {
      ...primeMover.dimensions,
      width: 3.4, // Exceeds 3.0m single-lane envelope
    },
  };
  const oversizedCheck = EngineeringDiagnostics.validateVehicleSpatialFit(oversizedTruck);
  assert.equal(oversizedCheck.isValid, false, 'Oversized vehicle exceeding lane width must fail validation');
  assert.ok(oversizedCheck.issues.some(i => i.system === 'VehicleScale' && i.severity === 'error'));

  // Deviant fifth-wheel coupling height (e.g. Y=1.8m instead of 1.15m) must be rejected
  const badFifthWheelTruck: VehicleDefinition = {
    ...primeMover,
    id: 'bad_fw_truck',
    fifthWheelOffset: { x: 0, y: 1.85, z: -1.8 },
  };
  const badFwCheck = EngineeringDiagnostics.validateVehicleSpatialFit(badFifthWheelTruck);
  assert.equal(badFwCheck.isValid, false, 'Invalid fifth-wheel height must fail validation');
  assert.ok(badFwCheck.issues.some(i => i.message.includes('deviates from standard')));
});

test('6. Road Connectivity and Disconnected Island Detection', () => {
  const gridSystem = new GridSystem();
  const roadModel = new RoadNetworkModel(gridSystem);

  // Create connected continuous road (X=0 to X=4 at Z=0)
  for (let x = 0; x <= 4; x++) {
    roadModel.addRoadCell(x, 0, 'two_lane_urban');
  }

  const cleanCheck = EngineeringDiagnostics.validateRoadTopology(roadModel);
  assert.equal(cleanCheck.isValid, true, 'Continuous connected road network must be valid');

  // Add an isolated road cell at X=20, Z=20 (disconnected cluster)
  roadModel.addRoadCell(20, 20, 'two_lane_urban');

  const islandCheck = EngineeringDiagnostics.validateRoadTopology(roadModel);
  assert.equal(islandCheck.isValid, false, 'Disconnected road network island must be flagged');
  assert.ok(islandCheck.issues.some(i => i.system === 'RoadNetwork'));
});

test('7. Save/Load Preservation of Entity Identities & Maintenance Schedules', () => {
  const maintenanceManager = new VehicleMaintenanceManager();

  const now = 1700000000000;
  maintenanceManager.registerVehicle('veh_truck_101', 'road', 300, now);
  maintenanceManager.registerVehicle('veh_truck_102', 'road', 450, now);

  // Serialize schedule
  const savedState = maintenanceManager.serialize();
  assert.equal(savedState.length, 2);

  // Create new manager and restore
  const restoredManager = new VehicleMaintenanceManager();
  restoredManager.deserialize(savedState, now + 1000);

  const rec1 = restoredManager.getRecord('veh_truck_101');
  const rec2 = restoredManager.getRecord('veh_truck_102');

  assert.ok(rec1 && rec2, 'Entities restored with exact IDs');
  assert.equal(rec1.lastServiceTimestamp, now);
  assert.equal(rec1.nextDueTimestamp, now + REAL_WORLD_MAINTENANCE_INTERVAL_MS);
  assert.equal(rec1.maintenanceCost, 300);
  assert.equal(rec1.isOverdue, false);
});

test('8. Safe Handling of Invalid or Missing Data', () => {
  const maintenanceManager = new VehicleMaintenanceManager();
  const gameState = new GameState();

  // Attempting maintenance on a non-existent vehicle returns clean failure without crash
  const res = maintenanceManager.performMaintenance('non_existent_vehicle', gameState);
  assert.equal(res.success, false);
  assert.ok(res.error?.includes('not registered'));

  // Evaluating status of non-existent vehicle returns safe default
  const status = maintenanceManager.evaluateStatus('ghost_vehicle');
  assert.equal(status.exists, false);
  assert.equal(status.isOverdue, false);
});

test('9. Prevention of Capacity Overflow and Incompatible Vehicle Rejection', () => {
  const depot = new TruckDepotFacility('depot_cap_test', 'Capacity Test Depot', 5, 5, 1, true);

  // Fill all 3 parking bays
  assert.equal(depot.assignAsset('truck_1', 'prime_mover_6x4'), true);
  assert.equal(depot.assignAsset('truck_2', 'rigid_courier'), true);
  assert.equal(depot.assignAsset('truck_3', 'heavy_combination_semi'), true);

  assert.equal(depot.isFull(), true);
  assert.equal(depot.getOccupiedCapacity(), 3);
  assert.equal(depot.getAvailableCapacity(), 0);

  // 4th vehicle must be rejected
  const overflowResult = depot.assignAsset('truck_4', 'rigid_courier');
  assert.equal(overflowResult, false, 'Cannot exceed facility maximum capacity');
  assert.equal(depot.getOccupiedCapacity(), 3);

  // Capacity rule validation
  const capCheck = EngineeringDiagnostics.validateFacilityCapacityRules(depot);
  assert.equal(capCheck.isValid, true);
});

test('10. Consistency of Economy & 5-Day Real-World Maintenance Invariant', () => {
  const maintenanceManager = new VehicleMaintenanceManager();
  const gameState = new GameState();

  // Verify real-world 5 days interval constant
  assert.equal(REAL_WORLD_MAINTENANCE_INTERVAL_DAYS, 5);
  assert.equal(REAL_WORLD_MAINTENANCE_INTERVAL_MS, 5 * 24 * 60 * 60 * 1000);

  const t0 = Date.now();
  const record = maintenanceManager.registerVehicle('veh_prime_01', 'road', 500, t0);
  assert.equal(record.nextDueTimestamp - record.lastServiceTimestamp, REAL_WORLD_MAINTENANCE_INTERVAL_MS);

  // Scenario A: Insufficient funds
  gameState.setCash(200); // Only $200 in treasury, maintenance requires $500
  const failRes = maintenanceManager.performMaintenance('veh_prime_01', gameState, t0 + 1000);
  assert.equal(failRes.success, false);
  assert.equal(failRes.shortfall, 300);
  assert.equal(gameState.getCash(), 200, 'Cash was not deducted on failure');
  assert.equal(record.lastServiceTimestamp, t0, 'Service timestamp was NOT reset');

  // Scenario B: Solvency check & successful maintenance
  gameState.setCash(1000); // Treasury has sufficient funds
  const tService = t0 + 1000;
  const passRes = maintenanceManager.performMaintenance('veh_prime_01', gameState, tService);
  assert.equal(passRes.success, true);
  assert.equal(gameState.getCash(), 500, 'Exact $500 cost deducted from treasury');
  assert.equal(record.lastServiceTimestamp, tService, 'Service timestamp updated to service time');
  assert.equal(record.nextDueTimestamp, tService + REAL_WORLD_MAINTENANCE_INTERVAL_MS, 'Next due date strictly advanced by 5 real-world days');
  assert.equal(record.serviceHistoryCount, 1);
});

test('Rate-Limited Logging & Diagnostic Ring Buffer Safety', () => {
  Logger.clearDiagnostics();
  const logger = new Logger('TestModule');

  // Trigger throttled warning multiple times
  for (let i = 0; i < 10; i++) {
    logger.warnThrottled('test_loop_key', 5000, 'Repetitive frame warning message');
  }

  const entries = Logger.getRecentDiagnostics();
  // Even with 10 iterations, throttle ensures at most 1 warning is recorded
  assert.equal(entries.length, 1, 'Throttled warning was logged only once');
  assert.equal(entries[0].context, 'TestModule');
  assert.equal(entries[0].level, LogLevel.WARN);
});
