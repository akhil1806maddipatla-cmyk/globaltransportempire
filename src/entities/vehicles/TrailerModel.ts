import * as THREE from 'three';
import { TrailerDefinition } from '../../data/vehicleDefinitions';
import { MaterialsManager } from '../../rendering/MaterialsManager';
import { VehicleModularComponents, TandemAxleResult, LandingLegsResult } from './VehicleModularComponents';

/**
 * Modular Heavy-Duty Commercial Freight Trailer Model
 * Supports Skeletal Intermodal Container Chassis and Enclosed Dry Van Trailers.
 * Includes kingpin coupling, landing legs, tandem axle bogie, rear bumper,
 * conspicuity tape, container twistlocks, and rear lighting fixtures.
 */
export class TrailerModel {
  public readonly group: THREE.Group;
  public readonly definition: TrailerDefinition;
  public readonly materials: MaterialsManager;

  public readonly kingpinTransform: THREE.Group;
  public readonly wheels: THREE.Group[] = [];
  public readonly twistlockPoints: THREE.Vector3[] = [];

  private landingLegsController: (deployed: boolean) => void;
  private isLandingLegsDeployed: boolean = false;
  private currentWheelRot: number = 0;

  constructor(definition: TrailerDefinition, materials: MaterialsManager) {
    this.definition = definition;
    this.materials = materials;

    this.group = new THREE.Group();
    this.group.name = `trailer_${definition.id}`;

    const dim = definition.dimensions;
    const steelMat = materials.get('trailer_chassis_dark');
    const tapeMat = materials.get('trailer_conspicuity_tape');

    // 1. Kingpin Coupling Point at Front
    this.kingpinTransform = new THREE.Group();
    this.kingpinTransform.name = 'trailer_kingpin_point';
    this.kingpinTransform.position.set(
      definition.kingpinOffset.x,
      definition.kingpinOffset.y,
      definition.kingpinOffset.z
    );

    // Steel kingpin pin hanging below bolster plate
    const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12);
    const pin = new THREE.Mesh(pinGeo, materials.get('truck_wheel_chrome'));
    pin.position.y = -0.08;
    this.kingpinTransform.add(pin);

    // Heavy front bolster plate
    const bolsterGeo = new THREE.BoxGeometry(dim.width * 0.92, 0.08, 1.4);
    const bolster = new THREE.Mesh(bolsterGeo, steelMat);
    bolster.position.y = 0.04;
    bolster.castShadow = true;
    bolster.receiveShadow = true;
    this.kingpinTransform.add(bolster);

    this.group.add(this.kingpinTransform);

    // 2. Main Longitudinal I-Beam Structural Frame
    const beamLength = dim.length;
    const beamSpacing = 1.05;
    const beamH = 0.28;
    const beamW = 0.09;

    [-beamSpacing / 2, beamSpacing / 2].forEach((bx) => {
      const beamGeo = new THREE.BoxGeometry(beamW, beamH, beamLength);
      const beam = new THREE.Mesh(beamGeo, steelMat);
      beam.position.set(bx, 1.25, 0);
      beam.castShadow = true;
      beam.receiveShadow = true;
      this.group.add(beam);
    });

    // Cross-member outriggers and bracing
    for (let z = -beamLength / 2 + 0.8; z <= beamLength / 2 - 0.8; z += 1.8) {
      const crossGeo = new THREE.BoxGeometry(dim.width * 0.94, 0.1, 0.1);
      const cross = new THREE.Mesh(crossGeo, steelMat);
      cross.position.set(0, 1.25, z);
      this.group.add(cross);
    }

    // 3. Telescopic Landing Legs
    const legsResult: LandingLegsResult = VehicleModularComponents.createTrailerLandingLegs(materials);
    legsResult.group.position.set(
      definition.landingLegsOffset.x,
      0.65,
      definition.landingLegsOffset.z
    );
    this.group.add(legsResult.group);
    this.landingLegsController = legsResult.setDeployed;

