/**
 * Precise Civil Traffic Lane Path & Trajectory Generator
 * Global Transport Empire - Civil Engineering & Vehicle Kinematics
 *
 * Transforms topological A* road cell paths into lane-centered,
 * right-hand-traffic compliant 3D trajectories with filleted intersection curves,
 * multi-block corridor lane offsets, and smooth starter depot apron access paths.
 */

import { GridSystem } from '../GridSystem';
import { RoadNetworkModel, RoadCellData } from '../RoadNetworkModel';
import { TrafficLaneWaypoint } from './TrafficTypes';

export class TrafficLanePathGenerator {
  public static readonly ROAD_SURFACE_ELEVATION = 0.042;
  public static readonly BRIDGE_DECK_ELEVATION = 0.80;
  public static readonly DEPOT_APRON_ELEVATION = 0.28;

  // Starter Depot designated bay world coordinates (Bay 1, 2, 3)
  public static readonly STARTER_DEPOT_BAYS: Record<number, { x: number; y: number; z: number; heading: number }> = {
    1: { x: 3.2, y: 0.28, z: 10.2, heading: 180 },
    2: { x: 6.5, y: 0.28, z: 10.2, heading: 180 },
    3: { x: 9.8, y: 0.28, z: 10.2, heading: 180 },
  };

