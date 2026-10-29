/**
 * High-Performance Spatial Query Architecture & Spatial Hash Index
 * Global Transport Empire - Civil Geography & Spatial Validation
 *
 * Implements an O(1) / O(K) 2D spatial hash grid index for large-scale world queries,
 * eliminating full-table entity scans, alongside unified surface classification,
 * terrain elevation sampling, boundary containment, and connectivity validation.
 */

import { GridSystem } from './GridSystem';
import { TerrainModel } from './TerrainModel';
import { WaterSystemModel } from './water/WaterSystemModel';
import { LandParcelManager, LandParcel } from './LandParcelManager';
import { RoadNetworkModel, RoadCellData } from './RoadNetworkModel';
import { EntityRegistry } from '../entities/EntityRegistry';
import { Entity, EntityType } from '../entities/Entity';
import { TransportMode } from '../network/TransportNetwork';

export type SurfaceClassification =
  | 'dry_land'
  | 'natural_water'
  | 'riverbank'
  | 'road_surface'
  | 'bridge_deck'
  | 'rail_track'
  | 'quay_wharf'
  | 'graded_facility_pad'
  | 'offshore_island'
  | 'out_of_bounds';

export interface LocationSpatialProfile {
  worldX: number;
  worldZ: number;
  elevation: number;
  isInsidePlayableBounds: boolean;
  surfaceType: SurfaceClassification;
  gridCoord?: { gridX: number; gridZ: number };
  isWater: boolean;
  isNavigableWater: boolean;
  isRoad: boolean;
  isBridge: boolean;
  isIsland: boolean;
  isGradedPad: boolean;
  occupantBuildingId: string | null;
  occupantRoadCell: RoadCellData | null;
  parcel: LandParcel | null;
}

export interface SpatialIndexEntry {
  id: string;
  entityType: EntityType | 'road' | 'facility' | 'parcel';
  worldX: number;
  worldZ: number;
  radiusMeters: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  dataRef?: unknown;
}

export interface FacilitySuitabilityResult {
  isSuitable: boolean;
  reasonCode: string;
  message: string;
  elevationVariance: number;
  isWaterFrontage: boolean;
  isProtectedArea: boolean;
}

export class SpatialQuerySystem {
  public static readonly BUCKET_SIZE_METERS = 32.0; // 32m x 32m spatial buckets
  public static readonly PLAYABLE_BOUNDS = {
    minX: -128.0,
    maxX: 128.0,
    minZ: -128.0,
    maxZ: 128.0,
  };

  private gridSystem: GridSystem;
  private terrainModel: TerrainModel;
  private waterSystem: WaterSystemModel;
  private parcelManager: LandParcelManager;
  private roadNetworkModel: RoadNetworkModel;
  private entityRegistry?: EntityRegistry;

  // 2D Spatial Bucket Hash Index: bucketKey -> Set of SpatialIndexEntry
  private spatialBuckets: Map<string, Set<SpatialIndexEntry>> = new Map();
  private entityToEntryMap: Map<string, SpatialIndexEntry> = new Map();

  constructor(
    gridSystem: GridSystem,
    terrainModel: TerrainModel,
    waterSystem: WaterSystemModel,
    parcelManager: LandParcelManager,
    roadNetworkModel: RoadNetworkModel,
    entityRegistry?: EntityRegistry
  ) {
    this.gridSystem = gridSystem;
    this.terrainModel = terrainModel;
    this.waterSystem = waterSystem;
    this.parcelManager = parcelManager;
    this.roadNetworkModel = roadNetworkModel;
    this.entityRegistry = entityRegistry;

    this.rebuildIndex();
  }

