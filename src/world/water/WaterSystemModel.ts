export type WaterBodyType =
  | 'retention_basin'
  | 'river'
  | 'coastal_fairway'
  | 'port_berth'
  | 'canal';

export type SalinityType = 'freshwater' | 'brackish' | 'marine';

export interface NavigationalBuoy {
  id: string;
  type: 'starboard' | 'port' | 'cardinal' | 'isolated_danger';
  worldX: number;
  worldZ: number;
  lightColor: number;
  flashPeriodSeconds: number;
}

export interface NavigableChannelWaypoint {
  x: number;
  y: number;
  z: number;
  name: string;
  targetSpeedKnots: number;
}

export interface NavigableChannel {
  id: string;
  name: string;
  channelType: 'deepwater_shipping' | 'inland_river' | 'harbor_turning_basin';
  isNavigable: boolean;
  minDepthMeters: number;
  maxDraftMeters: number;
  maxBeamMeters: number;
  maxVesselLengthMeters: number;
  nominalWidthMeters: number;
  speedLimitKnots: number;
  centerlineWaypoints: NavigableChannelWaypoint[];
  buoyMarkers: NavigationalBuoy[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface BridgePier {
  worldX: number;
  worldZ: number;
  width: number;
  depth: number;
  footingElevation: number;
}

export interface BridgeCrossing {
  id: string;
  name: string;
  crossingType: 'road' | 'rail' | 'pedestrian';
  deckElevation: number; // e.g. +0.80m
  deckUndersideElevation: number; // e.g. +0.55m
  waterSurfaceElevation: number; // -0.15m
  verticalClearanceMeters: number; // deckUnderside - waterSurface (e.g. 0.70m >= 0.65m)
  spanLengthMeters: number;
  piers: BridgePier[];
  startCoord: { gridX: number; gridZ: number };
  endCoord: { gridX: number; gridZ: number };
}

export interface PortQuayBerth {
  id: string;
  name: string;
  wharfFrontageLengthMeters: number;
  berthDepthMeters: number;
  maxDWT: number; // deadweight tonnage capacity
  bollardPositions: { x: number; y: number; z: number }[];
  fenderPositions: { x: number; y: number; z: number }[];
  quayWallBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface WaterBody {
  id: string;
  name: string;
  bodyType: WaterBodyType;
  surfaceElevation: number; // -0.15m
  bedElevation: number; // e.g. -0.45m or -3.5m
  depthMeters: number; // surfaceElevation - bedElevation
  isNavigable: boolean;
  maxVesselDraftMeters: number;
  speedLimitKnots: number;
  waterColorHex: number;
  salinityType: SalinityType;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  isGridCellInWater(gridX: number, gridZ: number): boolean;
  isWorldPointInWater(worldX: number, worldZ: number): boolean;
}

export class WaterSystemModel {
  public static readonly STANDARD_WATER_SURFACE_DATUM = -0.15;
  public static readonly MINIMUM_BRIDGE_CLEARANCE_METERS = 0.65;
  public static readonly DEEPWATER_PORT_MIN_DEPTH_METERS = 3.0;

  public readonly waterBodies: WaterBody[] = [];
  public readonly navigableChannels: NavigableChannel[] = [];
  public readonly bridgeCrossings: BridgeCrossing[] = [];
  public readonly portBerths: PortQuayBerth[] = [];

  constructor() {
    this.initializeAuthoritativeWaterways();
  }

  private initializeAuthoritativeWaterways(): void {
    // 1. Southeast Civil Stormwater Retention Basin
    this.waterBodies.push({
      id: 'water_retention_pond',
      name: 'South-East Stormwater Retention Basin',
      bodyType: 'retention_basin',
      surfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      bedElevation: -0.45,
      depthMeters: 0.30,
      isNavigable: false,
      maxVesselDraftMeters: 0.0,
      speedLimitKnots: 0,
      waterColorHex: 0x0284c7,
      salinityType: 'freshwater',
      bounds: { minX: 34.0, maxX: 42.0, minZ: 26.0, maxZ: 34.0 },
      isGridCellInWater: (gx, gz) => gx >= 20 && gx <= 22 && gz >= 18 && gz <= 20,
      isWorldPointInWater: (wx, wz) => {
        const dx = wx - 38.0;
        const dz = wz - 30.0;
        return dx * dx + dz * dz <= 2.8 * 2.8;
      },
    });

    // 2. Northwest Scenic Mountain River Corridor
    this.waterBodies.push({
      id: 'water_northwest_river',
      name: 'Northwest Mountain River Corridor',
      bodyType: 'river',
      surfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      bedElevation: -0.45,
      depthMeters: 0.30,
      isNavigable: false, // Shallow recreational draft only, non-commercial
      maxVesselDraftMeters: 0.25,
      speedLimitKnots: 5,
      waterColorHex: 0x0369a1,
      salinityType: 'freshwater',
      bounds: { minX: -48.0, maxX: -40.0, minZ: -48.0, maxZ: -36.0 },
      isGridCellInWater: (gx, gz) => {
        if (gx === 1 && gz === 1) return false; // Natural River Island
        if (gx === 0 && gz <= 2) return true; // Main channel
        if (gx === 1 && gz === 0) return true; // Northern bend
        return false;
      },
      isWorldPointInWater: (wx, wz) => {
        if (wx < -48.0 || wx > -40.1 || wz < -48.0 || wz > -36.0) return false;
        // River island clearance
        if (wx >= -44.0 && wz >= -44.0) return false;
        return true;
      },
    });

    // 3. Eastern Maritime Deepwater Seaway & Port Berthing Basin
    // Covers seaward coastal waters along eastern edge
    this.waterBodies.push({
      id: 'water_eastern_coastal',
      name: 'Eastern Maritime Deepwater Seaway & Port Basin',
      bodyType: 'coastal_fairway',
      surfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      bedElevation: -3.5,
      depthMeters: 3.35,
      isNavigable: true, // Commercial ocean freight vessels & coastal barges
      maxVesselDraftMeters: 3.0,
      speedLimitKnots: 12,
      waterColorHex: 0x0c4a6e,
      salinityType: 'marine',
      bounds: { minX: 42.0, maxX: 64.0, minZ: 0.0, maxZ: 32.0 },
      isGridCellInWater: (gx, gz) => {
        // Seaward coastal cell column at the outer eastern flank (gridX=23, gridZ=4..10 and 17..23)
        // Leaving wharf pad at gridX=22..23, gridZ=13..16 dry with quay wall along seaward face
        return false; // Handled as coastal margin beyond terrestrial boundary
      },
      isWorldPointInWater: (wx, wz) => {
        // Deep water margin beyond eastern terminal wall (wx >= 43.5m and wz between 2m and 30m)
        return wx >= 43.5 && wz >= 2.0 && wz <= 30.0;
      },
    });

    // 4. Navigable Commercial Fairway Channel
    this.navigableChannels.push({
      id: 'channel_eastern_coastal',
      name: 'Eastern Continental Deepwater Fairway',
      channelType: 'deepwater_shipping',
      isNavigable: true,
      minDepthMeters: 3.35,
      maxDraftMeters: 3.0,
      maxBeamMeters: 8.0,
      maxVesselLengthMeters: 45.0,
      nominalWidthMeters: 14.0,
      speedLimitKnots: 12,
      centerlineWaypoints: [
        { x: 45.5, y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, z: 28.0, name: 'Outer Fairway Entry', targetSpeedKnots: 12 },
        { x: 45.5, y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, z: 18.0, name: 'Port Approach Fairway', targetSpeedKnots: 8 },
        { x: 44.5, y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, z: 14.5, name: 'Terminal Berth Turning Basin', targetSpeedKnots: 4 },
        { x: 45.5, y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, z: 10.0, name: 'Northbound Departure Lane', targetSpeedKnots: 8 },
        { x: 45.5, y: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, z: 4.0, name: 'Open Seaway Gateway', targetSpeedKnots: 12 },
      ],
      buoyMarkers: [
        { id: 'buoy_starboard_south', type: 'starboard', worldX: 48.0, worldZ: 24.0, lightColor: 0x22c55e, flashPeriodSeconds: 4.0 },
        { id: 'buoy_port_south', type: 'port', worldX: 43.0, worldZ: 24.0, lightColor: 0xef4444, flashPeriodSeconds: 4.0 },
        { id: 'buoy_starboard_north', type: 'starboard', worldX: 48.0, worldZ: 8.0, lightColor: 0x22c55e, flashPeriodSeconds: 4.0 },
        { id: 'buoy_port_north', type: 'port', worldX: 43.0, worldZ: 8.0, lightColor: 0xef4444, flashPeriodSeconds: 4.0 },
      ],
      bounds: { minX: 42.0, maxX: 50.0, minZ: 2.0, maxZ: 30.0 },
    });

    // 5. Eastern Port Quay Berth Infrastructure
    this.portBerths.push({
      id: 'berth_eastern_deepwater_01',
      name: 'Eastern Deepwater Port Berth #1',
      wharfFrontageLengthMeters: 16.0,
      berthDepthMeters: 3.35,
      maxDWT: 12500,
      bollardPositions: [
        { x: 42.2, y: 0.02, z: 13.5 },
        { x: 42.2, y: 0.02, z: 14.5 },
        { x: 42.2, y: 0.02, z: 15.5 },
        { x: 42.2, y: 0.02, z: 16.5 },
      ],
      fenderPositions: [
        { x: 42.4, y: -0.05, z: 13.8 },
        { x: 42.4, y: -0.05, z: 14.8 },
        { x: 42.4, y: -0.05, z: 15.8 },
      ],
      quayWallBounds: { minX: 42.0, maxX: 42.6, minZ: 13.0, maxZ: 17.0 },
    });

    // 6. Architectural Bridge Crossing Specification (Northern Trans-River Bridge)
    this.bridgeCrossings.push({
      id: 'bridge_river_crossing_alpha',
      name: 'Northern River Arterial Bridge',
      crossingType: 'road',
      deckElevation: 0.80,
      deckUndersideElevation: 0.55,
      waterSurfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      verticalClearanceMeters: 0.55 - WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, // 0.70m >= 0.65m
      spanLengthMeters: 8.0,
      piers: [
        { worldX: -44.0, worldZ: -46.0, width: 0.8, depth: 0.8, footingElevation: -0.45 },
        { worldX: -44.0, worldZ: -38.0, width: 0.8, depth: 0.8, footingElevation: -0.45 },
      ],
      startCoord: { gridX: 0, gridZ: 3 },
      endCoord: { gridX: 0, gridZ: 0 },
    });

    // 7. Eastern Coastal Seaway Highway Viaduct (Transcontinental I-1 Causeway Bridge)
    this.bridgeCrossings.push({
      id: 'bridge_highway_eastern_seaway',
      name: 'Grand Harbor Interstate Highway Viaduct',
      crossingType: 'road',
      deckElevation: 1.20,
      deckUndersideElevation: 0.95,
      waterSurfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      verticalClearanceMeters: 0.95 - WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, // 1.10m >= 0.65m
      spanLengthMeters: 16.0,
      piers: [
        { worldX: 124.0, worldZ: -2.0, width: 1.2, depth: 1.2, footingElevation: -3.5 },
        { worldX: 132.0, worldZ: -2.0, width: 1.2, depth: 1.2, footingElevation: -3.5 },
      ],
      startCoord: { gridX: 42, gridZ: 11 },
      endCoord: { gridX: 46, gridZ: 11 },
    });

    // 8. Southern Delta Regional Highway Bridge (Delta Boulevard Crossing)
    this.bridgeCrossings.push({
      id: 'bridge_delta_river_crossing',
      name: 'Delta Regional Highway Crossing Bridge',
      crossingType: 'road',
      deckElevation: 0.85,
      deckUndersideElevation: 0.60,
      waterSurfaceElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      verticalClearanceMeters: 0.60 - WaterSystemModel.STANDARD_WATER_SURFACE_DATUM, // 0.75m >= 0.65m
      spanLengthMeters: 16.0,
      piers: [
        { worldX: 84.0, worldZ: 98.0, width: 1.0, depth: 1.0, footingElevation: -0.45 },
        { worldX: 92.0, worldZ: 98.0, width: 1.0, depth: 1.0, footingElevation: -0.45 },
      ],
      startCoord: { gridX: 32, gridZ: 36 },
      endCoord: { gridX: 36, gridZ: 36 },
    });
  }

  /**
   * Retrieves the water body containing a world coordinate
   */
  public getWaterBodyAt(worldX: number, worldZ: number): WaterBody | null {
    for (const wb of this.waterBodies) {
      if (wb.isWorldPointInWater(worldX, worldZ)) {
        return wb;
      }
    }
    return null;
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
   * Evaluates navigation feasibility for a vessel with specified draft and beam
   */
  public isNavigableAt(
    worldX: number,
    worldZ: number,
    vesselDraftMeters: number = 2.0
  ): { canNavigate: boolean; reason?: string; channel?: NavigableChannel } {
    // Check if within any charted navigable channel
    const channel = this.navigableChannels.find(
      (c) =>
        c.isNavigable &&
        worldX >= c.bounds.minX &&
        worldX <= c.bounds.maxX &&
        worldZ >= c.bounds.minZ &&
        worldZ <= c.bounds.maxZ
    );

    if (!channel) {
      const waterBody = this.getWaterBodyAt(worldX, worldZ);
      if (!waterBody) {
        return { canNavigate: false, reason: 'Coordinates are on dry land, not on water.' };
      }
      if (!waterBody.isNavigable) {
        return {
          canNavigate: false,
          reason: `Water body '${waterBody.name}' is non-navigable (type: ${waterBody.bodyType}).`,
        };
      }
      if (vesselDraftMeters > waterBody.maxVesselDraftMeters) {
        return {
          canNavigate: false,
          reason: `Vessel draft (${vesselDraftMeters}m) exceeds water body limit (${waterBody.maxVesselDraftMeters}m).`,
        };
      }
      return { canNavigate: true };
    }

    if (vesselDraftMeters > channel.maxDraftMeters) {
      return {
        canNavigate: false,
        reason: `Vessel draft (${vesselDraftMeters}m) exceeds fairway authorized draft (${channel.maxDraftMeters}m).`,
        channel,
      };
    }

    return { canNavigate: true, channel };
  }

  /**
   * Finds the nearest navigable waypoint for fairway guidance
   */
  public getNearestChannelWaypoint(
    worldX: number,
    worldZ: number
  ): { waypoint: NavigableChannelWaypoint; distance: number; channel: NavigableChannel } | null {
    let bestMatch: { waypoint: NavigableChannelWaypoint; distance: number; channel: NavigableChannel } | null = null;
    let minDistance = Infinity;

    for (const channel of this.navigableChannels) {
      for (const wp of channel.centerlineWaypoints) {
        const dx = wp.x - worldX;
        const dz = wp.z - worldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = { waypoint: wp, distance: dist, channel };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Validates bridge clearance against high water datum
   */
  public validateBridgeClearance(bridge: BridgeCrossing): {
    isValid: boolean;
    clearanceMeters: number;
    error?: string;
  } {
    const clearance = bridge.deckUndersideElevation - bridge.waterSurfaceElevation;
    if (clearance < WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS) {
      return {
        isValid: false,
        clearanceMeters: clearance,
        error: `Bridge clearance (${clearance.toFixed(2)}m) is below statutory minimum (${WaterSystemModel.MINIMUM_BRIDGE_CLEARANCE_METERS}m).`,
      };
    }
    return {
      isValid: true,
      clearanceMeters: clearance,
    };
  }

  /**
   * Serializes authoritative water system state for save/load persistence
   */
  public serialize(): object {
    return {
      waterBodiesCount: this.waterBodies.length,
      channelsCount: this.navigableChannels.length,
      datumElevation: WaterSystemModel.STANDARD_WATER_SURFACE_DATUM,
      portBerths: this.portBerths.map((b) => ({ id: b.id, name: b.name, depth: b.berthDepthMeters })),
      bridgeCrossings: this.bridgeCrossings.map((bc) => ({ id: bc.id, clearance: bc.verticalClearanceMeters })),
    };
  }
}
