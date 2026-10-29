import test from 'node:test';
import assert from 'node:assert/strict';
import { GridSystem } from '../src/world/GridSystem';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { PlacementValidator } from '../src/world/PlacementValidator';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';
import { RoadPathGenerator } from '../src/world/RoadPathGenerator';
import { RoadConstructionValidator } from '../src/world/RoadConstructionValidator';
import { ROAD_DEFINITIONS } from '../src/data/roadDefinitions';
import { GameState } from '../src/game/GameState';
import { WorldManager } from '../src/world/WorldManager';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { CameraController } from '../src/rendering/CameraController';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { BuildingModularComponents } from '../src/entities/BuildingModularComponents';
import { DEFAULT_GAME_CONFIG } from '../src/app/GameConfig';
import * as THREE from 'three';

test('GridSystem - Coordinate conversions and snapping', () => {
  const grid = new GridSystem(40, 40, 2);

  // Cell (0, 0)
  const originCorner = grid.gridToWorldCorner(0, 0);
  assert.equal(originCorner.x, -40);
  assert.equal(originCorner.z, -40);

  const originCenter = grid.gridToWorldCenter(0, 0);
  assert.equal(originCenter.x, -39);
  assert.equal(originCenter.z, -39);

  // World to grid conversion
  const cell = grid.worldToGrid(-39, -39);
  assert.notEqual(cell, null);
  assert.equal(cell?.x, 0);
  assert.equal(cell?.z, 0);

  // Boundary snapping
  const snapped = grid.snapWorldToGrid(-38.2, -37.8);
  assert.equal(snapped.gridX, 0);
  assert.equal(snapped.gridZ, 1);

  // Out of bounds detection
  assert.equal(grid.isWithinBounds(-1, 0), false);
  assert.equal(grid.isWithinBounds(40, 40), false);
  assert.equal(grid.isWithinBounds(20, 20), true);
});

test('GridSystem - Rotated footprint calculation', () => {
  const grid = new GridSystem(40, 40, 2);

  // 4x3 building at 0 degrees -> 4 wide, 3 deep
  const fp0 = grid.calculateRotatedFootprint(4, 3, 0);
  assert.equal(fp0.effectiveWidth, 4);
  assert.equal(fp0.effectiveDepth, 3);

  // 4x3 building at 90 degrees -> 3 wide, 4 deep
  const fp90 = grid.calculateRotatedFootprint(4, 3, 90);
  assert.equal(fp90.effectiveWidth, 3);
  assert.equal(fp90.effectiveDepth, 4);

  // 4x3 building at 180 degrees -> 4 wide, 3 deep
  const fp180 = grid.calculateRotatedFootprint(4, 3, 180);
  assert.equal(fp180.effectiveWidth, 4);
  assert.equal(fp180.effectiveDepth, 3);

  // 4x3 building at 270 degrees -> 3 wide, 4 deep
  const fp270 = grid.calculateRotatedFootprint(4, 3, 270);
  assert.equal(fp270.effectiveWidth, 3);
  assert.equal(fp270.effectiveDepth, 4);
});

test('RoadNetworkModel - Neighbor connectivity and junction detection', () => {
  const grid = new GridSystem(40, 40, 2);
  const roadModel = new RoadNetworkModel(grid);

  // Create a straight road along Z=10 from X=5 to X=7
  roadModel.addRoadCell(5, 10, 'arterial');
  roadModel.addRoadCell(6, 10, 'arterial');
  roadModel.addRoadCell(7, 10, 'arterial');

  // Cell (5, 10) is a dead end connecting East
  const type5 = roadModel.getJunctionType(5, 10);
  assert.equal(type5, 'endpoint');

  // Cell (6, 10) is straight connecting West and East
  const type6 = roadModel.getJunctionType(6, 10);
  assert.equal(type6, 'straight_horizontal');

  // Add a branch heading North from (6, 10) at (6, 9)
  roadModel.addRoadCell(6, 9, 'secondary');

  // Cell (6, 10) now connects North, West, East -> T-junction
  const type6Branch = roadModel.getJunctionType(6, 10);
  assert.equal(type6Branch, 't_junction');

  // Add South branch at (6, 11) -> 4-way intersection
  roadModel.addRoadCell(6, 11, 'secondary');
  const type6Cross = roadModel.getJunctionType(6, 10);
  assert.equal(type6Cross, 'crossroad');

  // Connectivity validation
  const validation = roadModel.validateNetwork();
  assert.equal(validation.isValid, true);
  assert.equal(validation.roadCount, 5);
});

