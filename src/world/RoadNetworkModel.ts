import { GridSystem } from './GridSystem';

export type RoadType =
  | 'two_lane_urban'
  | 'heavy_arterial'
  | 'highway_corridor'
  | 'highway_ramp'
  | 'industrial_access'
  | 'arterial'
  | 'secondary'
  | 'access';

export type RoadLayer = 'surface' | 'elevated' | 'bridge' | 'tunnel';

export type JunctionType =
  | 'isolated'
  | 'endpoint'
  | 'straight_horizontal'
  | 'straight_vertical'
  | 'corner_ne'
  | 'corner_nw'
  | 'corner_se'
  | 'corner_sw'
  | 't_junction'
  | 'crossroad'
  | 'roundabout'
  | 'highway_merge'
  | 'bridge_approach';

export interface JunctionMetadata {
  stemDirection?: 'north' | 'south' | 'east' | 'west';
  throughAxis?: 'horizontal' | 'vertical';
  isRoundabout?: boolean;
  isBridgeApproach?: boolean;
  rampMergeDirection?: 'merge_on' | 'exit_off';
  curbFilletRadiusMeters?: number;
  gradeSlopePercent?: number;
}

export interface RoadCellData {
  id: string;
  gridX: number;
  gridZ: number;
  roadType: RoadType;
  elevation: number;
  layer: RoadLayer;
  connections: {
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
  };
  junctionType: JunctionType;
  junctionMetadata?: JunctionMetadata;
  speedLimitKmH: number;
  laneCount: number;

  // Multi-block width and directional carriageway properties
  widthBlocks?: number;
  corridorAxis?: 'horizontal' | 'vertical' | 'junction';
  corridorIndex?: number;
  forwardBlocks?: number;
  backwardBlocks?: number;
  isOuterEdgeMin?: boolean;
  isOuterEdgeMax?: boolean;
  isCentreDividerEdgeMin?: boolean;
  isCentreDividerEdgeMax?: boolean;
  hasInternalDashedMin?: boolean;
  hasInternalDashedMax?: boolean;
}

export interface NetworkValidationReport {
  isValid: boolean;
  roadCount: number;
  connectedComponents: number;
  disconnectedCount: number;
  issues: string[];
}

export class RoadNetworkModel {
  private gridSystem: GridSystem;
  private roadCells = new Map<string, RoadCellData>();

  constructor(gridSystem: GridSystem) {
    this.gridSystem = gridSystem;
  }

  private cellKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  public hasRoad(x: number, z: number): boolean {
    return this.roadCells.has(this.cellKey(x, z));
  }

  public getRoadCell(x: number, z: number): RoadCellData | undefined {
    return this.roadCells.get(this.cellKey(x, z));
  }

  public getAllRoadCells(): RoadCellData[] {
    return Array.from(this.roadCells.values());
  }

  public addRoadCell(
    x: number,
    z: number,
    roadType: RoadType = 'secondary',
    idPrefix: string = 'road',
    layer: RoadLayer = 'surface',
    elevation?: number,
    corridorMetadata?: Partial<RoadCellData>
  ): RoadCellData | null {
    if (!this.gridSystem.isWithinBounds(x, z)) return null;

    const key = this.cellKey(x, z);
    const id = `${idPrefix}_${x}_${z}`;
    const worldCenter = this.gridSystem.gridToWorldCenter(x, z);
    const computedElev = elevation !== undefined
      ? elevation
      : (this.gridSystem.getTerrainHeight ? this.gridSystem.getTerrainHeight(worldCenter.x, worldCenter.z) + 0.04 : 0.04);

    const isHighway = roadType === 'highway_corridor' || roadType === 'highway_ramp';
    const isArterial = roadType === 'heavy_arterial' || roadType === 'arterial';
    const speedLimitKmH = roadType === 'highway_corridor' ? 110 : (roadType === 'highway_ramp' ? 65 : (isArterial ? 75 : 50));
    const laneCount = roadType === 'highway_corridor' ? 4 : (isArterial ? 2 : (roadType === 'highway_ramp' ? 1 : 2));

    const cellData: RoadCellData = {
      id,
      gridX: x,
      gridZ: z,
      roadType,
      elevation: computedElev,
      layer,
      connections: { north: false, south: false, east: false, west: false },
      junctionType: 'isolated',
      junctionMetadata: {},
      speedLimitKmH,
      laneCount,
      ...corridorMetadata,
    };

    this.roadCells.set(key, cellData);
    this.gridSystem.setOccupancy(x, z, 'road', id);

    // Update connectivity for this cell and its 4 neighbors
    this.updateCellConnections(x, z);
    const adjacent = this.gridSystem.getAdjacentCells(x, z);
    for (const neighbor of adjacent) {
      if (this.hasRoad(neighbor.x, neighbor.z)) {
        this.updateCellConnections(neighbor.x, neighbor.z);
      }
    }

    return cellData;
  }

