export type VehicleAxleConfig = '4x2' | '6x4';
export type VehicleCategory = 'heavy_freight' | 'distribution';
export type TrailerType = 'skeletal_chassis' | 'enclosed_dry_van';
export type ContainerType = 'dry_20ft' | 'dry_40ft' | 'reefer_20ft' | 'reefer_40ft';
export type FleetColor = 'blue' | 'red' | 'orange' | 'white' | 'dark';

export interface VehicleDimensions {
  width: number;       // in meters
  length: number;      // in meters
  height: number;      // in meters
  wheelbase: number;   // in meters
  groundClearance: number; // in meters
}

export interface VehicleDefinition {
  id: string;
  name: string;
  category: VehicleCategory;
  categoryLabel: string;
  dimensions: VehicleDimensions;
  axleConfig: VehicleAxleConfig;
  hasFifthWheel: boolean;
  fifthWheelOffset: { x: number; y: number; z: number }; // Offset from vehicle center
  frontAxleOffsetZ: number;
  rearAxleOffsetsZ: number[];
  steerAngleMaxDeg: number;
  specs: {
    horsepower: number;
    curbWeightKg: number;
    maxGrossCombinedWeightKg: number;
    fuelTankCapacityLiters: number;
    maxSpeedKmh: number;
  };
  defaultColor: FleetColor;
  description: string;
}

export interface TrailerDimensions {
  width: number;
  length: number;
  height: number;
  couplingClearance: number;
}

export interface TrailerDefinition {
  id: string;
  name: string;
  type: TrailerType;
  categoryLabel: string;
  dimensions: TrailerDimensions;
  kingpinOffset: { x: number; y: number; z: number }; // Relative to trailer center
  landingLegsOffset: { x: number; y: number; z: number };
  rearAxleOffsetsZ: number[]; // Bogie axle positions along length
  twistlockMountPoints?: { x: number; y: number; z: number }[]; // 4 corner twistlocks
  specs: {
    tareWeightKg: number;
    maxPayloadKg: number;
    cargoVolumeCbm: number;
  };
  description: string;
}

export interface ContainerDimensions {
  width: number;
  length: number;
  height: number;
}

export interface ContainerDefinition {
  id: string;
  name: string;
  type: ContainerType;
  categoryLabel: string;
  dimensions: ContainerDimensions;
  isRefrigerated: boolean;
  specs: {
    tareWeightKg: number;
    maxGrossWeightKg: number;
    payloadCapacityKg: number;
    cubicCapacityCbm: number;
  };
  bicPrefix: string;
  defaultLivery: FleetColor;
  description: string;
}

export const VEHICLE_DEFINITIONS: Record<string, VehicleDefinition> = {
  prime_mover_6x4: {
    id: 'prime_mover_6x4',
    name: 'Apex Hauler 6x4 Heavy Prime Mover',
    category: 'heavy_freight',
    categoryLabel: 'Class 8 Heavy Prime Mover',
    dimensions: {
      width: 2.4,
      length: 6.8,
      height: 3.45,
      wheelbase: 3.8,
      groundClearance: 0.35,
    },
    axleConfig: '6x4',
    hasFifthWheel: true,
    fifthWheelOffset: { x: 0, y: 1.15, z: -1.75 },
    frontAxleOffsetZ: 2.1,
    rearAxleOffsetsZ: [-1.2, -2.5],
    steerAngleMaxDeg: 34,
    specs: {
      horsepower: 560,
      curbWeightKg: 8850,
      maxGrossCombinedWeightKg: 44000,
      fuelTankCapacityLiters: 950,
      maxSpeedKmh: 110,
    },
    defaultColor: 'blue',
    description:
      'High-torque tri-axle prime mover tractor unit engineered for interstate container transit and heavy logistics hauling.',
  },
  courier_truck_4x2: {
    id: 'courier_truck_4x2',
    name: 'Fleet Logistics 4x2 Courier Carrier',
    category: 'distribution',
    categoryLabel: 'Medium Freight Rigid Truck',
    dimensions: {
      width: 2.3,
      length: 5.6,
      height: 3.1,
      wheelbase: 3.2,
      groundClearance: 0.32,
    },
    axleConfig: '4x2',
    hasFifthWheel: true,
    fifthWheelOffset: { x: 0, y: 1.1, z: -1.4 },
    frontAxleOffsetZ: 1.7,
    rearAxleOffsetsZ: [-1.4],
    steerAngleMaxDeg: 38,
    specs: {
      horsepower: 380,
      curbWeightKg: 6400,
      maxGrossCombinedWeightKg: 26000,
      fuelTankCapacityLiters: 480,
      maxSpeedKmh: 125,
    },
    defaultColor: 'orange',
    description:
      'Agile dual-axle distribution tractor ideal for metro distribution, cross-dock shuttling, and feeder corridors.',
  },
};