test('PlacementValidator - Overlap and road access rules', () => {
  const grid = new GridSystem(40, 40, 2);
  const roadModel = new RoadNetworkModel(grid);
  const validator = new PlacementValidator(grid, roadModel);

  // Lay road at (10, 10)
  roadModel.addRoadCell(10, 10, 'arterial');

  const def = BUILDING_DEFINITIONS['logistics_warehouse_sm']; // 4x3, requires road access

  // Case 1: Overlapping the road at (9, 10) -> Invalid due to road overlap
  const resOverlap = validator.validate(def, 9, 10, 0);
  assert.equal(resOverlap.isValid, false);
  assert.equal(resOverlap.reasonCode, 'OCCUPIED_ROAD');

  // Case 2: Placed away from any road (0, 0) -> Invalid due to missing road access
  const resNoAccess = validator.validate(def, 0, 0, 0);
  assert.equal(resNoAccess.isValid, false);
  assert.equal(resNoAccess.reasonCode, 'MISSING_ROAD_ACCESS');

  // Case 3: Placed adjacent to road at (10, 10) -> (10, 11) with size 4x3
  // Top edge (10, 11) to (13, 11) is adjacent to (10, 10)
  const resValid = validator.validate(def, 10, 11, 0);
  assert.equal(resValid.isValid, true);
  assert.equal(resValid.reasonCode, 'VALID');

  // Place the building and check collision
  grid.setAreaOccupancy(10, 11, 4, 3, 'building', 'bld_test');
  const resAlreadyOccupied = validator.validate(def, 10, 11, 0);
  assert.equal(resAlreadyOccupied.isValid, false);
  assert.equal(resAlreadyOccupied.reasonCode, 'OCCUPIED_BUILDING');
});

test('RoadPathGenerator - Orthogonal routing modes without diagonals', () => {
  // Test 1: Single point path
  const single = RoadPathGenerator.generatePath({ x: 5, z: 5 }, { x: 5, z: 5 });
  assert.equal(single.length, 1);
  assert.deepEqual(single[0], { x: 5, z: 5 });

  // Test 2: Horizontal-first routing from (2, 2) to (5, 4)
  // Horizontal: (2,2) -> (3,2) -> (4,2) -> (5,2) (4 cells)
  // Vertical: (5,3) -> (5,4) (2 cells) -> Total: 6 cells
  const pathH = RoadPathGenerator.generatePath({ x: 2, z: 2 }, { x: 5, z: 4 }, 'horizontal_first');
  assert.equal(pathH.length, 6);
  assert.deepEqual(pathH[0], { x: 2, z: 2 });
  assert.deepEqual(pathH[3], { x: 5, z: 2 });
  assert.deepEqual(pathH[5], { x: 5, z: 4 });

  // Test 3: Vertical-first routing from (2, 2) to (5, 4)
  // Vertical: (2,2) -> (2,3) -> (2,4) (3 cells)
  // Horizontal: (3,4) -> (4,4) -> (5,4) (3 cells) -> Total: 6 cells
  const pathV = RoadPathGenerator.generatePath({ x: 2, z: 2 }, { x: 5, z: 4 }, 'vertical_first');
  assert.equal(pathV.length, 6);
  assert.deepEqual(pathV[0], { x: 2, z: 2 });
  assert.deepEqual(pathV[2], { x: 2, z: 4 });
  assert.deepEqual(pathV[5], { x: 5, z: 4 });

  // Verify no duplicate coordinates
  const visited = new Set<string>();
  for (const cell of pathH) {
    const k = `${cell.x},${cell.z}`;
    assert.equal(visited.has(k), false, `Duplicate cell detected: ${k}`);
    visited.add(k);
  }
});

