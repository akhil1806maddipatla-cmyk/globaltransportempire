import { WaterSystemModel, WaterBody } from './water/WaterSystemModel';

export type TerrainClassification =
  | 'plains'
  | 'graded_facility'
  | 'transport_corridor'
  | 'water'
  | 'shoreline'
  | 'rolling_hill';

export interface WaterBodyDefinition {
  id: string;
  name: string;
  type: 'river' | 'pond' | 'lake' | 'coast';
  surfaceElevation: number; // strictly negative, e.g. -0.15m
  bedElevation: number; // e.g. -0.45m
  isGridCellInWater(gridX: number, gridZ: number): boolean;
  isWorldPointInWater(worldX: number, worldZ: number): boolean;
}

export interface TransportCorridorReservation {
  id: string;
  name: string;
  mode: 'rail' | 'port' | 'highway';
  gradeElevation: number; // 0.015m
  cells: { gridX: number; gridZ: number }[];
}

export interface GradedPadArea {
  id: string;
  name: string;
  gridX: number;
  gridZ: number;
  width: number;
  depth: number;
  elevation: number; // 0.02m
}

export class TerrainModel {
  public static readonly DATUM_ELEVATION: number = 0.0;
  public static readonly WATER_SURFACE_ELEVATION: number = -0.15;
  public static readonly WATER_BED_ELEVATION: number = -0.45;
  public static readonly GRADED_PAD_ELEVATION: number = 0.02;
  public static readonly CORRIDOR_ELEVATION: number = 0.015;
  public static readonly ROAD_SURFACE_ELEVATION: number = 0.04;

  public readonly waterSystem: WaterSystemModel;
  public readonly waterBodies: WaterBodyDefinition[] = [];
  public readonly corridors: TransportCorridorReservation[] = [];
  public readonly gradedPads: GradedPadArea[] = [];

  constructor() {
    this.waterSystem = new WaterSystemModel();
    this.initializeNaturalFeatures();
  }