  /**
   * Generates a complete, lane-disciplined 3D waypoint trajectory from a cell path
   */
  public static generateLaneTrajectory(
    cellPath: Array<{ x: number; z: number }>,
    roadModel: RoadNetworkModel,
    gridSystem: GridSystem,
    options: {
      depotBayIndex?: number;
      isDepartingDepot?: boolean;
      isArrivingDepot?: boolean;
      preferCruisingLane?: boolean;
    } = {}
  ): TrafficLaneWaypoint[] {
    if (cellPath.length === 0 && !options.isDepartingDepot && !options.isArrivingDepot) return [];

    const waypoints: TrafficLaneWaypoint[] = [];

    // 1. If departing from Starter Depot, prepend apron departure path
    if (options.isDepartingDepot) {
      const bayIdx = options.depotBayIndex ?? 2;
      const bay = this.STARTER_DEPOT_BAYS[bayIdx] ?? this.STARTER_DEPOT_BAYS[2];
      
      // Point 0: Staged in bay
      waypoints.push({
        x: bay.x,
        y: bay.y,
        z: bay.z,
        headingDegrees: bay.heading, // Facing 180 (South)
        speedLimitKmh: 15,
        roadType: 'depot_bay',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: `Depot Staging Bay #${bayIdx}`,
      });

      // Point 1: Pull forward into depot staging apron
      waypoints.push({
        x: bay.x,
        y: this.DEPOT_APRON_ELEVATION,
        z: 13.5,
        headingDegrees: 180,
        speedLimitKmh: 20,
        roadType: 'depot_apron',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: 'Depot Staging Apron',
      });

      // Point 2: Turn West toward dropped curb apron driveway
      waypoints.push({
        x: 0.5,
        y: this.DEPOT_APRON_ELEVATION,
        z: 13.5,
        headingDegrees: 270,
        speedLimitKmh: 20,
        roadType: 'depot_apron',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: 'Depot Driveway Apron',
      });

      // Point 3: Dropped curb transition to spur road
      waypoints.push({
        x: -0.8,
        y: (this.DEPOT_APRON_ELEVATION + this.ROAD_SURFACE_ELEVATION) / 2,
        z: 13.5,
        headingDegrees: 290,
        speedLimitKmh: 20,
        roadType: 'depot_driveway',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: 'Dropped Curb Driveway Ramp',
      });

      // Point 4: Merged onto spur road heading North along the right-hand lane (X = -1.0)
      waypoints.push({
        x: -1.0,
        y: this.ROAD_SURFACE_ELEVATION,
        z: 13.5,
        headingDegrees: 0,
        speedLimitKmh: 35,
        roadType: 'two_lane_urban',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: 'Spur Road Merge Point',
      });
    }

    // 2. Build road network lane waypoints
    for (let i = 0; i < cellPath.length; i++) {
      const currentCell = cellPath[i];
      const roadData = roadModel.getRoadCell(currentCell.x, currentCell.z);
      const isBridge = gridSystem.terrainModel.isWaterCell(currentCell.x, currentCell.z);
      const elevation = isBridge ? this.BRIDGE_DECK_ELEVATION : (roadData?.elevation ?? this.ROAD_SURFACE_ELEVATION);

      const cellCenter = gridSystem.gridToWorldCenter(currentCell.x, currentCell.z);
      const speedLimitKmh = this.resolveSpeedLimit(roadData);

      // Determine movement vector from previous or to next cell
      let dirX = 0;
      let dirZ = 0;
      if (i < cellPath.length - 1) {
        dirX = cellPath[i + 1].x - currentCell.x;
        dirZ = cellPath[i + 1].z - currentCell.z;
      } else if (i > 0) {
        dirX = currentCell.x - cellPath[i - 1].x;
        dirZ = currentCell.z - cellPath[i - 1].z;
      } else {
        dirX = 1; // default forward East
      }

      // Check if this cell represents a direction change / turn
      const isTurn =
        i > 0 &&
        i < cellPath.length - 1 &&
        (cellPath[i].x - cellPath[i - 1].x !== cellPath[i + 1].x - cellPath[i].x ||
          cellPath[i].z - cellPath[i - 1].z !== cellPath[i + 1].z - cellPath[i].z);

      if (isTurn) {
        const prevCell = cellPath[i - 1];
        const nextCell = cellPath[i + 1];

        const inDirX = currentCell.x - prevCell.x;
        const inDirZ = currentCell.z - prevCell.z;
        const outDirX = nextCell.x - currentCell.x;
        const outDirZ = nextCell.z - currentCell.z;

        // Calculate right-hand lane offset for entry and exit
        const inOffset = this.calculateLaneOffset(roadData, inDirX, inDirZ);
        const outOffset = this.calculateLaneOffset(roadModel.getRoadCell(nextCell.x, nextCell.z) ?? roadData, outDirX, outDirZ);

        const half = gridSystem.cellSize / 2;

        // Entry point along incoming lane at boundary of current cell
        const entryX = cellCenter.x - inDirX * half + inOffset.x;
        const entryZ = cellCenter.z - inDirZ * half + inOffset.z;

        // Exit point along outgoing lane at boundary of current cell
        const exitX = cellCenter.x + outDirX * half + outOffset.x;
        const exitZ = cellCenter.z + outDirZ * half + outOffset.z;

        const headingIn = (Math.atan2(inDirX, -inDirZ) * 180) / Math.PI;
        const headingOut = (Math.atan2(outDirX, -outDirZ) * 180) / Math.PI;

        const juncId = `junc_${currentCell.x}_${currentCell.z}`;

        // 1. Approach Stop Line waypoint
        waypoints.push({
          x: entryX - inDirX * 0.4,
          y: elevation,
          z: entryZ - inDirZ * 0.4,
          headingDegrees: headingIn,
          speedLimitKmh: Math.min(speedLimitKmh, 35),
          roadType: roadData?.roadType ?? 'two_lane_urban',
          laneIndex: 0,
          isJunction: true,
          junctionId: juncId,
          isStopLine: true,
          name: `Stop Line (${currentCell.x}, ${currentCell.z})`,
        });

        // 2. Smooth Cubic Bézier Curve through Intersection / Turn Apex
        // Filleted curve ensures vehicle remains entirely within lane boundaries
        const p0 = { x: entryX, z: entryZ };
        const p3 = { x: exitX, z: exitZ };
        const chordDist = Math.hypot(exitX - entryX, exitZ - entryZ);
        const tangentLength = Math.min(gridSystem.cellSize * 0.35, chordDist * 0.38);
        const p1 = { x: entryX + inDirX * tangentLength, z: entryZ + inDirZ * tangentLength };
        const p2 = { x: exitX - outDirX * tangentLength, z: exitZ - outDirZ * tangentLength };

        const curveSamples = [0.15, 0.35, 0.55, 0.75, 0.90];
        for (const t of curveSamples) {
          const u = 1 - t;
          const bx = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
          const bz = u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z;

          // Derivative for exact tangent heading
          const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
          const dz = 3 * u * u * (p1.z - p0.z) + 6 * u * t * (p2.z - p1.z) + 3 * t * t * (p3.z - p2.z);
          const rawHeading = (Math.atan2(dx, -dz) * 180) / Math.PI;
          const sampleHeading = ((rawHeading % 360) + 360) % 360;

          waypoints.push({
            x: bx,
            y: elevation,
            z: bz,
            headingDegrees: sampleHeading,
            speedLimitKmh: Math.min(speedLimitKmh, 30),
            roadType: roadData?.roadType ?? 'two_lane_urban',
            laneIndex: 0,
            isJunction: true,
            junctionId: juncId,
            isTurnApex: t === 0.55,
            name: `Intersection Curve (${currentCell.x}, ${currentCell.z})`,
          });
        }

        // 3. Junction Exit Waypoint
        waypoints.push({
          x: exitX,
          y: elevation,
          z: exitZ,
          headingDegrees: ((headingOut % 360) + 360) % 360,
          speedLimitKmh: speedLimitKmh,
          roadType: roadData?.roadType ?? 'two_lane_urban',
          laneIndex: 0,
          isJunction: true,
          junctionId: juncId,
          name: `Intersection Exit (${currentCell.x}, ${currentCell.z})`,
        });
      } else {
        // Straight Road Cell: Offset strictly into the right-hand directional carriageway
        const offset = this.calculateLaneOffset(roadData, dirX, dirZ);
        const heading = (Math.atan2(dirX, -dirZ) * 180) / Math.PI;

        const laneX = cellCenter.x + offset.x;
        const laneZ = cellCenter.z + offset.z;

        // Add midway entry and exit points for long segments to ensure smooth interpolation
        const half = gridSystem.cellSize / 2;
        const entryX = laneX - dirX * (half * 0.5);
        const entryZ = laneZ - dirZ * (half * 0.5);
        const exitX = laneX + dirX * (half * 0.5);
        const exitZ = laneZ + dirZ * (half * 0.5);

        waypoints.push({
          x: entryX,
          y: elevation,
          z: entryZ,
          headingDegrees: heading,
          speedLimitKmh,
          roadType: roadData?.roadType ?? 'two_lane_urban',
          laneIndex: 0,
          isJunction: false,
          name: `Road Cell (${currentCell.x}, ${currentCell.z}) Entry`,
        });

        waypoints.push({
          x: laneX,
          y: elevation,
          z: laneZ,
          headingDegrees: heading,
          speedLimitKmh,
          roadType: roadData?.roadType ?? 'two_lane_urban',
          laneIndex: 0,
          isJunction: false,
          name: `Road Cell (${currentCell.x}, ${currentCell.z}) Mid`,
        });

        waypoints.push({
          x: exitX,
          y: elevation,
          z: exitZ,
          headingDegrees: heading,
          speedLimitKmh,
          roadType: roadData?.roadType ?? 'two_lane_urban',
          laneIndex: 0,
          isJunction: false,
          name: `Road Cell (${currentCell.x}, ${currentCell.z}) Exit`,
        });
      }
    }

    // 3. If arriving at Starter Depot, append arrival parking path
    if (options.isArrivingDepot) {
      const bayIdx = options.depotBayIndex ?? 2;
      const bay = this.STARTER_DEPOT_BAYS[bayIdx] ?? this.STARTER_DEPOT_BAYS[2];

      // Approach from spur road into driveway
      waypoints.push({
        x: -0.8,
        y: (this.DEPOT_APRON_ELEVATION + this.ROAD_SURFACE_ELEVATION) / 2,
        z: 13.5,
        headingDegrees: 90, // East into depot
        speedLimitKmh: 20,
        roadType: 'depot_driveway',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: 'Depot Driveway Entry Ramp',
      });

      // Align across apron in front of target bay
      waypoints.push({
        x: bay.x,
        y: this.DEPOT_APRON_ELEVATION,
        z: 13.5,
        headingDegrees: 90,
        speedLimitKmh: 15,
        roadType: 'depot_apron',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: `Depot Apron Alignment for Bay #${bayIdx}`,
      });

      // Pull into bay facing North (or backed in)
      waypoints.push({
        x: bay.x,
        y: bay.y,
        z: bay.z,
        headingDegrees: 0, // Parked facing North against wheel stop
        speedLimitKmh: 10,
        roadType: 'depot_bay',
        laneIndex: 0,
        isJunction: false,
        isDepotAccess: true,
        name: `Parked Bay #${bayIdx}`,
      });
    }

    return waypoints;
  }

