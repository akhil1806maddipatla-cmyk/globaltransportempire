/**
 * Professional Road Network Diagnostics, Auto-Recovery, and Intersection Validation
 * Global Transport Empire - Civil Infrastructure & Safety Engineering
 *
 * Implements authoritative validation for:
 * 1. Disconnected endpoints that should connect to adjacent networks.
 * 2. Asymmetric or duplicate junction connection topologies.
 * 3. Grade separation integrity (preventing false at-grade intersections across elevation steps).
 * 4. Highway corridor ramp & interchange validity (no direct driveway access, proper merge links).
 * 5. Physical obstructions (buildings, natural water bodies without bridges, excessive terrain grade).
 * 6. Facility and Depot access guarantees (Starter Depot 3-space unhindered access).
 * 7. Automated connection repair and topology self-healing.
 */

import { WorldManager } from './WorldManager';
import { RoadNetworkModel, RoadCellData, JunctionType } from './RoadNetworkModel';
import { GridSystem } from './GridSystem';
import { TransportNetwork } from '../network/TransportNetwork';
import { PathfindingEngine } from '../navigation/PathfindingEngine';

export type DiagnosticSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface RoadDiagnosticIssue {
  id: string;
  category:
    | 'disconnected_endpoint'
    | 'asymmetric_connection'
    | 'grade_separation'
    | 'highway_access'
    | 'terrain_obstruction'
    | 'depot_access'
    | 'route_recalculation';
  severity: DiagnosticSeverity;
  gridX: number;
  gridZ: number;
  message: string;
  autoRepairable: boolean;
  suggestedAction?: string;
}

export interface RoadNetworkAuditReport {
  timestamp: number;
  isHealthy: boolean;
  totalRoadCells: number;
  totalJunctions: number;
  junctionBreakdown: Record<JunctionType, number>;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  issues: RoadDiagnosticIssue[];
  depotAccessVerified: boolean;
  connectedComponents: number;
}

export class RoadNetworkDiagnostics {
  /**
   * Runs a comprehensive, non-destructive civil engineering audit across the entire road network.
   */
  public static runComprehensiveAudit(params: {
    roadNetworkModel: RoadNetworkModel;
    gridSystem: GridSystem;
    transportNetwork?: TransportNetwork;
    pathfinding?: PathfindingEngine;
    worldManager?: WorldManager;
  }): RoadNetworkAuditReport {
    const { roadNetworkModel, gridSystem, pathfinding } = params;
    const cells = roadNetworkModel.getAllRoadCells();
    const issues: RoadDiagnosticIssue[] = [];

    // Track junction breakdown
    const junctionBreakdown: Record<JunctionType, number> = {
      isolated: 0,
      endpoint: 0,
      straight_horizontal: 0,
      straight_vertical: 0,
      corner_ne: 0,
      corner_nw: 0,
      corner_se: 0,
      corner_sw: 0,
      t_junction: 0,
      crossroad: 0,
      roundabout: 0,
      highway_merge: 0,
      bridge_approach: 0,
    };

    let totalJunctions = 0;

    // 1. Audit Every Active Road Cell
    for (const cell of cells) {
      junctionBreakdown[cell.junctionType] = (junctionBreakdown[cell.junctionType] || 0) + 1;
      if (
        cell.junctionType === 't_junction' ||
        cell.junctionType === 'crossroad' ||
        cell.junctionType === 'roundabout' ||
        cell.junctionType === 'highway_merge'
      ) {
        totalJunctions++;
      }

      // Check 1: Asymmetric Connections (if A connects to B, B MUST connect to A)
      this.checkConnectionSymmetry(cell, roadNetworkModel, issues);

      // Check 2: Grade-Separated Crossings (ensure no false at-grade intersections over large elevation steps)
      this.checkGradeSeparation(cell, roadNetworkModel, issues);

      // Check 3: Disconnected Endpoints (flag endpoints that dead-end right next to another road without connecting)
      this.checkDanglingEndpoints(cell, roadNetworkModel, gridSystem, issues);

      // Check 4: Highway Corridor Direct Building Incursion
      this.checkHighwayDirectAccess(cell, gridSystem, issues);

      // Check 5: Water Obstacle without Bridge Deck
      this.checkWaterObstacleCollision(cell, gridSystem, issues);
    }

    // Check 6: Starting Truck Depot Access Guarantee
    const depotAccessVerified = this.verifyStartingDepotAccess(roadNetworkModel, pathfinding, issues);

    // Check 7: Connected Components Analysis
    const netValidation = roadNetworkModel.validateNetwork();
    if (netValidation.connectedComponents > 1) {
      issues.push({
        id: 'issue_isolated_components',
        category: 'disconnected_endpoint',
        severity: 'CRITICAL',
        gridX: -1,
        gridZ: -1,
        message: `Network has ${netValidation.connectedComponents} isolated road networks with ${netValidation.disconnectedCount} disconnected clusters.`,
        autoRepairable: false,
        suggestedAction: 'Connect isolated road clusters with municipal street or arterial links.',
      });
    }

    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

    return {
      timestamp: Date.now(),
      isHealthy: criticalCount === 0,
      totalRoadCells: cells.length,
      totalJunctions,
      junctionBreakdown,
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      issues,
      depotAccessVerified,
      connectedComponents: netValidation.connectedComponents,
    };
  }

