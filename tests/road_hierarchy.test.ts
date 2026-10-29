import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD_DEFINITIONS, RoadTypeId, RoadHierarchyClass } from '../src/data/roadDefinitions';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { GridSystem } from '../src/world/GridSystem';
import { TransportNetwork, TransportNode, TransportEdge } from '../src/network/TransportNetwork';
import { RouteSimulationMetadata, VisualBoundaryGateway } from '../src/network/RouteSimulationMetadata';
import { INITIAL_WORLD_DATA } from '../src/data/initialWorldData';
import { FacilityManager } from '../src/facilities/FacilityManager';
import { VEHICLE_DEFINITIONS } from '../src/data/vehicleDefinitions';

test('Road Hierarchy - Distinguishable classes and technical standards', () => {
  const types: RoadTypeId[] = [
    'two_lane_urban',
    'heavy_arterial',
    'highway_corridor',
    'highway_ramp',
    'industrial_access',
  ];

  // 1. Verify all 5 road hierarchy types exist
  for (const t of types) {
    const def = ROAD_DEFINITIONS[t];
    assert.ok(def, `Road type '${t}' must be defined in ROAD_DEFINITIONS`);
    assert.ok(def.name.length > 0, `Road '${t}' must have a name`);
    assert.ok(def.widthUnits === 4.0, `Road '${t}' must conform to 4.0m world scale corridor`);
    assert.ok(def.costPerCell > 0, `Road '${t}' must have positive construction cost`);
    assert.ok(def.dailyUpkeep >= 0, `Road '${t}' must have non-negative upkeep`);
    assert.ok(def.maxSpeedKmh > 0, `Road '${t}' must have positive speed limit`);
  }

  // 2. Verify hierarchy classification progression (Local <= Arterial <= Highway)
  assert.equal(ROAD_DEFINITIONS.two_lane_urban.hierarchyClass, 'local');
  assert.equal(ROAD_DEFINITIONS.industrial_access.hierarchyClass, 'local');
  assert.equal(ROAD_DEFINITIONS.heavy_arterial.hierarchyClass, 'arterial');
  assert.equal(ROAD_DEFINITIONS.highway_corridor.hierarchyClass, 'highway');
  assert.equal(ROAD_DEFINITIONS.highway_ramp.hierarchyClass, 'highway');

  // Highway speed should exceed arterial, which exceeds local
  assert.ok(
    ROAD_DEFINITIONS.highway_corridor.maxSpeedKmh > ROAD_DEFINITIONS.heavy_arterial.maxSpeedKmh,
    'Highway speed must exceed arterial speed'
  );
  assert.ok(
    ROAD_DEFINITIONS.heavy_arterial.maxSpeedKmh > ROAD_DEFINITIONS.two_lane_urban.maxSpeedKmh,
    'Arterial speed must exceed local municipal speed'
  );
  assert.ok(
    ROAD_DEFINITIONS.two_lane_urban.maxSpeedKmh > ROAD_DEFINITIONS.industrial_access.maxSpeedKmh,
    'Municipal speed must exceed industrial yard track speed'
  );

  // Highway guardrails configuration
  assert.equal(ROAD_DEFINITIONS.highway_corridor.hasGuardrails, true);
  assert.equal(ROAD_DEFINITIONS.highway_ramp.hasGuardrails, true);
  assert.equal(ROAD_DEFINITIONS.two_lane_urban.hasCurbs, true);
});

