import * as THREE from 'three';
import { MaterialsManager } from '../rendering/MaterialsManager';

/**
 * Reusable Architectural Modular Component Factory for Industrial 3D Facilities
 * Provides consistent, realistic industrial features: recessed docks, parapets,
 * HVAC chillers, solar arrays, ribbon windows, structural columns, silos, and canopies.
 */
export class BuildingModularComponents {
  /**
   * Builds a perimeter roof parapet wall with metal coping trim capping the top.
   */
  public static createRoofParapet(
    width: number,
    depth: number,
    parapetHeight: number,
    wallThickness: number,
    wallMat: THREE.Material,
    copingMat: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'roof_parapet';

    // North & South parapet walls
    const nsGeo = new THREE.BoxGeometry(width, parapetHeight, wallThickness);
    // East & West parapet walls
    const ewGeo = new THREE.BoxGeometry(wallThickness, parapetHeight, depth - wallThickness * 2);

    const halfW = width / 2;
    const halfD = depth / 2;
    const halfH = parapetHeight / 2;

    const northWall = new THREE.Mesh(nsGeo, wallMat);
    northWall.position.set(0, halfH, -halfD + wallThickness / 2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    group.add(northWall);

    const southWall = new THREE.Mesh(nsGeo, wallMat);
    southWall.position.set(0, halfH, halfD - wallThickness / 2);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    group.add(southWall);

    const eastWall = new THREE.Mesh(ewGeo, wallMat);
    eastWall.position.set(halfW - wallThickness / 2, halfH, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    group.add(eastWall);

    const westWall = new THREE.Mesh(ewGeo, wallMat);
    westWall.position.set(-halfW + wallThickness / 2, halfH, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    group.add(westWall);

    // Aluminum coping cap trim running along top of parapet
    const capThickness = 0.06;
    const capWidth = wallThickness + 0.08;
    const nsCapGeo = new THREE.BoxGeometry(width + 0.08, capThickness, capWidth);
    const ewCapGeo = new THREE.BoxGeometry(capWidth, capThickness, depth + 0.08);

    const capN = new THREE.Mesh(nsCapGeo, copingMat);
    capN.position.set(0, parapetHeight + capThickness / 2, -halfD + wallThickness / 2);
    group.add(capN);

    const capS = new THREE.Mesh(nsCapGeo, copingMat);
    capS.position.set(0, parapetHeight + capThickness / 2, halfD - wallThickness / 2);
    group.add(capS);

    const capE = new THREE.Mesh(ewCapGeo, copingMat);
    capE.position.set(halfW - wallThickness / 2, parapetHeight + capThickness / 2, 0);
    group.add(capE);

    const capW = new THREE.Mesh(ewCapGeo, copingMat);
    capW.position.set(-halfW + wallThickness / 2, parapetHeight + capThickness / 2, 0);
    group.add(capW);

    return group;
  }

  /**
   * Builds an industrial truck loading dock assembly:
   * Recessed pit, rubber compression weather-seal shelter, segmented roll-up door,
   * dock bumper pads, and OSHA safety bollards.
   */
  public static createLoadingDock(
    materials: MaterialsManager,
    options: {
      doorWidth?: number;
      doorHeight?: number;
      hasShelter?: boolean;
      hasLeveler?: boolean;
      hasBollards?: boolean;
    } = {}
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'loading_dock_assembly';

    const doorW = options.doorWidth ?? 3.2;
    const doorH = options.doorHeight ?? 4.2;
    const hasShelter = options.hasShelter ?? true;
    const hasBollards = options.hasBollards ?? true;

    // 1. Recessed Door Frame opening
    const sealMat = materials.get('rubber_dock_seal');
    const doorMat = materials.get('door_rollup_shutter');
    const bumperMat = materials.get('dock_bumper_black');
    const safetyMat = materials.get('safety_yellow');

    // 2. Weather-tight rubber compression dock shelter canopy & side pads
    if (hasShelter) {
      const shelterDepth = 0.65;
      const padW = 0.35;
      const sidePadGeo = new THREE.BoxGeometry(padW, doorH + 0.2, shelterDepth);

      const leftPad = new THREE.Mesh(sidePadGeo, sealMat);
      leftPad.position.set(-doorW / 2 - padW / 2, doorH / 2, shelterDepth / 2);
      leftPad.castShadow = true;
      group.add(leftPad);

      const rightPad = new THREE.Mesh(sidePadGeo, sealMat);
      rightPad.position.set(doorW / 2 + padW / 2, doorH / 2, shelterDepth / 2);
      rightPad.castShadow = true;
      group.add(rightPad);

      // Top header curtain
      const headCurtainGeo = new THREE.BoxGeometry(doorW + padW * 2 + 0.2, 0.5, shelterDepth);
      const headCurtain = new THREE.Mesh(headCurtainGeo, sealMat);
      headCurtain.position.set(0, doorH + 0.25, shelterDepth / 2);
      headCurtain.castShadow = true;
      group.add(headCurtain);
    }

    // 3. Segmented Roll-up overhead door panel
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.12);
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, doorH / 2, 0.06);
    doorMesh.castShadow = true;
    group.add(doorMesh);

    // 4. Steel dock leveler ramp plate
    const levelerGeo = new THREE.BoxGeometry(doorW * 0.75, 0.12, 1.2);
    const levelerMesh = new THREE.Mesh(levelerGeo, materials.get('metal_structural'));
    levelerMesh.position.set(0, 0.06, 0.6);
    levelerMesh.receiveShadow = true;
    group.add(levelerMesh);

    // 5. Heavy-duty rubber dock bumpers (standard 1.2m dock height, stops reversing semi-trailers)
    const bumperGeo = new THREE.BoxGeometry(0.22, 0.6, 0.25);
    const bLeft = new THREE.Mesh(bumperGeo, bumperMat);
    bLeft.position.set(-doorW * 0.42, 0.6, 0.62);
    group.add(bLeft);

    const bRight = new THREE.Mesh(bumperGeo, bumperMat);
    bRight.position.set(doorW * 0.42, 0.6, 0.62);
    group.add(bRight);

    // 6. Flanking yellow safety bollards (3.9m clearance between posts, permits 2.5m vehicle passage)
    if (hasBollards) {
      const bollardH = 1.0;
      const bollardGeo = new THREE.CylinderGeometry(0.12, 0.12, bollardH, 8);
      const bRingGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 8);
      const ringMat = materials.get('bollard_black_ring');

      [-doorW / 2 - 0.35, doorW / 2 + 0.35].forEach((bx) => {
        const bollard = new THREE.Mesh(bollardGeo, safetyMat);
        bollard.position.set(bx, bollardH / 2, 0.85);
        bollard.castShadow = true;

        const ring = new THREE.Mesh(bRingGeo, ringMat);
        ring.position.y = bollardH - 0.2;
        bollard.add(ring);

        group.add(bollard);
      });
    }

    return group;
  }