    // 4. Rear Tandem Axle Bogie
    const bogieSpacing = Math.abs(definition.rearAxleOffsetsZ[0] - definition.rearAxleOffsetsZ[1]);
    const bogieCenterZ = (definition.rearAxleOffsetsZ[0] + definition.rearAxleOffsetsZ[1]) / 2;

    const tandemResult: TandemAxleResult = VehicleModularComponents.createTandemDriveAxles(
      bogieSpacing,
      2.05,
      0.52,
      materials
    );
    tandemResult.group.position.z = bogieCenterZ;
    this.group.add(tandemResult.group);
    this.wheels.push(...tandemResult.wheels);

    // Heavy tandem quarter-fenders and mudflaps
    this.buildTrailerMudguards(definition.rearAxleOffsetsZ);

    // 5. Rear Underride Guard (ICC Bumper) and Conspicuity Tape
    const rearBumperZ = -beamLength / 2 - 0.12;
    const bumperGeo = new THREE.BoxGeometry(dim.width * 0.92, 0.14, 0.12);
    const bumper = new THREE.Mesh(bumperGeo, steelMat);
    bumper.position.set(0, 0.55, rearBumperZ);
    bumper.castShadow = true;
    this.group.add(bumper);

    // Vertical bumper drop struts
    [-dim.width * 0.35, dim.width * 0.35].forEach((sx) => {
      const strutGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
      const strut = new THREE.Mesh(strutGeo, steelMat);
      strut.position.set(sx, 0.92, rearBumperZ);
      this.group.add(strut);
    });

    // Side Retroreflective DOT Conspicuity Tape
    [-dim.width / 2 - 0.01, dim.width / 2 + 0.01].forEach((tx) => {
      const tapeGeo = new THREE.PlaneGeometry(0.08, beamLength * 0.94);
      tapeGeo.rotateY(tx > 0 ? Math.PI / 2 : -Math.PI / 2);
      tapeGeo.rotateX(Math.PI / 2);
      const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
      tapeMesh.position.set(tx, 1.25, 0);
      this.group.add(tapeMesh);
    });

    // 6. Rear Tail / Brake Lights on Bumper
    const brakeMat = materials.get('vehicle_brake_light');
    const indMat = materials.get('vehicle_indicator');
    const revMat = materials.get('vehicle_reverse_light');

    [-dim.width * 0.38, dim.width * 0.38].forEach((lx, idx) => {
      // Brake
      const brk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.04), brakeMat);
      brk.position.set(lx, 0.55, rearBumperZ - 0.06);
      this.group.add(brk);

