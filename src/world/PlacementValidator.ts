import { GridSystem } from './GridSystem';
import { RoadNetworkModel } from './RoadNetworkModel';
import { BuildingDefinition } from '../data/buildingDefinitions';
import { TerrainModel } from './TerrainModel';
import { WaterSystemModel } from './water/WaterSystemModel';
import { LandParcelManager } from './LandParcelManager';

export type PlacementReasonCode =
  | 'VALID'
  | 'OUT_OF_BOUNDS'
  | 'OCCUPIED_BUILDING'
  | 'OCCUPIED_ROAD'
  | 'RESERVED_LAND'
  | 'OCCUPIED_WATER_BODY'
  | 'MISSING_ROAD_ACCESS'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_DEFINITION'
  | 'EXCESSIVE_SLOPE'
  | 'PROXIMITY_TO_WATER'
  | 'MISSING_WATER_FRONTAGE'
  | 'PROTECTED_RESERVE'
  | 'ENTRANCE_OBSTRUCTED'
  | 'DIRECT_HIGHWAY_ACCESS_PROHIBITED';

export interface PlacementValidationResult {
  isValid: boolean;
  reasonCode: PlacementReasonCode;
  message: string;
  affectedCells: { x: number; z: number }[];
  effectiveWidth: number;
  effectiveDepth: number;
  hasRoadAccess: boolean;
  cost: number;
  elevationVariance?: number;
}

export class PlacementValidator {
  private gridSystem: GridSystem;
  private roadNetworkModel: RoadNetworkModel;
  private terrainModel?: TerrainModel;
  private waterSystem?: WaterSystemModel;
  private parcelManager?: LandParcelManager;

  constructor(
    gridSystem: GridSystem,
    roadNetworkModel: RoadNetworkModel,
    terrainModel?: TerrainModel,
    waterSystem?: WaterSystemModel,
    parcelManager?: LandParcelManager
  ) {
    this.gridSystem = gridSystem;
    this.roadNetworkModel = roadNetworkModel;
    this.terrainModel = terrainModel;
    this.waterSystem = waterSystem;
    this.parcelManager = parcelManager;
  }

  public setTerrainModel(terrainModel: TerrainModel): void {
    this.terrainModel = terrainModel;
  }

  public setWaterSystem(waterSystem: WaterSystemModel): void {
    this.waterSystem = waterSystem;
  }

  public setParcelManager(parcelManager: LandParcelManager): void {
    this.parcelManager = parcelManager;
  }

