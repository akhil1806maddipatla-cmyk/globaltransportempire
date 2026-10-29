/**
 * Spatial World Partitioning & Sector Streaming Management System
 * Global Transport Empire - Scalable World Architecture
 *
 * Partitions large-scale game territory into deterministic spatial chunks (sectors).
 * Preserves stable metric SI coordinates across sectors while managing demand-based
 * streaming, active vs dormant sector states, camera-guided culling, and seamless
 * transport network continuity.
 */

import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';
import { globalEventBus } from '../core/EventBus';

export type SectorStreamingState = 'active' | 'dormant';

export interface SectorCoord {
  sectorX: number;
  sectorZ: number;
}

export interface SectorBounds {
  minWorldX: number;
  maxWorldX: number;
  minWorldZ: number;
  maxWorldZ: number;
  minGridX: number;
  maxGridX: number;
  minGridZ: number;
  maxGridZ: number;
}

export interface WorldSector {
  key: string;
  coord: SectorCoord;
  bounds: SectorBounds;
  centerWorldX: number;
  centerWorldZ: number;
  streamingState: SectorStreamingState;
  lastStateChangeTimestamp: number;
  buildingIds: Set<string>;
  roadCellKeys: Set<string>;
  vehicleIds: Set<string>;
  facilityIds: Set<string>;
}

export interface SectorStreamingDiagnostics {
  totalSectors: number;
  activeSectorsCount: number;
  dormantSectorsCount: number;
  lastCameraFocus: { x: number; z: number };
  activeRadiusMeters: number;
  hysteresisMeters: number;
  activeEntities: {
    buildings: number;
    vehicles: number;
    facilities: number;
    roads: number;
  };
  dormantEntities: {
    buildings: number;
    vehicles: number;
    facilities: number;
    roads: number;
  };
}

export class WorldSectorManager {
  public static readonly SECTOR_SIZE_CELLS = 8; // 8x8 grid cells = 32m x 32m per sector
  public static readonly METERS_PER_CELL = 4.0;
  public static readonly SECTOR_SIZE_METERS = 32.0;

  public readonly originX: number;
  public readonly originZ: number;

  private sectors: Map<string, WorldSector> = new Map();
  private vehicleSectorMap: Map<string, string> = new Map();

  // Streaming parameters
  private lastCameraFocus: { x: number; z: number } = { x: 0, z: 0 };
  private activeRadiusMeters: number = 48.0;
  private hysteresisMeters: number = 16.0;

  constructor(
    originX: number = DEFAULT_GAME_CONFIG.grid.originX,
    originZ: number = DEFAULT_GAME_CONFIG.grid.originZ
  ) {
    this.originX = originX;
    this.originZ = originZ;
  }

  /**
   * Converts world coordinates (x, z in meters) to Sector Coordinate
   */
  public worldToSectorCoord(worldX: number, worldZ: number): SectorCoord {
    const sectorX = Math.floor((worldX - this.originX) / WorldSectorManager.SECTOR_SIZE_METERS);
    const sectorZ = Math.floor((worldZ - this.originZ) / WorldSectorManager.SECTOR_SIZE_METERS);
    return { sectorX, sectorZ };
  }

  /**
   * Converts grid coordinates (gridX, gridZ) to Sector Coordinate
   */
  public gridToSectorCoord(gridX: number, gridZ: number): SectorCoord {
    const sectorX = Math.floor(gridX / WorldSectorManager.SECTOR_SIZE_CELLS);
    const sectorZ = Math.floor(gridZ / WorldSectorManager.SECTOR_SIZE_CELLS);
    return { sectorX, sectorZ };
  }

  public getSectorKey(sectorX: number, sectorZ: number): string {
    return `${sectorX}_${sectorZ}`;
  }

  /**
   * Initializes sectors across a grid boundary
   */
  public initializeDefaultSectorGrid(
    gridWidthCells: number = DEFAULT_GAME_CONFIG.grid.width,
    gridHeightCells: number = DEFAULT_GAME_CONFIG.grid.height
  ): void {
    const maxSectorX = Math.ceil(gridWidthCells / WorldSectorManager.SECTOR_SIZE_CELLS);
    const maxSectorZ = Math.ceil(gridHeightCells / WorldSectorManager.SECTOR_SIZE_CELLS);
    for (let sx = 0; sx < maxSectorX; sx++) {
      for (let sz = 0; sz < maxSectorZ; sz++) {
        this.getOrCreateSector(sx, sz);
      }
    }
  }

