import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { RoadNetworkModel, RoadCellData } from './RoadNetworkModel';
import { RoadTypeId, ROAD_DEFINITIONS } from '../data/roadDefinitions';
import { InitialRoadSegment } from '../data/initialWorldData';
import { GridCoord } from './RoadPathGenerator';
import { RoadIntersectionFactory } from './RoadIntersectionFactory';

export class RoadNetwork implements IDisposable {
  public readonly group: THREE.Group;
  public readonly model: RoadNetworkModel;
  private gridSystem: GridSystem;
  private materialsManager: MaterialsManager;
  private cellMeshes = new Map<string, THREE.Group>();

  constructor(gridSystem: GridSystem, materialsManager: MaterialsManager) {
    this.gridSystem = gridSystem;
    this.materialsManager = materialsManager;
    this.model = new RoadNetworkModel(gridSystem);
    this.group = new THREE.Group();
    this.group.name = 'road_network';
  }

  public buildFromInitialData(initialSegments: InitialRoadSegment[]): void {
    for (const seg of initialSegments) {
      const type: RoadTypeId = (seg.type as RoadTypeId) || 'two_lane_urban';
      if (seg.direction === 'horizontal') {
        for (let i = 0; i < seg.length; i++) {
          this.model.addRoadCell(seg.gridX + i, seg.gridZ, type, seg.id);
        }
      } else {
        for (let i = 0; i < seg.length; i++) {
          this.model.addRoadCell(seg.gridX, seg.gridZ + i, type, seg.id);
        }
      }
    }

    this.rebuildAllMeshes();
  }

  public rebuildAllMeshes(): void {
    this.clearMeshes();

    const roadCells = this.model.getAllRoadCells();
    for (const cell of roadCells) {
      const meshGroup = this.createRoadCellMesh(cell);
      const key = `${cell.gridX},${cell.gridZ}`;
      this.cellMeshes.set(key, meshGroup);
      this.group.add(meshGroup);
    }
  }

  /**
   * Generates a 3D road cell with asphalt plate, dynamic curbs/guardrails, and type-specific markings
   */
  private createRoadCellMesh(cell: RoadCellData): THREE.Group {
    const group = new THREE.Group();
    group.name = `road_cell_${cell.gridX}_${cell.gridZ}`;

    const center = this.gridSystem.gridToWorldCenter(cell.gridX, cell.gridZ);
    const cellSize = this.gridSystem.cellSize;
    const groundY = this.gridSystem.getTerrainHeight ? this.gridSystem.getTerrainHeight(center.x, center.z) : 0;
    const elev = cell.elevation !== undefined ? cell.elevation : groundY + 0.04;
    group.position.set(center.x, elev, center.z);

    // 1. Asphalt Surface Material based on road hierarchy
    let asphaltMat = this.materialsManager.get('road_asphalt');
    const isHighway = cell.roadType === 'highway_corridor';
    const isRamp = cell.roadType === 'highway_ramp';
    const isArterial = cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial';
    const isService = cell.roadType === 'industrial_access' || cell.roadType === 'access';

    if (isHighway) {
      asphaltMat = this.materialsManager.get('road_highway_asphalt') || this.materialsManager.get('highway_asphalt');
    } else if (isArterial || isRamp) {
      asphaltMat = this.materialsManager.get('road_arterial_asphalt');
    } else if (isService) {
      asphaltMat = this.materialsManager.get('road_industrial_pavement') || this.materialsManager.get('road_access_gravel');
    } else {
      asphaltMat = this.materialsManager.get('road_local_asphalt') || this.materialsManager.get('road_asphalt');
    }

    // Asphalt surface plate (covers full cell, seamless between adjacent cells)
    const asphaltGeo = new THREE.PlaneGeometry(cellSize, cellSize);
    const posAttr = asphaltGeo.attributes.position;
    const uvAttr = asphaltGeo.attributes.uv;
    if (uvAttr && posAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        const lx = posAttr.getX(i);
        const ly = posAttr.getY(i);
        // Plane is rotated -Math.PI/2 around X, so worldX = center.x + lx, worldZ = center.z - ly
        const wx = center.x + lx;
        const wz = center.z - ly;
        uvAttr.setXY(i, wx * 0.5, wz * 0.5);
      }
      uvAttr.needsUpdate = true;
    }
    const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphaltMesh.rotation.x = -Math.PI / 2;
    asphaltMesh.position.y = 0.002; // Sits directly on cell group elevation plane
    asphaltMesh.receiveShadow = true;
    group.add(asphaltMesh);

