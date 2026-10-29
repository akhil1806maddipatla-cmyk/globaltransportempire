/**
 * Multi-Modal Transport Network Topology & Validation System
 * Global Transport Empire - Civil Infrastructure & Waypoint Graph
 *
 * Enforces strict physical isolation between modes:
 * Roads, Railways, Waterways, and Air corridors are discrete graph layers
 * that never illegally cross-connect.
 */

export type TransportMode = 'road' | 'rail' | 'waterway' | 'air';

export type RoadSegmentType =
  | 'local_street'
  | 'arterial'
  | 'highway_corridor'
  | 'depot_access_ramp'
  | 'industrial_track';

export type RailSegmentType = 'mainline_track' | 'yard_siding' | 'intermodal_lead';
export type WaterwaySegmentType = 'navigable_channel' | 'harbor_basin' | 'berth_approach';
export type AirSegmentType = 'runway' | 'taxiway' | 'departure_corridor';

export type SegmentType = RoadSegmentType | RailSegmentType | WaterwaySegmentType | AirSegmentType;

export type NodeType =
  | 'depot_entrance'
  | 'local_junction'
  | 'arterial_intersection'
  | 'highway_interchange'
  | 'visual_transition_gateway'
  | 'rail_terminal'
  | 'rail_switch'
  | 'port_berth'
  | 'shipping_buoy'
  | 'runway_threshold'
  | 'airspace_waypoint';

export interface TransportNode {
  id: string;
  mode: TransportMode;
  nodeType: NodeType;
  name: string;
  gridX: number;
  gridZ: number;
  worldPosition: { x: number; y: number; z: number };
  isBoundaryTransition?: boolean;
}

export interface TransportEdge {
  id: string;
  mode: TransportMode;
  segmentType: SegmentType;
  fromNodeId: string;
  toNodeId: string;
  lengthMeters: number;
  speedLimitKmh: number;
  bidirectional: boolean;
  lanesOrTracks: number;
}

export class TransportNetwork {
  private nodes: Map<string, TransportNode> = new Map();
  private edges: Map<string, TransportEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // node -> connected edgeIds

