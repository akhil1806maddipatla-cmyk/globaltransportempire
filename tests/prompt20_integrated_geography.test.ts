import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { EngineeringDiagnostics } from '../src/core/EngineeringDiagnostics';
import { LandParcelManager } from '../src/world/LandParcelManager';
import { WaterSystemModel } from '../src/world/water/WaterSystemModel';
import { TerrainModel } from '../src/world/TerrainModel';
import { SaveLoadManager } from '../src/game/SaveLoadManager';

test('Prompt 20 - Test 1: Full System Audit passing cleanly on world initialization', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const report = world.runEngineeringDiagnostics();
  assert.equal(report.isHealthy, true, 'Full world audit must be completely healthy');
  assert.equal(report.errors.length, 0, 'Zero errors detected in comprehensive audit');
  assert.ok(report.totalChecks >= 12, 'At least 12 distinct system checks executed');

  world.dispose();
});

test('Prompt 20 - Test 2: Terrain and water intersection validation', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const twRes = EngineeringDiagnostics.validateTerrainWaterIntersections(
    world.roadNetwork.model,
    world.entityRegistry,
    world.terrainModel
  );

  assert.equal(twRes.isValid, true, 'All roads and buildings respect water boundaries');
  assert.equal(twRes.issues.length, 0, 'Zero illegal water intrusions found');

  world.dispose();
});

test('Prompt 20 - Test 3: Bridge crossing civil alignment and vertical clearance', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const bridgeRes = EngineeringDiagnostics.validateBridgeAlignment(
    world.waterSystem,
    world.roadNetwork.model
  );

  assert.equal(bridgeRes.isValid, true, 'Bridge crossing alignment is valid');
  assert.equal(bridgeRes.issues.filter((i) => i.severity === 'error').length, 0);

  // Clearance verification
  const bridge = world.waterSystem.bridgeCrossings[0];
  assert.ok(bridge, 'Northern River Bridge exists');
  const clearance = bridge.deckUndersideElevation - bridge.waterSurfaceElevation;
  assert.ok(
    clearance >= WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS,
    `Clearance (${clearance}m) meets standard (${WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS}m)`
  );

  world.dispose();
});

test('Prompt 20 - Test 4: Building foundations and ground elevation contact', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const contactRes = EngineeringDiagnostics.validateBuildingTerrainContact(
    world.entityRegistry,
    world.terrainModel
  );

  assert.equal(contactRes.isValid, true, 'All buildings make stable ground contact');
  assert.equal(contactRes.issues.length, 0, 'No floating or submerged buildings');

  // Verify initial starter depot and facilities
  const depot = world.facilityManager.getPrimaryTruckDepot()!;
  assert.ok(depot, 'Starter depot exists');
  const worldPos = world.gridSystem.gridToWorldCenter(depot.gridX, depot.gridZ);
  const depotElevation = world.terrainModel.getElevationAt(worldPos.x, worldPos.z);
  assert.ok(depotElevation >= 0.0, 'Depot sits on level datum or pad');

  world.dispose();
});

test('Prompt 20 - Test 5: Depot entrance alignment and vehicle access validation', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const accessRes = EngineeringDiagnostics.validateDepotEntranceAndAccess(
    world.facilityManager,
    world.roadNetwork.model
  );

  assert.equal(accessRes.isValid, true, 'Depot entrance and roadway tie-in is valid');
  assert.equal(accessRes.issues.length, 0, 'Zero depot access obstructions');

  const depot = world.facilityManager.getPrimaryTruckDepot()!;
  const entrance = depot.getEntranceCoordinate();
  assert.equal(entrance.gridX, 12);
  assert.equal(entrance.gridZ, 12);

  world.dispose();
});

test('Prompt 20 - Test 6: Port berths and deepwater navigability validation', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const portRes = EngineeringDiagnostics.validatePortBerthsAndNavigability(
    world.waterSystem,
    world.transportNetwork
  );

  assert.equal(portRes.isValid, true, 'Port berth deepwater access is valid');
  assert.equal(portRes.issues.filter((i) => i.severity === 'error').length, 0);

  const berth = world.waterSystem.portBerths[0];
  assert.ok(berth.berthDepthMeters >= 3.0, 'Berth depth >= 3.0m');
  assert.ok(berth.bollardPositions.length >= 3, 'Mooring bollards installed');

  world.dispose();
});

