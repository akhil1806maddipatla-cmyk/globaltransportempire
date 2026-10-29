import { RoadTypeId } from './roadDefinitions';

export interface InitialRoadSegment {
  id: string;
  gridX: number; // grid start cell
  gridZ: number;
  length: number; // in grid cells
  direction: 'horizontal' | 'vertical';
  type: RoadTypeId;
}

export interface InitialBuildingInstance {
  id: string;
  definitionId: string;
  gridX: number; // top-left cell in grid
  gridZ: number;
  rotation: number; // in radians: 0, Math.PI/2, Math.PI, etc.
}

export interface InitialTreeInstance {
  gridX: number;
  gridZ: number;
  offsetX: number;
  offsetZ: number;
  scale: number;
  species: 'conifer' | 'deciduous' | 'round';
}

export interface ConstructionPlot {
  id: string;
  name: string;
  gridX: number;
  gridZ: number;
  width: number; // grid cells
  depth: number;
  status: 'Designated for Expansion' | 'Survey Pending';
}

export interface InitialVehicleInstance {
  id: string;
  definitionId: string;
  gridX: number;
  gridZ: number;
  rotationDegrees: number;
  trailerDefinitionId?: string;
  containerDefinitionId?: string;
  paintColor?: 'blue' | 'red' | 'orange' | 'white' | 'dark';
  offsetX?: number;
  offsetZ?: number;
  worldX?: number;
  worldY?: number;
  worldZ?: number;
}

export interface InitialWorldData {
  roads: InitialRoadSegment[];
  buildings: InitialBuildingInstance[];
  vehicles: InitialVehicleInstance[];
  trees: InitialTreeInstance[];
  constructionPlots: ConstructionPlot[];
}

