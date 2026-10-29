import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GridSystem } from '../src/world/GridSystem';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { FacilityManager } from '../src/facilities/FacilityManager';
import { INITIAL_WORLD_DATA } from '../src/data/initialWorldData';
import { DEFAULT_GAME_CONFIG } from '../src/app/GameConfig';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';
import { WorldSectorManager } from '../src/world/WorldSectorManager';

test('World Expansion 1: Playable Land Area and Dimensional Scaling (5.44x Expansion Target 4x-6x)', () => {
  const baselineGrid = new GridSystem(24, 24, 4.0, undefined, -48, -48);
  const baselineDimensions = baselineGrid.getWorldDimensions();
  const baselineArea = baselineDimensions.areaMetersSquared;
  assert.equal(baselineArea, 9216, 'Baseline world area must be exactly 9,216 m² (96m x 96m)');

  const expandedGrid = new GridSystem(
    DEFAULT_GAME_CONFIG.grid.width,
    DEFAULT_GAME_CONFIG.grid.height,
    DEFAULT_GAME_CONFIG.grid.cellSize,
    undefined,
    DEFAULT_GAME_CONFIG.grid.originX,
    DEFAULT_GAME_CONFIG.grid.originZ
  );
  const expandedDimensions = expandedGrid.getWorldDimensions();
  const expandedArea = expandedDimensions.areaMetersSquared;

  assert.equal(expandedDimensions.width, 224, 'Expanded world width must be 224m (56 cells * 4m)');
  assert.equal(expandedDimensions.depth, 224, 'Expanded world depth must be 224m (56 cells * 4m)');
  assert.equal(expandedArea, 50176, 'Expanded world area must be 50,176 m²');

  const expansionRatio = expandedArea / baselineArea;
  assert.ok(
    expansionRatio >= 4.0 && expansionRatio <= 6.0,
    `World expansion ratio must be between 4.0x and 6.0x (actual: ${expansionRatio.toFixed(3)}x)`
  );
  assert.equal(Number(expansionRatio.toFixed(2)), 5.44, 'Exact expansion ratio is 5.44x (aligned with 8-cell sectors)');
});

test('World Expansion 2: Coordinate Invariance & Starter Depot Preservation', () => {
  const grid = new GridSystem(56, 56, 4.0, undefined, -48, -48);

  // Cell (12, 13) center must remain invariant at (2.0, 6.0)
  const depotCenter = grid.gridToWorldCenter(12, 13);
  assert.equal(depotCenter.x, 2.0, 'Depot center X must remain at 2.0m');
  assert.equal(depotCenter.z, 6.0, 'Depot center Z must remain at 6.0m');

  // Verify FacilityManager creates starting depot with 3 parking spaces
  const facilityManager = new FacilityManager();
  const starterDepot = facilityManager.ensureDefaultStartingDepot(12, 13);
  assert.equal(starterDepot.level, 1, 'Starting depot must be Level 1');
  assert.equal(starterDepot.getTotalCapacity(), 3, 'Starting depot must have exactly 3 parking spaces');
  assert.equal(starterDepot.getSpaces().length, 3, 'Starting depot must have 3 designated parking bays');
  assert.equal(starterDepot.isPlayerOwned, true, 'Starting depot is pre-owned by the player');
});

