import { RoadTypeId, RoadHierarchyClass } from './roadDefinitions';

/**
 * Authoritative Centralized Road Specification System
 * Global Transport Empire — Civil Engineering & Highway Architecture
 *
 * Defines complete geometric, functional, and operational standards for every road class:
 * - Total road width & pavement dimensions
 * - Lane count & individual lane widths
 * - Median & divider specifications
 * - Shoulder, curb, and sidewalk dimensions
 * - Elevation & overhead structural clearance limits (AASHTO / FHWA standards)
 * - Turning radius & design vehicle envelopes
 * - Speed limits & vehicle restrictions
 */

export interface RoadGeometricProfile {
  roadTypeId: RoadTypeId;
  name: string;
  hierarchyClass: RoadHierarchyClass;
  totalPavementWidthMeters: number;
  laneCount: number;
  lanesPerDirection: number;
  laneWidthMeters: number;
  medianWidthMeters: number;
  hasPhysicalDivider: boolean;
  dividerType: 'none' | 'jersey_barrier' | 'double_yellow_strip' | 'curb_island';
  shoulderWidthMeters: number;
  sidewalkWidthMeters: number;
  curbHeightMeters: number;
  verticalClearanceMeters: number; // Minimum overhead structure clearance
  minTurningRadiusMeters: number; // Minimum inside curve radius
  designSpeedKmh: number;
  speedLimitKmh: number;
  supportedVehicles: ('courier' | 'rigid_truck' | 'prime_mover' | 'semi_trailer' | 'heavy_haul')[];
  surfaceMaterialKey: string;
  markingProfile: {
    centerLine: 'none' | 'dashed_white' | 'double_yellow' | 'jersey_barrier';
    laneDivider: 'none' | 'dashed_white';
    edgeLine: 'none' | 'solid_white' | 'solid_yellow';
    crosswalkSupported: boolean;
    turnArrowsSupported: boolean;
  };
}

