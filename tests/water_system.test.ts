import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WaterSystemModel } from '../src/world/water/WaterSystemModel';
import { TerrainModel } from '../src/world/TerrainModel';
import { GridSystem } from '../src/world/GridSystem';
import { TerrainGenerator } from '../src/world/TerrainGenerator';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';

test('Water 1: Water surface elevations and bed depths across all water body types', () => {
  const waterModel = new WaterSystemModel();

  assert.equal(WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, -0.15, 'Standard water surface is -0.15m');
  assert.equal(WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS, 0.65, 'Minimum bridge clearance is 0.65m');

  // 1. Retention Basin
  const pond = waterModel.waterBodies.find((wb) => wb.id === 'water_retention_pond');
  assert.ok(pond, 'Retention pond exists');
  assert.equal(pond.surfaceElevation, -0.15);
  assert.equal(pond.bedElevation, -0.45);
  assert.equal(pond.depthMeters, 0.30);

  // 2. Northwest River
  const river = waterModel.waterBodies.find((wb) => wb.id === 'water_northwest_river');
  assert.ok(river, 'River exists');
  assert.equal(river.surfaceElevation, -0.15);
  assert.equal(river.bedElevation, -0.45);
  assert.equal(river.depthMeters, 0.30);

  // 3. Eastern Maritime Deepwater Seaway
  const seaway = waterModel.waterBodies.find((wb) => wb.id === 'water_eastern_coastal');
  assert.ok(seaway, 'Eastern deepwater seaway exists');
  assert.equal(seaway.surfaceElevation, -0.15);
  assert.equal(seaway.bedElevation, -3.5);
  assert.ok(seaway.depthMeters >= 3.0, 'Deepwater port channel has at least 3.0m water depth');
});

test('Water 2: Shoreline boundary continuity and zero vertical gaps', () => {
  const terrainModel = new TerrainModel();
  const waterModel = terrainModel.waterSystem;

  // Land datum
  const landDatum = TerrainModel.DATUM_ELEVATION; // 0.0m
  assert.equal(landDatum, 0.0);

  for (const wb of waterModel.waterBodies) {
    const verticalDrop = landDatum - wb.surfaceElevation;
    assert.ok(
      verticalDrop >= 0.15,
      `Shoreline for '${wb.name}' recessed by at least 0.15m below ground (got ${verticalDrop}m)`
    );
  }

  // River Island crest elevation
  const islandX = -42.0;
  const islandZ = -42.0;
  assert.equal(waterModel.isWorldPointInWater(islandX, islandZ), false, 'Island crest is dry land');
});

test('Water 3: Navigability classification cleanly separates decorative water from shipping channels', () => {
  const waterModel = new WaterSystemModel();

  // Retention pond must be strictly non-navigable
  const pond = waterModel.waterBodies.find((wb) => wb.id === 'water_retention_pond')!;
  assert.equal(pond.isNavigable, false, 'Stormwater basin is non-navigable');
  assert.equal(pond.maxVesselDraftMeters, 0.0);

  // Northwest river is shallow
  const river = waterModel.waterBodies.find((wb) => wb.id === 'water_northwest_river')!;
  assert.equal(river.isNavigable, false, 'Inland river is not a commercial shipping route');

  // Eastern maritime channel is navigable
  const channel = waterModel.navigableChannels.find((c) => c.id === 'channel_eastern_coastal')!;
  assert.ok(channel, 'Commercial shipping channel defined');
  assert.equal(channel.isNavigable, true);
  assert.equal(channel.channelType, 'deepwater_shipping');
  assert.ok(channel.maxDraftMeters >= 2.5);
});

test('Water 4: Navigable channel waypoint trajectory and metric centerline continuity', () => {
  const waterModel = new WaterSystemModel();
  const channel = waterModel.navigableChannels[0];

  assert.ok(channel.centerlineWaypoints.length >= 4, 'Fairway has at least 4 transit waypoints');

  // Check continuity of waypoints along the channel corridor
  for (let i = 0; i < channel.centerlineWaypoints.length - 1; i++) {
    const wpCurrent = channel.centerlineWaypoints[i];
    const wpNext = channel.centerlineWaypoints[i + 1];

    const dx = wpNext.x - wpCurrent.x;
    const dz = wpNext.z - wpCurrent.z;
    const legDistance = Math.sqrt(dx * dx + dz * dz);

    assert.ok(legDistance > 0 && legDistance < 15.0, `Fairway leg ${i} length (${legDistance}m) is continuous`);
    assert.equal(wpCurrent.y, WaterSystemModel.STANDARD_WATER_SURFACE_DATUM);
  }

  // Nearest waypoint query
  const match = waterModel.getNearestChannelWaypoint(45.0, 15.0);
  assert.ok(match, 'Waypoint found near turning basin');
  assert.equal(match.waypoint.name, 'Terminal Berth Turning Basin');
  assert.ok(match.distance < 2.0);
});

