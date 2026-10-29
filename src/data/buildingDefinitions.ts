export type BuildingCategory =
  | 'logistics'
  | 'industrial'
  | 'depot'
  | 'storage'
  | 'commercial';

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  categoryLabel: string;
  footprintWidth: number; // in grid cells (each cell is 2m x 2m)
  footprintDepth: number; // in grid cells
  height: number;
  cost: number;
  dailyUpkeep: number;
  capacityUnits: number;
  description: string;
  colorAccent: string;
  status: 'Operational' | 'Standby' | 'Planned';
  requiresRoadAccess: boolean;
  serviceEntranceSide?: 'front' | 'any';
  permittedRotations?: number[];
  defaultRotation?: number;
}

export const BUILDING_CATEGORIES: { id: BuildingCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Facilities' },
  { id: 'logistics', label: 'Warehousing & Logistics' },
  { id: 'industrial', label: 'Heavy & High-Tech Industry' },
  { id: 'depot', label: 'Fleet & Service Depots' },
  { id: 'storage', label: 'Intermodal & Terminals' },
  { id: 'commercial', label: 'Headquarters & Admin' },
];

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = {
  // 1. Warehouses & Distribution
  logistics_warehouse_sm: {
    id: 'logistics_warehouse_sm',
    name: 'Sector Logistics Hub',
    category: 'logistics',
    categoryLabel: 'Logistics Center',
    footprintWidth: 4,
    footprintDepth: 3,
    height: 8.5,
    cost: 45000,
    dailyUpkeep: 120,
    capacityUnits: 450,
    description: 'Central redistribution facility with twin loading bays, climate-controlled warehousing, and fleet parking apron.',
    colorAccent: '#df9a26',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
  mega_distribution_center: {
    id: 'mega_distribution_center',
    name: 'Trans-Regional Fulfillment Center',
    category: 'logistics',
    categoryLabel: 'High-Cube Fulfillment',
    footprintWidth: 5,
    footprintDepth: 4,
    height: 12.0,
    cost: 95000,
    dailyUpkeep: 280,
    capacityUnits: 1200,
    description: 'High-capacity regional distribution center equipped with quad loading docks, rooftop solar array, and cross-docking bays.',
    colorAccent: '#f59e0b',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
  cold_storage_facility: {
    id: 'cold_storage_facility',
    name: 'Cold-Chain Redistribution Facility',
    category: 'logistics',
    categoryLabel: 'Refrigerated Cargo',
    footprintWidth: 3,
    footprintDepth: 3,
    height: 9.0,
    cost: 58000,
    dailyUpkeep: 175,
    capacityUnits: 380,
    description: 'Specialized temperature-regulated warehouse for perishable consumer goods with insulated dock shelters and industrial chiller banks.',
    colorAccent: '#06b6d4',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },

  // 2. Heavy & High-Tech Industry
  industrial_factory_tier1: {
    id: 'industrial_factory_tier1',
    name: 'Apex Manufacturing Plant',
    category: 'industrial',
    categoryLabel: 'Heavy Industry',
    footprintWidth: 3,
    footprintDepth: 3,
    height: 13.5,
    cost: 65000,
    dailyUpkeep: 210,
    capacityUnits: 300,
    description: 'High-throughput manufacturing facility producing boxed industrial components with dual raw material silos and filtration smokestack.',
    colorAccent: '#e06a3b',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'any',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
  high_tech_assembly_plant: {
    id: 'high_tech_assembly_plant',
    name: 'Precision Automation Assembly Fab',
    category: 'industrial',
    categoryLabel: 'Advanced Manufacturing',
    footprintWidth: 4,
    footprintDepth: 3,
    height: 10.5,
    cost: 82000,
    dailyUpkeep: 260,
    capacityUnits: 550,
    description: 'Advanced robotics and electronics cleanroom facility featuring dual cooling towers, glass reception atrium, and secure loading apron.',
    colorAccent: '#8b5cf6',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },

  // 3. Transport & Fleet Depots
  truck_depot_level1: {
    id: 'truck_depot_level1',
    name: 'Regional Transport Depot (Level 1)',
    category: 'depot',
    categoryLabel: 'Fleet Operations Base',
    footprintWidth: 4,
    footprintDepth: 3,
    height: 8.0,
    cost: 0, // Pre-built starting headquarters
    dailyUpkeep: 60,
    capacityUnits: 3, // Exactly 3 designated parking spaces at Level 1!
    description: 'Your primary operational fleet headquarters. Features 3 designated heavy commercial truck parking spaces with high-clearance overhead shelter, dispatch office, and fleet maintenance bay.',
    colorAccent: '#10b981',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
  heavy_vehicle_service_depot: {
    id: 'heavy_vehicle_service_depot',
    name: 'Fleet Logistics Maintenance Yard',
    category: 'depot',
    categoryLabel: 'Transport Depot',
    footprintWidth: 4,
    footprintDepth: 2,
    height: 8.0,
    cost: 38000,
    dailyUpkeep: 95,
    capacityUnits: 200,
    description: 'Commercial carrier repair facility featuring triple drive-through service bays, heavy pneumatic lifts, and dispatch office.',
    colorAccent: '#10b981',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
  freight_depot_modular: {
    id: 'freight_depot_modular',
    name: 'Modular Intermodal Depot',
    category: 'depot',
    categoryLabel: 'Intermodal Freight',
    footprintWidth: 3,
    footprintDepth: 2,
    height: 7.5,
    cost: 32000,
    dailyUpkeep: 85,
    capacityUnits: 250,
    description: 'Container transfer depot equipped with gantry crane mounts, security checkpoint, and quick-turnaround container aprons.',
    colorAccent: '#0ea5e9',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },

  // 4. Storage & Container Terminals
  container_logistics_terminal: {
    id: 'container_logistics_terminal',
    name: 'Intermodal Container Stacking Yard',
    category: 'storage',
    categoryLabel: 'Container Terminal',
    footprintWidth: 4,
    footprintDepth: 3,
    height: 8.5,
    cost: 48000,
    dailyUpkeep: 110,
    capacityUnits: 650,
    description: 'Dedicated multi-tier intermodal container staging yard with reinforced asphalt apron, perimeter floodlights, and staging lanes.',
    colorAccent: '#ec4899',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'any',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },

  // 5. Commercial & Administration
  commercial_cargo_hub: {
    id: 'commercial_cargo_hub',
    name: 'Global Dispatch Headquarters',
    category: 'commercial',
    categoryLabel: 'Commercial Admin',
    footprintWidth: 3,
    footprintDepth: 2,
    height: 11.5,
    cost: 50000,
    dailyUpkeep: 160,
    capacityUnits: 180,
    description: 'Regional corporate logistics management headquarters coordinating freight contracts, carrier telemetry, and satellite communications.',
    colorAccent: '#2b6cb0',
    status: 'Operational',
    requiresRoadAccess: true,
    serviceEntranceSide: 'front',
    permittedRotations: [0, 90, 180, 270],
    defaultRotation: 0,
  },
};
