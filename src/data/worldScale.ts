/**
 * Authoritative World-Scale & Spatial Dimensional Standards
 * Global Transport Empire - Spatial Reference & Validation System
 * 
 * Units: 1.0 World Unit = 1.0 Metre (SI Metric Standard)
 * Grid: 1 Grid Cell = 4.0 Metres x 4.0 Metres
 */

export interface ModeScaleStandard {
  category: string;
  unitDefinition: string;
  standards: Record<string, {
    name: string;
    nominalDimensions: { length: number; width: number; height: number };
    clearanceRequirement?: { lateral: number; vertical: number };
    notes: string;
  }>;
}

export const WORLD_SCALE_STANDARDS = {
  // Coordinate & Metric conventions
  conventions: {
    worldUnitToMeters: 1.0,
    verticalAxis: '+Y (Up)',
    forwardAxis: '+Z (Heading)',
    lateralAxis: '+X (Port/Starboard or Left/Right)',
    gridCellSizeMeters: 4.0,
    coordinateOrigin: 'Ground plane center (0, 0, 0)',
    wheelGroundContactPlaneY: 0.0,
    fifthWheelCouplingHeightY: 1.15,
  },

  // 1. Road Vehicles & Freight Haulage (AASHTO / EU Directive 96/53/EC)
  roadVehicles: {
    category: 'Road Freight Vehicles',
    unitDefinition: 'Meters (m)',
    standards: {
      heavyPrimeMover6x4: {
        name: 'Class 8 Heavy Prime Mover (6x4)',
        nominalDimensions: { length: 6.8, width: 2.5, height: 3.85 },
        clearanceRequirement: { lateral: 0.5, vertical: 0.6 },
        wheelbase: 3.8,
        turningRadiusMeters: 11.2,
        fifthWheelHeight: 1.15,
        notes: 'Standard interstate prime mover tractor unit with sleeper cab, tandem drive bogie, and fifth-wheel plate.',
      },
      courierCarrier4x2: {
        name: 'Medium Freight Carrier (4x2)',
        nominalDimensions: { length: 5.6, width: 2.4, height: 3.3 },
        clearanceRequirement: { lateral: 0.5, vertical: 0.6 },
        wheelbase: 3.2,
        turningRadiusMeters: 9.4,
        fifthWheelHeight: 1.1,
        notes: 'Urban distribution prime mover for metro shuttling and cross-dock operations.',
      },
      skeletalTrailer40ft: {
        name: '40ft Skeletal Container Chassis',
        nominalDimensions: { length: 12.5, width: 2.5, height: 1.45 }, // Empty chassis height
        loadedHeightWithHighCube: 4.05,
        kingpinHeight: 1.15,
        bogieSpread: 1.35,
        notes: 'Heavy-duty gooseneck container chassis with ISO corner twistlocks for 1x40ft or 2x20ft intermodal boxes.',
      },
      enclosedDryVanTrailer: {
        name: '53ft/40ft Enclosed Dry Freight Van',
        nominalDimensions: { length: 13.6, width: 2.55, height: 4.1 },
        clearanceRequirement: { lateral: 0.5, vertical: 0.4 },
        kingpinHeight: 1.15,
        notes: 'High-cube aluminum composite freight trailer with rear roll-up door and side conspicuity striping.',
      },
      isoContainer20ft: {
        name: 'ISO 20ft Intermodal Dry Container (1 TEU)',
        nominalDimensions: { length: 6.058, width: 2.438, height: 2.591 },
        notes: 'Standard twenty-foot equivalent shipping unit with corrugated steel skin and corner castings.',
      },
      isoContainer40ft: {
        name: 'ISO 40ft Intermodal Dry Container (2 TEU)',
        nominalDimensions: { length: 12.192, width: 2.438, height: 2.591 },
        notes: 'Standard forty-foot equivalent intermodal container for long-distance maritime and road logistics.',
      },
      isoContainer40ftHighCube: {
        name: 'ISO 40ft High-Cube Container (2 TEU HC)',
        nominalDimensions: { length: 12.192, width: 2.438, height: 2.896 },
        notes: 'High-cube shipping container providing additional 305mm vertical storage volume.',
      },
    },
  },

  // 2. Road & Highway Infrastructure (AASHTO Green Book / FHWA)
  roadInfrastructure: {
    category: 'Roadways & Civil Corridors',
    unitDefinition: 'Meters (m)',
    standards: {
      standardTravelLane: {
        name: 'Standard Municipal Travel Lane',
        nominalDimensions: { length: 4.0, width: 3.5, height: 5.2 }, // 3.5m lane width + 0.25m curbs in 4m cell
        clearanceRequirement: { lateral: 0.5, vertical: 5.0 },
        curbHeight: 0.15,
        notes: 'Paved lane width of 3.5m accommodating 2.5m wide heavy vehicles with 0.5m lateral lane margin.',
      },
      heavyFreightArterial: {
        name: 'Heavy Freight Corridor (Dual Lane Avenue)',
        nominalDimensions: { length: 4.0, width: 7.2, height: 5.5 }, // 2 cells wide (8.0m total)
        clearanceRequirement: { lateral: 0.75, vertical: 5.2 },
        curbHeight: 0.15,
        notes: 'Reinforced dual-lane arterial corridor engineered for sustained commercial freight traffic.',
      },
      industrialServiceApron: {
        name: 'Industrial Logistics Service Apron',
        nominalDimensions: { length: 4.0, width: 4.0, height: 5.0 },
        clearanceRequirement: { lateral: 0.6, vertical: 4.8 },
        curbHeight: 0.10,
        notes: 'Low-speed maneuvering apron designed for 16.5m articulated semi-trailer turning envelopes.',
      },
      bridgeOverheadClearance: {
        name: 'Overhead Bridge & Structural Clearance',
        nominalDimensions: { length: 12.0, width: 8.0, height: 5.2 },
        minimumClearanceVertical: 5.0, // 5.0m min vertical clearance over 4.1m max truck height
        notes: 'Ensures legal 4.15m maximum vehicle height passes with at least 0.85m overhead safety margin.',
      },
      streetlightPole: {
        name: 'Highway Luminaire Mast',
        nominalDimensions: { length: 2.4, width: 0.35, height: 6.8 },
        luminaireHeight: 6.2,
        notes: 'Curbside lighting fixture delivering uniform illumination without obstructing road travel lanes.',
      },
    },
  },

  // 3. Buildings & Industrial Loading Docks
  buildingInfrastructure: {
    category: 'Logistics Warehouses & Industrial Facilities',
    unitDefinition: 'Meters (m)',
    standards: {
      standardTruckLoadingBay: {
        name: 'Industrial Truck Loading Dock Bay',
        nominalDimensions: { length: 1.2, width: 3.2, height: 4.2 }, // 3.2m wide x 4.2m tall door
        dockFloorHeight: 1.2, // 1.2m above ground (standard 48-inch truck bed height)
        compressionSealWidth: 3.6,
        compressionSealHeight: 4.4,
        bollardSpacing: 3.6, // 3.6m between bollards (leaves 0.55m clearance outside 2.5m vehicle)
        clearanceRequirement: { lateral: 0.35, vertical: 0.25 },
        notes: 'Accommodates 2.5m wide x 4.0m tall semi-trailers with pneumatic dock leveler and rubber bumpers.',
      },
      logisticsWarehouseSmall: {
        name: 'Sector Logistics Hub',
        gridFootprint: { widthCells: 4, depthCells: 3 },
        nominalDimensions: { length: 12.0, width: 16.0, height: 8.5 }, // 4 cells x 4m = 16m W, 3 cells x 4m = 12m D
        clearInternalHeight: 7.8,
        loadingBaysCount: 2,
        notes: 'Regional distribution warehouse with twin loading bays, office annex, and rooftop HVAC.',
      },
      megaFulfillmentCenter: {
        name: 'Trans-Regional High-Cube Fulfillment Center',
        gridFootprint: { widthCells: 5, depthCells: 4 },
        nominalDimensions: { length: 16.0, width: 20.0, height: 12.0 }, // 20m x 16m x 12m
        clearInternalHeight: 11.2,
        loadingBaysCount: 4,
        notes: 'High-cube automated fulfillment center with quad recessed docks and rooftop solar farm.',
      },
      coldStorageFacility: {
        name: 'Cold-Chain Redistribution Facility',
        gridFootprint: { widthCells: 3, depthCells: 3 },
        nominalDimensions: { length: 12.0, width: 12.0, height: 9.0 },
        clearInternalHeight: 8.2,
        loadingBaysCount: 2,
        notes: 'Insulated cold-storage redistribution warehouse with industrial chiller condensers.',
      },
      industrialFactoryTier1: {
        name: 'Apex Heavy Manufacturing Plant',
        gridFootprint: { widthCells: 3, depthCells: 3 },
        nominalDimensions: { length: 12.0, width: 12.0, height: 13.5 },
        smokestackHeight: 18.0,
        siloHeight: 12.5,
        notes: 'Heavy components plant with raw material silos, filtration smokestack, and gantry crane.',
      },
    },
  },

  // 4. Railway Infrastructure Standards (Future Milestones Grounding)
  railwayInfrastructure: {
    category: 'Freight & Passenger Railway Systems',
    unitDefinition: 'Meters (m)',
    standards: {
      standardTrackGauge: {
        name: 'Standard Gauge Rail Track (UIC / AAR)',
        nominalDimensions: { length: 4.0, width: 3.2, height: 0.45 },
        trackGauge: 1.435, // 1435mm standard gauge
        trackCenterToCenterSpacing: 4.2,
        ballastBedWidth: 3.2,
        catenaryWireHeight: 5.5,
        notes: 'Standard 1435mm gauge trackbed with crushed basalt ballast and concrete ties.',
      },
      heavyFreightLocomotive: {
        name: 'Six-Axle Heavy Diesel-Electric Locomotive',
        nominalDimensions: { length: 22.0, width: 3.15, height: 4.75 },
        clearanceRequirement: { lateral: 0.4, vertical: 0.6 },
        notes: '4400-horsepower heavy freight locomotive for container intermodal trains.',
      },
      intermodalDoubleStackCar: {
        name: 'Well Car (Double-Stack Container Flatcar)',
        nominalDimensions: { length: 20.5, width: 3.1, height: 5.85 }, // Double stack container height
        clearanceRequirement: { lateral: 0.4, vertical: 0.5 },
        notes: 'Deep-well container flatcar accommodating two vertically stacked 40ft ISO containers.',
      },
      passengerTrainCar: {
        name: 'Regional Passenger Carriage',
        nominalDimensions: { length: 24.5, width: 3.0, height: 4.05 },
        platformClearance: 0.08,
        notes: 'Standard passenger coach aligned with 0.95m high station platforms.',
      },
    },
  },

  // 5. Maritime Infrastructure Standards (Future Milestones Grounding)
  maritimeInfrastructure: {
    category: 'Navigable Waterways & Marine Terminals',
    unitDefinition: 'Meters (m)',
    standards: {
      feederContainerVessel: {
        name: 'Feedermax Container Vessel (1,200 TEU)',
        nominalDimensions: { length: 155.0, width: 24.5, height: 34.0 },
        designDraft: 8.5,
        airDraft: 29.5,
        notes: 'Coastal container feeder vessel serving regional hub ports and container terminals.',
      },
      containerQuaysideCrane: {
        name: 'Post-Panamax Ship-to-Shore (STS) Gantry Crane',
        nominalDimensions: { length: 28.0, width: 26.0, height: 68.0 },
        outreachMeters: 45.0,
        railGauge: 30.5,
        notes: 'High-speed electric gantry crane transferring containers between ship holds and yard chassis.',
      },
      berthQuayWall: {
        name: 'Deepwater Concrete Container Berth',
        nominalDimensions: { length: 200.0, width: 35.0, height: 16.0 },
        berthDepthBelowWater: 14.0,
        bollardCapacityTonnes: 150,
        notes: 'Reinforced concrete caisson quay wall with continuous rubber arch fenders and heavy bollards.',
      },
    },
  },

  // 6. Aviation Infrastructure Standards (Future Milestones Grounding)
  aviationInfrastructure: {
    category: 'Airports & Air Cargo Logistics',
    unitDefinition: 'Meters (m)',
    standards: {
      regionalCargoFreighter: {
        name: 'Twin-Turboprop Regional Cargo Aircraft',
        nominalDimensions: { length: 27.2, width: 27.05, height: 7.75 }, // Wingspan = 27.05m
        wheelTrack: 4.1,
        mainGearHeight: 1.8,
        notes: 'Regional feeder freighter configured for LD3 containers and palletized cargo.',
      },
      commercialNarrowbodyFreighter: {
        name: 'Narrowbody Jet Cargo Transport (B737-800BCF)',
        nominalDimensions: { length: 39.5, width: 35.8, height: 12.5 }, // Wingspan = 35.8m
        wheelTrack: 5.7,
        cargoDoorDimensions: { width: 3.55, height: 2.18 },
        notes: 'Standard express parcel air freighter operating medium-haul logistics corridors.',
      },
      airportRunwayStrip: {
        name: 'Code 4D Commercial Air Cargo Runway',
        nominalDimensions: { length: 2400.0, width: 45.0, height: 0.6 },
        shoulderWidth: 7.5,
        safetyAreaWidth: 150.0,
        notes: 'Engineered asphalt runway meeting ICAO Annex 14 standards with 7.5m paved shoulders.',
      },
    },
  },

  // 7. Human & Ergonomic Environmental References
  humanReferences: {
    category: 'Human Scales & Pedestrian Ergonomics',
    unitDefinition: 'Meters (m)',
    standards: {
      averageHuman: {
        name: 'Adult Human Pedestrian Reference',
        nominalDimensions: { length: 0.35, width: 0.55, height: 1.78 },
        notes: 'Standard human scale benchmark for doors, handrails, stair treads, and vehicle boarding.',
      },
      standardPedestrianDoor: {
        name: 'Commercial Personnel Entrance Door',
        nominalDimensions: { length: 0.1, width: 0.95, height: 2.1 },
        notes: 'Standard egress door providing natural human proportions against 8-12m industrial buildings.',
      },
      staircaseRiserTread: {
        name: 'Industrial Access Staircase Step',
        nominalDimensions: { length: 0.28, width: 1.1, height: 0.18 },
        riserHeight: 0.18,
        treadDepth: 0.28,
        notes: 'OSHA compliant industrial stairway for mezzanine and maintenance platform access.',
      },
    },
  },
};