      // Indicator
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), indMat);
      ind.position.set(lx + (lx > 0 ? 0.14 : -0.14), 0.55, rearBumperZ - 0.06);
      this.group.add(ind);

      // Reverse
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), revMat);
      rev.position.set(lx + (lx > 0 ? -0.14 : 0.14), 0.55, rearBumperZ - 0.06);
      this.group.add(rev);
    });

    // 7. Variant-specific bodies: Skeletal Twistlocks vs Enclosed Dry Van
    if (definition.type === 'skeletal_chassis') {
      this.buildSkeletalChassisTwistlocks();
    } else {
      this.buildEnclosedDryVanBody();
    }
  }

  private buildTrailerMudguards(axleOffsetsZ: number[]): void {
    const steelMat = this.materials.get('trailer_chassis_dark');
    const flapMat = this.materials.get('trailer_mudflap');
    const w = this.definition.dimensions.width;

    // Fenders over bogie
    axleOffsetsZ.forEach((az) => {
      [-w / 2 - 0.02, w / 2 + 0.02].forEach((mx) => {
        const fenderGeo = new THREE.BoxGeometry(0.52, 0.05, 1.05);
        const fender = new THREE.Mesh(fenderGeo, steelMat);
        fender.position.set(mx > 0 ? mx - 0.12 : mx + 0.12, 1.08, az);
        fender.castShadow = true;
        this.group.add(fender);
      });
    });

    // Heavy rubber mudflaps with diagonal warning stripes
    const rearmostZ = Math.min(...axleOffsetsZ) - 0.72;
    [-0.92, 0.92].forEach((fx) => {
      const flapGeo = new THREE.BoxGeometry(0.52, 0.58, 0.03);
      const flap = new THREE.Mesh(flapGeo, flapMat);
      flap.position.set(fx, 0.54, rearmostZ);
      flap.castShadow = true;
      this.group.add(flap);
    });
  }

  private buildSkeletalChassisTwistlocks(): void {
    const cornerMat = this.materials.get('container_corner_casting');
    const lockGeo = new THREE.BoxGeometry(0.2, 0.15, 0.2);

    if (this.definition.twistlockMountPoints) {
      this.definition.twistlockMountPoints.forEach((pt) => {
        const lock = new THREE.Mesh(lockGeo, cornerMat);
        lock.position.set(pt.x, pt.y, pt.z);
        lock.castShadow = true;
        this.group.add(lock);
        this.twistlockPoints.push(new THREE.Vector3(pt.x, pt.y + 0.08, pt.z));
      });
    }
  }

  private buildEnclosedDryVanBody(): void {
    const dim = this.definition.dimensions;
    const bodyW = dim.width;
    const bodyH = 2.65;
    const bodyL = dim.length * 0.98;
    const bodyY = 1.38 + bodyH / 2;

    const sideMat = this.materials.get('metal_siding_light');
    const roofMat = this.materials.get('metal_roof_silver');
    const steelMat = this.materials.get('trailer_chassis_dark');

    // Main enclosed van body box
    const vanGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
    const vanMesh = new THREE.Mesh(vanGeo, sideMat);
    vanMesh.position.set(0, bodyY, 0);
    vanMesh.castShadow = true;
    vanMesh.receiveShadow = true;
    this.group.add(vanMesh);

    // Silver roof panel cap
    const roofGeo = new THREE.BoxGeometry(bodyW + 0.04, 0.06, bodyL + 0.04);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, bodyY + bodyH / 2 + 0.03, 0);
    roof.castShadow = true;
    this.group.add(roof);

    // Aerodynamic Fuel-Saver Side Skirts (between landing legs and rear bogie)
    const skirtL = 4.8;
    const skirtH = 0.65;
    [-bodyW / 2 - 0.02, bodyW / 2 + 0.02].forEach((sx) => {
      const skirtGeo = new THREE.BoxGeometry(0.04, skirtH, skirtL);
      const skirt = new THREE.Mesh(skirtGeo, steelMat);
      skirt.position.set(sx, 0.88, 0.6);
      skirt.castShadow = true;
      this.group.add(skirt);
    });

    // Double Swing Rear Doors Hardware
    const doorAssembly = VehicleModularComponents.createContainerDoorHardware(
      bodyW * 0.96,
      bodyH * 0.94,
      this.materials
    );
    doorAssembly.position.set(0, bodyY, -bodyL / 2 - 0.02);
    this.group.add(doorAssembly);
  }

  // =========================================================================
  // Controls & Simulation Hooks
  // =========================================================================

  public setLandingLegs(deployed: boolean): void {
    this.isLandingLegsDeployed = deployed;
    this.landingLegsController(deployed);
  }

  public getLandingLegsDeployed(): boolean {
    return this.isLandingLegsDeployed;
  }

  public rollWheels(deltaDistanceMeters: number): void {
    const wheelRadius = 0.52;
    const deltaRad = deltaDistanceMeters / wheelRadius;
    this.currentWheelRot = (this.currentWheelRot + deltaRad) % (Math.PI * 2);

    this.wheels.forEach((w) => {
      w.rotation.x = this.currentWheelRot;
    });
  }

  public getKingpinWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.kingpinTransform.getWorldPosition(target);
  }
}