test('RoadConstructionValidator - Funds, obstacle collisions, and cost calculation', () => {
  const grid = new GridSystem(40, 40, 2);
  const roadModel = new RoadNetworkModel(grid);
  const validator = new RoadConstructionValidator(grid, roadModel);

  const def = ROAD_DEFINITIONS['two_lane_urban']; // $120 per cell

  // 1. Valid empty path of 5 cells with sufficient cash
  const path = [
    { x: 10, z: 10 },
    { x: 11, z: 10 },
    { x: 12, z: 10 },
    { x: 13, z: 10 },
    { x: 14, z: 10 },
  ];

  const resValid = validator.validatePath(path, def, 1000);
  assert.equal(resValid.isValid, true);
  assert.equal(resValid.totalCost, 5 * 120); // 600
  assert.equal(resValid.newCells.length, 5);
  assert.equal(resValid.existingCells.length, 0);

  // 2. Insufficient funds
  const resBroke = validator.validatePath(path, def, 500); // Needs 600, has 500
  assert.equal(resBroke.isValid, false);
  assert.equal(resBroke.reasonCode, 'INSUFFICIENT_FUNDS');

  // 3. Collision with building
  grid.setOccupancy(12, 10, 'building', 'bld_1');
  const resBuildingCollision = validator.validatePath(path, def, 1000);
  assert.equal(resBuildingCollision.isValid, false);
  assert.equal(resBuildingCollision.reasonCode, 'COLLIDES_BUILDING');
  grid.setOccupancy(12, 10, 'empty', null);

  // 4. Overlap with existing road: does not double charge for existing cells
  roadModel.addRoadCell(10, 10, 'two_lane_urban');
  roadModel.addRoadCell(11, 10, 'two_lane_urban');

  const resPartialOverlap = validator.validatePath(path, def, 1000);
  assert.equal(resPartialOverlap.isValid, true);
  assert.equal(resPartialOverlap.existingCells.length, 2);
  assert.equal(resPartialOverlap.newCells.length, 3);
  assert.equal(resPartialOverlap.totalCost, 3 * 120); // only 3 new cells = 360
});

test('RoadNetworkModel - Demolition and neighbor junction recalculation', () => {
  const grid = new GridSystem(40, 40, 2);
  const roadModel = new RoadNetworkModel(grid);

  // Build a 3-cell vertical road: (15, 10), (15, 11), (15, 12)
  roadModel.addRoadCell(15, 10, 'two_lane_urban');
  roadModel.addRoadCell(15, 11, 'two_lane_urban');
  roadModel.addRoadCell(15, 12, 'two_lane_urban');

  assert.equal(roadModel.getJunctionType(15, 10), 'endpoint');
  assert.equal(roadModel.getJunctionType(15, 11), 'straight_vertical');
  assert.equal(roadModel.getJunctionType(15, 12), 'endpoint');

  // Demolish center cell (15, 11)
  const removed = roadModel.removeRoadCell(15, 11);
  assert.equal(removed, true);
  assert.equal(roadModel.hasRoad(15, 11), false);
  assert.equal(grid.getOccupancy(15, 11), 'empty');

  // Neighbors (15, 10) and (15, 12) are now both isolated
  assert.equal(roadModel.getJunctionType(15, 10), 'isolated');
  assert.equal(roadModel.getJunctionType(15, 12), 'isolated');
});

test('Building Definitions - Integrity and dimension invariants', () => {
  const defs = Object.values(BUILDING_DEFINITIONS);
  assert.equal(defs.length >= 9, true, 'At least 9 distinct industrial facilities must be defined');

  for (const def of defs) {
    assert.ok(def.id && def.id.length > 0, 'Building ID must be defined');
    assert.ok(def.name && def.name.length > 0, 'Building name must be defined');
    assert.ok(def.footprintWidth >= 1 && def.footprintDepth >= 1, 'Footprint must have positive dimensions');
    assert.ok(def.cost >= 0, 'Construction cost must be non-negative');
    assert.ok(def.dailyUpkeep >= 0, 'Daily upkeep must be non-negative');
    assert.ok(def.height > 0, 'Height must be positive');
  }
});

