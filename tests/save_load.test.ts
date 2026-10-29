import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game/GameState';
import { WorldManager } from '../src/world/WorldManager';
import { SaveLoadManager, CURRENT_SAVE_SCHEMA_VERSION, DEFAULT_SAVE_SLOT } from '../src/game/SaveLoadManager';
import { REAL_WORLD_MAINTENANCE_INTERVAL_MS } from '../src/game/VehicleMaintenanceManager';
import { TruckDepotFacility } from '../src/facilities/FacilityModel';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';

test('1. New Game State Snapshot Creation & Schema Integrity', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const saveLoad = new SaveLoadManager();
  const snapshot = saveLoad.createSaveSnapshot(worldManager, gameState, 'test_slot_01', 'Test Save');

  // Verify Schema Version and Metadata
  assert.equal(snapshot.schemaVersion, CURRENT_SAVE_SCHEMA_VERSION);
  assert.equal(snapshot.metadata.slotId, 'test_slot_01');
  assert.equal(snapshot.metadata.saveName, 'Test Save');
  assert.equal(snapshot.metadata.companyName, 'Apex Transport Global');
  assert.equal(snapshot.metadata.cash, 250000);

  // Verify World Arrays
  assert.ok(snapshot.world.roads.length > 30, 'Road network serialized');
  assert.ok(snapshot.world.buildings.length >= 4, 'Initial deliberate buildings serialized');
  assert.ok(snapshot.facilities.length >= 1, 'Starting facility serialized');
  assert.ok(snapshot.vehicles.length >= 3, 'Fleet vehicles serialized');
  assert.ok(snapshot.maintenance.length >= 3, '5-day maintenance records serialized');

  worldManager.dispose();
});

test('2. Save & Load Full Roundtrip - Core State & Economy Preservation', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  // Modify treasury to unique test value
  gameState1.setCash(345670);

  const saveLoad = new SaveLoadManager();
  const saveResult = saveLoad.saveGame(worldManager1, gameState1, 'roundtrip_slot', 'Roundtrip Save');
  assert.equal(saveResult.success, true);

  // Initialize a fresh target world
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  // Load saved state into target world
  const loadResult = saveLoad.loadGame(worldManager2, gameState2, 'roundtrip_slot');
  assert.equal(loadResult.success, true);
  assert.equal(gameState2.getCash(), 345670, 'Treasury cash must match saved state');

  worldManager1.dispose();
  worldManager2.dispose();
});

test('3. Level 1 Starting Truck Depot Preservation Across Roundtrip', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  // Assign vehicle to Depot Bay #1
  const depot1 = worldManager1.facilityManager.getPrimaryTruckDepot()!;
  assert.ok(depot1, 'Starting depot must exist');
  assert.equal(depot1.level, 1);
  assert.equal(depot1.getTotalCapacity(), 3);
  depot1.assignToBay(1, 'veh_prime_mover_01', 'prime_mover_6x4');

  const saveLoad = new SaveLoadManager();
  saveLoad.saveGame(worldManager1, gameState1, 'depot_test_slot');

  // Load into fresh world
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  saveLoad.loadGame(worldManager2, gameState2, 'depot_test_slot');

  const depot2 = worldManager2.facilityManager.getPrimaryTruckDepot();
  assert.ok(depot2, 'Primary depot must be restored');
  assert.equal(depot2.id, 'facility_truck_depot_01', 'Depot ID must remain stable');
  assert.equal(depot2.level, 1, 'Restored depot must remain Level 1');
  assert.equal(depot2.isPlayerOwned, true, 'Restored depot must be player owned');
  assert.equal(depot2.getTotalCapacity(), 3, 'Restored depot must retain exactly 3 parking spaces');

  // Verify no duplicate depots were created
  assert.equal(worldManager2.facilityManager.getAllTruckDepots().length, 1, 'Only one depot must exist');

  // Verify parking bay assignment restored
  assert.equal(depot2.getSpace(1)?.occupiedByVehicleId, 'veh_prime_mover_01');
  assert.equal(depot2.getOccupiedCapacity(), 1);

  worldManager1.dispose();
  worldManager2.dispose();
});

test('4. Stable Entity ID Preservation for Buildings and Vehicles', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  const originalEntities = worldManager1.entityRegistry.getAll();
  const originalBuildingIds = originalEntities.filter(e => e.entityType === 'building').map(e => e.id).sort();
  const originalVehicleIds = originalEntities.filter(e => e.entityType === 'vehicle').map(e => e.id).sort();

  const saveLoad = new SaveLoadManager();
  saveLoad.saveGame(worldManager1, gameState1, 'entity_id_slot');

  // Restore into second world
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  saveLoad.loadGame(worldManager2, gameState2, 'entity_id_slot');

  const restoredEntities = worldManager2.entityRegistry.getAll();
  const restoredBuildingIds = restoredEntities.filter(e => e.entityType === 'building').map(e => e.id).sort();
  const restoredVehicleIds = restoredEntities.filter(e => e.entityType === 'vehicle').map(e => e.id).sort();

  assert.deepEqual(restoredBuildingIds, originalBuildingIds, 'Building entity IDs must be preserved identically');
  assert.deepEqual(restoredVehicleIds, originalVehicleIds, 'Vehicle entity IDs must be preserved identically');

  worldManager1.dispose();
  worldManager2.dispose();
});

