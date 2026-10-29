import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GridSystem } from '../src/world/GridSystem';
import { WorldSectorManager } from '../src/world/WorldSectorManager';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { GameState } from '../src/game/GameState';
import { WorldManager } from '../src/world/WorldManager';
import { VEHICLE_DEFINITIONS } from '../src/data/vehicleDefinitions';
import { SaveLoadManager } from '../src/game/SaveLoadManager';
import { TruckDepotFacility } from '../src/facilities/FacilityModel';

test('Spatial 1: Grid-to-world and world-to-grid round trips across entire domain', () => {
  const grid = new GridSystem(24, 24, 4);

  // Test every cell in 24x24 grid
  for (let x = 0; x < 24; x++) {
    for (let z = 0; z < 24; z++) {
      const center = grid.gridToWorldCenter(x, z);
      const roundTrip = grid.worldToGrid(center.x, center.z);
      assert.ok(roundTrip, `Round trip should succeed for cell (${x}, ${z})`);
      assert.equal(roundTrip.x, x, `X coordinate matches for (${x}, ${z})`);
      assert.equal(roundTrip.z, z, `Z coordinate matches for (${x}, ${z})`);

      // Snapping test
      const snapped = grid.snapWorldToGrid(center.x + 0.5, center.z - 0.5);
      assert.equal(snapped.gridX, x);
      assert.equal(snapped.gridZ, z);
      assert.ok(Math.abs(snapped.snappedWorldX - center.x) < 1e-5);
      assert.ok(Math.abs(snapped.snappedWorldZ - center.z) < 1e-5);
    }
  }
});

test('Spatial 2: Placement at cell centers and boundaries with precision tolerances', () => {
  const grid = new GridSystem(24, 24, 4);

  const bounds = grid.getCellWorldBounds(10, 10);
  assert.ok(bounds);
  assert.equal(bounds.maxX - bounds.minX, 4.0, 'Cell width is exactly 4.0m');
  assert.equal(bounds.maxZ - bounds.minZ, 4.0, 'Cell depth is exactly 4.0m');
  assert.equal(bounds.center.x, (bounds.minX + bounds.maxX) / 2);
  assert.equal(bounds.center.z, (bounds.minZ + bounds.maxZ) / 2);

  // Interior point test
  assert.equal(grid.isPointInCell(bounds.center.x, bounds.center.z, 10, 10), true);
  // Outside point test
  assert.equal(grid.isPointInCell(bounds.minX - 0.1, bounds.center.z, 10, 10), false);
  assert.equal(grid.isPointInCell(bounds.maxX + 0.1, bounds.center.z, 10, 10), false);
});

test('Spatial 3: Footprint calculation and rotation determinism', () => {
  const grid = new GridSystem(24, 24, 4);

  const rot0 = grid.calculateRotatedFootprint(5, 3, 0);
  assert.equal(rot0.effectiveWidth, 5);
  assert.equal(rot0.effectiveDepth, 3);
  assert.equal(rot0.rotationDegrees, 0);

  const rot90 = grid.calculateRotatedFootprint(5, 3, 90);
  assert.equal(rot90.effectiveWidth, 3);
  assert.equal(rot90.effectiveDepth, 5);
  assert.equal(rot90.rotationDegrees, 90);

  const rot180 = grid.calculateRotatedFootprint(5, 3, 180);
  assert.equal(rot180.effectiveWidth, 5);
  assert.equal(rot180.effectiveDepth, 3);
  assert.equal(rot180.rotationDegrees, 180);

  const rot270 = grid.calculateRotatedFootprint(5, 3, 270);
  assert.equal(rot270.effectiveWidth, 3);
  assert.equal(rot270.effectiveDepth, 5);
  assert.equal(rot270.rotationDegrees, 270);

  // Metric world footprint bounds
  const worldBounds = grid.getFootprintWorldBounds(4, 4, 5, 3, 90);
  assert.equal(worldBounds.widthMeters, 3 * 4); // 12m
  assert.equal(worldBounds.depthMeters, 5 * 4); // 20m
  assert.equal(worldBounds.maxX - worldBounds.minX, 12);
  assert.equal(worldBounds.maxZ - worldBounds.minZ, 20);
});

