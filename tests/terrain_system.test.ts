import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TerrainModel } from '../src/world/TerrainModel';
import { GridSystem } from '../src/world/GridSystem';
import { TerrainGenerator } from '../src/world/TerrainGenerator';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { PlacementValidator } from '../src/world/PlacementValidator';
import { RoadConstructionValidator } from '../src/world/RoadConstructionValidator';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';
import { ROAD_DEFINITIONS } from '../src/data/roadDefinitions';
import { INITIAL_WORLD_DATA } from '../src/data/initialWorldData';

test('Terrain 1: Terrain elevation limits and datum consistency', () => {
  const model = new TerrainModel();

  assert.equal(TerrainModel.DATUM_ELEVATION, 0.0, 'Raw plains datum is 0.0m');
  assert.equal(TerrainModel.WATER_SURFACE_ELEVATION, -0.15, 'Water surface sits at -0.15m');
  assert.equal(TerrainModel.WATER_BED_ELEVATION, -0.45, 'Water bed sits at -0.45m');
  assert.equal(TerrainModel.GRADED_PAD_ELEVATION, 0.02, 'Facility pads sit at +0.02m');
  assert.equal(TerrainModel.CORRIDOR_ELEVATION, 0.015, 'Transport corridors sit at +0.015m');
  assert.equal(TerrainModel.ROAD_SURFACE_ELEVATION, 0.04, 'Road surface sits at +0.04m');

  // Verify elevations through GridSystem
  const grid = new GridSystem();
  assert.equal(grid.getTerrainHeight(0, 0), 0.0, 'Central plains elevation is 0.0m');
});

test('Terrain 2: Water body surface elevation strictly below surrounding land', () => {
  const model = new TerrainModel();

  assert.ok(model.waterBodies.length >= 2, 'At least 2 distinct natural water bodies defined');

  for (const wb of model.waterBodies) {
    assert.ok(
      wb.surfaceElevation < TerrainModel.DATUM_ELEVATION,
      `Water surface of '${wb.name}' must be below land datum (got ${wb.surfaceElevation}m)`
    );
    assert.ok(
      wb.bedElevation < wb.surfaceElevation,
      `Bed of '${wb.name}' must be deeper than surface (got ${wb.bedElevation}m vs ${wb.surfaceElevation}m)`
    );
    const clearance = TerrainModel.DATUM_ELEVATION - wb.surfaceElevation;
    assert.ok(clearance >= 0.15, `Minimum clearance to surrounding land >= 0.15m (got ${clearance}m)`);
  }
});

test('Terrain 3: Road network cells remain strictly on dry land / graded terrain', () => {
  const model = new TerrainModel();

  // Test every segment in INITIAL_WORLD_DATA.roads
  for (const seg of INITIAL_WORLD_DATA.roads) {
    for (let i = 0; i < seg.length; i++) {
      const rx = seg.direction === 'horizontal' ? seg.gridX + i : seg.gridX;
      const rz = seg.direction === 'vertical' ? seg.gridZ + i : seg.gridZ;

      assert.equal(
        model.isWaterCell(rx, rz),
        false,
        `Initial road '${seg.id}' cell (${rx}, ${rz}) must not intersect natural water`
      );
    }
  }
});

test('Terrain 4: PlacementValidator blocks construction on natural water bodies and shorelines', () => {
  const grid = new GridSystem();
  grid.applyNaturalTerrainFeatures();
  const roadModel = new RoadNetworkModel(grid);
  const validator = new PlacementValidator(grid, roadModel);

  const def = BUILDING_DEFINITIONS['logistics_warehouse_sm'];

  // Cell (0, 1) is in the Northwest River
  const resRiver = validator.validate(def, 0, 1, 0, 100000);
  assert.equal(resRiver.isValid, false, 'Building on river channel must be rejected');
  assert.equal(resRiver.reasonCode, 'OCCUPIED_WATER_BODY');

  // Cell (20, 18) overlaps the Stormwater Retention Pond (20..22, 18..20)
  const resPond = validator.validate(def, 20, 18, 0, 100000);
  assert.equal(resPond.isValid, false, 'Building on retention pond must be rejected');
  assert.equal(resPond.reasonCode, 'OCCUPIED_WATER_BODY');
});

test('Terrain 5: RoadConstructionValidator blocks road paths intersecting water bodies', () => {
  const grid = new GridSystem();
  grid.applyNaturalTerrainFeatures();
  const roadModel = new RoadNetworkModel(grid);
  const validator = new RoadConstructionValidator(grid, roadModel);
  const roadDef = ROAD_DEFINITIONS['heavy_arterial'];

  // Route attempting to cross river at (0, 0) -> (0, 1)
  const path = [
    { x: 0, z: 0 },
    { x: 0, z: 1 },
  ];

  const res = validator.validatePath(path, roadDef, 50000);
  assert.equal(res.isValid, false, 'Road path across water body must be rejected');
  assert.equal(res.reasonCode, 'COLLIDES_WATER_BODY');
});

