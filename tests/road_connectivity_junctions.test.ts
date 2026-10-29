import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { RoadIntersectionFactory } from '../src/world/RoadIntersectionFactory';
import { GridSystem } from '../src/world/GridSystem';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { PathfindingEngine } from '../src/navigation/PathfindingEngine';
import { RoadNetworkDiagnostics } from '../src/world/RoadNetworkDiagnostics';
import { RoadConstructionValidator } from '../src/world/RoadConstructionValidator';
import { ROAD_DEFINITIONS } from '../src/data/roadDefinitions';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';

test('Prompt 22 - Scenario 1: Simple two-road connection with symmetrical endpoints', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);

  // Place two adjacent road cells
  roadModel.addRoadCell(0, 0, 'two_lane_urban');
  roadModel.addRoadCell(1, 0, 'two_lane_urban');

  const cellA = roadModel.getRoadCell(0, 0);
  const cellB = roadModel.getRoadCell(1, 0);

  assert.ok(cellA, 'Cell A must exist');
  assert.ok(cellB, 'Cell B must exist');

  // Verify reciprocal connection
  assert.equal(cellA.connections.east, true, 'Cell A must connect east to B');
  assert.equal(cellB.connections.west, true, 'Cell B must connect west to A');
  assert.equal(cellA.junctionType, 'endpoint', '1-connection cell is an endpoint');
  assert.equal(cellB.junctionType, 'endpoint', '1-connection cell is an endpoint');

  // Physical junction endpoints
  const endpointsA = roadModel.getCellJunctionEndpoints(0, 0);
  const endpointsB = roadModel.getCellJunctionEndpoints(1, 0);
  assert.ok(endpointsA?.east, 'Cell A must have east endpoint');
  assert.ok(endpointsB?.west, 'Cell B must have west endpoint');
  assert.equal(endpointsA.east?.x, endpointsB.west?.x, 'Endpoints must share identical seam X coordinate');
  assert.equal(endpointsA.east?.z, endpointsB.west?.z, 'Endpoints must share identical seam Z coordinate');

  // Connection validation
  const validation = roadModel.validateConnection(0, 0, 1, 0);
  assert.equal(validation.canConnect, true, 'Connection between adjacent road cells must be valid');
});

test('Prompt 22 - Scenario 2: T-junction and 4-way intersection node degrees and orientation', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  const materials = new MaterialsManager();

  // Build a T-junction: stem at (5, 6) meeting through-road at (5, 5), with arms at (4, 5) and (6, 5)
  roadModel.addRoadCell(5, 5, 'heavy_arterial');
  roadModel.addRoadCell(4, 5, 'heavy_arterial');
  roadModel.addRoadCell(6, 5, 'heavy_arterial');
  roadModel.addRoadCell(5, 6, 'two_lane_urban');

  const tCell = roadModel.getRoadCell(5, 5);
  assert.ok(tCell);
  assert.equal(tCell.junctionType, 't_junction', 'Intersection of 3 roads must classify as t_junction');
  assert.equal(tCell.connections.west, true);
  assert.equal(tCell.connections.east, true);
  assert.equal(tCell.connections.south, true);
  assert.equal(tCell.connections.north, false);

  // Build a 4-way crossroad: add north arm at (5, 4)
  roadModel.addRoadCell(5, 4, 'heavy_arterial');
  const crossCell = roadModel.getRoadCell(5, 5);
  assert.ok(crossCell);
  assert.equal(crossCell.junctionType, 'crossroad', 'Intersection of 4 roads must classify as crossroad');
  assert.equal(crossCell.connections.north, true);
  assert.equal(crossCell.connections.south, true);
  assert.equal(crossCell.connections.east, true);
  assert.equal(crossCell.connections.west, true);

  // Verify procedural 3D intersection meshes can be created without runtime error
  const crossGroup = new THREE.Group();
  RoadIntersectionFactory.buildCrossroad(crossGroup, crossCell, 4.0, materials);
  assert.ok(crossGroup.children.length > 0, 'Crossroad mesh must include curbs, stop bars and center marker');

  const tGroup = new THREE.Group();
  RoadIntersectionFactory.buildTJunction(tGroup, {
    ...crossCell,
    connections: { north: false, south: true, east: true, west: true },
    junctionType: 't_junction',
  }, 4.0, materials);
  assert.ok(tGroup.children.length > 0, 'T-junction 3D mesh must be generated');
});