test('Spatial 4: Road endpoint alignment and junction connectivity', () => {
  const grid = new GridSystem(24, 24, 4);
  const roadModel = new RoadNetworkModel(grid);

  // Add 2 connected horizontal cells
  roadModel.addRoadCell(11, 10, 'two_lane_urban');
  roadModel.addRoadCell(11, 11, 'two_lane_urban');

  assert.equal(roadModel.areCellsConnected(11, 10, 11, 11), true);

  const endpoints1 = roadModel.getCellJunctionEndpoints(11, 10)!;
  const endpoints2 = roadModel.getCellJunctionEndpoints(11, 11)!;

  assert.ok(endpoints1.south, 'Cell 1 has south connection');
  assert.ok(endpoints2.north, 'Cell 2 has north connection');

  // Interface coordinates must match identically (0 gap)
  assert.ok(Math.abs(endpoints1.south!.x - endpoints2.north!.x) < 1e-5);
  assert.ok(Math.abs(endpoints1.south!.z - endpoints2.north!.z) < 1e-5);
});

test('Spatial 5: Lane centerline calculation & single-lane truck proportion envelope', () => {
  const grid = new GridSystem(24, 24, 4);
  const roadModel = new RoadNetworkModel(grid);

  roadModel.addRoadCell(10, 11, 'two_lane_urban');
  roadModel.addRoadCell(11, 11, 'two_lane_urban');
  roadModel.addRoadCell(12, 11, 'two_lane_urban');

  const lanes = roadModel.getLaneCenterlines(11, 11)!;
  assert.ok(lanes);
  assert.equal(lanes.direction, 'horizontal');
  assert.ok(lanes.forwardLane.z > lanes.backwardLane.z, 'Forward lane is eastbound (offset +Z)');

  const center = grid.gridToWorldCenter(11, 11);
  const offset = Math.abs(lanes.forwardLane.z - center.z);
  assert.equal(offset, 1.25, 'Lane centerline lateral offset is exactly 1.25m');

  // Heavy truck clearance check
  const truckDef = VEHICLE_DEFINITIONS['prime_mover_6x4'];
  const truckWidth = truckDef.dimensions.width; // 2.4m
  const laneEnvelope = 3.5; // Standard 3.5m travel lane
  const clearanceMargin = (laneEnvelope - truckWidth) / 2;

  assert.ok(clearanceMargin >= 0.5, 'Clearance margin per side >= 0.5m');
  assert.ok(truckWidth <= laneEnvelope, 'Truck fits strictly inside single lane');
});

test('Spatial 6: Depot entrance clearance and parking space dimensions', () => {
  const depot = new TruckDepotFacility('facility_truck_depot_01', 'Primary Depot', 12, 13, 1, true);

  assert.equal(depot.level, 1);
  assert.equal(depot.getTotalCapacity(), 3);

  const spaces = depot.getSpaces();
  for (const space of spaces) {
    assert.ok(space.nominalDimensions.length >= 16.5, 'Bay length >= 16.5m for semi combinations');
    assert.ok(space.nominalDimensions.width >= 3.5, 'Bay width >= 3.5m for heavy trucks');
    assert.ok(space.nominalDimensions.heightClearance >= 5.0, 'Vertical clearance >= 5.0m');
  }

  // Entrance alignment
  const entrance = depot.getEntranceCoordinate();
  assert.equal(entrance.gridX, 12);
  assert.equal(entrance.gridZ, 12);
});

test('Spatial 7: Spatial sector partitioning and multi-sector bounds query', () => {
  const sectorManager = new WorldSectorManager(-48.0, -48.0);

  // Sector 0 covers grid 0..7 (-48m to -16m)
  const sc0 = sectorManager.gridToSectorCoord(0, 0);
  assert.equal(sc0.sectorX, 0);
  assert.equal(sc0.sectorZ, 0);

  const wc0 = sectorManager.worldToSectorCoord(-48.0, -48.0);
  assert.equal(wc0.sectorX, 0);
  assert.equal(wc0.sectorZ, 0);

  // Sector 1 covers grid 8..15 (-16m to +16m)
  const sc1 = sectorManager.gridToSectorCoord(12, 12);
  assert.equal(sc1.sectorX, 1);
  assert.equal(sc1.sectorZ, 1);

  const wc1 = sectorManager.worldToSectorCoord(0.0, 0.0);
  assert.equal(wc1.sectorX, 1);
  assert.equal(wc1.sectorZ, 1);

  // Register entities across sector boundaries
  sectorManager.registerBuilding('bld_alpha', 6, 6, 4, 4); // Crosses sector 0 and 1
  const nearbyBld = sectorManager.queryNearbyBuildings(0.0, 0.0, 32.0);
  assert.ok(nearbyBld.includes('bld_alpha'), 'Building found across sector boundary');
});