test('PlacementValidator - Treasury funds and road access checks', () => {
  const grid = new GridSystem(40, 40, 2);
  const roadModel = new RoadNetworkModel(grid);
  const validator = new PlacementValidator(grid, roadModel);

  const def = BUILDING_DEFINITIONS['logistics_warehouse_sm']; // 4x3 cells, $45,000, requires road access

  // Create road at (10, 10)
  roadModel.addRoadCell(10, 10, 'two_lane_urban');

  // Case 1: Road connected, sufficient funds -> VALID
  const resValid = validator.validate(def, 10, 11, 0, 50000);
  assert.equal(resValid.isValid, true);
  assert.equal(resValid.reasonCode, 'VALID');
  assert.equal(resValid.cost, 45000);
  assert.equal(resValid.effectiveWidth, 4);
  assert.equal(resValid.effectiveDepth, 3);

  // Case 2: Insufficient funds ($30,000 < $45,000) -> INSUFFICIENT_FUNDS
  const resBroke = validator.validate(def, 10, 11, 0, 30000);
  assert.equal(resBroke.isValid, false);
  assert.equal(resBroke.reasonCode, 'INSUFFICIENT_FUNDS');

  // Case 3: Sufficient funds but no adjacent road -> MISSING_ROAD_ACCESS
  const resNoRoad = validator.validate(def, 25, 25, 0, 100000);
  assert.equal(resNoRoad.isValid, false);
  assert.equal(resNoRoad.reasonCode, 'MISSING_ROAD_ACCESS');

  // Case 4: Rotated 90 degrees -> width becomes 3, depth becomes 4
  const resRotated = validator.validate(def, 10, 11, 90, 50000);
  assert.equal(resRotated.isValid, true);
  assert.equal(resRotated.effectiveWidth, 3);
  assert.equal(resRotated.effectiveDepth, 4);
});

test('WorldManager - Atomic building placement and salvage demolition refund', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  gameState.setCash(100000); // Start with $100,000

  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const startingCash = gameState.getCash();
  const def = BUILDING_DEFINITIONS['freight_depot_modular']; // 3x2, cost $32,000

  // 1. Establish road at (20, 20)
  world.roadNetwork.model.addRoadCell(20, 20, 'two_lane_urban');

  // 2. Place building adjacent at (20, 21)
  const placeResult = world.placeBuilding(def.id, 20, 21, 0);
  assert.equal(placeResult.success, true);
  assert.ok(placeResult.entity, 'Building entity must be created');

  // Check funds deducted
  assert.equal(gameState.getCash(), startingCash - def.cost);

  // Check footprint cells occupied
  for (let x = 20; x < 20 + 3; x++) {
    for (let z = 21; z < 21 + 2; z++) {
      assert.equal(world.gridSystem.getOccupancy(x, z), 'building');
    }
  }

  // 3. Demolish building
  const buildingId = placeResult.entity.id;
  const demoResult = world.removeBuilding(buildingId);
  assert.equal(demoResult.success, true);
  assert.equal(demoResult.refund, Math.floor(def.cost * 0.5)); // $16,000

  // Check funds refunded
  assert.equal(gameState.getCash(), startingCash - def.cost + demoResult.refund);

  // Check cells released
  for (let x = 20; x < 20 + 3; x++) {
    for (let z = 21; z < 21 + 2; z++) {
      assert.equal(world.gridSystem.getOccupancy(x, z), 'empty');
    }
  }

  world.dispose();
});

