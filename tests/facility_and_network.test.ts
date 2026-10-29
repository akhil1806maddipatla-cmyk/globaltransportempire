import test from 'node:test';
import assert from 'node:assert/strict';
import { FacilityManager } from '../src/facilities/FacilityManager';
import { TruckDepotFacility, RailYardFacility, CargoAirportFacility, SeaportHarborFacility } from '../src/facilities/FacilityModel';
import { LandParcelManager } from '../src/world/LandParcelManager';
import { TransportNetwork } from '../src/network/TransportNetwork';
import { RouteSimulationMetadata } from '../src/network/RouteSimulationMetadata';
import { WorldSectorManager } from '../src/world/WorldSectorManager';

test('FacilityManager - Guaranteed Pre-Built Level 1 Starting Truck Depot', () => {
  const facilityManager = new FacilityManager();

  // 1. Guaranteed auto-generation
  const depot = facilityManager.ensureDefaultStartingDepot(12, 13);
  assert.ok(depot, 'Starting depot must be automatically created');
  assert.equal(depot.level, 1, 'Starting depot must be Level 1');
  assert.equal(depot.isPlayerOwned, true, 'Starting depot must be player-owned without purchase or unlocking');

  // 2. Exactly 3 designated parking spaces
  assert.equal(depot.getTotalCapacity(), 3, 'Level 1 depot must have exactly 3 designated parking spaces');
  assert.equal(depot.getOccupiedCapacity(), 0, 'Initial depot spaces must be unoccupied');
  assert.equal(depot.getAvailableCapacity(), 3, 'Initial available capacity must be exactly 3');
  assert.equal(depot.isFull(), false, 'Depot must not be full initially');

  // 3. Deterministic singleton / idempotent behavior
  const secondCall = facilityManager.ensureDefaultStartingDepot(12, 13);
  assert.equal(secondCall.id, depot.id, 'Repeated initialization must be idempotent and return singleton');
  assert.equal(facilityManager.getAllFacilities().length, 1, 'Must not duplicate starting facilities');

  // 4. Vehicle parking space assignments & capacity enforcement
  const assign1 = depot.assignAsset('truck_alpha', 'prime_mover_6x4');
  assert.equal(assign1, true, 'Must allow parking compatible truck');
  assert.equal(depot.getOccupiedCapacity(), 1);
  assert.equal(depot.getAvailableCapacity(), 2);

  const assign2 = depot.assignAsset('truck_bravo', 'heavy_combination_semi');
  const assign3 = depot.assignAsset('truck_charlie', 'rigid_courier');
  assert.equal(assign2, true);
  assert.equal(assign3, true);
  assert.equal(depot.isFull(), true, 'Depot must be full after 3 spaces occupied');

  // Attempt 4th assignment on full depot -> must reject
  const assign4 = depot.assignAsset('truck_delta', 'rigid_courier');
  assert.equal(assign4, false, 'Depot must strictly reject assignment when full at capacity 3');

  // Unparking
  const released = depot.releaseAsset('truck_alpha');
  assert.equal(released, true);
  assert.equal(depot.getAvailableCapacity(), 1);
  assert.equal(depot.isFull(), false);

  // 5. Progression Model: Future Level 2 upgrade
  const upgradeOk = depot.upgrade();
  assert.equal(upgradeOk, true, 'Depot upgrade to Level 2 must succeed');
  assert.equal(depot.level, 2);
  assert.equal(depot.getTotalCapacity(), 6, 'Level 2 depot must expand capacity to 6 spaces');
});

test('Multi-Modal Facility Progression - Distinct non-interchangeable facility types', () => {
  const depot = new TruckDepotFacility('depot_1', 'Truck Depot', 10, 10, 1);
  const railYard = new RailYardFacility('rail_1', 'Classification Yard');
  const airport = new CargoAirportFacility('air_1', 'Regional Freight Aerodrome');
  const harbor = new SeaportHarborFacility('port_1', 'Deepwater Marine Berth');

  // Types are strictly distinct
  assert.equal(depot.type, 'truck_depot');
  assert.equal(railYard.type, 'rail_yard');
  assert.equal(airport.type, 'cargo_airport');
  assert.equal(harbor.type, 'seaport_harbor');

  // Capacities are mode-specific and non-interchangeable
  assert.equal(depot.canAccommodate('prime_mover_6x4'), true);
  assert.equal(depot.canAccommodate('diesel_electric_locomotive'), false);

  assert.equal(railYard.canAccommodate('freight_train_consist'), true);
  assert.equal(railYard.canAccommodate('heavy_combination_semi'), false);

  assert.equal(airport.canAccommodate('cargo_aircraft'), true);
  assert.equal(airport.canAccommodate('container_feeder_ship'), false);

  assert.equal(harbor.canAccommodate('container_feeder_ship'), true);
  assert.equal(harbor.canAccommodate('cargo_aircraft'), false);
});