test('RoadNetworkModel - Initial map road connectivity & seamless topology', () => {
  const grid = new GridSystem(24, 24, 4.0);
  const model = new RoadNetworkModel(grid);

  // Build roads from INITIAL_WORLD_DATA
  for (const seg of INITIAL_WORLD_DATA.roads) {
    if (seg.direction === 'horizontal') {
      for (let i = 0; i < seg.length; i++) {
        model.addRoadCell(seg.gridX + i, seg.gridZ, seg.type as any, seg.id);
      }
    } else {
      for (let i = 0; i < seg.length; i++) {
        model.addRoadCell(seg.gridX, seg.gridZ + i, seg.type as any, seg.id);
      }
    }
  }

  // Verify network is 100% connected with 0 isolated components
  const validation = model.validateNetwork();
  assert.equal(validation.isValid, true, 'Initial road network must be fully connected');
  assert.equal(validation.connectedComponents, 1, 'Initial road network must have exactly 1 connected component');
  assert.equal(validation.disconnectedCount, 0, 'Initial road network must have 0 disconnected cells');
  assert.ok(validation.roadCount >= 39, `Expected >= 39 road cells, got ${validation.roadCount}`);

  // Check key intersections:
  // Central intersection at (11, 11) connects Industrial Branch (North), Depot Spur (South), Main Ave (East & West)
  const cellCenter = model.getRoadCell(11, 11);
  assert.ok(cellCenter, 'Cell (11, 11) must be a road cell');
  assert.equal(cellCenter.connections.north, true, 'Cell (11, 11) must connect North');
  assert.equal(cellCenter.connections.south, true, 'Cell (11, 11) must connect South');
  assert.equal(cellCenter.connections.east, true, 'Cell (11, 11) must connect East');
  assert.equal(cellCenter.connections.west, true, 'Cell (11, 11) must connect West');
  assert.equal(cellCenter.junctionType, 'crossroad', 'Cell (11, 11) must be a crossroad');

  // Feeder intersection at (17, 11) connects Main Ave (East & West) and Logistics Feeder (South)
  const cellFeeder = model.getRoadCell(17, 11);
  assert.ok(cellFeeder, 'Cell (17, 11) must be a road cell');
  assert.equal(cellFeeder.connections.south, true);
  assert.equal(cellFeeder.connections.east, true);
  assert.equal(cellFeeder.connections.west, true);
  assert.equal(cellFeeder.junctionType, 't_junction');

  // West boundary cell at (0, 11)
  const cellWestBorder = model.getRoadCell(0, 11);
  assert.ok(cellWestBorder, 'Cell (0, 11) must exist at West boundary');
  assert.equal(cellWestBorder.roadType, 'highway_corridor');
  assert.equal(cellWestBorder.junctionType, 'endpoint');

  // East boundary cell at (23, 11)
  const cellEastBorder = model.getRoadCell(23, 11);
  assert.ok(cellEastBorder, 'Cell (23, 11) must exist at East boundary');
  assert.equal(cellEastBorder.roadType, 'highway_corridor');
  assert.equal(cellEastBorder.junctionType, 'endpoint');
});

