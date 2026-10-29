/**
 * Civil Intersection Coordinator & Deadlock-Free Junction Reservation System
 * Global Transport Empire - Civil Engineering & Intersection Control
 *
 * Implements deterministic conflict-zone tracking, approach stop-line queuing,
 * road-hierarchy priority yielding, phased signal coordination, and
 * automated deadlock detection and recovery.
 */

import { JunctionReservation, JunctionApproachQueueItem } from './TrafficTypes';

export type ApproachDirection = 'north' | 'south' | 'east' | 'west' | 'depot';

export interface JunctionState {
  junctionId: string;
  gridX: number;
  gridZ: number;
  junctionType: string;
  activeReservation: JunctionReservation | null;
  waitingQueue: JunctionApproachQueueItem[];
  signalPhase: 'ew_green' | 'ns_green';
  phaseTimerSeconds: number;
  totalVehiclesPassed: number;
}

export class IntersectionCoordinator {
  private junctions: Map<string, JunctionState> = new Map();
  private deadlockResolutionsCount: number = 0;
  private readonly SIGNAL_CYCLE_SECONDS = 7.0; // 7s green per axis on signalized crossroads
  private readonly DEADLOCK_TIMEOUT_SECONDS = 6.0; // 6s wait triggers deadlock recovery

  public registerJunction(
    gridX: number,
    gridZ: number,
    junctionType: string = 'crossroad'
  ): string {
    const id = `junc_${gridX}_${gridZ}`;
    if (!this.junctions.has(id)) {
      this.junctions.set(id, {
        junctionId: id,
        gridX,
        gridZ,
        junctionType,
        activeReservation: null,
        waitingQueue: [],
        signalPhase: 'ew_green',
        phaseTimerSeconds: 0,
        totalVehiclesPassed: 0,
      });
    }
    return id;
  }

  public getJunction(junctionId: string): JunctionState | undefined {
    return this.junctions.get(junctionId);
  }

  public getJunctionInfo(junctionId: string): JunctionState | undefined {
    return this.getJunction(junctionId);
  }

  public getAllJunctions(): JunctionState[] {
    return Array.from(this.junctions.values());
  }

  /**
   * Evaluates if a vehicle can safely enter the junction conflict area.
   * Checks active reservations, signal phases on crossroads, and approach queue priority.
   */
  public canEnterJunction(
    junctionId: string,
    vehicleId: string,
    approach: ApproachDirection,
    _outgoingDir: ApproachDirection,
    isPriorityRoad: boolean = false
  ): { canEnter: boolean; waitReason?: string } {
    let state = this.junctions.get(junctionId);
    if (!state) {
      // Auto-register if not yet known
      const parts = junctionId.replace('junc_', '').split('_');
      const gx = parseInt(parts[0], 10) || 0;
      const gz = parseInt(parts[1], 10) || 0;
      this.registerJunction(gx, gz);
      state = this.junctions.get(junctionId)!;
    }

    // 1. If this vehicle already owns the reservation, it is cleared to proceed
    if (state.activeReservation && state.activeReservation.occupyingVehicleId === vehicleId) {
      return { canEnter: true };
    }

    // 2. If junction conflict area is occupied by another vehicle, must wait
    if (state.activeReservation && state.activeReservation.occupyingVehicleId !== null) {
      this.enqueueWaitingVehicle(state, vehicleId, approach, isPriorityRoad);
      return {
        canEnter: false,
        waitReason: `Junction occupied by vehicle '${state.activeReservation.occupyingVehicleId}'`,
      };
    }

    // 3. Signalized crossroad phase check (Traffic Lights on 4-way Crossroads)
    if (state.junctionType === 'crossroad') {
      const isEW = approach === 'east' || approach === 'west';
      const isNS = approach === 'north' || approach === 'south';

      if (state.signalPhase === 'ew_green' && isNS && !isPriorityRoad) {
        this.enqueueWaitingVehicle(state, vehicleId, approach, isPriorityRoad);
        return { canEnter: false, waitReason: 'Red traffic signal on North-South approach' };
      }
      if (state.signalPhase === 'ns_green' && isEW && !isPriorityRoad) {
        this.enqueueWaitingVehicle(state, vehicleId, approach, isPriorityRoad);
        return { canEnter: false, waitReason: 'Red traffic signal on East-West approach' };
      }
    }

    // 4. Queue priority check: if other vehicles are waiting ahead in the queue
    if (state.waitingQueue.length > 0) {
      const topOfQueue = state.waitingQueue[0];
      if (topOfQueue.vehicleId !== vehicleId) {
        // If this vehicle has strict road priority (e.g. arterial highway over local street)
        if (isPriorityRoad && !topOfQueue.isPriority) {
          // Priority arterial bypasses non-priority queue
        } else {
          this.enqueueWaitingVehicle(state, vehicleId, approach, isPriorityRoad);
          return { canEnter: false, waitReason: `Yielding to earlier arrival in queue (${topOfQueue.vehicleId})` };
        }
      }
    }

    return { canEnter: true };
  }