test('LandParcelManager - Starting depot parcel tenure and land valuation', () => {
  const parcelManager = new LandParcelManager();
  const allParcels = parcelManager.getAllParcels();
  assert.ok(allParcels.length >= 4, 'Must have at least 4 planned land parcels');

  // Starting depot parcel is guaranteed player-owned with $0 cost
  const starterParcel = parcelManager.getParcel('parcel_starter_depot');
  assert.ok(starterParcel, 'Starter depot parcel must exist');
  assert.equal(starterParcel.ownership, 'player_owned', 'Starter parcel must be player_owned');
  assert.equal(starterParcel.effectivePurchasePrice, 0, 'Starter depot parcel is granted for free');
  assert.equal(starterParcel.isBuildAllowed, true);

  // Expansion parcel valuation
  const expansionParcel = parcelManager.getParcel('parcel_expansion_east_01');
  assert.ok(expansionParcel);
  assert.equal(expansionParcel.ownership, 'unowned');
  assert.ok(expansionParcel.effectivePurchasePrice > 0, 'Unowned expansion parcel requires purchase capital');
});

test('TransportNetwork - 5-Stage Journey Pipeline and Strict Mode Isolation', () => {
  const net = new TransportNetwork();
  net.initializeStartingTopology(11, 14);

  // 1. Verify 5-stage conceptual pipeline nodes exist
  const depotGate = net.getNode('node_depot_entrance');
  const spurJunction = net.getNode('node_depot_spur_junction');
  const arterialCenter = net.getNode('node_main_ave_center');
  const highwayRamp = net.getNode('node_west_highway_interchange');
  const visualBoundaryWest = net.getNode('node_gateway_highway_west');

  assert.ok(depotGate, 'Stage 1: Depot Entrance must exist');
  assert.ok(spurJunction, 'Stage 2: Local access spur must exist');
  assert.ok(arterialCenter, 'Stage 3: Arterial intersection must exist');
  assert.ok(highwayRamp, 'Stage 4: Highway corridor/ramp must exist');
  assert.ok(visualBoundaryWest, 'Stage 5: Visual transition boundary gateway must exist');
  assert.equal(visualBoundaryWest.isBoundaryTransition, true);

  // 2. Strict Mode Segregation Validation
  // Attempting to connect a Road node to a Rail or Waterway node must fail
  net.addNode({
    id: 'node_test_rail_switch',
    mode: 'rail',
    nodeType: 'rail_switch',
    name: 'Test Rail Switch',
    gridX: 11,
    gridZ: 11,
    worldPosition: { x: 0, y: 0, z: 0 },
  });

  const illegalCrossEdge = net.addEdge({
    id: 'edge_illegal_cross',
    mode: 'road',
    segmentType: 'local_street',
    fromNodeId: 'node_main_ave_center', // road mode
    toNodeId: 'node_test_rail_switch',    // rail mode
    lengthMeters: 50,
    speedLimitKmh: 50,
    bidirectional: true,
    lanesOrTracks: 2,
  });

  assert.equal(illegalCrossEdge.success, false, 'Connecting road to rail must be strictly rejected');
  assert.ok(illegalCrossEdge.error?.includes('Mode violation'));

  // 3. Visual Gateway Metadata
  assert.ok(RouteSimulationMetadata.VISUAL_GATEWAYS['gateway_highway_west'], 'West highway gateway metadata exists');
  assert.ok(RouteSimulationMetadata.VISUAL_GATEWAYS['gateway_highway_east'], 'East highway gateway metadata exists');
  assert.ok(RouteSimulationMetadata.VISUAL_GATEWAYS['gateway_rail_north'], 'North rail gateway metadata exists');
});

test('WorldSectorManager - Spatial Partitioning & Proximity Queries', () => {
  const sectorMgr = new WorldSectorManager();

  // Coordinate hashing
  const coord = sectorMgr.gridToSectorCoord(12, 13);
  assert.equal(coord.sectorX, 1);
  assert.equal(coord.sectorZ, 1);

  // Registering building
  sectorMgr.registerBuilding('bld_test_depot', 12, 13, 4, 3);
  const sector = sectorMgr.getOrCreateSector(1, 1);
  assert.ok(sector.buildingIds.has('bld_test_depot'), 'Building must be registered in sector');

  // Query nearby
  const nearby = sectorMgr.queryNearbyBuildings(0, 0, 40.0);
  assert.ok(nearby.includes('bld_test_depot'), 'Nearby query should find registered building');

  // Unregister
  sectorMgr.unregisterBuilding('bld_test_depot');
  assert.equal(sector.buildingIds.has('bld_test_depot'), false);
});