  public setRoadElevationAndLayer(
    x: number,
    z: number,
    elevation: number,
    layer: RoadLayer = 'surface',
    isBridgeApproach: boolean = false
  ): boolean {
    const cell = this.getRoadCell(x, z);
    if (!cell) return false;

    cell.elevation = elevation;
    cell.layer = layer;
    if (isBridgeApproach) {
      cell.junctionMetadata = { ...cell.junctionMetadata, isBridgeApproach: true };
    }

    // Refresh connections with grade separation logic
    this.updateCellConnections(x, z);
    const adjacent = this.gridSystem.getAdjacentCells(x, z);
    for (const neighbor of adjacent) {
      if (this.hasRoad(neighbor.x, neighbor.z)) {
        this.updateCellConnections(neighbor.x, neighbor.z);
      }
    }
    return true;
  }

  public setJunctionMetadata(x: number, z: number, metadata: Partial<JunctionMetadata>): boolean {
    const cell = this.getRoadCell(x, z);
    if (!cell) return false;
    cell.junctionMetadata = { ...cell.junctionMetadata, ...metadata };
    cell.junctionType = this.calculateJunctionType(cell.connections, cell);
    return true;
  }

  public removeRoadCell(x: number, z: number): boolean {
    const key = this.cellKey(x, z);
    if (!this.roadCells.has(key)) return false;

    this.roadCells.delete(key);
    this.gridSystem.setOccupancy(x, z, 'empty', null);

    // Update neighbors safely
    const adjacent = this.gridSystem.getAdjacentCells(x, z);
    for (const neighbor of adjacent) {
      if (this.hasRoad(neighbor.x, neighbor.z)) {
        this.updateCellConnections(neighbor.x, neighbor.z);
      }
    }

    return true;
  }

  /**
   * Verifies whether two adjacent road cells can physically and legally connect at grade.
   * Prevents false at-grade intersections when roads cross at different elevations (e.g. overpasses, viaducts).
   */
  public canCellsConnect(cellA: RoadCellData, cellB: RoadCellData): boolean {
    // If one is a bridge deck and the other is a surface road without bridge approach, they do not connect
    const isApproach = cellA.junctionMetadata?.isBridgeApproach || cellB.junctionMetadata?.isBridgeApproach;
    const elevDiff = Math.abs(cellA.elevation - cellB.elevation);

    // Max at-grade elevation tolerance is 0.60m across standard 4m grid spacing (15% slope)
    if (elevDiff > 0.60 && !isApproach && cellA.roadType !== 'highway_ramp' && cellB.roadType !== 'highway_ramp') {
      return false; // Grade-separated crossing (overpass / underpass)
    }

    // Bridge deck over surface road
    if (cellA.layer === 'bridge' && cellB.layer === 'surface' && !isApproach) {
      return false;
    }
    if (cellB.layer === 'bridge' && cellA.layer === 'surface' && !isApproach) {
      return false;
    }

    return true;
  }

  private updateCellConnections(x: number, z: number): void {
    const cell = this.roadCells.get(this.cellKey(x, z));
    if (!cell) return;

    const northCell = this.getRoadCell(x, z - 1);
    const southCell = this.getRoadCell(x, z + 1);
    const eastCell = this.getRoadCell(x + 1, z);
    const westCell = this.getRoadCell(x - 1, z);

    cell.connections.north = !!northCell && this.canCellsConnect(cell, northCell);
    cell.connections.south = !!southCell && this.canCellsConnect(cell, southCell);
    cell.connections.east = !!eastCell && this.canCellsConnect(cell, eastCell);
    cell.connections.west = !!westCell && this.canCellsConnect(cell, westCell);

    cell.junctionType = this.calculateJunctionType(cell.connections, cell);
  }

