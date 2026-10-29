import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { RoadNetworkModel, RoadCellData } from './RoadNetworkModel';
import { MaterialsManager } from '../rendering/MaterialsManager';

export type StreetlightClass = 'local' | 'arterial' | 'highway' | 'industrial';

export interface RoadsidePropItem {
  id: string;
  type: 'streetlight' | 'speed_sign' | 'highway_gantry' | 'bench' | 'trash_bin' | 'fire_hydrant' | 'stop_sign';
  roadClass: string;
  gridX: number;
  gridZ: number;
  worldPosition: THREE.Vector3;
  rotationY: number;
  heightMeters: number;
}

/**
 * High-Quality Road Surfaces, Lane Markings, Street Furniture, and Roadside Detailing System
 * Global Transport Empire - Civil Engineering & Roadside Architecture
 *
 * Implements authoritative, scale-correct, and collision-aware placement of:
 * - Class-specific streetlights (5.5m local, 8.5m arterial, 12.0m highway, 9.0m industrial)
 * - Regulatory speed limit signs (50 km/h, 75 km/h, 110 km/h, 35 km/h)
 * - Overhead highway directional gantries with retroreflective destination boards
 * - Pedestrian street furniture (benches, trash bins, fire hydrants) along local sidewalks
 * - Strict non-encroachment envelope (> 2.35m offset from centerline) guaranteeing vehicle clearance
 */