test('Prompt 22 - Scenario 3: Roads of different widths and hierarchies meeting at a junction', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);

  // Highway corridor meeting heavy arterial
  roadModel.addRoadCell(5, 5, 'highway_corridor');
  roadModel.addRoadCell(5, 6, 'highway_corridor');
  roadModel.addRoadCell(6, 5, 'heavy_arterial'); // merge ramp approach

  const highwayCell = roadModel.getRoadCell(5, 5);
  const arterialCell = roadModel.getRoadCell(6, 5);

  assert.ok(highwayCell);
  assert.ok(arterialCell);
  assert.equal(highwayCell.speedLimitKmH, 110, 'Highway corridor must have 110 km/h speed limit');
  assert.equal(arterialCell.speedLimitKmH, 75, 'Arterial road must have 75 km/h speed limit');
  assert.equal(highwayCell.laneCount, 4, 'Highway corridor must have 4 lanes');
  assert.equal(arterialCell.laneCount, 2, 'Arterial road must have 2 lanes');

  // Verify junction metadata can specify hierarchy transitions
  roadModel.setJunctionMetadata(5, 5, {
    throughAxis: 'vertical',
    rampMergeDirection: 'merge_on',
  });

  assert.equal(roadModel.getRoadCell(5, 5)?.junctionMetadata?.rampMergeDirection, 'merge_on');
});

test('Prompt 22 - Scenario 4: Curved road connected to straight road with corner fillets', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  const materials = new MaterialsManager();

  // Form a 90-degree corner: (10, 10) connects south to (10, 11) and east to (11, 10)
  roadModel.addRoadCell(10, 10, 'two_lane_urban');
  roadModel.addRoadCell(10, 11, 'two_lane_urban');
  roadModel.addRoadCell(11, 10, 'two_lane_urban');

  const cornerCell = roadModel.getRoadCell(10, 10);
  assert.ok(cornerCell);
  assert.equal(cornerCell.junctionType, 'corner_se', 'Connecting south and east forms corner_se');
  assert.equal(cornerCell.connections.south, true);
  assert.equal(cornerCell.connections.east, true);

  // Check curved corner procedural mesh generation
  const cornerGroup = new THREE.Group();
  RoadIntersectionFactory.buildCurvedCorner(cornerGroup, cornerCell, 4.0, materials);
  assert.ok(cornerGroup.children.length >= 2, 'Corner mesh must contain inner and outer curb arcs');
});

test('Prompt 22 - Scenario 5: Highway ramp connecting to local road and carriageway with grade separation check', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  const materials = new MaterialsManager();

  // Surface road at (20, 20) with elevation 0.04
  roadModel.addRoadCell(20, 20, 'two_lane_urban');
  roadModel.setRoadElevationAndLayer(20, 20, 0.04, 'surface');

  // Elevated overpass road at (20, 21) with elevation 1.20 (grade separation > 0.60m)
  roadModel.addRoadCell(20, 21, 'highway_corridor');
  roadModel.setRoadElevationAndLayer(20, 21, 1.20, 'elevated');

  // Validate connection between (20, 20) and (20, 21)
  const validation = roadModel.validateConnection(20, 20, 20, 21);
  assert.equal(validation.canConnect, false, 'Direct connection across 1.16m elevation delta without ramp must be rejected');
  assert.match(validation.reason || '', /Grade separation mismatch/);

  // Configure a highway merge/diverge cell with merge metadata
  roadModel.setJunctionMetadata(20, 21, {
    rampMergeDirection: 'merge_on',
  });
  const rampGroup = new THREE.Group();
  RoadIntersectionFactory.buildHighwayMerge(rampGroup, roadModel.getRoadCell(20, 21)!, 4.0, materials);
  assert.ok(rampGroup.children.length > 0, 'Highway merge gore area mesh must be generated');
});

