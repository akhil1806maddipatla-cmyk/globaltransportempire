import * as THREE from 'three';
import { VehicleDefinition, FleetColor } from '../../data/vehicleDefinitions';
import { MaterialsManager } from '../../rendering/MaterialsManager';
import { VehicleModularComponents, SteeringAxleResult, TandemAxleResult } from './VehicleModularComponents';

export interface TruckLightingState {
  headlights: boolean;
  hazardLights: boolean;
  turnSignal: 'off' | 'left' | 'right';
  brakeLights: boolean;
  reverseLights: boolean;
}

/**
 * High-Detail Commercial Cargo Truck / Prime Mover 3D Model
 * Accurately models a Class 8 heavy-duty tractor unit with aerodynamic cab,
 * full chassis ladder frame, steer axle, tandem drive bogie, fifth-wheel coupling,
 * fuel tanks, exhaust stacks, and interactive lighting fixtures.
 */
export class CargoTruckModel {
  public readonly group: THREE.Group;
  public readonly definition: VehicleDefinition;
  public readonly materials: MaterialsManager;

  // Hierarchical animation & simulation transforms
  public readonly steerLeft: THREE.Group;
  public readonly steerRight: THREE.Group;
  public readonly wheels: THREE.Group[] = [];
  public readonly fifthWheelTransform: THREE.Group;

  // Visual sub-assemblies
  private cabMeshes: THREE.Mesh[] = [];
  private headlightMeshes: THREE.Mesh[] = [];
  private indicatorLeftMeshes: THREE.Mesh[] = [];
  private indicatorRightMeshes: THREE.Mesh[] = [];
  private brakeLightMeshes: THREE.Mesh[] = [];
  private reverseLightMeshes: THREE.Mesh[] = [];

  // Lighting state
  public lightingState: TruckLightingState = {
    headlights: false,
    hazardLights: false,
    turnSignal: 'off',
    brakeLights: false,
    reverseLights: false,
  };

  private currentWheelRot: number = 0;
  private currentSteerAngle: number = 0;
  private currentPaintColor: FleetColor;