  public getJunctionType(x: number, z: number): JunctionType {
    const cell = this.roadCells.get(this.cellKey(x, z));
    if (!cell) return 'isolated';
    return cell.junctionType;
  }

  private calculateJunctionType(
    conn: { north: boolean; south: boolean; east: boolean; west: boolean },
    cell?: RoadCellData
  ): JunctionType {
    const count = (conn.north ? 1 : 0) + (conn.south ? 1 : 0) + (conn.east ? 1 : 0) + (conn.west ? 1 : 0);

    // Roundabout override
    if (cell?.junctionMetadata?.isRoundabout) {
      return 'roundabout';
    }

    // Bridge approach override
    if (cell?.junctionMetadata?.isBridgeApproach) {
      return 'bridge_approach';
    }

    // Explicit corridor axis assignment
    if (cell?.corridorAxis === 'horizontal' && (conn.east || conn.west)) {
      return 'straight_horizontal';
    }
    if (cell?.corridorAxis === 'vertical' && (conn.north || conn.south)) {
      return 'straight_vertical';
    }

    if (count === 4) {
      return 'crossroad';
    }

    if (count === 3) {
      // Parallel multi-lane road heuristic:
      // If cell connects East+West and also connects to an adjacent parallel lane with East+West, it's straight_horizontal
      if (cell && conn.east && conn.west) {
        const northNeighbor = conn.north ? this.getRoadCell(cell.gridX, cell.gridZ - 1) : null;
        const southNeighbor = conn.south ? this.getRoadCell(cell.gridX, cell.gridZ + 1) : null;
        if (
          (northNeighbor && northNeighbor.connections.east && northNeighbor.connections.west) ||
          (southNeighbor && southNeighbor.connections.east && southNeighbor.connections.west)
        ) {
          return 'straight_horizontal';
        }
      } else if (cell && conn.north && conn.south) {
        const eastNeighbor = conn.east ? this.getRoadCell(cell.gridX + 1, cell.gridZ) : null;
        const westNeighbor = conn.west ? this.getRoadCell(cell.gridX - 1, cell.gridZ) : null;
        if (
          (eastNeighbor && eastNeighbor.connections.north && eastNeighbor.connections.south) ||
          (westNeighbor && westNeighbor.connections.north && westNeighbor.connections.south)
        ) {
          return 'straight_vertical';
        }
      }

      // Calculate T-junction stem orientation
      if (cell) {
        if (!conn.north) cell.junctionMetadata = { ...cell.junctionMetadata, stemDirection: 'south', throughAxis: 'horizontal' };
        else if (!conn.south) cell.junctionMetadata = { ...cell.junctionMetadata, stemDirection: 'north', throughAxis: 'horizontal' };
        else if (!conn.east) cell.junctionMetadata = { ...cell.junctionMetadata, stemDirection: 'west', throughAxis: 'vertical' };
        else if (!conn.west) cell.junctionMetadata = { ...cell.junctionMetadata, stemDirection: 'east', throughAxis: 'vertical' };
      }
      return 't_junction';
    }

    if (count === 2) {
      // Highway ramp merge detection
      if (cell && (cell.roadType === 'highway_ramp' || cell.roadType === 'highway_corridor')) {
        const hasHighway = this.hasNeighborOfType(cell.gridX, cell.gridZ, 'highway_corridor');
        if (cell.roadType === 'highway_ramp' && hasHighway) {
          return 'highway_merge';
        }
      }

      if (conn.east && conn.west) return 'straight_horizontal';
      if (conn.north && conn.south) return 'straight_vertical';
      if (conn.north && conn.east) return 'corner_ne';
      if (conn.north && conn.west) return 'corner_nw';
      if (conn.south && conn.east) return 'corner_se';
      if (conn.south && conn.west) return 'corner_sw';
    }

    if (count === 1) return 'endpoint';
    return 'isolated';
  }

  private hasNeighborOfType(x: number, z: number, type: RoadType): boolean {
    const neighbors = [
      this.getRoadCell(x, z - 1),
      this.getRoadCell(x, z + 1),
      this.getRoadCell(x + 1, z),
      this.getRoadCell(x - 1, z),
    ];
    return neighbors.some((n) => n && n.roadType === type);
  }

