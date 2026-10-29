export type RoadTypeId =
  | 'two_lane_urban'
  | 'heavy_arterial'
  | 'highway_corridor'
  | 'highway_ramp'
  | 'industrial_access';

export type RoadHierarchyClass = 'local' | 'arterial' | 'highway';

export interface RoadDefinition {
  id: RoadTypeId;
  name: string;
  categoryLabel: string;
  hierarchyClass: RoadHierarchyClass;
  description: string;
  costPerCell: number;
  dailyUpkeep: number;
  maxSpeedKmh: number;
  widthUnits: number;
  colorAccent: string;
  markingStyle: 'dashed_white' | 'dual_yellow' | 'highway_divided' | 'ramp_chevron' | 'gravel_edge';
  hasGuardrails?: boolean;
  hasCurbs?: boolean;
}

export const ROAD_DEFINITIONS: Record<RoadTypeId, RoadDefinition> = {
  two_lane_urban: {
    id: 'two_lane_urban',
    name: 'Municipal Local Street',
    categoryLabel: 'Local Street',
    hierarchyClass: 'local',
    description: 'High-grade municipal asphalt street with concrete curbs and standard dashed white lane divider. Connects buildings, facilities, and local districts.',
    costPerCell: 120,
    dailyUpkeep: 2,
    maxSpeedKmh: 50,
    widthUnits: 4.0,
    colorAccent: '#38bdf8',
    markingStyle: 'dashed_white',
    hasCurbs: true,
  },
  heavy_arterial: {
    id: 'heavy_arterial',
    name: 'Heavy Freight Arterial',
    categoryLabel: 'Arterial Avenue',
    hierarchyClass: 'arterial',
    description: 'Reinforced dual-lane arterial avenue with dual yellow centerline and concrete shoulders. Connects local access routes to industrial zones and highways.',
    costPerCell: 250,
    dailyUpkeep: 5,
    maxSpeedKmh: 75,
    widthUnits: 4.0,
    colorAccent: '#f59e0b',
    markingStyle: 'dual_yellow',
    hasCurbs: true,
  },
  highway_corridor: {
    id: 'highway_corridor',
    name: 'Divided Regional Highway',
    categoryLabel: 'Express Highway',
    hierarchyClass: 'highway',
    description: 'Heavy-duty high-speed expressway corridor with continuous inner yellow median, dashed lane guides, solid shoulder striping, and outer steel W-beam safety guardrails.',
    costPerCell: 450,
    dailyUpkeep: 10,
    maxSpeedKmh: 110,
    widthUnits: 4.0,
    colorAccent: '#ef4444',
    markingStyle: 'highway_divided',
    hasGuardrails: true,
  },
  highway_ramp: {
    id: 'highway_ramp',
    name: 'Interchange On/Off Ramp',
    categoryLabel: 'Highway Ramp',
    hierarchyClass: 'highway',
    description: 'Engineered grade connector linking arterial avenues to high-speed highway corridors. Features directional merge chevrons and deceleration striping.',
    costPerCell: 320,
    dailyUpkeep: 6,
    maxSpeedKmh: 60,
    widthUnits: 4.0,
    colorAccent: '#a855f7',
    markingStyle: 'ramp_chevron',
    hasGuardrails: true,
  },
  industrial_access: {
    id: 'industrial_access',
    name: 'Industrial Service Track',
    categoryLabel: 'Service Track',
    hierarchyClass: 'local',
    description: 'Compact aggregate asphalt road designed for internal warehouse aprons, depot spurs, and yard access at reduced construction cost.',
    costPerCell: 60,
    dailyUpkeep: 1,
    maxSpeedKmh: 35,
    widthUnits: 4.0,
    colorAccent: '#10b981',
    markingStyle: 'gravel_edge',
    hasCurbs: false,
  },
};