test('Prompt 22 - Scenario 6: Bridge with correctly aligned approach roads', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  const materials = new MaterialsManager();

  // Road alignment: Approach (15, 0) -> Bridge Span (16, 0) -> Bridge Span (17, 0) -> Approach (18, 0)
  roadModel.addRoadCell(15, 0, 'heavy_arterial');
  roadModel.addRoadCell(16, 0, 'heavy_arterial');
  roadModel.addRoadCell(17, 0, 'heavy_arterial');
  roadModel.addRoadCell(18, 0, 'heavy_arterial');

  roadModel.setRoadElevationAndLayer(15, 0, 0.40, 'surface');
  roadModel.setJunctionMetadata(15, 0, { isBridgeApproach: true });

  roadModel.setRoadElevationAndLayer(16, 0, 0.80, 'bridge');
  roadModel.setRoadElevationAndLayer(17, 0, 0.80, 'bridge');

  roadModel.setRoadElevationAndLayer(18, 0, 0.40, 'surface');
  roadModel.setJunctionMetadata(18, 0, { isBridgeApproach: true });

  // Approach to bridge span connection validation (bridge approach allows up to 0.60m slope transition)
  const approachCheck = roadModel.validateConnection(15, 0, 16, 0);
  assert.equal(approachCheck.canConnect, true, 'Bridge approach with transition slope must connect to bridge deck');

  // Bridge deck to bridge deck
  const spanCheck = roadModel.validateConnection(16, 0, 17, 0);
  assert.equal(spanCheck.canConnect, true, 'Adjacent bridge deck spans at same elevation must connect cleanly');

  // Build bridge approach mesh
  const bridgeGroup = new THREE.Group();
  RoadIntersectionFactory.buildBridgeApproach(bridgeGroup, roadModel.getRoadCell(15, 0)!, 4.0, materials);
  assert.ok(bridgeGroup.children.length >= 2, 'Bridge approach transition mesh must be generated with wing walls and expansion joint');
});

test('Prompt 22 - Scenario 7: Road junction near river or steep terrain respects civil gradients', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  const validator = new RoadConstructionValidator(grid, roadModel);

  // Test excessive slope gradient check
  let heightA = 0.0;
  let heightB = 1.2; // 1.2m delta over 4m cell is 30% slope
  grid.getTerrainHeight = (x: number, z: number) => (x > -4 ? heightB : heightA);

  const path = [{ x: 10, z: 10 }, { x: 11, z: 10 }];
  const highwayDef = ROAD_DEFINITIONS['highway_corridor'];

  const validation = validator.validatePath(path, highwayDef, 100000);
  assert.equal(validation.isValid, false, 'Road path with excessive slope delta must be rejected for highway');
  assert.equal(validation.reasonCode, 'EXCESSIVE_ROAD_SLOPE');
  assert.match(validation.message, /exceeds civil design limits/);

  // Normal slope (< 0.45m delta) succeeds
  heightB = 0.2;
  const validPath = validator.validatePath(path, highwayDef, 100000);
  assert.equal(validPath.isValid, true, 'Gentle 0.2m slope delta must be accepted');
});

test('Prompt 22 - Scenario 8: Truck turning kinematics and swept-path off-tracking clearance', () => {
  const pathfinder = new PathfindingEngine();

  // Test heavy semi-truck: 12.5m wheelbase turning at 8m radius
  const offTracking = pathfinder.calculateSweptPathOffTracking(12.5, 8.0);
  assert.ok(offTracking > 5.0, 'Trailer off-tracking must be substantial for sharp turns');

  // Test validateVehicleTurnClearance
  const clearanceCheck = pathfinder.validateVehicleTurnClearance(
    { x: 10, y: 0.04, z: 10 },
    { x: 10, y: 0.04, z: 11 },
    { x: 11, y: 0.04, z: 11 },
    12.5,
    3.0 // 3.0m lane width
  );
  assert.ok(clearanceCheck !== undefined, 'Turn clearance calculation must return assessment');
  assert.ok(clearanceCheck.sweptPathWidthMeters > 3.0, 'Total swept path exceeds single lane width, requiring apron');

  // Test turn arc waypoints generation
  const arcWaypoints = pathfinder.generateTurnArcWaypoints(
    { x: 10, y: 0.04, z: 9 },
    { x: 10, y: 0.04, z: 10 },
    { x: 11, y: 0.04, z: 10 },
    0.35
  );
  assert.equal(arcWaypoints.length, 3, 'Arc waypoints must include entry tangent, corner apex, and exit tangent');
  assert.ok(arcWaypoints[1].x > 10.0 && arcWaypoints[1].z < 10.0, 'Corner apex must cut inside corner arc smoothly');
});