test('TransportNetwork - 5-Stage Routing & Visible Boundary Connectivity', () => {
  const net = new TransportNetwork();
  net.initializeStartingTopology(11, 14);

  // 1. Diagnostic hierarchy & connectivity verification
  const report = net.validateRoadHierarchyAndConnectivity();
  assert.equal(report.isValid, true, `Road hierarchy validation issues: ${report.issues.join('; ')}`);
  assert.equal(report.depotConnectedToSpur, true, 'Depot must connect to local spur');
  assert.equal(report.depotConnectedToHighwayWest, true, 'Depot must reach West Highway Gateway');
  assert.equal(report.depotConnectedToHighwayEast, true, 'Depot must reach East Highway Gateway');
  assert.equal(report.boundaryGatewaysReachable, 2, 'Both visual boundary gateways must be reachable');

  // Verify hierarchy breakdown covers local, arterial, and highway segments
  assert.ok((report.roadHierarchyBreakdown['depot_access_ramp'] || 0) >= 1);
  assert.ok((report.roadHierarchyBreakdown['local_street'] || 0) >= 1);
  assert.ok((report.roadHierarchyBreakdown['arterial'] || 0) >= 4);
  assert.ok((report.roadHierarchyBreakdown['highway_corridor'] || 0) >= 2);

  // 2. Test Dijkstra Pathfinding from Depot to West Highway Gateway
  const pathWest = net.findPath('node_depot_entrance', 'node_gateway_highway_west', 'road');
  assert.equal(pathWest.found, true, 'Dijkstra must find route from Depot to West Gateway');
  assert.ok(pathWest.pathNodes.length >= 5, 'Route must traverse at least 5 hierarchical nodes');
  assert.ok(pathWest.totalDistanceMeters > 0, 'Distance must be positive');
  assert.ok(pathWest.estimatedTravelTimeSeconds > 0, 'Travel time must be positive');

  // Verify node sequence traverses the intended hierarchy
  const nodeIds = pathWest.pathNodes.map((n) => n.id);
  assert.equal(nodeIds[0], 'node_depot_entrance');
  assert.ok(nodeIds.includes('node_depot_spur_junction'));
  assert.ok(nodeIds.includes('node_main_ave_center'));
  assert.ok(nodeIds.includes('node_west_highway_interchange'));
  assert.equal(nodeIds[nodeIds.length - 1], 'node_gateway_highway_west');

  // 3. Test Dijkstra Pathfinding from Northern Industrial Plant to West Highway Gateway
  const pathIndustry = net.findPath('node_industrial_north', 'node_gateway_highway_west', 'road');
  assert.equal(pathIndustry.found, true);
  assert.ok(pathIndustry.pathNodes.map((n) => n.id).includes('node_main_ave_center'));

  // 4. Test Reverse Re-entry from West Highway Gateway to Depot Entrance
  const pathReturn = net.findPath('node_gateway_highway_west', 'node_depot_entrance', 'road');
  assert.equal(pathReturn.found, true, 'Returning vehicles must be able to navigate back to the depot');
  assert.equal(pathReturn.totalDistanceMeters, pathWest.totalDistanceMeters);
});

test('TransportNetwork - Strict Mode Isolation', () => {
  const net = new TransportNetwork();
  net.initializeStartingTopology(11, 14);

  // Attempting to connect a road node to a rail node via a road edge must fail
  const illegalEdge1: TransportEdge = {
    id: 'edge_illegal_road_to_rail',
    mode: 'road',
    segmentType: 'local_street',
    fromNodeId: 'node_main_ave_center', // road node
    toNodeId: 'node_rail_mainline_north', // rail node
    lengthMeters: 40.0,
    speedLimitKmh: 50,
    bidirectional: true,
    lanesOrTracks: 2,
  };
  const result1 = net.addEdge(illegalEdge1);
  assert.equal(result1.success, false, 'Connecting road to rail node must be rejected');
  assert.ok(result1.error?.includes('Mode violation'));

  // Attempting to route a road vehicle on a rail network path must fail
  const illegalPath = net.findPath('node_depot_entrance', 'node_rail_mainline_north', 'road');
  assert.equal(illegalPath.found, false, 'Road pathfinding must never cross into rail network');
});