  public addNode(node: TransportNode): boolean {
    if (this.nodes.has(node.id)) return false;
    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, new Set());
    return true;
  }

  public getNode(id: string): TransportNode | null {
    return this.nodes.get(id) ?? null;
  }

  public getAllNodes(): TransportNode[] {
    return Array.from(this.nodes.values());
  }

  public getNodesByMode(mode: TransportMode): TransportNode[] {
    return this.getAllNodes().filter((n) => n.mode === mode);
  }

  public getBoundaryTransitionNodes(): TransportNode[] {
    return this.getAllNodes().filter((n) => n.isBoundaryTransition === true);
  }

  /**
   * Adds a network edge, strictly validating that both nodes belong to the exact same mode!
   */
  public addEdge(edge: TransportEdge): { success: boolean; error?: string } {
    const fromNode = this.nodes.get(edge.fromNodeId);
    const toNode = this.nodes.get(edge.toNodeId);

    if (!fromNode || !toNode) {
      return { success: false, error: 'One or both endpoint nodes do not exist in the network.' };
    }

    // Strict Mode Separation Validation
    if (fromNode.mode !== edge.mode || toNode.mode !== edge.mode) {
      return {
        success: false,
        error: `Mode violation: Cannot connect ${fromNode.mode} node with ${toNode.mode} via ${edge.mode} edge. Modes must be strictly segregated.`,
      };
    }

    this.edges.set(edge.id, edge);
    this.adjacencyList.get(edge.fromNodeId)?.add(edge.id);
    this.adjacencyList.get(edge.toNodeId)?.add(edge.id);

    return { success: true };
  }

  public getEdge(id: string): TransportEdge | null {
    return this.edges.get(id) ?? null;
  }

  public getAllEdges(): TransportEdge[] {
    return Array.from(this.edges.values());
  }

  public getEdgesByMode(mode: TransportMode): TransportEdge[] {
    return this.getAllEdges().filter((e) => e.mode === mode);
  }

  public getConnectedEdges(nodeId: string): TransportEdge[] {
    const edgeIds = this.adjacencyList.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((e): e is TransportEdge => e !== undefined);
  }

  /**
   * Returns neighbor nodes that can be reached from the given node along edges of matching mode
   */
  public getNeighborNodes(nodeId: string): TransportNode[] {
    const fromNode = this.nodes.get(nodeId);
    if (!fromNode) return [];

    const connectedEdges = this.getConnectedEdges(nodeId);
    const neighbors: TransportNode[] = [];

    for (const edge of connectedEdges) {
      if (edge.fromNodeId === nodeId) {
        const target = this.nodes.get(edge.toNodeId);
        if (target) neighbors.push(target);
      } else if (edge.bidirectional && edge.toNodeId === nodeId) {
        const target = this.nodes.get(edge.fromNodeId);
        if (target) neighbors.push(target);
      }
    }

    return neighbors;
  }

  /**
   * Initializes default regional network topology connecting the starting Level 1 Depot
   * through local streets, arterial freight avenues, highway corridors,
   * and designated visual transition boundaries.
   */
  public initializeStartingTopology(depotGridX: number = 11, depotGridZ: number = 14): void {
    const toWorld = (gx: number, gz: number) => ({
      x: -48.0 + (gx + 0.5) * 4.0,
      y: 0.0,
      z: -48.0 + (gz + 0.5) * 4.0,
    });

    // 1. Level 1 Truck Depot Entrance Node (X=11, Z=14)
    this.addNode({
      id: 'node_depot_entrance',
      mode: 'road',
      nodeType: 'depot_entrance',
      name: 'Primary Truck Depot Gate (Level 1)',
      gridX: depotGridX,
      gridZ: depotGridZ,
      worldPosition: toWorld(depotGridX, depotGridZ),
    });

    // 2. Local Access Spur Junction (X=11, Z=12)
    this.addNode({
      id: 'node_depot_spur_junction',
      mode: 'road',
      nodeType: 'local_junction',
      name: 'Depot Access Spur Intersect',
      gridX: depotGridX,
      gridZ: 12,
      worldPosition: toWorld(depotGridX, 12),
    });

    // 3. Main Avenue Central T-Junction (X=11, Z=11)
    this.addNode({
      id: 'node_main_ave_center',
      mode: 'road',
      nodeType: 'arterial_intersection',
      name: 'Central Freight Avenue Intersection',
      gridX: 11,
      gridZ: 11,
      worldPosition: toWorld(11, 11),
    });

    // 4. Northern Industrial District Node (X=11, Z=3)
    this.addNode({
      id: 'node_industrial_north',
      mode: 'road',
      nodeType: 'arterial_intersection',
      name: 'Apex Manufacturing Industrial Terminal',
      gridX: 11,
      gridZ: 3,
      worldPosition: toWorld(11, 3),
    });

    // 5. East Logistics Feeder Junction (X=17, Z=11)
    this.addNode({
      id: 'node_east_feeder_junction',
      mode: 'road',
      nodeType: 'arterial_intersection',
      name: 'East Intermodal Feeder Interchange',
      gridX: 17,
      gridZ: 11,
      worldPosition: toWorld(17, 11),
    });

    // 6. Southern Logistics Terminal Node (X=17, Z=19)
    this.addNode({
      id: 'node_southern_logistics',
      mode: 'road',
      nodeType: 'local_junction',
      name: 'South Logistics Hub Feeder Gate',
      gridX: 17,
      gridZ: 19,
      worldPosition: toWorld(17, 19),
    });

    // 7. West Urban Gateway / Highway Interchange (X=2, Z=11)
    this.addNode({
      id: 'node_west_highway_interchange',
      mode: 'road',
      nodeType: 'highway_interchange',
      name: 'West Regional Highway Ramp',
      gridX: 2,
      gridZ: 11,
      worldPosition: toWorld(2, 11),
    });

    // 8. Visual Transition Boundary: West Highway Gateway (X=0, Z=11)
    // Marks where road vehicles transition between visible scene and off-screen regional simulation!
    this.addNode({
      id: 'node_gateway_highway_west',
      mode: 'road',
      nodeType: 'visual_transition_gateway',
      name: 'Continental Interstate Highway Corridor [Visual Boundary]',
      gridX: 0,
      gridZ: 11,
      worldPosition: toWorld(0, 11),
      isBoundaryTransition: true,
    });

    // 9. Visual Transition Boundary: East Harbor Gateway (X=23, Z=11)
    this.addNode({
      id: 'node_gateway_highway_east',
      mode: 'road',
      nodeType: 'visual_transition_gateway',
      name: 'Maritime Coastal Highway Terminal [Visual Boundary]',
      gridX: 23,
      gridZ: 11,
      worldPosition: toWorld(23, 11),
      isBoundaryTransition: true,
    });

    // Connect Road Segments across Hierarchy:
    // Depot Gate -> Spur Junction (Local depot access ramp)
    this.addEdge({
      id: 'edge_depot_spur',
      mode: 'road',
      segmentType: 'depot_access_ramp',
      fromNodeId: 'node_depot_entrance',
      toNodeId: 'node_depot_spur_junction',
      lengthMeters: 8.0,
      speedLimitKmh: 35,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // Spur Junction -> Main Ave Center (Local municipal street)
    this.addEdge({
      id: 'edge_spur_to_main',
      mode: 'road',
      segmentType: 'local_street',
      fromNodeId: 'node_depot_spur_junction',
      toNodeId: 'node_main_ave_center',
      lengthMeters: 4.0,
      speedLimitKmh: 50,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // Main Ave Center -> Industrial North (Heavy freight arterial)
    this.addEdge({
      id: 'edge_industrial_branch',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_main_ave_center',
      toNodeId: 'node_industrial_north',
      lengthMeters: 32.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // Main Ave Center -> East Feeder Junction (Heavy freight arterial)
    this.addEdge({
      id: 'edge_main_ave_east',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_main_ave_center',
      toNodeId: 'node_east_feeder_junction',
      lengthMeters: 24.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // East Feeder Junction -> Southern Logistics (Heavy freight arterial)
    this.addEdge({
      id: 'edge_logistics_feeder',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_east_feeder_junction',
      toNodeId: 'node_southern_logistics',
      lengthMeters: 32.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // Main Ave Center -> West Highway Interchange (Arterial connection)
    this.addEdge({
      id: 'edge_main_ave_west',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_main_ave_center',
      toNodeId: 'node_west_highway_interchange',
      lengthMeters: 36.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // West Interchange -> Highway Gateway (Divided regional highway corridor)
    this.addEdge({
      id: 'edge_highway_transition_west',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_west_highway_interchange',
      toNodeId: 'node_gateway_highway_west',
      lengthMeters: 8.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // East Feeder -> East Gateway (Divided regional highway corridor)
    this.addEdge({
      id: 'edge_highway_transition_east',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_east_feeder_junction',
      toNodeId: 'node_gateway_highway_east',
      lengthMeters: 24.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // --- EXPANDED REGIONAL HIGHWAY & ARTERIAL NETWORK NODES & EDGES ---
    // 9A. Interstate 1 & Interstate 99 Central Interchange Junction (X=24, Z=11)
    this.addNode({
      id: 'node_highway_i1_cloverleaf',
      mode: 'road',
      nodeType: 'highway_interchange',
      name: 'Central Continental Interstate Cloverleaf Junction (I-1 & I-99)',
      gridX: 24,
      gridZ: 11,
      worldPosition: toWorld(24, 11),
    });

    // 9B. Interstate 1 Far Eastern Marine Seaway Gateway (X=54, Z=11)
    this.addNode({
      id: 'node_highway_i1_east_terminal',
      mode: 'road',
      nodeType: 'visual_transition_gateway',
      name: 'Far East Maritime Highway Gateway [Visual Boundary]',
      gridX: 54,
      gridZ: 11,
      worldPosition: toWorld(54, 11),
      isBoundaryTransition: true,
    });

    // 9C. Interstate 99 North Freight Rail Gateway (X=24, Z=1)
    this.addNode({
      id: 'node_highway_i99_north_gateway',
      mode: 'road',
      nodeType: 'highway_interchange',
      name: 'North Rail Freight Corridor Expressway Interchange',
      gridX: 24,
      gridZ: 1,
      worldPosition: toWorld(24, 1),
    });

    // 9D. Interstate 99 & Delta Boulevard South Interchange (X=24, Z=36)
    this.addNode({
      id: 'node_highway_i99_south_interchange',
      mode: 'road',
      nodeType: 'highway_interchange',
      name: 'South Intermodal Logistics Expressway Interchange',
      gridX: 24,
      gridZ: 36,
      worldPosition: toWorld(24, 36),
    });

    // 9E. Interstate 99 South Delta Marine Gateway (X=24, Z=48)
    this.addNode({
      id: 'node_highway_i99_south_gateway',
      mode: 'road',
      nodeType: 'visual_transition_gateway',
      name: 'Southern Delta Marine Expressway Gateway [Visual Boundary]',
      gridX: 24,
      gridZ: 48,
      worldPosition: toWorld(24, 48),
      isBoundaryTransition: true,
    });

    // 9F. Delta Regional Arterial West Hub (X=12, Z=36)
    this.addNode({
      id: 'node_delta_arterial_west',
      mode: 'road',
      nodeType: 'arterial_intersection',
      name: 'Southwest Logistics Arterial Hub',
      gridX: 12,
      gridZ: 36,
      worldPosition: toWorld(12, 36),
    });

    // 9G. Seaport Deepwater Arterial Terminal (X=38, Z=36)
    this.addNode({
      id: 'node_seaport_arterial_south',
      mode: 'road',
      nodeType: 'arterial_intersection',
      name: 'Grand Harbor Deepwater Marine Arterial Junction',
      gridX: 38,
      gridZ: 36,
      worldPosition: toWorld(38, 36),
    });

    // Connect Expanded Edges:
    // East Gateway -> Central Cloverleaf (I-1 Corridor)
    this.addEdge({
      id: 'edge_i1_gateway_to_cloverleaf',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_gateway_highway_east',
      toNodeId: 'node_highway_i1_cloverleaf',
      lengthMeters: 4.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // Central Cloverleaf -> Far East Terminal (I-1 Viaduct & Corridor)
    this.addEdge({
      id: 'edge_i1_cloverleaf_to_east_terminal',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_highway_i1_cloverleaf',
      toNodeId: 'node_highway_i1_east_terminal',
      lengthMeters: 120.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // Central Cloverleaf -> I-99 North
    this.addEdge({
      id: 'edge_i99_cloverleaf_to_north',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_highway_i1_cloverleaf',
      toNodeId: 'node_highway_i99_north_gateway',
      lengthMeters: 40.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // Central Cloverleaf -> I-99 South Interchange
    this.addEdge({
      id: 'edge_i99_cloverleaf_to_south',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_highway_i1_cloverleaf',
      toNodeId: 'node_highway_i99_south_interchange',
      lengthMeters: 100.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // I-99 South Interchange -> I-99 South Gateway
    this.addEdge({
      id: 'edge_i99_south_to_gateway',
      mode: 'road',
      segmentType: 'highway_corridor',
      fromNodeId: 'node_highway_i99_south_interchange',
      toNodeId: 'node_highway_i99_south_gateway',
      lengthMeters: 48.0,
      speedLimitKmh: 110,
      bidirectional: true,
      lanesOrTracks: 4,
    });

    // I-99 South Interchange -> Delta Arterial West
    this.addEdge({
      id: 'edge_delta_boulevard_west',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_highway_i99_south_interchange',
      toNodeId: 'node_delta_arterial_west',
      lengthMeters: 48.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // I-99 South Interchange -> Seaport Arterial South
    this.addEdge({
      id: 'edge_delta_boulevard_east',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_highway_i99_south_interchange',
      toNodeId: 'node_seaport_arterial_south',
      lengthMeters: 56.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // Southern Logistics -> Delta Arterial West
    this.addEdge({
      id: 'edge_logistics_to_delta',
      mode: 'road',
      segmentType: 'arterial',
      fromNodeId: 'node_southern_logistics',
      toNodeId: 'node_delta_arterial_west',
      lengthMeters: 68.0,
      speedLimitKmh: 75,
      bidirectional: true,
      lanesOrTracks: 2,
    });

    // 10. Grounding Rail Corridor & Waterway Segments (Discrete layers)
    this.addNode({
      id: 'node_rail_mainline_north',
      mode: 'rail',
      nodeType: 'visual_transition_gateway',
      name: 'North Intermodal Railway Spine [Visual Boundary]',
      gridX: 22,
      gridZ: 0,
      worldPosition: { x: 40.0, y: 0.3, z: -46.0 },
      isBoundaryTransition: true,
    });

    this.addNode({
      id: 'node_waterway_nav_channel',
      mode: 'waterway',
      nodeType: 'visual_transition_gateway',
      name: 'Deepwater Shipping Channel [Visual Boundary]',
      gridX: 0,
      gridZ: 23,
      worldPosition: { x: -46.0, y: -0.5, z: 46.0 },
      isBoundaryTransition: true,
    });
  }

  /**
   * Finds shortest path between two nodes for a specific transport mode using Dijkstra algorithm
   */
  public findPath(
    fromNodeId: string,
    toNodeId: string,
    mode: TransportMode = 'road'
  ): {
    found: boolean;
    pathNodes: TransportNode[];
    edgeIds: string[];
    totalDistanceMeters: number;
    estimatedTravelTimeSeconds: number;
    error?: string;
  } {
    const startNode = this.nodes.get(fromNodeId);
    const endNode = this.nodes.get(toNodeId);

    if (!startNode || !endNode) {
      return {
        found: false,
        pathNodes: [],
        edgeIds: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        error: `Endpoint node(s) do not exist: ${fromNodeId} -> ${toNodeId}`,
      };
    }

    if (startNode.mode !== mode || endNode.mode !== mode) {
      return {
        found: false,
        pathNodes: [],
        edgeIds: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        error: `Mode mismatch: path requires ${mode}, but nodes are ${startNode.mode} / ${endNode.mode}`,
      };
    }

    const distances = new Map<string, number>();
    const travelTimes = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edgeId: string } | null>();
    const unvisited = new Set<string>();

    for (const node of this.nodes.values()) {
      if (node.mode === mode) {
        distances.set(node.id, Infinity);
        travelTimes.set(node.id, Infinity);
        previous.set(node.id, null);
        unvisited.add(node.id);
      }
    }

    distances.set(fromNodeId, 0);
    travelTimes.set(fromNodeId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentId: string | null = null;
      let minDistance = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id) ?? Infinity;
        if (d < minDistance) {
          minDistance = d;
          currentId = id;
        }
      }

      if (!currentId || minDistance === Infinity) break;
      if (currentId === toNodeId) break;

      unvisited.delete(currentId);
      const currentDist = distances.get(currentId)!;
      const currentTime = travelTimes.get(currentId)!;

      const edges = this.getConnectedEdges(currentId).filter((e) => e.mode === mode);
      for (const edge of edges) {
        const neighborId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
        if (!unvisited.has(neighborId)) continue;
        if (!edge.bidirectional && edge.fromNodeId !== currentId) continue;

        const newDist = currentDist + edge.lengthMeters;
        const speedMs = (edge.speedLimitKmh * 1000) / 3600;
        const edgeTimeSec = edge.lengthMeters / Math.max(speedMs, 1);
        const newTime = currentTime + edgeTimeSec;

        if (newDist < (distances.get(neighborId) ?? Infinity)) {
          distances.set(neighborId, newDist);
          travelTimes.set(neighborId, newTime);
          previous.set(neighborId, { nodeId: currentId, edgeId: edge.id });
        }
      }
    }

    if (distances.get(toNodeId) === Infinity) {
      return {
        found: false,
        pathNodes: [],
        edgeIds: [],
        totalDistanceMeters: 0,
        estimatedTravelTimeSeconds: 0,
        error: `No route exists between ${fromNodeId} and ${toNodeId}`,
      };
    }

    // Reconstruct path
    const pathNodes: TransportNode[] = [];
    const edgeIds: string[] = [];
    let curr: string | null = toNodeId;

    while (curr) {
      const node = this.nodes.get(curr);
      if (node) pathNodes.unshift(node);

      const prev = previous.get(curr);
      if (prev) {
        edgeIds.unshift(prev.edgeId);
        curr = prev.nodeId;
      } else {
        curr = null;
      }
    }

    return {
      found: true,
      pathNodes,
      edgeIds,
      totalDistanceMeters: distances.get(toNodeId) ?? 0,
      estimatedTravelTimeSeconds: Math.round(travelTimes.get(toNodeId) ?? 0),
    };
  }

  /**
   * Diagnostic verification of the entire road hierarchy & connectivity
   */
  public validateRoadHierarchyAndConnectivity(): {
    isValid: boolean;
    depotConnectedToSpur: boolean;
    depotConnectedToHighwayWest: boolean;
    depotConnectedToHighwayEast: boolean;
    totalRoadNodes: number;
    totalRoadEdges: number;
    boundaryGatewaysReachable: number;
    roadHierarchyBreakdown: Record<string, number>;
    issues: string[];
  } {
    const roadNodes = this.getNodesByMode('road');
    const roadEdges = this.getEdgesByMode('road');
    const issues: string[] = [];

    // Check breakdown by segment type
    const roadHierarchyBreakdown: Record<string, number> = {};
    for (const edge of roadEdges) {
      roadHierarchyBreakdown[edge.segmentType] = (roadHierarchyBreakdown[edge.segmentType] || 0) + 1;
    }

    // Verify Depot connectivity
    const westPath = this.findPath('node_depot_entrance', 'node_gateway_highway_west', 'road');
    const eastPath = this.findPath('node_depot_entrance', 'node_gateway_highway_east', 'road');
    const spurPath = this.findPath('node_depot_entrance', 'node_depot_spur_junction', 'road');

    if (!spurPath.found) {
      issues.push('Starting Truck Depot is disconnected from the local access spur!');
    }
    if (!westPath.found) {
      issues.push('Starting Truck Depot cannot reach the West Highway Gateway!');
    }
    if (!eastPath.found) {
      issues.push('Starting Truck Depot cannot reach the East Highway Gateway!');
    }

    // Check for orphaned nodes
    for (const node of roadNodes) {
      const edges = this.getConnectedEdges(node.id).filter((e) => e.mode === 'road');
      if (edges.length === 0) {
        issues.push(`Road node '${node.id}' (${node.name}) is orphaned with 0 connections.`);
      }
    }

    const reachableGateways = (westPath.found ? 1 : 0) + (eastPath.found ? 1 : 0);

    return {
      isValid: issues.length === 0,
      depotConnectedToSpur: spurPath.found,
      depotConnectedToHighwayWest: westPath.found,
      depotConnectedToHighwayEast: eastPath.found,
      totalRoadNodes: roadNodes.length,
      totalRoadEdges: roadEdges.length,
      boundaryGatewaysReachable: reachableGateways,
      roadHierarchyBreakdown,
      issues,
    };
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
}