  private initializeNaturalFeatures(): void {
    // 1. Southeast Stormwater Retention Basin / Eco-Lake (gridX=20..22, gridZ=18..20)
    // World space around center (38.0, 30.0) with radius 2.8m
    this.waterBodies.push({
      id: 'water_retention_pond',
      name: 'South-East Stormwater Retention Basin',
      type: 'pond',
      surfaceElevation: TerrainModel.WATER_SURFACE_ELEVATION,
      bedElevation: TerrainModel.WATER_BED_ELEVATION,
      isGridCellInWater: (gx, gz) => gx >= 20 && gx <= 22 && gz >= 18 && gz <= 20,
      isWorldPointInWater: (wx, wz) => {
        // Center of cell (21, 19): originX=-48 + (21.5)*4 = 38.0, originZ=-48 + (19.5)*4 = 30.0
        const dx = wx - 38.0;
        const dz = wz - 30.0;
        return dx * dx + dz * dz <= 2.8 * 2.8;
      },
    });

    // 2. Northwest Scenic River Corridor & Delta (Entering from northwest hills)
    // Water channel occupies cells (0, 0), (0, 1), (0, 2), and (1, 0)
    // Leaves cell (1, 1) and corner (-40, -40) as dry land (River Island Reserve / Riverbank)
    this.waterBodies.push({
      id: 'water_northwest_river',
      name: 'Northwest Mountain River Corridor',
      type: 'river',
      surfaceElevation: TerrainModel.WATER_SURFACE_ELEVATION,
      bedElevation: TerrainModel.WATER_BED_ELEVATION,
      isGridCellInWater: (gx, gz) => {
        if (gx === 1 && gz === 1) return false; // Natural River Island
        if (gx === 0 && gz <= 2) return true; // Main channel
        if (gx === 1 && gz === 0) return true; // Northern bend
        return false;
      },
      isWorldPointInWater: (wx, wz) => {
        // Northwest corner bounding: wx from -48.0 to -40.1, wz from -48.0 to -36.0
        // Or northern bend: wx from -44.0 to -40.1, wz from -48.0 to -44.1
        if (wx < -48.0 || wx > -40.1 || wz < -48.0 || wz > -36.0) return false;
        // Keep River Island dry: wx around -42.0 to -40.0 and wz around -44.0 to -40.0
        if (wx >= -44.0 && wz >= -44.0) return false; // Island & riverbank
        return true;
      },
    });

    // 3. Reserved Transport Corridors (Level graded ballast / paving ready for rail & port)
    // A. Northern Transcontinental Rail Right-of-Way Reserve (gridZ = 1, gridX = 4..23)
    const railCells: { gridX: number; gridZ: number }[] = [];
    for (let x = 4; x <= 23; x++) {
      railCells.push({ gridX: x, gridZ: 1 });
    }
    this.corridors.push({
      id: 'corridor_northern_rail',
      name: 'Northern Heavy Rail Right-of-Way Reserve',
      mode: 'rail',
      gradeElevation: TerrainModel.CORRIDOR_ELEVATION,
      cells: railCells,
    });

    // B. Eastern Coastal Maritime Port Access Corridor (gridX = 22..23, gridZ = 13..16)
    const portCells: { gridX: number; gridZ: number }[] = [];
    for (let x = 22; x <= 23; x++) {
      for (let z = 13; z <= 16; z++) {
        portCells.push({ gridX: x, gridZ: z });
      }
    }
    this.corridors.push({
      id: 'corridor_eastern_port',
      name: 'Eastern Maritime Deepwater Port Reserve',
      mode: 'port',
      gradeElevation: TerrainModel.CORRIDOR_ELEVATION,
      cells: portCells,
    });

    // C. Transcontinental Interstate 99 Highway Corridor Reserve (gridX = 24, gridZ = 0..55)
    const i99Cells: { gridX: number; gridZ: number }[] = [];
    for (let z = 0; z < 56; z++) {
      i99Cells.push({ gridX: 24, gridZ: z });
    }
    this.corridors.push({
      id: 'corridor_interstate_99',
      name: 'Interstate Highway 99 Express Corridor',
      mode: 'highway',
      gradeElevation: TerrainModel.CORRIDOR_ELEVATION,
      cells: i99Cells,
    });

    // D. Southern Cross-Regional Delta Boulevard Corridor (gridZ = 36, gridX = 12..48)
    const deltaCells: { gridX: number; gridZ: number }[] = [];
    for (let x = 12; x <= 48; x++) {
      deltaCells.push({ gridX: x, gridZ: 36 });
    }
    this.corridors.push({
      id: 'corridor_delta_boulevard',
      name: 'Delta Regional Freight Arterial Corridor',
      mode: 'highway',
      gradeElevation: TerrainModel.CORRIDOR_ELEVATION,
      cells: deltaCells,
    });

    // 4. Graded Facility Foundation Pads
    // A. Level 1 Starter Truck Depot (gridX=12, gridZ=13, 4x3 cells, 3 designated parking bays)
    this.gradedPads.push({
      id: 'pad_starter_truck_depot',
      name: 'Level 1 Starter Truck Depot Engineered Pad',
      gridX: 12,
      gridZ: 13,
      width: 4,
      depth: 3,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });

    // B. Logistics Hub Pad (gridX=5, gridZ=12, 4x3 cells)
    this.gradedPads.push({
      id: 'pad_logistics_hub',
      name: 'Central Sector Logistics Hub Engineered Pad',
      gridX: 5,
      gridZ: 12,
      width: 4,
      depth: 3,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });

    // C. Manufacturing Plant Pad (gridX=8, gridZ=5, 3x3 cells)
    this.gradedPads.push({
      id: 'pad_industrial_mfg',
      name: 'Apex Manufacturing Engineered Pad',
      gridX: 8,
      gridZ: 5,
      width: 3,
      depth: 3,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });

    // D. Commercial Dispatch HQ Pad (gridX=12, gridZ=6, 3x2 cells)
    this.gradedPads.push({
      id: 'pad_dispatch_hq',
      name: 'Commercial Dispatch HQ Engineered Pad',
      gridX: 12,
      gridZ: 6,
      width: 3,
      depth: 2,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });

    // E. Southern Intermodal Distribution Terminal Pad (gridX=16, gridZ=28, 5x4 cells)
    this.gradedPads.push({
      id: 'pad_south_intermodal',
      name: 'South Intermodal Freight Terminal Pad',
      gridX: 16,
      gridZ: 28,
      width: 5,
      depth: 4,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });

    // F. Northeast Tech & Assembly Estate Pad (gridX=28, gridZ=4, 5x4 cells)
    this.gradedPads.push({
      id: 'pad_northeast_tech',
      name: 'Northeast Tech & Assembly Park Pad',
      gridX: 28,
      gridZ: 4,
      width: 5,
      depth: 4,
      elevation: TerrainModel.GRADED_PAD_ELEVATION,
    });
  }

  /**
   * Checks if a grid cell falls within any water body
   */
  public isWaterCell(gridX: number, gridZ: number): boolean {
    return this.waterBodies.some((wb) => wb.isGridCellInWater(gridX, gridZ));
  }

  /**
   * Checks if a world coordinate falls within open water
   */
  public isWorldPointInWater(worldX: number, worldZ: number): boolean {
    return this.waterBodies.some((wb) => wb.isWorldPointInWater(worldX, worldZ));
  }

  /**
   * Checks if a cell is an engineered graded facility pad
   */
  public isGradedPadCell(gridX: number, gridZ: number): boolean {
    return this.gradedPads.some(
      (pad) =>
        gridX >= pad.gridX &&
        gridX < pad.gridX + pad.width &&
        gridZ >= pad.gridZ &&
        gridZ < pad.gridZ + pad.depth
    );
  }