test('EnvironmentalPropsManager - Non-obstruction of roads and entrances', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const props = world.environmentalProps.getProps();
  assert.ok(props.length > 0, 'Environmental props must be generated');

  // Verify each prop does not block active roads
  for (const prop of props) {
    const gridCoord = world.gridSystem.worldToGrid(prop.worldX, prop.worldZ);
    if (gridCoord) {
      // The prop center itself should not be inside an active drivable road cell
      // (Streetlights and signs are placed with safe offsets along curbs)
      if (prop.type === 'bollard' || prop.type === 'yard_storage') {
        const hasRoad = world.roadNetwork.model.hasRoad(gridCoord.x, gridCoord.z);
        assert.equal(
          hasRoad,
          false,
          `Prop ${prop.id} of type ${prop.type} should not occupy road cell (${gridCoord.x}, ${gridCoord.z})`
        );
      }
    }
  }

  world.dispose();
});

test('MaterialsManager & LightingSetup - PBR Materials, Streetlight Emissives, and Clean Cleanup', () => {
  const materials = new MaterialsManager();

  // 1. Verify essential materials exist
  const grassMat = materials.get('ground_grass_primary');
  assert.ok(grassMat, 'ground_grass_primary material must exist');

  const yardMat = materials.get('concrete_industrial_yard');
  assert.ok(yardMat, 'concrete_industrial_yard material must exist');

  const waterMat = materials.get('pond_water');
  assert.ok(waterMat, 'pond_water material must exist');

  const lampMat = materials.get<THREE.MeshStandardMaterial>('streetlight_lamp');
  assert.ok(lampMat, 'streetlight_lamp material must exist');
  assert.equal(lampMat.emissiveIntensity, 0.0, 'Day mode should have 0 emissive intensity');

  // 2. Test lighting presets
  materials.setStreetlightsEmissive(1.5);
  assert.equal(lampMat.emissiveIntensity, 1.5, 'Golden hour should have 1.5 emissive intensity');

  materials.setStreetlightsEmissive(3.0);
  assert.equal(lampMat.emissiveIntensity, 3.0, 'Dusk mode should have 3.0 emissive intensity');

  materials.setStreetlightsEmissive(0.0);
  assert.equal(lampMat.emissiveIntensity, 0.0, 'Day reset should return to 0.0');

  // 3. Test disposal
  materials.dispose();
});

test('CameraController - Zoom limits, zoom-to-cursor, and bounds clamping', () => {
  const mockDom = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLElement;

  const camController = new CameraController(mockDom, 800 / 600);

  // Initial distance
  assert.equal(camController.getCurrentDistance(), DEFAULT_GAME_CONFIG.camera.initialDistance);

  // Zoom in multiple times
  for (let i = 0; i < 15; i++) {
    camController.zoomIn();
  }
  // Step simulation forward
  for (let f = 0; f < 30; f++) {
    camController.update(0.05);
  }
  // Must respect minDistance
  assert.ok(camController.getCurrentDistance() >= DEFAULT_GAME_CONFIG.camera.minDistance, 'Zoom cannot penetrate ground below minDistance');

  // Zoom out multiple times
  for (let i = 0; i < 25; i++) {
    camController.zoomOut();
  }
  for (let f = 0; f < 30; f++) {
    camController.update(0.05);
  }
  // Must respect maxDistance
  assert.ok(camController.getCurrentDistance() <= DEFAULT_GAME_CONFIG.camera.maxDistance, 'Zoom cannot exceed maxDistance');

  // Test bounds clamping on extreme coordinates
  camController.focusOn(500, -500);
  const target = camController.getDesiredTarget();
  assert.ok(target.x <= DEFAULT_GAME_CONFIG.camera.bounds.maxX && target.x >= DEFAULT_GAME_CONFIG.camera.bounds.minX, `Clamped X must be within bounds, got ${target.x}`);
  assert.ok(target.z <= DEFAULT_GAME_CONFIG.camera.bounds.maxZ && target.z >= DEFAULT_GAME_CONFIG.camera.bounds.minZ, `Clamped Z must be within bounds, got ${target.z}`);

  camController.dispose();
});

