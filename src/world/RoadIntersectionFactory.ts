import * as THREE from 'three';
import { RoadCellData } from './RoadNetworkModel';
import { MaterialsManager } from '../rendering/MaterialsManager';

/**
 * Procedural 3D Road Intersection & Junction Geometry Factory
 * Global Transport Empire - Civil Engineering & Highway Infrastructure
 *
 * Generates realistic, road-width-aware, and hierarchy-aligned geometry for:
 * - T-junctions with orientation-aware stem stop bars and corner fillets
 * - 4-way crossroads with quadrant corner curb fillets and crosswalk stop bars
 * - Roundabouts / traffic circles with central splitter islands & yield markings
 * - Highway merge & exit ramps with chevron-striped gore neutral channelization
 * - Industrial access junctions with wide swept-path aprons for 16.5m semi-trucks
 * - Bridge approach transitions with expansion joints and abutment barriers
 */
// Flush road marking elevation: 3mm above asphalt plane (y=0.002) to eliminate floating gaps
const MARKING_Y = 0.005;
const STENCIL_Y = 0.0055;

export class RoadIntersectionFactory {
  /**
   * Builds an orientation-aware T-junction with corner fillets, through-markings, and stem stop bar
   */
  public static buildTJunction(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const isArterial = cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial';
    const isService = cell.roadType === 'industrial_access';
    const whiteMat = materialsManager.get('road_marking');
    const yellowMat = materialsManager.get('road_marking_yellow');
    const primaryMarking = isArterial ? yellowMat : whiteMat;
    const curbMat = materialsManager.get('concrete_curb');

    const stemDir = cell.junctionMetadata?.stemDirection || this.inferStemDirection(cell.connections);
    const curbH = 0.07;
    const curbT = 0.14;
    const filletR = isService ? 1.5 : 1.1; // Wider fillet for industrial trucks

    // 1. Through road dividing line (with gap for turn) & Stem Stop Line
    if (stemDir === 'south') {
      // Through road is horizontal along North (East-West)
      const throughEast = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.35, 0.08), primaryMarking);
      throughEast.rotation.x = -Math.PI / 2;
      throughEast.position.set(cellSize * 0.32, MARKING_Y, -0.1);
      group.add(throughEast);

