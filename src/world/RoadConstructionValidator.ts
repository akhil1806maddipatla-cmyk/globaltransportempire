import { GridSystem } from './GridSystem';
import { RoadNetworkModel } from './RoadNetworkModel';
import { RoadDefinition } from '../data/roadDefinitions';
import { GridCoord } from './RoadPathGenerator';

export type RoadValidationReason =
  | 'VALID'
  | 'OUT_OF_BOUNDS'
  | 'COLLIDES_BUILDING'
  | 'COLLIDES_WATER_BODY'
  | 'RESERVED_LAND'
  | 'INSUFFICIENT_FUNDS'
  | 'EXCESSIVE_ROAD_SLOPE'
  | 'EMPTY_PATH';

export interface RoadValidationResult {
  isValid: boolean;
  reasonCode: RoadValidationReason;
  message: string;
  totalCost: number;
  newCells: GridCoord[];
  existingCells: GridCoord[];
  pathCells: GridCoord[];
}

export class RoadConstructionValidator {
  private gridSystem: GridSystem;
  private roadNetworkModel: RoadNetworkModel;

  constructor(gridSystem: GridSystem, roadNetworkModel: RoadNetworkModel) {
    this.gridSystem = gridSystem;
    this.roadNetworkModel = roadNetworkModel;
  }

  public validatePath(
    path: GridCoord[],
    roadDef: RoadDefinition,
    availableFunds: number
  ): RoadValidationResult {
    if (!path || path.length === 0) {
      return {
        isValid: false,
        reasonCode: 'EMPTY_PATH',
        message: 'No road route selected.',
        totalCost: 0,
        newCells: [],
        existingCells: [],
        pathCells: [],
      };
    }

    const newCells: GridCoord[] = [];
    const existingCells: GridCoord[] = [];

    // 1. Boundary & Collision Checks
    for (const cell of path) {
      if (!this.gridSystem.isWithinBounds(cell.x, cell.z)) {
        return {
          isValid: false,
          reasonCode: 'OUT_OF_BOUNDS',
          message: 'Road path exceeds sector map boundaries.',
          totalCost: 0,
          newCells: [],
          existingCells: [],
          pathCells: path,
        };
      }

      const occ = this.gridSystem.getOccupancy(cell.x, cell.z);

      if (occ === 'building') {
        return {
          isValid: false,
          reasonCode: 'COLLIDES_BUILDING',
          message: `Proposed route obstructed by existing facility at (${cell.x}, ${cell.z}).`,
          totalCost: 0,
          newCells: [],
          existingCells: [],
          pathCells: path,
        };
      }

      if (occ === 'reserved') {
        return {
          isValid: false,
          reasonCode: 'RESERVED_LAND',
          message: `Route crosses reserved survey plot at (${cell.x}, ${cell.z}).`,
          totalCost: 0,
          newCells: [],
          existingCells: [],
          pathCells: path,
        };
      }

      if (occ === 'obstacle') {
        return {
          isValid: false,
          reasonCode: 'COLLIDES_WATER_BODY',
          message: `Proposed route obstructed by natural water body at (${cell.x}, ${cell.z}). Requires bridge engineering.`,
          totalCost: 0,
          newCells: [],
          existingCells: [],
          pathCells: path,
        };
      }

      if (this.roadNetworkModel.hasRoad(cell.x, cell.z)) {
        existingCells.push(cell);
      } else {
        newCells.push(cell);
      }
    }

    // 2. Terrain Slope Gradient Check (between spatially adjacent cells)
    for (let i = 0; i < path.length - 1; i++) {
      const c1 = path[i];
      const c2 = path[i + 1];
      const w1 = this.gridSystem.gridToWorldCenter(c1.x, c1.z);
      const w2 = this.gridSystem.gridToWorldCenter(c2.x, c2.z);
      const dist = Math.hypot(w2.x - w1.x, w2.z - w1.z);
      if (dist <= this.gridSystem.cellSize * 1.5) {
        const h1 = this.gridSystem.getTerrainHeight ? this.gridSystem.getTerrainHeight(w1.x, w1.z) : 0;
        const h2 = this.gridSystem.getTerrainHeight ? this.gridSystem.getTerrainHeight(w2.x, w2.z) : 0;
        const slopeDelta = Math.abs(h2 - h1);
        const maxSlopeDelta = roadDef.hierarchyClass === 'highway' ? 0.45 : 0.75;
        if (slopeDelta > maxSlopeDelta) {
          return {
            isValid: false,
            reasonCode: 'EXCESSIVE_ROAD_SLOPE',
            message: `Proposed route gradient between (${c1.x}, ${c1.z}) and (${c2.x}, ${c2.z}) (${((slopeDelta / this.gridSystem.cellSize) * 100).toFixed(1)}% slope) exceeds civil design limits.`,
            totalCost: 0,
            newCells: [],
            existingCells: [],
            pathCells: path,
          };
        }
      }
    }

    // 3. Cost Calculation: charge ONLY for new segments
    const totalCost = newCells.length * roadDef.costPerCell;

    // 3. Economy Check
    if (availableFunds < totalCost) {
      return {
        isValid: false,
        reasonCode: 'INSUFFICIENT_FUNDS',
        message: `Insufficient treasury funds. Requires $${totalCost.toLocaleString()}, balance is $${availableFunds.toLocaleString()}.`,
        totalCost,
        newCells,
        existingCells,
        pathCells: path,
      };
    }

    // Route is fully valid
    return {
      isValid: true,
      reasonCode: 'VALID',
      message: newCells.length > 0
        ? `Valid route: ${newCells.length} new cells ($${totalCost.toLocaleString()}). Click to construct.`
        : 'Existing road segment reconnected at no additional cost.',
      totalCost,
      newCells,
      existingCells,
      pathCells: path,
    };
  }
}
