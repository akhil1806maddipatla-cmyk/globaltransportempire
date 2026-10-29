import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';
import { TerrainModel } from './TerrainModel';

export type CellOccupancyType = 'empty' | 'road' | 'building' | 'reserved' | 'obstacle';

export interface GridCell {
  x: number; // grid index X (0..width-1)
  z: number; // grid index Z (0..height-1)
  worldX: number; // world space center X
  worldZ: number; // world space center Z
  occupancy: CellOccupancyType;
  occupantId: string | null;
}

export interface RotatedFootprint {
  effectiveWidth: number;
  effectiveDepth: number;
  rotationDegrees: number;
}

export class GridSystem {
  public readonly width: number;
  public readonly height: number;
  public readonly cellSize: number;
  public readonly originX: number;
  public readonly originZ: number;
  public readonly terrainModel: TerrainModel;

  private cells: GridCell[][];

  constructor(
    width: number = DEFAULT_GAME_CONFIG.grid.width,
    height: number = DEFAULT_GAME_CONFIG.grid.height,
    cellSize: number = DEFAULT_GAME_CONFIG.grid.cellSize,
    terrainModel?: TerrainModel,
    originX?: number,
    originZ?: number
  ) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.terrainModel = terrainModel || new TerrainModel();

    // Preserve authoritative origin (-48, -48) or use passed origin, fallback to centering if non-standard size
    this.originX = originX !== undefined ? originX : (width === DEFAULT_GAME_CONFIG.grid.width ? DEFAULT_GAME_CONFIG.grid.originX : -(this.width * this.cellSize) / 2);
    this.originZ = originZ !== undefined ? originZ : (height === DEFAULT_GAME_CONFIG.grid.height ? DEFAULT_GAME_CONFIG.grid.originZ : -(this.height * this.cellSize) / 2);