test('World Expansion 3: Multi-Level Road Hierarchy & Seamless Connectivity Across 56x56 Grid', () => {
  const grid = new GridSystem(56, 56, 4.0, undefined, -48, -48);
  const model = new RoadNetworkModel(grid);

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

  // 1. Validation across entire expanded network
  const validation = model.validateNetwork();
  assert.equal(validation.isValid, true, 'Expanded road network must be fully connected');
  assert.equal(validation.connectedComponents, 1, 'Expanded network must have exactly 1 connected component (no islands)');
  assert.equal(validation.disconnectedCount, 0, 'Zero disconnected road cells across entire world');
  assert.ok(validation.roadCount > 130, `Expected > 130 road cells in expanded network, got ${validation.roadCount}`);

  // 2. Trans-Continental Interstate 1 & Main Avenue (East-West corridor at Z=11)
  const westGateway = model.getRoadCell(0, 11);
  assert.ok(westGateway, 'West Highway Gateway must exist at (0, 11)');
  assert.equal(westGateway.roadType, 'highway_corridor');

  const eastGateway = model.getRoadCell(54, 11);
  assert.ok(eastGateway, 'I-1 East Gateway must exist at (54, 11)');
  assert.equal(eastGateway.roadType, 'highway_corridor');

  // 3. Regional Interstate 99 (I-99 North-South corridor at X=24)
  const northGateway = model.getRoadCell(24, 1);
  assert.ok(northGateway, 'I-99 North Gateway must exist at (24, 1)');
  assert.equal(northGateway.roadType, 'highway_corridor');

  const southGateway = model.getRoadCell(24, 48);
  assert.ok(southGateway, 'I-99 South Gateway must exist at (24, 48)');
  assert.equal(southGateway.roadType, 'highway_corridor');

  // 4. Central Interchange at (24, 11) connecting I-1 and I-99
  const centralCrossroad = model.getRoadCell(24, 11);
  assert.ok(centralCrossroad, 'Central Interchange junction must exist at (24, 11)');
  assert.equal(centralCrossroad.junctionType, 'crossroad', 'Central junction must be a full crossroad');
  assert.equal(centralCrossroad.connections.north, true);
  assert.equal(centralCrossroad.connections.south, true);
  assert.equal(centralCrossroad.connections.east, true);
  assert.equal(centralCrossroad.connections.west, true);

  // 5. South Logistics Interchange at (24, 36) connecting I-99 and Delta Boulevard
  const southCrossroad = model.getRoadCell(24, 36);
  assert.ok(southCrossroad, 'South Interchange junction must exist at (24, 36)');
  assert.equal(southCrossroad.junctionType, 'crossroad', 'South junction must be a full crossroad');

  // 6. Delta Regional Arterial Boulevard at Z=36
  const deltaWest = model.getRoadCell(12, 36);
  assert.ok(deltaWest, 'Delta Boulevard West must exist at (12, 36)');
  assert.equal(deltaWest.roadType, 'heavy_arterial');

  // 7. Eastern Seaport Arterial at X=38
  const seaportMid = model.getRoadCell(38, 24);
  assert.ok(seaportMid, 'Seaport Arterial must exist at (38, 24)');
  assert.equal(seaportMid.roadType, 'heavy_arterial');

  // 8. Starter Depot Access Spur at (11, 14) and Industrial Access Apron at (14, 29)
  const depotSpur = model.getRoadCell(11, 14);
  assert.ok(depotSpur, 'Depot Access Spur must exist at (11, 14)');
  const industrialApron = model.getRoadCell(14, 29);
  assert.ok(industrialApron, 'Industrial Access Apron must exist at (14, 29)');
  assert.equal(industrialApron.roadType, 'industrial_access');
});

test('World Expansion 4: Large-World Sector Manager Partitioning (49 Sectors, 7x7)', () => {
  const sectorManager = new WorldSectorManager();
  sectorManager.initializeDefaultSectorGrid(56, 56);
  sectorManager.updateStreaming(0, 0);

  const stats = sectorManager.getStreamingDiagnostics();
  assert.equal(stats.totalSectors, 49, 'Expanded world must partition into 7x7 = 49 sectors (8x8 cells each)');
  assert.ok(stats.activeSectorsCount > 0, 'Active sectors must be tracked');

  // Test dynamic streaming updates when camera moves to South Logistics Center (Z = 120m)
  sectorManager.updateStreaming(48.0, 120.0, 48.0, 8.0);
  const updatedStats = sectorManager.getStreamingDiagnostics();
  assert.ok(updatedStats.activeSectorsCount > 0, 'Sectors around camera focus become active');
});

test('World Expansion 5: Spatial Scale Inspector Audit Verifies Expansion Ratio', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);
  world.initializeWorld();

  const audit = world.scaleInspector.generateAuditReport();
  assert.ok(audit.overallStatus !== 'NON_COMPLIANT', 'Spatial scale audit must not be non-compliant');

  const areaAudit = audit.items.find((item) => item.id === 'audit_world_area_scale');
  assert.ok(areaAudit, 'Usable land area scale audit must be reported');
  assert.equal(areaAudit.status, 'PASS', 'World area expansion scale must pass validation');
  assert.ok(areaAudit.margin.includes('5.44x'), `Expansion margin should state 5.44x (got: ${areaAudit.margin})`);

  world.dispose();
});