test('Terrain 6: Level 1 Starter Truck Depot rests on flat, stable graded foundation', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const starterDepot = world.facilityManager.getPrimaryTruckDepot();
  assert.ok(starterDepot, 'Starter depot exists');
  assert.equal(starterDepot.gridX, 12);
  assert.equal(starterDepot.gridZ, 13);
  assert.equal(starterDepot.getTotalCapacity(), 3, 'Starter depot has exactly 3 designated parking spaces');

  // Verify all footprint cells (12..15, 13..15) are on dry, buildable graded pad
  for (let x = 12; x < 12 + starterDepot.footprintWidth; x++) {
    for (let z = 13; z < 13 + starterDepot.footprintDepth; z++) {
      assert.equal(world.terrainModel.isWaterCell(x, z), false, `Depot cell (${x}, ${z}) is dry land`);
      assert.equal(world.terrainModel.isGradedPadCell(x, z), true, `Depot cell (${x}, ${z}) has engineered pad`);
    }
  }

  world.dispose();
});

test('Terrain 7: Scenic River Island at cell (1, 1) remains dry and accessible above water', () => {
  const model = new TerrainModel();

  assert.equal(model.isWaterCell(1, 1), false, 'River island cell (1, 1) must be dry land');
  assert.equal(model.isRiverIslandCell(1, 1), true, 'Cell (1, 1) recognized as river island');

  // Surrounding water cells
  assert.equal(model.isWaterCell(0, 1), true, 'West of island is water channel');
  assert.equal(model.isWaterCell(1, 0), true, 'North of island is water channel');
  assert.equal(model.isWaterCell(0, 0), true, 'Northwest of island is water channel');
});

test('Terrain 8: Reserved transport corridors maintain level grading', () => {
  const model = new TerrainModel();

  const rail = model.corridors.find((c) => c.mode === 'rail');
  assert.ok(rail, 'Northern Rail right-of-way corridor exists');
  assert.equal(rail.gradeElevation, 0.015, 'Rail corridor has +0.015m level grade');
  assert.ok(rail.cells.length >= 10, 'Rail corridor reserves continuous span');

  for (const cell of rail.cells) {
    assert.equal(model.isWaterCell(cell.gridX, cell.gridZ), false, 'Rail corridor cell must be dry land');
    assert.equal(model.isCorridorCell(cell.gridX, cell.gridZ), true);
  }

  const port = model.corridors.find((c) => c.mode === 'port');
  assert.ok(port, 'Eastern Port access corridor exists');
  assert.equal(port.gradeElevation, 0.015, 'Port corridor has +0.015m level grade');
});

test('Terrain 9: Deterministic terrain and natural feature generation', () => {
  const grid1 = new GridSystem();
  const mat1 = new MaterialsManager();
  const gen1 = new TerrainGenerator(grid1, mat1, 42);
  gen1.generate();

  const grid2 = new GridSystem();
  const mat2 = new MaterialsManager();
  const gen2 = new TerrainGenerator(grid2, mat2, 42);
  gen2.generate();

  // Validate deterministic mesh count
  assert.equal(gen1.group.children.length, gen2.group.children.length, 'Identical child count');

  // Verify group names match
  for (let i = 0; i < gen1.group.children.length; i++) {
    assert.equal(
      gen1.group.children[i].name,
      gen2.group.children[i].name,
      `Child ${i} name matches deterministically`
    );
  }

  gen1.dispose();
  gen2.dispose();
  mat1.dispose();
  mat2.dispose();
});

test('Terrain 10: Spatial queries and terrain classification across entire world', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  let plainsCount = 0;
  let waterCount = 0;
  let padCount = 0;
  let corridorCount = 0;

  for (let x = 0; x < 24; x++) {
    for (let z = 0; z < 24; z++) {
      const cls = world.getTerrainClassification(x, z);
      if (cls === 'plains') plainsCount++;
      else if (cls === 'water') waterCount++;
      else if (cls === 'graded_facility') padCount++;
      else if (cls === 'transport_corridor') corridorCount++;
    }
  }

  assert.ok(plainsCount > 0, 'Plains exist in playable area');
  assert.ok(waterCount >= 4, 'Water cells registered in grid');
  assert.ok(padCount >= 10, 'Engineered facility pads registered');
  assert.ok(corridorCount >= 20, 'Reserved corridors registered');
  assert.equal(plainsCount + waterCount + padCount + corridorCount, 24 * 24, 'All cells classified cleanly');

  world.dispose();
});