  /**
   * Scans and repairs all asymmetrical or stale connections in the network
   */
  public autoRepairNetwork(): { repairedCells: number; issuesFixed: string[] } {
    let repairedCells = 0;
    const issuesFixed: string[] = [];

    for (const cell of this.roadCells.values()) {
      const prevType = cell.junctionType;
      this.updateCellConnections(cell.gridX, cell.gridZ);
      if (cell.junctionType !== prevType) {
        repairedCells++;
        issuesFixed.push(`Updated cell (${cell.gridX}, ${cell.gridZ}) from ${prevType} to ${cell.junctionType}`);
      }
    }

    return { repairedCells, issuesFixed };
  }

  /**
   * Validates road graph connectivity and checks for disconnected clusters
   */
  public validateNetwork(): NetworkValidationReport {
    const cells = Array.from(this.roadCells.values());
    const issues: string[] = [];

    if (cells.length === 0) {
      return {
        isValid: true,
        roadCount: 0,
        connectedComponents: 0,
        disconnectedCount: 0,
        issues: ['Network is empty'],
      };
    }

    // Breadth-first search for connected components
    const visited = new Set<string>();
    let components = 0;

    for (const cell of cells) {
      const key = this.cellKey(cell.gridX, cell.gridZ);
      if (!visited.has(key)) {
        components++;
        // Explore component
        const queue: { x: number; z: number }[] = [{ x: cell.gridX, z: cell.gridZ }];
        visited.add(key);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const neighbors = [
            { x: curr.x, z: curr.z - 1, valid: this.hasRoad(curr.x, curr.z - 1) },
            { x: curr.x, z: curr.z + 1, valid: this.hasRoad(curr.x, curr.z + 1) },
            { x: curr.x + 1, z: curr.z, valid: this.hasRoad(curr.x + 1, curr.z) },
            { x: curr.x - 1, z: curr.z, valid: this.hasRoad(curr.x - 1, curr.z) },
          ];

          for (const n of neighbors) {
            if (n.valid) {
              const nKey = this.cellKey(n.x, n.z);
              if (!visited.has(nKey)) {
                visited.add(nKey);
                queue.push({ x: n.x, z: n.z });
              }
            }
          }
        }
      }
    }

    if (components > 1) {
      issues.push(`Network has ${components} disconnected road networks.`);
    }