    // 1b. Structural Concrete Deck Girder and Viaduct Support Piers for elevated highway/bridge sections
    const isElevated = (cell.elevation !== undefined && cell.elevation > groundY + 0.3) || cell.layer === 'bridge';
    if (isElevated) {
      const pierMat = this.materialsManager.get('bridge_pier_concrete');
      const girderDepth = 0.28;
      const girderGeo = new THREE.BoxGeometry(cellSize, girderDepth, cellSize);
      const girderMesh = new THREE.Mesh(girderGeo, pierMat);
      girderMesh.position.y = -girderDepth / 2;
      girderMesh.castShadow = true;
      girderMesh.receiveShadow = true;
      group.add(girderMesh);

      // Support viaduct pier column stretching down to ground level
      const pierHeight = elev - groundY;
      if (pierHeight > 0.4) {
        const pierGeo = new THREE.BoxGeometry(0.85, pierHeight, 0.85);
        const pier = new THREE.Mesh(pierGeo, pierMat);
        pier.position.set(0, -pierHeight / 2, 0);
        pier.castShadow = true;
        pier.receiveShadow = true;
        group.add(pier);

        // Transverse pier cap beam supporting the road deck
        const capGeo = new THREE.BoxGeometry(cellSize * 0.65, 0.32, cellSize * 0.65);
        const cap = new THREE.Mesh(capGeo, pierMat);
        cap.position.set(0, -girderDepth - 0.16, 0);
        cap.castShadow = true;
        group.add(cap);
      }
    }

    // 2. Specialized Intersection Rendering via RoadIntersectionFactory
    const isSpecialJunction =
      cell.junctionType === 't_junction' ||
      cell.junctionType === 'crossroad' ||
      cell.junctionType === 'roundabout' ||
      cell.junctionType === 'highway_merge' ||
      cell.junctionType === 'bridge_approach' ||
      cell.junctionType.startsWith('corner_');

    if (cell.junctionType === 't_junction') {
      RoadIntersectionFactory.buildTJunction(group, cell, cellSize, this.materialsManager);
    } else if (cell.junctionType === 'crossroad') {
      RoadIntersectionFactory.buildCrossroad(group, cell, cellSize, this.materialsManager);
    } else if (cell.junctionType === 'roundabout') {
      RoadIntersectionFactory.buildRoundabout(group, cell, cellSize, this.materialsManager);
    } else if (cell.junctionType === 'highway_merge') {
      RoadIntersectionFactory.buildHighwayMerge(group, cell, cellSize, this.materialsManager);
    } else if (cell.junctionType === 'bridge_approach') {
      RoadIntersectionFactory.buildBridgeApproach(group, cell, cellSize, this.materialsManager);
    } else if (cell.junctionType.startsWith('corner_')) {
      RoadIntersectionFactory.buildCurvedCorner(group, cell, cellSize, this.materialsManager);
    }

