import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROAD_SPECIFICATIONS, getRoadSpecification, RoadGeometricProfile } from '../src/data/roadSpecifications';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';
import { VEHICLE_DEFINITIONS, TRAILER_DEFINITIONS } from '../src/data/vehicleDefinitions';
import { GridSystem } from '../src/world/GridSystem';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { RoadNetwork } from '../src/world/RoadNetwork';
import { RoadIntersectionFactory } from '../src/world/RoadIntersectionFactory';
import { TerrainGenerator } from '../src/world/TerrainGenerator';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';

describe('Road Scale, Four-Lane Highway, Intersections & Vehicle Proportions', () => {
  it('1. Centralized road specification system defines all required road classes with real-world proportions', () => {
    const requiredTypes = [
      'two_lane_urban',
      'heavy_arterial',
      'highway_corridor',
      'highway_ramp',
      'industrial_access',
    ] as const;

    for (const type of requiredTypes) {
      const spec = getRoadSpecification(type);
      assert.ok(spec, `Road specification for ${type} must exist`);
      assert.strictEqual(spec.roadTypeId, type);
      assert.ok(spec.totalPavementWidthMeters > 0);
      assert.ok(spec.laneWidthMeters >= 0.8, `${type} lane width must be >= 0.8m`);
      assert.ok(spec.laneCount >= 1, `${type} must have at least 1 lane`);
      assert.ok(spec.designSpeedKmh > 0, `${type} must have positive design speed`);
    }

    // Four-lane highway specifications
    const hwSpec = getRoadSpecification('highway_corridor');
    assert.strictEqual(hwSpec.laneCount, 4, 'Highway corridor must specify 4 lanes');
    assert.strictEqual(hwSpec.lanesPerDirection, 2, 'Highway corridor must have 2 lanes per direction');
    assert.strictEqual(hwSpec.dividerType, 'jersey_barrier', 'Highway must have Jersey barrier divider');
    assert.strictEqual(hwSpec.hasPhysicalDivider, true, 'Highway must have physical divider');
    assert.ok(hwSpec.verticalClearanceMeters >= 5.0, 'Highway must provide vertical clearance for semi-trucks');
  });

  it('2. Four-lane highway renders dual lanes per direction, central Jersey barrier, and outer guardrails', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Build straight horizontal 4-lane highway corridor (3 contiguous cells along X)
    roadNetwork.model.addRoadCell(19, 20, 'highway_corridor');
    roadNetwork.model.addRoadCell(20, 20, 'highway_corridor');
    roadNetwork.model.addRoadCell(21, 20, 'highway_corridor');
    roadNetwork.rebuildAllMeshes();

    const cellGroup = roadNetwork.group.getObjectByName('road_cell_20_20') as THREE.Group;
    assert.ok(cellGroup, 'Highway cell mesh must exist');

    // Count meshes and inspect markings
    const meshes = cellGroup.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
    assert.ok(meshes.length >= 6, 'Highway cell must contain road slab, divider barrier, markings, and guardrails');

    // Find Jersey barrier (box geometry with width along cell and height around 0.36m)
    const jerseyBarrier = meshes.find(
      (m) =>
        m.geometry instanceof THREE.BoxGeometry &&
        (m.material === materials.get('jersey_barrier_concrete') ||
          (m.geometry.parameters.height >= 0.3 && m.geometry.parameters.depth <= 0.25))
    );
    assert.ok(jerseyBarrier, 'Highway must render central Jersey barrier');

    // Find yellow median dividing edge lines
    const yellowMarkings = meshes.filter(
      (m) => m.material === materials.get('road_marking_yellow')
    );
    assert.ok(yellowMarkings.length >= 2, 'Highway must render dual yellow median edge lines');

    // Find dashed white lane divider markings and solid shoulder markings
    const whiteMarkings = meshes.filter(
      (m) => m.material === materials.get('road_marking') || m.material === materials.get('road_marking_white')
    );
    assert.ok(whiteMarkings.length >= 2, 'Highway must render white lane dividers and outer shoulder lines');

    // Find W-beam steel guardrail
    const guardrail = cellGroup.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        c.material === materials.get('highway_guardrail_steel')
    );
    assert.ok(guardrail, 'Highway must render outer W-beam guardrail on exposed edges');
  });

  it('3. Elevated highway sections generate structural concrete deck girder and viaduct support piers', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const roadNetwork = new RoadNetwork(grid, materials);

    // Elevated highway cell with elevation = 1.2m
    const elevatedCell = roadNetwork.model.addRoadCell(30, 20, 'highway_corridor');
    if (elevatedCell) {
      elevatedCell.elevation = 1.2;
    }
    roadNetwork.rebuildAllMeshes();

    const cellGroup = roadNetwork.group.getObjectByName('road_cell_30_20') as THREE.Group;
    assert.ok(cellGroup, 'Elevated highway cell mesh must exist');

    // Find concrete bridge pier material
    const pierMat = materials.get('bridge_pier_concrete');
    const concretePierComponents = cellGroup.children.filter(
      (c) => c instanceof THREE.Mesh && c.material === pierMat
    );
    assert.ok(
      concretePierComponents.length >= 2,
      'Elevated highway section must render concrete deck girder and viaduct pier column'
    );
  });

  it('4. Crossroads generate pedestrian zebra crosswalks, approach stop bars, turn arrows, and traffic signal posts', () => {
    const materials = new MaterialsManager();
    const group = new THREE.Group();
    const cellSize = 4.0;
    const cellData = {
      id: 'cell_10_10',
      gridX: 10,
      gridZ: 10,
      roadType: 'heavy_arterial' as const,
      junctionType: 'crossroad' as const,
      connections: { north: true, south: true, east: true, west: true },
      movementFlows: ['north_south', 'east_west'] as any,
      elevation: 0.04,
      layer: 'surface' as const,
      speedLimitKmH: 80,
      laneCount: 2,
    };

    RoadIntersectionFactory.buildCrossroad(group, cellData, cellSize, materials);

    // Check zebra crossing stripes
    const whiteMarkings = group.children.filter(
      (c) => c instanceof THREE.Mesh && c.material === materials.get('road_marking')
    );
    assert.ok(whiteMarkings.length >= 16, 'Crossroad must render pedestrian zebra crossing stripes and stop bars');

    // Check corner traffic signal posts
    const trafficPosts = group.children.filter(
      (c) => c instanceof THREE.Group && c.children.length >= 4
    );
    assert.strictEqual(trafficPosts.length, 4, 'Crossroad must render 4 corner traffic signal posts on sidewalk fillets');

    // Check sidewalk pads
    const sidewalkPads = group.children.filter(
      (c) => c instanceof THREE.Mesh && c.material === materials.get('sidewalk_concrete')
    );
    assert.strictEqual(sidewalkPads.length, 4, 'Crossroad must render 4 sidewalk corner quadrant fillets');
  });

  it('5. Vehicle render scale is calibrated so trucks fit within a 1.8m road lane and Starter Depot bays', () => {
    const materials = new MaterialsManager();
    const primeMoverDef = VEHICLE_DEFINITIONS['prime_mover_6x4'];
    assert.ok(primeMoverDef, 'prime_mover_6x4 must exist');

    assert.strictEqual(
      VehicleEntity.VEHICLE_RENDER_SCALE,
      0.60,
      'VehicleEntity.VEHICLE_RENDER_SCALE must be calibrated to 0.60'
    );

    const vehicle = new VehicleEntity(
      'test_truck_01',
      primeMoverDef,
      12,
      13,
      0,
      0,
      materials,
      {
        trailerDefinition: TRAILER_DEFINITIONS['skeletal_container_chassis_40ft'],
      }
    );

    const dims = vehicle.getRenderedDimensions();
    // Prime mover original width is 2.4m, at 0.60 scale it is 1.44m
    assert.ok(dims.width <= 1.6, `Rendered truck width (${dims.width}m) must fit inside a 1.8m road lane with clearance`);
    assert.ok(dims.width >= 1.2, `Rendered truck width (${dims.width}m) must retain realistic proportions`);

    // Complete articulated rig fits within parking bay (4.0m x 12.0m bay)
    assert.ok(dims.length <= 11.0, `Rendered articulated rig length (${dims.length}m) must fit within a depot bay`);

    vehicle.dispose();
  });

  it('6. Starter Truck Depot at (12, 13) is owned and has exactly 3 designated truck parking spaces', () => {
    const gameState = new GameState();
    const scene = new THREE.Scene();
    const worldManager = new WorldManager(scene, gameState);
    worldManager.initializeWorld();

    // Check BuildingEntity in entityRegistry
    const starterDepot = worldManager.entityRegistry.get('bld_truck_depot_primary') as any;
    assert.ok(starterDepot, 'Starter truck depot must exist in entityRegistry');
    assert.strictEqual(starterDepot.definition.id, 'truck_depot_level1');
    assert.strictEqual(starterDepot.gridX, 12);
    assert.strictEqual(starterDepot.gridZ, 13);

    // Check facility parking capacity
    const primaryDepot = worldManager.facilityManager.getPrimaryTruckDepot();
    assert.ok(primaryDepot, 'Primary truck depot must be registered in FacilityManager');
    assert.strictEqual(primaryDepot.getTotalCapacity(), 3, 'Starter depot must have exactly 3 parking spaces');
    assert.strictEqual(primaryDepot.isPlayerOwned, true, 'Starter depot must be owned by the player at Level 1');

    worldManager.dispose();
  });

  it('7. Tactical grid is non-intrusive by default and seamlessly blends grass tiles', () => {
    const materials = new MaterialsManager();
    const grid = new GridSystem();
    const terrain = new TerrainGenerator(grid, materials);
    terrain.generate();

    // Verify grid overlay is hidden by default in normal gameplay
    assert.strictEqual(terrain.getGridVisible(), false, 'World grid overlay must be hidden by default');
    assert.strictEqual(terrain.isConstructionMode(), false, 'Construction mode must be inactive by default');

    // Toggle construction mode
    terrain.setConstructionMode(true);
    assert.strictEqual(terrain.getGridVisible(), true, 'Grid overlay must become visible when construction mode is enabled');
    assert.strictEqual(terrain.isConstructionMode(), true);

    terrain.setConstructionMode(false);
    assert.strictEqual(terrain.getGridVisible(), false, 'Grid overlay must hide when construction mode is disabled');

    // Check tactical tiles group exists
    const tilesGroup = terrain.group.getObjectByName('tactical_grass_tiles') as THREE.Group;
    assert.ok(tilesGroup, 'Tactical grass tiles group must exist');
    assert.ok(tilesGroup.children.length > 0, 'Tactical grass tiles must be generated');

    // First tile should have full cellSize dimensions (no -0.05 gap)
    const firstTile = tilesGroup.children[0] as THREE.Mesh;
    const planeGeo = firstTile.geometry as THREE.PlaneGeometry;
    assert.strictEqual(
      planeGeo.parameters.width,
      grid.cellSize,
      'Grass tile width must match full cellSize without dark seam gaps'
    );
    assert.strictEqual(
      planeGeo.parameters.height,
      grid.cellSize,
      'Grass tile height must match full cellSize without dark seam gaps'
    );

    terrain.dispose();
  });
});