/**
 * Spatial Validation Utility Functions
 */
export class WorldScaleValidator {
  /**
   * Validates if vehicle fits within a travel lane with adequate clearance
   */
  public static validateLaneClearance(
    vehicleWidth: number,
    laneWidth: number = 3.5
  ): { passes: boolean; lateralClearanceTotal: number; clearancePerSide: number; message: string } {
    const clearance = laneWidth - vehicleWidth;
    const perSide = clearance / 2;
    const passes = perSide >= 0.3; // Minimum 0.3m clearance per side

    return {
      passes,
      lateralClearanceTotal: clearance,
      clearancePerSide: perSide,
      message: passes
        ? `Passes: ${vehicleWidth.toFixed(2)}m vehicle in ${laneWidth.toFixed(2)}m lane has ${perSide.toFixed(2)}m margin per side.`
        : `Defect: Vehicle width ${vehicleWidth.toFixed(2)}m exceeds safe lane clearance for ${laneWidth.toFixed(2)}m lane.`,
    };
  }

  /**
   * Validates if a vehicle/trailer fits into an industrial loading dock door
   */
  public static validateDockClearance(
    vehicleWidth: number,
    vehicleHeight: number,
    dockDoorWidth: number = 3.2,
    dockDoorHeight: number = 4.2
  ): {
    passes: boolean;
    widthMargin: number;
    heightMargin: number;
    message: string;
  } {
    const widthMargin = dockDoorWidth - vehicleWidth;
    const heightMargin = dockDoorHeight - vehicleHeight;
    const passes = widthMargin >= 0.3 && heightMargin >= 0.15;

    return {
      passes,
      widthMargin,
      heightMargin,
      message: passes
        ? `Passes: Vehicle (${vehicleWidth.toFixed(2)}m x ${vehicleHeight.toFixed(2)}m) docks safely in ${dockDoorWidth.toFixed(2)}m x ${dockDoorHeight.toFixed(2)}m bay.`
        : `Defect: Dock dimensions (${dockDoorWidth.toFixed(2)}m x ${dockDoorHeight.toFixed(2)}m) insufficient for ${vehicleWidth.toFixed(2)}m x ${vehicleHeight.toFixed(2)}m vehicle.`,
    };
  }

  /**
   * Validates vertical overhead clearance under signs, bridges, and lights
   */
  public static validateOverheadClearance(
    vehicleHeight: number,
    overheadStructureHeight: number = 5.2
  ): { passes: boolean; clearanceMargin: number; message: string } {
    const margin = overheadStructureHeight - vehicleHeight;
    const passes = margin >= 0.5; // Minimum 0.5m overhead safety margin

    return {
      passes,
      clearanceMargin: margin,
      message: passes
        ? `Passes: ${vehicleHeight.toFixed(2)}m vehicle clears ${overheadStructureHeight.toFixed(2)}m structure with ${margin.toFixed(2)}m headroom.`
        : `Defect: Insufficient overhead clearance (${margin.toFixed(2)}m) under ${overheadStructureHeight.toFixed(2)}m structure.`,
    };
  }
}