test('5. 5-Day Real-World Maintenance Invariant Persistence Without Timer Resets', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  // Set fixed known maintenance timestamps for a vehicle
  const knownServiceTime = 1700000000000;
  worldManager1.maintenanceManager.registerVehicle(
    'veh_test_freight',
    'road',
    420,
    knownServiceTime
  );

  const saveLoad = new SaveLoadManager();
  saveLoad.saveGame(worldManager1, gameState1, 'maint_slot');

  // Restore into second world
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  saveLoad.loadGame(worldManager2, gameState2, 'maint_slot');

  const restoredRecord = worldManager2.maintenanceManager.getRecord('veh_test_freight');
  assert.ok(restoredRecord, 'Maintenance record must be restored');
  assert.equal(restoredRecord.lastServiceTimestamp, knownServiceTime, 'Last service timestamp must survive load');
  assert.equal(
    restoredRecord.nextDueTimestamp,
    knownServiceTime + REAL_WORLD_MAINTENANCE_INTERVAL_MS,
    'Next due timestamp must remain exactly 5 real-world days after last service'
  );
  assert.equal(restoredRecord.maintenanceCost, 420);

  worldManager1.dispose();
  worldManager2.dispose();
});

test('6. Rejection of Malformed, Corrupted, or Future Schema Save Files', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const saveLoad = new SaveLoadManager();

  // A. Future schema version 99
  const futureSave = {
    schemaVersion: 99,
    company: { companyName: 'Future Inc', cash: 1000000 },
    world: { roads: [], buildings: [], parcels: [] },
  };
  const valFuture = saveLoad.migrateAndValidateSave(futureSave);
  assert.equal(valFuture.isValid, false);
  assert.ok(valFuture.error?.includes('unsupported schema version'));

  // B. Missing company data
  const brokenSave = {
    schemaVersion: 1,
    world: { roads: [] },
  };
  const valBroken = saveLoad.migrateAndValidateSave(brokenSave);
  assert.equal(valBroken.isValid, false);
  assert.ok(valBroken.error?.includes('Missing company'));

  // C. Non-existent save slot load attempt
  const nonExistentLoad = saveLoad.loadGame(worldManager, gameState, 'slot_that_does_not_exist');
  assert.equal(nonExistentLoad.success, false);
  assert.ok(nonExistentLoad.error?.includes('not found'));

  worldManager.dispose();
});

test('7. Starting Depot Automatic Reconstruction for Legacy Saves', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const saveLoad = new SaveLoadManager();

  // Construct a legacy save without facilities
  const legacySave = {
    schemaVersion: 1,
    company: { companyName: 'Legacy Transport', cash: 150000 },
    world: { roads: [], buildings: [], parcels: [] },
    facilities: [], // No depot!
    vehicles: [],
    maintenance: [],
  };

  // Inject into storage
  (saveLoad as any).setStorageItem('gte_save_legacy_slot', JSON.stringify(legacySave));

  const loadResult = saveLoad.loadGame(worldManager, gameState, 'legacy_slot');
  assert.equal(loadResult.success, true);
  assert.ok(loadResult.warnings.some(w => w.includes('Starting Level 1 Depot was missing')));

  // Verify starting depot was safely reconstructed with 3 spaces
  const depot = worldManager.facilityManager.getPrimaryTruckDepot();
  assert.ok(depot, 'Starting depot must be automatically reconstructed');
  assert.equal(depot.level, 1);
  assert.equal(depot.getTotalCapacity(), 3);
  assert.equal(depot.isPlayerOwned, true);

  worldManager.dispose();
});

test('8. Save Slot Listing and Deletion', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  const saveLoad = new SaveLoadManager();

  // Save to slot_1 and slot_2
  saveLoad.saveGame(worldManager, gameState, 'slot_1', 'Slot One');
  saveLoad.saveGame(worldManager, gameState, 'slot_2', 'Slot Two');

  assert.equal(saveLoad.hasSave('slot_1'), true);
  assert.equal(saveLoad.hasSave('slot_2'), true);

  const saves = saveLoad.listSaves();
  assert.ok(saves.some(s => s.slotId === 'slot_1'));
  assert.ok(saves.some(s => s.slotId === 'slot_2'));

  // Delete slot_1
  const deleted = saveLoad.deleteSave('slot_1');
  assert.equal(deleted, true);
  assert.equal(saveLoad.hasSave('slot_1'), false);
  assert.equal(saveLoad.hasSave('slot_2'), true);

  worldManager.dispose();
});
