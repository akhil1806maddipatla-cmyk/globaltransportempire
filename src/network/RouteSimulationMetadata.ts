/**
 * Visual Journey Routes & Off-Screen Macro Simulation Metadata
 * Global Transport Empire - Spatial Journey Pipeline
 *
 * Establishes the 5-stage conceptual transport pipeline:
 * 1. Depot Entrance / Staging Bay
 * 2. Local City Road / Industrial Feeder
 * 3. Arterial Corridor / Highway Interchange
 * 4. Defined Visible Highway Corridor
 * 5. Visual Transition Boundary (Gateway where vehicle smoothly transfers to off-screen simulation)
 */

import { TransportMode } from './TransportNetwork';

export type JourneyStage =
  | 'staged_at_depot'
  | 'local_transit'
  | 'arterial_transit'
  | 'highway_corridor'
  | 'transitioning_boundary'
  | 'offscreen_simulation'
  | 'arrived_destination';

export interface VisualBoundaryGateway {
  id: string;
  name: string;
  mode: TransportMode;
  cardinalDirection: 'North' | 'South' | 'East' | 'West';
  worldPosition: { x: number; y: number; z: number };
  transitionRadiusMeters: number;
  destinationRegionName: string;
  simulationTransitDurationMinutes: number;
  description: string;
}

export interface TransportRouteDefinition {
  id: string;
  name: string;
  mode: TransportMode;
  originFacilityId: string;
  originNodeId: string;
  localPathNodeIds: string[];
  arterialNodeIds: string[];
  highwayCorridorNodeIds: string[];
  boundaryGatewayId: string;
  destinationName: string;
  estimatedOnScreenDistanceMeters: number;
  estimatedOffScreenKm: number;
  nominalTransitTimeSeconds: number;
}

export interface ActiveOffScreenJourney {
  id: string;
  vehicleId: string;
  routeId: string;
  mode: TransportMode;
  currentStage: JourneyStage;
  startTime: number;
  boundaryCrossedTime?: number;
  estimatedReturnTime: number;
  progressRatio: number; // 0.0 to 1.0
  cargoManifest?: {
    cargoType: string;
    weightTons: number;
    containerId?: string;
  };
}

export class RouteSimulationMetadata {
  public static readonly VISUAL_GATEWAYS: Record<string, VisualBoundaryGateway> = {
    gateway_highway_west: {
      id: 'gateway_highway_west',
      name: 'West Interstate Trans-Regional Highway',
      mode: 'road',
      cardinalDirection: 'West',
      worldPosition: { x: -46.0, y: 0.0, z: -2.0 },
      transitionRadiusMeters: 6.0,
      destinationRegionName: 'Metropolitan Logistics Capital (Zone 4)',
      simulationTransitDurationMinutes: 15,
      description: 'Major arterial highway exit portal connecting local distribution network with the continental trade corridor.',
    },
    gateway_highway_east: {
      id: 'gateway_highway_east',
      name: 'East Coastal Freight Expressway',
      mode: 'road',
      cardinalDirection: 'East',
      worldPosition: { x: 46.0, y: 0.0, z: -2.0 },
      transitionRadiusMeters: 6.0,
      destinationRegionName: 'Eastern Seaboard Marine Harbor & Free Trade Zone',
      simulationTransitDurationMinutes: 20,
      description: 'Multi-lane heavy freight turnpike leading to deepwater container berths and coastal manufacturing hubs.',
    },
    gateway_rail_north: {
      id: 'gateway_rail_north',
      name: 'North Transcontinental Rail Spine',
      mode: 'rail',
      cardinalDirection: 'North',
      worldPosition: { x: 40.0, y: 0.3, z: -46.0 },
      transitionRadiusMeters: 8.0,
      destinationRegionName: 'Inland Mineral & Grain Intermodal Terminals',
      simulationTransitDurationMinutes: 35,
      description: 'Double-track electrified mainline railway corridor accommodating 120-car double-stack intermodal trains.',
    },
    gateway_waterway_south: {
      id: 'gateway_waterway_south',
      name: 'South Navigable Estuary Channel',
      mode: 'waterway',
      cardinalDirection: 'South',
      worldPosition: { x: -46.0, y: -0.5, z: 46.0 },
      transitionRadiusMeters: 12.0,
      destinationRegionName: 'International Offshore Container Shipping Lanes',
      simulationTransitDurationMinutes: 60,
      description: 'Deep-draft navigable waterway channel connecting local river berths with ocean-going feeder routes.',
    },
  };

  /**
   * Constructs the canonical starter route from the Level 1 Depot to the West Interstate Gateway
   */
  public static getStartingDepotRoute(): TransportRouteDefinition {
    return {
      id: 'route_depot_to_west_highway',
      name: 'Depot to Western Regional Freight Corridor',
      mode: 'road',
      originFacilityId: 'facility_truck_depot_01',
      originNodeId: 'node_depot_entrance',
      localPathNodeIds: ['node_depot_entrance', 'node_depot_spur_junction'],
      arterialNodeIds: ['node_main_ave_center', 'node_west_highway_interchange'],
      highwayCorridorNodeIds: ['node_gateway_highway_west'],
      boundaryGatewayId: 'gateway_highway_west',
      destinationName: 'Metropolitan Logistics Capital (Zone 4)',
      estimatedOnScreenDistanceMeters: 56.0,
      estimatedOffScreenKm: 145.0,
      nominalTransitTimeSeconds: 45,
    };
  }

  /**
   * Constructs the starter route from the Level 1 Depot to the East Coastal Expressway Gateway
   */
  public static getEastHighwayRoute(): TransportRouteDefinition {
    return {
      id: 'route_depot_to_east_highway',
      name: 'Depot to Eastern Seaboard Marine Gateway',
      mode: 'road',
      originFacilityId: 'facility_truck_depot_01',
      originNodeId: 'node_depot_entrance',
      localPathNodeIds: ['node_depot_entrance', 'node_depot_spur_junction'],
      arterialNodeIds: ['node_main_ave_center', 'node_east_feeder_junction'],
      highwayCorridorNodeIds: ['node_gateway_highway_east'],
      boundaryGatewayId: 'gateway_highway_east',
      destinationName: 'Eastern Seaboard Marine Harbor & Free Trade Zone',
      estimatedOnScreenDistanceMeters: 62.0,
      estimatedOffScreenKm: 180.0,
      nominalTransitTimeSeconds: 52,
    };
  }

  /**
   * Helper to evaluate whether a vehicle is currently at or crossing a visual transition boundary
   */
  public static isAtVisualBoundary(
    worldPos: { x: number; y: number; z: number },
    gateway: VisualBoundaryGateway
  ): boolean {
    const dx = worldPos.x - gateway.worldPosition.x;
    const dz = worldPos.z - gateway.worldPosition.z;
    const distSq = dx * dx + dz * dz;
    return distSq <= gateway.transitionRadiusMeters * gateway.transitionRadiusMeters;
  }
}