export const TRAILER_DEFINITIONS: Record<string, TrailerDefinition> = {
  skeletal_container_chassis_40ft: {
    id: 'skeletal_container_chassis_40ft',
    name: 'Intermodal Skeletal Container Chassis (40ft / 2x20ft)',
    type: 'skeletal_chassis',
    categoryLabel: 'Skeletal Intermodal Chassis',
    dimensions: {
      width: 2.44,
      length: 12.2,
      height: 1.45,
      couplingClearance: 0.3,
    },
    kingpinOffset: { x: 0, y: 1.15, z: 5.1 },
    landingLegsOffset: { x: 0, y: 0, z: 3.2 },
    rearAxleOffsetsZ: [-3.8, -5.0],
    twistlockMountPoints: [
      { x: -1.13, y: 1.42, z: 5.95 },  // Front Left
      { x: 1.13, y: 1.42, z: 5.95 },   // Front Right
      { x: -1.13, y: 1.42, z: -5.95 }, // Rear Left
      { x: 1.13, y: 1.42, z: -5.95 },  // Rear Right
    ],
    specs: {
      tareWeightKg: 3600,
      maxPayloadKg: 31000,
      cargoVolumeCbm: 76.2,
    },
    description:
      'Lightweight high-tensile structural steel skeletal chassis equipped with four ISO twistlocks for secure container transit.',
  },
  enclosed_dry_van_trailer: {
    id: 'enclosed_dry_van_trailer',
    name: 'Trans-Continental High-Cube Dry Van Trailer',
    type: 'enclosed_dry_van',
    categoryLabel: 'Enclosed Cargo Trailer',
    dimensions: {
      width: 2.44,
      length: 12.2,
      height: 3.9,
      couplingClearance: 0.3,
    },
    kingpinOffset: { x: 0, y: 1.15, z: 5.1 },
    landingLegsOffset: { x: 0, y: 0, z: 3.2 },
    rearAxleOffsetsZ: [-3.8, -5.0],
    specs: {
      tareWeightKg: 5200,
      maxPayloadKg: 28000,
      cargoVolumeCbm: 88.5,
    },
    description:
      'Fully enclosed composite dry freight trailer with dual rear swing doors, aerodynamic side skirts, and maximum cargo security.',
  },
};

export const CONTAINER_DEFINITIONS: Record<string, ContainerDefinition> = {
  iso_container_dry_20ft: {
    id: 'iso_container_dry_20ft',
    name: '20ft ISO General Dry Cargo Container',
    type: 'dry_20ft',
    categoryLabel: '20ft Intermodal Container',
    dimensions: {
      width: 2.44,
      length: 6.06,
      height: 2.59,
    },
    isRefrigerated: false,
    specs: {
      tareWeightKg: 2230,
      maxGrossWeightKg: 30480,
      payloadCapacityKg: 28250,
      cubicCapacityCbm: 33.2,
    },
    bicPrefix: 'APXU',
    defaultLivery: 'blue',
    description:
      'Standard 20-foot corrugated Corten steel intermodal shipping container with ISO corner castings and heavy locking bars.',
  },
  iso_container_dry_40ft: {
    id: 'iso_container_dry_40ft',
    name: '40ft ISO High-Cube Dry Cargo Container',
    type: 'dry_40ft',
    categoryLabel: '40ft High-Cube Container',
    dimensions: {
      width: 2.44,
      length: 12.19,
      height: 2.59,
    },
    isRefrigerated: false,
    specs: {
      tareWeightKg: 3740,
      maxGrossWeightKg: 32500,
      payloadCapacityKg: 28760,
      cubicCapacityCbm: 67.7,
    },
    bicPrefix: 'CRMU',
    defaultLivery: 'red',
    description:
      'High-capacity 40-foot intermodal freight container designed for global shipping across road trailers, flatcars, and container vessels.',
  },
  iso_container_reefer_20ft: {
    id: 'iso_container_reefer_20ft',
    name: '20ft ISO Temperature-Controlled Reefer Container',
    type: 'reefer_20ft',
    categoryLabel: 'Refrigerated Cold-Chain Container',
    dimensions: {
      width: 2.44,
      length: 6.06,
      height: 2.59,
    },
    isRefrigerated: true,
    specs: {
      tareWeightKg: 3050,
      maxGrossWeightKg: 30480,
      payloadCapacityKg: 27430,
      cubicCapacityCbm: 28.5,
    },
    bicPrefix: 'RFLU',
    defaultLivery: 'white',
    description:
      'Thermally insulated refrigeration container with integrated Thermo-Chill nose-mount compressor unit for perishable cargo.',
  },
};