test('CameraController - Orbital 45° rotation and intelligent focus targeting', () => {
  const mockDom = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLElement;

  const camController = new CameraController(mockDom, 800 / 600);

  // Initial yaw is Math.PI / 4 (45 degrees)
  assert.equal(Math.round(camController.getCurrentYaw() * 1000), Math.round((Math.PI / 4) * 1000));

  // Rotate Left (adds PI / 4)
  camController.rotateLeft();
  for (let f = 0; f < 40; f++) {
    camController.update(0.05);
  }
  assert.equal(Math.round(camController.getCurrentYaw() * 100) / 100, Math.round((Math.PI / 2) * 100) / 100);

  // Rotate Right twice
  camController.rotateRight();
  camController.rotateRight();
  for (let f = 0; f < 40; f++) {
    camController.update(0.05);
  }
  assert.equal(Math.round(camController.getCurrentYaw() * 100) / 100, 0);

  // Test intelligent focus with custom zoom
  camController.focusOn(10, 15, 25);
  for (let f = 0; f < 40; f++) {
    camController.update(0.05);
  }
  const curTarget = camController.getCurrentTarget();
  assert.equal(Math.round(curTarget.x), 10);
  assert.equal(Math.round(curTarget.z), 15);
  assert.equal(Math.round(camController.getCurrentDistance()), 25);

  // Reset view
  camController.resetView();
  for (let f = 0; f < 40; f++) {
    camController.update(0.05);
  }
  const resetTarget = camController.getCurrentTarget();
  assert.equal(Math.round(resetTarget.x), 0);
  assert.equal(Math.round(resetTarget.z), 0);
  assert.equal(Math.round(camController.getCurrentDistance()), Math.round(DEFAULT_GAME_CONFIG.camera.initialDistance));

  camController.dispose();
});

test('Building Architecture - High-detail models, modular assemblies, and rotation integrity', () => {
  const materials = new MaterialsManager();

  // 1. Verify Modular Components Factory
  const dock = BuildingModularComponents.createLoadingDock(materials);
  assert.ok(dock.children.length >= 4, 'Loading dock must have multiple functional parts (shelter, door, leveler, bumpers)');

  const hvac = BuildingModularComponents.createRooftopHVAC(materials, 'medium');
  assert.ok(hvac.children.length >= 3, 'HVAC must include casing, fans, and mounting rails');

  const parapet = BuildingModularComponents.createRoofParapet(
    6,
    4,
    0.5,
    0.15,
    materials.get('metal_corrugated_siding'),
    materials.get('metal_roof_silver')
  );
  assert.ok(parapet.children.length >= 8, 'Parapet must have 4 perimeter walls and 4 coping trims');

  const silo = BuildingModularComponents.createIndustrialSilo(materials, 0.8, 3.5);
  assert.ok(silo.children.length >= 5, 'Silo must have legs, hopper, cylinder, conical roof, and fill pipe');

  const stack = BuildingModularComponents.createIndustrialSmokestack(materials, 5.0, 0.3);
  assert.ok(stack.children.length >= 4, 'Smokestack must have stack body, hazard bands, and aviation beacon');

  // 2. Verify all building catalogue definitions instantiate with layered geometry
  const defs = Object.values(BUILDING_DEFINITIONS);
  assert.ok(defs.length >= 9, 'Should have at least 9 building types in catalogue');

  for (const def of defs) {
    // Standard rotation 0°
    const entity0 = new BuildingEntity(
      `test_${def.id}_0`,
      def,
      10,
      10,
      20,
      20,
      materials,
      0
    );
    assert.ok(entity0.group.children.length >= 3, `${def.id} must have layered sub-meshes`);
    assert.equal(entity0.width, def.footprintWidth);
    assert.equal(entity0.depth, def.footprintDepth);

    // Rotated 90°
    const entity90 = new BuildingEntity(
      `test_${def.id}_90`,
      def,
      10,
      10,
      20,
      20,
      materials,
      90
    );
    // Effective width and depth should swap
    assert.equal(entity90.width, def.footprintDepth);
    assert.equal(entity90.depth, def.footprintWidth);

    entity0.dispose();
    entity90.dispose();
  }

  materials.dispose();
});