  /**
   * Calculates the exact right-hand lateral lane offset from cell center (x, z)
   * in world coordinates.
   * Right-hand traffic rule:
   * Moving North (dirX=0, dirZ=-1): right lane is East (+x)
   * Moving South (dirX=0, dirZ=1): right lane is West (-x)
   * Moving East (dirX=1, dirZ=0): right lane is South (+z)
   * Moving West (dirX=-1, dirZ=0): right lane is North (-z)
   */
  public static calculateLaneOffset(
    cell: RoadCellData | undefined,
    dirX: number,
    dirZ: number,
    isPassingLane: boolean = false
  ): { x: number; z: number } {
    // Right normal vector
    const rightNormalX = -dirZ;
    const rightNormalZ = dirX;

    // Default 2-lane municipal street (4m cell): right lane center at +1.0m from center
    let offsetMeters = 1.0;

    if (cell) {
      if (cell.roadType === 'highway_corridor' || cell.roadType === 'heavy_arterial') {
        // Divided highway with central Jersey median:
        // Cruising lane at +1.02m, Passing lane at +1.82m
        offsetMeters = isPassingLane ? 1.82 : 1.02;
      } else if (cell.roadType === 'industrial_access') {
        offsetMeters = 0.85;
      } else if (cell.roadType === 'highway_ramp') {
        offsetMeters = 0.80;
      }

      // If multi-block road metadata exists (e.g. 2-block, 3-block, 4-block corridor)
      if (cell.widthBlocks && cell.widthBlocks >= 2) {
        if (cell.widthBlocks === 2) {
          // 2-block road: center divider is on the boundary between the two blocks
          offsetMeters = 1.0;
        } else if (cell.widthBlocks === 4) {
          // 4-block road (2 blocks per direction):
          offsetMeters = isPassingLane ? 1.2 : 2.8;
        }
      }
    }

    return {
      x: rightNormalX * offsetMeters,
      z: rightNormalZ * offsetMeters,
    };
  }

