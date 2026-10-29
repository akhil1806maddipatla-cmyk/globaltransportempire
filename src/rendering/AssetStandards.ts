/**
 * Unified 3D Asset Standards & Specification Registry
 * Global Transport Empire - Phase 1, Prompt 12 of 80
 * 
 * Formalizes shared dimensional, kinematic, material, coordinate, and pivot conventions
 * for all road vehicles, facilities, civil infrastructure, and future multi-modal expansions.
 */

export interface BoundingBoxEnvelope {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface MaterialPBRSpecification {
  readonly materialClass: string;
  readonly minRoughness: number;
  readonly maxRoughness: number;
  readonly minMetalness: number;
  readonly maxMetalness: number;
  readonly requiresDoubleSided?: boolean;
  readonly isTransparent?: boolean;
}

export const ASSET_STANDARDS = {
  // 1. Authoritative Coordinate Conventions
  coordinates: {
    unitDefinition: '1 World Unit = 1.0 Metre (SI Metric Standard)',
    verticalAxis: '+Y (Upward)',
    groundContactPlaneY: 0.0,
    forwardHeadingAxis: '+Z (Forward movement direction)',
    lateralAxis: '+X (Right / Starboard; -X = Left / Port)',
    gridCellSizeMeters: 4.0,
    laneWidthRangeMeters: { min: 3.2, standard: 3.5, arterial: 4.0, highway: 4.2 },
  },

  // 2. Pivot & Origin Conventions
  pivots: {
    // Stationary world entities (Buildings, Depots, Infrastructure, Props)
    buildingOrigin: 'Footprint grid origin at ground level (Y = 0.0). Local geometry offsets from (0, 0, 0)',
    // Road vehicles (Tractors, Box Trucks)
    vehicleOrigin: 'Ground plane center at Y = 0.0. Lowest tire tread contacts exactly Y = 0.0',
    fifthWheelHeightY: 1.15, // Standard commercial tractor fifth-wheel top surface height in metres
    // Semi-trailers
    trailerKingpinHeightY: 1.15, // Underside of trailer front bolster plate seating plane
    trailerChassisPlatformHeightY: 1.45, // Container bolster twistlock seating plane
    // ISO shipping containers
    containerTwistlockMountY: 0.0, // Bottom corner castings rest flush on trailer bolster plane (Y = 1.45m)
  },

  // 3. Dimensional Envelopes & Strict Clearances
  envelopes: {
    // Road vehicles must strictly fit within single-lane bounds
    roadVehicles: {
      maxVehicleWidthExcludingMirrors: 2.6, // EU / US legal highway vehicle width (2.5m standard + 0.1m tolerance)
      maxMirrorProjectionPerSide: 0.25, // Regulated side mirror arm projection
      maxTotalWidthWithMirrors: 3.0, // Absolute maximum lateral width envelope
      maxSingleRigidHeight: 4.2, // Standard maximum bridge clearance height
      maxHighCubeTrailerHeight: 4.15, // High-cube 40ft container on gooseneck chassis
    },
    // Level 1 Starter Fleet Truck Depot
    level1Depot: {
      designatedSpacesCount: 3, // Mandatory Level 1 invariant
      bayLengthMeters: 10.2, // Accommodates prime mover + 40ft trailer combination
      bayWidthMeters: 3.6, // Provides 1.1m safe driver egress clearance between 2.5m vehicles
      overheadCanopyClearanceY: 5.4, // Unrestricted clearance for 4.2m high-cube commercial rigs
      entranceClearanceWidth: 4.0, // Minimum approach apron width from spur road
    },
    // Travel Lanes
    travelLanes: {
      urbanLaneWidth: 4.0, // 4.0m cell envelope with 3.5m asphalt + 0.25m curbs each side
      arterialLaneWidth: 4.8, // 4.8m paved freight avenue with dual yellow centerline
      highwayLaneWidth: 5.4, // 5.4m divided interstate corridor with steel guardrails
    },
  },

  // 4. Physical Material (PBR) Specifications
  materialPBRStandards: {
    asphalt: {
      materialClass: 'Civil Road Surface',
      minRoughness: 0.65,
      maxRoughness: 0.90,
      minMetalness: 0.02,
      maxMetalness: 0.22,
    },
    roadMarkings: {
      materialClass: 'Thermoplastic Pavement Markings',
      minRoughness: 0.40,
      maxRoughness: 0.60,
      minMetalness: 0.00,
      maxMetalness: 0.05,
    },
    concrete: {
      materialClass: 'Reinforced Concrete & Staging Apron',
      minRoughness: 0.70,
      maxRoughness: 0.90,
      minMetalness: 0.02,
      maxMetalness: 0.15,
    },
    vehiclePaint: {
      materialClass: 'Automotive Enamel & Fleet Livery',
      minRoughness: 0.25,
      maxRoughness: 0.45,
      minMetalness: 0.35,
      maxMetalness: 0.60,
    },
    glass: {
      materialClass: 'Laminated Architectural & Automotive Glazing',
      minRoughness: 0.05,
      maxRoughness: 0.20,
      minMetalness: 0.70,
      maxMetalness: 0.98,
      isTransparent: true,
    },
    tireRubber: {
      materialClass: 'Vulcanized Commercial Tire Tread',
      minRoughness: 0.85,
      maxRoughness: 0.98,
      minMetalness: 0.01,
      maxMetalness: 0.08,
    },
    structuralSteel: {
      materialClass: 'Galvanized / Painted Structural Steel & Chassis',
      minRoughness: 0.25,
      maxRoughness: 0.60,
      minMetalness: 0.75,
      maxMetalness: 0.95,
    },
    chrome: {
      materialClass: 'Machined Polished Aluminum & Chrome Trim',
      minRoughness: 0.08,
      maxRoughness: 0.25,
      minMetalness: 0.88,
      maxMetalness: 0.98,
    },
    corrugatedContainer: {
      materialClass: 'Corten Steel Corrugated Shipping Container',
      minRoughness: 0.38,
      maxRoughness: 0.55,
      minMetalness: 0.28,
      maxMetalness: 0.45,
    },
  } as Record<string, MaterialPBRSpecification>,

  // 5. Texture Specifications
  textures: {
    colorSpace: 'sRGB (THREE.SRGBColorSpace)',
    wrapMode: 'RepeatWrapping (THREE.RepeatWrapping)',
    filterMode: 'LinearMipmapLinearFilter (THREE.LinearMipmapLinearFilter)',
    resolutionTiers: {
      highHero: 512, // Road asphalt grit, intermodal containers, vehicle tire tread
      mediumStandard: 256, // Concrete yard, wall masonry, grass, retaining walls
      lowUtility: 128, // Conspicuity tape, hazard chevrons, roll-up doors
    },
  },

  // 6. Multi-Modal Expansion Standards (Future Rail, Air, and Maritime Compatibility)
  futureExpansions: {
    railway: {
      mode: 'Heavy Freight Rail',
      standardTrackGaugeMeters: 1.435, // UIC / AAR standard gauge
      locomotiveEnvelope: { length: 21.8, width: 3.1, height: 4.75 },
      intermodalWellCarEnvelope: { length: 20.5, width: 3.2, height: 6.1 }, // Double-stack container clear
      platformClearanceOffset: 1.75, // Center-of-track to passenger/cargo platform edge
    },
    aviation: {
      mode: 'Air Freight & Logistics',
      cargoTurbopropEnvelope: { wingspan: 28.5, length: 27.2, tailHeight: 8.5 },
      runwayStripWidthMeters: 45.0, // ICAO Code 4 runway width
      taxiwayWidthMeters: 23.0,
      hangarClearanceHeightY: 10.5,
    },
    maritime: {
      mode: 'Maritime Port & Intermodal Logistics',
      feederContainerVessel: { length: 125.0, beam: 21.5, heightAirDraft: 28.0, waterDraft: 7.5 },
      berthApronWidthMeters: 32.0,
      quaysideGantryCraneClearanceHeightY: 34.0,
    },
  },
} as const;