    // 3. Edge Protection: Steel Guardrails for Highways/Ramps, Curbs and Paver Sidewalks for Local/Arterial
    if (!isSpecialJunction) {
      if (isHighway || isRamp) {
        if (!cell.connections.north) this.addHighwayGuardrail(group, 'north', cellSize);
        if (!cell.connections.south) this.addHighwayGuardrail(group, 'south', cellSize);
        if (!cell.connections.east) this.addHighwayGuardrail(group, 'east', cellSize);
        if (!cell.connections.west) this.addHighwayGuardrail(group, 'west', cellSize);

        // Highway Center Median Jersey Barrier for divided carriageways
        if (isHighway) {
          const barrierMat = this.materialsManager.get('jersey_barrier_concrete');
          if (cell.junctionType === 'straight_horizontal') {
            const barrierGeo = new THREE.BoxGeometry(cellSize, 0.36, 0.16);
            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            barrier.position.set(0, 0.18, 0);
            barrier.castShadow = true;
            barrier.receiveShadow = true;
            group.add(barrier);
          } else if (cell.junctionType === 'straight_vertical') {
            const barrierGeo = new THREE.BoxGeometry(0.16, 0.36, cellSize);
            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            barrier.position.set(0, 0.18, 0);
            barrier.castShadow = true;
            barrier.receiveShadow = true;
            group.add(barrier);
          }
        }
      } else if (!isService) {
        const curbThickness = 0.14;
        const curbHeight = 0.07;
        const sidewalkDepth = 0.55;
        const sidewalkHeight = 0.05;
        const curbMat = this.materialsManager.get('concrete_curb');
        const sidewalkMat = this.materialsManager.get('sidewalk_concrete');

        const curbGeoH = new THREE.BoxGeometry(cellSize, curbHeight, curbThickness);
        const curbGeoV = new THREE.BoxGeometry(curbThickness, curbHeight, cellSize);
        const swGeoH = new THREE.BoxGeometry(cellSize, sidewalkHeight, sidewalkDepth);
        const swGeoV = new THREE.BoxGeometry(sidewalkDepth, sidewalkHeight, cellSize);

        // Check for dedicated building driveways / service entrances
        const isDrivewayE = cell.gridX === 11 && (cell.gridZ === 13 || cell.gridZ === 14);

        const shouldCurbN = cell.widthBlocks && cell.widthBlocks >= 2 && cell.corridorAxis === 'horizontal'
          ? !!cell.isOuterEdgeMin
          : !cell.connections.north;
        const shouldCurbS = cell.widthBlocks && cell.widthBlocks >= 2 && cell.corridorAxis === 'horizontal'
          ? !!cell.isOuterEdgeMax
          : !cell.connections.south;
        const shouldCurbW = cell.widthBlocks && cell.widthBlocks >= 2 && cell.corridorAxis === 'vertical'
          ? !!cell.isOuterEdgeMin
          : !cell.connections.west;
        const shouldCurbE = (cell.widthBlocks && cell.widthBlocks >= 2 && cell.corridorAxis === 'vertical'
          ? !!cell.isOuterEdgeMax
          : !cell.connections.east) && !isDrivewayE;

        if (shouldCurbN) {
          const swN = new THREE.Mesh(swGeoH, sidewalkMat);
          swN.position.set(0, sidewalkHeight / 2 + 0.005, -cellSize / 2 + sidewalkDepth / 2);
          swN.receiveShadow = true;
          group.add(swN);

          const curbN = new THREE.Mesh(curbGeoH, curbMat);
          curbN.position.set(0, curbHeight / 2 + 0.005, -cellSize / 2 + sidewalkDepth - curbThickness / 2);
          curbN.receiveShadow = true;
          group.add(curbN);
        }
        if (shouldCurbS) {
          const swS = new THREE.Mesh(swGeoH, sidewalkMat);
          swS.position.set(0, sidewalkHeight / 2 + 0.005, cellSize / 2 - sidewalkDepth / 2);
          swS.receiveShadow = true;
          group.add(swS);

          const curbS = new THREE.Mesh(curbGeoH, curbMat);
          curbS.position.set(0, curbHeight / 2 + 0.005, cellSize / 2 - sidewalkDepth + curbThickness / 2);
          curbS.receiveShadow = true;
          group.add(curbS);
        }
        if (shouldCurbE) {
          const swE = new THREE.Mesh(swGeoV, sidewalkMat);
          swE.position.set(cellSize / 2 - sidewalkDepth / 2, sidewalkHeight / 2 + 0.005, 0);
          swE.receiveShadow = true;
          group.add(swE);

          const curbE = new THREE.Mesh(curbGeoV, curbMat);
          curbE.position.set(cellSize / 2 - sidewalkDepth + curbThickness / 2, curbHeight / 2 + 0.005, 0);
          curbE.receiveShadow = true;
          group.add(curbE);
        } else if (isDrivewayE) {
          // Dropped curb / level driveway transition apron connecting to Level 1 Depot
          const apronGeo = new THREE.BoxGeometry(sidewalkDepth, 0.02, cellSize);
          const apronMat = this.materialsManager.get('concrete_industrial_yard') || sidewalkMat;
          const apron = new THREE.Mesh(apronGeo, apronMat);
          apron.position.set(cellSize / 2 - sidewalkDepth / 2, 0.015, 0);
          apron.receiveShadow = true;
          group.add(apron);
        }
        if (shouldCurbW) {
          const swW = new THREE.Mesh(swGeoV, sidewalkMat);
          swW.position.set(-cellSize / 2 + sidewalkDepth / 2, sidewalkHeight / 2 + 0.005, 0);
          swW.receiveShadow = true;
          group.add(swW);

          const curbW = new THREE.Mesh(curbGeoV, curbMat);
          curbW.position.set(-cellSize / 2 + sidewalkDepth - curbThickness / 2, curbHeight / 2 + 0.005, 0);
          curbW.receiveShadow = true;
          group.add(curbW);
        }
      }

      // Straight road markings
      this.addRoadMarkings(group, cell, cellSize);
    }

