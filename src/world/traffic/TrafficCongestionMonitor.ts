import { RoadNetworkModel } from '../RoadNetworkModel';
import { GridSystem } from '../GridSystem';
import {
  RoadCongestionState,
  RoadSegmentTrafficCondition,
  BlockageCause,
} from './TrafficTypes';
import { SimulatedVehicleData } from './TrafficSimulationManager';

/**
 * TrafficCongestionMonitor
 * Real-time traffic condition monitoring, congestion state classification,
 * hysteresis filtering, and blockage detection for Global Transport Empire.
 */
export class TrafficCongestionMonitor {
  private gridSystem: GridSystem;
  private roadModel: RoadNetworkModel;

  // Active traffic conditions mapped by "gridX,gridZ"
  private conditions: Map<string, RoadSegmentTrafficCondition> = new Map();

  // Explicitly unavailable or blocked cells (e.g. road severed or under emergency stop)
  private unavailableCells: Map<string, { reason: string; timestampMs: number }> = new Map();

  // Hysteresis tracking: cellKey -> { candidateState, candidateStartMs }
  private pendingTransitions: Map<string, { state: RoadCongestionState; sinceMs: number }> = new Map();

  // Performance throttling: aggregate at 0.5s intervals
  private elapsedSinceUpdate: number = 0;
  private readonly AGGREGATION_INTERVAL_SECONDS = 0.5;
  private readonly HYSTERESIS_CONFIRMATION_SECONDS = 1.2; // 1.2s confirmation window

  constructor(gridSystem: GridSystem, roadModel: RoadNetworkModel) {
    this.gridSystem = gridSystem;
    this.roadModel = roadModel;
  }

