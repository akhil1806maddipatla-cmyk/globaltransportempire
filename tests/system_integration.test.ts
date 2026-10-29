import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game/GameState';
import { WorldManager } from '../src/world/WorldManager';
import { globalEventBus } from '../src/core/EventBus';
import { SaveLoadManager } from '../src/game/SaveLoadManager';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { TruckDepotFacility } from '../src/facilities/FacilityModel';

test('Integration 1: Purchasing an item updates authoritative economy and world state consistently', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const initialCash = gameState.getCash();
  assert.equal(initialCash, 250000);

  // 1. Purchase Land Parcel
  const parcel = worldManager.landParcelManager.getParcel('parcel_expansion_east_01');
  assert.ok(parcel);
  assert.equal(parcel.ownership, 'unowned');
  const landCost = parcel.effectivePurchasePrice;

  const landRes = worldManager.purchaseLandParcel('parcel_expansion_east_01');
  assert.equal(landRes.success, true);
  assert.equal(landRes.cost, landCost);
  assert.equal(parcel.ownership, 'player_owned');
  assert.equal(parcel.isBuildAllowed, true);
  assert.equal(gameState.getCash(), initialCash - landCost);

  // 2. Construct Road Path on purchased land
  const cashBeforeRoad = gameState.getCash();
  const roadRes = worldManager.constructRoadPath(
    [
      { x: 16, z: 12 },
      { x: 17, z: 12 },
    ],
    'two_lane_urban'
  );
  assert.equal(roadRes.success, true);
  assert.ok(roadRes.cost > 0);
  assert.equal(gameState.getCash(), cashBeforeRoad - roadRes.cost);

  // 3. Purchase Vehicle
  const cashBeforeVehicle = gameState.getCash();
  const vehRes = worldManager.purchaseVehicle('courier_truck_4x2');
  assert.equal(vehRes.success, true);
  assert.ok(vehRes.entity);
  assert.equal(vehRes.cost, 28000);
  assert.equal(gameState.getCash(), cashBeforeVehicle - 28000);

  // Verify depot occupancy increased
  const depot = worldManager.facilityManager.getPrimaryTruckDepot()!;
  assert.equal(depot.isVehicleAssigned(vehRes.entity!.id), true);

  // Verify 5-day real-world maintenance registered
  const maint = worldManager.maintenanceManager.getRecord(vehRes.entity!.id);
  assert.ok(maint);
  assert.equal(maint.vehicleId, vehRes.entity!.id);

  worldManager.dispose();
});

test('Integration 2: A failed purchase leaves money and world state completely unchanged', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  // Set treasury below price
  gameState.setCash(500);

  // 1. Failed Land Purchase (insufficient cash)
  const parcel = worldManager.landParcelManager.getParcel('parcel_expansion_east_01')!;
  const prevOwnership = parcel.ownership;
  const landRes = worldManager.purchaseLandParcel('parcel_expansion_east_01');
  assert.equal(landRes.success, false);
  assert.equal(gameState.getCash(), 500, 'Cash unchanged on failed land purchase');
  assert.equal(parcel.ownership, prevOwnership, 'Parcel ownership unchanged on failure');

  // 2. Failed Building Placement (insufficient cash)
  assert.equal(worldManager.gridSystem.isAreaFree(1, 14, 4, 3), true, 'Target area is free prior to attempt');
  const bldRes = worldManager.placeBuilding('commercial_distribution_hub', 1, 14);
  assert.equal(bldRes.success, false);
  assert.equal(gameState.getCash(), 500, 'Cash unchanged on failed building placement');
  assert.equal(worldManager.gridSystem.isAreaFree(1, 14, 4, 3), true, 'Grid remains free after failed placement');

  // 3. Failed Vehicle Purchase (insufficient cash)
  const vehRes = worldManager.purchaseVehicle('prime_mover_6x4');
  assert.equal(vehRes.success, false);
  assert.equal(gameState.getCash(), 500, 'Cash unchanged on failed vehicle purchase');

  worldManager.dispose();
});

test('Integration 3: Facility occupancy cannot exceed capacity', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const depot = worldManager.facilityManager.getPrimaryTruckDepot()!;
  assert.equal(depot.getTotalCapacity(), 3, 'Starting depot has exactly 3 spaces');

  // Bay 1 is already occupied by starting truck veh_prime_mover_01
  assert.equal(depot.getOccupiedCapacity(), 1);

  // Fill remaining 2 spaces
  const fill1 = depot.assignAsset('test_truck_02', 'prime_mover_6x4');
  assert.equal(fill1, true);
  const fill2 = depot.assignAsset('test_truck_03', 'prime_mover_6x4');
  assert.equal(fill2, true);

  assert.equal(depot.getOccupiedCapacity(), 3);
  assert.equal(depot.isFull(), true);
  assert.equal(depot.getAvailableCapacity(), 0);

  // Attempt to assign 4th vehicle to Level 1 depot
  const overflow = depot.assignAsset('test_truck_overflow', 'prime_mover_6x4');
  assert.equal(overflow, false, 'Overflow assignment rejected');
  assert.equal(depot.getOccupiedCapacity(), 3, 'Capacity strictly clamped to 3');

  // Vehicle purchase when full must be rejected without charging money
  const cashBefore = gameState.getCash();
  const buyWhenFull = worldManager.purchaseVehicle('courier_truck_4x2');
  assert.equal(buyWhenFull.success, false);
  assert.equal(gameState.getCash(), cashBefore, 'No money deducted when depot is full');

  worldManager.dispose();
});