  public validate(
    definition: BuildingDefinition | null | undefined,
    anchorX: number,
    anchorZ: number,
    rotationDegrees: number = 0,
    availableFunds?: number
  ): PlacementValidationResult {
    if (!definition || !definition.id) {
      return {
        isValid: false,
        reasonCode: 'INVALID_DEFINITION',
        message: 'Invalid or undefined building specification.',
        affectedCells: [],
        effectiveWidth: 0,
        effectiveDepth: 0,
        hasRoadAccess: false,
        cost: 0,
      };
    }

    const { effectiveWidth, effectiveDepth } = this.gridSystem.calculateRotatedFootprint(
      definition.footprintWidth,
      definition.footprintDepth,
      rotationDegrees
    );

    const affectedCells = this.gridSystem.getFootprintCells(
      anchorX,
      anchorZ,
      definition.footprintWidth,
      definition.footprintDepth,
      rotationDegrees
    );

    // 1. Boundary Check
    for (const cell of affectedCells) {
      if (!this.gridSystem.isWithinBounds(cell.x, cell.z)) {
        return {
          isValid: false,
          reasonCode: 'OUT_OF_BOUNDS',
          message: 'Placement extends beyond the sector grid boundaries.',
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
        };
      }
    }

    // 2. Cell Occupancy Check
    for (const cell of affectedCells) {
      const occ = this.gridSystem.getOccupancy(cell.x, cell.z);
      if (occ === 'building') {
        return {
          isValid: false,
          reasonCode: 'OCCUPIED_BUILDING',
          message: `Site obstructed by an existing structure at (${cell.x}, ${cell.z}).`,
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
        };
      }
      if (occ === 'road') {
        return {
          isValid: false,
          reasonCode: 'OCCUPIED_ROAD',
          message: `Cannot construct over active roadway at (${cell.x}, ${cell.z}).`,
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
        };
      }
      if (occ === 'reserved') {
        return {
          isValid: false,
          reasonCode: 'RESERVED_LAND',
          message: `Zone at (${cell.x}, ${cell.z}) is a reserved survey plot.`,
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
        };
      }
      if (occ === 'obstacle') {
        return {
          isValid: false,
          reasonCode: 'OCCUPIED_WATER_BODY',
          message: `Cannot construct on natural water body or protected terrain at (${cell.x}, ${cell.z}).`,
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
        };
      }
    }

    // 3. Protected Ecological Reserves Check
    if (this.parcelManager) {
      for (const cell of affectedCells) {
        const parcel = this.parcelManager.getParcelAt(cell.x, cell.z);
        if (parcel && parcel.ownership === 'protected_reserve') {
          return {
            isValid: false,
            reasonCode: 'PROTECTED_RESERVE',
            message: `Construction strictly prohibited in protected ecological reserve '${parcel.name}'.`,
            affectedCells,
            effectiveWidth,
            effectiveDepth,
            hasRoadAccess: false,
            cost: definition.cost,
          };
        }
      }
    }

    // 4. Terrain Slope & Elevation Uniformity across Entire Footprint
    let elevationVariance = 0;
    if (this.terrainModel) {
      let minElev = Infinity;
      let maxElev = -Infinity;
      let allOnPad = true;

      for (const cell of affectedCells) {
        const center = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
        const elev = this.terrainModel.getElevationAt(center.x, center.z, false);
        if (elev < minElev) minElev = elev;
        if (elev > maxElev) maxElev = elev;

        if (!this.terrainModel.isGradedPadCell(cell.x, cell.z)) {
          allOnPad = false;
        }
      }

      elevationVariance = maxElev - minElev;
      // Allow maximum 0.35m slope variance across footprint unless on engineered pad
      if (!allOnPad && elevationVariance > 0.35) {
        return {
          isValid: false,
          reasonCode: 'EXCESSIVE_SLOPE',
          message: `Site terrain slope (${elevationVariance.toFixed(2)}m elevation change across footprint) exceeds foundation tolerance. Civil leveling or graded pad required.`,
          affectedCells,
          effectiveWidth,
          effectiveDepth,
          hasRoadAccess: false,
          cost: definition.cost,
          elevationVariance,
        };
      }
    }

    // 5. Water Proximity & Marine Frontage Rules
    const isMarineFacility =
      definition.id.includes('port') ||
      definition.id.includes('harbor') ||
      definition.id.includes('dock') ||
      definition.id.includes('wharf');

    if (this.terrainModel || this.waterSystem) {
      if (isMarineFacility) {
        // Seaport requires direct frontage onto navigable deep water
        let hasNavigableFrontage = false;
        for (const cell of affectedCells) {
          const neighbors = this.gridSystem.getAdjacentCells(cell.x, cell.z);
          for (const n of neighbors) {
            const wPos = this.gridSystem.gridToWorldCenter(n.x, n.z);
            if (this.waterSystem && this.waterSystem.isNavigableAt(wPos.x, wPos.z).canNavigate) {
              hasNavigableFrontage = true;
              break;
            }
          }
          if (hasNavigableFrontage) break;
        }

        if (!hasNavigableFrontage) {
          return {
            isValid: false,
            reasonCode: 'MISSING_WATER_FRONTAGE',
            message: 'Marine freight facility requires direct frontage onto a navigable deepwater channel.',
            affectedCells,
            effectiveWidth,
            effectiveDepth,
            hasRoadAccess: false,
            cost: definition.cost,
          };
        }
      } else {
        // Terrestrial building cannot encroach on water body
        for (const cell of affectedCells) {
          if (this.terrainModel && this.terrainModel.isWaterCell(cell.x, cell.z)) {
            return {
              isValid: false,
              reasonCode: 'PROXIMITY_TO_WATER',
              message: `Building foundation encroaches on natural water body at cell (${cell.x}, ${cell.z}).`,
              affectedCells,
              effectiveWidth,
              effectiveDepth,
              hasRoadAccess: false,
              cost: definition.cost,
            };
          }
        }
      }
    }

    // 6. Facility Entrance Check (Truck Depots)
    if (definition.id.includes('depot')) {
      const entranceZ = anchorZ - 1;
      const entranceX = anchorX;
      if (this.gridSystem.isWithinBounds(entranceX, entranceZ)) {
        const entranceOcc = this.gridSystem.getOccupancy(entranceX, entranceZ);
        if (entranceOcc === 'building' || entranceOcc === 'obstacle') {
          return {
            isValid: false,
            reasonCode: 'ENTRANCE_OBSTRUCTED',
            message: `Depot vehicle entrance at (${entranceX}, ${entranceZ}) is obstructed.`,
            affectedCells,
            effectiveWidth,
            effectiveDepth,
            hasRoadAccess: false,
            cost: definition.cost,
          };
        }
      }
    }

    // 7. Road Access Requirement & Hierarchy Check
    const requiresRoad = definition.requiresRoadAccess !== false;
    let hasRoadAccess = false;
    let onlyHighwayAccess = true;

    // Check perimeter adjacency of the entire footprint against active road network
    for (const cell of affectedCells) {
      const neighbors = this.gridSystem.getAdjacentCells(cell.x, cell.z);
      for (const n of neighbors) {
        if (this.roadNetworkModel.hasRoad(n.x, n.z)) {
          hasRoadAccess = true;
          const roadCell = this.roadNetworkModel.getRoadCell(n.x, n.z);
          if (roadCell && roadCell.roadType !== 'highway_corridor') {
            onlyHighwayAccess = false;
          }
        }
      }
    }

    if (requiresRoad && !hasRoadAccess) {
      return {
        isValid: false,
        reasonCode: 'MISSING_ROAD_ACCESS',
        message: 'Logistics facility requires direct access to an adjacent roadway.',
        affectedCells,
        effectiveWidth,
        effectiveDepth,
        hasRoadAccess: false,
        cost: definition.cost,
      };
    }

    // Direct building driveway entrances onto high-speed 110 km/h highway carriageways are prohibited
    if (requiresRoad && hasRoadAccess && onlyHighwayAccess) {
      return {
        isValid: false,
        reasonCode: 'DIRECT_HIGHWAY_ACCESS_PROHIBITED',
        message: 'Direct facility entrances onto high-speed highway corridors are prohibited. Connect via an arterial avenue, local street, or service ramp.',
        affectedCells,
        effectiveWidth,
        effectiveDepth,
        hasRoadAccess: false,
        cost: definition.cost,
      };
    }

    // 8. Financial Affordability Check
    if (availableFunds !== undefined && availableFunds < definition.cost) {
      return {
        isValid: false,
        reasonCode: 'INSUFFICIENT_FUNDS',
        message: `Insufficient treasury funds: Requires $${definition.cost.toLocaleString()} (Available: $${availableFunds.toLocaleString()}).`,
        affectedCells,
        effectiveWidth,
        effectiveDepth,
        hasRoadAccess,
        cost: definition.cost,
      };
    }

    // All validation criteria passed
    return {
      isValid: true,
      reasonCode: 'VALID',
      message: `Site clear and road-connected. Click to establish ${definition.name} ($${definition.cost.toLocaleString()}).`,
      affectedCells,
      effectiveWidth,
      effectiveDepth,
      hasRoadAccess,
      cost: definition.cost,
      elevationVariance,
    };
  }
}