  /**
   * Main per-frame update loop.
   * Throttles expensive aggregation to 2Hz, applying hysteresis smoothing.
   */
  public update(
    deltaTime: number,
    vehicles: Iterable<SimulatedVehicleData>
  ): void {
    this.elapsedSinceUpdate += deltaTime;
    if (this.elapsedSinceUpdate < this.AGGREGATION_INTERVAL_SECONDS) {
      return;
    }
    const dt = this.elapsedSinceUpdate;
    this.elapsedSinceUpdate = 0;
    const now = Date.now();

    // 1. Group active simulated vehicles by grid cell
    const cellVehicleMap = new Map<string, SimulatedVehicleData[]>();
    for (const v of vehicles) {
      if (v.state === 'idle_parked') continue;
      const g = this.gridSystem.worldToGrid(
        v.entity.group.position.x,
        v.entity.group.position.z
      );
      if (!g) continue;
      const key = `${g.x},${g.z}`;
      let list = cellVehicleMap.get(key);
      if (!list) {
        list = [];
        cellVehicleMap.set(key, list);
      }
      list.push(v);
    }

    // 2. Evaluate all cells that currently have vehicles or have existing condition data
    const activeKeys = new Set<string>([
      ...cellVehicleMap.keys(),
      ...this.conditions.keys(),
      ...this.unavailableCells.keys(),
    ]);

    for (const key of activeKeys) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseInt(gxStr, 10);
      const gz = parseInt(gzStr, 10);

      // Check if road cell exists
      const roadCell = this.roadModel.getRoadCell(gx, gz);
      if (!roadCell) {
        // Road was demolished or doesn't exist
        this.conditions.delete(key);
        this.pendingTransitions.delete(key);
        continue;
      }

      // Check if explicitly marked unavailable
      const unavail = this.unavailableCells.get(key);
      if (unavail) {
        this.commitCondition(key, gx, gz, {
          cellKey: key,
          gridX: gx,
          gridZ: gz,
          congestionState: 'unavailable',
          vehicleCount: cellVehicleMap.get(key)?.length ?? 0,
          averageSpeedKmh: 0,
          speedLimitKmh: this.getSpeedLimitForRoadType(roadCell.roadType),
          occupancyRatio: 1.0,
          isBlocked: true,
          blockageReason: unavail.reason,
          lastUpdatedMs: now,
        });
        continue;
      }

      const cellVehicles = cellVehicleMap.get(key) ?? [];
      const vehicleCount = cellVehicles.length;
      const speedLimitKmh = this.getSpeedLimitForRoadType(roadCell.roadType);

      if (vehicleCount === 0) {
        // Free flowing empty segment
        this.evaluateStateTransition(key, gx, gz, 'free_flowing', {
          cellKey: key,
          gridX: gx,
          gridZ: gz,
          congestionState: 'free_flowing',
          vehicleCount: 0,
          averageSpeedKmh: speedLimitKmh,
          speedLimitKmh,
          occupancyRatio: 0.0,
          isBlocked: false,
          lastUpdatedMs: now,
        }, now);
        continue;
      }

      // Calculate average speed and stationary metrics
      let totalSpeedKmh = 0;
      let stationaryCount = 0;
      let maxWaitTime = 0;

      for (const v of cellVehicles) {
        const speedKmh = v.currentSpeedMs * 3.6;
        totalSpeedKmh += speedKmh;
        if (v.currentSpeedMs < 0.3) {
          stationaryCount++;
        }
        if (v.waitTimeSeconds > maxWaitTime) {
          maxWaitTime = v.waitTimeSeconds;
        }
      }

      const avgSpeedKmh = Math.round(totalSpeedKmh / vehicleCount);
      const speedRatio = avgSpeedKmh / (speedLimitKmh || 50);

      // Estimate capacity: standard 4m grid cell can comfortably hold 1 vehicle
      const cellCapacity = roadCell.roadType === 'heavy_arterial' || roadCell.roadType === 'arterial' ? 2 : 1;
      const occupancyRatio = Math.min(2.0, vehicleCount / cellCapacity);

      // Raw state determination
      let candidateState: RoadCongestionState = 'free_flowing';
      let isBlocked = false;
      let blockageReason: string | undefined = undefined;

      if (stationaryCount > 0 && maxWaitTime >= 8.0) {
        candidateState = 'temporarily_blocked';
        isBlocked = true;
        blockageReason = `Vehicle waiting at junction/obstacle for ${Math.round(maxWaitTime)}s`;
      } else if (occupancyRatio >= 1.0 || speedRatio < 0.40) {
        candidateState = 'congested';
        if (speedRatio < 0.15) {
          isBlocked = true;
          blockageReason = 'Traffic standstill';
        }
      } else if (occupancyRatio >= 0.6 || speedRatio < 0.70) {
        candidateState = 'busy';
      } else {
        candidateState = 'free_flowing';
      }

      this.evaluateStateTransition(key, gx, gz, candidateState, {
        cellKey: key,
        gridX: gx,
        gridZ: gz,
        congestionState: candidateState,
        vehicleCount,
        averageSpeedKmh: avgSpeedKmh,
        speedLimitKmh,
        occupancyRatio,
        isBlocked,
        blockageReason,
        lastUpdatedMs: now,
      }, now);
    }
  }

  /**
   * Applies hysteresis confirmation window to prevent rapid state oscillation
   */
  private evaluateStateTransition(
    key: string,
    gx: number,
    gz: number,
    candidateState: RoadCongestionState,
    candidateData: RoadSegmentTrafficCondition,
    now: number
  ): void {
    const current = this.conditions.get(key);

    if (!current) {
      // First observation: commit immediately
      this.commitCondition(key, gx, gz, candidateData);
      return;
    }

    if (current.congestionState === candidateState) {
      // No change in state, update metrics and clear pending
      this.pendingTransitions.delete(key);
      this.commitCondition(key, gx, gz, candidateData);
      return;
    }

    // Candidate is different from current: check hysteresis
    const pending = this.pendingTransitions.get(key);
    if (!pending || pending.state !== candidateState) {
      // Start confirmation timer
      this.pendingTransitions.set(key, { state: candidateState, sinceMs: now });
      // Keep previous state but update count/speed
      candidateData.congestionState = current.congestionState;
      this.commitCondition(key, gx, gz, candidateData);
    } else {
      const elapsedSec = (now - pending.sinceMs) / 1000;
      if (elapsedSec >= this.HYSTERESIS_CONFIRMATION_SECONDS) {
        // Confirmed! Commit new state
        this.pendingTransitions.delete(key);
        this.commitCondition(key, gx, gz, candidateData);
      } else {
        // Still pending: preserve current state in public view
        candidateData.congestionState = current.congestionState;
        this.commitCondition(key, gx, gz, candidateData);
      }
    }
  }

  private commitCondition(
    key: string,
    _gx: number,
    _gz: number,
    data: RoadSegmentTrafficCondition
  ): void {
    this.conditions.set(key, data);
  }

  /**
   * Returns the travel cost multiplier for pathfinding edge weights
   */
  public getCongestionMultiplier(gridX: number, gridZ: number): number {
    const key = `${gridX},${gridZ}`;
    if (this.unavailableCells.has(key)) return Infinity;

    const cond = this.conditions.get(key);
    if (!cond) return 1.0;

    switch (cond.congestionState) {
      case 'free_flowing':
        return 1.0;
      case 'busy':
        return 1.7; // 70% delay penalty
      case 'congested':
        return 3.2; // 3.2x travel time penalty
      case 'temporarily_blocked':
        return 6.0; // 6x penalty
      case 'unavailable':
        return Infinity;
      default:
        return 1.0;
    }
  }

  /**
   * Checks if a road cell is impassable or unavailable
   */
  public isRoadUnavailable(gridX: number, gridZ: number): boolean {
    const key = `${gridX},${gridZ}`;
    if (this.unavailableCells.has(key)) return true;
    const cond = this.conditions.get(key);
    return cond?.congestionState === 'unavailable';
  }

  /**
   * Explicitly marks a road cell as unavailable (e.g. severed, physical obstacle)
   */
  public markRoadUnavailable(
    gridX: number,
    gridZ: number,
    unavailable: boolean = true,
    reason: string = 'road_demolished'
  ): void {
    const key = `${gridX},${gridZ}`;
    if (!unavailable) {
      this.clearRoadUnavailable(gridX, gridZ);
      return;
    }
    this.unavailableCells.set(key, { reason, timestampMs: Date.now() });
    let cond = this.conditions.get(key);
    if (!cond) {
      const roadCell = this.roadModel.getRoadCell(gridX, gridZ);
      cond = {
        cellKey: key,
        gridX,
        gridZ,
        congestionState: 'unavailable',
        vehicleCount: 0,
        averageSpeedKmh: 0,
        speedLimitKmh: roadCell ? this.getSpeedLimitForRoadType(roadCell.roadType) : 50,
        occupancyRatio: 1.0,
        isBlocked: true,
        blockageReason: reason,
        lastUpdatedMs: Date.now(),
      };
      this.conditions.set(key, cond);
    } else {
      cond.congestionState = 'unavailable';
      cond.isBlocked = true;
      cond.blockageReason = reason;
    }
  }

  /**
   * Clears explicit unavailable status
   */
  public clearRoadUnavailable(gridX: number, gridZ: number): void {
    const key = `${gridX},${gridZ}`;
    this.unavailableCells.delete(key);
    const cond = this.conditions.get(key);
    if (cond && cond.congestionState === 'unavailable') {
      cond.congestionState = 'free_flowing';
      cond.isBlocked = false;
      cond.blockageReason = undefined;
    }
  }

  /**
   * Queries real-time congestion state at specific road cell.
   * Returns 'free_flowing' by default for valid road segments with normal or zero traffic.
   */
  public getConditionAt(gridX: number, gridZ: number): RoadCongestionState {
    const key = `${gridX},${gridZ}`;
    if (this.unavailableCells.has(key)) return 'unavailable';
    const cond = this.conditions.get(key);
    if (!cond) {
      return 'free_flowing';
    }
    return cond.congestionState;
  }

  /**
   * Queries full detailed segment traffic condition data
   */
  public getSegmentCondition(gridX: number, gridZ: number): RoadSegmentTrafficCondition | undefined {
    return this.conditions.get(`${gridX},${gridZ}`);
  }

  /**
   * Returns list of all segments experiencing busy, congested, or blocked conditions
   */
  public getAllCongestedSegments(): RoadSegmentTrafficCondition[] {
    const result: RoadSegmentTrafficCondition[] = [];
    for (const c of this.conditions.values()) {
      if (
        c.congestionState === 'busy' ||
        c.congestionState === 'congested' ||
        c.congestionState === 'temporarily_blocked' ||
        c.congestionState === 'unavailable'
      ) {
        result.push(c);
      }
    }
    return result;
  }

  private getSpeedLimitForRoadType(roadType: string): number {
    switch (roadType) {
      case 'highway_corridor':
        return 90;
      case 'divided_avenue':
      case 'heavy_arterial':
        return 70;
      case 'collector_street':
        return 60;
      case 'two_lane_urban':
      case 'local_street':
        return 50;
      case 'industrial_access':
      case 'service_track':
        return 35;
      default:
        return 50;
    }
  }

  public clear(): void {
    this.conditions.clear();
    this.unavailableCells.clear();
    this.pendingTransitions.clear();
  }

  public dispose(): void {
    this.clear();
  }
}