  /**
   * Symmetry check: ensures connection reciprocity between adjacent cells
   */
  private static checkConnectionSymmetry(
    cell: RoadCellData,
    model: RoadNetworkModel,
    issues: RoadDiagnosticIssue[]
  ): void {
    const checks: Array<{ dir: 'north' | 'south' | 'east' | 'west'; opp: 'north' | 'south' | 'east' | 'west'; nx: number; nz: number }> = [
      { dir: 'north', opp: 'south', nx: cell.gridX, nz: cell.gridZ - 1 },
      { dir: 'south', opp: 'north', nx: cell.gridX, nz: cell.gridZ + 1 },
      { dir: 'east', opp: 'west', nx: cell.gridX + 1, nz: cell.gridZ },
      { dir: 'west', opp: 'east', nx: cell.gridX - 1, nz: cell.gridZ },
    ];

    for (const c of checks) {
      if (cell.connections[c.dir]) {
        const neighbor = model.getRoadCell(c.nx, c.nz);
        if (!neighbor || !neighbor.connections[c.opp]) {
          issues.push({
            id: `asym_${cell.gridX}_${cell.gridZ}_${c.dir}`,
            category: 'asymmetric_connection',
            severity: 'WARNING',
            gridX: cell.gridX,
            gridZ: cell.gridZ,
            message: `Asymmetrical road connection detected between (${cell.gridX}, ${cell.gridZ}) and (${c.nx}, ${c.nz}).`,
            autoRepairable: true,
            suggestedAction: 'Run autoRepairNetwork() to synchronize connection reciprocity.',
          });
        }
      }
    }
  }

  /**
   * Grade separation check: flags invalid at-grade connections across steep elevation differences
   */
  private static checkGradeSeparation(
    cell: RoadCellData,
    model: RoadNetworkModel,
    issues: RoadDiagnosticIssue[]
  ): void {
    const neighbors = [
      { cell: model.getRoadCell(cell.gridX, cell.gridZ - 1), dir: 'north' },
      { cell: model.getRoadCell(cell.gridX, cell.gridZ + 1), dir: 'south' },
      { cell: model.getRoadCell(cell.gridX + 1, cell.gridZ), dir: 'east' },
      { cell: model.getRoadCell(cell.gridX - 1, cell.gridZ), dir: 'west' },
    ];

    for (const n of neighbors) {
      if (n.cell && (cell.connections as any)[n.dir]) {
        const elevDelta = Math.abs(cell.elevation - n.cell.elevation);
        const isRampOrApproach =
          cell.roadType === 'highway_ramp' ||
          n.cell.roadType === 'highway_ramp' ||
          cell.junctionMetadata?.isBridgeApproach ||
          n.cell.junctionMetadata?.isBridgeApproach;

        if (elevDelta > 0.60 && !isRampOrApproach) {
          issues.push({
            id: `grade_mismatch_${cell.gridX}_${cell.gridZ}_${n.cell.gridX}_${n.cell.gridZ}`,
            category: 'grade_separation',
            severity: 'CRITICAL',
            gridX: cell.gridX,
            gridZ: cell.gridZ,
            message: `Illegal at-grade intersection between (${cell.gridX}, ${cell.gridZ}) and (${n.cell.gridX}, ${n.cell.gridZ}) with ${elevDelta.toFixed(2)}m elevation change. Grade separation required.`,
            autoRepairable: true,
            suggestedAction: 'Sever at-grade connection and apply grade-separated overpass or bridge approach ramp.',
          });
        }
      }
    }
  }