  /**
   * Detailed rooftop industrial HVAC chiller unit:
   * Galvanized sheet metal casing, intake louvers, top compressor exhaust fans,
   * vibration isolator rails, and refrigerant conduits.
   */
  public static createRooftopHVAC(
    materials: MaterialsManager,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'rooftop_hvac_unit';

    const hvacMat = materials.get('roof_hvac_galvanized');
    const structuralMat = materials.get('metal_structural');
    const coolantMat = materials.get('pipe_coolant_blue');

    const dim =
      size === 'small'
        ? { w: 0.9, h: 0.65, d: 0.7, fans: 1 }
        : size === 'medium'
        ? { w: 1.4, h: 0.85, d: 0.95, fans: 2 }
        : { w: 2.2, h: 1.1, d: 1.3, fans: 3 };

    // Steel mounting channel rails (vibration damping)
    const railGeo = new THREE.BoxGeometry(dim.w * 0.95, 0.08, 0.08);
    const railFront = new THREE.Mesh(railGeo, structuralMat);
    railFront.position.set(0, 0.04, dim.d * 0.38);
    group.add(railFront);

    const railBack = new THREE.Mesh(railGeo, structuralMat);
    railBack.position.set(0, 0.04, -dim.d * 0.38);
    group.add(railBack);

    // Main compressor cabinet
    const bodyGeo = new THREE.BoxGeometry(dim.w, dim.h, dim.d);
    const body = new THREE.Mesh(bodyGeo, hvacMat);
    body.position.set(0, dim.h / 2 + 0.08, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Top exhaust fan cowls
    const fanRadius = Math.min(dim.d * 0.32, 0.35);
    const cowlGeo = new THREE.CylinderGeometry(fanRadius, fanRadius * 0.95, 0.12, 12);
    const grilleGeo = new THREE.CircleGeometry(fanRadius * 0.9, 10);
    grilleGeo.rotateX(-Math.PI / 2);

    const fanSpacing = dim.w / (dim.fans + 1);
    for (let f = 1; f <= dim.fans; f++) {
      const fx = -dim.w / 2 + fanSpacing * f;
      const cowl = new THREE.Mesh(cowlGeo, structuralMat);
      cowl.position.set(fx, dim.h + 0.14, 0);
      cowl.castShadow = true;
      group.add(cowl);

      const grille = new THREE.Mesh(grilleGeo, materials.get('dock_bumper_black'));
      grille.position.set(fx, dim.h + 0.205, 0);
      group.add(grille);
    }

    // Side refrigerant / power conduit connection
    const pipeGeo = new THREE.CylinderGeometry(0.04, 0.04, dim.h * 0.8, 6);
    const pipe = new THREE.Mesh(pipeGeo, coolantMat);
    pipe.position.set(dim.w / 2 + 0.06, dim.h * 0.5, dim.d * 0.2);
    group.add(pipe);

    return group;
  }

  /**
   * Photovoltaic Solar Array Rack:
   * Tilted solar panels mounted on galvanized steel racking legs.
   */
  public static createSolarArrayRack(
    materials: MaterialsManager,
    width: number,
    depth: number,
    tiltDegrees: number = 18
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'solar_array_rack';

    const solarMat = materials.get('metal_solar_panel');
    const rackMat = materials.get('metal_structural');

    // Panel slab
    const panelGeo = new THREE.BoxGeometry(width, 0.05, depth);
    const panelMesh = new THREE.Mesh(panelGeo, solarMat);

    const tiltRad = (tiltDegrees * Math.PI) / 180;
    panelMesh.rotation.x = -tiltRad;
    panelMesh.position.set(0, 0.35 + (depth / 2) * Math.sin(tiltRad), 0);
    panelMesh.castShadow = true;
    panelMesh.receiveShadow = true;
    group.add(panelMesh);

    // Structural support struts
    const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
    const legRearL = new THREE.Mesh(legGeo, rackMat);
    legRearL.position.set(-width * 0.4, 0.225, -depth * 0.35);
    group.add(legRearL);

    const legRearR = new THREE.Mesh(legGeo, rackMat);
    legRearR.position.set(width * 0.4, 0.225, -depth * 0.35);
    group.add(legRearR);

    return group;
  }

  /**
   * Industrial Raw Material Silo:
   * Corrugated aluminum cylindrical tank, conical roof, spiral safety inspection ladder,
   * discharge hopper legs, and pneumatic fill manifold.
   */
  public static createIndustrialSilo(
    materials: MaterialsManager,
    radius: number = 0.85,
    height: number = 3.6
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'industrial_silo';

    const siloMat = materials.get('silo_aluminum');
    const steelMat = materials.get('metal_structural');
    const pipeMat = materials.get('pipe_process_yellow');

    const legH = 0.8;
    const bodyH = height - legH - 0.7;

    // 1. Support Legs & Conical Discharge Hopper
    const legGeo = new THREE.BoxGeometry(0.1, legH, 0.1);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const leg = new THREE.Mesh(legGeo, steelMat);
      leg.position.set(Math.cos(angle) * (radius * 0.85), legH / 2, Math.sin(angle) * (radius * 0.85));
      leg.castShadow = true;
      group.add(leg);
    }

    const hopperGeo = new THREE.ConeGeometry(radius, 0.6, 16);
    hopperGeo.rotateX(Math.PI);
    const hopper = new THREE.Mesh(hopperGeo, siloMat);
    hopper.position.y = legH + 0.3;
    group.add(hopper);

    // 2. Main Cylindrical Storage Vessel
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, bodyH, 16);
    const body = new THREE.Mesh(cylinderGeo, siloMat);
    body.position.y = legH + 0.6 + bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 3. Conical Weather Cap Roof
    const roofGeo = new THREE.ConeGeometry(radius * 1.05, 0.55, 16);
    const coneRoof = new THREE.Mesh(roofGeo, steelMat);
    coneRoof.position.y = legH + 0.6 + bodyH + 0.275;
    coneRoof.castShadow = true;
    group.add(coneRoof);