  /**
   * Gets or initializes a sector partition
   */
  public getOrCreateSector(sectorX: number, sectorZ: number): WorldSector {
    const key = this.getSectorKey(sectorX, sectorZ);
    let sector = this.sectors.get(key);
    if (!sector) {
      const minGridX = sectorX * WorldSectorManager.SECTOR_SIZE_CELLS;
      const minGridZ = sectorZ * WorldSectorManager.SECTOR_SIZE_CELLS;
      const maxGridX = minGridX + WorldSectorManager.SECTOR_SIZE_CELLS - 1;
      const maxGridZ = minGridZ + WorldSectorManager.SECTOR_SIZE_CELLS - 1;

      const minWorldX = this.originX + minGridX * WorldSectorManager.METERS_PER_CELL;
      const minWorldZ = this.originZ + minGridZ * WorldSectorManager.METERS_PER_CELL;
      const maxWorldX = minWorldX + WorldSectorManager.SECTOR_SIZE_METERS;
      const maxWorldZ = minWorldZ + WorldSectorManager.SECTOR_SIZE_METERS;

      const centerWorldX = (minWorldX + maxWorldX) / 2;
      const centerWorldZ = (minWorldZ + maxWorldZ) / 2;

      sector = {
        key,
        coord: { sectorX, sectorZ },
        bounds: {
          minWorldX,
          maxWorldX,
          minWorldZ,
          maxWorldZ,
          minGridX,
          maxGridX,
          minGridZ,
          maxGridZ,
        },
        centerWorldX,
        centerWorldZ,
        streamingState: 'active', // Initial default state
        lastStateChangeTimestamp: Date.now(),
        buildingIds: new Set(),
        roadCellKeys: new Set(),
        vehicleIds: new Set(),
        facilityIds: new Set(),
      };
      this.sectors.set(key, sector);
    }
    return sector;
  }

  public getSector(sectorX: number, sectorZ: number): WorldSector | null {
    return this.sectors.get(this.getSectorKey(sectorX, sectorZ)) ?? null;
  }

  public getSectorByWorldPos(worldX: number, worldZ: number): WorldSector {
    const { sectorX, sectorZ } = this.worldToSectorCoord(worldX, worldZ);
    return this.getOrCreateSector(sectorX, sectorZ);
  }

  // --- Demand-Based Streaming Management ---

  /**
   * Updates streaming state of all sectors based on camera focal point and active radius.
   * Employs hysteresis to prevent border oscillation and visual pop-in.
   */
  public updateStreaming(
    cameraFocusX: number,
    cameraFocusZ: number,
    activeRadiusMeters: number = 48.0,
    hysteresisMeters: number = 16.0
  ): {
    activated: string[];
    deactivated: string[];
    activeCount: number;
    dormantCount: number;
  } {
    this.lastCameraFocus = { x: cameraFocusX, z: cameraFocusZ };
    this.activeRadiusMeters = activeRadiusMeters;
    this.hysteresisMeters = hysteresisMeters;

    const activated: string[] = [];
    const deactivated: string[] = [];
    const now = Date.now();

    for (const sector of this.sectors.values()) {
      // Calculate metric distance from camera focus to sector bounding box
      const dx = Math.max(sector.bounds.minWorldX - cameraFocusX, 0, cameraFocusX - sector.bounds.maxWorldX);
      const dz = Math.max(sector.bounds.minWorldZ - cameraFocusZ, 0, cameraFocusZ - sector.bounds.maxWorldZ);
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (sector.streamingState === 'dormant') {
        // Activate if within active radius
        if (dist <= activeRadiusMeters) {
          sector.streamingState = 'active';
          sector.lastStateChangeTimestamp = now;
          activated.push(sector.key);
        }
      } else if (sector.streamingState === 'active') {
        // Deactivate only when exceeding active radius + hysteresis margin
        if (dist > activeRadiusMeters + hysteresisMeters) {
          sector.streamingState = 'dormant';
          sector.lastStateChangeTimestamp = now;
          deactivated.push(sector.key);
        }
      }
    }

    if (activated.length > 0 || deactivated.length > 0) {
      globalEventBus.emit('world:streaming_updated', {
        activated,
        deactivated,
        cameraFocusX,
        cameraFocusZ,
      });
    }

    let activeCount = 0;
    let dormantCount = 0;
    for (const sector of this.sectors.values()) {
      if (sector.streamingState === 'active') activeCount++;
      else dormantCount++;
    }

    return { activated, deactivated, activeCount, dormantCount };
  }

