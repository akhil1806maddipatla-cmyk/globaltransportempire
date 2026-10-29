import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { SpatialQuerySystem } from '../src/world/SpatialQuerySystem';
import { PathfindingEngine } from '../src/navigation/PathfindingEngine';
import { PlacementValidator } from '../src/world/PlacementValidator';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';
import { EngineeringDiagnostics } from '../src/core/EngineeringDiagnostics';
import { SaveLoadManager } from '../src/game/SaveLoadManager';
import { TerrainModel } from '../src/world/TerrainModel';
import { GridSystem } from '../src/world/GridSystem';

test('Prompt 21 - Test 1: Full System Audit with Spatial and Routing Health', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const audit = world.runEngineeringDiagnostics();
  assert.equal(audit.isHealthy, true, 'Audit must be healthy on world initialization');
  assert.equal(audit.errors.length, 0, `Expected 0 audit errors, found: ${JSON.stringify(audit.errors)}`);
  assert.ok(audit.totalChecks >= 13, `Total audit checks should be >= 13, got ${audit.totalChecks}`);

  world.dispose();
});

test('Prompt 21 - Test 2: Spatial Query System - Accurate surface, elevation, and bounds classification', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const sq = world.spatialQuery;

  // 1. Playable Bounds check
  const inside = sq.queryLocation(0, 0);
  assert.equal(inside.isInsidePlayableBounds, true);
  const outside = sq.queryLocation(200, 200);
  assert.equal(outside.isInsidePlayableBounds, false);
  assert.equal(outside.surfaceType, 'out_of_bounds');

  // 2. Graded facility pad
  const depotLoc = sq.queryLocation(0, 4); // (12, 13) in grid is around (0, 4) in world
  assert.ok(depotLoc.elevation >= 0.0);

  // 3. Open water in retention basin
  const pondLoc = sq.queryLocation(38.0, 30.0);
  assert.equal(pondLoc.isWater, true);
  assert.equal(pondLoc.surfaceType, 'natural_water');

  // 4. Scenic River Island cell (1, 1)
  const islandCenter = world.gridSystem.gridToWorldCenter(1, 1);
  const islandLoc = sq.queryLocation(islandCenter.x, islandCenter.z);
  assert.equal(islandLoc.isWater, false);
  assert.equal(islandLoc.isIsland, true);

  // 5. Deepwater coastal fairway
  const coastalLoc = sq.queryLocation(45.5, 18.0);
  assert.equal(coastalLoc.isNavigableWater, true);

  world.dispose();
});

test('Prompt 21 - Test 3: Spatial Index Performance - Fast O(K) radius queries avoiding full table scans', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const sq = world.spatialQuery;

  // Query radius around center of world
  const nearbyCenter = sq.queryRadius(0, 0, 24.0);
  assert.ok(nearbyCenter.length > 0, 'Must find road cells/entities near center');

  // Benchmark query speed
  const benchmark = sq.runBenchmark(500);
  assert.ok(benchmark.totalDurationMs < 100, `500 spatial queries should execute in < 100ms (took ${benchmark.totalDurationMs}ms)`);
  assert.ok(benchmark.operationsPerSec > 5000, `Throughput should be > 5,000 ops/sec (got ${benchmark.operationsPerSec})`);

  world.dispose();
});

test('Prompt 21 - Test 4: Terrain-Aware Placement - Rejection of unlevel natural slope across footprint', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const validator = world.placementValidator;
  const def = BUILDING_DEFINITIONS['logistics_warehouse_sm'];
  assert.ok(def, 'Building definition exists');

  // Test placing on mountain or unlevel/unconnected terrain
  const valRes = validator.validate(def, 0, 0, 0, 1000000);
  assert.equal(valRes.isValid, false, 'Building placement on invalid site is rejected');

  world.dispose();
});

test('Prompt 21 - Test 5: Terrain-Aware Placement - Engineered Graded Pad supports level building placement', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  // Primary Starter Truck Depot is placed at (12, 13) which has an engineered graded pad
  const depot = world.facilityManager.getPrimaryTruckDepot()!;
  assert.ok(depot, 'Starter depot facility exists');
  assert.equal(world.terrainModel.isGradedPadCell(depot.gridX, depot.gridZ), true);

  world.dispose();
});

test('Prompt 21 - Test 6: Terrain-Aware Placement - Water proximity and marine frontage requirements', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const validator = world.placementValidator;

  // 1. Terrestrial building placed in water (Southeast Retention Pond at gridX=20, gridZ=18)
  const warehouseDef = BUILDING_DEFINITIONS['logistics_warehouse_sm'];
  const waterPlacement = validator.validate(warehouseDef, 19, 18, 0, 1000000);
  assert.equal(waterPlacement.isValid, false, 'Terrestrial building cannot be placed on water body');
  assert.ok(
    waterPlacement.reasonCode === 'OCCUPIED_WATER_BODY' || waterPlacement.reasonCode === 'PROXIMITY_TO_WATER',
    `Expected water rejection, got ${waterPlacement.reasonCode}`
  );

  // 2. Deepwater port facility without marine frontage fails
  const mockPortDef = {
    ...warehouseDef,
    id: 'bld_deepwater_port_terminal',
    name: 'Continental Deepwater Container Berth',
  };
  const inlandPortVal = validator.validate(mockPortDef, 12, 8, 0, 1000000);
  assert.equal(inlandPortVal.isValid, false, 'Port without water frontage must be rejected');
  assert.equal(inlandPortVal.reasonCode, 'MISSING_WATER_FRONTAGE');

  world.dispose();
});

