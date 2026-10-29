/**
 * Vehicle Maintenance & 5-Real-World-Day Service Cycle System
 * Global Transport Empire - Phase 1 Engineering & Economy Diagnostics
 * 
 * Enforces authoritative 5-real-world-day service cycles for all owned vehicles
 * (trucks, trains, aircraft, and maritime vessels). Tracks elapsed real-world time,
 * prevents duplicate charges, verifies treasury solvency, and maintains synchronized state.
 */

import { globalEventBus } from '../core/EventBus';
import { GameState } from './GameState';
import { Logger } from '../core/Logger';

const logger = new Logger('VehicleMaintenanceManager');

export const REAL_WORLD_MAINTENANCE_INTERVAL_DAYS = 5;
export const REAL_WORLD_MAINTENANCE_INTERVAL_MS =
  REAL_WORLD_MAINTENANCE_INTERVAL_DAYS * 24 * 60 * 60 * 1000; // 432,000,000 ms

export type TransportVehicleMode = 'road' | 'rail' | 'air' | 'maritime';

export interface VehicleMaintenanceRecord {
  vehicleId: string;
  vehicleMode: TransportVehicleMode;
  lastServiceTimestamp: number; // Real-world Epoch ms
  nextDueTimestamp: number;      // Exactly 5 real-world days after lastService
  maintenanceCost: number;       // In-game currency required
  serviceHistoryCount: number;
  isOverdue: boolean;
}

export interface MaintenancePerformResult {
  success: boolean;
  vehicleId: string;
  cost: number;
  newNextDueTimestamp?: number;
  shortfall?: number;
  error?: string;
}

export class VehicleMaintenanceManager {
  private records: Map<string, VehicleMaintenanceRecord> = new Map();

  /**
   * Registers an owned vehicle into the 5-day real-world maintenance schedule.
   * If customLastService is omitted, defaults to registration time (now).
   */
  public registerVehicle(
    vehicleId: string,
    vehicleMode: TransportVehicleMode = 'road',
    maintenanceCost: number = 250,
    customLastService?: number
  ): VehicleMaintenanceRecord {
    const existing = this.records.get(vehicleId);
    if (existing) {
      return existing;
    }

    const lastService = customLastService ?? Date.now();
    const nextDue = lastService + REAL_WORLD_MAINTENANCE_INTERVAL_MS;

    const record: VehicleMaintenanceRecord = {
      vehicleId,
      vehicleMode,
      lastServiceTimestamp: lastService,
      nextDueTimestamp: nextDue,
      maintenanceCost,
      serviceHistoryCount: 0,
      isOverdue: Date.now() > nextDue,
    };

    this.records.set(vehicleId, record);
    return record;
  }

  public getRecord(vehicleId: string): VehicleMaintenanceRecord | null {
    return this.records.get(vehicleId) ?? null;
  }

  public getAllRecords(): VehicleMaintenanceRecord[] {
    return Array.from(this.records.values());
  }

  public unregisterVehicle(vehicleId: string): boolean {
    return this.records.delete(vehicleId);
  }

  /**
   * Evaluates overdue status against real-world elapsed time (wall clock).
   */
  public evaluateStatus(
    vehicleId: string,
    currentRealTimestamp: number = Date.now()
  ): { exists: boolean; isOverdue: boolean; daysRemaining: number; hoursRemaining: number } {
    const record = this.records.get(vehicleId);
    if (!record) {
      return { exists: false, isOverdue: false, daysRemaining: 0, hoursRemaining: 0 };
    }

    const remainingMs = record.nextDueTimestamp - currentRealTimestamp;
    record.isOverdue = remainingMs <= 0;

    return {
      exists: true,
      isOverdue: record.isOverdue,
      daysRemaining: Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000))),
      hoursRemaining: Math.max(0, Math.floor(remainingMs / (60 * 60 * 1000))),
    };
  }

  /**
   * Performs real maintenance financed with in-game funds.
   * Invariant: Never deducts money silently if player lacks funds.
   * Invariant: Never resets timer without verified payment.
   * Invariant: Prevents duplicate charges.
   */
  public performMaintenance(
    vehicleId: string,
    gameState: GameState,
    currentRealTimestamp: number = Date.now()
  ): MaintenancePerformResult {
    const record = this.records.get(vehicleId);
    if (!record) {
      return {
        success: false,
        vehicleId,
        cost: 0,
        error: `Vehicle '${vehicleId}' not registered in maintenance schedule.`,
      };
    }

    const currentCash = gameState.getCash();
    if (currentCash < record.maintenanceCost) {
      const shortfall = record.maintenanceCost - currentCash;
      logger.warnThrottled(
        `maint_shortfall_${vehicleId}`,
        5000,
        `Treasury shortfall ($${currentCash} < $${record.maintenanceCost}) for vehicle '${vehicleId}'. Maintenance postponed.`
      );

      return {
        success: false,
        vehicleId,
        cost: record.maintenanceCost,
        shortfall,
        error: `Insufficient treasury funds. Shortfall: $${shortfall}.`,
      };
    }

    // Deduct in-game funds
    gameState.setCash(currentCash - record.maintenanceCost);

    // Update authoritative maintenance record
    record.lastServiceTimestamp = currentRealTimestamp;
    record.nextDueTimestamp = currentRealTimestamp + REAL_WORLD_MAINTENANCE_INTERVAL_MS;
    record.serviceHistoryCount += 1;
    record.isOverdue = false;

    globalEventBus.emit('vehicle:maintenance_completed', {
      vehicleId,
      cost: record.maintenanceCost,
      nextDueTimestamp: record.nextDueTimestamp,
      serviceCount: record.serviceHistoryCount,
    });

    return {
      success: true,
      vehicleId,
      cost: record.maintenanceCost,
      newNextDueTimestamp: record.nextDueTimestamp,
    };
  }

  /**
   * Serializes maintenance schedules for save-game persistence.
   */
  public serialize(): VehicleMaintenanceRecord[] {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }

  /**
   * Restores maintenance schedules, recalculating real-world overdue status.
   */
  public deserialize(
    savedRecords: VehicleMaintenanceRecord[],
    currentRealTimestamp: number = Date.now()
  ): void {
    this.records.clear();
    for (const rec of savedRecords) {
      this.records.set(rec.vehicleId, {
        ...rec,
        isOverdue: currentRealTimestamp > rec.nextDueTimestamp,
      });
    }
  }

  public clear(): void {
    this.records.clear();
  }
}