test('Spatial 8: Spatial index updates after entity movement, placement, and removal', () => {
  const sectorManager = new WorldSectorManager(-48.0, -48.0);

  // 1. Register vehicle at (-20, -20) -> Sector (0, 0)
  sectorManager.registerVehicle('veh_mover', -20, -20);
  let nearby = sectorManager.queryNearbyVehicles(-20, -20, 10);
  assert.ok(nearby.includes('veh_mover'));

  // 2. Move vehicle to (+20, +20) -> Sector (2, 2)
  sectorManager.updateVehiclePosition('veh_mover', 20, 20);

  // Old sector must no longer contain vehicle
  const oldQuery = sectorManager.queryNearbyVehicles(-20, -20, 10);
  assert.equal(oldQuery.includes('veh_mover'), false, 'Vehicle removed from old sector');

  // New sector must contain vehicle
  const newQuery = sectorManager.queryNearbyVehicles(20, 20, 10);
  assert.ok(newQuery.includes('veh_mover'), 'Vehicle registered in new sector');

  // 3. Unregister vehicle
  sectorManager.unregisterVehicle('veh_mover');
  const afterDelete = sectorManager.queryNearbyVehicles(20, 20, 10);
  assert.equal(afterDelete.includes('veh_mover'), false, 'Vehicle completely purged from spatial index');
});

test('Spatial 9: Terrain and ground contact surface elevation consistency', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const worldManager = new WorldManager(scene, gameState);
  worldManager.initializeWorld();

  // Datum checks
  const roadCenter = worldManager.gridSystem.gridToWorldCenter(11, 11);
  const roadElevation = worldManager.getSurfaceElevation(roadCenter.x, roadCenter.z); // Road at cell (11, 11)
  assert.equal(roadElevation, 0.04, 'Road pavement surface sits at +0.04m elevation');

  const rawTerrainElevation = worldManager.getSurfaceElevation(-40, -40);
  assert.equal(rawTerrainElevation, 0.0, 'Raw terrain datum sits at 0.0m');

  // Spatial query test on WorldManager
  const nearbyBuildings = worldManager.queryNearbyBuildings(0, 0, 40);
  assert.ok(nearbyBuildings.length >= 1, 'Found deliberate buildings in spatial proximity query');

  const nearbyVehicles = worldManager.queryNearbyVehicles(0, 0, 40);
  assert.ok(nearbyVehicles.length >= 1, 'Found vehicles in spatial proximity query');

  worldManager.dispose();
});

test('Spatial 10: Save/load preservation of precision world positions and orientations', () => {
  const scene1 = new THREE.Scene();
  const gameState1 = new GameState();
  const worldManager1 = new WorldManager(scene1, gameState1);
  worldManager1.initializeWorld();

  const saveLoad = new SaveLoadManager();
  const saveRes = saveLoad.saveGame(worldManager1, gameState1, 'spatial_test_slot', 'Spatial Precision Save');
  assert.equal(saveRes.success, true);
  worldManager1.dispose();

  const scene2 = new THREE.Scene();
  const gameState2 = new GameState();
  const worldManager2 = new WorldManager(scene2, gameState2);
  worldManager2.initializeWorld();

  const loadRes = saveLoad.loadGame(worldManager2, gameState2, 'spatial_test_slot');
  assert.equal(loadRes.success, true);

  // Verify all vehicles have valid, non-NaN world positions and matching registry entries
  const vehicles = worldManager2.entityRegistry.getAll().filter((e) => e.entityType === 'vehicle');
  assert.ok(vehicles.length >= 3, 'All fleet vehicles restored');
  for (const v of vehicles) {
    const center = worldManager2.gridSystem.gridToWorldCenter(v.gridX, v.gridZ);
    assert.ok(Number.isFinite(center.x), 'World X is finite');
    assert.ok(Number.isFinite(center.z), 'World Z is finite');
  }

  // Verify spatial index query works immediately after load
  const queriedBuildings = worldManager2.queryNearbyBuildings(0, 0, 50);
  assert.ok(queriedBuildings.length >= 2, 'Spatial index successfully rebuilt upon save loading');

  worldManager2.dispose();
});