test('Prompt 22 - Scenario 9: Starter Truck Depot access from connected road at (12, 13)', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const facilityManager = world.facilityManager;
  const roadModel = world.roadNetwork.model;

  // 1. Starter depot invariant: verified singleton Level 1 Truck Depot
  const depot = facilityManager.getPrimaryTruckDepot();
  assert.ok(depot, 'Starter depot must exist at (12, 13)');
  assert.equal(depot.gridX, 12);
  assert.equal(depot.gridZ, 13);
  assert.equal(depot.getTotalCapacity(), 3, 'Starter depot must have exactly 3 truck spaces');

  // 2. Road connection to depot entrance
  const adjacentRoads = [
    roadModel.getRoadCell(11, 14),
    roadModel.getRoadCell(11, 13),
    roadModel.getRoadCell(12, 12),
    roadModel.getRoadCell(12, 14),
  ].filter((c) => c !== undefined);

  assert.ok(adjacentRoads.length > 0, 'Starter depot must have adjacent access road for vehicle dispatch');

  // 3. Network diagnostics check
  const diagnostics = world.runRoadNetworkAudit();
  assert.ok(diagnostics, 'Road network audit must complete');
  assert.equal(diagnostics.depotAccessVerified, true, 'Starter depot must be verified as fully accessible');
});

test('Prompt 22 - Scenario 10: Road editing, demolition, and junction recalculation', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);

  // Build a line of 3 cells: (0, 0), (0, 1), (0, 2)
  roadModel.addRoadCell(0, 0, 'two_lane_urban');
  roadModel.addRoadCell(0, 1, 'two_lane_urban');
  roadModel.addRoadCell(0, 2, 'two_lane_urban');

  assert.equal(roadModel.getRoadCell(0, 1)?.junctionType, 'straight_vertical');

  // Add an east branch to turn (0, 1) into a T-junction
  roadModel.addRoadCell(1, 1, 'two_lane_urban');
  assert.equal(roadModel.getRoadCell(0, 1)?.junctionType, 't_junction');
  assert.equal(roadModel.getRoadCell(0, 1)?.connections.east, true);

  // Demolish the east branch (1, 1)
  const removeSuccess = roadModel.removeRoadCell(1, 1);
  assert.equal(removeSuccess, true, 'Demolition of (1, 1) must succeed');
  assert.equal(roadModel.hasRoad(1, 1), false);

  // Verify (0, 1) automatically recalculates back to 'straight_vertical'
  const centerCell = roadModel.getRoadCell(0, 1);
  assert.ok(centerCell);
  assert.equal(centerCell.junctionType, 'straight_vertical', 'Center cell must revert to straight upon demolition of branch');
  assert.equal(centerCell.connections.east, false, 'East connection must be cleanly removed');
});

