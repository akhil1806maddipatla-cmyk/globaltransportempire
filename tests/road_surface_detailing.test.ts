import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { RoadNetwork } from '../src/world/RoadNetwork';
import { GridSystem } from '../src/world/GridSystem';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { RoadsideDetailingManager } from '../src/world/RoadsideDetailingManager';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';

describe('Prompt 23 - High-Quality Road Surfaces, Lane Markings, Street Furniture & Roadside Detailing', () => {
  it('1. Generates distinct road-surface materials per road hierarchy class', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Build sample cells of different classes
    roadNetwork.model.addRoadCell(10, 10, 'two_lane_urban');
    roadNetwork.model.addRoadCell(10, 11, 'two_lane_urban');

    roadNetwork.model.addRoadCell(15, 10, 'heavy_arterial');
    roadNetwork.model.addRoadCell(15, 11, 'heavy_arterial');

    roadNetwork.model.addRoadCell(20, 10, 'highway_corridor');
    roadNetwork.model.addRoadCell(20, 11, 'highway_corridor');

    roadNetwork.model.addRoadCell(25, 10, 'industrial_access');
    roadNetwork.model.addRoadCell(25, 11, 'industrial_access');

    roadNetwork.rebuildAllMeshes();

    // Verify materials exist in registry
    assert.ok(materials.get('road_local_asphalt'), 'road_local_asphalt must be registered');
    assert.ok(materials.get('road_arterial_asphalt'), 'road_arterial_asphalt must be registered');
    assert.ok(materials.get('road_highway_asphalt'), 'road_highway_asphalt must be registered');
    assert.ok(materials.get('road_industrial_pavement'), 'road_industrial_pavement must be registered');

    // Inspect the generated meshes for distinct materials
    const groupLocal = roadNetwork.group.getObjectByName('road_cell_10_10') as THREE.Group;
    const groupArterial = roadNetwork.group.getObjectByName('road_cell_15_10') as THREE.Group;
    const groupHighway = roadNetwork.group.getObjectByName('road_cell_20_10') as THREE.Group;
    const groupIndustrial = roadNetwork.group.getObjectByName('road_cell_25_10') as THREE.Group;

    assert.ok(groupLocal, 'Local road cell mesh must exist');
    assert.ok(groupArterial, 'Arterial road cell mesh must exist');
    assert.ok(groupHighway, 'Highway road cell mesh must exist');
    assert.ok(groupIndustrial, 'Industrial road cell mesh must exist');

    // First child is the road surface plane
    const localBase = groupLocal.children[0] as THREE.Mesh;
    const arterialBase = groupArterial.children[0] as THREE.Mesh;
    const highwayBase = groupHighway.children[0] as THREE.Mesh;
    const industrialBase = groupIndustrial.children[0] as THREE.Mesh;

    assert.notStrictEqual(
      localBase.material,
      highwayBase.material,
      'Local streets and highways must use distinct surface materials'
    );
    assert.notStrictEqual(
      arterialBase.material,
      industrialBase.material,
      'Arterial roads and industrial access must use distinct surface materials'
    );
  });

  it('2. Local streets generate sidewalks and curbs along non-connected edges', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Single horizontal segment (North and South edges are unconnected)
    roadNetwork.model.addRoadCell(5, 5, 'two_lane_urban');
    roadNetwork.model.addRoadCell(6, 5, 'two_lane_urban');
    roadNetwork.model.addRoadCell(7, 5, 'two_lane_urban');

    roadNetwork.rebuildAllMeshes();

    const cellGroup = roadNetwork.group.getObjectByName('road_cell_6_5') as THREE.Group;
    assert.ok(cellGroup, 'Cell mesh 6,5 must exist');

    const sidewalkMat = materials.get('sidewalk_concrete');
    const curbMat = materials.get('concrete_curb');

    let foundSidewalk = false;
    let foundCurb = false;

    cellGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material === sidewalkMat) foundSidewalk = true;
        if (child.material === curbMat) foundCurb = true;
      }
    });

    assert.ok(foundSidewalk, 'Local street must generate concrete sidewalk slabs');
    assert.ok(foundCurb, 'Local street must generate concrete curbs along sidewalk boundaries');
  });

  it('3. Highways generate center median Jersey barriers on straight corridors without urban sidewalks', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Horizontal highway segment
    roadNetwork.model.addRoadCell(12, 20, 'highway_corridor');
    roadNetwork.model.addRoadCell(13, 20, 'highway_corridor');
    roadNetwork.model.addRoadCell(14, 20, 'highway_corridor');

    roadNetwork.rebuildAllMeshes();

    const cellGroup = roadNetwork.group.getObjectByName('road_cell_13_20') as THREE.Group;
    assert.ok(cellGroup, 'Highway cell mesh 13,20 must exist');

    const jerseyMat = materials.get('jersey_barrier_concrete');
    const sidewalkMat = materials.get('sidewalk_concrete');
    const guardrailMat = materials.get('highway_guardrail_steel');

    let foundJerseyBarrier = false;
    let foundSidewalk = false;
    let foundGuardrail = false;

    cellGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material === jerseyMat) foundJerseyBarrier = true;
        if (child.material === sidewalkMat) foundSidewalk = true;
        if (child.material === guardrailMat) foundGuardrail = true;
      }
    });

    assert.ok(foundJerseyBarrier, 'Straight highway corridor must feature central median Jersey barriers');
    assert.ok(foundGuardrail, 'Outer edges of highway must feature steel W-beam guardrails');
    assert.ok(!foundSidewalk, 'Highways must not have urban pedestrian sidewalks');
  });

  it('4. Directional turn arrows and zebra crossings are rendered on appropriate road types', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Arterial road
    roadNetwork.model.addRoadCell(30, 30, 'heavy_arterial');
    roadNetwork.model.addRoadCell(31, 30, 'heavy_arterial');
    roadNetwork.model.addRoadCell(32, 30, 'heavy_arterial');

    // Local road
    roadNetwork.model.addRoadCell(40, 40, 'two_lane_urban');
    roadNetwork.model.addRoadCell(41, 40, 'two_lane_urban');
    roadNetwork.model.addRoadCell(42, 40, 'two_lane_urban');

    roadNetwork.rebuildAllMeshes();

    const arterialGroup = roadNetwork.group.getObjectByName('road_cell_31_30') as THREE.Group;
    const arrowMat = materials.get('road_arrow_straight');
    let foundArrow = false;
    arterialGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material === arrowMat) {
        foundArrow = true;
      }
    });
    assert.ok(foundArrow, 'Heavy arterial roads must feature directional turning arrow decals');

    const localGroup = roadNetwork.group.getObjectByName('road_cell_41_40') as THREE.Group;
    let whiteStripesCount = 0;
    const whiteMarking = materials.get('road_marking');
    localGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material === whiteMarking) {
        whiteStripesCount++;
      }
    });
    // Centerline + zebra crossing stripes
    assert.ok(whiteStripesCount >= 4, 'Local streets must generate pedestrian zebra crossing stripes');
  });

  it('5. RoadsideDetailingManager places scale-correct streetlights matching road class', () => {
    const grid = new GridSystem();
    const model = new RoadNetworkModel(grid);
    const materials = new MaterialsManager();

    // Add sample road corridors
    for (let x = 10; x <= 16; x++) model.addRoadCell(x, 10, 'two_lane_urban');
    for (let x = 10; x <= 16; x++) model.addRoadCell(x, 15, 'heavy_arterial');
    for (let x = 10; x <= 16; x++) model.addRoadCell(x, 20, 'highway_corridor');
    for (let x = 10; x <= 16; x++) model.addRoadCell(x, 25, 'industrial_access');

    const detailing = new RoadsideDetailingManager(grid, model, materials);
    detailing.generate();

    const props = detailing.getProps();
    assert.ok(props.length > 0, 'Roadside props must be placed');

    const lights = detailing.getPropsByType('streetlight');
    assert.ok(lights.length > 0, 'Streetlights must be placed');

    const localLight = lights.find((l) => l.roadClass === 'two_lane_urban');
    const arterialLight = lights.find((l) => l.roadClass === 'heavy_arterial');
    const highwayLight = lights.find((l) => l.roadClass === 'highway_corridor');
    const industrialLight = lights.find((l) => l.roadClass === 'industrial_access');

    assert.ok(localLight, 'Must have local streetlight');
    assert.ok(arterialLight, 'Must have arterial streetlight');
    assert.ok(highwayLight, 'Must have highway streetlight');
    assert.ok(industrialLight, 'Must have industrial streetlight');

    // Verify pole heights
    assert.strictEqual(localLight.heightMeters, 5.5, 'Local streetlights must be 5.5m municipal poles');
    assert.strictEqual(arterialLight.heightMeters, 8.5, 'Arterial streetlights must be 8.5m double-arm poles');
    assert.strictEqual(highwayLight.heightMeters, 12.0, 'Highway masts must be 12.0m cobra-head towers');
    assert.strictEqual(industrialLight.heightMeters, 9.0, 'Industrial lights must be 9.0m floodlight towers');
  });

  it('6. Roadside signs follow regulatory speed limits per road hierarchy', () => {
    const grid = new GridSystem();
    const model = new RoadNetworkModel(grid);
    const materials = new MaterialsManager();

    for (let x = 10; x <= 18; x++) model.addRoadCell(x, 10, 'two_lane_urban');
    for (let x = 10; x <= 18; x++) model.addRoadCell(x, 15, 'heavy_arterial');
    for (let x = 10; x <= 18; x++) model.addRoadCell(x, 20, 'highway_corridor');
    for (let x = 10; x <= 18; x++) model.addRoadCell(x, 25, 'industrial_access');

    const detailing = new RoadsideDetailingManager(grid, model, materials);
    detailing.generate();

    const speedSigns = detailing.getPropsByType('speed_sign');
    assert.ok(speedSigns.length > 0, 'Regulatory speed signs must be generated');

    const signClasses = new Set(speedSigns.map((s) => s.roadClass));
    assert.ok(signClasses.has('two_lane_urban') || signClasses.has('heavy_arterial') || signClasses.has('highway_corridor'));

    // Check overhead highway gantry signs
    const gantries = detailing.getPropsByType('highway_gantry');
    assert.ok(gantries.length > 0, 'Highway corridor must generate overhead directional gantry truss signs');
    assert.strictEqual(gantries[0].roadClass, 'highway_corridor');
  });

  it('7. Roadside furniture respects non-encroachment clearance envelope (> 2.35m from centerline)', () => {
    const grid = new GridSystem();
    const model = new RoadNetworkModel(grid);
    const materials = new MaterialsManager();

    for (let x = 10; x <= 18; x++) {
      model.addRoadCell(x, 10, 'two_lane_urban');
      model.addRoadCell(x, 15, 'heavy_arterial');
      model.addRoadCell(x, 20, 'highway_corridor');
      model.addRoadCell(x, 25, 'industrial_access');
    }

    const detailing = new RoadsideDetailingManager(grid, model, materials);
    detailing.generate();

    const props = detailing.getProps();
    for (const prop of props) {
      if (prop.type === 'highway_gantry') continue; // Gantries span overhead across the road

      const center = grid.gridToWorldCenter(prop.gridX, prop.gridZ);
      const dx = Math.abs(prop.worldPosition.x - center.x);
      const dz = Math.abs(prop.worldPosition.z - center.z);
      const lateralOffset = Math.max(dx, dz);

      assert.ok(
        lateralOffset >= 2.35,
        `Roadside prop ${prop.id} (${prop.type}) offset ${lateralOffset.toFixed(2)}m must be >= 2.35m to prevent encroaching into the truck travel envelope`
      );
    }
  });

  it('8. Full integration with WorldManager: initializes roadside detailing and preserves Starter Depot', () => {
    const scene = new THREE.Scene();
    const gameState = new GameState();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    // Verify roadside detailing manager exists and generated props
    const detailing = worldManager.getRoadsideDetailingManager();
    assert.ok(detailing, 'RoadsideDetailingManager must be accessible from WorldManager');
    assert.ok(detailing.getProps().length > 0, 'Authoritative roadside detailing props must be populated');
    assert.ok(scene.children.includes(detailing.group), 'Roadside detailing group must be mounted to scene');

    // Verify Starter Depot exists, is owned with 3 parking spaces
    const depot =
      worldManager.facilityManager.getFacility('facility_truck_depot_01') ||
      worldManager.facilityManager.getPrimaryTruckDepot();
    assert.ok(depot, 'Level 1 Starter Depot must exist');
    assert.strictEqual(depot.getTotalCapacity(), 3, 'Starter Depot must have exactly 3 designated truck parking spaces');
    assert.strictEqual(depot.isPlayerOwned, true, 'Starter Depot must be owned');
    assert.strictEqual(depot.level, 1, 'Starter Depot must be Level 1');

    // Verify fleet vehicle prime mover 01 remains assigned
    const housingDepot = worldManager.facilityManager.findFacilityForVehicle('veh_prime_mover_01');
    assert.ok(housingDepot, 'Primary vehicle veh_prime_mover_01 must remain housed in Starter Depot');

    // Clean up
    worldManager.dispose();
  });
});