    this.cells = [];
    this.initializeGrid();
  }

  private initializeGrid(): void {
    for (let x = 0; x < this.width; x++) {
      this.cells[x] = [];
      for (let z = 0; z < this.height; z++) {
        const worldCoord = this.gridToWorldCenter(x, z);
        this.cells[x][z] = {
          x,
          z,
          worldX: worldCoord.x,
          worldZ: worldCoord.z,
          occupancy: 'empty',
          occupantId: null,
        };
      }
    }
  }

  public clear(): void {
    this.initializeGrid();
  }

  /**
   * Converts grid (x, z) to top-left corner world position
   */
  public gridToWorldCorner(gridX: number, gridZ: number): { x: number; z: number } {
    return {
      x: this.originX + gridX * this.cellSize,
      z: this.originZ + gridZ * this.cellSize,
    };
  }

  /**
   * Converts grid (x, z) to center of the cell in world coordinates
   */
  public gridToWorldCenter(gridX: number, gridZ: number): { x: number; z: number } {
    return {
      x: this.originX + (gridX + 0.5) * this.cellSize,
      z: this.originZ + (gridZ + 0.5) * this.cellSize,
    };
  }

  /**
   * Converts world coordinates (x, z) to grid cell index, or null if out of bounds
   */
  public worldToGrid(worldX: number, worldZ: number): { x: number; z: number } | null {
    const rawX = (worldX - this.originX) / this.cellSize;
    const rawZ = (worldZ - this.originZ) / this.cellSize;

    const gridX = Math.floor(rawX);
    const gridZ = Math.floor(rawZ);

    if (this.isWithinBounds(gridX, gridZ)) {
      return { x: gridX, z: gridZ };
    }
    return null;
  }

  /**
   * Snaps a world position to the nearest grid cell coordinate and snapped world center
   */
  public snapWorldToGrid(worldX: number, worldZ: number): {
    gridX: number;
    gridZ: number;
    snappedWorldX: number;
    snappedWorldZ: number;
  } {
    const clampedWorldX = Math.max(this.originX, Math.min(this.originX + this.width * this.cellSize - 0.001, worldX));
    const clampedWorldZ = Math.max(this.originZ, Math.min(this.originZ + this.height * this.cellSize - 0.001, worldZ));

    const gridX = Math.floor((clampedWorldX - this.originX) / this.cellSize);
    const gridZ = Math.floor((clampedWorldZ - this.originZ) / this.cellSize);

    const center = this.gridToWorldCenter(gridX, gridZ);
    return {
      gridX,
      gridZ,
      snappedWorldX: center.x,
      snappedWorldZ: center.z,
    };
  }

  public isWithinBounds(gridX: number, gridZ: number): boolean {
    return gridX >= 0 && gridX < this.width && gridZ >= 0 && gridZ < this.height;
  }

  public cellToIndex(gridX: number, gridZ: number): number {
    return gridZ * this.width + gridX;
  }

  public indexToCell(index: number): { x: number; z: number } {
    const z = Math.floor(index / this.width);
    const x = index % this.width;
    return { x, z };
  }

  /**
   * Calculates the effective footprint dimension given a rotation angle (0, 90, 180, 270)
   */
  public calculateRotatedFootprint(
    width: number,
    depth: number,
    rotationDegrees: number
  ): RotatedFootprint {
    const normalizedAngle = ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360;
    const isSwapped = normalizedAngle === 90 || normalizedAngle === 270;

    return {
      effectiveWidth: isSwapped ? depth : width,
      effectiveDepth: isSwapped ? width : depth,
      rotationDegrees: normalizedAngle,
    };
  }

  /**
   * Returns list of all cells occupied by a building with anchor (anchorX, anchorZ)
   */
  public getFootprintCells(
    anchorX: number,
    anchorZ: number,
    width: number,
    depth: number,
    rotationDegrees: number = 0
  ): { x: number; z: number }[] {
    const { effectiveWidth, effectiveDepth } = this.calculateRotatedFootprint(width, depth, rotationDegrees);
    const cells: { x: number; z: number }[] = [];

    for (let x = anchorX; x < anchorX + effectiveWidth; x++) {
      for (let z = anchorZ; z < anchorZ + effectiveDepth; z++) {
        cells.push({ x, z });
      }
    }
    return cells;
  }

  /**
   * Calculates world-space center of a building footprint
   */
  public getFootprintWorldCenter(
    anchorX: number,
    anchorZ: number,
    width: number,
    depth: number,
    rotationDegrees: number = 0
  ): { x: number; z: number } {
    const { effectiveWidth, effectiveDepth } = this.calculateRotatedFootprint(width, depth, rotationDegrees);
    const corner = this.gridToWorldCorner(anchorX, anchorZ);
    return {
      x: corner.x + (effectiveWidth * this.cellSize) / 2,
      z: corner.z + (effectiveDepth * this.cellSize) / 2,
    };
  }

  public getCell(gridX: number, gridZ: number): GridCell | null {
    if (!this.isWithinBounds(gridX, gridZ)) return null;
    return this.cells[gridX][gridZ];
  }

  public getOccupancy(gridX: number, gridZ: number): CellOccupancyType | 'out_of_bounds' {
    if (!this.isWithinBounds(gridX, gridZ)) return 'out_of_bounds';
    return this.cells[gridX][gridZ].occupancy;
  }

  public setOccupancy(
    gridX: number,
    gridZ: number,
    type: CellOccupancyType,
    occupantId: string | null = null
  ): boolean {
    const cell = this.getCell(gridX, gridZ);
    if (!cell) return false;
    cell.occupancy = type;
    cell.occupantId = occupantId;
    return true;
  }

  public setAreaOccupancy(
    startX: number,
    startZ: number,
    width: number,
    depth: number,
    type: CellOccupancyType,
    occupantId: string | null = null
  ): boolean {
    for (let x = startX; x < startX + width; x++) {
      for (let z = startZ; z < startZ + depth; z++) {
        if (!this.setOccupancy(x, z, type, occupantId)) {
          return false;
        }
      }
    }
    return true;
  }

  public clearAreaOccupancy(
    startX: number,
    startZ: number,
    width: number,
    depth: number,
    expectedOccupantId?: string | null
  ): void {
    for (let x = startX; x < startX + width; x++) {
      for (let z = startZ; z < startZ + depth; z++) {
        const cell = this.getCell(x, z);
        if (cell) {
          if (!expectedOccupantId || cell.occupantId === expectedOccupantId) {
            cell.occupancy = 'empty';
            cell.occupantId = null;
          }
        }
      }
    }
  }

  public isAreaFree(startX: number, startZ: number, width: number, depth: number): boolean {
    for (let x = startX; x < startX + width; x++) {
      for (let z = startZ; z < startZ + depth; z++) {
        const cell = this.getCell(x, z);
        if (!cell || cell.occupancy !== 'empty') {
          return false;
        }
      }
    }
    return true;
  }

  public getAdjacentCells(gridX: number, gridZ: number): {
    x: number;
    z: number;
    dir: 'north' | 'south' | 'east' | 'west';
  }[] {
    const neighbors: { x: number; z: number; dir: 'north' | 'south' | 'east' | 'west' }[] = [];

    // North (z - 1)
    if (this.isWithinBounds(gridX, gridZ - 1)) neighbors.push({ x: gridX, z: gridZ - 1, dir: 'north' });
    // South (z + 1)
    if (this.isWithinBounds(gridX, gridZ + 1)) neighbors.push({ x: gridX, z: gridZ + 1, dir: 'south' });
    // East (x + 1)
    if (this.isWithinBounds(gridX + 1, gridZ)) neighbors.push({ x: gridX + 1, z: gridZ, dir: 'east' });
    // West (x - 1)
    if (this.isWithinBounds(gridX - 1, gridZ)) neighbors.push({ x: gridX - 1, z: gridZ, dir: 'west' });

    return neighbors;
  }

  public getWorldDimensions(): { width: number; depth: number; areaMetersSquared: number } {
    const width = this.width * this.cellSize;
    const depth = this.height * this.cellSize;
    return {
      width,
      depth,
      areaMetersSquared: width * depth,
    };
  }

  /**
   * Returns exact world-space bounding box for a grid cell
   */
  public getCellWorldBounds(gridX: number, gridZ: number): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    center: { x: number; z: number };
  } | null {
    if (!this.isWithinBounds(gridX, gridZ)) return null;
    const corner = this.gridToWorldCorner(gridX, gridZ);
    return {
      minX: corner.x,
      maxX: corner.x + this.cellSize,
      minZ: corner.z,
      maxZ: corner.z + this.cellSize,
      center: this.gridToWorldCenter(gridX, gridZ),
    };
  }

  /**
   * Returns authoritative world-space bounding box for an anchored, rotated footprint
   */
  public getFootprintWorldBounds(
    anchorX: number,
    anchorZ: number,
    width: number,
    depth: number,
    rotationDegrees: number = 0
  ): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    widthMeters: number;
    depthMeters: number;
    center: { x: number; z: number };
  } {
    const { effectiveWidth, effectiveDepth } = this.calculateRotatedFootprint(width, depth, rotationDegrees);
    const corner = this.gridToWorldCorner(anchorX, anchorZ);
    const widthMeters = effectiveWidth * this.cellSize;
    const depthMeters = effectiveDepth * this.cellSize;

    return {
      minX: corner.x,
      maxX: corner.x + widthMeters,
      minZ: corner.z,
      maxZ: corner.z + depthMeters,
      widthMeters,
      depthMeters,
      center: {
        x: corner.x + widthMeters / 2,
        z: corner.z + depthMeters / 2,
      },
    };
  }

  /**
   * Evaluates if two 2D world-space axis-aligned bounding boxes overlap
   */
  public static boundsOverlap(
    a: { minX: number; maxX: number; minZ: number; maxZ: number },
    b: { minX: number; maxX: number; minZ: number; maxZ: number },
    tolerance: number = 1e-4
  ): boolean {
    return !(
      a.maxX <= b.minX + tolerance ||
      a.minX >= b.maxX - tolerance ||
      a.maxZ <= b.minZ + tolerance ||
      a.minZ >= b.maxZ - tolerance
    );
  }

  /**
   * Tests if a continuous world coordinate falls inside a specific grid cell
   */
  public isPointInCell(worldX: number, worldZ: number, gridX: number, gridZ: number): boolean {
    const bounds = this.getCellWorldBounds(gridX, gridZ);
    if (!bounds) return false;
    return (
      worldX >= bounds.minX &&
      worldX < bounds.maxX &&
      worldZ >= bounds.minZ &&
      worldZ < bounds.maxZ
    );
  }

  /**
   * Calculates metric Euclidean distance in meters between two world points
   */
  public worldDistance(x1: number, z1: number, x2: number, z2: number): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Calculates metric Euclidean distance between centers of two grid cells
   */
  public gridDistance(gx1: number, gz1: number, gx2: number, gz2: number): number {
    const c1 = this.gridToWorldCenter(gx1, gz1);
    const c2 = this.gridToWorldCenter(gx2, gz2);
    return this.worldDistance(c1.x, c1.z, c2.x, c2.z);
  }

  /**
   * Calculates discrete Manhattan distance in cell steps
   */
  public manhattanDistance(gx1: number, gz1: number, gx2: number, gz2: number): number {
    return Math.abs(gx2 - gx1) + Math.abs(gz2 - gz1);
  }

  /**
   * Applies natural water obstacles from the terrain model to the grid
   */
  public applyNaturalTerrainFeatures(): void {
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.height; z++) {
        if (this.terrainModel.isWaterCell(x, z)) {
          this.setOccupancy(x, z, 'obstacle', 'water_natural');
        }
      }
    }
  }

  /**
   * Returns authoritative ground surface datum elevation (0.0m for terrain, 0.04m for road pavement, -0.15m for water)
   */
  public getTerrainHeight(worldX: number, worldZ: number): number {
    const grid = this.worldToGrid(worldX, worldZ);
    if (!grid) return 0.0;
    const occ = this.getOccupancy(grid.x, grid.z);
    if (occ === 'road') return 0.04;
    return this.terrainModel.getElevationAt(worldX, worldZ, false);
  }
}