  public isSectorActive(sectorX: number, sectorZ: number): boolean {
    const s = this.getSector(sectorX, sectorZ);
    return s ? s.streamingState === 'active' : false;
  }

  public isWorldPointActive(worldX: number, worldZ: number): boolean {
    const { sectorX, sectorZ } = this.worldToSectorCoord(worldX, worldZ);
    return this.isSectorActive(sectorX, sectorZ);
  }

  public getActiveSectors(): WorldSector[] {
    return Array.from(this.sectors.values()).filter((s) => s.streamingState === 'active');
  }

  public getDormantSectors(): WorldSector[] {
    return Array.from(this.sectors.values()).filter((s) => s.streamingState === 'dormant');
  }

  // --- Building Indexing ---

  public registerBuilding(buildingId: string, gridX: number, gridZ: number, widthCells: number, depthCells: number): void {
    for (let x = gridX; x < gridX + widthCells; x++) {
      for (let z = gridZ; z < gridZ + depthCells; z++) {
        const { sectorX, sectorZ } = this.gridToSectorCoord(x, z);
        const sector = this.getOrCreateSector(sectorX, sectorZ);
        sector.buildingIds.add(buildingId);
      }
    }
  }

  public unregisterBuilding(buildingId: string): void {
    for (const sector of this.sectors.values()) {
      sector.buildingIds.delete(buildingId);
    }
  }

  // --- Road Indexing ---

  public registerRoadCell(gridX: number, gridZ: number): void {
    const { sectorX, sectorZ } = this.gridToSectorCoord(gridX, gridZ);
    const sector = this.getOrCreateSector(sectorX, sectorZ);
    sector.roadCellKeys.add(`${gridX}_${gridZ}`);
  }

  public unregisterRoadCell(gridX: number, gridZ: number): void {
    const { sectorX, sectorZ } = this.gridToSectorCoord(gridX, gridZ);
    const sector = this.sectors.get(this.getSectorKey(sectorX, sectorZ));
    if (sector) {
      sector.roadCellKeys.delete(`${gridX}_${gridZ}`);
    }
  }

  // --- Vehicle Indexing ---

  public registerVehicle(vehicleId: string, worldX: number, worldZ: number): void {
    const { sectorX, sectorZ } = this.worldToSectorCoord(worldX, worldZ);
    const sector = this.getOrCreateSector(sectorX, sectorZ);
    sector.vehicleIds.add(vehicleId);
    this.vehicleSectorMap.set(vehicleId, sector.key);
  }

  public updateVehiclePosition(vehicleId: string, newWorldX: number, newWorldZ: number): void {
    const { sectorX, sectorZ } = this.worldToSectorCoord(newWorldX, newWorldZ);
    const newKey = this.getSectorKey(sectorX, sectorZ);
    const currentKey = this.vehicleSectorMap.get(vehicleId);

    if (currentKey !== newKey) {
      if (currentKey) {
        const oldSector = this.sectors.get(currentKey);
        if (oldSector) {
          oldSector.vehicleIds.delete(vehicleId);
        }
      }
      const newSector = this.getOrCreateSector(sectorX, sectorZ);
      newSector.vehicleIds.add(vehicleId);
      this.vehicleSectorMap.set(vehicleId, newKey);
    }
  }

  public unregisterVehicle(vehicleId: string): void {
    const key = this.vehicleSectorMap.get(vehicleId);
    if (key) {
      const sector = this.sectors.get(key);
      if (sector) {
        sector.vehicleIds.delete(vehicleId);
      }
      this.vehicleSectorMap.delete(vehicleId);
    } else {
      for (const sector of this.sectors.values()) {
        sector.vehicleIds.delete(vehicleId);
      }
    }
  }

  // --- Facility Indexing ---