test('Integration 4: A vehicle cannot occupy multiple spaces simultaneously across the game world', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const depot = worldManager.facilityManager.getPrimaryTruckDepot()!;
  const testVehicleId = 'multi_space_test_veh';

  // Assign to available Bay 1
  const assignBay1 = depot.assignToBay(1, testVehicleId, 'prime_mover_6x4');
  assert.equal(assignBay1, true);
  assert.equal(depot.getSpace(1)!.occupiedByVehicleId, testVehicleId);

  // Reassign same vehicle to Bay 2
  const assignBay2 = depot.assignToBay(2, testVehicleId, 'prime_mover_6x4');
  assert.equal(assignBay2, true);

  // Verify Bay 1 was freed and vehicle is only in Bay 2
  assert.equal(depot.getSpace(1)!.occupiedByVehicleId, null, 'Previous bay freed automatically');
  assert.equal(depot.getSpace(2)!.occupiedByVehicleId, testVehicleId);

  // Count occurrences across all spaces
  const totalOccupied = depot.getSpaces().filter((s) => s.occupiedByVehicleId === testVehicleId).length;
  assert.equal(totalOccupied, 1, 'Vehicle occupies exactly one space in depot');

  worldManager.dispose();
});

test('Integration 5: Dispatching and returning a vehicle updates relevant systems consistently', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const vehicleId = 'veh_prime_mover_01';
  const depot = worldManager.facilityManager.getPrimaryTruckDepot()!;
  assert.equal(depot.isVehicleAssigned(vehicleId), true, 'Vehicle initially in depot');

  // Dispatch vehicle
  const dispatchRes = worldManager.dispatchVehicle(vehicleId, 'Industrial Branch Hub');
  assert.equal(dispatchRes.success, true);
  assert.equal(depot.isVehicleAssigned(vehicleId), false, 'Bay freed while dispatched en-route');

  // Return vehicle
  const returnRes = worldManager.returnVehicle(vehicleId);
  assert.equal(returnRes.success, true);
  assert.equal(depot.isVehicleAssigned(vehicleId), true, 'Vehicle re-assigned to bay on return');

  // Overdue vehicle cannot be dispatched
  const maintRecord = worldManager.maintenanceManager.getRecord(vehicleId)!;
  maintRecord.nextDueTimestamp = Date.now() - 10000; // Force overdue
  maintRecord.isOverdue = true;

  const overdueDispatch = worldManager.dispatchVehicle(vehicleId, 'Port Terminal');
  assert.equal(overdueDispatch.success, false, 'Overdue vehicle dispatch rejected');
  assert.ok(overdueDispatch.error?.includes('maintenance'));

  // Perform maintenance with cash check
  gameState.setCash(1000);
  const maintRes = worldManager.maintenanceManager.performMaintenance(vehicleId, gameState);
  assert.equal(maintRes.success, true);
  assert.equal(maintRecord.isOverdue, false);

  // Now dispatch succeeds
  const cleanDispatch = worldManager.dispatchVehicle(vehicleId, 'Port Terminal');
  assert.equal(cleanDispatch.success, true);

  worldManager.dispose();
});

test('Integration 6: Completing a reward-bearing task cannot grant duplicate rewards', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const initialCash = gameState.getCash();
  const initialXp = gameState.getExperience();

  // First claim
  const claim1 = worldManager.completeContract('contract_milestone_01', 12500, 150);
  assert.equal(claim1.success, true);
  assert.equal(gameState.getCash(), initialCash + 12500);
  assert.equal(gameState.getExperience(), initialXp + 150);
  assert.equal(gameState.isTaskCompleted('contract_milestone_01'), true);

  // Second claim attempt must be rejected
  const claim2 = worldManager.completeContract('contract_milestone_01', 12500, 150);
  assert.equal(claim2.success, false);
  assert.ok(claim2.error?.includes('already been claimed'));
  assert.equal(gameState.getCash(), initialCash + 12500, 'Duplicate cash payout blocked');
  assert.equal(gameState.getExperience(), initialXp + 150, 'Duplicate XP grant blocked');

  worldManager.dispose();
});