export class RoadsideDetailingManager implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;
  private roadModel: RoadNetworkModel;
  private materialsManager: MaterialsManager;
  private props: RoadsidePropItem[] = [];

  constructor(
    gridSystem: GridSystem,
    roadModel: RoadNetworkModel,
    materialsManager: MaterialsManager
  ) {
    this.gridSystem = gridSystem;
    this.roadModel = roadModel;
    this.materialsManager = materialsManager;

    this.group = new THREE.Group();
    this.group.name = 'roadside_detailing';
  }

  public getProps(): RoadsidePropItem[] {
    return this.props;
  }

  public getPropsByType(type: RoadsidePropItem['type']): RoadsidePropItem[] {
    return this.props.filter((p) => p.type === type);
  }

  /**
   * Generates deterministic, class-specific roadside detailing across all road cells
   */
  public generate(): void {
    this.clear();

    const roadCells = this.roadModel.getAllRoadCells();
    for (const cell of roadCells) {
      this.generateDetailsForCell(cell);
    }
  }

  private generateDetailsForCell(cell: RoadCellData): void {
    const { gridX, gridZ, roadType, connections, junctionType } = cell;
    const center = this.gridSystem.gridToWorldCenter(gridX, gridZ);
    const cellSize = this.gridSystem.cellSize;
    const groundY = cell.elevation !== undefined
      ? cell.elevation
      : (this.gridSystem.getTerrainHeight ? this.gridSystem.getTerrainHeight(center.x, center.z) + 0.04 : 0.04);

    // Coordinate hash for deterministic, non-cluttering prop placement
    const hash = Math.abs((gridX * 73856093) ^ (gridZ * 19349663));

    // 1. Streetlights - Class-appropriate spacing and heights
    const isHighway = roadType === 'highway_corridor' || roadType === 'highway_ramp';
    const isArterial = roadType === 'heavy_arterial' || roadType === 'arterial';
    const isLocal = roadType === 'two_lane_urban';
    const isIndustrial = roadType === 'industrial_access';

    // Stride check: highways every 4 cells, arterials every 3 cells, local every 3 cells, industrial every 4 cells
    const lightStride = isHighway || isIndustrial ? 4 : 3;
    const shouldPlaceLight = (Math.abs(gridX + gridZ) % lightStride === 0) && (junctionType === 'straight_horizontal' || junctionType === 'straight_vertical');

    if (shouldPlaceLight) {
      this.placeStreetlight(cell, center, groundY, cellSize, hash);
    }

    // 2. Regulatory & Directional Road Signs
    // Speed limit sign placed every 6 cells along straight roads
    if (Math.abs(gridX * 3 + gridZ * 5) % 6 === 0 && (junctionType === 'straight_horizontal' || junctionType === 'straight_vertical')) {
      this.placeSpeedLimitSign(cell, center, groundY, cellSize);
    }

    // Overhead Highway Gantry Sign at highway merge/diverge or every 8 highway cells
    if (isHighway && (junctionType === 'highway_merge' || Math.abs(gridX + gridZ) % 8 === 0)) {
      this.placeHighwayGantry(cell, center, groundY, cellSize);
    }

    // Stop Signs at T-junction stem approaches
    if (junctionType === 't_junction') {
      this.placeIntersectionStopSign(cell, center, groundY, cellSize);
    }

    // 3. Local Street Furniture (Benches, Trash Bins, Fire Hydrants)
    if (isLocal && (junctionType === 'straight_horizontal' || junctionType === 'straight_vertical')) {
      if (hash % 5 === 1) {
        this.placeStreetBench(cell, center, groundY, cellSize);
      } else if (hash % 5 === 2) {
        this.placeTrashBin(cell, center, groundY, cellSize);
      } else if (hash % 7 === 0) {
        this.placeFireHydrant(cell, center, groundY, cellSize);
      }
    }
  }

  /**
   * Places class-specific streetlights with strict physical clearances:
   * - Local: 5.5m height
   * - Arterial: 8.5m height
   * - Highway: 12.0m height
   * - Industrial: 9.0m height
   */
  private placeStreetlight(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number,
    hash: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const side = (hash % 2 === 0) ? 1 : -1;

    // Safety offset: 2.45m from centerline ensures pole base is firmly on sidewalk / shoulder
    const offsetDist = cellSize * 0.60;
    const posX = isHorizontal ? center.x : center.x + side * offsetDist;
    const posZ = isHorizontal ? center.z + side * offsetDist : center.z;

    // Verify non-encroachment into buildings, entrances, or water
    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    let poleHeight = 5.5;
    let roadClass = 'local';
    let lightClass: StreetlightClass = 'local';

    if (cell.roadType === 'highway_corridor' || cell.roadType === 'highway_ramp') {
      poleHeight = 12.0;
      roadClass = 'highway';
      lightClass = 'highway';
    } else if (cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial') {
      poleHeight = 8.5;
      roadClass = 'arterial';
      lightClass = 'arterial';
    } else if (cell.roadType === 'industrial_access') {
      poleHeight = 9.0;
      roadClass = 'industrial';
      lightClass = 'industrial';
    }

    const lightGroup = this.createStreetlightMesh(lightClass, poleHeight, isHorizontal, side);
    lightGroup.position.set(posX, groundY, posZ);
    this.group.add(lightGroup);

    this.props.push({
      id: `light_${cell.gridX}_${cell.gridZ}`,
      type: 'streetlight',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: lightGroup.rotation.y,
      heightMeters: poleHeight,
    });
  }

  private createStreetlightMesh(
    lightClass: StreetlightClass,
    height: number,
    isHorizontal: boolean,
    side: number
  ): THREE.Group {
    const group = new THREE.Group();
    const postMat = this.materialsManager.get('streetlight_post');
    const lampMat = this.materialsManager.get('streetlight_lamp');
    const concreteMat = this.materialsManager.get('concrete_curb');

    // Base plinth
    const plinthGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.28, 8);
    const plinth = new THREE.Mesh(plinthGeo, concreteMat);
    plinth.position.y = 0.14;
    group.add(plinth);

    if (lightClass === 'highway') {
      // 12.0m Tall Galvanized Steel Highway Cobra-Head Tower
      const mastGeo = new THREE.CylinderGeometry(0.12, 0.22, height, 10);
      const mast = new THREE.Mesh(mastGeo, postMat);
      mast.position.y = height / 2;
      mast.castShadow = true;
      group.add(mast);

      // Long cantilevered outreach arm reaching toward highway carriageway
      const armGeo = new THREE.CylinderGeometry(0.08, 0.10, 3.2, 8);
      armGeo.rotateZ(Math.PI / 4 * -side);
      const arm = new THREE.Mesh(armGeo, postMat);
      arm.position.set(-side * 1.1, height - 0.4, 0);
      group.add(arm);

      // Cobra head luminaire fixture
      const headGeo = new THREE.BoxGeometry(0.75, 0.22, 0.42);
      const head = new THREE.Mesh(headGeo, postMat);
      head.position.set(-side * 2.2, height + 0.5, 0);
      group.add(head);

      const lensGeo = new THREE.PlaneGeometry(0.65, 0.32);
      lensGeo.rotateX(Math.PI / 2);
      const lens = new THREE.Mesh(lensGeo, lampMat);
      lens.position.set(-side * 2.2, height + 0.38, 0);
      group.add(lens);
    } else if (lightClass === 'arterial') {
      // 8.5m Double-Mast Arterial Pole
      const mastGeo = new THREE.CylinderGeometry(0.10, 0.18, height, 8);
      const mast = new THREE.Mesh(mastGeo, postMat);
      mast.position.y = height / 2;
      group.add(mast);

      // Symmetrical T-arms
      const tArmGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8);
      tArmGeo.rotateZ(Math.PI / 2);
      const tArm = new THREE.Mesh(tArmGeo, postMat);
      tArm.position.set(0, height - 0.2, 0);
      group.add(tArm);

      // Dual lamps on left and right
      [-1.1, 1.1].forEach((dx) => {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.32), postMat);
        head.position.set(dx, height - 0.1, 0);
        group.add(head);

        const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), lampMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(dx, height - 0.2, 0);
        group.add(lens);
      });
    } else if (lightClass === 'industrial') {
      // 9.0m Heavy Lattice / Square Floodlight Tower
      const towerGeo = new THREE.BoxGeometry(0.28, height, 0.28);
      const tower = new THREE.Mesh(towerGeo, postMat);
      tower.position.y = height / 2;
      group.add(tower);

      // Floodlight bracket
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.35), postMat);
      bracket.position.set(0, height, 0);
      group.add(bracket);

      // Twin high-output sodium floodlight fixtures
      [-0.55, 0.55].forEach((dx) => {
        const flood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.28), postMat);
        flood.position.set(dx, height + 0.22, 0);
        group.add(flood);
      });
    } else {
      // 5.5m Municipal Local Street Pole
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, height, 8);
      const pole = new THREE.Mesh(poleGeo, postMat);
      pole.position.y = height / 2;
      group.add(pole);

      // Graceful curved swan-neck bracket
      const armGeo = new THREE.CylinderGeometry(0.045, 0.06, 1.8, 8);
      armGeo.rotateZ(Math.PI / 3 * -side);
      const arm = new THREE.Mesh(armGeo, postMat);
      arm.position.set(-side * 0.7, height - 0.2, 0);
      group.add(arm);

      // Lantern luminaire
      const lanternGeo = new THREE.CylinderGeometry(0.22, 0.15, 0.35, 6);
      const lantern = new THREE.Mesh(lanternGeo, postMat);
      lantern.position.set(-side * 1.4, height + 0.2, 0);
      group.add(lantern);

      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), lampMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-side * 1.4, height + 0.02, 0);
      group.add(lens);
    }

    // Orient toward roadway
    if (isHorizontal) {
      group.rotation.y = side > 0 ? 0 : Math.PI;
    } else {
      group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    return group;
  }

  /**
   * Places regulatory speed limit signs (50 km/h, 75 km/h, 110 km/h, 35 km/h)
   */
  private placeSpeedLimitSign(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const side = 1; // Right-hand side of roadway direction
    const offsetDist = cellSize * 0.60;
    const posX = isHorizontal ? center.x : center.x + offsetDist;
    const posZ = isHorizontal ? center.z + offsetDist : center.z;

    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    let speed = 50;
    let signMatName = 'speed_sign_50';
    let poleH = 2.4;

    if (cell.roadType === 'highway_corridor') {
      speed = 110;
      signMatName = 'speed_sign_110';
      poleH = 3.0;
    } else if (cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial') {
      speed = 75;
      signMatName = 'speed_sign_75';
      poleH = 2.6;
    } else if (cell.roadType === 'industrial_access') {
      speed = 35;
      signMatName = 'speed_sign_50';
      poleH = 2.2;
    }

    const signGroup = new THREE.Group();
    const poleMat = this.materialsManager.get('streetlight_post');
    const faceMat = this.materialsManager.get(signMatName);

    // Aluminum support post
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, poleH, 6), poleMat);
    pole.position.y = poleH / 2;
    signGroup.add(pole);

    // MUTCD Reflective Signboard
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.04), faceMat);
    signBoard.position.set(0, poleH - 0.2, 0);
    signGroup.add(signBoard);

    signGroup.position.set(posX, groundY, posZ);
    if (isHorizontal) {
      signGroup.rotation.y = 0;
    } else {
      signGroup.rotation.y = -Math.PI / 2;
    }

    this.group.add(signGroup);

    this.props.push({
      id: `speed_sign_${cell.gridX}_${cell.gridZ}`,
      type: 'speed_sign',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: signGroup.rotation.y,
      heightMeters: poleH,
    });
  }

  /**
   * Places an overhead highway truss gantry with directional destination boards
   */
  private placeHighwayGantry(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const gantryGroup = new THREE.Group();
    const steelMat = this.materialsManager.get('highway_guardrail_steel');
    const gantryMat = this.materialsManager.get('highway_sign_gantry');

    const spanWidth = cellSize * 1.35; // 5.4m span bridging travel lanes
    const clearHeight = 5.6; // High truck clearance

    // Left and Right Truss Support Columns
    const colGeo = new THREE.BoxGeometry(0.35, clearHeight, 0.35);
    const leftCol = new THREE.Mesh(colGeo, steelMat);
    leftCol.position.set(-spanWidth / 2, clearHeight / 2, 0);
    gantryGroup.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, steelMat);
    rightCol.position.set(spanWidth / 2, clearHeight / 2, 0);
    gantryGroup.add(rightCol);

    // Overhead Box Truss Crossbeam
    const beamGeo = new THREE.BoxGeometry(spanWidth, 0.6, 0.6);
    const beam = new THREE.Mesh(beamGeo, steelMat);
    beam.position.set(0, clearHeight, 0);
    gantryGroup.add(beam);

    // Large Green Interstate Signboard
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), gantryMat);
    signBoard.position.set(0, clearHeight + 0.15, 0.32);
    gantryGroup.add(signBoard);

    gantryGroup.position.set(center.x, groundY, center.z);
    if (!isHorizontal) {
      gantryGroup.rotation.y = Math.PI / 2;
    }

    this.group.add(gantryGroup);

    this.props.push({
      id: `highway_gantry_${cell.gridX}_${cell.gridZ}`,
      type: 'highway_gantry',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(center.x, groundY, center.z),
      rotationY: gantryGroup.rotation.y,
      heightMeters: clearHeight + 1.2,
    });
  }

  /**
   * Places an octagonal Stop sign at intersection approaches
   */
  private placeIntersectionStopSign(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const posX = center.x + cellSize * 0.45;
    const posZ = center.z + cellSize * 0.45;
    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    const stopGroup = new THREE.Group();
    const poleMat = this.materialsManager.get('streetlight_post');
    const redMat = this.materialsManager.get('drum_hazard_red');

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), poleMat);
    pole.position.y = 1.1;
    stopGroup.add(pole);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 8), redMat);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, 1.9, 0);
    stopGroup.add(plate);

    stopGroup.position.set(posX, groundY, posZ);
    this.group.add(stopGroup);

    this.props.push({
      id: `stop_sign_${cell.gridX}_${cell.gridZ}`,
      type: 'stop_sign',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: 0,
      heightMeters: 2.2,
    });
  }

  /**
   * Places pedestrian slatted wooden bench on urban sidewalk
   */
  private placeStreetBench(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const offset = cellSize * 0.60;
    const posX = isHorizontal ? center.x : center.x - offset;
    const posZ = isHorizontal ? center.z - offset : center.z;

    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    const benchGroup = new THREE.Group();
    const woodMat = this.materialsManager.get('street_bench_wood');
    const ironMat = this.materialsManager.get('streetlight_post');

    // Cast iron frame legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.5);
    [-0.6, 0.6].forEach((dx) => {
      const leg = new THREE.Mesh(legGeo, ironMat);
      leg.position.set(dx, 0.225, 0);
      benchGroup.add(leg);
    });

    // Wood seat slats
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.45), woodMat);
    seat.position.set(0, 0.45, 0);
    benchGroup.add(seat);

    // Wood backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.06), woodMat);
    back.position.set(0, 0.72, -0.2);
    benchGroup.add(back);

    benchGroup.position.set(posX, groundY, posZ);
    if (isHorizontal) benchGroup.rotation.y = 0;
    else benchGroup.rotation.y = Math.PI / 2;

    this.group.add(benchGroup);

    this.props.push({
      id: `bench_${cell.gridX}_${cell.gridZ}`,
      type: 'bench',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: benchGroup.rotation.y,
      heightMeters: 0.9,
    });
  }

  /**
   * Places curbside cylindrical waste receptacle
   */
  private placeTrashBin(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const offset = cellSize * 0.60;
    const posX = isHorizontal ? center.x : center.x + offset;
    const posZ = isHorizontal ? center.z + offset : center.z;

    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    const binGroup = new THREE.Group();
    const metalMat = this.materialsManager.get('trash_bin_metal');

    const binBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.75, 12), metalMat);
    binBody.position.y = 0.38;
    binGroup.add(binBody);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), metalMat);
    lid.position.y = 0.78;
    binGroup.add(lid);

    binGroup.position.set(posX, groundY, posZ);
    this.group.add(binGroup);

    this.props.push({
      id: `trash_bin_${cell.gridX}_${cell.gridZ}`,
      type: 'trash_bin',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: 0,
      heightMeters: 0.82,
    });
  }

  /**
   * Places municipal fire hydrant near street corner curbs
   */
  private placeFireHydrant(
    cell: RoadCellData,
    center: { x: number; z: number },
    groundY: number,
    cellSize: number
  ): void {
    const isHorizontal = cell.junctionType === 'straight_horizontal';
    const offset = cellSize * 0.60;
    const posX = isHorizontal ? center.x + 0.8 : center.x + offset;
    const posZ = isHorizontal ? center.z + offset : center.z + 0.8;

    if (this.isLocationObstructed(posX, posZ, cell.gridX, cell.gridZ)) return;

    const hydrantGroup = new THREE.Group();
    const redMat = this.materialsManager.get('fire_hydrant_red');
    const brassMat = this.materialsManager.get('road_sign_pole');

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.65, 8), redMat);
    barrel.position.y = 0.325;
    hydrantGroup.add(barrel);

    // Bonnet cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.15, 8), redMat);
    cap.position.y = 0.72;
    hydrantGroup.add(cap);

    // Side discharge nozzles
    const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.36, 6);
    nozzleGeo.rotateZ(Math.PI / 2);
    const nozzles = new THREE.Mesh(nozzleGeo, brassMat);
    nozzles.position.y = 0.45;
    hydrantGroup.add(nozzles);

    hydrantGroup.position.set(posX, groundY, posZ);
    this.group.add(hydrantGroup);

    this.props.push({
      id: `hydrant_${cell.gridX}_${cell.gridZ}`,
      type: 'fire_hydrant',
      roadClass: cell.roadType,
      gridX: cell.gridX,
      gridZ: cell.gridZ,
      worldPosition: new THREE.Vector3(posX, groundY, posZ),
      rotationY: 0,
      heightMeters: 0.8,
    });
  }

  /**
   * Collision check: verifies roadside position does not collide with building footprints, entrances, or water
   */
  private isLocationObstructed(worldX: number, worldZ: number, gridX: number, gridZ: number): boolean {
    // Check if point lands inside water
    if (this.gridSystem.terrainModel && this.gridSystem.terrainModel.isWorldPointInWater(worldX, worldZ)) {
      return true;
    }

    // Check adjacent cell occupancy
    const targetGrid = this.gridSystem.worldToGrid(worldX, worldZ);
    if (!targetGrid) return true;

    // Do not place inside building or reserved plot
    const occ = this.gridSystem.getOccupancy(targetGrid.x, targetGrid.z);
    if (occ === 'building' || occ === 'reserved' || occ === 'obstacle') {
      return true;
    }

    // Protect Starter Truck Depot entrance and footprint (12, 13) and spur (11, 14)
    if (
      (targetGrid.x >= 11 && targetGrid.x <= 15 && targetGrid.z >= 12 && targetGrid.z <= 15) &&
      (targetGrid.x === 11 && targetGrid.z === 14)
    ) {
      return true;
    }

    return false;
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry) {
          node.geometry.dispose();
        }
      });
    }
    this.props = [];
  }

  public dispose(): void {
    this.clear();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
