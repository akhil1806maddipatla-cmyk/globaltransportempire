/**
 * Land Parcel & Property Tenure Architecture
 * Global Transport Empire - Civil Zoning & Real Estate Foundations
 *
 * Implements land parcel boundaries, ownership state, buildability,
 * and location-based valuation.
 *
 * The initial Level 1 Truck Depot parcel is guaranteed to be PLAYER_OWNED
 * upon new game creation without requiring land purchase or unlocking.
 */

export type LandOwnership = 'player_owned' | 'unowned' | 'municipal_public' | 'protected_reserve';

export type TerrainSuitability =
  | 'suitable'
  | 'water_intersected'
  | 'steep_slope'
  | 'protected_wetland'
  | 'rocky_headland';

export interface LandParcel {
  id: string;
  name: string;
  ownership: LandOwnership;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  areaCells: number;
  baseValuation: number;
  locationFactor: number; // e.g. 1.25x for highway frontage, 1.4x for rail access
  effectivePurchasePrice: number;
  isBuildAllowed: boolean;
  zoningCategory: 'logistics' | 'heavy_industry' | 'commercial' | 'infrastructure_right_of_way';
  terrainSuitability: TerrainSuitability;
  buildableRatio: number; // Fraction of parcel on stable dry ground (0.0 to 1.0)
}

export class LandParcelManager {
  private parcels: Map<string, LandParcel> = new Map();

  constructor() {
    this.initializeDefaultParcels();
  }