  private static resolveSpeedLimit(cell: RoadCellData | undefined): number {
    if (!cell) return 50;
    if (cell.roadType === 'highway_corridor') return 110;
    if (cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial') return 75;
    if (cell.roadType === 'industrial_access') return 35;
    if (cell.roadType === 'highway_ramp') return 60;
    return 50; // two_lane_urban
  }

  /**
   * Convenience method to generate lane waypoints for a series of cells
   */
  public static generateWaypointsFromCells(
    cellPath: Array<{ x: number; z: number }>,
    roadModel: RoadNetworkModel,
    gridSystem: GridSystem,
    options?: {
      depotBayIndex?: number;
      isDepartingDepot?: boolean;
      isArrivingDepot?: boolean;
      preferCruisingLane?: boolean;
    }
  ): TrafficLaneWaypoint[] {
    return this.generateLaneTrajectory(cellPath, roadModel, gridSystem, options);
  }

  /**
   * Generates apron departure trajectory for a given bay index (1, 2, or 3)
   */
  public static generateDepotDepartureTrajectory(bayIndex: number = 2): TrafficLaneWaypoint[] {
    const dummyRoadModel = {
      getRoadCell: () => undefined,
      getAllRoadCells: () => [],
      hasRoad: () => false,
    } as unknown as RoadNetworkModel;

    const dummyGridSystem = {
      gridToWorldCenter: (gx: number, gz: number) => ({ x: gx * 4.0 + 2.0, z: gz * 4.0 + 2.0 }),
      terrainModel: { isWaterCell: () => false },
    } as unknown as GridSystem;

    return this.generateLaneTrajectory([], dummyRoadModel, dummyGridSystem, {
      isDepartingDepot: true,
      depotBayIndex: bayIndex,
    });
  }

  /**
   * Generates apron return trajectory for a given bay index (1, 2, or 3)
   */
  public static generateDepotReturnTrajectory(bayIndex: number = 2): TrafficLaneWaypoint[] {
    const dummyRoadModel = {
      getRoadCell: () => undefined,
      getAllRoadCells: () => [],
      hasRoad: () => false,
    } as unknown as RoadNetworkModel;

    const dummyGridSystem = {
      gridToWorldCenter: (gx: number, gz: number) => ({ x: gx * 4.0 + 2.0, z: gz * 4.0 + 2.0 }),
      terrainModel: { isWaterCell: () => false },
    } as unknown as GridSystem;

    return this.generateLaneTrajectory([], dummyRoadModel, dummyGridSystem, {
      isArrivingDepot: true,
      depotBayIndex: bayIndex,
    });
  }
}

export const STARTER_DEPOT_BAYS = TrafficLanePathGenerator.STARTER_DEPOT_BAYS;