  /**
   * Checks if a cell is inside a reserved transport corridor
   */
  public isCorridorCell(gridX: number, gridZ: number): boolean {
    return this.corridors.some((c) => c.cells.some((cell) => cell.gridX === gridX && cell.gridZ === gridZ));
  }

  /**
   * Checks if a cell is the natural river island
   */
  public isRiverIslandCell(gridX: number, gridZ: number): boolean {
    return gridX === 1 && gridZ === 1;
  }

  /**
   * Returns classification for a given grid cell
   */
  public getClassification(gridX: number, gridZ: number): TerrainClassification {
    if (this.isWaterCell(gridX, gridZ)) return 'water';
    if (this.isGradedPadCell(gridX, gridZ)) return 'graded_facility';
    if (this.isCorridorCell(gridX, gridZ)) return 'transport_corridor';
    if (this.isRiverIslandCell(gridX, gridZ)) return 'plains';
    return 'plains';
  }

  /**
   * Samples authoritative ground elevation at world coordinate (worldX, worldZ)
   * Continental topography:
   * - Central Logistics & Industrial Valley (-48m to +42m): level plains datum 0.0m
   * - Northern Mountains (Z < -48m): rolling elevations rising to +2.5m..+6.5m with Lake Serene basin
   * - Western Foothills (X < -48m): gentle ridges rising to +1.2m..+4.0m
   * - Eastern Coastal Shelf (X > 45m): slopes down to high-water mark (-0.15m) and deepwater seabed (-3.5m)
   * - Southern Lowlands (Z > 48m): gentle coastal plains (0.0m to -0.05m)
   * - Offshore Islands: Pelican Isle (+0.25m), Lighthouse Rock (+0.65m)
   */
  public getElevationAt(worldX: number, worldZ: number, isRoadSurface: boolean = false): number {
    if (isRoadSurface) {
      return TerrainModel.ROAD_SURFACE_ELEVATION;
    }

    if (this.isWorldPointInWater(worldX, worldZ)) {
      return TerrainModel.WATER_SURFACE_ELEVATION;
    }

    // Offshore Islands
    const dPelican = Math.hypot(worldX - 85.0, worldZ - 12.0);
    if (dPelican <= 6.5) {
      return 0.25 * (1.0 - dPelican / 6.5);
    }
    const dLighthouse = Math.hypot(worldX - 78.0, worldZ - -45.0);
    if (dLighthouse <= 4.5) {
      return 0.65 * (1.0 - dLighthouse / 4.5);
    }

    // Expanded continental transport plains (-48m to +174m X, -48m to +176m Z): flat, stable datum 0.0m
    if (worldX >= -48.0 && worldX <= 174.0 && worldZ >= -48.0 && worldZ <= 176.0) {
      return TerrainModel.DATUM_ELEVATION;
    }

    // Eastern Coastal Margin (slopes down toward ocean beyond X=174m)
    if (worldX > 174.0 && worldX < 210.0 && worldZ >= -48.0 && worldZ <= 176.0) {
      const drop = ((worldX - 174.0) / 36.0) * -0.15;
      return Math.max(-0.15, drop);
    }

    let elevation = TerrainModel.DATUM_ELEVATION;

    // Northern Highland Mountain Ridges (Z < -48m)
    if (worldZ < -48.0) {
      const northDist = -worldZ - 48.0;
      // Dip for Lake Serene basin
      const dLake = Math.hypot(worldX - -15.0, (worldZ - -80.0) * 1.3);
      if (dLake < 22.0) {
        // Pine Crest Island at center
        if (dLake <= 4.0) {
          elevation = 0.2;
        } else {
          elevation = -0.15;
        }
      } else {
        const ridgeWave = Math.sin(worldX * 0.045) * 1.6 + Math.cos(worldZ * 0.035) * 1.2;
        elevation = Math.min(6.5, (northDist / 60.0) * 4.0 + ridgeWave);
      }
    }

    // Western Foothills (X < -48m)
    if (worldX < -48.0) {
      const westDist = -worldX - 48.0;
      const hillWave = Math.sin(worldZ * 0.05) * 1.2 + Math.cos(worldX * 0.04) * 0.8;
      const westElevation = Math.min(4.5, (westDist / 60.0) * 2.8 + hillWave);
      elevation = Math.max(elevation, westElevation);
    }

    // Southern Coastal Lowlands & Delta Plains (Z > 176m)
    if (worldZ > 176.0) {
      const southDist = worldZ - 176.0;
      const lowlandWave = Math.sin(worldX * 0.04) * 0.3;
      elevation = Math.min(elevation, Math.max(-0.05, (southDist / 70.0) * -0.05 + lowlandWave));
    }

    return elevation;
  }

  /**
   * Checks whether a cell can support building construction (dry, stable ground)
   */
  public isBuildable(gridX: number, gridZ: number): boolean {
    if (this.isWaterCell(gridX, gridZ)) return false;
    return true;
  }
}