test('Water 5: Vessel draft constraints and fairway depth clearance', () => {
  const waterModel = new WaterSystemModel();

  // 1. Standard coastal cargo vessel (draft 2.2m) navigating deepwater fairway at (45.5, 18.0)
  const navOk = waterModel.isNavigableAt(45.5, 18.0, 2.2);
  assert.equal(navOk.canNavigate, true, '2.2m draft vessel clears 3.0m channel');

  // 2. Overdraft ocean vessel (draft 4.0m) attempting transit
  const navOverdraft = waterModel.isNavigableAt(45.5, 18.0, 4.0);
  assert.equal(navOverdraft.canNavigate, false, 'Overdraft vessel is rejected');
  assert.ok(navOverdraft.reason?.includes('exceeds'));

  // 3. Attempting navigation in retention pond at (38.0, 30.0)
  const navPond = waterModel.isNavigableAt(38.0, 30.0, 0.5);
  assert.equal(navPond.canNavigate, false, 'Navigation in retention basin rejected');
});

test('Water 6: Eastern Port quay wall and berthing basin spatial geometry', () => {
  const waterModel = new WaterSystemModel();
  const berth = waterModel.portBerths.find((b) => b.id === 'berth_eastern_deepwater_01');

  assert.ok(berth, 'Eastern deepwater port berth #1 exists');
  assert.ok(berth.wharfFrontageLengthMeters >= 16.0, 'Wharf frontage >= 16.0m');
  assert.ok(berth.berthDepthMeters >= 3.0, 'Berth depth >= 3.0m');
  assert.ok(berth.bollardPositions.length >= 4, 'At least 4 mooring bollards installed');
  assert.ok(berth.fenderPositions.length >= 3, 'Rubber arch fenders installed');

  // Verify bollard elevations match wharf apron (+0.02m)
  for (const bollard of berth.bollardPositions) {
    assert.equal(bollard.y, 0.02, 'Bollards mounted on top of wharf apron');
    assert.ok(bollard.x >= 42.0 && bollard.x <= 42.5);
  }
});

test('Water 7: Navigational buoy markers and IALA channel delineation', () => {
  const waterModel = new WaterSystemModel();
  const channel = waterModel.navigableChannels[0];

  assert.ok(channel.buoyMarkers.length >= 4, 'Fairway marked by at least 4 buoys');

  const starboards = channel.buoyMarkers.filter((b) => b.type === 'starboard');
  const ports = channel.buoyMarkers.filter((b) => b.type === 'port');

  assert.equal(starboards.length, 2, '2 green starboard buoys');
  assert.equal(ports.length, 2, '2 red port buoys');

  // Starboard buoys on seaward side (higher X)
  for (const sb of starboards) {
    assert.ok(sb.worldX >= 47.0, 'Starboard buoy on outer seaward edge');
    assert.equal(sb.lightColor, 0x22c55e);
  }

  // Port buoys on landward side (lower X)
  for (const pt of ports) {
    assert.ok(pt.worldX <= 44.0, 'Port buoy on inner fairway edge');
    assert.equal(pt.lightColor, 0xef4444);
  }
});

test('Water 8: Bridge crossing vertical clearance above high water datum', () => {
  const waterModel = new WaterSystemModel();
  const bridge = waterModel.bridgeCrossings[0];

  assert.ok(bridge, 'Northern River bridge crossing exists');
  assert.equal(bridge.crossingType, 'road');
  assert.equal(bridge.waterSurfaceElevation, -0.15);
  assert.equal(bridge.deckElevation, 0.80);
  assert.equal(bridge.deckUndersideElevation, 0.55);

  const clearance = bridge.deckUndersideElevation - bridge.waterSurfaceElevation;
  assert.ok(clearance >= 0.65, `Vertical clearance (${clearance}m) satisfies >= 0.65m standard`);

  const validation = waterModel.validateBridgeClearance(bridge);
  assert.equal(validation.isValid, true);
  assert.equal(validation.clearanceMeters, clearance);
});

test('Water 9: Island shoreline integrity and dry ground protection', () => {
  const grid = new GridSystem();
  grid.applyNaturalTerrainFeatures();

  // Cell (1, 1) is Scenic River Island
  assert.equal(grid.terrainModel.isRiverIslandCell(1, 1), true);
  assert.equal(grid.terrainModel.isWaterCell(1, 1), false, 'Island is not a water cell');
  assert.equal(grid.getOccupancy(1, 1), 'empty', 'Island cell is buildable land');

  // Surrounding water cells must be marked obstacle
  assert.equal(grid.getOccupancy(0, 0), 'obstacle');
  assert.equal(grid.getOccupancy(0, 1), 'obstacle');
  assert.equal(grid.getOccupancy(0, 2), 'obstacle');
  assert.equal(grid.getOccupancy(1, 0), 'obstacle');
});

test('Water 10: Serialization and deterministic topology restoration', () => {
  const m1 = new WaterSystemModel();
  const m2 = new WaterSystemModel();

  const state1 = m1.serialize();
  const state2 = m2.serialize();

  assert.deepEqual(state1, state2, 'Water system serializes deterministically');

  // Full integration check via WorldManager
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  assert.ok(world.waterSystem, 'WorldManager provides direct waterSystem access');
  assert.equal(world.waterSystem.waterBodies.length, 3);
  assert.equal(world.waterSystem.navigableChannels.length, 1);
  assert.equal(world.waterSystem.portBerths.length, 1);
  assert.ok(world.waterSystem.bridgeCrossings.length >= 1, 'At least 1 bridge crossing exists');

  // Update loop ticks water animation cleanly
  world.update(0.016);

  world.dispose();
});
