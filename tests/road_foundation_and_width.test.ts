import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoadPathGenerator } from '../src/world/RoadPathGenerator';
import { GridSystem } from '../src/world/GridSystem';
import { RoadNetworkModel } from '../src/world/RoadNetworkModel';
import { RoadConstructionValidator } from '../src/world/RoadConstructionValidator';
import { ROAD_DEFINITIONS } from '../src/data/roadDefinitions';
import { RoadNetwork } from '../src/world/RoadNetwork';
import { MaterialsManager } from '../src/rendering/MaterialsManager';

describe('Global Transport Empire - Road Foundation & Flexible Grid Widths (Prompt 1/3)', () => {
  it('1. Directional width allocation handles 2-block, 4-block, 3-block asymmetric, and arbitrary widths', () => {
    // 2-grid-block road: 1 block per direction
    const alloc2 = RoadPathGenerator.calculateDirectionalAllocation(2);
    assert.strictEqual(alloc2.forwardBlocks, 1);
    assert.strictEqual(alloc2.backwardBlocks, 1);

    // 4-grid-block road: 2 blocks per direction
    const alloc4 = RoadPathGenerator.calculateDirectionalAllocation(4);
    assert.strictEqual(alloc4.forwardBlocks, 2);
    assert.strictEqual(alloc4.backwardBlocks, 2);

    // 3-grid-block road default: 2 forward, 1 backward
    const alloc3Default = RoadPathGenerator.calculateDirectionalAllocation(3);
    assert.strictEqual(alloc3Default.forwardBlocks, 2);
    assert.strictEqual(alloc3Default.backwardBlocks, 1);

    // 3-grid-block road custom split (1 forward, 2 backward)
    const alloc3Swapped = RoadPathGenerator.calculateDirectionalAllocation(3, 1, 2);
    assert.strictEqual(alloc3Swapped.forwardBlocks, 1);
    assert.strictEqual(alloc3Swapped.backwardBlocks, 2);

    // 5-grid-block road: 3 forward, 2 backward
    const alloc5 = RoadPathGenerator.calculateDirectionalAllocation(5);
    assert.strictEqual(alloc5.forwardBlocks, 3);
    assert.strictEqual(alloc5.backwardBlocks, 2);
  });

  it('2. Rule A (2-grid-block road): Centre divider, solid outer edge lines, ZERO dashed internal markings', () => {
    // Row 0 (forward carriageway, 1 block wide)
    const row0 = RoadPathGenerator.computeMarkingFlags(0, 2, 1, 1);
    assert.strictEqual(row0.isOuterEdgeMin, true, 'Row 0 outer edge min must be true');
    assert.strictEqual(row0.isOuterEdgeMax, false);
    assert.strictEqual(row0.isCentreDividerEdgeMax, true, 'Row 0 max edge touches centre divider');
    assert.strictEqual(row0.hasInternalDashedMin, false, 'Rule A: No dashed line inside row 0');
    assert.strictEqual(row0.hasInternalDashedMax, false, 'Rule A: No dashed line inside row 0');

    // Row 1 (backward carriageway, 1 block wide)
    const row1 = RoadPathGenerator.computeMarkingFlags(1, 2, 1, 1);
    assert.strictEqual(row1.isOuterEdgeMin, false);
    assert.strictEqual(row1.isOuterEdgeMax, true, 'Row 1 outer edge max must be true');
    assert.strictEqual(row1.isCentreDividerEdgeMin, true, 'Row 1 min edge touches centre divider');
    assert.strictEqual(row1.hasInternalDashedMin, false, 'Rule A: No dashed line inside row 1');
    assert.strictEqual(row1.hasInternalDashedMax, false, 'Rule A: No dashed line inside row 1');
  });

  it('3. Rule B (4-grid-block road): 2 lanes each direction, dashed internal dividers, centre divider, solid outer lines', () => {
    // 4 blocks: Rows 0, 1 forward; Rows 2, 3 backward
    const r0 = RoadPathGenerator.computeMarkingFlags(0, 4, 2, 2);
    assert.strictEqual(r0.isOuterEdgeMin, true);
    assert.strictEqual(r0.hasInternalDashedMax, true, 'Dashed lane divider between row 0 and row 1');

    const r1 = RoadPathGenerator.computeMarkingFlags(1, 4, 2, 2);
    assert.strictEqual(r1.hasInternalDashedMin, true, 'Dashed lane divider between row 0 and row 1');
    assert.strictEqual(r1.isCentreDividerEdgeMax, true, 'Centre divider between row 1 and row 2');

    const r2 = RoadPathGenerator.computeMarkingFlags(2, 4, 2, 2);
    assert.strictEqual(r2.isCentreDividerEdgeMin, true, 'Centre divider between row 1 and row 2');
    assert.strictEqual(r2.hasInternalDashedMax, true, 'Dashed lane divider between row 2 and row 3');

    const r3 = RoadPathGenerator.computeMarkingFlags(3, 4, 2, 2);
    assert.strictEqual(r3.hasInternalDashedMin, true, 'Dashed lane divider between row 2 and row 3');
    assert.strictEqual(r3.isOuterEdgeMax, true, 'Solid outer white line on row 3');
  });

  it('4. Rule C (3-grid-block road): Asymmetric carriageway allocates dashed divider only to 2-lane side', () => {
    // 3 blocks (2 forward, 1 backward)
    const r0 = RoadPathGenerator.computeMarkingFlags(0, 3, 2, 1);
    assert.strictEqual(r0.isOuterEdgeMin, true);
    assert.strictEqual(r0.hasInternalDashedMax, true, 'Row 0 and 1 separated by dashed line in 2-lane forward direction');

    const r1 = RoadPathGenerator.computeMarkingFlags(1, 3, 2, 1);
    assert.strictEqual(r1.hasInternalDashedMin, true);
    assert.strictEqual(r1.isCentreDividerEdgeMax, true, 'Centre divider separates forward 2-lane side from backward 1-lane side');

    const r2 = RoadPathGenerator.computeMarkingFlags(2, 3, 2, 1);
    assert.strictEqual(r2.isCentreDividerEdgeMin, true);
    assert.strictEqual(r2.isOuterEdgeMax, true);
    assert.strictEqual(r2.hasInternalDashedMin, false, '1-lane side must have NO dashed divider');
    assert.strictEqual(r2.hasInternalDashedMax, false, '1-lane side must have NO dashed divider');
  });

  it('5. RoadPathGenerator generates multi-block corridor footprint and seamless turns', () => {
    // Horizontal corridor from (5, 10) to (8, 10) of width 2
    const corridor = RoadPathGenerator.generateCorridor({ x: 5, z: 10 }, { x: 8, z: 10 }, 2);
    // 4 cells in X (5, 6, 7, 8) * 2 cells in Z (10, 11) = 8 cells total
    assert.strictEqual(corridor.length, 8, 'Corridor of 4 length and 2 width must produce exactly 8 grid cells');

    const keys = new Set(corridor.map((c) => `${c.x},${c.z}`));
    for (let x = 5; x <= 8; x++) {
      assert.ok(keys.has(`${x},10`), `Cell (${x}, 10) must be present in row 0`);
      assert.ok(keys.has(`${x},11`), `Cell (${x}, 11) must be present in row 1`);
    }

    // L-turn: Horizontal from (5, 10) to (7, 10), then Vertical from (7, 10) to (7, 12) with width 2
    const lCorridor = RoadPathGenerator.generateCorridor(
      { x: 5, z: 10 },
      { x: 7, z: 12 },
      2,
      1,
      1,
      'horizontal_first'
    );
    // Horizontal: X in [5..7] * Z in [10..11] = 6 cells
    // Vertical: Z in [10..12] * X in [7..8] = 6 cells
    // Overlapping junction cells: (7, 10) and (7, 11) = 2 cells
    // Total unique contiguous cells: 6 + 6 - 2 = 10 cells
    const lKeys = new Set(lCorridor.map((c) => `${c.x},${c.z}`));
    assert.strictEqual(lKeys.size, 10, 'L-turn corridor must produce seamless contiguous cells');
  });

  it('6. RoadConstructionValidator scales cost accurately by number of grid cells in width', () => {
    const grid = new GridSystem();
    const model = new RoadNetworkModel(grid);
    const validator = new RoadConstructionValidator(grid, model);
    const roadDef = ROAD_DEFINITIONS['two_lane_urban']; // $120/cell

    // 2-block wide path of 5 length -> 10 cells -> $1,200
    const corridor2 = RoadPathGenerator.generateCorridor({ x: 5, z: 5 }, { x: 9, z: 5 }, 2);
    const res2 = validator.validatePath(corridor2, roadDef, 50000);
    assert.strictEqual(res2.isValid, true);
    assert.strictEqual(res2.newCells.length, 10);
    assert.strictEqual(res2.totalCost, 10 * 120);

    // 4-block wide path of 5 length -> 20 cells -> $2,400
    const corridor4 = RoadPathGenerator.generateCorridor({ x: 5, z: 5 }, { x: 9, z: 5 }, 4);
    const res4 = validator.validatePath(corridor4, roadDef, 50000);
    assert.strictEqual(res4.isValid, true);
    assert.strictEqual(res4.newCells.length, 20);
    assert.strictEqual(res4.totalCost, 20 * 120);
  });

  it('7. RoadNetwork renders solid centre divider on 2-way road and zero dashed lines', () => {
    const grid = new GridSystem();
    const materials = new MaterialsManager();
    const network = new RoadNetwork(grid, materials);

    // Single-cell municipal 2-way road
    const cell = network.model.addRoadCell(15, 15, 'two_lane_urban');
    assert.ok(cell);
    network.rebuildAllMeshes();

    const meshGroup = network.group.getObjectByName('road_cell_15_15') as THREE.Group;
    assert.ok(meshGroup, 'Mesh group for road cell 15, 15 must exist');

    // Filter white markings
    const whiteMarkings = meshGroup.children.filter(
      (c) => c instanceof THREE.Mesh && c.material === materials.get('road_marking')
    );
    // Filter yellow markings (centre divider)
    const yellowMarkings = meshGroup.children.filter(
      (c) => c instanceof THREE.Mesh && c.material === materials.get('road_marking_yellow')
    );

    // Should have solid centre divider (yellow) and outer edge lines (white), NO dashed center line
    assert.ok(yellowMarkings.length >= 1, 'Two-way road must have a solid centre divider');
    // Outer edge lines (2 lines)
    assert.strictEqual(whiteMarkings.length, 2, 'Two-way road must have solid outer edge lines on both sides and NO dashed lines');

    network.dispose();
  });
});