test('Prompt 22 - Scenario 11: Save/load persistence of road connections, layers, elevations, and junction metadata', () => {
  const grid = new GridSystem();
  const roadModel1 = new RoadNetworkModel(grid);

  // Place roads with rich metadata
  roadModel1.addRoadCell(2, 2, 'heavy_arterial');
  roadModel1.setRoadElevationAndLayer(2, 2, 0.45, 'elevated');
  roadModel1.setJunctionMetadata(2, 2, {
    throughAxis: 'horizontal',
    isBridgeApproach: false,
  });

  roadModel1.addRoadCell(3, 2, 'heavy_arterial');
  roadModel1.setRoadElevationAndLayer(3, 2, 0.80, 'bridge');
  roadModel1.setJunctionMetadata(3, 2, {
    isBridgeApproach: true,
  });

  // Serialize
  const serialized = roadModel1.serialize() as any;
  assert.ok(serialized.roadCells, 'Serialized data must contain roadCells');
  assert.equal(serialized.roadCells.length, 2);

  // Deserialize into a fresh RoadNetworkModel
  const roadModel2 = new RoadNetworkModel(grid);
  roadModel2.deserialize(serialized);

  const restoredCellA = roadModel2.getRoadCell(2, 2);
  const restoredCellB = roadModel2.getRoadCell(3, 2);

  assert.ok(restoredCellA);
  assert.ok(restoredCellB);
  assert.equal(restoredCellA.layer, 'elevated');
  assert.equal(restoredCellA.elevation, 0.45);

  assert.equal(restoredCellB.layer, 'bridge');
  assert.equal(restoredCellB.elevation, 0.80);
  assert.equal(restoredCellB.junctionMetadata?.isBridgeApproach, true);
  assert.equal(restoredCellA.connections.east, true);
  assert.equal(restoredCellB.connections.west, true);
});

test('Prompt 22 - Scenario 12: Seamless road connectivity across sector boundaries', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const sectorManager = world.sectorManager;
  const roadModel = world.roadNetwork.model;

  // Test connection across sector boundaries
  const allRoads = roadModel.getAllRoadCells();
  let crossSectorConnectionsFound = 0;

  for (const road of allRoads) {
    const sec1 = sectorManager.gridToSectorCoord(road.gridX, road.gridZ);
    if (road.connections.east) {
      const neighbor = roadModel.getRoadCell(road.gridX + 1, road.gridZ);
      if (neighbor) {
        const sec2 = sectorManager.gridToSectorCoord(road.gridX + 1, road.gridZ);
        if (sec1.sectorX !== sec2.sectorX || sec1.sectorZ !== sec2.sectorZ) {
          crossSectorConnectionsFound++;
          assert.equal(neighbor.connections.west, true, 'Cross-boundary road must have reciprocal west connection');
        }
      }
    }
  }

  assert.ok(crossSectorConnectionsFound > 0, 'Road network must seamlessly span across multiple sector boundaries');
});

test('Prompt 22 - Prohibition of direct facility access opening exclusively on high-speed highways', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const roadModel = world.roadNetwork.model;
  const validator = world.placementValidator;

  // Add an isolated highway segment at (30, 30)
  roadModel.addRoadCell(30, 30, 'highway_corridor');
  const warehouseDef = BUILDING_DEFINITIONS['logistics_warehouse_sm'];

  // Attempt to place a warehouse whose ONLY road contact is the 110km/h highway
  // logistics_warehouse_sm: width 4, depth 3. Anchor (26, 30) touches road at (30, 30)
  const validation = validator.validate(warehouseDef, 26, 30, 0, 1000000);

  assert.ok(validation !== undefined, 'Placement validation must evaluate');
  assert.equal(validation.reasonCode, 'DIRECT_HIGHWAY_ACCESS_PROHIBITED');
});

test('Prompt 22 - Road Network Diagnostics and Auto-Heal', () => {
  const grid = new GridSystem();
  const roadModel = new RoadNetworkModel(grid);
  roadModel.addRoadCell(11, 14, 'two_lane_urban'); // Connect to depot entrance

  const report = RoadNetworkDiagnostics.runComprehensiveAudit({
    roadNetworkModel: roadModel,
    gridSystem: grid,
  });

  assert.ok(report.totalRoadCells >= 1);

  // Deliberately create an asymmetric connection to test auto-healing
  const cell = roadModel.getRoadCell(11, 14)!;
  cell.connections.north = true; // No road cell exists at (11, 13)

  const healResult = RoadNetworkDiagnostics.autoHealNetwork(roadModel);
  assert.ok(healResult.repairedCount >= 0, 'Auto-heal completes cleanly');
  assert.equal(cell.connections.north, false, 'Ghost connection to empty cell must be cleared by auto-heal');
});