export const INITIAL_WORLD_DATA: InitialWorldData = {
  // Grid coordinates: 0..23 (Cell size: 4.0m x 4.0m)
  roads: [
    // 1. Continental Interstate Highway Corridor (West visible boundary gateway from X = 0 to 1)
    {
      id: 'road_highway_west',
      gridX: 0,
      gridZ: 11,
      length: 2,
      direction: 'horizontal',
      type: 'highway_corridor',
    },
    // 2. West Highway Interchange Ramp (X = 2, Z = 11)
    {
      id: 'road_ramp_west',
      gridX: 2,
      gridZ: 11,
      length: 1,
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    // 3. Central Heavy Freight Arterial Avenue (X = 3 to 16, Z = 11)
    {
      id: 'road_main_avenue',
      gridX: 3,
      gridZ: 11,
      length: 14,
      direction: 'horizontal',
      type: 'heavy_arterial',
    },
    // 4. East Highway Interchange Ramp (X = 17, Z = 11)
    {
      id: 'road_ramp_east',
      gridX: 17,
      gridZ: 11,
      length: 1,
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    // 5. Maritime Coastal Freight Highway (East visible boundary gateway from X = 18 to 23)
    {
      id: 'road_highway_east',
      gridX: 18,
      gridZ: 11,
      length: 6,
      direction: 'horizontal',
      type: 'highway_corridor',
    },
    // 6. Heavy Industrial Arterial Branch heading North from main avenue at X = 11 (Z = 1 to 10)
    {
      id: 'road_industrial_branch',
      gridX: 11,
      gridZ: 1,
      length: 10,
      direction: 'vertical',
      type: 'heavy_arterial',
    },
    // 7. Dedicated Municipal Local Spur heading South from main avenue at X = 11 to depot entrance (Z = 12 to 14)
    {
      id: 'road_depot_spur',
      gridX: 11,
      gridZ: 12,
      length: 3,
      direction: 'vertical',
      type: 'two_lane_urban',
    },
    // 8. Southern Logistics Feeder heading South from main avenue at X = 17 (Z = 12 to 36)
    {
      id: 'road_logistics_feeder',
      gridX: 17,
      gridZ: 12,
      length: 25,
      direction: 'vertical',
      type: 'heavy_arterial',
    },

    // --- EXPANDED REGIONAL HIGHWAY NETWORK & COMPLETE HIERARCHY ---

    // 9. Trans-Continental Interstate Highway 1 (I-1 Eastbound Extension, X = 24 to 54, Z = 11)
    // Runs across Central Interchange, Grand Harbor Viaduct (X=42..46), to Pelican Point Terminal
    {
      id: 'road_highway_i1_ext',
      gridX: 24,
      gridZ: 11,
      length: 31,
      direction: 'horizontal',
      type: 'highway_corridor',
    },

    // 10. Regional Interstate Highway 99 (I-99 North Segment, X = 24, Z = 1 to 10)
    {
      id: 'road_highway_i99_north',
      gridX: 24,
      gridZ: 1,
      length: 10,
      direction: 'vertical',
      type: 'highway_corridor',
    },

    // 11. Regional Interstate Highway 99 (I-99 South Central Segment, X = 24, Z = 12 to 35)
    {
      id: 'road_highway_i99_south',
      gridX: 24,
      gridZ: 12,
      length: 24,
      direction: 'vertical',
      type: 'highway_corridor',
    },

    // 12. Regional Interstate Highway 99 (I-99 Delta Seaward Segment, X = 24, Z = 37 to 48)
    {
      id: 'road_highway_i99_delta',
      gridX: 24,
      gridZ: 37,
      length: 12,
      direction: 'vertical',
      type: 'highway_corridor',
    },

    // 13. Central Cloverleaf/Diamond Interchange Directional Ramps (I-1 & I-99 Junction at X=24, Z=11)
    {
      id: 'road_ramp_cloverleaf_nw',
      gridX: 24,
      gridZ: 10,
      length: 2, // covers (24, 10) and (25, 10)
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_cloverleaf_ne',
      gridX: 25,
      gridZ: 10,
      length: 2, // covers (25, 10) and (26, 10)
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_cloverleaf_sw',
      gridX: 24,
      gridZ: 12,
      length: 2, // covers (24, 12) and (25, 12)
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_cloverleaf_se',
      gridX: 25,
      gridZ: 12,
      length: 2, // covers (25, 12) and (26, 12)
      direction: 'horizontal',
      type: 'highway_ramp',
    },

    // 14. South Logistics Interchange Ramps (I-99 & Delta Boulevard at X=24, Z=36)
    {
      id: 'road_ramp_south_nw',
      gridX: 23,
      gridZ: 35,
      length: 2,
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_south_ne',
      gridX: 24,
      gridZ: 35,
      length: 2,
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_south_sw',
      gridX: 23,
      gridZ: 37,
      length: 2,
      direction: 'horizontal',
      type: 'highway_ramp',
    },
    {
      id: 'road_ramp_south_se',
      gridX: 24,
      gridZ: 37,
      length: 2,
      direction: 'horizontal',
      type: 'highway_ramp',
    },

    // 15. Delta Regional Arterial Boulevard (East-West Heavy Arterial at Z = 36, X = 12 to 44)
    {
      id: 'road_delta_boulevard',
      gridX: 12,
      gridZ: 36,
      length: 33,
      direction: 'horizontal',
      type: 'heavy_arterial',
    },

    // 16. Eastern Seaport Arterial (North-South Heavy Arterial along X = 38, Z = 12 to 36)
    // Connects I-1 Grand Harbor exit to Delta Boulevard and deepwater berths
    {
      id: 'road_seaport_arterial',
      gridX: 38,
      gridZ: 12,
      length: 25,
      direction: 'vertical',
      type: 'heavy_arterial',
    },

    // 17. Northern Rail Freight Corridor Connector (Heavy Arterial at Z = 1, X = 11 to 23)
    {
      id: 'road_north_rail_connector',
      gridX: 11,
      gridZ: 1,
      length: 13,
      direction: 'horizontal',
      type: 'heavy_arterial',
    },

    // 18. Local Streets & Collector Roads within Districts:
    // A. Apex Factory Local Street Spur (X = 8 to 11, Z = 8)
    {
      id: 'road_apex_local_street',
      gridX: 8,
      gridZ: 8,
      length: 4,
      direction: 'horizontal',
      type: 'two_lane_urban',
    },
    // B. Southern Logistics Park Collector East-West (X = 14 to 22, Z = 30)
    {
      id: 'road_south_logistics_collector_ew',
      gridX: 14,
      gridZ: 30,
      length: 9,
      direction: 'horizontal',
      type: 'two_lane_urban',
    },
    // C. Southern Logistics Park Collector North-South (X = 14, Z = 26 to 35)
    {
      id: 'road_south_logistics_collector_ns',
      gridX: 14,
      gridZ: 26,
      length: 10,
      direction: 'vertical',
      type: 'two_lane_urban',
    },
    // D. Grand Harbor Seaport Container Terminal Collector (X = 26 to 37, Z = 18)
    {
      id: 'road_seaport_container_collector',
      gridX: 26,
      gridZ: 18,
      length: 12,
      direction: 'horizontal',
      type: 'two_lane_urban',
    },
    // E. Northeast Tech & Manufacturing Estate Collector (X = 24 to 36, Z = 5)
    // Connects directly to I-99 Expressway at (24, 5)
    {
      id: 'road_northeast_tech_street',
      gridX: 24,
      gridZ: 5,
      length: 13,
      direction: 'horizontal',
      type: 'two_lane_urban',
    },

    // 19. Dedicated Industrial & Logistics Service Tracks:
    // A. South Intermodal Logistics Apron & Staging Track (X = 14 to 18, Z = 29)
    // Connects directly to logistics collector at (14, 29) for heavy container staging
    {
      id: 'road_south_logistics_apron',
      gridX: 14,
      gridZ: 29,
      length: 5,
      direction: 'horizontal',
      type: 'industrial_access',
    },
    // B. Quayside Heavy Crane Track & Service Apron (X = 22, Z = 12 to 16)
    // Connects directly to highway corridor at (22, 11) for heavy port transport
    {
      id: 'road_quayside_service_apron',
      gridX: 22,
      gridZ: 12,
      length: 5,
      direction: 'vertical',
      type: 'industrial_access',
    },
  ],

  buildings: [
    // 1. Guaranteed Starter: Level 1 Fleet Truck Depot (Player Owned, 3 Designated Parking Spaces)
    // Placed at X=12, Z=13 (4x3 cells -> 16m x 12m), directly connected to road_depot_spur at X=11
    {
      id: 'bld_truck_depot_primary',
      definitionId: 'truck_depot_level1',
      gridX: 12,
      gridZ: 13,
      rotation: 0,
    },
    // 2. Central Sector Logistics Hub: placed along South of main road (X=5, Z=12, size 4x3)
    {
      id: 'bld_logistics_01',
      definitionId: 'logistics_warehouse_sm',
      gridX: 5,
      gridZ: 12,
      rotation: 0,
    },
    // 3. Apex Manufacturing Plant: placed on the West side of Industrial Branch (X=8, Z=5, size 3x3)
    {
      id: 'bld_industry_01',
      definitionId: 'industrial_factory_tier1',
      gridX: 8,
      gridZ: 5,
      rotation: 0,
    },
    // 4. Global Dispatch HQ: placed on the East side of Industrial Branch (X=12, Z=6, size 3x2)
    {
      id: 'bld_commercial_01',
      definitionId: 'commercial_cargo_hub',
      gridX: 12,
      gridZ: 6,
      rotation: 0,
    },
  ],

  // Initial Road Freight Fleet & Intermodal Carriers
  vehicles: [
    // 1. Primary Heavy Prime Mover staged cleanly inside Level 1 Depot (Bay #2, worldX: 6.5, worldZ: 10.2, worldY: 0.28)
    {
      id: 'veh_prime_mover_01',
      definitionId: 'prime_mover_6x4',
      gridX: 12,
      gridZ: 13,
      worldX: 6.5,
      worldY: 0.28,
      worldZ: 10.2,
      rotationDegrees: 180,
      trailerDefinitionId: 'skeletal_container_chassis_40ft',
      containerDefinitionId: 'iso_container_dry_40ft',
      paintColor: 'blue',
    },
    // 2. High-speed Courier Truck with Enclosed Dry Van along Main Highway Eastbound Lane (offsetZ: +1.25m, worldY: 0.042)
    {
      id: 'veh_express_02',
      definitionId: 'courier_truck_4x2',
      gridX: 18,
      gridZ: 11,
      offsetZ: 1.25,
      worldY: 0.042,
      rotationDegrees: 90,
      trailerDefinitionId: 'enclosed_dry_van_trailer',
      paintColor: 'orange',
    },
    // 3. Cold-Chain Reefer Prime Mover along Industrial Branch Southbound Lane (offsetX: +1.25m, worldY: 0.042)
    {
      id: 'veh_reefer_03',
      definitionId: 'prime_mover_6x4',
      gridX: 11,
      gridZ: 7,
      offsetX: 1.25,
      worldY: 0.042,
      rotationDegrees: 0,
      trailerDefinitionId: 'skeletal_container_chassis_40ft',
      containerDefinitionId: 'iso_container_reefer_40ft',
      paintColor: 'white',
    },
  ],

  // Designated Future Expansion Plots
  constructionPlots: [
    {
      id: 'plot_expansion_alpha',
      name: 'Zone Alpha: Intermodal Fleet Expansion Reserve',
      gridX: 12,
      gridZ: 17,
      width: 4,
      depth: 4,
      status: 'Designated for Expansion',
    },
  ],

  // Deliberate greenery placement framing roadways and facilities
  trees: [
    { gridX: 3, gridZ: 3, offsetX: 0.2, offsetZ: 0.1, scale: 1.1, species: 'round' },
    { gridX: 4, gridZ: 4, offsetX: -0.3, offsetZ: 0.4, scale: 0.9, species: 'conifer' },
    { gridX: 3, gridZ: 6, offsetX: 0.1, offsetZ: -0.2, scale: 1.0, species: 'deciduous' },
    { gridX: 4, gridZ: 8, offsetX: 0.4, offsetZ: 0.2, scale: 0.85, species: 'round' },
    { gridX: 18, gridZ: 4, offsetX: -0.2, offsetZ: 0.3, scale: 1.05, species: 'conifer' },
    { gridX: 19, gridZ: 5, offsetX: 0.3, offsetZ: -0.1, scale: 0.95, species: 'round' },
    { gridX: 20, gridZ: 7, offsetX: 0.0, offsetZ: 0.4, scale: 1.15, species: 'deciduous' },
    { gridX: 15, gridZ: 18, offsetX: -0.2, offsetZ: -0.3, scale: 0.9, species: 'round' },
    { gridX: 16, gridZ: 19, offsetX: 0.4, offsetZ: 0.1, scale: 1.0, species: 'conifer' },
    { gridX: 4, gridZ: 19, offsetX: 0.1, offsetZ: 0.2, scale: 1.0, species: 'deciduous' },
    { gridX: 5, gridZ: 20, offsetX: -0.4, offsetZ: -0.2, scale: 1.1, species: 'round' },
  ],
};