    // 4. Vertical Pneumatic Fill Pipe
    const fillPipeGeo = new THREE.CylinderGeometry(0.05, 0.05, height, 8);
    const fillPipe = new THREE.Mesh(fillPipeGeo, pipeMat);
    fillPipe.position.set(radius + 0.08, height / 2, 0);
    fillPipe.castShadow = true;
    group.add(fillPipe);

    // 5. Roof Vent & Inspection Hatch
    const hatchGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 8);
    const hatch = new THREE.Mesh(hatchGeo, steelMat);
    hatch.position.set(0, legH + 0.6 + bodyH + 0.6, 0);
    group.add(hatch);

    return group;
  }

  /**
   * Continuous Architectural Ribbon Window Curtain Wall with extruded aluminum mullions.
   */
  public static createRibbonCurtainWall(
    materials: MaterialsManager,
    width: number,
    height: number,
    mullionDivisions: number = 3
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ribbon_curtain_wall';

    const glassMat = materials.get('glass_tinted_blue');
    const frameMat = materials.get('metal_structural');

    // Glass pane
    const glassGeo = new THREE.BoxGeometry(width, height, 0.05);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, height / 2, 0);
    group.add(glass);

    // Top and bottom horizontal frame sill
    const sillGeo = new THREE.BoxGeometry(width + 0.08, 0.08, 0.12);
    const btmSill = new THREE.Mesh(sillGeo, frameMat);
    btmSill.position.set(0, 0.04, 0);
    group.add(btmSill);

    const topSill = new THREE.Mesh(sillGeo, frameMat);
    topSill.position.set(0, height - 0.04, 0);
    group.add(topSill);

    // Vertical structural mullions
    const mullionGeo = new THREE.BoxGeometry(0.06, height, 0.1);
    const spacing = width / (mullionDivisions + 1);

    for (let m = 0; m <= mullionDivisions + 1; m++) {
      const mx = -width / 2 + spacing * m;
      const mullion = new THREE.Mesh(mullionGeo, frameMat);
      mullion.position.set(mx, height / 2, 0);
      mullion.castShadow = true;
      group.add(mullion);
    }

    return group;
  }

  /**
   * Industrial Filtration Smokestack with emission sensor ring and aviation beacon.
   */
  public static createIndustrialSmokestack(
    materials: MaterialsManager,
    height: number = 4.8,
    radius: number = 0.35
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'industrial_smokestack';

    const stackMat = materials.get('metal_structural');
    const hazardMat = materials.get('metal_industrial_orange');
    const beaconMat = materials.get('drum_hazard_red');

    // Tapered stack cylinder
    const stackGeo = new THREE.CylinderGeometry(radius * 0.75, radius, height, 12);
    const stack = new THREE.Mesh(stackGeo, stackMat);
    stack.position.y = height / 2;
    stack.castShadow = true;
    group.add(stack);

    // Dual safety emission bands
    const bandGeo = new THREE.CylinderGeometry(radius * 0.8 + 0.02, radius * 0.82 + 0.02, 0.35, 12);
    const band1 = new THREE.Mesh(bandGeo, hazardMat);
    band1.position.y = height * 0.85;
    group.add(band1);

    const band2 = new THREE.Mesh(bandGeo, hazardMat);
    band2.position.y = height * 0.65;
    group.add(band2);

    // Top exhaust cowl ring
    const cowlGeo = new THREE.TorusGeometry(radius * 0.78, 0.06, 6, 12);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, stackMat);
    cowl.position.y = height;
    group.add(cowl);

    // Obstruction warning aviation beacon
    const beaconGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, height + 0.1, 0);
    group.add(beacon);

    return group;
  }
}
