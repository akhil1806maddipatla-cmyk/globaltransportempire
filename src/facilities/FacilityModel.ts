/**
 * Multi-Modal Facility Architecture & Progression System
 * Global Transport Empire - Facility Capacity & Operations
 *
 * Implements strict mode-specific capacity rules (truck spaces, rail tracks,
 * airport stands, and marine berths are physically distinct and not interchangeable).
 */

export type FacilityType =
  | 'truck_depot'
  | 'rail_yard'
  | 'cargo_airport'
  | 'seaport_harbor'
  | 'distribution_center';

export type TruckClass = 'rigid_courier' | 'prime_mover_6x4' | 'heavy_combination_semi';

export interface ParkingSpace {
  spaceIndex: number;
  label: string;
  nominalDimensions: { length: number; width: number; heightClearance: number };
  permittedTruckClasses: TruckClass[];
  occupiedByVehicleId: string | null;
  assignedTime?: number;
}

export interface FacilityUpgradeConfig {
  level: number;
  capacity: number;
  upgradeCost: number;
  maintenanceUpkeep: number;
  description: string;
  unlockedFeatures: string[];
}

export interface BaseFacilityData {
  id: string;
  name: string;
  type: FacilityType;
  level: number;
  maxLevel: number;
  isPlayerOwned: boolean;
  gridX: number;
  gridZ: number;
  footprintWidth: number;
  footprintDepth: number;
  entranceCoord: { gridX: number; gridZ: number };
  connectedToNetwork: boolean;
}

/**
 * Reusable Multi-Modal Facility Interface
 */
export interface IFacilityOperations {
  readonly id: string;
  readonly name: string;
  readonly type: FacilityType;
  readonly level: number;
  isPlayerOwned: boolean;
  getTotalCapacity(): number;
  getOccupiedCapacity(): number;
  getAvailableCapacity(): number;
  isFull(): boolean;
  canAccommodate(assetClass: string): boolean;
  assignAsset(assetId: string, assetClass: string): boolean;
  releaseAsset(assetId: string): boolean;
  getUpgradeConfig(): FacilityUpgradeConfig | null;
  upgrade(): boolean;
}

/**
 * Production-Grade Truck Depot Facility Implementation
 * Enforces Level 1 = exactly 3 designated truck parking spaces.
 */
export class TruckDepotFacility implements IFacilityOperations {
  public readonly id: string;
  public name: string;
  public readonly type: FacilityType = 'truck_depot';
  public level: number = 1;
  public readonly maxLevel: number = 3;
  public isPlayerOwned: boolean = true;

  public gridX: number;
  public gridZ: number;
  public footprintWidth: number = 4; // 16.0m
  public footprintDepth: number = 3; // 12.0m
  public entranceCoord: { gridX: number; gridZ: number };
  public connectedToNetwork: boolean = true;

  private spaces: ParkingSpace[] = [];

  // Upgrade Progression Specs
  public static readonly UPGRADE_TIERS: Record<number, FacilityUpgradeConfig> = {
    1: {
      level: 1,
      capacity: 3,
      upgradeCost: 0,
      maintenanceUpkeep: 60,
      description: 'Initial Fleet Headquarters: 3 designated commercial heavy truck parking bays and dispatch office.',
      unlockedFeatures: ['Courier 4x2 Operations', 'Heavy Prime Mover 6x4 Staging', 'Standard Maintenance'],
    },
    2: {
      level: 2,
      capacity: 6,
      upgradeCost: 65000,
      maintenanceUpkeep: 140,
      description: 'Expanded Logistics Depot: 6 sheltered vehicle bays, pneumatic lube rack, and refrigerated staging.',
      unlockedFeatures: ['Reefer Fleet Cold-Chain', 'Automated Fueling Rack', 'High-Speed Cross-Dock'],
    },
    3: {
      level: 3,
      capacity: 10,
      upgradeCost: 140000,
      maintenanceUpkeep: 300,
      description: 'Trans-Regional Super Depot: 10 automated intermodal bays, telemetry command center, and driver lodge.',
      unlockedFeatures: ['Double-Bogie Road Trains', 'Automated Dispatch Telemetry', 'Heavy Overhaul Overhaul Rig'],
    },
  };

  constructor(
    id: string,
    name: string,
    gridX: number,
    gridZ: number,
    initialLevel: number = 1,
    isPlayerOwned: boolean = true
  ) {
    this.id = id;
    this.name = name;
    this.gridX = gridX;
    this.gridZ = gridZ;
    this.level = Math.min(Math.max(initialLevel, 1), this.maxLevel);
    this.isPlayerOwned = isPlayerOwned;
    this.entranceCoord = { gridX, gridZ: gridZ - 1 };

    this.rebuildParkingSpaces();
  }