test('Integration 7: Removing an entity invalidates and cleans up all its references', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  // 1. Building Removal
  const bld = worldManager.entityRegistry.getAll().find((e): e is BuildingEntity => e.entityType === 'building')!;
  const bldId = bld.id;
  gameState.selectEntity(bldId);
  assert.equal(gameState.getSelectedEntityId(), bldId);

  const removeBldRes = worldManager.removeBuilding(bldId);
  assert.equal(removeBldRes.success, true);
  assert.equal(gameState.getSelectedEntityId(), null, 'Selection cleared when building removed');
  assert.equal(worldManager.entityRegistry.get(bldId), undefined, 'Entity removed from registry');
  assert.equal(scene.children.includes(bld.group), false, 'Mesh removed from scene');

  // 2. Vehicle Removal
  const veh = worldManager.entityRegistry.getAll().find((e): e is VehicleEntity => e.entityType === 'vehicle')!;
  const vehId = veh.id;
  gameState.selectEntity(vehId);
  assert.equal(gameState.getSelectedEntityId(), vehId);

  const removeVehRes = worldManager.removeVehicle(vehId);
  assert.equal(removeVehRes, true);
  assert.equal(gameState.getSelectedEntityId(), null, 'Selection cleared when vehicle removed');
  assert.equal(worldManager.entityRegistry.get(vehId), undefined, 'Vehicle removed from registry');
  assert.equal(scene.children.includes(veh.group), false, 'Vehicle mesh removed from scene');
  assert.equal(worldManager.facilityManager.findFacilityForVehicle(vehId), null, 'Facility bay released');
  assert.equal(worldManager.maintenanceManager.getRecord(vehId), null, 'Maintenance record unregistered');

  worldManager.dispose();
});

test('Integration 8: UI state refreshes from authoritative data via globalEventBus', () => {
  const gameState = new GameState();

  let receivedCash = -1;
  let receivedLevel = -1;
  let receivedExp = -1;
  let taskClaimed = false;

  const unsubCash = globalEventBus.on<number>('game:cash_changed', (c) => {
    receivedCash = c;
  });
  const unsubLevel = globalEventBus.on<{ level: number }>('game:level_up', (l) => {
    receivedLevel = l.level;
  });
  const unsubExp = globalEventBus.on<{ experience: number }>('game:experience_gained', (e) => {
    receivedExp = e.experience;
  });
  const unsubTask = globalEventBus.on('game:task_reward_claimed', () => {
    taskClaimed = true;
  });

  // Mutate authoritative state
  gameState.addCash(42000, 'Contract Payment');
  assert.equal(receivedCash, gameState.getCash());

  gameState.addExperience(1250); // Crosses 1000 threshold -> level 2, 250 XP
  assert.equal(receivedLevel, 2);
  assert.equal(receivedExp, 250);

  gameState.claimTaskReward('task_route_50', 500, 100);
  assert.equal(taskClaimed, true);

  unsubCash();
  unsubLevel();
  unsubExp();
  unsubTask();
});

test('Integration 9: Save/load preserves consistent ownership, progression, and entity relationships', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  // Establish state: purchase land, earn XP, level up, construct road
  worldManager1.purchaseLandParcel('parcel_expansion_east_01');
  gameState1.addExperience(3500); // Level 3 (1000 + 2000 = 3000, 500 XP remainder)
  gameState1.setCash(187420);

  const saveLoad = new SaveLoadManager();
  const saveRes = saveLoad.saveGame(worldManager1, gameState1, 'integration_save_slot', 'Integration Test Save');
  assert.equal(saveRes.success, true);

  worldManager1.dispose();

  // Load in clean second instance
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  const loadRes = saveLoad.loadGame(worldManager2, gameState2, 'integration_save_slot');
  assert.equal(loadRes.success, true);

  // Verify authoritative state restored
  assert.equal(gameState2.getCash(), 187420, 'Treasury restored');
  assert.equal(gameState2.getLevel(), 3, 'Level restored');
  assert.equal(gameState2.getExperience(), 500, 'Experience restored');

  // Verify Land Parcel ownership preserved
  const loadedParcel = worldManager2.landParcelManager.getParcel('parcel_expansion_east_01')!;
  assert.equal(loadedParcel.ownership, 'player_owned', 'Land ownership preserved');

  // Verify Level 1 Starting Depot preserved with 3 spaces
  const loadedDepot = worldManager2.facilityManager.getPrimaryTruckDepot()!;
  assert.equal(loadedDepot.level, 1);
  assert.equal(loadedDepot.getTotalCapacity(), 3);
  assert.equal(loadedDepot.isPlayerOwned, true);

  worldManager2.dispose();
});

test('Integration 10: Reinitializing systems does not duplicate event subscriptions or entities', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  // Multiple ensureDefaultStartingDepot calls must return the same instance
  const depot1 = worldManager.facilityManager.ensureDefaultStartingDepot();
  const depot2 = worldManager.facilityManager.ensureDefaultStartingDepot();
  const depot3 = worldManager.facilityManager.ensureDefaultStartingDepot();

  assert.equal(depot1.id, depot2.id);
  assert.equal(depot2.id, depot3.id);
  assert.equal(worldManager.facilityManager.getAllTruckDepots().length, 1, 'Only 1 starting depot registered');

  // Audit report must confirm clean health
  const audit = worldManager.runEngineeringDiagnostics();
  assert.equal(audit.isHealthy, true, 'Diagnostics audit healthy');
  assert.equal(audit.errors.length, 0, 'Zero errors in system audit');

  worldManager.dispose();
});