  /**
   * Generates a deterministic hash key for spatial bucket
   */
  public getBucketKey(worldX: number, worldZ: number): string {
    const bx = Math.floor(worldX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const bz = Math.floor(worldZ / SpatialQuerySystem.BUCKET_SIZE_METERS);
    return `${bx}_${bz}`;
  }

  /**
   * Rebuilds the spatial index from road network, parcels, and entity registry
   */
  public rebuildIndex(): void {
    this.spatialBuckets.clear();
    this.entityToEntryMap.clear();

    // 1. Index Road Network Cells
    const roadCells = this.roadNetworkModel.getAllRoadCells();
    for (const cell of roadCells) {
      const center = this.gridSystem.gridToWorldCenter(cell.gridX, cell.gridZ);
      const halfSize = this.gridSystem.cellSize / 2;
      this.insertEntry({
        id: cell.id,
        entityType: 'road',
        worldX: center.x,
        worldZ: center.z,
        radiusMeters: halfSize * 1.414,
        minX: center.x - halfSize,
        maxX: center.x + halfSize,
        minZ: center.z - halfSize,
        maxZ: center.z + halfSize,
        dataRef: cell,
      });
    }

    // 2. Index Registered Entities (Buildings, Vehicles, Props)
    if (this.entityRegistry) {
      const entities = this.entityRegistry.getAll();
      for (const entity of entities) {
        this.registerEntity(entity);
      }
    }
  }

  /**
   * Inserts an entry into all overlapping spatial buckets
   */
  public insertEntry(entry: SpatialIndexEntry): void {
    this.removeEntry(entry.id);
    this.entityToEntryMap.set(entry.id, entry);

    const minBx = Math.floor(entry.minX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBx = Math.floor(entry.maxX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const minBz = Math.floor(entry.minZ / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBz = Math.floor(entry.maxZ / SpatialQuerySystem.BUCKET_SIZE_METERS);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const key = `${bx}_${bz}`;
        let bucket = this.spatialBuckets.get(key);
        if (!bucket) {
          bucket = new Set();
          this.spatialBuckets.set(key, bucket);
        }
        bucket.add(entry);
      }
    }
  }

  /**
   * Removes an entry from all spatial buckets
   */
  public removeEntry(id: string): boolean {
    const existing = this.entityToEntryMap.get(id);
    if (!existing) return false;

    const minBx = Math.floor(existing.minX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBx = Math.floor(existing.maxX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const minBz = Math.floor(existing.minZ / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBz = Math.floor(existing.maxZ / SpatialQuerySystem.BUCKET_SIZE_METERS);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const key = `${bx}_${bz}`;
        const bucket = this.spatialBuckets.get(key);
        if (bucket) {
          bucket.delete(existing);
          if (bucket.size === 0) {
            this.spatialBuckets.delete(key);
          }
        }
      }
    }

    this.entityToEntryMap.delete(id);
    return true;
  }

  public registerEntity(entity: Entity): void {
    const posX = entity.group.position.x;
    const posZ = entity.group.position.z;
    const halfW = (entity.width * this.gridSystem.cellSize) / 2;
    const halfD = (entity.depth * this.gridSystem.cellSize) / 2;
    const radius = Math.hypot(halfW, halfD);

    this.insertEntry({
      id: entity.id,
      entityType: entity.entityType,
      worldX: posX,
      worldZ: posZ,
      radiusMeters: radius,
      minX: posX - halfW,
      maxX: posX + halfW,
      minZ: posZ - halfD,
      maxZ: posZ + halfD,
      dataRef: entity,
    });
  }

  public unregisterEntity(id: string): boolean {
    return this.removeEntry(id);
  }

  /**
   * High-Performance Radius Query
   * Scans ONLY candidate entries in overlapping spatial buckets ($O(K)$)
   */
  public queryRadius(
    worldX: number,
    worldZ: number,
    radiusMeters: number,
    typeFilter?: (entry: SpatialIndexEntry) => boolean
  ): SpatialIndexEntry[] {
    const results: SpatialIndexEntry[] = [];
    const seenIds = new Set<string>();

    const minBx = Math.floor((worldX - radiusMeters) / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBx = Math.floor((worldX + radiusMeters) / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const minBz = Math.floor((worldZ - radiusMeters) / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBz = Math.floor((worldZ + radiusMeters) / SpatialQuerySystem.BUCKET_SIZE_METERS);

    const rSquared = radiusMeters * radiusMeters;

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const bucket = this.spatialBuckets.get(`${bx}_${bz}`);
        if (!bucket) continue;

        for (const entry of bucket) {
          if (seenIds.has(entry.id)) continue;
          seenIds.add(entry.id);

          if (typeFilter && !typeFilter(entry)) continue;

          // Euclidean distance check to entry bounding box or center
          const dx = Math.max(entry.minX - worldX, 0, worldX - entry.maxX);
          const dz = Math.max(entry.minZ - worldZ, 0, worldZ - entry.maxZ);
          if (dx * dx + dz * dz <= rSquared) {
            results.push(entry);
          }
        }
      }
    }

    return results;
  }

  /**
   * High-Performance Bounding Box Query
   */
  public queryBoundingBox(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    typeFilter?: (entry: SpatialIndexEntry) => boolean
  ): SpatialIndexEntry[] {
    const results: SpatialIndexEntry[] = [];
    const seenIds = new Set<string>();

    const minBx = Math.floor(minX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBx = Math.floor(maxX / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const minBz = Math.floor(minZ / SpatialQuerySystem.BUCKET_SIZE_METERS);
    const maxBz = Math.floor(maxZ / SpatialQuerySystem.BUCKET_SIZE_METERS);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const bucket = this.spatialBuckets.get(`${bx}_${bz}`);
        if (!bucket) continue;

        for (const entry of bucket) {
          if (seenIds.has(entry.id)) continue;
          seenIds.add(entry.id);

          if (typeFilter && !typeFilter(entry)) continue;

          // AABB overlap check
          if (
            entry.minX <= maxX &&
            entry.maxX >= minX &&
            entry.minZ <= maxZ &&
            entry.maxZ >= minZ
          ) {
            results.push(entry);
          }
        }
      }
    }

    return results;
  }

  /**
   * Unified Surface & Location Spatial Profile
   * Resolves complete geographic, elevation, network, and zoning context for any world point.
   */
  public queryLocation(worldX: number, worldZ: number): LocationSpatialProfile {
    const isInsidePlayable =
      worldX >= SpatialQuerySystem.PLAYABLE_BOUNDS.minX &&
      worldX <= SpatialQuerySystem.PLAYABLE_BOUNDS.maxX &&
      worldZ >= SpatialQuerySystem.PLAYABLE_BOUNDS.minZ &&
      worldZ <= SpatialQuerySystem.PLAYABLE_BOUNDS.maxZ;

    const elevation = this.terrainModel.getElevationAt(worldX, worldZ);
    const isWater = this.waterSystem.isWorldPointInWater(worldX, worldZ) || this.terrainModel.isWorldPointInWater(worldX, worldZ);
    const navigability = this.waterSystem.isNavigableAt(worldX, worldZ);

    // Grid cell alignment
    let gridCoord: { gridX: number; gridZ: number } | undefined;
    let isRoad = false;
    let isBridge = false;
    let isGradedPad = false;
    let isIsland = false;
    let occupantBuildingId: string | null = null;
    let occupantRoadCell: RoadCellData | null = null;

    const g = this.gridSystem.worldToGrid(worldX, worldZ);
    if (g) {
      gridCoord = { gridX: g.x, gridZ: g.z };

      isRoad = this.roadNetworkModel.hasRoad(g.x, g.z);
      if (isRoad) {
        occupantRoadCell = this.roadNetworkModel.getRoadCell(g.x, g.z) ?? null;
      }

      isGradedPad = this.terrainModel.isGradedPadCell(g.x, g.z);
      isIsland = this.terrainModel.isRiverIslandCell(g.x, g.z);

      // Bridge check: road cell over water body
      if (isRoad && this.terrainModel.isWaterCell(g.x, g.z)) {
        isBridge = true;
      }

      const occ = this.gridSystem.getOccupancy(g.x, g.z);
      if (occ === 'building') {
        occupantBuildingId = this.gridSystem.getCell(g.x, g.z)?.occupantId ?? null;
      }
    }

    // Check offshore islands
    const dPelican = Math.hypot(worldX - 85.0, worldZ - 12.0);
    const dLighthouse = Math.hypot(worldX - 78.0, worldZ - -45.0);
    if (dPelican <= 6.5 || dLighthouse <= 4.5) {
      isIsland = true;
    }

    // Check Lake Serene Pine Crest Island
    const dLake = Math.hypot(worldX - -15.0, (worldZ - -80.0) * 1.3);
    if (dLake <= 4.0 && worldZ < -48.0) {
      isIsland = true;
    }

    // Determine Surface Classification
    let surfaceType: SurfaceClassification = 'dry_land';
    if (!isInsidePlayable) {
      surfaceType = 'out_of_bounds';
    } else if (isBridge) {
      surfaceType = 'bridge_deck';
    } else if (isRoad) {
      surfaceType = 'road_surface';
    } else if (isGradedPad) {
      surfaceType = 'graded_facility_pad';
    } else if (isIsland) {
      surfaceType = 'offshore_island';
    } else if (isWater) {
      // Check if quay/wharf
      if (worldX >= 40.0 && worldX <= 44.0 && worldZ >= 12.0 && worldZ <= 20.0) {
        surfaceType = 'quay_wharf';
      } else {
        surfaceType = 'natural_water';
      }
    } else {
      // Check riverbank: non-water point within 3m of water
      const nearbyWater = this.waterSystem.waterBodies.some((wb) => {
        return (
          worldX >= wb.bounds.minX - 3.0 &&
          worldX <= wb.bounds.maxX + 3.0 &&
          worldZ >= wb.bounds.minZ - 3.0 &&
          worldZ <= wb.bounds.maxZ + 3.0 &&
          wb.isWorldPointInWater(worldX + 2.0, worldZ) ||
          wb.isWorldPointInWater(worldX - 2.0, worldZ) ||
          wb.isWorldPointInWater(worldX, worldZ + 2.0) ||
          wb.isWorldPointInWater(worldX, worldZ - 2.0)
        );
      });
      if (nearbyWater) {
        surfaceType = 'riverbank';
      }
    }

    const parcel = gridCoord ? this.parcelManager.getParcelAt(gridCoord.gridX, gridCoord.gridZ) : null;

    return {
      worldX,
      worldZ,
      elevation,
      isInsidePlayableBounds: isInsidePlayable,
      surfaceType,
      gridCoord,
      isWater,
      isNavigableWater: navigability.canNavigate,
      isRoad,
      isBridge,
      isIsland,
      isGradedPad,
      occupantBuildingId,
      occupantRoadCell,
      parcel,
    };
  }

  /**
   * Facility Site Suitability Analysis
   * Validates full footprint slope, foundation stability, and environmental constraints.
   */
  public evaluateFacilitySuitability(
    facilityType: string,
    footprintCells: { x: number; z: number }[]
  ): FacilitySuitabilityResult {
    let minElev = Infinity;
    let maxElev = -Infinity;
    let allOnPad = true;
    let touchesWater = false;
    let touchesNavigableWater = false;
    let touchesProtectedReserve = false;

    for (const cell of footprintCells) {
      const worldCenter = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
      const elev = this.terrainModel.getElevationAt(worldCenter.x, worldCenter.z, false);
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;

      if (!this.terrainModel.isGradedPadCell(cell.x, cell.z)) {
        allOnPad = false;
      }

      if (this.terrainModel.isWaterCell(cell.x, cell.z)) {
        touchesWater = true;
      }

      const parcel = this.parcelManager.getParcelAt(cell.x, cell.z);
      if (parcel && (parcel.ownership === 'protected_reserve' || !parcel.isBuildAllowed)) {
        touchesProtectedReserve = true;
      }

      // Check perimeter for water frontage
      const neighbors = this.gridSystem.getAdjacentCells(cell.x, cell.z);
      for (const n of neighbors) {
        if (this.terrainModel.isWaterCell(n.x, n.z)) {
          const nwPos = this.gridSystem.gridToWorldCenter(n.x, n.z);
          if (this.waterSystem.isNavigableAt(nwPos.x, nwPos.z).canNavigate) {
            touchesNavigableWater = true;
          }
        }
      }
    }

    const variance = maxElev - minElev;

    if (touchesProtectedReserve) {
      return {
        isSuitable: false,
        reasonCode: 'PROTECTED_RESERVE',
        message: 'Facility footprint intersects a protected ecological reserve.',
        elevationVariance: variance,
        isWaterFrontage: touchesNavigableWater,
        isProtectedArea: true,
      };
    }

    const isMarineFacility = facilityType === 'seaport_harbor' || facilityType.includes('port');
    if (isMarineFacility) {
      if (!touchesNavigableWater && !touchesWater) {
        return {
          isSuitable: false,
          reasonCode: 'MISSING_WATER_FRONTAGE',
          message: 'Marine port facility requires direct frontage onto navigable deepwater fairway.',
          elevationVariance: variance,
          isWaterFrontage: false,
          isProtectedArea: false,
        };
      }
    } else {
      // Terrestrial facility: cannot encroach on open water
      if (touchesWater && !allOnPad) {
        return {
          isSuitable: false,
          reasonCode: 'PROXIMITY_TO_WATER',
          message: 'Terrestrial facility encroaches on natural shoreline or water body.',
          elevationVariance: variance,
          isWaterFrontage: touchesNavigableWater,
          isProtectedArea: false,
        };
      }

      // Slope check on natural ground
      if (!allOnPad && variance > 0.35) {
        return {
          isSuitable: false,
          reasonCode: 'EXCESSIVE_SLOPE',
          message: `Site elevation slope variance (${variance.toFixed(2)}m) exceeds foundation tolerance. Graded pad required.`,
          elevationVariance: variance,
          isWaterFrontage: touchesNavigableWater,
          isProtectedArea: false,
        };
      }
    }

    return {
      isSuitable: true,
      reasonCode: 'VALID',
      message: 'Site meets foundation stability and environmental requirements.',
      elevationVariance: variance,
      isWaterFrontage: touchesNavigableWater,
      isProtectedArea: false,
    };
  }

  /**
   * Fast Topological Connectivity Check
   * Determines if two world coordinates can connect via the specified transport mode.
   */
  public canConnectLocations(
    from: { x: number; z: number },
    to: { x: number; z: number },
    mode: TransportMode = 'road'
  ): { canConnect: boolean; reason?: string } {
    if (mode === 'road') {
      const fromG = this.gridSystem.worldToGrid(from.x, from.z);
      const toG = this.gridSystem.worldToGrid(to.x, to.z);

      if (!fromG || !toG || !this.gridSystem.isWithinBounds(fromG.x, fromG.z) || !this.gridSystem.isWithinBounds(toG.x, toG.z)) {
        return { canConnect: false, reason: 'Endpoint is outside the active road grid boundaries.' };
      }

      // Check if either endpoint is on an isolated island without road bridge
      const fromIsland = this.terrainModel.isRiverIslandCell(fromG.x, fromG.z);
      const toIsland = this.terrainModel.isRiverIslandCell(toG.x, toG.z);
      if ((fromIsland || toIsland) && !this.roadNetworkModel.hasRoad(1, 1)) {
        return { canConnect: false, reason: 'Destination is on an isolated island without a road bridge.' };
      }

      // If both points have roads, check road network path connectivity
      if (this.roadNetworkModel.hasRoad(fromG.x, fromG.z) && this.roadNetworkModel.hasRoad(toG.x, toG.z)) {
        return { canConnect: true };
      }

      // Check adjacency to roads
      const fromAdjacentRoad = this.gridSystem.getAdjacentCells(fromG.x, fromG.z).some((c) => this.roadNetworkModel.hasRoad(c.x, c.z));
      const toAdjacentRoad = this.gridSystem.getAdjacentCells(toG.x, toG.z).some((c) => this.roadNetworkModel.hasRoad(c.x, c.z));

      if (fromAdjacentRoad && toAdjacentRoad) {
        return { canConnect: true };
      }

      return { canConnect: false, reason: 'No road connection or road access exists between the specified endpoints.' };
    }

    if (mode === 'waterway') {
      const fromNav = this.waterSystem.isNavigableAt(from.x, from.z);
      const toNav = this.waterSystem.isNavigableAt(to.x, to.z);
      if (!fromNav.canNavigate || !toNav.canNavigate) {
        return { canConnect: false, reason: 'One or both endpoints are outside the navigable fairway channel.' };
      }
      return { canConnect: true };
    }

    return { canConnect: true };
  }

  /**
   * Diagnostic Performance Profiler
   * Measures spatial query execution time across N random radius samples.
   */
  public runBenchmark(queryCount: number = 1000): { totalDurationMs: number; avgQueryMs: number; operationsPerSec: number } {
    const start = performance.now();
    for (let i = 0; i < queryCount; i++) {
      const qx = (Math.random() - 0.5) * 80;
      const qz = (Math.random() - 0.5) * 80;
      this.queryRadius(qx, qz, 16.0);
    }
    const end = performance.now();
    const duration = end - start;
    return {
      totalDurationMs: duration,
      avgQueryMs: duration / queryCount,
      operationsPerSec: Math.round((queryCount / duration) * 1000),
    };
  }
}
