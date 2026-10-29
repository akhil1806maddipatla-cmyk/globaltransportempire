import * as THREE from 'three';
import { MaterialsManager } from '../../rendering/MaterialsManager';

export interface WheelAssemblyResult {
  group: THREE.Group;
  radius: number;
  width: number;
}

export interface SteeringAxleResult {
  group: THREE.Group;
  steerLeft: THREE.Group;
  steerRight: THREE.Group;
  wheels: THREE.Group[];
}

export interface TandemAxleResult {
  group: THREE.Group;
  wheels: THREE.Group[];
}

export interface LandingLegsResult {
  group: THREE.Group;
  setDeployed: (deployed: boolean) => void;
}

/**
 * Reusable Modular 3D Vehicle Component Factory
 * Provides accurate, high-fidelity components for commercial freight trucks,
 * semi-trailers, and intermodal shipping containers.
 */
export class VehicleModularComponents {
  /**
   * Builds a detailed commercial truck wheel:
   * 22.5" tire with rain tread, machined chrome rim, recessed hub, and 10 lug nuts.
   * If isDual is true, builds a tandem dual-wheel assembly with inner spacer.
   */
  public static createHeavyTruckWheel(
    radius: number = 0.52,
    width: number = 0.28,
    isDual: boolean = false,
    materials: MaterialsManager
  ): WheelAssemblyResult {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = isDual ? 'dual_wheel_assembly' : 'single_wheel_assembly';

    const tireMat = materials.get('truck_tire_rubber');
    const rimMat = materials.get('truck_wheel_chrome');
    const hubMat = materials.get('truck_wheel_hub');

    const tireTreadRadius = radius;
    const tireInnerRadius = radius * 0.58;
    const tireW = isDual ? width * 0.44 : width;
    const spacing = isDual ? width * 0.54 : 0;

    const buildTireAndRim = (xOffset: number, isOuter: boolean) => {
      const sub = new THREE.Group();
      sub.position.x = xOffset;

      // 1. Main Rubber Tire (horizontal cylinder along X)
      const tireGeo = new THREE.CylinderGeometry(tireTreadRadius, tireTreadRadius, tireW, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      sub.add(tireMesh);

      // 2. Chrome / Polished Aluminum Rim Barrel
      const rimGeo = new THREE.CylinderGeometry(tireInnerRadius, tireInnerRadius, tireW * 1.02, 18, 1, true);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      sub.add(rimMesh);

      // 3. Wheel Face Plate with dish depth
      const faceGeo = new THREE.CylinderGeometry(tireInnerRadius * 0.98, tireInnerRadius * 0.7, 0.04, 16);
      faceGeo.rotateZ(Math.PI / 2);
      const faceMesh = new THREE.Mesh(faceGeo, rimMat);
      const faceX = isOuter ? tireW / 2 - 0.02 : -tireW / 2 + 0.02;
      faceMesh.position.x = faceX;
      faceMesh.castShadow = true;
      sub.add(faceMesh);

      // 4. Heavy Center Hub
      const hubRadius = tireInnerRadius * 0.38;
      const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, 0.08, 12);
      hubGeo.rotateZ(Math.PI / 2);
      const hubMesh = new THREE.Mesh(hubGeo, hubMat);
      hubMesh.position.x = faceX + (isOuter ? 0.03 : -0.03);
      sub.add(hubMesh);

      // 5. Circle of 10 Stamped Lug Nuts (on outer visible wheel face)
      if (isOuter) {
        const lugCircleRadius = hubRadius * 1.35;
        const lugGeo = new THREE.BoxGeometry(0.025, 0.025, 0.025);
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI * 2) / 10;
          const lug = new THREE.Mesh(lugGeo, rimMat);
          lug.position.set(faceX + 0.03, Math.sin(angle) * lugCircleRadius, Math.cos(angle) * lugCircleRadius);
          sub.add(lug);
        }
      }