      const throughWest = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.35, 0.08), primaryMarking);
      throughWest.rotation.x = -Math.PI / 2;
      throughWest.position.set(-cellSize * 0.32, MARKING_Y, -0.1);
      group.add(throughWest);

      // Stop bar for South stem
      const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.42, 0.22), whiteMat);
      stopBar.rotation.x = -Math.PI / 2;
      stopBar.position.set(cellSize * 0.22, MARKING_Y, cellSize * 0.35);
      group.add(stopBar);

      // Continuous outer curb along North edge
      if (!isService) {
        const northCurb = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        northCurb.position.set(0, curbH / 2 + 0.035, -cellSize / 2 + curbT / 2);
        group.add(northCurb);
      }
    } else if (stemDir === 'north') {
      // Through road is horizontal along South
      const throughEast = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.35, 0.08), primaryMarking);
      throughEast.rotation.x = -Math.PI / 2;
      throughEast.position.set(cellSize * 0.32, MARKING_Y, 0.1);
      group.add(throughEast);

      const throughWest = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.35, 0.08), primaryMarking);
      throughWest.rotation.x = -Math.PI / 2;
      throughWest.position.set(-cellSize * 0.32, MARKING_Y, 0.1);
      group.add(throughWest);

      // Stop bar for North stem
      const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.42, 0.22), whiteMat);
      stopBar.rotation.x = -Math.PI / 2;
      stopBar.position.set(-cellSize * 0.22, MARKING_Y, -cellSize * 0.35);
      group.add(stopBar);

      if (!isService) {
        const southCurb = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        southCurb.position.set(0, curbH / 2 + 0.035, cellSize / 2 - curbT / 2);
        group.add(southCurb);
      }
    } else if (stemDir === 'west') {
      // Through road is vertical along East (North-South)
      const throughNorth = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize * 0.35), primaryMarking);
      throughNorth.rotation.x = -Math.PI / 2;
      throughNorth.position.set(0.1, MARKING_Y, -cellSize * 0.32);
      group.add(throughNorth);

      const throughSouth = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize * 0.35), primaryMarking);
      throughSouth.rotation.x = -Math.PI / 2;
      throughSouth.position.set(0.1, MARKING_Y, cellSize * 0.32);
      group.add(throughSouth);

      // Stop bar for West stem
      const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, cellSize * 0.42), whiteMat);
      stopBar.rotation.x = -Math.PI / 2;
      stopBar.position.set(-cellSize * 0.35, MARKING_Y, cellSize * 0.22);
      group.add(stopBar);

      if (!isService) {
        const eastCurb = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        eastCurb.position.set(cellSize / 2 - curbT / 2, curbH / 2 + 0.035, 0);
        group.add(eastCurb);
      }
    } else {
      // Stem East: Through road is vertical along West
      const throughNorth = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize * 0.35), primaryMarking);
      throughNorth.rotation.x = -Math.PI / 2;
      throughNorth.position.set(-0.1, MARKING_Y, -cellSize * 0.32);
      group.add(throughNorth);

      const throughSouth = new THREE.Mesh(new THREE.PlaneGeometry(0.08, cellSize * 0.35), primaryMarking);
      throughSouth.rotation.x = -Math.PI / 2;
      throughSouth.position.set(-0.1, MARKING_Y, cellSize * 0.32);
      group.add(throughSouth);

      // Stop bar for East stem
      const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, cellSize * 0.42), whiteMat);
      stopBar.rotation.x = -Math.PI / 2;
      stopBar.position.set(cellSize * 0.35, MARKING_Y, -cellSize * 0.22);
      group.add(stopBar);

      if (!isService) {
        const westCurb = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        westCurb.position.set(-cellSize / 2 + curbT / 2, curbH / 2 + 0.035, 0);
        group.add(westCurb);
      }
    }

    // 2. Corner turning curb fillets (smooth arcs on the two corner quadrants)
    if (!isService) {
      this.addCornerCurbFillets(group, stemDir, cellSize, filletR, curbMat, curbH, curbT);
    }
  }

  /**
   * Builds a 4-way crossroad with pedestrian zebra crossings, approach stencil arrows,
   * quadrant sidewalk corner fillets, and corner traffic light signal posts
   */
  public static buildCrossroad(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const isArterial = cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial';
    const isService = cell.roadType === 'industrial_access';
    const whiteMat = materialsManager.get('road_marking');
    const yellowMat = materialsManager.get('road_marking_yellow');
    const curbMat = materialsManager.get('concrete_curb');
    const sidewalkMat = materialsManager.get('sidewalk_concrete');
    const curbH = 0.07;
    const half = cellSize / 2;

    // 1. Pedestrian Zebra Crossings on all 4 Approach Legs
    // 4 transverse stripes per approach (0.16m wide, 0.65m long)
    const stripeGeo = new THREE.PlaneGeometry(0.16, 0.65);
    const stripeGeoH = new THREE.PlaneGeometry(0.65, 0.16);

    // North approach zebra crosswalk
    [-0.6, -0.2, 0.2, 0.6].forEach((offset) => {
      const stripe = new THREE.Mesh(stripeGeo, whiteMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(offset, MARKING_Y, -half + 0.35);
      group.add(stripe);
    });

    // South approach zebra crosswalk
    [-0.6, -0.2, 0.2, 0.6].forEach((offset) => {
      const stripe = new THREE.Mesh(stripeGeo, whiteMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(offset, MARKING_Y, half - 0.35);
      group.add(stripe);
    });

    // East approach zebra crosswalk
    [-0.6, -0.2, 0.2, 0.6].forEach((offset) => {
      const stripe = new THREE.Mesh(stripeGeoH, whiteMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(half - 0.35, MARKING_Y, offset);
      group.add(stripe);
    });

    // West approach zebra crosswalk
    [-0.6, -0.2, 0.2, 0.6].forEach((offset) => {
      const stripe = new THREE.Mesh(stripeGeoH, whiteMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-half + 0.35, MARKING_Y, offset);
      group.add(stripe);
    });

    // 2. Approach Stop Lines positioned right before the zebra crosswalks
    const stopBarW = 0.16;
    const stopBarL = cellSize * 0.42;

    // North stop bar (incoming lane at x = -0.5)
    const stopN = new THREE.Mesh(new THREE.PlaneGeometry(stopBarL, stopBarW), whiteMat);
    stopN.rotation.x = -Math.PI / 2;
    stopN.position.set(-cellSize * 0.24, MARKING_Y, -half + 0.85);
    group.add(stopN);

    // South stop bar (incoming lane at x = +0.5)
    const stopS = new THREE.Mesh(new THREE.PlaneGeometry(stopBarL, stopBarW), whiteMat);
    stopS.rotation.x = -Math.PI / 2;
    stopS.position.set(cellSize * 0.24, MARKING_Y, half - 0.85);
    group.add(stopS);

    // East stop bar (incoming lane at z = -0.5)
    const stopE = new THREE.Mesh(new THREE.PlaneGeometry(stopBarW, stopBarL), whiteMat);
    stopE.rotation.x = -Math.PI / 2;
    stopE.position.set(half - 0.85, MARKING_Y, -cellSize * 0.24);
    group.add(stopE);

    // West stop bar (incoming lane at z = +0.5)
    const stopW = new THREE.Mesh(new THREE.PlaneGeometry(stopBarW, stopBarL), whiteMat);
    stopW.rotation.x = -Math.PI / 2;
    stopW.position.set(-half + 0.85, MARKING_Y, cellSize * 0.24);
    group.add(stopW);

    // 3. Directional Lane Stencil Arrows on Approaches
    const arrowStraightMat = materialsManager.get('road_arrow_straight');
    const arrowLeftMat = materialsManager.get('road_arrow_left') || arrowStraightMat;
    const arrowRightMat = materialsManager.get('road_arrow_right') || arrowStraightMat;

    if (arrowStraightMat) {
      const arrowGeo = new THREE.PlaneGeometry(0.48, 0.78);

      // North approach: Straight arrow on incoming lane
      const aN = new THREE.Mesh(arrowGeo, arrowStraightMat);
      aN.rotation.x = -Math.PI / 2;
      aN.position.set(-cellSize * 0.24, STENCIL_Y, -half + 1.25);
      group.add(aN);

      // South approach: Straight/Turn stencil on incoming lane
      const aS = new THREE.Mesh(arrowGeo, arrowStraightMat);
      aS.rotation.x = -Math.PI / 2;
      aS.rotation.z = Math.PI;
      aS.position.set(cellSize * 0.24, STENCIL_Y, half - 1.25);
      group.add(aS);

      // East approach
      const aE = new THREE.Mesh(arrowGeo, arrowLeftMat);
      aE.rotation.x = -Math.PI / 2;
      aE.rotation.z = -Math.PI / 2;
      aE.position.set(half - 1.25, STENCIL_Y, -cellSize * 0.24);
      group.add(aE);

      // West approach
      const aW = new THREE.Mesh(arrowGeo, arrowRightMat);
      aW.rotation.x = -Math.PI / 2;
      aW.rotation.z = Math.PI / 2;
      aW.position.set(-half + 1.25, STENCIL_Y, cellSize * 0.24);
      group.add(aW);
    }

    // 4. Quadrant Sidewalk Corner Fillets (NW, NE, SW, SE)
    if (!isService) {
      const cornerOffsets: Array<{ x: number; z: number; angle: number }> = [
        { x: -half + 0.45, z: -half + 0.45, angle: Math.PI / 4 },
        { x: half - 0.45, z: -half + 0.45, angle: -Math.PI / 4 },
        { x: -half + 0.45, z: half - 0.45, angle: (3 * Math.PI) / 4 },
        { x: half - 0.45, z: half - 0.45, angle: -(3 * Math.PI) / 4 },
      ];

      for (const corner of cornerOffsets) {
        // Concrete sidewalk corner pad
        const swPad = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.75), sidewalkMat);
        swPad.position.set(corner.x, 0.035, corner.z);
        swPad.receiveShadow = true;
        group.add(swPad);

        // Concrete curb boundary edging
        const curbPiece = new THREE.Mesh(new THREE.BoxGeometry(0.82, curbH, 0.12), curbMat);
        curbPiece.position.set(corner.x, curbH / 2 + 0.035, corner.z);
        curbPiece.rotation.y = corner.angle;
        curbPiece.receiveShadow = true;
        group.add(curbPiece);

        // Traffic Light Signal Post located securely on sidewalk corner
        this.addTrafficSignalPost(group, corner.x, corner.z, corner.angle, materialsManager);
      }
    }

    // 5. Center junction diamond / dashed guide
    const centerGuideMat = isArterial ? yellowMat : whiteMat;
    const centerBox = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), centerGuideMat);
    centerBox.rotation.x = -Math.PI / 2;
    centerBox.position.set(0, MARKING_Y, 0);
    group.add(centerBox);
  }

  /**
   * Builds a realistic 3-aspect municipal traffic signal post with cantilever mast arm
   */
  private static addTrafficSignalPost(
    group: THREE.Group,
    x: number,
    z: number,
    facingAngle: number,
    materialsManager: MaterialsManager
  ): void {
    const postGroup = new THREE.Group();
    postGroup.position.set(x, 0.06, z);
    postGroup.rotation.y = facingAngle;

    const steelMat = materialsManager.get('highway_guardrail_steel');
    const redMat = materialsManager.get('drum_hazard_red');
    const yellowMat = materialsManager.get('road_marking_yellow');
    const greenMat = materialsManager.get('buoy_light_green') || materialsManager.get('tree_foliage_lush');

    // 1. Cast-iron base collar
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), steelMat);
    base.position.y = 0.11;
    base.castShadow = true;
    postGroup.add(base);

    // 2. Vertical galvanized mast pole (height 2.5m)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.5, 8), steelMat);
    pole.position.y = 1.25;
    pole.castShadow = true;
    postGroup.add(pole);

    // 3. Cantilever outreach arm pointing slightly toward roadway
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.45), steelMat);
    arm.position.set(0, 2.45, 0.22);
    arm.castShadow = true;
    postGroup.add(arm);

    // 4. Traffic signal head housing
    const headHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.1), steelMat);
    headHousing.position.set(0, 2.38, 0.42);
    headHousing.castShadow = true;
    postGroup.add(headHousing);

    // 5. Three signal aspects (Red, Amber, Green)
    const lensGeo = new THREE.CircleGeometry(0.032, 10);

    const redLens = new THREE.Mesh(lensGeo, redMat);
    redLens.position.set(0, 2.48, 0.472);
    postGroup.add(redLens);

    const yellowLens = new THREE.Mesh(lensGeo, yellowMat);
    yellowLens.position.set(0, 2.38, 0.472);
    postGroup.add(yellowLens);

    const greenLens = new THREE.Mesh(lensGeo, greenMat);
    greenLens.position.set(0, 2.28, 0.472);
    postGroup.add(greenLens);

    group.add(postGroup);
  }

  /**
   * Builds a circular roundabout with raised central splitter island and yield teeth markings
   */
  public static buildRoundabout(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const whiteMat = materialsManager.get('road_marking');
    const curbMat = materialsManager.get('concrete_curb');
    const grassMat = materialsManager.get('ground_grass_primary');

    // 1. Raised Center Traffic Island (Diameter 2.2m, Height 0.12m)
    const islandRadius = 1.1;
    const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius, 0.12, 24);
    const islandMesh = new THREE.Mesh(islandGeo, grassMat);
    islandMesh.position.set(0, 0.06, 0);
    group.add(islandMesh);

    // Concrete curb ring around central island
    const ringGeo = new THREE.RingGeometry(islandRadius, islandRadius + 0.15, 24);
    const ringMesh = new THREE.Mesh(ringGeo, curbMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.122, 0);
    group.add(ringMesh);

    // 2. Circulating roadway dashed circular guide
    const circGuideGeo = new THREE.RingGeometry(islandRadius + 0.45, islandRadius + 0.52, 24);
    const circGuide = new THREE.Mesh(circGuideGeo, whiteMat);
    circGuide.rotation.x = -Math.PI / 2;
    circGuide.position.set(0, MARKING_Y, 0);
    group.add(circGuide);

    // 3. Yield teeth ("shark's teeth") on entry approaches
    const half = cellSize / 2;
    const teethApproaches = [
      { x: 0, z: -half + 0.45, rot: 0 },
      { x: 0, z: half - 0.45, rot: Math.PI },
      { x: -half + 0.45, z: 0, rot: -Math.PI / 2 },
      { x: half - 0.45, z: 0, rot: Math.PI / 2 },
    ];

    for (const app of teethApproaches) {
      const toothGeo = new THREE.ConeGeometry(0.12, 0.25, 3);
      const tooth = new THREE.Mesh(toothGeo, whiteMat);
      tooth.rotation.x = -Math.PI / 2;
      tooth.rotation.z = app.rot;
      tooth.position.set(app.x, STENCIL_Y, app.z);
      group.add(tooth);
    }
  }

  /**
   * Builds highway merge / exit ramp with chevron-striped gore area and deceleration guides
   */
  public static buildHighwayMerge(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const whiteMat = materialsManager.get('road_marking');
    const yellowMat = materialsManager.get('road_marking_yellow');

    // 1. Tapered gore chevron stripes (neutral channelization area)
    const chevronCount = 4;
    for (let i = 0; i < chevronCount; i++) {
      const t = (i + 1) / (chevronCount + 1);
      const chevron = new THREE.Mesh(new THREE.PlaneGeometry(0.12, cellSize * 0.35 * (1 - t * 0.4)), yellowMat);
      chevron.rotation.x = -Math.PI / 2;
      chevron.rotation.z = Math.PI / 4; // 45 degree angle
      chevron.position.set(-cellSize * 0.25 + t * cellSize * 0.4, STENCIL_Y, -cellSize * 0.2 + t * cellSize * 0.3);
      group.add(chevron);
    }

    // 2. Solid channelization line separating carriageway from ramp
    const goreBorder = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.8, 0.15), whiteMat);
    goreBorder.rotation.x = -Math.PI / 2;
    goreBorder.rotation.z = Math.PI / 6;
    goreBorder.position.set(0, MARKING_Y, 0);
    group.add(goreBorder);

    // 3. Deceleration dashed lane markings
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.5, 0.15), whiteMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, MARKING_Y, cellSize * 0.25);
    group.add(dash);
  }

  /**
   * Builds curved road connection with filleted inner/outer corner curbs and smooth arc markings
   */
  public static buildCurvedCorner(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const isArterial = cell.roadType === 'heavy_arterial' || cell.roadType === 'arterial';
    const isService = cell.roadType === 'industrial_access';
    const whiteMat = materialsManager.get('road_marking');
    const yellowMat = materialsManager.get('road_marking_yellow');
    const primaryMarking = isArterial ? yellowMat : whiteMat;
    const curbMat = materialsManager.get('concrete_curb');
    const curbH = 0.07;
    const curbT = 0.14;
    const half = cellSize / 2;

    // Corner direction: e.g. corner_ne connects North and East
    const isNE = cell.junctionType === 'corner_ne';
    const isNW = cell.junctionType === 'corner_nw';
    const isSE = cell.junctionType === 'corner_se';
    const isSW = cell.junctionType === 'corner_sw';

    // 1. Curved center arc markings (3 segmented planes approximating quadratic Bezier)
    const segCount = 4;
    for (let i = 0; i < segCount; i++) {
      const angle = (i / (segCount - 1)) * (Math.PI / 2);
      const r = cellSize * 0.35;
      let px = 0;
      let pz = 0;

      if (isNE) {
        px = half - r * (1 - Math.sin(angle));
        pz = -half + r * (1 - Math.cos(angle));
      } else if (isNW) {
        px = -half + r * (1 - Math.sin(angle));
        pz = -half + r * (1 - Math.cos(angle));
      } else if (isSE) {
        px = half - r * (1 - Math.sin(angle));
        pz = half - r * (1 - Math.cos(angle));
      } else if (isSW) {
        px = -half + r * (1 - Math.sin(angle));
        pz = half - r * (1 - Math.cos(angle));
      }

      const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.08), primaryMarking);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(px, MARKING_Y, pz);
      group.add(seg);
    }

    // 2. Corner curbs along non-connected edges
    if (!isService) {
      if (isNE) {
        // Outer curbs at South and West
        const curbS = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        curbS.position.set(0, curbH / 2 + 0.035, half - curbT / 2);
        group.add(curbS);
        const curbW = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        curbW.position.set(-half + curbT / 2, curbH / 2 + 0.035, 0);
        group.add(curbW);
      } else if (isNW) {
        // Outer curbs at South and East
        const curbS = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        curbS.position.set(0, curbH / 2 + 0.035, half - curbT / 2);
        group.add(curbS);
        const curbE = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        curbE.position.set(half - curbT / 2, curbH / 2 + 0.035, 0);
        group.add(curbE);
      } else if (isSE) {
        // Outer curbs at North and West
        const curbN = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        curbN.position.set(0, curbH / 2 + 0.035, -half + curbT / 2);
        group.add(curbN);
        const curbW = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        curbW.position.set(-half + curbT / 2, curbH / 2 + 0.035, 0);
        group.add(curbW);
      } else if (isSW) {
        // Outer curbs at North and East
        const curbN = new THREE.Mesh(new THREE.BoxGeometry(cellSize, curbH, curbT), curbMat);
        curbN.position.set(0, curbH / 2 + 0.035, -half + curbT / 2);
        group.add(curbN);
        const curbE = new THREE.Mesh(new THREE.BoxGeometry(curbT, curbH, cellSize), curbMat);
        curbE.position.set(half - curbT / 2, curbH / 2 + 0.035, 0);
        group.add(curbE);
      }
    }
  }

  /**
   * Builds bridge approach transition with expansion joints and abutment barriers
   */
  public static buildBridgeApproach(
    group: THREE.Group,
    cell: RoadCellData,
    cellSize: number,
    materialsManager: MaterialsManager
  ): void {
    const steelMat = materialsManager.get('highway_guardrail_steel');
    const concreteMat = materialsManager.get('bridge_pier_concrete');

    // 1. Metal expansion joint strip across road cell width
    const jointGeo = new THREE.BoxGeometry(cellSize, 0.03, 0.15);
    const joint = new THREE.Mesh(jointGeo, steelMat);
    joint.position.set(0, 0.045, 0);
    group.add(joint);

    // 2. Concrete abutment wing walls on flanks
    const wingWallGeo = new THREE.BoxGeometry(0.3, 0.6, cellSize * 0.8);
    const leftWing = new THREE.Mesh(wingWallGeo, concreteMat);
    leftWing.position.set(-cellSize / 2 + 0.15, 0.3, 0);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingWallGeo, concreteMat);
    rightWing.position.set(cellSize / 2 - 0.15, 0.3, 0);
    group.add(rightWing);
  }

  private static inferStemDirection(conn: { north: boolean; south: boolean; east: boolean; west: boolean }): 'north' | 'south' | 'east' | 'west' {
    if (!conn.north) return 'south';
    if (!conn.south) return 'north';
    if (!conn.east) return 'west';
    return 'east';
  }

  private static addCornerCurbFillets(
    group: THREE.Group,
    stemDir: string,
    cellSize: number,
    filletR: number,
    curbMat: THREE.Material,
    curbH: number,
    curbT: number
  ): void {
    const half = cellSize / 2;
    // Fillets are placed at the two corners flanking the stem
    const filletPositions: Array<{ x: number; z: number }> = [];

    if (stemDir === 'south') {
      filletPositions.push({ x: -half + filletR / 2, z: half - filletR / 2 });
      filletPositions.push({ x: half - filletR / 2, z: half - filletR / 2 });
    } else if (stemDir === 'north') {
      filletPositions.push({ x: -half + filletR / 2, z: -half + filletR / 2 });
      filletPositions.push({ x: half - filletR / 2, z: -half + filletR / 2 });
    } else if (stemDir === 'west') {
      filletPositions.push({ x: -half + filletR / 2, z: -half + filletR / 2 });
      filletPositions.push({ x: -half + filletR / 2, z: half - filletR / 2 });
    } else {
      filletPositions.push({ x: half - filletR / 2, z: -half + filletR / 2 });
      filletPositions.push({ x: half - filletR / 2, z: half - filletR / 2 });
    }

    for (const pos of filletPositions) {
      const fillet = new THREE.Mesh(new THREE.BoxGeometry(curbT * 1.5, curbH, curbT * 1.5), curbMat);
      fillet.position.set(pos.x, curbH / 2 + 0.035, pos.z);
      group.add(fillet);
    }
  }
}