export const ROAD_SPECIFICATIONS: Record<RoadTypeId, RoadGeometricProfile> = {
  two_lane_urban: {
    roadTypeId: 'two_lane_urban',
    name: 'Municipal Local Street',
    hierarchyClass: 'local',
    totalPavementWidthMeters: 4.0,
    laneCount: 2,
    lanesPerDirection: 1,
    laneWidthMeters: 1.65,
    medianWidthMeters: 0.1,
    hasPhysicalDivider: false,
    dividerType: 'none',
    shoulderWidthMeters: 0.25,
    sidewalkWidthMeters: 0.55,
    curbHeightMeters: 0.07,
    verticalClearanceMeters: 4.8,
    minTurningRadiusMeters: 4.0,
    designSpeedKmh: 50,
    speedLimitKmh: 50,
    supportedVehicles: ['courier', 'rigid_truck', 'prime_mover', 'semi_trailer'],
    surfaceMaterialKey: 'road_local_asphalt',
    markingProfile: {
      centerLine: 'dashed_white',
      laneDivider: 'none',
      edgeLine: 'solid_white',
      crosswalkSupported: true,
      turnArrowsSupported: false,
    },
  },

  heavy_arterial: {
    roadTypeId: 'heavy_arterial',
    name: 'Heavy Freight Arterial Avenue',
    hierarchyClass: 'arterial',
    totalPavementWidthMeters: 4.0,
    laneCount: 2,
    lanesPerDirection: 1,
    laneWidthMeters: 1.75,
    medianWidthMeters: 0.2,
    hasPhysicalDivider: false,
    dividerType: 'double_yellow_strip',
    shoulderWidthMeters: 0.35,
    sidewalkWidthMeters: 0.45,
    curbHeightMeters: 0.08,
    verticalClearanceMeters: 5.2,
    minTurningRadiusMeters: 6.0,
    designSpeedKmh: 80,
    speedLimitKmh: 75,
    supportedVehicles: ['courier', 'rigid_truck', 'prime_mover', 'semi_trailer', 'heavy_haul'],
    surfaceMaterialKey: 'road_arterial_asphalt',
    markingProfile: {
      centerLine: 'double_yellow',
      laneDivider: 'none',
      edgeLine: 'solid_white',
      crosswalkSupported: true,
      turnArrowsSupported: true,
    },
  },

  highway_corridor: {
    roadTypeId: 'highway_corridor',
    name: 'Four-Lane Divided Regional Highway',
    hierarchyClass: 'highway',
    totalPavementWidthMeters: 4.0,
    laneCount: 4,
    lanesPerDirection: 2,
    laneWidthMeters: 0.86, // 2 clearly defined travel lanes per direction within 4m carriageway
    medianWidthMeters: 0.20,
    hasPhysicalDivider: true,
    dividerType: 'jersey_barrier',
    shoulderWidthMeters: 0.22,
    sidewalkWidthMeters: 0.0, // Highways do not use urban sidewalks
    curbHeightMeters: 0.0,
    verticalClearanceMeters: 5.6, // High truck clearance for viaducts & gantries
    minTurningRadiusMeters: 12.0,
    designSpeedKmh: 120,
    speedLimitKmh: 110,
    supportedVehicles: ['courier', 'rigid_truck', 'prime_mover', 'semi_trailer', 'heavy_haul'],
    surfaceMaterialKey: 'road_highway_asphalt',
    markingProfile: {
      centerLine: 'jersey_barrier',
      laneDivider: 'dashed_white',
      edgeLine: 'solid_white',
      crosswalkSupported: false,
      turnArrowsSupported: true,
    },
  },

  highway_ramp: {
    roadTypeId: 'highway_ramp',
    name: 'Interchange Connecting Ramp',
    hierarchyClass: 'highway',
    totalPavementWidthMeters: 4.0,
    laneCount: 1,
    lanesPerDirection: 1,
    laneWidthMeters: 2.8,
    medianWidthMeters: 0.0,
    hasPhysicalDivider: false,
    dividerType: 'none',
    shoulderWidthMeters: 0.6,
    sidewalkWidthMeters: 0.0,
    curbHeightMeters: 0.0,
    verticalClearanceMeters: 5.4,
    minTurningRadiusMeters: 8.0,
    designSpeedKmh: 65,
    speedLimitKmh: 60,
    supportedVehicles: ['courier', 'rigid_truck', 'prime_mover', 'semi_trailer', 'heavy_haul'],
    surfaceMaterialKey: 'road_arterial_asphalt',
    markingProfile: {
      centerLine: 'none',
      laneDivider: 'none',
      edgeLine: 'solid_yellow',
      crosswalkSupported: false,
      turnArrowsSupported: false,
    },
  },

  industrial_access: {
    roadTypeId: 'industrial_access',
    name: 'Industrial Logistics Access Track',
    hierarchyClass: 'local',
    totalPavementWidthMeters: 4.0,
    laneCount: 2,
    lanesPerDirection: 1,
    laneWidthMeters: 1.85,
    medianWidthMeters: 0.0,
    hasPhysicalDivider: false,
    dividerType: 'none',
    shoulderWidthMeters: 0.15,
    sidewalkWidthMeters: 0.0,
    curbHeightMeters: 0.0,
    verticalClearanceMeters: 5.0,
    minTurningRadiusMeters: 5.0,
    designSpeedKmh: 40,
    speedLimitKmh: 35,
    supportedVehicles: ['courier', 'rigid_truck', 'prime_mover', 'semi_trailer', 'heavy_haul'],
    surfaceMaterialKey: 'road_industrial_pavement',
    markingProfile: {
      centerLine: 'none',
      laneDivider: 'none',
      edgeLine: 'none',
      crosswalkSupported: false,
      turnArrowsSupported: false,
    },
  },
};

/**
 * Helper to retrieve road profile by type
 */
export function getRoadSpecification(roadTypeId: RoadTypeId): RoadGeometricProfile {
  return ROAD_SPECIFICATIONS[roadTypeId] ?? ROAD_SPECIFICATIONS.two_lane_urban;
}

/**
 * Validates vehicle clearance for a given road type
 */
export function canVehicleTraverseRoad(
  roadTypeId: RoadTypeId,
  vehicleClass: 'courier' | 'rigid_truck' | 'prime_mover' | 'semi_trailer' | 'heavy_haul'
): boolean {
  const spec = getRoadSpecification(roadTypeId);
  return spec.supportedVehicles.includes(vehicleClass);
}