  constructor(
    definition: VehicleDefinition,
    materials: MaterialsManager,
    initialColor?: FleetColor
  ) {
    this.definition = definition;
    this.materials = materials;
    this.currentPaintColor = initialColor ?? definition.defaultColor;

    this.group = new THREE.Group();
    this.group.name = `truck_${definition.id}`;

    // 1. Dual Parallel Steel Chassis Frame Rails (C-channel)
    const steelMat = materials.get('truck_chassis_steel');
    const railLength = definition.dimensions.length * 0.94;
    const railH = 0.22;
    const railW = 0.08;
    const railSpacing = 0.95;

    const railGeo = new THREE.BoxGeometry(railW, railH, railLength);
    const railLeft = new THREE.Mesh(railGeo, steelMat);
    railLeft.position.set(-railSpacing / 2, 0.72, -definition.dimensions.length * 0.05);
    railLeft.castShadow = true;
    railLeft.receiveShadow = true;
    this.group.add(railLeft);

    const railRight = new THREE.Mesh(railGeo, steelMat);
    railRight.position.set(railSpacing / 2, 0.72, -definition.dimensions.length * 0.05);
    railRight.castShadow = true;
    railRight.receiveShadow = true;
    this.group.add(railRight);

    // Cross-members bridging the frame rails
    for (let z = -railLength / 2; z <= railLength / 2; z += 1.4) {
      const crossGeo = new THREE.BoxGeometry(railSpacing, 0.08, 0.08);
      const cross = new THREE.Mesh(crossGeo, steelMat);
      cross.position.set(0, 0.72, z);
      this.group.add(cross);
    }

    // 2. Front Steer Axle Assembly
    const steerResult: SteeringAxleResult = VehicleModularComponents.createFrontSteeringAxle(
      1.82,
      0.48,
      materials
    );
    steerResult.group.position.z = definition.frontAxleOffsetZ;
    this.group.add(steerResult.group);
    this.steerLeft = steerResult.steerLeft;
    this.steerRight = steerResult.steerRight;
    this.wheels.push(...steerResult.wheels);

    // 3. Rear Drive Axles
    if (definition.axleConfig === '6x4') {
      const tandemSpacing = Math.abs(definition.rearAxleOffsetsZ[0] - definition.rearAxleOffsetsZ[1]);
      const tandemResult: TandemAxleResult = VehicleModularComponents.createTandemDriveAxles(
        tandemSpacing,
        1.76,
        0.48,
        materials
      );
      const tandemCenterZ = (definition.rearAxleOffsetsZ[0] + definition.rearAxleOffsetsZ[1]) / 2;
      tandemResult.group.position.z = tandemCenterZ;
      this.group.add(tandemResult.group);
      this.wheels.push(...tandemResult.wheels);
    } else {
      // 4x2 Single drive axle
      const singleRearResult: TandemAxleResult = VehicleModularComponents.createTandemDriveAxles(
        0,
        1.76,
        0.48,
        materials
      );
      singleRearResult.group.position.z = definition.rearAxleOffsetsZ[0];
      this.group.add(singleRearResult.group);
      this.wheels.push(...singleRearResult.wheels);
    }

    // Quarter-fenders / mudguards over rear wheels
    this.buildRearMudguards();

    // 4. Fifth-Wheel Coupling Plate
    this.fifthWheelTransform = new THREE.Group();
    this.fifthWheelTransform.name = 'fifth_wheel_coupling_point';
    this.fifthWheelTransform.position.set(
      definition.fifthWheelOffset.x,
      definition.fifthWheelOffset.y,
      definition.fifthWheelOffset.z
    );

    const fifthWheelAssembly = VehicleModularComponents.createFifthWheelCoupling(materials);
    this.fifthWheelTransform.add(fifthWheelAssembly);
    this.group.add(this.fifthWheelTransform);

    // 5. Aluminum Diamond Platform Catwalk behind Cab
    const catwalk = VehicleModularComponents.createDiamondCatwalk(0.85, 1.3, materials);
    catwalk.position.set(0, 0.78, 0.2);
    this.group.add(catwalk);

    // 6. Dual Aluminum Fuel Tanks & Battery Box (tucked safely inside body envelope)
    const leftTank = VehicleModularComponents.createFuelTank(0.50, 1.45, 'left', materials);
    leftTank.position.set(-0.95, 0.60, -0.1);
    this.group.add(leftTank);

    const rightTank = VehicleModularComponents.createFuelTank(0.50, 1.45, 'right', materials);
    rightTank.position.set(0.95, 0.60, -0.1);
    this.group.add(rightTank);

    // Compressed air reservoir tanks under frame
    const airTankGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.75, 10);
    airTankGeo.rotateX(Math.PI / 2);
    const airTank1 = new THREE.Mesh(airTankGeo, steelMat);
    airTank1.position.set(-0.32, 0.48, -0.6);
    this.group.add(airTank1);

    const airTank2 = new THREE.Mesh(airTankGeo, steelMat);
    airTank2.position.set(0.32, 0.48, -0.6);
    this.group.add(airTank2);

    // 7. Dual Vertical Chrome Exhaust Stacks
    const stackLeft = VehicleModularComponents.createVerticalExhaustStack(materials);
    stackLeft.position.set(-0.86, 0.80, 0.75);
    this.group.add(stackLeft);

    const stackRight = VehicleModularComponents.createVerticalExhaustStack(materials);
    stackRight.position.set(0.86, 0.80, 0.75);
    this.group.add(stackRight);

    // 8. Aerodynamic Driver Cab
    this.buildAerodynamicCab();

    // 9. Side-view aerodynamic mirrors (strictly regulated projection)
    const mirrors = VehicleModularComponents.createSideMirrors(
      definition.dimensions.width,
      definition.dimensions.height,
      materials
    );
    mirrors.position.z = definition.frontAxleOffsetZ - 0.25;
    this.group.add(mirrors);