test('Prompt 20 - Test 7: Land parcel buildability, ownership, and protected reserves', () => {
  const parcelManager = new LandParcelManager();
  const terrainModel = new TerrainModel();

  // 1. Starter Depot parcel is player owned and buildable
  const depotParcel = parcelManager.getParcel('parcel_starter_depot')!;
  assert.ok(depotParcel);
  assert.equal(depotParcel.ownership, 'player_owned');
  assert.equal(depotParcel.isBuildAllowed, true);
  assert.equal(depotParcel.terrainSuitability, 'suitable');

  const depotVal = parcelManager.validateParcelBuildability('parcel_starter_depot', terrainModel);
  assert.equal(depotVal.isValid, true);
  assert.equal(depotVal.dryCells, depotParcel.areaCells);

  // 2. Lake Serene Reserve is protected and non-buildable
  const lakeReserve = parcelManager.getParcel('parcel_lake_serene_reserve')!;
  assert.ok(lakeReserve);
  assert.equal(lakeReserve.ownership, 'protected_reserve');
  assert.equal(lakeReserve.isBuildAllowed, false);
  assert.equal(lakeReserve.terrainSuitability, 'protected_wetland');

  const reserveVal = parcelManager.validateParcelBuildability('parcel_lake_serene_reserve', terrainModel);
  assert.equal(reserveVal.isValid, false, 'Building prohibited on eco-reserve');
  assert.ok(reserveVal.reason?.includes('protected'));

  // 3. Unowned expansion plot requires purchase
  const permitUnowned = parcelManager.isBuildPermittedAt(18, 15);
  assert.equal(permitUnowned.permitted, false);
  assert.ok(permitUnowned.reason?.includes('Purchase required'));
});

test('Prompt 20 - Test 8: Sector boundary infrastructure continuity', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const sectorRes = EngineeringDiagnostics.validateSectorBoundaryContinuity(
    world.sectorManager,
    world.roadNetwork.model
  );

  assert.equal(sectorRes.isValid, true, 'Road network is continuous across sector boundaries');
  assert.equal(sectorRes.issues.length, 0);

  world.dispose();
});

test('Prompt 20 - Test 9: Representative inland, riverside, coastal, and island scenarios', () => {
  const terrainModel = new TerrainModel();

  // Inland Lake Serene & Pine Crest Island
  const lakeWater = terrainModel.getElevationAt(-25.0, -80.0);
  assert.equal(lakeWater, -0.15, 'Lake Serene water surface is -0.15m');

  // Pine Crest Island knoll
  const pineIslandElev = terrainModel.getElevationAt(-15.0, -80.0);
  assert.equal(pineIslandElev, 0.2, 'Pine Crest Island knoll is 0.2m');

  // Scenic River Island
  assert.equal(terrainModel.isRiverIslandCell(1, 1), true);
  assert.equal(terrainModel.isWaterCell(1, 1), false, 'River Island is dry land');

  // Coastal Deepwater Fairway
  const coastalFairway = terrainModel.waterSystem.isNavigableAt(45.5, 18.0, 2.0);
  assert.equal(coastalFairway.canNavigate, true, 'Deepwater port fairway is navigable');

  // Offshore Island: Pelican Isle
  const pelicanElev = terrainModel.getElevationAt(85.0, 12.0);
  assert.ok(pelicanElev > 0.0, 'Pelican Isle is dry ground above water');

  // Offshore Island: Lighthouse Rock
  const lighthouseElev = terrainModel.getElevationAt(78.0, -45.0);
  assert.ok(lighthouseElev > 0.0, 'Lighthouse Rock is dry granite above water');
});

test('Prompt 20 - Test 10: Save/load round-trip preserves complete integrated geography and diagnostic health', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const world1 = new WorldManager(scene1, gameState1);
  world1.initializeWorld();

  const saveLoad = new SaveLoadManager();
  const saveRes = saveLoad.saveGame(world1, gameState1, 'prompt20_geo_slot', 'Prompt 20 Save');
  assert.equal(saveRes.success, true);
  world1.dispose();

  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const world2 = new WorldManager(scene2, gameState2);
  world2.initializeWorld();

  const loadRes = saveLoad.loadGame(world2, gameState2, 'prompt20_geo_slot');
  assert.equal(loadRes.success, true);

  // Full system audit on loaded world
  const report = world2.runEngineeringDiagnostics();
  assert.equal(report.isHealthy, true, 'Loaded world passes comprehensive engineering audit');
  assert.equal(report.errors.length, 0);

  world2.dispose();
});