  private initializeDefaultParcels(): void {
    // 1. Starting Truck Depot Parcel (Guaranteed Player Owned from Start)
    this.registerParcel({
      id: 'parcel_starter_depot',
      name: 'Central Transport Depot Parcel #1',
      ownership: 'player_owned', // Player already owns this from turn 1!
      bounds: { minX: 10, maxX: 15, minZ: 12, maxZ: 17 },
      areaCells: 36, // 6x6 cells (24m x 24m)
      baseValuation: 25000,
      locationFactor: 1.0,
      effectivePurchasePrice: 0, // Free starting tenure
      isBuildAllowed: true,
      zoningCategory: 'logistics',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 2. Apex Heavy Industrial Sector (Municipal / Industrial leasehold)
    this.registerParcel({
      id: 'parcel_apex_industry',
      name: 'Apex Manufacturing Heavy Works Plot',
      ownership: 'player_owned', // Contains starting factory
      bounds: { minX: 4, maxX: 10, minZ: 3, maxZ: 10 },
      areaCells: 56,
      baseValuation: 45000,
      locationFactor: 1.15,
      effectivePurchasePrice: 0,
      isBuildAllowed: true,
      zoningCategory: 'heavy_industry',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 3. Central Logistics Hub Parcel
    this.registerParcel({
      id: 'parcel_logistics_hub',
      name: 'Sector Logistics Terminal Zone',
      ownership: 'player_owned',
      bounds: { minX: 4, maxX: 10, minZ: 12, maxZ: 18 },
      areaCells: 49,
      baseValuation: 38000,
      locationFactor: 1.2,
      effectivePurchasePrice: 0,
      isBuildAllowed: true,
      zoningCategory: 'logistics',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 4. North Commercial & Corporate Sector
    this.registerParcel({
      id: 'parcel_commercial_hq',
      name: 'Regional Dispatch HQ Grounds',
      ownership: 'player_owned',
      bounds: { minX: 13, maxX: 18, minZ: 4, maxZ: 10 },
      areaCells: 42,
      baseValuation: 32000,
      locationFactor: 1.1,
      effectivePurchasePrice: 0,
      isBuildAllowed: true,
      zoningCategory: 'commercial',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 5. Eastern Expansion Reserve Alpha (Available for Future Purchase)
    this.registerParcel({
      id: 'parcel_expansion_east_01',
      name: 'East Intermodal Logistics Expansion Plot',
      ownership: 'unowned',
      bounds: { minX: 16, maxX: 23, minZ: 12, maxZ: 21 },
      areaCells: 80,
      baseValuation: 60000,
      locationFactor: 1.35, // High value due to arterial road connection
      effectivePurchasePrice: 81000,
      isBuildAllowed: false, // Locked until purchased
      zoningCategory: 'logistics',
      terrainSuitability: 'suitable',
      buildableRatio: 0.95, // Minor stormwater buffer on eastern fringe
    });

    // 6. North Rail Corridor Right-of-Way (Municipal Public Transport Infrastructure)
    this.registerParcel({
      id: 'parcel_rail_corridor_north',
      name: 'Northern Rail Right-of-Way Reserve',
      ownership: 'municipal_public',
      bounds: { minX: 18, maxX: 23, minZ: 0, maxZ: 4 },
      areaCells: 30,
      baseValuation: 75000,
      locationFactor: 1.5,
      effectivePurchasePrice: 112500,
      isBuildAllowed: false, // Municipal infrastructure easement
      zoningCategory: 'infrastructure_right_of_way',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 7. Eastern Deepwater Port Terminal Parcel
    this.registerParcel({
      id: 'parcel_deepwater_port_terminal',
      name: 'Grand Harbor Deepwater Maritime Terminal',
      ownership: 'player_owned',
      bounds: { minX: 21, maxX: 23, minZ: 12, maxZ: 17 },
      areaCells: 18,
      baseValuation: 95000,
      locationFactor: 1.6,
      effectivePurchasePrice: 0,
      isBuildAllowed: true,
      zoningCategory: 'infrastructure_right_of_way',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 8. Lake Serene Highland Eco-Reserve (Protected Natural Water Basin)
    this.registerParcel({
      id: 'parcel_lake_serene_reserve',
      name: 'Lake Serene Highland Ecological Reserve',
      ownership: 'protected_reserve',
      bounds: { minX: 0, maxX: 6, minZ: 0, maxZ: 3 },
      areaCells: 28,
      baseValuation: 120000,
      locationFactor: 1.0,
      effectivePurchasePrice: 120000,
      isBuildAllowed: false,
      zoningCategory: 'logistics',
      terrainSuitability: 'protected_wetland',
      buildableRatio: 0.0, // Strictly non-buildable protected ecological water body
    });

    // 9. Northeast Industrial & Tech Park (Expanded Regional Zone)
    this.registerParcel({
      id: 'parcel_northeast_industrial_park',
      name: 'Northeast Manufacturing & Freight Tech Estate',
      ownership: 'unowned',
      bounds: { minX: 26, maxX: 38, minZ: 2, maxZ: 10 },
      areaCells: 117,
      baseValuation: 85000,
      locationFactor: 1.25,
      effectivePurchasePrice: 106250,
      isBuildAllowed: false,
      zoningCategory: 'heavy_industry',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 10. South Regional Intermodal Distribution Center
    this.registerParcel({
      id: 'parcel_south_logistics_center',
      name: 'Southern Regional Intermodal Distribution Park',
      ownership: 'unowned',
      bounds: { minX: 12, maxX: 24, minZ: 24, maxZ: 35 },
      areaCells: 156,
      baseValuation: 110000,
      locationFactor: 1.3,
      effectivePurchasePrice: 143000,
      isBuildAllowed: false,
      zoningCategory: 'logistics',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });

    // 11. Southeast Maritime Port Industrial Quarter
    this.registerParcel({
      id: 'parcel_southeast_port_maritime_zone',
      name: 'Grand Harbor Deepwater Container Yard & Wharf Zone',
      ownership: 'unowned',
      bounds: { minX: 26, maxX: 42, minZ: 22, maxZ: 35 },
      areaCells: 238,
      baseValuation: 160000,
      locationFactor: 1.5,
      effectivePurchasePrice: 240000,
      isBuildAllowed: false,
      zoningCategory: 'infrastructure_right_of_way',
      terrainSuitability: 'suitable',
      buildableRatio: 0.98,
    });

    // 12. Delta Regional Freight Right-of-Way Corridor
    this.registerParcel({
      id: 'parcel_delta_freight_corridor',
      name: 'Delta Regional Highway Infrastructure Easement',
      ownership: 'municipal_public',
      bounds: { minX: 12, maxX: 48, minZ: 36, maxZ: 40 },
      areaCells: 185,
      baseValuation: 140000,
      locationFactor: 1.4,
      effectivePurchasePrice: 196000,
      isBuildAllowed: false,
      zoningCategory: 'infrastructure_right_of_way',
      terrainSuitability: 'suitable',
      buildableRatio: 1.0,
    });
  }

  public registerParcel(parcel: LandParcel): void {
    this.parcels.set(parcel.id, parcel);
  }

  public getParcel(id: string): LandParcel | null {
    return this.parcels.get(id) ?? null;
  }

  public getAllParcels(): LandParcel[] {
    return Array.from(this.parcels.values());
  }

  public getParcelAt(gridX: number, gridZ: number): LandParcel | null {
    for (const p of this.parcels.values()) {
      if (
        gridX >= p.bounds.minX &&
        gridX <= p.bounds.maxX &&
        gridZ >= p.bounds.minZ &&
        gridZ <= p.bounds.maxZ
      ) {
        return p;
      }
    }
    return null;
  }

  /**
   * Evaluates if building is permitted at a specific grid coordinate based on land ownership
   */
  public isBuildPermittedAt(gridX: number, gridZ: number): { permitted: boolean; reason?: string } {
    const parcel = this.getParcelAt(gridX, gridZ);
    if (!parcel) {
      // Unplotted territory defaults to buildable for early game flexibility
      return { permitted: true };
    }

    if (parcel.ownership === 'player_owned') {
      return { permitted: true };
    }

    if (parcel.ownership === 'unowned') {
      return {
        permitted: false,
        reason: `Land parcel '${parcel.name}' is unowned. Purchase required ($${parcel.effectivePurchasePrice.toLocaleString()}).`,
      };
    }

    if (parcel.ownership === 'municipal_public') {
      return {
        permitted: false,
        reason: `Zone is a dedicated municipal transport easement (${parcel.name}). Building prohibited.`,
      };
    }

    return { permitted: false, reason: 'Building restricted on this land parcel.' };
  }

  /**
   * Purchases an unowned parcel
   */
  public purchaseParcel(parcelId: string, playerCash: number): { success: boolean; cost: number; error?: string } {
    const parcel = this.parcels.get(parcelId);
    if (!parcel) return { success: false, cost: 0, error: 'Parcel not found.' };

    if (parcel.ownership === 'player_owned') {
      return { success: false, cost: 0, error: 'You already own this land parcel.' };
    }

    if (parcel.ownership === 'municipal_public' || parcel.ownership === 'protected_reserve') {
      return { success: false, cost: 0, error: 'Public infrastructure land cannot be privatized.' };
    }

    const cost = parcel.effectivePurchasePrice;
    if (playerCash < cost) {
      return {
        success: false,
        cost: 0,
        error: `Insufficient funds: $${cost.toLocaleString()} required, $${playerCash.toLocaleString()} available.`,
      };
    }

    parcel.ownership = 'player_owned';
    parcel.isBuildAllowed = true;
    return { success: true, cost };
  }

  /**
   * Validates buildability of a land parcel against natural terrain and geographic constraints.
   */
  public validateParcelBuildability(
    parcelId: string,
    terrainModel?: { isWaterCell(gx: number, gz: number): boolean }
  ): {
    isValid: boolean;
    totalCells: number;
    waterCells: number;
    dryCells: number;
    suitability: TerrainSuitability;
    reason?: string;
  } {
    const parcel = this.parcels.get(parcelId);
    if (!parcel) {
      return {
        isValid: false,
        totalCells: 0,
        waterCells: 0,
        dryCells: 0,
        suitability: 'suitable',
        reason: 'Parcel not found.',
      };
    }

    if (parcel.ownership === 'protected_reserve') {
      return {
        isValid: false,
        totalCells: parcel.areaCells,
        waterCells: parcel.areaCells,
        dryCells: 0,
        suitability: parcel.terrainSuitability,
        reason: `Parcel '${parcel.name}' is an environmentally protected reserve. Construction is prohibited.`,
      };
    }

    let waterCount = 0;
    let totalCount = 0;

    if (terrainModel) {
      for (let x = parcel.bounds.minX; x <= parcel.bounds.maxX; x++) {
        for (let z = parcel.bounds.minZ; z <= parcel.bounds.maxZ; z++) {
          totalCount++;
          if (terrainModel.isWaterCell(x, z)) {
            waterCount++;
          }
        }
      }
    } else {
      totalCount = parcel.areaCells;
    }

    const dryCells = totalCount - waterCount;
    const isWaterDominant = waterCount > 0 && waterCount >= totalCount * 0.5;

    if (isWaterDominant) {
      return {
        isValid: false,
        totalCells: totalCount,
        waterCells: waterCount,
        dryCells,
        suitability: 'water_intersected',
        reason: `Parcel '${parcel.name}' heavily intersects open water bodies (${waterCount}/${totalCount} cells submerged).`,
      };
    }

    return {
      isValid: parcel.isBuildAllowed,
      totalCells: totalCount,
      waterCells: waterCount,
      dryCells,
      suitability: parcel.terrainSuitability,
      reason: parcel.isBuildAllowed ? undefined : `Parcel tenure restriction: ownership is ${parcel.ownership}.`,
    };
  }
}