  /**
   * Disconnected endpoint check: identifies dead ends that stop directly adjacent to another road without connecting
   */
  private static checkDanglingEndpoints(
    cell: RoadCellData,
    model: RoadNetworkModel,
    gridSystem: GridSystem,
    issues: RoadDiagnosticIssue[]
  ): void {
    if (cell.junctionType !== 'endpoint') return;

    // Check 4 adjacent directions
    const adj = gridSystem.getAdjacentCells(cell.gridX, cell.gridZ);
    for (const n of adj) {
      const neighbor = model.getRoadCell(n.x, n.z);
      if (neighbor) {
        // Is it connected?
        const isConnected = model.areCellsConnected(cell.gridX, cell.gridZ, n.x, n.z);
        if (!isConnected && model.canCellsConnect(cell, neighbor)) {
          issues.push({
            id: `dangling_${cell.gridX}_${cell.gridZ}_near_${n.x}_${n.z}`,
            category: 'disconnected_endpoint',
            severity: 'INFO',
            gridX: cell.gridX,
            gridZ: cell.gridZ,
            message: `Road endpoint at (${cell.gridX}, ${cell.gridZ}) is adjacent to road (${n.x}, ${n.z}) but not connected.`,
            autoRepairable: true,
            suggestedAction: 'Update connections or re-route junction to connect adjacent roadways.',
          });
        }
      }
    }
  }

  /**
   * Highway carriageway access check
   */
  private static checkHighwayDirectAccess(
    cell: RoadCellData,
    gridSystem: GridSystem,
    issues: RoadDiagnosticIssue[]
  ): void {
    if (cell.roadType !== 'highway_corridor') return;

    // Direct building driveway doors onto high-speed 110 km/h highway carriageways are hazardous
    const neighbors = gridSystem.getAdjacentCells(cell.gridX, cell.gridZ);
    for (const n of neighbors) {
      const occ = gridSystem.getOccupancy(n.x, n.z);
      if (occ === 'building') {
        // Warning: facility directly abutting highway
        issues.push({
          id: `hwy_direct_bld_${cell.gridX}_${cell.gridZ}_${n.x}_${n.z}`,
          category: 'highway_access',
          severity: 'WARNING',
          gridX: cell.gridX,
          gridZ: cell.gridZ,
          message: `Facility at (${n.x}, ${n.z}) directly abuts high-speed highway corridor at (${cell.gridX}, ${cell.gridZ}). Controlled frontage road or ramp recommended.`,
          autoRepairable: false,
        });
      }
    }
  }

  /**
   * Checks if an ordinary surface road is submerged in water without an engineered bridge
   */
  private static checkWaterObstacleCollision(
    cell: RoadCellData,
    gridSystem: GridSystem,
    issues: RoadDiagnosticIssue[]
  ): void {
    if (gridSystem.terrainModel && gridSystem.terrainModel.isWaterCell(cell.gridX, cell.gridZ)) {
      if (cell.layer !== 'bridge' && !cell.junctionMetadata?.isBridgeApproach) {
        issues.push({
          id: `water_submerged_${cell.gridX}_${cell.gridZ}`,
          category: 'terrain_obstruction',
          severity: 'CRITICAL',
          gridX: cell.gridX,
          gridZ: cell.gridZ,
          message: `Surface roadway at (${cell.gridX}, ${cell.gridZ}) is submerged in natural water body without an engineered bridge deck.`,
          autoRepairable: true,
          suggestedAction: 'Upgrade road cell layer to bridge or elevate deck above high-water datum.',
        });
      }
    }
  }

  /**
   * Verifies the starting depot at (12, 13) has an unobstructed road connection
   */
  private static verifyStartingDepotAccess(
    model: RoadNetworkModel,
    pathfinding?: PathfindingEngine,
    issues?: RoadDiagnosticIssue[]
  ): boolean {
    // Starting Depot is at (12, 13) with entrance at (11, 14)
    const spurCell = model.getRoadCell(11, 14);
    if (!spurCell) {
      if (issues) {
        issues.push({
          id: 'depot_spur_missing',
          category: 'depot_access',
          severity: 'CRITICAL',
          gridX: 11,
          gridZ: 14,
          message: 'Level 1 Starter Truck Depot access spur at (11, 14) is missing from the road network.',
          autoRepairable: false,
        });
      }
      return false;
    }

    if (pathfinding) {
      // Test route from depot to arterial network at (11, 11)
      const route = pathfinding.planRoute(11, 14, 11, 11, 'road');
      if (!route.success) {
        if (issues) {
          issues.push({
            id: 'depot_arterial_unreachable',
            category: 'depot_access',
            severity: 'CRITICAL',
            gridX: 11,
            gridZ: 14,
            message: 'Starting Truck Depot cannot navigate to the main arterial network.',
            autoRepairable: false,
          });
        }
        return false;
      }
    }

    return true;
  }

  /**
   * Automatically heals repairable road connection defects in the network
   */
  public static autoHealNetwork(model: RoadNetworkModel): {
    repairedCount: number;
    actionsTaken: string[];
  } {
    const { repairedCells, issuesFixed } = model.autoRepairNetwork();
    return {
      repairedCount: repairedCells,
      actionsTaken: issuesFixed,
    };
  }
}