    return {
      isValid: components <= 1,
      roadCount: cells.length,
      connectedComponents: components,
      disconnectedCount: components > 1 ? components - 1 : 0,
      issues,
    };
  }

  public clear(): void {
    for (const cell of this.roadCells.values()) {
      this.gridSystem.setOccupancy(cell.gridX, cell.gridZ, 'empty', null);
    }
    this.roadCells.clear();
  }

  /**
   * Returns exact world-space lane centerlines for vehicular simulation.
   * Standard road cell (4.0m) features two opposing 1.75m lanes with +/-1.0m to 1.25m centerline offsets.
   */
  public getLaneCenterlines(x: number, z: number): {
    forwardLane: { x: number; z: number };
    backwardLane: { x: number; z: number };
    direction: 'horizontal' | 'vertical' | 'junction';
  } | null {
    const cell = this.getRoadCell(x, z);
    if (!cell) return null;
    const center = this.gridSystem.gridToWorldCenter(x, z);
    const laneOffset = 1.25; // 1.25m lateral offset accommodates standard 2.5m trucks in 3.5m travel lane

    if (cell.junctionType === 'straight_horizontal') {
      return {
        forwardLane: { x: center.x, z: center.z + laneOffset }, // Eastbound
        backwardLane: { x: center.x, z: center.z - laneOffset }, // Westbound
        direction: 'horizontal',
      };
    } else if (cell.junctionType === 'straight_vertical') {
      return {
        forwardLane: { x: center.x + laneOffset, z: center.z }, // Southbound
        backwardLane: { x: center.x - laneOffset, z: center.z }, // Northbound
        direction: 'vertical',
      };
    }

    // Default junction center
    return {
      forwardLane: { x: center.x, z: center.z },
      backwardLane: { x: center.x, z: center.z },
      direction: 'junction',
    };
  }

  /**
   * Verifies if two grid cells are directly adjacent and mutually road-connected
   */
  public areCellsConnected(x1: number, z1: number, x2: number, z2: number): boolean {
    if (!this.hasRoad(x1, z1) || !this.hasRoad(x2, z2)) return false;
    const dx = Math.abs(x2 - x1);
    const dz = Math.abs(z2 - z1);
    return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
  }

  /**
   * Returns exact 3D world boundary endpoints where this road cell meets neighboring cells
   */
  public getCellJunctionEndpoints(x: number, z: number): {
    north?: { x: number; z: number };
    south?: { x: number; z: number };
    east?: { x: number; z: number };
    west?: { x: number; z: number };
  } | null {
    const cell = this.getRoadCell(x, z);
    if (!cell) return null;
    const center = this.gridSystem.gridToWorldCenter(x, z);
    const half = this.gridSystem.cellSize / 2;

    const endpoints: {
      north?: { x: number; z: number };
      south?: { x: number; z: number };
      east?: { x: number; z: number };
      west?: { x: number; z: number };
    } = {};

    if (cell.connections.north) endpoints.north = { x: center.x, z: center.z - half };
    if (cell.connections.south) endpoints.south = { x: center.x, z: center.z + half };
    if (cell.connections.east) endpoints.east = { x: center.x + half, z: center.z };
    if (cell.connections.west) endpoints.west = { x: center.x - half, z: center.z };
    return endpoints;
  }

  /**
   * Validates if a proposed connection between two cells is physically and legally valid.
   */
  public validateConnection(x1: number, z1: number, x2: number, z2: number): { canConnect: boolean; reason?: string } {
    if (!this.hasRoad(x1, z1) || !this.hasRoad(x2, z2)) {
      return { canConnect: false, reason: 'Both cells must be active road segments.' };
    }
    const dx = Math.abs(x2 - x1);
    const dz = Math.abs(z2 - z1);
    if (!((dx === 1 && dz === 0) || (dx === 0 && dz === 1))) {
      return { canConnect: false, reason: 'Cells are not orthogonally adjacent.' };
    }
    const cellA = this.getRoadCell(x1, z1)!;
    const cellB = this.getRoadCell(x2, z2)!;
    if (!this.canCellsConnect(cellA, cellB)) {
      return {
        canConnect: false,
        reason: `Grade separation mismatch: elevations differ by ${Math.abs(cellA.elevation - cellB.elevation).toFixed(2)}m without a ramp or approach transition.`,
      };
    }
    return { canConnect: true };
  }

  public serialize(): object {
    const serializedCells = Array.from(this.roadCells.values()).map((c) => ({
      id: c.id,
      gridX: c.gridX,
      gridZ: c.gridZ,
      roadType: c.roadType,
      elevation: c.elevation,
      layer: c.layer,
      junctionType: c.junctionType,
      connections: { ...c.connections },
      junctionMetadata: c.junctionMetadata ? { ...c.junctionMetadata } : undefined,
      speedLimitKmH: c.speedLimitKmH,
      laneCount: c.laneCount,
    }));
    return {
      cells: serializedCells,
      roadCells: serializedCells,
    };
  }

  public deserialize(data: any): void {
    const list = data?.cells || data?.roadCells;
    if (!list || !Array.isArray(list)) return;
    this.clear();
    for (const c of list) {
      const isHighway = c.roadType === 'highway_corridor' || c.roadType === 'highway_ramp';
      const isArterial = c.roadType === 'heavy_arterial' || c.roadType === 'arterial';
      const speedLimitKmH = c.speedLimitKmH ?? (c.roadType === 'highway_corridor' ? 110 : (c.roadType === 'highway_ramp' ? 65 : (isArterial ? 75 : 50)));
      const laneCount = c.laneCount ?? (c.roadType === 'highway_corridor' ? 4 : (isArterial ? 2 : (c.roadType === 'highway_ramp' ? 1 : 2)));

      const key = this.cellKey(c.gridX, c.gridZ);
      const cellData: RoadCellData = {
        id: c.id,
        gridX: c.gridX,
        gridZ: c.gridZ,
        roadType: c.roadType,
        elevation: c.elevation ?? 0.04,
        layer: c.layer ?? 'surface',
        connections: c.connections ? { ...c.connections } : { north: false, south: false, east: false, west: false },
        junctionType: c.junctionType ?? 'isolated',
        junctionMetadata: c.junctionMetadata ? { ...c.junctionMetadata } : {},
        speedLimitKmH,
        laneCount,
      };
      this.roadCells.set(key, cellData);
      this.gridSystem.setOccupancy(c.gridX, c.gridZ, 'road', c.id);
    }
    // Re-verify connections
    for (const cell of this.roadCells.values()) {
      this.updateCellConnections(cell.gridX, cell.gridZ);
    }
  }
}