  /**
   * Grants an atomic reservation of the junction conflict zone
   */
  public reserveJunction(
    junctionId: string,
    vehicleId: string,
    incomingDirection: ApproachDirection,
    outgoingDirection: ApproachDirection
  ): boolean {
    const state = this.junctions.get(junctionId);
    if (!state) return false;

    // Remove from waiting queue if present
    state.waitingQueue = state.waitingQueue.filter((item) => item.vehicleId !== vehicleId);

    state.activeReservation = {
      junctionId,
      occupyingVehicleId: vehicleId,
      incomingDirection,
      outgoingDirection,
      timeGrantedMs: Date.now(),
      clearedDistanceMeters: 0,
    };
    state.totalVehiclesPassed++;

    return true;
  }

  /**
   * Releases the junction reservation as soon as the vehicle has cleared the conflict zone
   */
  public releaseJunction(junctionId: string, vehicleId: string): boolean {
    const state = this.junctions.get(junctionId);
    if (!state || !state.activeReservation) return false;

    if (state.activeReservation.occupyingVehicleId === vehicleId) {
      state.activeReservation = null;
      return true;
    }
    return false;
  }

  /**
   * Enqueues a waiting vehicle safely without duplication
   */
  private enqueueWaitingVehicle(
    state: JunctionState,
    vehicleId: string,
    approach: ApproachDirection,
    isPriority: boolean
  ): void {
    const existing = state.waitingQueue.find((item) => item.vehicleId === vehicleId);
    if (!existing) {
      state.waitingQueue.push({
        vehicleId,
        approach,
        arrivalTimeMs: Date.now(),
        isPriority,
      });
      // Sort priority arrivals first, then arrival timestamp
      state.waitingQueue.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return a.arrivalTimeMs - b.arrivalTimeMs;
      });
    }
  }

  /**
   * Updates traffic signals, checks waiting queue timeouts, and resolves deadlocks
   */
  public update(deltaTime: number): void {
    const now = Date.now();

    for (const state of this.junctions.values()) {
      // 1. Phased signal cycle for crossroads
      if (state.junctionType === 'crossroad') {
        state.phaseTimerSeconds += deltaTime;
        if (state.phaseTimerSeconds >= this.SIGNAL_CYCLE_SECONDS) {
          state.phaseTimerSeconds -= this.SIGNAL_CYCLE_SECONDS;
          state.signalPhase = state.signalPhase === 'ew_green' ? 'ns_green' : 'ew_green';
        }
      }

      // 2. Stale reservation timeout check (e.g. if vehicle despawned or rerouted)
      if (state.activeReservation) {
        state.activeReservation.heldDurationSeconds = (state.activeReservation.heldDurationSeconds || 0) + deltaTime;
        const heldDurationSec = Math.max(
          state.activeReservation.heldDurationSeconds,
          (now - state.activeReservation.timeGrantedMs) / 1000
        );
        if (heldDurationSec > 8.0) {
          // Force-release stalled reservation to prevent network freezing
          state.activeReservation = null;
          this.deadlockResolutionsCount++;
        }
      }

      // 3. Deadlock detection: if vehicles in waiting queue have waited > 6.0 seconds
      if (state.waitingQueue.length > 0 && !state.activeReservation) {
        const oldestWaitSec = (now - state.waitingQueue[0].arrivalTimeMs) / 1000;
        if (oldestWaitSec > this.DEADLOCK_TIMEOUT_SECONDS) {
          // Deadlock breaker: instantly promote the oldest waiting vehicle
          const vehicleIdToPromote = state.waitingQueue[0].vehicleId;
          const approach = state.waitingQueue[0].approach;
          this.reserveJunction(state.junctionId, vehicleIdToPromote, approach, approach);
          this.deadlockResolutionsCount++;
        }
      }
    }
  }

  public resolveJunctionDeadlock(junctionId: string, requestingVehicleId?: string): boolean {
    const state = this.junctions.get(junctionId);
    if (!state) return false;

    const now = Date.now();
    let resolved = false;

    // 1. Release active reservation if held for more than 8 seconds (sim or real time)
    // or if explicitly resolving a deadlock for a blocked vehicle
    if (state.activeReservation) {
      const heldSec = Math.max(
        state.activeReservation.heldDurationSeconds || 0,
        (now - state.activeReservation.timeGrantedMs) / 1000
      );
      if (heldSec >= 8.0 || (requestingVehicleId && state.activeReservation.occupyingVehicleId !== requestingVehicleId)) {
        state.activeReservation = null;
        this.deadlockResolutionsCount++;
        resolved = true;
      }
    }

    // 2. If no active reservation, promote requesting vehicle or head of queue
    if (!state.activeReservation && state.waitingQueue.length > 0) {
      let targetItem = state.waitingQueue[0];
      if (requestingVehicleId) {
        const found = state.waitingQueue.find((item) => item.vehicleId === requestingVehicleId);
        if (found) targetItem = found;
      }
      this.reserveJunction(state.junctionId, targetItem.vehicleId, targetItem.approach, targetItem.approach);
      this.deadlockResolutionsCount++;
      resolved = true;
    }

    return resolved;
  }

  public getDeadlockCount(): number {
    return this.deadlockResolutionsCount;
  }

  public clear(): void {
    this.junctions.clear();
    this.deadlockResolutionsCount = 0;
  }
}