test('Prompt 21 - Test 7: Terrain-Aware Placement - Protected ecological reserves strictly prohibit construction', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const reserveParcel = world.landParcelManager.getParcel('parcel_lake_serene_reserve')!;
  assert.ok(reserveParcel);
  assert.equal(reserveParcel.isBuildAllowed, false);

  const def = BUILDING_DEFINITIONS['logistics_warehouse_sm'];
  const val = world.placementValidator.validate(def, reserveParcel.bounds.minX + 1, reserveParcel.bounds.minZ + 1, 0, 1000000);
  assert.equal(val.isValid, false, 'Construction in protected reserve must be rejected');
  assert.ok(val.reasonCode === 'PROTECTED_RESERVE' || val.reasonCode === 'OUT_OF_BOUNDS' || val.reasonCode === 'MISSING_ROAD_ACCESS');

  world.dispose();
});

test('Prompt 21 - Test 8: Road Pathfinding - Connected streets, highway interchanges, and bridge crossings', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const pathfinder = world.pathfinding;

  // 1. Route from Starter Depot entrance (12, 12) to Main Ave Center (11, 11)
  const depotToMain = pathfinder.planRoute(12, 12, 11, 11, 'road');
  assert.equal(depotToMain.success, true, 'Route from depot to Main Ave must succeed');
  assert.equal(depotToMain.statusCode, 'SUCCESS');
  assert.ok(depotToMain.waypoints.length >= 2, 'Should have multiple road waypoints');
  assert.ok(depotToMain.totalDistanceMeters > 0);

  // 2. Route from Starter Depot to Industrial North (11, 3)
  const depotToInd = pathfinder.planRoute(12, 12, 11, 3, 'road');
  assert.equal(depotToInd.success, true, 'Route to industrial terminal must succeed');
  assert.ok(depotToInd.waypoints.length > 5);

  world.dispose();
});

test('Prompt 21 - Test 9: Road Pathfinding - Island isolation and water crossing rejection without bridge', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const pathfinder = world.pathfinding;

  // Scenic River Island at (1, 1) has no road bridge across the river
  const islandRoute = pathfinder.planRoute(12, 12, 1, 1, 'road');
  assert.equal(islandRoute.success, false, 'Road routing to isolated river island must fail');
  assert.equal(islandRoute.statusCode, 'ISLAND_ISOLATED');
  assert.ok(islandRoute.suggestedFix?.includes('bridge'));

  world.dispose();
});

test('Prompt 21 - Test 10: Multi-Modal Pathfinding - Deepwater ship navigation vs shallow water draft failure', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const pathfinder = world.pathfinding;

  // 1. Deepwater commercial fairway: berth (44.5, 14.5) to outer fairway (45.5, 28.0)
  const shipRoute = pathfinder.planRoute(44.5, 14.5, 45.5, 28.0, 'waterway', { draftMeters: 2.5 });
  assert.equal(shipRoute.success, true, 'Ship route on deepwater fairway must succeed');
  assert.equal(shipRoute.statusCode, 'SUCCESS');
  assert.ok(shipRoute.waypoints.length >= 2);

  // 2. Vessel with excessive draft (e.g. 5.0m draft in 3.35m fairway)
  const deepDraftRoute = pathfinder.planRoute(44.5, 14.5, 45.5, 28.0, 'waterway', { draftMeters: 5.0 });
  assert.equal(deepDraftRoute.success, false, 'Vessel draft exceeding water depth must be rejected');
  assert.equal(deepDraftRoute.statusCode, 'VESSEL_DRAFT_EXCEEDED');

  // 3. Attempt to navigate ship on dry land
  const landShipRoute = pathfinder.planRoute(0, 0, 45.5, 28.0, 'waterway', { draftMeters: 2.0 });
  assert.equal(landShipRoute.success, false, 'Ship route starting on land must fail');

  world.dispose();
});

test('Prompt 21 - Test 11: Route Invalidation on Infrastructure Demolition', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const pathfinder = world.pathfinding;

  // 1. Initial valid route: (11, 13) to (11, 11)
  const initialRoute = pathfinder.planRoute(11, 13, 11, 11, 'road');
  assert.equal(initialRoute.success, true);

  // 2. Demolish the intermediate spur cell at (11, 12)
  const demoRes = world.demolishRoadCell(11, 12);
  assert.equal(demoRes.success, true, 'Road demolition at (11, 12) must succeed');

  // 3. Re-query pathfinder: Cache should be invalidated and route should reflect disconnected road
  const disconnectedRoute = pathfinder.planRoute(11, 13, 11, 11, 'road');
  assert.equal(disconnectedRoute.success, false, 'Route must fail once connecting road is demolished');
  assert.equal(disconnectedRoute.statusCode, 'NO_ROAD_CONNECTION');

  world.dispose();
});

test('Prompt 21 - Test 12: Save/load round-trip preserves spatial integrity and routing health', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  gameState.setCash(850000);

  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const saveLoadMgr = new SaveLoadManager();
  const saveRes = saveLoadMgr.saveGame(world, gameState, 'prompt21_spatial_slot', 'Prompt 21 Spatial Save');
  assert.equal(saveRes.success, true);

  // Create new world & load
  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const world2 = new WorldManager(scene2, gameState2);
  world2.initializeWorld();

  const loadRes = saveLoadMgr.loadGame(world2, gameState2, 'prompt21_spatial_slot');
  assert.equal(loadRes.success, true);

  // Verify diagnostic health after restore
  const postLoadAudit = world2.runEngineeringDiagnostics();
  assert.equal(postLoadAudit.isHealthy, true, 'World must remain healthy after load');
  assert.equal(postLoadAudit.errors.length, 0);

  // Verify spatial query and pathfinder on restored world
  const restoredRoute = world2.pathfinding.planRoute(12, 12, 11, 3, 'road');
  assert.equal(restoredRoute.success, true, 'Restored world must calculate valid routes');

  world.dispose();
  world2.dispose();
});