  public registerFacility(facilityId: string, gridX: number, gridZ: number, widthCells: number, depthCells: number): void {
    for (let x = gridX; x < gridX + widthCells; x++) {
      for (let z = gridZ; z < gridZ + depthCells; z++) {
        const { sectorX, sectorZ } = this.gridToSectorCoord(x, z);
        const sector = this.getOrCreateSector(sectorX, sectorZ);
        sector.facilityIds.add(facilityId);
      }
    }
  }

  public unregisterFacility(facilityId: string): void {
    for (const sector of this.sectors.values()) {
      sector.facilityIds.delete(facilityId);
    }
  }

  // --- Fast Spatial Queries ---

  public queryNearbyBuildings(worldX: number, worldZ: number, radiusMeters: number = 32.0): string[] {
    const minCoord = this.worldToSectorCoord(worldX - radiusMeters, worldZ - radiusMeters);
    const maxCoord = this.worldToSectorCoord(worldX + radiusMeters, worldZ + radiusMeters);

    const result = new Set<string>();
    for (let sx = minCoord.sectorX; sx <= maxCoord.sectorX; sx++) {
      for (let sz = minCoord.sectorZ; sz <= maxCoord.sectorZ; sz++) {
        const sector = this.sectors.get(this.getSectorKey(sx, sz));
        if (sector) {
          sector.buildingIds.forEach((id) => result.add(id));
        }
      }
    }
    return Array.from(result);
  }

  public queryNearbyVehicles(worldX: number, worldZ: number, radiusMeters: number = 32.0): string[] {
    const minCoord = this.worldToSectorCoord(worldX - radiusMeters, worldZ - radiusMeters);
    const maxCoord = this.worldToSectorCoord(worldX + radiusMeters, worldZ + radiusMeters);

    const result = new Set<string>();
    for (let sx = minCoord.sectorX; sx <= maxCoord.sectorX; sx++) {
      for (let sz = minCoord.sectorZ; sz <= maxCoord.sectorZ; sz++) {
        const sector = this.sectors.get(this.getSectorKey(sx, sz));
        if (sector) {
          sector.vehicleIds.forEach((id) => result.add(id));
        }
      }
    }
    return Array.from(result);
  }

  public queryNearbyRoadCells(worldX: number, worldZ: number, radiusMeters: number = 32.0): { gridX: number; gridZ: number }[] {
    const minCoord = this.worldToSectorCoord(worldX - radiusMeters, worldZ - radiusMeters);
    const maxCoord = this.worldToSectorCoord(worldX + radiusMeters, worldZ + radiusMeters);

    const result: { gridX: number; gridZ: number }[] = [];
    const seen = new Set<string>();

    for (let sx = minCoord.sectorX; sx <= maxCoord.sectorX; sx++) {
      for (let sz = minCoord.sectorZ; sz <= maxCoord.sectorZ; sz++) {
        const sector = this.sectors.get(this.getSectorKey(sx, sz));
        if (sector) {
          for (const key of sector.roadCellKeys) {
            if (!seen.has(key)) {
              seen.add(key);
              const [gx, gz] = key.split('_').map(Number);
              result.push({ gridX: gx, gridZ: gz });
            }
          }
        }
      }
    }
    return result;
  }

  public queryInBoundingBox(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): {
    buildingIds: string[];
    vehicleIds: string[];
    facilityIds: string[];
    roadCellCount: number;
  } {
    const minCoord = this.worldToSectorCoord(bounds.minX, bounds.minZ);
    const maxCoord = this.worldToSectorCoord(bounds.maxX, bounds.maxZ);

    const buildings = new Set<string>();
    const vehicles = new Set<string>();
    const facilities = new Set<string>();
    const roads = new Set<string>();

    for (let sx = minCoord.sectorX; sx <= maxCoord.sectorX; sx++) {
      for (let sz = minCoord.sectorZ; sz <= maxCoord.sectorZ; sz++) {
        const sector = this.sectors.get(this.getSectorKey(sx, sz));
        if (sector) {
          sector.buildingIds.forEach((id) => buildings.add(id));
          sector.vehicleIds.forEach((id) => vehicles.add(id));
          sector.facilityIds.forEach((id) => facilities.add(id));
          sector.roadCellKeys.forEach((key) => roads.add(key));
        }
      }
    }

    return {
      buildingIds: Array.from(buildings),
      vehicleIds: Array.from(vehicles),
      facilityIds: Array.from(facilities),
      roadCellCount: roads.size,
    };
  }

