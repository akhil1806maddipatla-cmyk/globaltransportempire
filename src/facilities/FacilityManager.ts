import {
  IFacilityOperations,
  TruckDepotFacility,
  RailYardFacility,
  CargoAirportFacility,
  SeaportHarborFacility,
  FacilityType,
} from './FacilityModel';
import { globalEventBus } from '../core/EventBus';

export class FacilityManager {
  private facilities: Map<string, IFacilityOperations> = new Map();
  private primaryTruckDepotId: string | null = null;

  /**
   * Initializes or guarantees the starting Level 1 Truck Depot.
   * Deterministic & Idempotent: Never creates duplicate depots.
   */
  public ensureDefaultStartingDepot(gridX: number = 11, gridZ: number = 14): TruckDepotFacility {
    // If already exists, return the existing singleton starting depot
    if (this.primaryTruckDepotId && this.facilities.has(this.primaryTruckDepotId)) {
      return this.facilities.get(this.primaryTruckDepotId) as TruckDepotFacility;
    }

    // Check by ID
    const defaultId = 'facility_truck_depot_01';
    if (this.facilities.has(defaultId)) {
      this.primaryTruckDepotId = defaultId;
      return this.facilities.get(defaultId) as TruckDepotFacility;
    }

    // Instantiate guaranteed Level 1 Truck Depot with exactly 3 parking spaces
    const depot = new TruckDepotFacility(
      defaultId,
      'Regional Transport Depot (Level 1)',
      gridX,
      gridZ,
      1,    // Level 1
      true  // Player Owned by default without cost or unlock
    );

    this.registerFacility(depot);
    this.primaryTruckDepotId = defaultId;

    globalEventBus.emit('facility:depot_ready', {
      id: depot.id,
      name: depot.name,
      level: depot.level,
      capacity: depot.getTotalCapacity(),
      gridX: depot.gridX,
      gridZ: depot.gridZ,
    });

    return depot;
  }

  public registerFacility(facility: IFacilityOperations): void {
    this.facilities.set(facility.id, facility);
    if (facility.id === 'facility_truck_depot_01' || (facility.type === 'truck_depot' && !this.primaryTruckDepotId)) {
      this.primaryTruckDepotId = facility.id;
    }
  }

  public clear(): void {
    this.facilities.clear();
    this.primaryTruckDepotId = null;
  }

  public getFacility(id: string): IFacilityOperations | null {
    return this.facilities.get(id) ?? null;
  }

  public getPrimaryTruckDepot(): TruckDepotFacility | null {
    if (!this.primaryTruckDepotId) return null;
    return (this.facilities.get(this.primaryTruckDepotId) as TruckDepotFacility) ?? null;
  }

  public getAllFacilities(): IFacilityOperations[] {
    return Array.from(this.facilities.values());
  }

  public getFacilitiesByType(type: FacilityType): IFacilityOperations[] {
    return this.getAllFacilities().filter((f) => f.type === type);
  }

  public getAllTruckDepots(): TruckDepotFacility[] {
    return this.getFacilitiesByType('truck_depot') as TruckDepotFacility[];
  }

  /**
   * Releases a vehicle from any facility currently housing it.
   * Guarantees that a vehicle cannot remain parked in a removed or reassigned space.
   */
  public releaseVehicleFromAllFacilities(vehicleId: string): boolean {
    let released = false;
    for (const fac of this.facilities.values()) {
      if (fac.releaseAsset(vehicleId)) {
        released = true;
      }
    }
    if (released) {
      globalEventBus.emit('facility:vehicle_released', { vehicleId });
    }
    return released;
  }

  /**
   * Assigns a vehicle to the player's primary depot.
   * Invariant: Releases vehicle from any other facility first to prevent double-occupancy.
   */
  public assignVehicleToPrimaryDepot(vehicleId: string, truckClass: string): boolean {
    const depot = this.getPrimaryTruckDepot();
    if (!depot) return false;

    // Invariant: release from other facilities first
    this.releaseVehicleFromAllFacilities(vehicleId);

    const success = depot.assignAsset(vehicleId, truckClass);
    if (success) {
      globalEventBus.emit('facility:vehicle_assigned', {
        facilityId: depot.id,
        vehicleId,
        truckClass,
      });
    }
    return success;
  }

  /**
   * Assigns a vehicle to a specific facility by ID.
   * Enforces capacity limits and prevents double-occupancy across all facilities.
   */
  public assignVehicleToFacility(
    facilityId: string,
    vehicleId: string,
    truckClass: string
  ): { success: boolean; error?: string } {
    const facility = this.getFacility(facilityId);
    if (!facility) {
      return { success: false, error: `Facility '${facilityId}' not found.` };
    }

    if (facility.isFull()) {
      return { success: false, error: `Facility '${facility.name}' is already at full capacity (${facility.getTotalCapacity()}/${facility.getTotalCapacity()}).` };
    }

    if (!facility.canAccommodate(truckClass)) {
      return { success: false, error: `Facility '${facility.name}' cannot accommodate vehicle class '${truckClass}'.` };
    }

    // Release from any other facility first
    this.releaseVehicleFromAllFacilities(vehicleId);

    const success = facility.assignAsset(vehicleId, truckClass);
    if (!success) {
      return { success: false, error: `Failed to allocate space at '${facility.name}'.` };
    }

    globalEventBus.emit('facility:vehicle_assigned', {
      facilityId,
      vehicleId,
      truckClass,
    });

    return { success: true };
  }

  /**
   * Finds which facility currently houses a given vehicle
   */
  public findFacilityForVehicle(vehicleId: string): TruckDepotFacility | null {
    for (const fac of this.facilities.values()) {
      if (fac instanceof TruckDepotFacility && fac.isVehicleAssigned(vehicleId)) {
        return fac;
      }
    }
    return null;
  }
}