    // 10. Front and Rear Lighting Assemblies
    this.buildLightingFixtures();

    // Set initial paint material
    this.setPaintColor(this.currentPaintColor);
  }

  private getPaintMaterial(color: FleetColor): THREE.Material {
    switch (color) {
      case 'red':
        return this.materials.get('truck_cab_paint_red');
      case 'orange':
        return this.materials.get('truck_cab_paint_orange');
      case 'white':
        return this.materials.get('truck_cab_paint_white');
      case 'dark':
        return this.materials.get('truck_cab_paint_dark');
      case 'blue':
      default:
        return this.materials.get('truck_cab_paint_blue');
    }
  }

  public setPaintColor(color: FleetColor): void {
    this.currentPaintColor = color;
    const mat = this.getPaintMaterial(color);
    this.cabMeshes.forEach((mesh) => {
      mesh.material = mat;
    });
  }

  public getPaintColor(): FleetColor {
    return this.currentPaintColor;
  }

  private buildAerodynamicCab(): void {
    const cabGroup = new THREE.Group();
    cabGroup.name = 'cab_assembly';

    const w = this.definition.dimensions.width;
    const cabH = 2.45;
    const cabL = 2.3;
    const cabZ = this.definition.frontAxleOffsetZ - 0.2;
    const cabY = 0.85;

    const paintMat = this.getPaintMaterial(this.currentPaintColor);
    const darkMat = this.materials.get('truck_chassis_steel');
    const glassMat = this.materials.get('truck_glass_windshield');
    const chromeMat = this.materials.get('truck_wheel_chrome');
    const meshMat = this.materials.get('truck_grille_mesh');

    // Main Cab Body Lower Block
    const lowerCabGeo = new THREE.BoxGeometry(w * 0.96, cabH * 0.55, cabL);
    const lowerCab = new THREE.Mesh(lowerCabGeo, paintMat);
    lowerCab.position.set(0, cabH * 0.275, 0);
    lowerCab.castShadow = true;
    lowerCab.receiveShadow = true;
    this.cabMeshes.push(lowerCab);
    cabGroup.add(lowerCab);

    // Upper Cab Sleeper / High-Roof Cap
    const upperCabGeo = new THREE.BoxGeometry(w * 0.94, cabH * 0.45, cabL * 0.92);
    const upperCab = new THREE.Mesh(upperCabGeo, paintMat);
    upperCab.position.set(0, cabH * 0.775, -cabL * 0.04);
    upperCab.castShadow = true;
    this.cabMeshes.push(upperCab);
    cabGroup.add(upperCab);

    // Aerodynamic Roof Air Deflector Spoiler
    const spoilerGeo = new THREE.BoxGeometry(w * 0.92, 0.45, cabL * 0.75);
    const spoiler = new THREE.Mesh(spoilerGeo, paintMat);
    spoiler.position.set(0, cabH + 0.18, -cabL * 0.1);
    spoiler.rotation.x = -0.15; // Slanted up towards trailer
    spoiler.castShadow = true;
    this.cabMeshes.push(spoiler);
    cabGroup.add(spoiler);

    // Cab Side Air Extender Flaps (flanking the rear of the sleeper)
    [-w * 0.47, w * 0.47].forEach((fx) => {
      const flapGeo = new THREE.BoxGeometry(0.04, cabH * 0.85, 0.5);
      const flap = new THREE.Mesh(flapGeo, paintMat);
      flap.position.set(fx, cabH * 0.5, -cabL * 0.5 - 0.2);
      flap.castShadow = true;
      this.cabMeshes.push(flap);
      cabGroup.add(flap);
    });

    // Heavy Front Bumper with Lower Air Dam / Chin Spoiler (flush with cab body)
    const bumperGeo = new THREE.BoxGeometry(w * 0.98, 0.36, 0.35);
    const bumper = new THREE.Mesh(bumperGeo, darkMat);
    bumper.position.set(0, 0.18, cabL / 2 + 0.15);
    bumper.castShadow = true;
    cabGroup.add(bumper);

    // Front Center Tow Eye Hook
    const towEyeGeo = new THREE.TorusGeometry(0.05, 0.018, 6, 12);
    const towEye = new THREE.Mesh(towEyeGeo, chromeMat);
    towEye.position.set(0, 0.16, cabL / 2 + 0.33);
    cabGroup.add(towEye);

    // Radiator Grille surround and chrome horizontal slats
    const grilleGeo = new THREE.BoxGeometry(w * 0.62, cabH * 0.42, 0.08);
    const grille = new THREE.Mesh(grilleGeo, meshMat);
    grille.position.set(0, cabH * 0.32, cabL / 2 + 0.04);
    cabGroup.add(grille);

    // Chrome Grille Trim Frame
    const trimGeo = new THREE.BoxGeometry(w * 0.66, 0.05, 0.1);
    const trimTop = new THREE.Mesh(trimGeo, chromeMat);
    trimTop.position.set(0, cabH * 0.54, cabL / 2 + 0.04);
    cabGroup.add(trimTop);

    // Tinted Front Curved Windshield
    const windshieldGeo = new THREE.BoxGeometry(w * 0.88, cabH * 0.36, 0.06);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, cabH * 0.72, cabL / 2 - 0.02);
    windshield.rotation.x = -0.18; // Aerodynamic rake
    cabGroup.add(windshield);

    // Windshield Wiper Arms
    [-w * 0.24, w * 0.24].forEach((wx) => {
      const wiperGeo = new THREE.BoxGeometry(0.02, 0.35, 0.02);
      const wiper = new THREE.Mesh(wiperGeo, darkMat);
      wiper.position.set(wx, cabH * 0.64, cabL / 2 + 0.02);
      wiper.rotation.z = -0.25;
      cabGroup.add(wiper);
    });

    // Sun Visor above Windshield
    const visorGeo = new THREE.BoxGeometry(w * 0.94, 0.12, 0.24);
    const visor = new THREE.Mesh(visorGeo, darkMat);
    visor.position.set(0, cabH * 0.92, cabL / 2 + 0.04);
    visor.rotation.x = 0.2;
    cabGroup.add(visor);

    // Side Door Windows
    [-w * 0.48, w * 0.48].forEach((sx) => {
      const sideWinGeo = new THREE.BoxGeometry(0.06, cabH * 0.32, cabL * 0.42);
      const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
      sideWin.position.set(sx, cabH * 0.72, cabL * 0.18);
      cabGroup.add(sideWin);

      // Chrome Door Handle
      const handleGeo = new THREE.BoxGeometry(0.03, 0.025, 0.12);
      const handle = new THREE.Mesh(handleGeo, chromeMat);
      handle.position.set(sx * 0.98, cabH * 0.48, cabL * 0.05);
      cabGroup.add(handle);

      // Cab Entry Access Steps (recessed into side profile)
      [-0.1, -0.32].forEach((sy) => {
        const stepGeo = new THREE.BoxGeometry(0.08, 0.025, 0.32);
        const step = new THREE.Mesh(stepGeo, this.materials.get('truck_catwalk_diamond'));
        step.position.set(sx * 0.92, sy, cabL * 0.12);
        cabGroup.add(step);
      });
    });

    // Interior Silhouette visible through glass
    const dashGeo = new THREE.BoxGeometry(w * 0.8, 0.22, 0.45);
    const dash = new THREE.Mesh(dashGeo, darkMat);
    dash.position.set(0, cabH * 0.58, cabL * 0.32);
    cabGroup.add(dash);

    // Steering Wheel
    const wheelGeo = new THREE.TorusGeometry(0.14, 0.02, 6, 12);
    wheelGeo.rotateX(Math.PI / 4);
    const steerWheel = new THREE.Mesh(wheelGeo, darkMat);
    steerWheel.position.set(-w * 0.22, cabH * 0.72, cabL * 0.26);
    cabGroup.add(steerWheel);

    // Twin High-Back Air-Ride Bucket Seats
    [-w * 0.22, w * 0.22].forEach((sx) => {
      const seatGeo = new THREE.BoxGeometry(0.38, 0.65, 0.38);
      const seat = new THREE.Mesh(seatGeo, darkMat);
      seat.position.set(sx, cabH * 0.62, cabL * 0.02);
      cabGroup.add(seat);
    });

    cabGroup.position.set(0, cabY, cabZ);
    this.group.add(cabGroup);
  }

  private buildRearMudguards(): void {
    const steelMat = this.materials.get('truck_chassis_steel');
    const flapMat = this.materials.get('trailer_mudflap');

    // Curved quarter fenders over rear drive tires (flush with 2.4m vehicle body)
    this.definition.rearAxleOffsetsZ.forEach((az) => {
      [-1.0, 1.0].forEach((mx) => {
        const fenderGeo = new THREE.BoxGeometry(0.42, 0.04, 1.05);
        const fender = new THREE.Mesh(fenderGeo, steelMat);
        fender.position.set(mx, 0.96, az);
        fender.castShadow = true;
        this.group.add(fender);
      });
    });

    // Rear Black Rubber Mudflaps behind rearmost axle
    const rearZ = Math.min(...this.definition.rearAxleOffsetsZ) - 0.70;
    [-0.95, 0.95].forEach((fx) => {
      const flapGeo = new THREE.BoxGeometry(0.44, 0.55, 0.025);
      const flap = new THREE.Mesh(flapGeo, flapMat);
      flap.position.set(fx, 0.52, rearZ);
      flap.castShadow = true;
      this.group.add(flap);
    });
  }

  private buildLightingFixtures(): void {
    const headlightMat = this.materials.get('vehicle_headlight');
    const indicatorMat = this.materials.get('vehicle_indicator');
    const brakeMat = this.materials.get('vehicle_brake_light');
    const reverseMat = this.materials.get('vehicle_reverse_light');
    const markerAmberMat = this.materials.get('vehicle_marker_amber');
    const w = this.definition.dimensions.width;
    const frontZ = this.definition.frontAxleOffsetZ + 1.05;

    // 1. Dual Main Xenon Headlights
    [-0.85, 0.85].forEach((hx) => {
      const lampGeo = new THREE.BoxGeometry(0.22, 0.14, 0.05);
      const lamp = new THREE.Mesh(lampGeo, headlightMat);
      lamp.position.set(hx, 1.05, frontZ);
      this.headlightMeshes.push(lamp);
      this.group.add(lamp);

      // Chrome bezel trim
      const bezelGeo = new THREE.BoxGeometry(0.26, 0.18, 0.04);
      const bezel = new THREE.Mesh(bezelGeo, this.materials.get('truck_wheel_chrome'));
      bezel.position.set(hx, 1.05, frontZ - 0.02);
      this.group.add(bezel);
    });

    // 2. Front Amber Turn Indicators (flanking the headlights)
    const indGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const indL = new THREE.Mesh(indGeo, indicatorMat);
    indL.position.set(-1.05, 1.05, frontZ - 0.02);
    this.indicatorLeftMeshes.push(indL);
    this.group.add(indL);

    const indR = new THREE.Mesh(indGeo, indicatorMat);
    indR.position.set(1.05, 1.05, frontZ - 0.02);
    this.indicatorRightMeshes.push(indR);
    this.group.add(indR);

    // 3. Roof Cab Clearance Marker Lights (5 amber jewels)
    const markerGeo = new THREE.SphereGeometry(0.04, 6, 6);
    [-0.6, -0.3, 0, 0.3, 0.6].forEach((mx) => {
      const marker = new THREE.Mesh(markerGeo, markerAmberMat);
      marker.position.set(mx, 3.28, this.definition.frontAxleOffsetZ + 0.82);
      this.group.add(marker);
    });

    // 4. Rear Tail / Brake Light Bar (at rear frame end)
    const rearZ = Math.min(...this.definition.rearAxleOffsetsZ) - 0.82;
    [-0.78, 0.78].forEach((rx, idx) => {
      // Brake light
      const brkGeo = new THREE.BoxGeometry(0.18, 0.1, 0.04);
      const brk = new THREE.Mesh(brkGeo, brakeMat);
      brk.position.set(rx, 0.78, rearZ);
      this.brakeLightMeshes.push(brk);
      this.group.add(brk);

      // Reverse light
      const revGeo = new THREE.BoxGeometry(0.08, 0.1, 0.04);
      const rev = new THREE.Mesh(revGeo, reverseMat);
      rev.position.set(rx + (rx > 0 ? -0.15 : 0.15), 0.78, rearZ);
      this.reverseLightMeshes.push(rev);
      this.group.add(rev);

      // Rear turn indicator
      const rearInd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), indicatorMat);
      rearInd.position.set(rx + (rx > 0 ? 0.15 : -0.15), 0.78, rearZ);
      if (idx === 0) {
        this.indicatorLeftMeshes.push(rearInd);
      } else {
        this.indicatorRightMeshes.push(rearInd);
      }
      this.group.add(rearInd);
    });
  }

  // =========================================================================
  // Dynamic Simulation & Animation Controls
  // =========================================================================

  public setSteeringAngle(angleRad: number): void {
    const maxRad = (this.definition.steerAngleMaxDeg * Math.PI) / 180;
    const clamped = Math.max(-maxRad, Math.min(maxRad, angleRad));
    this.currentSteerAngle = clamped;
    this.steerLeft.rotation.y = Math.PI + clamped;
    this.steerRight.rotation.y = clamped;
  }

  public getSteeringAngle(): number {
    return this.currentSteerAngle;
  }

  public rollWheels(deltaDistanceMeters: number): void {
    const wheelRadius = 0.52;
    const deltaRad = deltaDistanceMeters / wheelRadius;
    this.currentWheelRot = (this.currentWheelRot + deltaRad) % (Math.PI * 2);

    this.wheels.forEach((w) => {
      w.rotation.x = this.currentWheelRot;
    });
  }

  public setHeadlights(on: boolean): void {
    this.lightingState.headlights = on;
    const mat = this.materials.get('vehicle_headlight') as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = on ? 1.4 : 0.0;
    }
  }

  public setHazardLights(on: boolean): void {
    this.lightingState.hazardLights = on;
    if (on) {
      this.lightingState.turnSignal = 'off';
    }
    this.updateIndicatorEmissives();
  }

  public setTurnSignal(signal: 'off' | 'left' | 'right'): void {
    this.lightingState.turnSignal = signal;
    if (signal !== 'off') {
      this.lightingState.hazardLights = false;
    }
    this.updateIndicatorEmissives();
  }

  public setBrakeLights(on: boolean): void {
    this.lightingState.brakeLights = on;
    const mat = this.materials.get('vehicle_brake_light') as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = on ? 1.6 : 0.2;
    }
  }

  public setReverseLights(on: boolean): void {
    this.lightingState.reverseLights = on;
    const mat = this.materials.get('vehicle_reverse_light') as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = on ? 1.2 : 0.0;
    }
  }

  public updateLightsFlash(pulseOn: boolean): void {
    const indMat = this.materials.get('vehicle_indicator') as THREE.MeshStandardMaterial;
    if (!indMat) return;

    if (this.lightingState.hazardLights) {
      indMat.emissiveIntensity = pulseOn ? 1.4 : 0.0;
    } else if (this.lightingState.turnSignal !== 'off') {
      indMat.emissiveIntensity = pulseOn ? 1.4 : 0.0;
    } else {
      indMat.emissiveIntensity = 0.0;
    }
  }

  private updateIndicatorEmissives(): void {
    const indMat = this.materials.get('vehicle_indicator') as THREE.MeshStandardMaterial;
    if (!indMat) return;

    const isActive = this.lightingState.hazardLights || this.lightingState.turnSignal !== 'off';
    indMat.emissiveIntensity = isActive ? 1.4 : 0.0;
  }

  public getFifthWheelWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.fifthWheelTransform.getWorldPosition(target);
  }
}