  /**
   * Builds exactly the designated parking spaces for the current facility level.
   * Level 1 = exactly 3 spaces.
   */
  private rebuildParkingSpaces(): void {
    const targetCapacity = TruckDepotFacility.UPGRADE_TIERS[this.level]?.capacity ?? 3;
    const currentAssignments = new Map<number, string | null>();
    for (const space of this.spaces) {
      currentAssignments.set(space.spaceIndex, space.occupiedByVehicleId);
    }

    this.spaces = [];
    for (let i = 0; i < targetCapacity; i++) {
      this.spaces.push({
        spaceIndex: i,
        label: `Bay #${i + 1}`,
        nominalDimensions: {
          length: 16.5, // Accommodates up to 16.5m heavy combinations
          width: 3.5,   // Accommodates 2.5m wide trucks with 0.5m clearance per side
          heightClearance: 5.0, // 5.0m vertical clearance
        },
        permittedTruckClasses: ['rigid_courier', 'prime_mover_6x4', 'heavy_combination_semi'],
        occupiedByVehicleId: currentAssignments.get(i) ?? null,
      });
    }
  }

  public getTotalCapacity(): number {
    return this.spaces.length;
  }

  public getOccupiedCapacity(): number {
    return this.spaces.filter((s) => s.occupiedByVehicleId !== null).length;
  }

  public getAvailableCapacity(): number {
    return this.getTotalCapacity() - this.getOccupiedCapacity();
  }

  public isFull(): boolean {
    return this.getAvailableCapacity() <= 0;
  }

  public getSpaces(): ReadonlyArray<ParkingSpace> {
    return [...this.spaces];
  }

  public getSpace(index: number): ParkingSpace | null {
    return this.spaces[index] ?? null;
  }

  /**
   * Checks if this depot can physically and legally accommodate a specific truck class
   */
  public canAccommodate(truckClass: string): boolean {
    if (this.isFull()) return false;
    const cl = truckClass as TruckClass;
    // Check if any available space permits this vehicle class
    return this.spaces.some(
      (s) => s.occupiedByVehicleId === null && s.permittedTruckClasses.includes(cl)
    );
  }

  /**
   * Assigns a truck to the first available compatible parking space
   */
  public assignAsset(vehicleId: string, truckClass: string): boolean {
    if (this.isFull()) return false;
    // Check if already assigned to avoid duplicates
    if (this.isVehicleAssigned(vehicleId)) return true;

    const cl = truckClass as TruckClass;
    const targetSpace = this.spaces.find(
      (s) => s.occupiedByVehicleId === null && s.permittedTruckClasses.includes(cl)
    );

    if (!targetSpace) return false;

    targetSpace.occupiedByVehicleId = vehicleId;
    targetSpace.assignedTime = Date.now();
    return true;
  }

  /**
   * Specific bay assignment
   */
  public assignToBay(bayIndex: number, vehicleId: string, truckClass?: string): boolean {
    const space = this.spaces[bayIndex];
    if (!space) return false;
    if (space.occupiedByVehicleId !== null && space.occupiedByVehicleId !== vehicleId) {
      return false; // Space is occupied by another vehicle!
    }

    if (truckClass && !space.permittedTruckClasses.includes(truckClass as TruckClass)) {
      return false; // Incompatible class
    }

    // Remove from any other bay in this facility to prevent double-booking
    for (let i = 0; i < this.spaces.length; i++) {
      if (i !== bayIndex && this.spaces[i].occupiedByVehicleId === vehicleId) {
        this.spaces[i].occupiedByVehicleId = null;
        this.spaces[i].assignedTime = undefined;
      }
    }

    space.occupiedByVehicleId = vehicleId;
    space.assignedTime = Date.now();
    return true;
  }

  /**
   * Releases a parked vehicle from this depot
   */
  public releaseAsset(vehicleId: string): boolean {
    const space = this.spaces.find((s) => s.occupiedByVehicleId === vehicleId);
    if (!space) return false;

    space.occupiedByVehicleId = null;
    space.assignedTime = undefined;
    return true;
  }

  public isVehicleAssigned(vehicleId: string): boolean {
    return this.spaces.some((s) => s.occupiedByVehicleId === vehicleId);
  }

  public getAssignedVehicleIds(): string[] {
    return this.spaces
      .map((s) => s.occupiedByVehicleId)
      .filter((id): id is string => id !== null);
  }

  public getCapacity(): number {
    return this.getTotalCapacity();
  }

  public getEntranceCoordinate(): { gridX: number; gridZ: number } {
    return { ...this.entranceCoord };
  }

  public getUpgradeConfig(): FacilityUpgradeConfig | null {
    if (this.level >= this.maxLevel) return null;
    return TruckDepotFacility.UPGRADE_TIERS[this.level + 1] ?? null;
  }