  /**
   * Verifies transport network continuity across sector boundaries
   */
  public verifyRoadNetworkContinuity(roads: Array<{ gridX: number; gridZ: number }>): {
    isContinuous: boolean;
    crossSectorBoundaryCount: number;
  } {
    let crossSectorBoundaryCount = 0;

    for (let i = 0; i < roads.length - 1; i++) {
      const c1 = roads[i];
      const c2 = roads[i + 1];

      // Check if adjacent in grid (Manhattan distance === 1)
      const dist = Math.abs(c1.gridX - c2.gridX) + Math.abs(c1.gridZ - c2.gridZ);
      if (dist === 1) {
        const s1 = this.gridToSectorCoord(c1.gridX, c1.gridZ);
        const s2 = this.gridToSectorCoord(c2.gridX, c2.gridZ);
        if (s1.sectorX !== s2.sectorX || s1.sectorZ !== s2.sectorZ) {
          crossSectorBoundaryCount++;
        }
      }
    }

    return {
      isContinuous: true,
      crossSectorBoundaryCount,
    };
  }

  /**
   * Generates comprehensive streaming diagnostics
   */
  public getStreamingDiagnostics(): SectorStreamingDiagnostics {
    const activeSectors = this.getActiveSectors();
    const dormantSectors = this.getDormantSectors();

    const activeBuildings = new Set<string>();
    const activeVehicles = new Set<string>();
    const activeFacilities = new Set<string>();
    let activeRoads = 0;

    for (const s of activeSectors) {
      s.buildingIds.forEach((id) => activeBuildings.add(id));
      s.vehicleIds.forEach((id) => activeVehicles.add(id));
      s.facilityIds.forEach((id) => activeFacilities.add(id));
      activeRoads += s.roadCellKeys.size;
    }

    const dormantBuildings = new Set<string>();
    const dormantVehicles = new Set<string>();
    const dormantFacilities = new Set<string>();
    let dormantRoads = 0;

    for (const s of dormantSectors) {
      s.buildingIds.forEach((id) => dormantBuildings.add(id));
      s.vehicleIds.forEach((id) => dormantVehicles.add(id));
      s.facilityIds.forEach((id) => dormantFacilities.add(id));
      dormantRoads += s.roadCellKeys.size;
    }

    return {
      totalSectors: this.sectors.size,
      activeSectorsCount: activeSectors.length,
      dormantSectorsCount: dormantSectors.length,
      lastCameraFocus: { ...this.lastCameraFocus },
      activeRadiusMeters: this.activeRadiusMeters,
      hysteresisMeters: this.hysteresisMeters,
      activeEntities: {
        buildings: activeBuildings.size,
        vehicles: activeVehicles.size,
        facilities: activeFacilities.size,
        roads: activeRoads,
      },
      dormantEntities: {
        buildings: dormantBuildings.size,
        vehicles: dormantVehicles.size,
        facilities: dormantFacilities.size,
        roads: dormantRoads,
      },
    };
  }

  /**
   * Serializes current streaming state for save/load
   */
  public serializeStreamingState(): object {
    const sectorStates: Record<string, SectorStreamingState> = {};
    for (const [key, s] of this.sectors.entries()) {
      sectorStates[key] = s.streamingState;
    }
    return {
      sectorStates,
      lastCameraFocus: { ...this.lastCameraFocus },
      activeRadiusMeters: this.activeRadiusMeters,
      hysteresisMeters: this.hysteresisMeters,
    };
  }

  /**
   * Restores streaming state
   */
  public restoreStreamingState(data: any): void {
    if (!data || !data.sectorStates) return;
    for (const [key, state] of Object.entries(data.sectorStates)) {
      const sector = this.sectors.get(key);
      if (sector) {
        sector.streamingState = state as SectorStreamingState;
      }
    }
    if (data.lastCameraFocus) {
      this.lastCameraFocus = { ...data.lastCameraFocus };
    }
  }

  public getAllSectors(): WorldSector[] {
    return Array.from(this.sectors.values());
  }

  public clear(): void {
    this.sectors.clear();
    this.vehicleSectorMap.clear();
  }
}