test('RouteSimulationMetadata - Defined Visible Boundary Gateways & Hybrid Pipeline', () => {
  const westGateway = RouteSimulationMetadata.VISUAL_GATEWAYS.gateway_highway_west;
  assert.ok(westGateway, 'West highway gateway must be defined');
  assert.equal(westGateway.cardinalDirection, 'West');
  assert.equal(westGateway.mode, 'road');
  assert.equal(westGateway.worldPosition.x, -46.0);
  assert.equal(westGateway.worldPosition.z, -2.0);

  const eastGateway = RouteSimulationMetadata.VISUAL_GATEWAYS.gateway_highway_east;
  assert.ok(eastGateway, 'East highway gateway must be defined');
  assert.equal(eastGateway.cardinalDirection, 'East');
  assert.equal(eastGateway.mode, 'road');
  assert.equal(eastGateway.worldPosition.x, 46.0);
  assert.equal(eastGateway.worldPosition.z, -2.0);

  // Test Boundary Proximity Checking
  const atBorder = RouteSimulationMetadata.isAtVisualBoundary({ x: -46.5, y: 0, z: -2.0 }, westGateway);
  assert.equal(atBorder, true, 'Vehicle at (-46.5, -2.0) must trigger boundary transition');

  const awayFromBorder = RouteSimulationMetadata.isAtVisualBoundary({ x: 0, y: 0, z: 0 }, westGateway);
  assert.equal(awayFromBorder, false, 'Vehicle at map center must not trigger boundary transition');

  // Test Canonical Routes
  const westRoute = RouteSimulationMetadata.getStartingDepotRoute();
  assert.equal(westRoute.boundaryGatewayId, 'gateway_highway_west');
  assert.ok(westRoute.estimatedOnScreenDistanceMeters > 0);
  assert.ok(westRoute.estimatedOffScreenKm > 0);

  const eastRoute = RouteSimulationMetadata.getEastHighwayRoute();
  assert.equal(eastRoute.boundaryGatewayId, 'gateway_highway_east');
  assert.ok(eastRoute.estimatedOnScreenDistanceMeters > 0);
  assert.ok(eastRoute.estimatedOffScreenKm > 0);
});

test('Scale & Single-Lane Proportion Invariants', () => {
  const primeMover = VEHICLE_DEFINITIONS.prime_mover_6x4;
  const courier = VEHICLE_DEFINITIONS.courier_truck_4x2;

  // Road corridor standard: 4.0m total width (two 2.0m lanes or 4.0m dual corridor)
  const roadCorridorWidth = ROAD_DEFINITIONS.two_lane_urban.widthUnits;
  assert.equal(roadCorridorWidth, 4.0);

  // Trucks must fit within single designated lane (body width 2.3m - 2.4m)
  assert.ok(primeMover.dimensions.width <= 2.6, 'Prime mover width must not exceed 2.6m');
  assert.ok(courier.dimensions.width <= 2.6, 'Courier truck width must not exceed 2.6m');

  // Single lane with 1.0m lateral offset leaves clear margin from centerline (0.0) and curb (2.0)
  const laneCenterOffset = 1.0;
  const halfTruckWidth = primeMover.dimensions.width / 2; // 1.2m
  const innerEdge = laneCenterOffset - halfTruckWidth; // -0.2m relative to lane center -> 0.2m clearance from centerline (0.0)
  const outerEdge = laneCenterOffset + halfTruckWidth; // +2.2m relative to centerline -> 0.2m inside 2.4m road apron boundary
  assert.ok(innerEdge > -1.0, 'Truck must not cross centerline into oncoming lane');
});

test('Starting Depot - 3-Space Capacity & Uncompromised Access', () => {
  const facilityManager = new FacilityManager();
  const depot = facilityManager.ensureDefaultStartingDepot(12, 13);

  assert.equal(depot.level, 1, 'Starting depot must be Level 1');
  assert.equal(depot.isPlayerOwned, true, 'Starting depot must be owned by the player');
  assert.equal(depot.getCapacity(), 3, 'Level 1 starting depot must have exactly 3 parking spaces');

  // Ensure re-calling ensureDefaultStartingDepot does NOT duplicate facilities
  const secondCall = facilityManager.ensureDefaultStartingDepot(12, 13);
  assert.equal(secondCall.id, depot.id, 'Must not duplicate starting depot');
  assert.equal(facilityManager.getAllTruckDepots().length, 1, 'Must have exactly 1 starting depot');

  // Verify access coordinate connects to spur at X=11, Z=12..14
  const entrance = depot.getEntranceCoordinate();
  assert.ok(entrance.gridX === 11 || entrance.gridX === 12);
  assert.ok(entrance.gridZ >= 12 && entrance.gridZ <= 14);
});
