/**
 * Road Traffic Flow, Intersection Coordination & Simulation Types
 * Global Transport Empire - Civil Road Infrastructure & Vehicle Simulation
 */

import { VehicleEntity } from '../../entities/vehicles/VehicleEntity';

export type TrafficVehicleState =
  | 'idle_parked'
  | 'pulling_out_depot'
  | 'cruising'
  | 'following_lead'
  | 'approaching_junction'
  | 'waiting_intersection'
  | 'traversing_junction'
  | 'entering_depot'
  | 'parking'
  | 'rerouting'
  | 'stopped_unreachable'
  | 'offscreen_transit';

export interface TrafficLaneWaypoint {
  x: number;
  y: number;
  z: number;
  headingDegrees: number;
  speedLimitKmh: number;
  roadType: string;
  laneIndex: number;
  isJunction: boolean;
  junctionId?: string;
  isStopLine?: boolean;
  isTurnApex?: boolean;
  isDepotAccess?: boolean;
  name?: string;
}

export interface JunctionReservation {
  junctionId: string;
  occupyingVehicleId: string | null;
  incomingDirection: 'north' | 'south' | 'east' | 'west' | 'depot';
  outgoingDirection: 'north' | 'south' | 'east' | 'west' | 'depot';
  timeGrantedMs: number;
  clearedDistanceMeters: number;
  heldDurationSeconds?: number;
}

export interface JunctionApproachQueueItem {
  vehicleId: string;
  approach: 'north' | 'south' | 'east' | 'west' | 'depot';
  arrivalTimeMs: number;
  isPriority: boolean;
}

export interface TrafficDiagnosticsSummary {
  activeSimulatedVehicles: number;
  vehiclesCruising: number;
  vehiclesFollowing: number;
  vehiclesWaitingIntersection: number;
  vehiclesParkedInDepot: number;
  activeJunctionReservations: number;
  deadlocksDetectedAndResolved: number;
  rerouteEventsCount: number;
  averageFleetSpeedKmh: number;
}

export interface DispatchJourneyRequest {
  vehicleId: string;
  destinationName: string;
  destinationEntityId?: string;
  targetGridX?: number;
  targetGridZ?: number;
  originFacilityId?: string;
  targetFacilityId?: string;
  autoReturn?: boolean;
  criterion?: 'shortest' | 'fastest';
  avoidCongestion?: boolean;
}

export type OperationalStateBadge =
  | 'Available'
  | 'Preparing Departure'
  | 'Travelling'
  | 'Waiting at Intersection'
  | 'Temporarily Blocked'
  | 'Arrived at Destination'
  | 'Returning to Depot'
  | 'Route Blocked';

export type RoadCongestionState =
  | 'free_flowing'
  | 'busy'
  | 'congested'
  | 'temporarily_blocked'
  | 'unavailable'
  | 'unknown';

export interface RoadSegmentTrafficCondition {
  cellKey: string; // "gridX,gridZ"
  gridX: number;
  gridZ: number;
  congestionState: RoadCongestionState;
  vehicleCount: number;
  averageSpeedKmh: number;
  speedLimitKmh: number;
  occupancyRatio: number; // 0.0 to 1.0+
  isBlocked: boolean;
  blockageReason?: string;
  lastUpdatedMs: number;
}

export type BlockageCause =
  | 'intersection_conflict'
  | 'lead_vehicle_standstill'
  | 'road_demolished'
  | 'no_route_forward'
  | 'queue_timeout'
  | 'stale_reservation';

export interface BlockageEvent {
  vehicleId: string;
  gridX: number;
  gridZ: number;
  cause: BlockageCause;
  durationSeconds: number;
  detourAttempted: boolean;
  detourSucceeded: boolean;
}

export interface VehicleRouteProgressInfo {
  vehicleId: string;
  state: TrafficVehicleState;
  operationalStatus: OperationalStateBadge;
  destinationName: string;
  hasActiveRoute: boolean;
  totalDistanceMeters: number;
  distanceTraveledMeters: number;
  distanceRemainingMeters: number;
  progressPercent: number; // 0 to 100
  estimatedTimeRemainingSeconds: number;
  currentSpeedKmh: number;
  speedLimitKmh: number;
  isReturnTrip: boolean;
  criterion?: 'shortest' | 'fastest';
  congestionLevel?: RoadCongestionState;
  blockageReason?: string;
  delaySeconds?: number;
  accessPoint?: {
    gridX: number;
    gridZ: number;
    worldX: number;
    worldZ: number;
    accessType: string;
  };
  remainingWaypoints: Array<{ x: number; y: number; z: number }>;
}


