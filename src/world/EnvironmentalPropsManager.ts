import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { RoadNetworkModel } from './RoadNetworkModel';

export interface PropInstance {
  id: string;
  type: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  rotationY: number;
  scale?: number;
}

export class EnvironmentalPropsManager implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;
  private materialsManager: MaterialsManager;
  private roadModel: RoadNetworkModel;

  private instancedMeshes: THREE.InstancedMesh[] = [];
  private propRecords: PropInstance[] = [];

  constructor(
    gridSystem: GridSystem,
    materialsManager: MaterialsManager,
    roadModel: RoadNetworkModel
  ) {
    this.gridSystem = gridSystem;
    this.materialsManager = materialsManager;
    this.roadModel = roadModel;

    this.group = new THREE.Group();
    this.group.name = 'environmental_props';
  }

  public generate(): void {
    this.buildStreetlights();
    this.buildIndustrialFencing();
    this.buildSafetyBollards();
    this.buildYardStorageAndPallets();
    this.buildUtilityInfrastructure();
    this.buildTrafficSignage();
    this.buildCurbsideCivilFixtures();
    this.buildLandscapedHedges();
  }

  /**
   * Industrial gooseneck streetlights along avenues and arterials.
   * Placed along the shoulder/sidewalk without encroaching on vehicle traffic.
   */
  private buildStreetlights(): void {
    const streetlightGroup = new THREE.Group();
    streetlightGroup.name = 'streetlights';

    // Shared streetlight sub-geometries
    const poleH = 6.8;
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, poleH, 8);
    const armGeo = new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8);
    armGeo.rotateZ(Math.PI / 3);
    const headGeo = new THREE.BoxGeometry(0.55, 0.18, 0.3);
    const lampLensGeo = new THREE.PlaneGeometry(0.45, 0.22);
    lampLensGeo.rotateX(Math.PI / 2);

    const postMat = this.materialsManager.get('streetlight_post');
    const lampMat = this.materialsManager.get('streetlight_lamp');

    // Strategic perimeter illumination for industrial yards and storage aprons
    // (Road carriageway streetlights are authoritatively managed by RoadsideDetailingManager)
    const positions = [
      // Sector Logistics Hub yard perimeter
      { gridX: 4, gridZ: 14, side: 'south', rot: Math.PI },
      // Manufacturing Plant rear yard & equipment storage
      { gridX: 7, gridZ: 3, side: 'north', rot: 0 },
      { gridX: 9, gridZ: 3, side: 'west', rot: Math.PI / 2 },
      // Southern intermodal yard perimeter
      { gridX: 16, gridZ: 20, side: 'east', rot: -Math.PI / 2 },
      { gridX: 16, gridZ: 24, side: 'east', rot: -Math.PI / 2 },
    ];

    // 3.1m offset places the pole base firmly on the pedestrian sidewalk/shoulder (well clear of 2.4m road half-width)
    const curbOffset = 3.1;

    positions.forEach((pos, idx) => {
      const cellCenter = this.gridSystem.gridToWorldCenter(pos.gridX, pos.gridZ);
      let posX = cellCenter.x;
      let posZ = cellCenter.z;

      // Position neatly along shoulder curb outside the active drivable road lane
      if (pos.side === 'north') posZ -= curbOffset;
      else if (pos.side === 'south') posZ += curbOffset;
      else if (pos.side === 'east') posX += curbOffset;
      else if (pos.side === 'west') posX -= curbOffset;

      const light = new THREE.Group();
      light.position.set(posX, 0, posZ);
      light.rotation.y = pos.rot;

      // Base mounting plinth
      const baseGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.25, 8);
      const base = new THREE.Mesh(baseGeo, postMat);
      base.position.y = 0.125;
      base.castShadow = true;
      light.add(base);

      // Main Vertical Pole
      const pole = new THREE.Mesh(poleGeo, postMat);
      pole.position.y = poleH / 2;
      pole.castShadow = true;
      light.add(pole);

      // Curved Luminaire Overhang Arm
      const arm = new THREE.Mesh(armGeo, postMat);
      arm.position.set(0.8, poleH - 0.35, 0);
      arm.castShadow = true;
      light.add(arm);

      // Luminaire Hood
      const head = new THREE.Mesh(headGeo, postMat);
      head.position.set(1.6, poleH + 0.15, 0);
      head.castShadow = true;
      light.add(head);

      // Emissive LED / Sodium Lens
      const lens = new THREE.Mesh(lampLensGeo, lampMat);
      lens.position.set(1.6, poleH + 0.05, 0);
      light.add(lens);

      streetlightGroup.add(light);

      this.propRecords.push({
        id: `streetlight_${idx}`,
        type: 'streetlight',
        worldX: posX,
        worldY: 0,
        worldZ: posZ,
        rotationY: pos.rot,
      });
    });

    this.group.add(streetlightGroup);
  }

  /**
   * Galvanized chain-link security perimeter fencing around heavy industry & intermodal yard.
   * Deliberately placed along property lines, never crossing roads or building doorways.
   */
  private buildIndustrialFencing(): void {
    const fenceGroup = new THREE.Group();
    fenceGroup.name = 'security_fences';

    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
    const railGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.0, 6);
    railGeo.rotateZ(Math.PI / 2);
    const meshGeo = new THREE.PlaneGeometry(1.95, 1.4);

    const postMat = this.materialsManager.get('fence_post');
    const meshMat = this.materialsManager.get('fence_mesh');

    // Fencing runs along the perimeter of Apex Manufacturing (North: Z=3, West: X=4.5)
    const fenceRuns = [
      // Northern perimeter of industrial plot (X from 5 to 9 at Z=3.8)
      { x1: 5, z1: 3.8, x2: 9.5, z2: 3.8 },
      // Western perimeter of industrial plot (Z from 4 to 8 at X=4.8)
      { x1: 4.8, z1: 4, x2: 4.8, z2: 8.5 },
      // Eastern perimeter of container expansion plot (X=15 to 20 at Z=13.8)
      { x1: 15.5, z1: 13.8, x2: 19.5, z2: 13.8 },
    ];

    fenceRuns.forEach((run, runIdx) => {
      const c1 = this.gridSystem.gridToWorldCenter(Math.floor(run.x1), Math.floor(run.z1));
      const c2 = this.gridSystem.gridToWorldCenter(Math.floor(run.x2), Math.floor(run.z2));

      const dx = c2.x - c1.x;
      const dz = c2.z - c1.z;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);

      const segmentLength = 2.0;
      const segments = Math.max(1, Math.floor(dist / segmentLength));

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const px = c1.x + dx * t;
        const pz = c1.z + dz * t;

        // Fence Post
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.9, pz);
        post.castShadow = true;
        fenceGroup.add(post);

        // Fence Panel between posts
        if (s < segments) {
          const midX = px + (dx / segments) * 0.5;
          const midZ = pz + (dz / segments) * 0.5;

          const panel = new THREE.Mesh(meshGeo, meshMat);
          panel.position.set(midX, 1.0, midZ);
          panel.rotation.y = angle + Math.PI / 2;
          fenceGroup.add(panel);

          // Top and Bottom tension rail
          const topRail = new THREE.Mesh(railGeo, postMat);
          topRail.position.set(midX, 1.7, midZ);
          topRail.rotation.y = angle + Math.PI / 2;
          fenceGroup.add(topRail);

          const btmRail = new THREE.Mesh(railGeo, postMat);
          btmRail.position.set(midX, 0.3, midZ);
          btmRail.rotation.y = angle + Math.PI / 2;
          fenceGroup.add(btmRail);
        }
      }

      this.propRecords.push({
        id: `fence_run_${runIdx}`,
        type: 'fence_run',
        worldX: c1.x,
        worldY: 0,
        worldZ: c1.z,
        rotationY: angle,
      });
    });

    this.group.add(fenceGroup);
  }

  /**
   * High-visibility OSHA safety bollards protecting building corners and equipment.
   */
  private buildSafetyBollards(): void {
    const bollardGroup = new THREE.Group();
    bollardGroup.name = 'safety_bollards';

    const bollardH = 0.9;
    const bollardGeo = new THREE.CylinderGeometry(0.09, 0.09, bollardH, 8);
    const ringGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8);

    const bollardMat = this.materialsManager.get('safety_bollard_yellow');
    const ringMat = this.materialsManager.get('bollard_black_ring');

    // Strategic locations: warehouse loading corners, factory fuel tanks
    const bollardCoords = [
      // Sector Logistics Hub loading bay approach protection
      { gridX: 5, gridZ: 13, offX: -0.8, offZ: 0.8 },
      { gridX: 5, gridZ: 13, offX: 0.8, offZ: 0.8 },
      { gridX: 8, gridZ: 13, offX: 0.8, offZ: 0.8 },
      // Manufacturing raw material silo protection
      { gridX: 6, gridZ: 4, offX: -0.6, offZ: -0.6 },
      { gridX: 8, gridZ: 4, offX: 0.6, offZ: -0.6 },
      // Commercial HQ parking apron corners
      { gridX: 13, gridZ: 6, offX: 0.7, offZ: -0.7 },
      { gridX: 16, gridZ: 6, offX: 0.7, offZ: 0.7 },
    ];

    bollardCoords.forEach((b, idx) => {
      const cellCenter = this.gridSystem.gridToWorldCenter(b.gridX, b.gridZ);
      const px = cellCenter.x + b.offX;
      const pz = cellCenter.z + b.offZ;

      const singleBollard = new THREE.Group();
      singleBollard.position.set(px, 0, pz);

      // Yellow core
      const core = new THREE.Mesh(bollardGeo, bollardMat);
      core.position.y = bollardH / 2;
      core.castShadow = true;
      singleBollard.add(core);

      // Black rubber base collar
      const collar = new THREE.Mesh(ringGeo, ringMat);
      collar.position.y = 0.08;
      singleBollard.add(collar);

      // Top hazard band
      const topBand = new THREE.Mesh(ringGeo, ringMat);
      topBand.position.y = bollardH - 0.15;
      singleBollard.add(topBand);

      bollardGroup.add(singleBollard);

      this.propRecords.push({
        id: `bollard_${idx}`,
        type: 'bollard',
        worldX: px,
        worldY: 0,
        worldZ: pz,
        rotationY: 0,
      });
    });

    this.group.add(bollardGroup);
  }

  /**
   * Industrial yard storage: Stacks of treated pine pallets and steel chemical/fuel drums.
   */
  private buildYardStorageAndPallets(): void {
    const yardGroup = new THREE.Group();
    yardGroup.name = 'yard_storage';

    const palletMat = this.materialsManager.get('pallet_wood');
    const blueDrumMat = this.materialsManager.get('drum_chemical_blue');
    const redDrumMat = this.materialsManager.get('drum_hazard_red');

    // Pallet geometry: 1.2m x 1.0m x 0.14m
    const palletGeo = new THREE.BoxGeometry(1.2, 0.14, 1.0);
    const drumGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10);

    // 1. Pallet stacks behind Sector Logistics Hub (gridX = 9, gridZ = 16)
    const p1Center = this.gridSystem.gridToWorldCenter(9, 16);

    for (let stack = 0; stack < 3; stack++) {
      const offX = (stack - 1) * 1.35;
      const stackHeight = 2 + (stack % 2);

      for (let h = 0; h < stackHeight; h++) {
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        pallet.position.set(p1Center.x + offX, 0.07 + h * 0.15, p1Center.z);
        pallet.rotation.y = (stack * 0.1) + (h * 0.02);
        pallet.castShadow = true;
        pallet.receiveShadow = true;
        yardGroup.add(pallet);
      }
    }

    // 2. Clustered chemical drums on containment pad behind Manufacturing (gridX = 5, gridZ = 8)
    const drumCenter = this.gridSystem.gridToWorldCenter(5, 8);
    const drumPositions = [
      { dx: -0.32, dz: -0.32, mat: blueDrumMat },
      { dx: 0.32, dz: -0.32, mat: blueDrumMat },
      { dx: -0.32, dz: 0.32, mat: redDrumMat },
      { dx: 0.32, dz: 0.32, mat: blueDrumMat },
    ];

    drumPositions.forEach((d) => {
      const drum = new THREE.Mesh(drumGeo, d.mat);
      drum.position.set(drumCenter.x + d.dx, 0.425, drumCenter.z + d.dz);
      drum.castShadow = true;
      drum.receiveShadow = true;
      yardGroup.add(drum);
    });

    this.group.add(yardGroup);
  }

  /**
   * Utility power transformer cabinets and municipal electrical equipment.
   */
  private buildUtilityInfrastructure(): void {
    const utilityGroup = new THREE.Group();
    utilityGroup.name = 'utility_infrastructure';

    const transMat = this.materialsManager.get('utility_transformer');
    const concreteMat = this.materialsManager.get('concrete_foundation');

    // High-voltage padmount transformer behind Apex Manufacturing (gridX = 9, gridZ = 4)
    const tCenter = this.gridSystem.gridToWorldCenter(9, 4);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.4), concreteMat);
    pad.position.set(tCenter.x, 0.1, tCenter.z);
    pad.receiveShadow = true;
    utilityGroup.add(pad);

    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.0), transMat);
    kiosk.position.set(tCenter.x, 0.8, tCenter.z);
    kiosk.castShadow = true;
    utilityGroup.add(kiosk);

    // Hazard warning decal stripe
    const hazardMat = this.materialsManager.get('hazard_apron_border');
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), hazardMat);
    decal.position.set(tCenter.x, 0.85, tCenter.z + 0.51);
    utilityGroup.add(decal);

    this.group.add(utilityGroup);
  }

  /**
   * Roadside Traffic & Regulatory Signs (Speed Limit 45, Truck Route, Intersection Stop).
   */
  private buildTrafficSignage(): void {
    const signGroup = new THREE.Group();
    signGroup.name = 'traffic_signs';

    const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6);
    const signPlateGeo = new THREE.BoxGeometry(0.5, 0.5, 0.03);
    const octPlateGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 8);
    octPlateGeo.rotateX(Math.PI / 2);

    const poleMat = this.materialsManager.get('road_sign_pole');
    const faceMat = this.materialsManager.get('road_sign_face');
    const stopMat = this.materialsManager.get('drum_hazard_red');

    // 1. Stop sign at T-intersection (road_industrial_branch meeting main avenue: gridX=11, gridZ=10.5)
    const stopCenter = this.gridSystem.gridToWorldCenter(11, 10);
    const stopSign = new THREE.Group();
    stopSign.position.set(stopCenter.x + 1.25, 0, stopCenter.z + 0.6);

    const sPole = new THREE.Mesh(poleGeo, poleMat);
    sPole.position.y = 1.1;
    sPole.castShadow = true;
    stopSign.add(sPole);

    const sPlate = new THREE.Mesh(octPlateGeo, stopMat);
    sPlate.position.set(0, 2.0, 0);
    sPlate.rotation.y = Math.PI;
    sPlate.castShadow = true;
    stopSign.add(sPlate);

    signGroup.add(stopSign);

    // 2. Highway Truck Route sign at Western entrance (gridX=2, gridZ=11)
    const wCenter = this.gridSystem.gridToWorldCenter(2, 11);
    const truckSign = new THREE.Group();
    truckSign.position.set(wCenter.x, 0, wCenter.z - 1.25);

    const tPole = new THREE.Mesh(poleGeo, poleMat);
    tPole.position.y = 1.1;
    tPole.castShadow = true;
    truckSign.add(tPole);

    const tPlate = new THREE.Mesh(signPlateGeo, faceMat);
    tPlate.position.set(0, 1.9, 0);
    tPlate.castShadow = true;
    truckSign.add(tPlate);

    signGroup.add(truckSign);

    this.group.add(signGroup);
  }

  /**
   * Stormwater sewer grates and municipal fire hydrants along curbs.
   */
  private buildCurbsideCivilFixtures(): void {
    const fixtureGroup = new THREE.Group();
    fixtureGroup.name = 'curbside_fixtures';

    const grateGeo = new THREE.PlaneGeometry(0.65, 0.4);
    grateGeo.rotateX(-Math.PI / 2);
    const grateMat = this.materialsManager.get('storm_drain_grate');

    const hydrantMat = this.materialsManager.get('fire_hydrant_red');
    const hydrantGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.65, 8);

    // Drainage grates positioned along curb gutter on Main Avenue
    const gratePositions = [
      { gridX: 6, gridZ: 11, offZ: -0.92 },
      { gridX: 14, gridZ: 11, offZ: -0.92 },
      { gridX: 8, gridZ: 11, offZ: 0.92 },
      { gridX: 18, gridZ: 11, offZ: 0.92 },
    ];

    gratePositions.forEach((g) => {
      const c = this.gridSystem.gridToWorldCenter(g.gridX, g.gridZ);
      const grate = new THREE.Mesh(grateGeo, grateMat);
      grate.position.set(c.x, 0.045, c.z + g.offZ);
      grate.receiveShadow = true;
      fixtureGroup.add(grate);
    });

    // Fire hydrant near Commercial HQ corner (gridX=13, gridZ=10)
    const hCenter = this.gridSystem.gridToWorldCenter(13, 10);
    const hydrant = new THREE.Mesh(hydrantGeo, hydrantMat);
    hydrant.position.set(hCenter.x + 0.8, 0.325, hCenter.z - 0.7);
    hydrant.castShadow = true;
    fixtureGroup.add(hydrant);

    this.group.add(fixtureGroup);
  }

  /**
   * Manicured boxwood hedges around Commercial HQ annex for a professional corporate finish.
   */
  private buildLandscapedHedges(): void {
    const hedgeGroup = new THREE.Group();
    hedgeGroup.name = 'landscaped_hedges';

    const hedgeMat = this.materialsManager.get('hedge_foliage');
    const hedgeGeo = new THREE.BoxGeometry(1.8, 0.65, 0.5);

    // Hedges framing the walkway at Commercial HQ (gridX=14, gridZ=6)
    const hCenter = this.gridSystem.gridToWorldCenter(14, 8);

    for (let i = 0; i < 3; i++) {
      const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
      hedge.position.set(hCenter.x + (i - 1) * 2.0, 0.325, hCenter.z - 0.8);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      hedgeGroup.add(hedge);
    }

    this.group.add(hedgeGroup);
  }

  public getProps(): PropInstance[] {
    return [...this.propRecords];
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });

    for (const mesh of this.instancedMeshes) {
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.instancedMeshes = [];
    this.propRecords = [];

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