    return group;
  }

  /**
   * Builds realistic galvanized steel W-beam safety guardrails with I-posts along outer highway edges
   */
  private addHighwayGuardrail(group: THREE.Group, side: 'north' | 'south' | 'east' | 'west', cellSize: number): void {
    const steelMat = this.materialsManager.get('highway_guardrail_steel');
    const isHorizontal = side === 'north' || side === 'south';

    // Horizontal W-beam rail
    const railGeo = isHorizontal
      ? new THREE.BoxGeometry(cellSize, 0.22, 0.08)
      : new THREE.BoxGeometry(0.08, 0.22, cellSize);
    const rail = new THREE.Mesh(railGeo, steelMat);
    const railY = 0.42;
    rail.castShadow = true;

    // Support I-posts
    const postGeo = new THREE.BoxGeometry(0.08, 0.48, 0.08);

    if (side === 'north') {
      const zPos = -cellSize / 2 + 0.12;
      rail.position.set(0, railY, zPos);
      [-1.4, 0, 1.4].forEach((px) => {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(px, 0.24, zPos);
        post.castShadow = true;
        group.add(post);
      });
    } else if (side === 'south') {
      const zPos = cellSize / 2 - 0.12;
      rail.position.set(0, railY, zPos);
      [-1.4, 0, 1.4].forEach((px) => {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(px, 0.24, zPos);
        post.castShadow = true;
        group.add(post);
      });
    } else if (side === 'east') {
      const xPos = cellSize / 2 - 0.12;
      rail.position.set(xPos, railY, 0);
      [-1.4, 0, 1.4].forEach((pz) => {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(xPos, 0.24, pz);
        post.castShadow = true;
        group.add(post);
      });
    } else if (side === 'west') {
      const xPos = -cellSize / 2 + 0.12;
      rail.position.set(xPos, railY, 0);
      [-1.4, 0, 1.4].forEach((pz) => {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(xPos, 0.24, pz);
        post.castShadow = true;
        group.add(post);
      });
    }

    group.add(rail);
  }

  private addRoadMarkings(group: THREE.Group, cell: RoadCellData, cellSize: number): void {
    const isHighway = cell.roadType === 'highway_corridor';
    const isRamp = cell.roadType === 'highway_ramp';
    const isArterial = cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial';
    const isService = cell.roadType === 'industrial_access' || cell.roadType === 'access';

    const whiteMat = this.materialsManager.get('road_marking');
    const yellowMat = this.materialsManager.get('road_marking_yellow');
    const primaryMarkingMat = isArterial || isHighway ? yellowMat : whiteMat;

    // Flush road marking elevation: 3mm above asphalt plane (y=0.002) to eliminate floating gaps
    const MARKING_Y = 0.005;
    const STENCIL_Y = 0.0055;

    const hasCorridorMetadata = cell.widthBlocks !== undefined && cell.widthBlocks >= 2;

    if (cell.junctionType === 'straight_horizontal') {
      if (hasCorridorMetadata) {
        // Multi-block road corridor marking rules (Player-controlled width)
        // 1. Solid White Outer Edge Lines
        if (cell.isOuterEdgeMin) {
          const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.08);
          const edgeN = new THREE.Mesh(edgeGeo, whiteMat);
          edgeN.rotation.x = -Math.PI / 2;
          edgeN.position.set(0, MARKING_Y, -cellSize / 2 + 0.18);
          group.add(edgeN);
        }
        if (cell.isOuterEdgeMax) {
          const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.08);
          const edgeS = new THREE.Mesh(edgeGeo, whiteMat);
          edgeS.rotation.x = -Math.PI / 2;
          edgeS.position.set(0, MARKING_Y, cellSize / 2 - 0.18);
          group.add(edgeS);
        }

        // 2. Centre Divider between opposing directions
        if (cell.isCentreDividerEdgeMin) {
          const divGeo = new THREE.PlaneGeometry(cellSize, 0.12);
          const divN = new THREE.Mesh(divGeo, yellowMat);
          divN.rotation.x = -Math.PI / 2;
          divN.position.set(0, MARKING_Y, -cellSize / 2 + 0.06);
          group.add(divN);
        }
        if (cell.isCentreDividerEdgeMax) {
          const divGeo = new THREE.PlaneGeometry(cellSize, 0.12);
          const divS = new THREE.Mesh(divGeo, yellowMat);
          divS.rotation.x = -Math.PI / 2;
          divS.position.set(0, MARKING_Y, cellSize / 2 - 0.06);
          group.add(divS);
        }

        // 3. Dashed Internal Lane Dividers within each multi-lane carriageway
        if (cell.hasInternalDashedMin) {
          const dashGeo = new THREE.PlaneGeometry(cellSize * 0.7, 0.08);
          const dashN = new THREE.Mesh(dashGeo, whiteMat);
          dashN.rotation.x = -Math.PI / 2;
          dashN.position.set(0, MARKING_Y, -cellSize / 2 + 0.04);
          group.add(dashN);
        }
        if (cell.hasInternalDashedMax) {
          const dashGeo = new THREE.PlaneGeometry(cellSize * 0.7, 0.08);
          const dashS = new THREE.Mesh(dashGeo, whiteMat);
          dashS.rotation.x = -Math.PI / 2;
          dashS.position.set(0, MARKING_Y, cellSize / 2 - 0.04);
          group.add(dashS);
        }
      } else if (isHighway) {
        // True 4-lane divided highway (2 lanes per direction with central Jersey median)
        // 1. Dual Yellow Median Edge Lines hugging central Jersey barrier (barrier at z=0, width 0.16)
        const medLineGeo = new THREE.PlaneGeometry(cellSize, 0.06);
        const yellowNorth = new THREE.Mesh(medLineGeo, yellowMat);
        yellowNorth.rotation.x = -Math.PI / 2;
        yellowNorth.position.set(0, MARKING_Y, -0.16);
        group.add(yellowNorth);

        const yellowSouth = new THREE.Mesh(medLineGeo, yellowMat);
        yellowSouth.rotation.x = -Math.PI / 2;
        yellowSouth.position.set(0, MARKING_Y, 0.16);
        group.add(yellowSouth);

        // 2. Dashed White Lane Dividers separating Lane 1 and Lane 2 in both directions
        const dashGeo = new THREE.PlaneGeometry(cellSize * 0.7, 0.07);
        const dashNorth = new THREE.Mesh(dashGeo, whiteMat);
        dashNorth.rotation.x = -Math.PI / 2;
        dashNorth.position.set(0, MARKING_Y, -1.02);
        group.add(dashNorth);

        const dashSouth = new THREE.Mesh(dashGeo, whiteMat);
        dashSouth.rotation.x = -Math.PI / 2;
        dashSouth.position.set(0, MARKING_Y, 1.02);
        group.add(dashSouth);

        // 3. Solid White Outer Shoulder Lines
        const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.06);
        const edgeN = new THREE.Mesh(edgeGeo, whiteMat);
        edgeN.rotation.x = -Math.PI / 2;
        edgeN.position.set(0, MARKING_Y, -1.82);
        group.add(edgeN);

        const edgeS = new THREE.Mesh(edgeGeo, whiteMat);
        edgeS.rotation.x = -Math.PI / 2;
        edgeS.position.set(0, MARKING_Y, 1.82);
        group.add(edgeS);

        // 4. Directional Lane Stencil Arrows (Westbound on North side, Eastbound on South side)
        const arrowMat = this.materialsManager.get('road_arrow_straight');
        if (arrowMat) {
          const arrowGeo = new THREE.PlaneGeometry(0.55, 0.95);
          const arrowW = new THREE.Mesh(arrowGeo, arrowMat);
          arrowW.rotation.x = -Math.PI / 2;
          arrowW.rotation.z = -Math.PI / 2;
          arrowW.position.set(0, STENCIL_Y, -1.42);
          group.add(arrowW);

          const arrowE = new THREE.Mesh(arrowGeo, arrowMat);
          arrowE.rotation.x = -Math.PI / 2;
          arrowE.rotation.z = Math.PI / 2;
          arrowE.position.set(0, STENCIL_Y, 1.42);
          group.add(arrowE);
        }
      } else if (isRamp) {
        // Ramp: Deceleration dashed guides
        const rampDash = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.5, 0.12), whiteMat);
        rampDash.rotation.x = -Math.PI / 2;
        rampDash.position.set(0, MARKING_Y, 0);
        group.add(rampDash);

        const edgeS = new THREE.Mesh(new THREE.PlaneGeometry(cellSize, 0.06), yellowMat);
        edgeS.rotation.x = -Math.PI / 2;
        edgeS.position.set(0, MARKING_Y, cellSize / 2 - 0.22);
        group.add(edgeS);
      } else if (isArterial) {
        // Dual yellow dividing lines for heavy arterial
        const lineGeo1 = new THREE.PlaneGeometry(cellSize * 0.9, 0.06);
        const m1 = new THREE.Mesh(lineGeo1, yellowMat);
        m1.rotation.x = -Math.PI / 2;
        m1.position.set(0, MARKING_Y, -0.07);
        group.add(m1);

        const m2 = new THREE.Mesh(lineGeo1, yellowMat);
        m2.rotation.x = -Math.PI / 2;
        m2.position.set(0, MARKING_Y, 0.07);
        group.add(m2);

        // White edge shoulder lines
        const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.05);
        const edgeN = new THREE.Mesh(edgeGeo, whiteMat);
        edgeN.rotation.x = -Math.PI / 2;
        edgeN.position.set(0, MARKING_Y, -cellSize / 2 + 0.2);
        group.add(edgeN);

        const edgeS = new THREE.Mesh(edgeGeo, whiteMat);
        edgeS.rotation.x = -Math.PI / 2;
        edgeS.position.set(0, MARKING_Y, cellSize / 2 - 0.2);
        group.add(edgeS);

        const arrowGeo = new THREE.PlaneGeometry(0.7, 1.2);
        const arrowMat = this.materialsManager.get('road_arrow_straight');
        if (arrowMat) {
          const arrowEast = new THREE.Mesh(arrowGeo, arrowMat);
          arrowEast.rotation.x = -Math.PI / 2;
          arrowEast.rotation.z = Math.PI / 2;
          arrowEast.position.set(0, STENCIL_Y, cellSize * 0.22);
          group.add(arrowEast);
        }
      } else if (isService) {
        // Industrial safety perimeter edge bands
        const hazardN = new THREE.Mesh(new THREE.PlaneGeometry(cellSize, 0.08), yellowMat);
        hazardN.rotation.x = -Math.PI / 2;
        hazardN.position.set(0, MARKING_Y, -cellSize / 2 + 0.15);
        group.add(hazardN);

        const hazardS = new THREE.Mesh(new THREE.PlaneGeometry(cellSize, 0.08), yellowMat);
        hazardS.rotation.x = -Math.PI / 2;
        hazardS.position.set(0, MARKING_Y, cellSize / 2 - 0.15);
        group.add(hazardS);
      } else {
        // Standard Municipal Two-Way Local Street (Rule A):
        // Solid centre divider separating opposing traffic directions.
        // Solid white edge lines along both outer borders.
        // NO DASHED WHITE LANE MARKINGS.
        const centreDivGeo = new THREE.PlaneGeometry(cellSize, 0.10);
        const centreDiv = new THREE.Mesh(centreDivGeo, yellowMat);
        centreDiv.rotation.x = -Math.PI / 2;
        centreDiv.position.set(0, MARKING_Y, 0);
        group.add(centreDiv);

        const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.07);
        const edgeN = new THREE.Mesh(edgeGeo, whiteMat);
        edgeN.rotation.x = -Math.PI / 2;
        edgeN.position.set(0, MARKING_Y, -cellSize / 2 + 0.18);
        group.add(edgeN);

        const edgeS = new THREE.Mesh(edgeGeo, whiteMat);
        edgeS.rotation.x = -Math.PI / 2;
        edgeS.position.set(0, MARKING_Y, cellSize / 2 - 0.18);
        group.add(edgeS);

        // Pedestrian zebra crossing stripes near approach side
        for (let s = -0.8; s <= 0.8; s += 0.4) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.18), whiteMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(cellSize * 0.35, STENCIL_Y, s);
          group.add(stripe);
        }
      }
    } else if (cell.junctionType === 'straight_vertical') {
      if (hasCorridorMetadata) {
        // Multi-block road corridor marking rules (Player-controlled width)
        // 1. Solid White Outer Edge Lines
        if (cell.isOuterEdgeMin) {
          const edgeGeo = new THREE.PlaneGeometry(0.08, cellSize);
          const edgeW = new THREE.Mesh(edgeGeo, whiteMat);
          edgeW.rotation.x = -Math.PI / 2;
          edgeW.position.set(-cellSize / 2 + 0.18, MARKING_Y, 0);
          group.add(edgeW);
        }
        if (cell.isOuterEdgeMax) {
          const edgeGeo = new THREE.PlaneGeometry(0.08, cellSize);
          const edgeE = new THREE.Mesh(edgeGeo, whiteMat);
          edgeE.rotation.x = -Math.PI / 2;
          edgeE.position.set(cellSize / 2 - 0.18, MARKING_Y, 0);
          group.add(edgeE);
        }

        // 2. Centre Divider between opposing directions
        if (cell.isCentreDividerEdgeMin) {
          const divGeo = new THREE.PlaneGeometry(0.12, cellSize);
          const divW = new THREE.Mesh(divGeo, yellowMat);
          divW.rotation.x = -Math.PI / 2;
          divW.position.set(-cellSize / 2 + 0.06, MARKING_Y, 0);
          group.add(divW);
        }
        if (cell.isCentreDividerEdgeMax) {
          const divGeo = new THREE.PlaneGeometry(0.12, cellSize);
          const divE = new THREE.Mesh(divGeo, yellowMat);
          divE.rotation.x = -Math.PI / 2;
          divE.position.set(cellSize / 2 - 0.06, MARKING_Y, 0);
          group.add(divE);
        }

        // 3. Dashed Internal Lane Dividers within each multi-lane carriageway
        if (cell.hasInternalDashedMin) {
          const dashGeo = new THREE.PlaneGeometry(0.08, cellSize * 0.7);
          const dashW = new THREE.Mesh(dashGeo, whiteMat);
          dashW.rotation.x = -Math.PI / 2;
          dashW.position.set(-cellSize / 2 + 0.04, MARKING_Y, 0);
          group.add(dashW);
        }
        if (cell.hasInternalDashedMax) {
          const dashGeo = new THREE.PlaneGeometry(0.08, cellSize * 0.7);
          const dashE = new THREE.Mesh(dashGeo, whiteMat);
          dashE.rotation.x = -Math.PI / 2;
          dashE.position.set(cellSize / 2 - 0.04, MARKING_Y, 0);
          group.add(dashE);
        }
      } else if (isHighway) {
        // True 4-lane divided vertical highway (2 lanes per direction with central Jersey median)
        // 1. Dual Yellow Median Edge Lines hugging central Jersey barrier (barrier at x=0, width 0.16)
        const medLineGeo = new THREE.PlaneGeometry(0.06, cellSize);
        const yellowWest = new THREE.Mesh(medLineGeo, yellowMat);
        yellowWest.rotation.x = -Math.PI / 2;
        yellowWest.position.set(-0.16, MARKING_Y, 0);
        group.add(yellowWest);

        const yellowEast = new THREE.Mesh(medLineGeo, yellowMat);
        yellowEast.rotation.x = -Math.PI / 2;
        yellowEast.position.set(0.16, MARKING_Y, 0);
        group.add(yellowEast);

        // 2. Dashed White Lane Dividers separating Lane 1 and Lane 2 in both directions
        const dashGeo = new THREE.PlaneGeometry(0.07, cellSize * 0.7);
        const dashWest = new THREE.Mesh(dashGeo, whiteMat);
        dashWest.rotation.x = -Math.PI / 2;
        dashWest.position.set(-1.02, MARKING_Y, 0);
        group.add(dashWest);

        const dashEast = new THREE.Mesh(dashGeo, whiteMat);
        dashEast.rotation.x = -Math.PI / 2;
        dashEast.position.set(1.02, MARKING_Y, 0);
        group.add(dashEast);

        // 3. Solid White Outer Shoulder Lines
        const edgeGeo = new THREE.PlaneGeometry(0.06, cellSize);
        const edgeW = new THREE.Mesh(edgeGeo, whiteMat);
        edgeW.rotation.x = -Math.PI / 2;
        edgeW.position.set(-1.82, MARKING_Y, 0);
        group.add(edgeW);

        const edgeE = new THREE.Mesh(edgeGeo, whiteMat);
        edgeE.rotation.x = -Math.PI / 2;
        edgeE.position.set(1.82, MARKING_Y, 0);
        group.add(edgeE);

        // 4. Directional Lane Stencil Arrows (Southbound on West side, Northbound on East side)
        const arrowMat = this.materialsManager.get('road_arrow_straight');
        if (arrowMat) {
          const arrowGeo = new THREE.PlaneGeometry(0.55, 0.95);
          const arrowS = new THREE.Mesh(arrowGeo, arrowMat);
          arrowS.rotation.x = -Math.PI / 2;
          arrowS.position.set(-1.42, STENCIL_Y, 0);
          group.add(arrowS);

          const arrowN = new THREE.Mesh(arrowGeo, arrowMat);
          arrowN.rotation.x = -Math.PI / 2;
          arrowN.rotation.z = Math.PI;
          arrowN.position.set(1.42, STENCIL_Y, 0);
          group.add(arrowN);
        }
      } else if (isRamp) {
        const rampDash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, cellSize * 0.5), whiteMat);
        rampDash.rotation.x = -Math.PI / 2;
        rampDash.position.set(0, MARKING_Y, 0);
        group.add(rampDash);

        const edgeE = new THREE.Mesh(new THREE.PlaneGeometry(0.06, cellSize), yellowMat);
        edgeE.rotation.x = -Math.PI / 2;
        edgeE.position.set(cellSize / 2 - 0.22, MARKING_Y, 0);
        group.add(edgeE);
      } else if (isArterial) {
        // Dual yellow vertical lines
        const lineGeo = new THREE.PlaneGeometry(0.06, cellSize * 0.9);
        const m1 = new THREE.Mesh(lineGeo, yellowMat);
        m1.rotation.x = -Math.PI / 2;
        m1.position.set(-0.07, MARKING_Y, 0);
        group.add(m1);

        const m2 = new THREE.Mesh(lineGeo, yellowMat);
        m2.rotation.x = -Math.PI / 2;
        m2.position.set(0.07, MARKING_Y, 0);
        group.add(m2);

        // Edge shoulder lines
        const edgeGeo = new THREE.PlaneGeometry(0.05, cellSize);
        const edgeW = new THREE.Mesh(edgeGeo, whiteMat);
        edgeW.rotation.x = -Math.PI / 2;
        edgeW.position.set(-cellSize / 2 + 0.2, MARKING_Y, 0);
        group.add(edgeW);

        const edgeE = new THREE.Mesh(edgeGeo, whiteMat);
        edgeE.rotation.x = -Math.PI / 2;
        edgeE.position.set(cellSize / 2 - 0.2, MARKING_Y, 0);
        group.add(edgeE);

        const arrowGeo = new THREE.PlaneGeometry(0.7, 1.2);
        const arrowMat = this.materialsManager.get('road_arrow_straight');
        if (arrowMat) {
          const arrowNorth = new THREE.Mesh(arrowGeo, arrowMat);
          arrowNorth.rotation.x = -Math.PI / 2;
          arrowNorth.rotation.z = Math.PI;
          arrowNorth.position.set(-cellSize * 0.22, STENCIL_Y, 0);
          group.add(arrowNorth);
        }
      } else if (isService) {
        // Industrial safety perimeter edge bands
        const hazardW = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize), yellowMat);
        hazardW.rotation.x = -Math.PI / 2;
        hazardW.position.set(-cellSize / 2 + 0.15, MARKING_Y, 0);
        group.add(hazardW);

        const hazardE = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize), yellowMat);
        hazardE.rotation.x = -Math.PI / 2;
        hazardE.position.set(cellSize / 2 - 0.15, MARKING_Y, 0);
        group.add(hazardE);
      } else {
        // Standard Municipal Two-Way Local Street (Rule A):
        // Solid centre divider separating opposing traffic directions.
        // Solid white edge lines along both outer borders.
        // NO DASHED WHITE LANE MARKINGS.
        const centreDivGeo = new THREE.PlaneGeometry(0.10, cellSize);
        const centreDiv = new THREE.Mesh(centreDivGeo, yellowMat);
        centreDiv.rotation.x = -Math.PI / 2;
        centreDiv.position.set(0, MARKING_Y, 0);
        group.add(centreDiv);

        const edgeGeo = new THREE.PlaneGeometry(0.07, cellSize);
        const edgeW = new THREE.Mesh(edgeGeo, whiteMat);
        edgeW.rotation.x = -Math.PI / 2;
        edgeW.position.set(-cellSize / 2 + 0.18, MARKING_Y, 0);
        group.add(edgeW);

        const edgeE = new THREE.Mesh(edgeGeo, whiteMat);
        edgeE.rotation.x = -Math.PI / 2;
        edgeE.position.set(cellSize / 2 - 0.18, MARKING_Y, 0);
        group.add(edgeE);
      }
    } else if (cell.junctionType.startsWith('corner_')) {
      const dotGeo = new THREE.PlaneGeometry(0.15, 0.15);
      const dotMesh = new THREE.Mesh(dotGeo, primaryMarkingMat);
      dotMesh.rotation.x = -Math.PI / 2;
      dotMesh.position.y = MARKING_Y;
      group.add(dotMesh);
    } else if (cell.junctionType === 't_junction') {
      const junctionBox = new THREE.PlaneGeometry(0.3, 0.3);
      const boxMesh = new THREE.Mesh(junctionBox, primaryMarkingMat);
      boxMesh.rotation.x = -Math.PI / 2;
      boxMesh.position.y = MARKING_Y;
      group.add(boxMesh);
    } else if (cell.junctionType === 'crossroad') {
      const crossGeo = new THREE.PlaneGeometry(0.4, 0.4);
      const crossMesh = new THREE.Mesh(crossGeo, primaryMarkingMat);
      crossMesh.rotation.x = -Math.PI / 2;
      crossMesh.position.y = MARKING_Y;
      group.add(crossMesh);
    } else if (cell.junctionType === 'endpoint') {
      const barGeo = new THREE.PlaneGeometry(0.4, 0.15);
      const barMesh = new THREE.Mesh(barGeo, whiteMat);
      barMesh.rotation.x = -Math.PI / 2;
      barMesh.position.y = MARKING_Y;
      group.add(barMesh);
    } else if (cell.junctionType === 'isolated') {
      // Single isolated road cell: standard 2-way road markings
      const centreDivGeo = new THREE.PlaneGeometry(cellSize, 0.10);
      const centreDiv = new THREE.Mesh(centreDivGeo, yellowMat);
      centreDiv.rotation.x = -Math.PI / 2;
      centreDiv.position.set(0, MARKING_Y, 0);
      group.add(centreDiv);

      const edgeGeo = new THREE.PlaneGeometry(cellSize, 0.07);
      const edgeN = new THREE.Mesh(edgeGeo, whiteMat);
      edgeN.rotation.x = -Math.PI / 2;
      edgeN.position.set(0, MARKING_Y, -cellSize / 2 + 0.18);
      group.add(edgeN);

      const edgeS = new THREE.Mesh(edgeGeo, whiteMat);
      edgeS.rotation.x = -Math.PI / 2;
      edgeS.position.set(0, MARKING_Y, cellSize / 2 - 0.18);
      group.add(edgeS);
    }
  }

  /**
   * Adds multiple road cells atomically and updates ONLY the affected cells and adjacent neighbors
   */
  public addRoadCellsAndRefresh(
    cells: (GridCoord | any)[],
    roadType: RoadTypeId = 'two_lane_urban'
  ): { addedCount: number; updatedKeys: string[] } {
    const affectedKeys = new Set<string>();

    for (const cell of cells) {
      const metadata = 'corridorIndex' in cell ? cell : undefined;
      const data = this.model.addRoadCell(cell.x, cell.z, roadType as any, 'road', 'surface', undefined, metadata);
      if (data) {
        affectedKeys.add(`${cell.x},${cell.z}`);
        const adjacent = this.gridSystem.getAdjacentCells(cell.x, cell.z);
        for (const n of adjacent) {
          if (this.model.hasRoad(n.x, n.z)) {
            affectedKeys.add(`${n.x},${n.z}`);
          }
        }
      }
    }

    // Refresh meshes for only affected keys
    for (const key of affectedKeys) {
      const [xStr, zStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const z = parseInt(zStr, 10);
      this.refreshCellMesh(x, z);
    }

    return {
      addedCount: cells.length,
      updatedKeys: Array.from(affectedKeys),
    };
  }

  /**
   * Removes a single road cell and refreshes adjacent neighbor junctions
   */
  public removeRoadCellAndRefresh(x: number, z: number): boolean {
    const removed = this.model.removeRoadCell(x, z);
    if (!removed) return false;

    // Remove mesh
    const key = `${x},${z}`;
    const mesh = this.cellMeshes.get(key);
    if (mesh) {
      this.group.remove(mesh);
      this.disposeGroupGeometries(mesh);
      this.cellMeshes.delete(key);
    }

    // Refresh adjacent cells
    const adjacent = this.gridSystem.getAdjacentCells(x, z);
    for (const n of adjacent) {
      if (this.model.hasRoad(n.x, n.z)) {
        this.refreshCellMesh(n.x, n.z);
      }
    }

    return true;
  }

  private refreshCellMesh(x: number, z: number): void {
    const key = `${x},${z}`;
    const oldMesh = this.cellMeshes.get(key);
    if (oldMesh) {
      this.group.remove(oldMesh);
      this.disposeGroupGeometries(oldMesh);
      this.cellMeshes.delete(key);
    }

    const cellData = this.model.getRoadCell(x, z);
    if (cellData) {
      const newMesh = this.createRoadCellMesh(cellData);
      this.cellMeshes.set(key, newMesh);
      this.group.add(newMesh);
    }
  }

  private disposeGroupGeometries(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.dispose();
      }
    });
  }

  private clearMeshes(): void {
    for (const mesh of this.cellMeshes.values()) {
      this.disposeGroupGeometries(mesh);
      this.group.remove(mesh);
    }
    this.cellMeshes.clear();
  }

  public getSegmentCount(): number {
    return this.cellMeshes.size;
  }

  public clear(): void {
    this.clearMeshes();
    this.model.clear();
  }

  public dispose(): void {
    this.clear();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