  public upgrade(): boolean {
    if (this.level >= this.maxLevel) return false;
    this.level += 1;
    this.rebuildParkingSpaces();
    return true;
  }
}

/**
 * Rail Yard Facility (Future Milestone Data Structure Foundation)
 */
export class RailYardFacility implements IFacilityOperations {
  public readonly id: string;
  public name: string;
  public readonly type: FacilityType = 'rail_yard';
  public level: number = 1;
  public isPlayerOwned: boolean = true;
  public maxTrainLengthMeters: number = 120.0;
  private activeTracksCount: number = 2;
  private trackOccupancy: (string | null)[] = [null, null];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  public getTotalCapacity(): number { return this.activeTracksCount; }
  public getOccupiedCapacity(): number { return this.trackOccupancy.filter(t => t !== null).length; }
  public getAvailableCapacity(): number { return this.getTotalCapacity() - this.getOccupiedCapacity(); }
  public isFull(): boolean { return this.getAvailableCapacity() <= 0; }
  public canAccommodate(assetClass: string): boolean {
    return (assetClass === 'freight_train' || assetClass === 'freight_train_consist') && !this.isFull();
  }
  public assignAsset(assetId: string): boolean {
    const idx = this.trackOccupancy.indexOf(null);
    if (idx === -1) return false;
    this.trackOccupancy[idx] = assetId;
    return true;
  }
  public releaseAsset(assetId: string): boolean {
    const idx = this.trackOccupancy.indexOf(assetId);
    if (idx === -1) return false;
    this.trackOccupancy[idx] = null;
    return true;
  }
  public getUpgradeConfig(): FacilityUpgradeConfig | null { return null; }
  public upgrade(): boolean { return false; }
}

/**
 * Airport Facility (Future Milestone Data Structure Foundation)
 */
export class CargoAirportFacility implements IFacilityOperations {
  public readonly id: string;
  public name: string;
  public readonly type: FacilityType = 'cargo_airport';
  public level: number = 1;
  public isPlayerOwned: boolean = true;
  public maxWingspanMeters: number = 36.0;
  private standsCount: number = 2;
  private standOccupancy: (string | null)[] = [null, null];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  public getTotalCapacity(): number { return this.standsCount; }
  public getOccupiedCapacity(): number { return this.standOccupancy.filter(s => s !== null).length; }
  public getAvailableCapacity(): number { return this.getTotalCapacity() - this.getOccupiedCapacity(); }
  public isFull(): boolean { return this.getAvailableCapacity() <= 0; }
  public canAccommodate(assetClass: string): boolean { return assetClass === 'cargo_aircraft' && !this.isFull(); }
  public assignAsset(assetId: string): boolean {
    const idx = this.standOccupancy.indexOf(null);
    if (idx === -1) return false;
    this.standOccupancy[idx] = assetId;
    return true;
  }
  public releaseAsset(assetId: string): boolean {
    const idx = this.standOccupancy.indexOf(assetId);
    if (idx === -1) return false;
    this.standOccupancy[idx] = null;
    return true;
  }
  public getUpgradeConfig(): FacilityUpgradeConfig | null { return null; }
  public upgrade(): boolean { return false; }
}

/**
 * Marine Port & Berth Facility (Future Milestone Data Structure Foundation)
 */
export class SeaportHarborFacility implements IFacilityOperations {
  public readonly id: string;
  public name: string;
  public readonly type: FacilityType = 'seaport_harbor';
  public level: number = 1;
  public isPlayerOwned: boolean = true;
  public designDraftMeters: number = 9.5;
  private berthsCount: number = 1;
  private berthOccupancy: (string | null)[] = [null];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  public getTotalCapacity(): number { return this.berthsCount; }
  public getOccupiedCapacity(): number { return this.berthOccupancy.filter(b => b !== null).length; }
  public getAvailableCapacity(): number { return this.getTotalCapacity() - this.getOccupiedCapacity(); }
  public isFull(): boolean { return this.getAvailableCapacity() <= 0; }
  public canAccommodate(assetClass: string): boolean {
    return (assetClass === 'cargo_vessel' || assetClass === 'container_feeder_ship') && !this.isFull();
  }
  public assignAsset(assetId: string): boolean {
    const idx = this.berthOccupancy.indexOf(null);
    if (idx === -1) return false;
    this.berthOccupancy[idx] = assetId;
    return true;
  }
  public releaseAsset(assetId: string): boolean {
    const idx = this.berthOccupancy.indexOf(assetId);
    if (idx === -1) return false;
    this.berthOccupancy[idx] = null;
    return true;
  }
  public getUpgradeConfig(): FacilityUpgradeConfig | null { return null; }
  public upgrade(): boolean { return false; }
}