      return sub;
    };

    if (isDual) {
      wheelGroup.add(buildTireAndRim(spacing / 2, true));
      wheelGroup.add(buildTireAndRim(-spacing / 2, false));
    } else {
      wheelGroup.add(buildTireAndRim(0, true));
    }

    return {
      group: wheelGroup,
      radius,
      width: isDual ? width : width * 0.85,
    };
  }

  /**
   * Front Steer Axle with independent steering knuckle pivots on left and right sides.
   */
  public static createFrontSteeringAxle(
    trackWidth: number = 1.82,
    wheelRadius: number = 0.48,
    materials: MaterialsManager
  ): SteeringAxleResult {
    const group = new THREE.Group();
    group.name = 'front_steer_axle';

    const steelMat = materials.get('truck_chassis_steel');

    // Heavy dropped I-beam forged steel axle beam
    const beamGeo = new THREE.BoxGeometry(trackWidth * 0.85, 0.11, 0.11);
    const axleBeam = new THREE.Mesh(beamGeo, steelMat);
    axleBeam.position.y = wheelRadius;
    axleBeam.castShadow = true;
    group.add(axleBeam);

    // Front Leaf Springs
    const springGeo = new THREE.BoxGeometry(0.11, 0.07, 1.0);
    [-trackWidth * 0.32, trackWidth * 0.32].forEach((sx) => {
      const spring = new THREE.Mesh(springGeo, steelMat);
      spring.position.set(sx, wheelRadius + 0.09, 0);
      spring.castShadow = true;
      group.add(spring);
    });

    // Left Steering Pivot Knuckle
    const steerLeft = new THREE.Group();
    steerLeft.name = 'steer_pivot_left';
    steerLeft.position.set(-trackWidth / 2, wheelRadius, 0);

    const wheelLeft = this.createHeavyTruckWheel(wheelRadius, 0.26, false, materials);
    wheelLeft.group.rotation.y = Math.PI; // Face outwards to left
    steerLeft.add(wheelLeft.group);
    group.add(steerLeft);

    // Right Steering Pivot Knuckle
    const steerRight = new THREE.Group();
    steerRight.name = 'steer_pivot_right';
    steerRight.position.set(trackWidth / 2, wheelRadius, 0);

    const wheelRight = this.createHeavyTruckWheel(wheelRadius, 0.26, false, materials);
    wheelRight.group.rotation.y = 0; // Face outwards to right
    steerRight.add(wheelRight.group);
    group.add(steerRight);

    // Steering Tie Rod bar connecting the two knuckles
    const tieRodGeo = new THREE.CylinderGeometry(0.022, 0.022, trackWidth * 0.82, 8);
    tieRodGeo.rotateZ(Math.PI / 2);
    const tieRod = new THREE.Mesh(tieRodGeo, steelMat);
    tieRod.position.set(0, wheelRadius - 0.05, -0.14);
    group.add(tieRod);

    return {
      group,
      steerLeft,
      steerRight,
      wheels: [wheelLeft.group, wheelRight.group],
    };
  }

  /**
   * Tandem Drive Axle assembly (6x4) with differential pumpkin housings,
   * walking-beam suspension, and dual tires on both sides.
   */
  public static createTandemDriveAxles(
    axleSpacing: number = 1.30,
    trackWidth: number = 1.76,
    wheelRadius: number = 0.48,
    materials: MaterialsManager
  ): TandemAxleResult {
    const group = new THREE.Group();
    group.name = 'tandem_drive_axles';

    const steelMat = materials.get('truck_chassis_steel');
    const allWheels: THREE.Group[] = [];

    [-axleSpacing / 2, axleSpacing / 2].forEach((az, idx) => {
      const axleSub = new THREE.Group();
      axleSub.name = `drive_axle_${idx + 1}`;
      axleSub.position.set(0, wheelRadius, az);

      // Heavy axle tube
      const tubeGeo = new THREE.CylinderGeometry(0.065, 0.065, trackWidth * 0.76, 12);
      tubeGeo.rotateZ(Math.PI / 2);
      const tubeMesh = new THREE.Mesh(tubeGeo, steelMat);
      tubeMesh.castShadow = true;
      axleSub.add(tubeMesh);

      // Central Differential Pumpkin Gearbox Housing
      const diffGeo = new THREE.SphereGeometry(0.16, 10, 10);
      diffGeo.scale(1, 1.2, 1.3);
      const diffMesh = new THREE.Mesh(diffGeo, steelMat);
      diffMesh.castShadow = true;
      axleSub.add(diffMesh);

      // Dual wheels on Left (outer tire edge at approx -1.18m)
      const leftDual = this.createHeavyTruckWheel(wheelRadius, 0.40, true, materials);
      leftDual.group.position.set(-trackWidth / 2, 0, 0);
      leftDual.group.rotation.y = Math.PI;
      axleSub.add(leftDual.group);
      allWheels.push(leftDual.group);

      // Dual wheels on Right (outer tire edge at approx +1.18m)
      const rightDual = this.createHeavyTruckWheel(wheelRadius, 0.40, true, materials);
      rightDual.group.position.set(trackWidth / 2, 0, 0);
      rightDual.group.rotation.y = 0;
      axleSub.add(rightDual.group);
      allWheels.push(rightDual.group);

      group.add(axleSub);
    });

    // Longitudinal Inter-Axle Drive Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, axleSpacing * 0.9, 8);
    shaftGeo.rotateX(Math.PI / 2);
    const driveShaft = new THREE.Mesh(shaftGeo, steelMat);
    driveShaft.position.set(0, wheelRadius, 0);
    group.add(driveShaft);

    // Walking-beam equalizer / Air suspension canisters
    [-trackWidth * 0.32, trackWidth * 0.32].forEach((sx) => {
      const suspBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, axleSpacing * 1.1), steelMat);
      suspBar.position.set(sx, wheelRadius + 0.12, 0);
      group.add(suspBar);

      // Air spring bellows
      [-axleSpacing / 2, axleSpacing / 2].forEach((az) => {
        const airBag = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8), materials.get('trailer_mudflap'));
        airBag.position.set(sx, wheelRadius + 0.22, az);
        group.add(airBag);
      });
    });

    return {
      group,
      wheels: allWheels,
    };
  }

  /**
   * Cast Steel Fifth Wheel Assembly for trailer kingpin coupling.
   */
  public static createFifthWheelCoupling(materials: MaterialsManager): THREE.Group {
    const group = new THREE.Group();
    group.name = 'fifth_wheel_assembly';

    const steelMat = materials.get('truck_chassis_steel');
    const plateMat = materials.get('fifth_wheel_greased');

    // Base Mounting Pedestals
    const pedGeo = new THREE.BoxGeometry(0.14, 0.22, 0.55);
    const pedLeft = new THREE.Mesh(pedGeo, steelMat);
    pedLeft.position.set(-0.35, 0.11, 0);
    pedLeft.castShadow = true;
    group.add(pedLeft);

    const pedRight = new THREE.Mesh(pedGeo, steelMat);
    pedRight.position.set(0.35, 0.11, 0);
    pedRight.castShadow = true;
    group.add(pedRight);

    // Main Horseshoe Cast Plate (slanted rear entry throat)
    const plateGeo = new THREE.BoxGeometry(0.82, 0.08, 0.78);
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, 0.24, 0);
    plateMesh.rotation.x = 0.05; // slight rear tilt for smooth trailer coupling
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    group.add(plateMesh);

    // V-shaped throat guide cut-out at rear
    const vGuide = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.35), steelMat);
    vGuide.position.set(0, 0.24, -0.25);
    group.add(vGuide);

    // Manual Release Handle lever on driver's side
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6);
    handleGeo.rotateZ(Math.PI / 2);
    const handle = new THREE.Mesh(handleGeo, steelMat);
    handle.position.set(-0.58, 0.22, 0);
    group.add(handle);

    return group;
  }

  /**
   * Aluminum Diamond-Plate Platform Catwalk behind truck cab.
   */
  public static createDiamondCatwalk(
    width: number = 0.95,
    length: number = 1.35,
    materials: MaterialsManager
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'catwalk_deck';

    const deckMat = materials.get('truck_catwalk_diamond');
    const frameMat = materials.get('truck_chassis_steel');

    // Deck slab
    const deckGeo = new THREE.BoxGeometry(width, 0.04, length);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.02;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Perimeter support angle brackets
    const frameGeo = new THREE.BoxGeometry(width + 0.04, 0.06, length + 0.04);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.02;
    group.add(frame);

    // Side step ladder
    const rungGeo = new THREE.BoxGeometry(0.06, 0.03, 0.28);
    const rung1 = new THREE.Mesh(rungGeo, frameMat);
    rung1.position.set(-width / 2 - 0.04, -0.15, 0);
    group.add(rung1);

    return group;
  }

  /**
   * Polished Aluminum Cylindrical Fuel Tank with mounting straps and steps.
   */
  public static createFuelTank(
    diameter: number = 0.50,
    length: number = 1.45,
    side: 'left' | 'right',
    materials: MaterialsManager
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `fuel_tank_${side}`;

    const tankMat = materials.get('truck_wheel_chrome');
    const strapMat = materials.get('truck_chassis_steel');

    // Main Tank Cylinder
    const tankGeo = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 16);
    tankGeo.rotateX(Math.PI / 2);
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.castShadow = true;
    group.add(tank);

    // Dual Black Mounting Straps
    const strapRadius = diameter / 2 + 0.012;
    const strapGeo = new THREE.CylinderGeometry(strapRadius, strapRadius, 0.05, 16);
    strapGeo.rotateX(Math.PI / 2);

    [-length * 0.32, length * 0.32].forEach((sz) => {
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.position.z = sz;
      group.add(strap);
    });

    // Fuel Filler Cap
    const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
    const cap = new THREE.Mesh(capGeo, tankMat);
    const capX = side === 'left' ? -diameter / 2 * 0.75 : diameter / 2 * 0.75;
    cap.position.set(capX, diameter / 2 * 0.8, -length * 0.3);
    group.add(cap);

    // Integrated Serrated Aluminum Step
    const stepGeo = new THREE.BoxGeometry(0.12, 0.025, length * 0.82);
    const step = new THREE.Mesh(stepGeo, materials.get('truck_catwalk_diamond'));
    const stepX = side === 'left' ? -diameter / 2 - 0.05 : diameter / 2 + 0.05;
    step.position.set(stepX, 0.04, 0);
    group.add(step);

    return group;
  }

  /**
   * Vertical Dual Chrome Exhaust Stacks with perforated heat shields.
   */
  public static createVerticalExhaustStack(materials: MaterialsManager): THREE.Group {
    const group = new THREE.Group();
    group.name = 'exhaust_stack';

    const chromeMat = materials.get('truck_wheel_chrome');
    const heatShieldMat = materials.get('metal_roof_silver');

    const stackHeight = 2.3;
    const pipeRadius = 0.06;

    // Main vertical pipe
    const pipeGeo = new THREE.CylinderGeometry(pipeRadius, pipeRadius, stackHeight, 12);
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.y = stackHeight / 2;
    pipe.castShadow = true;
    group.add(pipe);

    // Perforated heat shield sleeve
    const shieldRadius = pipeRadius + 0.025;
    const shieldHeight = stackHeight * 0.65;
    const shieldGeo = new THREE.CylinderGeometry(shieldRadius, shieldRadius, shieldHeight, 12);
    const shield = new THREE.Mesh(shieldGeo, heatShieldMat);
    shield.position.y = shieldHeight / 2 + 0.2;
    group.add(shield);

    // Top curved turnout elbow
    const elbowGeo = new THREE.TorusGeometry(0.10, pipeRadius, 8, 12, Math.PI / 3);
    elbowGeo.rotateY(Math.PI / 2);
    const elbow = new THREE.Mesh(elbowGeo, chromeMat);
    elbow.position.set(0, stackHeight, 0.07);
    group.add(elbow);

    return group;
  }

  /**
   * Aerodynamic Dual Side-View Mirror assemblies with flat mirror and convex spotter.
   * Engineered with strictly regulated projection (max 0.12m per side) to prevent lane overhang.
   */
  public static createSideMirrors(
    cabWidth: number,
    cabHeight: number,
    materials: MaterialsManager
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'side_mirrors';

    const casingMat = materials.get('truck_chassis_steel');
    const glassMat = materials.get('truck_glass_windshield');

    const mirrorH = 0.48;
    const mirrorW = 0.12;
    const mirrorD = 0.06;

    [-cabWidth / 2 - 0.05, cabWidth / 2 + 0.05].forEach((mx, idx) => {
      const sideGroup = new THREE.Group();
      sideGroup.position.set(mx, cabHeight * 0.58, 0.85);

      // Compact aerodynamic mounting arm
      const armGeo = new THREE.BoxGeometry(0.08, 0.025, 0.025);
      const arm = new THREE.Mesh(armGeo, casingMat);
      sideGroup.add(arm);

      // Aerodynamic mirror housing
      const houseGeo = new THREE.BoxGeometry(mirrorD, mirrorH, mirrorW);
      const housing = new THREE.Mesh(houseGeo, casingMat);
      housing.castShadow = true;
      sideGroup.add(housing);

      // Glass mirror surface
      const refGeo = new THREE.PlaneGeometry(mirrorH * 0.82, mirrorW * 0.82);
      refGeo.rotateY(idx === 0 ? Math.PI / 2 : -Math.PI / 2);
      const refMesh = new THREE.Mesh(refGeo, glassMat);
      refMesh.position.z = -mirrorD / 2 - 0.008;
      sideGroup.add(refMesh);

      group.add(sideGroup);
    });

    return group;
  }

  /**
   * Modular Telescopic Trailer Landing Legs with ground foot pads and hand crank.
   */
  public static createTrailerLandingLegs(materials: MaterialsManager): LandingLegsResult {
    const group = new THREE.Group();
    group.name = 'trailer_landing_legs';

    const steelMat = materials.get('trailer_chassis_dark');
    const strokeLegs: THREE.Mesh[] = [];

    const outerLegH = 0.75;
    const strokeLegH = 0.55;
    const legSpacing = 1.65;

    // Upper outer square tubes
    [-legSpacing / 2, legSpacing / 2].forEach((lx) => {
      const upperGeo = new THREE.BoxGeometry(0.14, outerLegH, 0.14);
      const upper = new THREE.Mesh(upperGeo, steelMat);
      upper.position.set(lx, outerLegH / 2, 0);
      upper.castShadow = true;
      group.add(upper);

      // Lower inner telescopic stroke leg with sand shoe / foot pad
      const lowerGeo = new THREE.BoxGeometry(0.11, strokeLegH, 0.11);
      const lower = new THREE.Mesh(lowerGeo, steelMat);
      lower.position.set(lx, -strokeLegH / 2 + 0.15, 0);
      lower.castShadow = true;

      // Heavy steel sand shoe base plate
      const shoeGeo = new THREE.BoxGeometry(0.26, 0.05, 0.26);
      const shoe = new THREE.Mesh(shoeGeo, steelMat);
      shoe.position.y = -strokeLegH / 2;
      shoe.castShadow = true;
      lower.add(shoe);

      strokeLegs.push(lower);
      group.add(lower);
    });

    // Cross-brace torsion pipe
    const braceGeo = new THREE.CylinderGeometry(0.03, 0.03, legSpacing, 8);
    braceGeo.rotateZ(Math.PI / 2);
    const brace = new THREE.Mesh(braceGeo, steelMat);
    brace.position.y = outerLegH * 0.45;
    group.add(brace);

    // Side Hand Crank handle
    const crankGeo = new THREE.BoxGeometry(0.3, 0.03, 0.03);
    const crank = new THREE.Mesh(crankGeo, steelMat);
    crank.position.set(-legSpacing / 2 - 0.18, outerLegH * 0.7, 0);
    group.add(crank);

    const setDeployed = (deployed: boolean) => {
      // Deployed = legs lowered to ground (y: -0.15); Retracted = legs raised high (y: +0.25)
      const targetY = deployed ? -0.15 : 0.25;
      strokeLegs.forEach((leg) => {
        leg.position.y = targetY;
      });
    };

    return {
      group,
      setDeployed,
    };
  }

  /**
   * ISO 1161 Standard Corner Castings (8 pieces) with twistlock apertures.
   */
  public static createContainerCornerCastings(
    width: number,
    length: number,
    height: number,
    materials: MaterialsManager
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'iso_corner_castings';

    const castMat = materials.get('container_corner_casting');
    const castSize = 0.22;

    const halfW = width / 2 - castSize / 2;
    const halfL = length / 2 - castSize / 2;
    const halfH = height / 2 - castSize / 2;

    const positions = [
      // Top 4 corners
      [-halfW, halfH, -halfL],
      [halfW, halfH, -halfL],
      [-halfW, halfH, halfL],
      [halfW, halfH, halfL],
      // Bottom 4 corners
      [-halfW, -halfH, -halfL],
      [halfW, -halfH, -halfL],
      [-halfW, -halfH, halfL],
      [halfW, -halfH, halfL],
    ];

    positions.forEach(([x, y, z]) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(castSize, castSize, castSize), castMat);
      block.position.set(x, y, z);
      block.castShadow = true;
      group.add(block);
    });

    return group;
  }

  /**
   * Double Swing Rear Doors with vertical locking bars, cams, keeper latches, and hinges.
   */
  public static createContainerDoorHardware(
    doorWidth: number,
    doorHeight: number,
    materials: MaterialsManager
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'container_rear_door_hardware';

    const barMat = materials.get('container_door_hardware');
    const sealMat = materials.get('rubber_dock_seal');

    // Rubber perimeter gasket seal
    const gasketGeo = new THREE.BoxGeometry(doorWidth * 0.98, doorHeight * 0.98, 0.03);
    const gasket = new THREE.Mesh(gasketGeo, sealMat);
    group.add(gasket);

    // 4 Heavy-Duty Vertical Locking Rods (2 per door leaf)
    const rodRadius = 0.025;
    const rodH = doorHeight * 0.95;
    const rodGeo = new THREE.CylinderGeometry(rodRadius, rodRadius, rodH, 8);

    const xOffsets = [-doorWidth * 0.32, -doorWidth * 0.12, doorWidth * 0.12, doorWidth * 0.32];
    xOffsets.forEach((rx) => {
      const rod = new THREE.Mesh(rodGeo, barMat);
      rod.position.set(rx, 0, 0.04);
      rod.castShadow = true;
      group.add(rod);

      // Top & Bottom Cam Keepers
      [-rodH / 2, rodH / 2].forEach((cy) => {
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), barMat);
        cam.position.set(rx, cy, 0.04);
        group.add(cam);
      });

      // Door locking lever handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.04), barMat);
      handle.position.set(rx + (rx < 0 ? -0.06 : 0.06), -doorHeight * 0.15, 0.06);
      group.add(handle);
    });

    // 8 Stamped Steel Heavy Leaf Hinges (4 on far left, 4 on far right)
    const hingeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const hingeY = [-doorHeight * 0.38, -doorHeight * 0.12, doorHeight * 0.12, doorHeight * 0.38];

    [-doorWidth / 2 + 0.04, doorWidth / 2 - 0.04].forEach((hx) => {
      hingeY.forEach((hy) => {
        const hinge = new THREE.Mesh(hingeGeo, barMat);
        hinge.position.set(hx, hy, 0.03);
        hinge.castShadow = true;
        group.add(hinge);
      });
    });

    return group;
  }
}
