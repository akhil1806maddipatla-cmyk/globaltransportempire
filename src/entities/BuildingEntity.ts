import * as THREE from 'three';
import { Entity } from './Entity';
import { BuildingDefinition } from '../data/buildingDefinitions';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { BuildingModularComponents } from './BuildingModularComponents';
import { IFacilityOperations } from '../facilities/FacilityModel';

export class BuildingEntity extends Entity {
  public static readonly METERS_PER_CELL = 4.0;
  public readonly definition: BuildingDefinition;
  public readonly rotationDegrees: number;
  public facility: IFacilityOperations | null = null;
  private materialsManager: MaterialsManager;
  private selectionMesh: THREE.Group | null = null;
  private hoverMesh: THREE.Group | null = null;
  private contactShadow: THREE.Mesh | null = null;

  constructor(
    id: string,
    definition: BuildingDefinition,
    gridX: number,
    gridZ: number,
    worldX: number,
    worldZ: number,
    materialsManager: MaterialsManager,
    rotationDegrees: number = 0
  ) {
    const isSwapped = rotationDegrees === 90 || rotationDegrees === 270;
    const effW = isSwapped ? definition.footprintDepth : definition.footprintWidth;
    const effD = isSwapped ? definition.footprintWidth : definition.footprintDepth;

    super(
      id,
      definition.name,
      'building',
      gridX,
      gridZ,
      effW,
      effD,
      definition.height
    );

    this.definition = definition;
    this.rotationDegrees = rotationDegrees;
    this.materialsManager = materialsManager;

    this.group.position.set(worldX, 0, worldZ);
    this.group.rotation.y = (rotationDegrees * Math.PI) / 180;

    this.buildModel();
    this.buildContactShadow();
    this.buildSelectionVisuals();
  }

  private buildContactShadow(): void {
    if (typeof document === 'undefined') {
      return; // Safe fallback in headless / Node.js test runners
    }

    const rawW = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const rawD = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    const shadowGeo = new THREE.PlaneGeometry(rawW + 0.6, rawD + 0.6);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });

    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.02;
    this.group.add(this.contactShadow);
  }

  private buildModel(): void {
    switch (this.definition.id) {
      case 'logistics_warehouse_sm':
        this.buildLogisticsWarehouse();
        break;
      case 'mega_distribution_center':
        this.buildMegaDistributionCenter();
        break;
      case 'cold_storage_facility':
        this.buildColdStorage();
        break;
      case 'industrial_factory_tier1':
        this.buildIndustrialFactory();
        break;
      case 'high_tech_assembly_plant':
        this.buildHighTechFab();
        break;
      case 'truck_depot_level1':
        this.buildTruckDepotLevel1();
        break;
      case 'heavy_vehicle_service_depot':
        this.buildVehicleServiceDepot();
        break;
      case 'freight_depot_modular':
        this.buildModularDepot();
        break;
      case 'container_logistics_terminal':
        this.buildContainerTerminal();
        break;
      case 'commercial_cargo_hub':
        this.buildCommercialHub();
        break;
      default:
        this.buildGenericIndustrial();
        break;
    }
  }

  // =========================================================================
  // 1. Sector Logistics Hub (4x3 cells -> 16m x 12m, height: 8.5m)
  // =========================================================================
  private buildLogisticsWarehouse(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Main warehouse hall volume (8.5m clearance)
    const hallW = w * 0.72;
    const hallD = d * 0.86;
    const hallH = 7.0;
    const hallX = -w * 0.1;

    const mainHall = new THREE.Mesh(
      new THREE.BoxGeometry(hallW, hallH, hallD),
      this.materialsManager.get('metal_corrugated_siding')
    );
    mainHall.position.set(hallX, hallH / 2 + 0.2, 0);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    this.group.add(mainHall);

    // Recessed roof tray with silver TPO membrane
    const roofTray = new THREE.Mesh(
      new THREE.BoxGeometry(hallW - 0.2, 0.1, hallD - 0.2),
      this.materialsManager.get('metal_roof_silver')
    );
    roofTray.position.set(hallX, hallH + 0.18, 0);
    roofTray.receiveShadow = true;
    this.group.add(roofTray);

    // Perimeter roof parapet with aluminum coping trim
    const parapet = BuildingModularComponents.createRoofParapet(
      hallW,
      hallD,
      0.65,
      0.2,
      this.materialsManager.get('metal_corrugated_siding'),
      this.materialsManager.get('metal_roof_silver')
    );
    parapet.position.set(hallX, hallH + 0.2, 0);
    this.group.add(parapet);

    // Twin loading docks on front facade (+Z) - 3.2m W x 4.2m H each
    for (let i = 0; i < 2; i++) {
      const dock = BuildingModularComponents.createLoadingDock(this.materialsManager, {
        doorWidth: 3.2,
        doorHeight: 4.2,
        hasShelter: true,
        hasLeveler: true,
        hasBollards: true,
      });
      const offsetX = hallX - 2.5 + i * 5.0;
      dock.position.set(offsetX, 0.2, hallD / 2);
      this.group.add(dock);
    }

    // Administrative office annex on right (+X)
    const annexW = w * 0.26;
    const annexD = d * 0.75;
    const annexH = 4.8;
    const annexX = w * 0.35;

    // Upgraded multi-tone architectural insulated facade
    const adminAnnex = new THREE.Mesh(
      new THREE.BoxGeometry(annexW, annexH, annexD),
      this.materialsManager.get('metal_siding_light')
    );
    adminAnnex.position.set(annexX, annexH / 2 + 0.2, 0);
    adminAnnex.castShadow = true;
    adminAnnex.receiveShadow = true;
    this.group.add(adminAnnex);

    // Warm architectural accent trim panel
    const accentPanel = new THREE.Mesh(
      new THREE.BoxGeometry(annexW * 0.95, 0.45, annexD * 0.95),
      this.materialsManager.get('logistics_yellow')
    );
    accentPanel.position.set(annexX, annexH + 0.2, 0);
    this.group.add(accentPanel);

    // Glazed corporate entrance vestibule on front facade (+Z)
    const lobbyGlass = BuildingModularComponents.createRibbonCurtainWall(
      this.materialsManager,
      annexW * 0.85,
      2.2,
      2
    );
    lobbyGlass.position.set(annexX, 1.4, annexD / 2 + 0.02);
    this.group.add(lobbyGlass);

    // Entrance portico canopy
    const portico = new THREE.Mesh(
      new THREE.BoxGeometry(annexW * 0.9, 0.12, 1.2),
      this.materialsManager.get('metal_structural')
    );
    portico.position.set(annexX, 2.7, annexD / 2 + 0.6);
    portico.castShadow = true;
    this.group.add(portico);

    // 3D Facility identification sign board
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(annexW * 0.85, 0.55, 0.08),
      this.materialsManager.get('commercial_accent')
    );
    signBoard.position.set(annexX, 3.4, annexD / 2 + 0.06);
    this.group.add(signBoard);

    // Front concrete pedestrian access walkway connecting to sidewalk
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.04, d * 0.25),
      this.materialsManager.get('sidewalk_concrete')
    );
    walkway.position.set(annexX, 0.22, d / 2 + d * 0.12);
    walkway.receiveShadow = true;
    this.group.add(walkway);

    // Rooftop HVAC units on main hall
    const hvac1 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'medium');
    hvac1.position.set(hallX - 1.2, hallH + 0.2, -1.0);
    this.group.add(hvac1);

    const hvac2 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'small');
    hvac2.position.set(hallX + 1.0, hallH + 0.2, 0.8);
    this.group.add(hvac2);
  }

  // =========================================================================
  // 2. Trans-Regional Fulfillment Center (5x4 cells -> 20m x 16m, height: 12.0m)
  // =========================================================================
  private buildMegaDistributionCenter(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.22, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.11;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Massive high-cube warehouse hall
    const hallW = w * 0.94;
    const hallD = d * 0.82;
    const hallH = 10.2;

    const mainHall = new THREE.Mesh(
      new THREE.BoxGeometry(hallW, hallH, hallD),
      this.materialsManager.get('metal_corrugated_siding')
    );
    mainHall.position.set(0, hallH / 2 + 0.22, -d * 0.04);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    this.group.add(mainHall);

    // Roof parapet
    const parapet = BuildingModularComponents.createRoofParapet(
      hallW,
      hallD,
      0.75,
      0.22,
      this.materialsManager.get('metal_corrugated_siding'),
      this.materialsManager.get('metal_roof_silver')
    );
    parapet.position.set(0, hallH + 0.22, -d * 0.04);
    this.group.add(parapet);

    // Quadruple (4x) recessed truck loading dock bays on front facade (3.2m W x 4.2m H each)
    for (let i = 0; i < 4; i++) {
      const dock = BuildingModularComponents.createLoadingDock(this.materialsManager, {
        doorWidth: 3.2,
        doorHeight: 4.2,
        hasShelter: true,
        hasLeveler: true,
        hasBollards: true,
      });
      const offsetX = -6.8 + i * 4.5;
      dock.position.set(offsetX, 0.22, -d * 0.04 + hallD / 2);
      this.group.add(dock);
    }

    // Extensive rooftop photovoltaic solar array (3 rows of panels)
    for (let r = 0; r < 2; r++) {
      const solarRack = BuildingModularComponents.createSolarArrayRack(
        this.materialsManager,
        hallW * 0.75,
        2.8,
        15
      );
      solarRack.position.set(0, hallH + 0.25, -d * 0.04 - 2.2 + r * 4.4);
      this.group.add(solarRack);
    }

    // Industrial rooftop HVAC chillers
    const hvacL = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    hvacL.position.set(-hallW * 0.38, hallH + 0.25, -d * 0.04);
    this.group.add(hvacL);

    const hvacR = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    hvacR.position.set(hallW * 0.38, hallH + 0.25, -d * 0.04);
    this.group.add(hvacR);

    // Corporate dispatch entrance lobby in front-right corner
    const lobbyW = 4.2;
    const lobbyH = 4.8;
    const lobbyD = 3.2;
    const lobbyX = hallW / 2 - lobbyW / 2;
    const lobbyZ = -d * 0.04 + hallD / 2 + lobbyD / 2;

    const lobby = new THREE.Mesh(
      new THREE.BoxGeometry(lobbyW, lobbyH, lobbyD),
      this.materialsManager.get('metal_siding_light')
    );
    lobby.position.set(lobbyX, lobbyH / 2 + 0.22, lobbyZ);
    lobby.castShadow = true;
    this.group.add(lobby);

    const lobbyGlass = BuildingModularComponents.createRibbonCurtainWall(
      this.materialsManager,
      lobbyW * 0.75,
      2.4,
      2
    );
    lobbyGlass.position.set(lobbyX, 2.2, lobbyZ + lobbyD / 2 + 0.02);
    this.group.add(lobbyGlass);
  }

  // =========================================================================
  // 3. Cold-Storage Facility (3x3 cells -> 12m x 12m, height: 9.0m)
  // =========================================================================
  private buildColdStorage(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Insulated Arctic White Cold Storage Cube
    const hallW = w * 0.88;
    const hallD = d * 0.82;
    const hallH = 7.5;

    const mainHall = new THREE.Mesh(
      new THREE.BoxGeometry(hallW, hallH, hallD),
      this.materialsManager.get('metal_siding_light')
    );
    mainHall.position.set(0, hallH / 2 + 0.2, -0.2);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    this.group.add(mainHall);

    // Roof parapet
    const parapet = BuildingModularComponents.createRoofParapet(
      hallW,
      hallD,
      0.65,
      0.2,
      this.materialsManager.get('metal_siding_light'),
      this.materialsManager.get('metal_roof_silver')
    );
    parapet.position.set(0, hallH + 0.2, -0.2);
    this.group.add(parapet);

    // Dual deep-sealed refrigerated loading ports with cyan accents (3.2m W x 4.2m H)
    for (let i = 0; i < 2; i++) {
      const dock = BuildingModularComponents.createLoadingDock(this.materialsManager, {
        doorWidth: 3.2,
        doorHeight: 4.2,
        hasShelter: true,
        hasLeveler: true,
        hasBollards: true,
      });
      const offsetX = -2.4 + i * 4.8;
      dock.position.set(offsetX, 0.2, -0.2 + hallD / 2);
      this.group.add(dock);
    }

    // Dedicated External Chiller & Condenser Yard on rear (+Z/-Z)
    const chiller1 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    chiller1.position.set(-2.4, hallH + 0.2, -1.6);
    this.group.add(chiller1);

    const chiller2 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    chiller2.position.set(2.4, hallH + 0.2, -1.6);
    this.group.add(chiller2);

    // Blue chilled refrigerant distribution manifold
    const manifoldGeo = new THREE.CylinderGeometry(0.1, 0.1, hallW * 0.7, 8);
    manifoldGeo.rotateZ(Math.PI / 2);
    const manifold = new THREE.Mesh(manifoldGeo, this.materialsManager.get('pipe_coolant_blue'));
    manifold.position.set(0, hallH + 1.2, -0.2);
    this.group.add(manifold);
  }

  // =========================================================================
  // 4. Apex Manufacturing Plant (3x3 cells -> 12m x 12m, height: 13.5m)
  // =========================================================================
  private buildIndustrialFactory(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 1. Heavy Kiln-fired Industrial Brick Base Hall
    const hallW = w * 0.72;
    const hallD = d * 0.82;
    const baseH = 5.6;
    const hallX = -w * 0.1;

    const brickBase = new THREE.Mesh(
      new THREE.BoxGeometry(hallW, baseH, hallD),
      this.materialsManager.get('industrial_brick')
    );
    brickBase.position.set(hallX, baseH / 2 + 0.2, 0);
    brickBase.castShadow = true;
    brickBase.receiveShadow = true;
    this.group.add(brickBase);

    // 2. Corrugated Upper Monitor Fabrication Hall
    const upperH = 4.2;
    const upperHall = new THREE.Mesh(
      new THREE.BoxGeometry(hallW * 0.95, upperH, hallD * 0.95),
      this.materialsManager.get('metal_corrugated_siding')
    );
    upperHall.position.set(hallX, baseH + upperH / 2 + 0.2, 0);
    upperHall.castShadow = true;
    upperHall.receiveShadow = true;
    this.group.add(upperHall);

    // Gabled monitor clerestory roof
    const roofGeo = new THREE.BoxGeometry(hallW * 0.98, 0.45, hallD * 0.98);
    const roof = new THREE.Mesh(roofGeo, this.materialsManager.get('metal_roof_silver'));
    roof.position.set(hallX, baseH + upperH + 0.42, 0);
    roof.castShadow = true;
    this.group.add(roof);

    // Raised clerestory skylight lantern
    const lanternGeo = new THREE.BoxGeometry(hallW * 0.45, 0.85, hallD * 0.6);
    const lantern = new THREE.Mesh(lanternGeo, this.materialsManager.get('skylight_glazing'));
    lantern.position.set(hallX, baseH + upperH + 0.85, 0);
    lantern.castShadow = true;
    this.group.add(lantern);

    // 3. Dual Raw Material Silos on East side (+X)
    const silo1 = BuildingModularComponents.createIndustrialSilo(this.materialsManager, 1.4, 9.5);
    silo1.position.set(w * 0.35, 0.2, -2.4);
    this.group.add(silo1);

    const silo2 = BuildingModularComponents.createIndustrialSilo(this.materialsManager, 1.4, 9.5);
    silo2.position.set(w * 0.35, 0.2, 2.4);
    this.group.add(silo2);

    // 4. Industrial Filtration Smokestack (13.5m tall with red beacon)
    const stack = BuildingModularComponents.createIndustrialSmokestack(this.materialsManager, 13.5, 0.65);
    stack.position.set(hallX - hallW * 0.35, 0.2, -hallD * 0.35);
    this.group.add(stack);

    // 5. Overhead Process Piping Bridge connecting silos to factory
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, this.materialsManager.get('pipe_process_yellow'));
    pipe.position.set(w * 0.12, 6.4, 0);
    this.group.add(pipe);

    // Roll-up freight door on front facade (3.6m W x 4.4m H)
    const freightDoor = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 4.4, 0.12),
      this.materialsManager.get('door_rollup_shutter')
    );
    freightDoor.position.set(hallX, 2.4, hallD / 2 + 0.04);
    freightDoor.castShadow = true;
    this.group.add(freightDoor);

    // Protective OSHA safety bollards flanking freight entrance
    const bollardGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
    const bollardMat = this.materialsManager.get('safety_yellow');
    [-2.2, 2.2].forEach((bx) => {
      const bollard = new THREE.Mesh(bollardGeo, bollardMat);
      bollard.position.set(hallX + bx, 0.6, hallD / 2 + 0.8);
      bollard.castShadow = true;
      this.group.add(bollard);
    });

    // Concrete apron pad in front of freight door
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.04, 2.2),
      this.materialsManager.get('concrete_industrial_yard')
    );
    apron.position.set(hallX, 0.22, hallD / 2 + 1.1);
    apron.receiveShadow = true;
    this.group.add(apron);

    // Facility identification sign board
    const factorySign = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.6, 0.08),
      this.materialsManager.get('commercial_accent')
    );
    factorySign.position.set(hallX, 5.2, hallD / 2 + 0.06);
    this.group.add(factorySign);
  }

  // =========================================================================
  // 5. High-Tech Automation Fab (4x3 cells -> 16m x 12m, height: 10.5m)
  // =========================================================================
  private buildHighTechFab(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Ultra-clean high-tech cleanroom production envelope
    const hallW = w * 0.72;
    const hallD = d * 0.85;
    const hallH = 8.5;
    const hallX = -w * 0.1;

    const mainHall = new THREE.Mesh(
      new THREE.BoxGeometry(hallW, hallH, hallD),
      this.materialsManager.get('metal_siding_light')
    );
    mainHall.position.set(hallX, hallH / 2 + 0.2, 0);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    this.group.add(mainHall);

    // Parapet
    const parapet = BuildingModularComponents.createRoofParapet(
      hallW,
      hallD,
      0.65,
      0.2,
      this.materialsManager.get('metal_siding_light'),
      this.materialsManager.get('metal_roof_silver')
    );
    parapet.position.set(hallX, hallH + 0.2, 0);
    this.group.add(parapet);

    // Two-Story Glass Atrium Reception Corner on front-right (+X, +Z)
    const atriumW = w * 0.28;
    const atriumD = d * 0.55;
    const atriumH = 6.8;
    const atriumX = w * 0.32;
    const atriumZ = d * 0.18;

    const atriumGlass = new THREE.Mesh(
      new THREE.BoxGeometry(atriumW, atriumH, atriumD),
      this.materialsManager.get('glass_tinted_blue')
    );
    atriumGlass.position.set(atriumX, atriumH / 2 + 0.2, atriumZ);
    atriumGlass.castShadow = true;
    this.group.add(atriumGlass);

    // Atrium structural framing columns
    const colGeo = new THREE.BoxGeometry(0.18, atriumH, 0.18);
    const frameMat = this.materialsManager.get('metal_structural');
    [-atriumW / 2, atriumW / 2].forEach((cx) => {
      [atriumZ - atriumD / 2, atriumZ + atriumD / 2].forEach((cz) => {
        const col = new THREE.Mesh(colGeo, frameMat);
        col.position.set(atriumX + cx, atriumH / 2 + 0.2, cz);
        col.castShadow = true;
        this.group.add(col);
      });
    });

    // Enclosed Airlock Loading Bay with High-Speed Roll-up Shutter (3.2m W x 4.2m H)
    const airlock = BuildingModularComponents.createLoadingDock(this.materialsManager, {
      doorWidth: 3.2,
      doorHeight: 4.2,
      hasShelter: false,
      hasLeveler: true,
      hasBollards: true,
    });
    airlock.position.set(hallX - 2.4, 0.2, hallD / 2);
    this.group.add(airlock);

    // Rooftop HEPA air filtration plenums
    const hepa1 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    hepa1.position.set(hallX - 2.4, hallH + 0.2, -2.0);
    this.group.add(hepa1);

    const hepa2 = BuildingModularComponents.createRooftopHVAC(this.materialsManager, 'large');
    hepa2.position.set(hallX + 2.4, hallH + 0.2, -2.0);
    this.group.add(hepa2);
  }

  // =========================================================================
  // 6. Pre-Built Level 1 Truck Depot (4x3 cells -> 16m x 12m, height: 8.0m)
  // Exactly 3 Designated Truck Parking Spaces + Dispatch Office & Service Bay
  // =========================================================================
  private buildTruckDepotLevel1(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL; // 16m
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL; // 12m

    // 1. Reinforced Concrete Foundation & Base Slab
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.125;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 2. High-Grade Industrial Asphalt Staging Apron
    const apronW = w * 0.96;
    const apronD = d * 0.94;
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(apronW, 0.04, apronD),
      this.materialsManager.get('asphalt_corridor')
    );
    apron.position.set(0, 0.27, 0);
    apron.receiveShadow = true;
    this.group.add(apron);

    // 3. Exactly 3 Designated Heavy Commercial Truck Parking Bays
    // 3. Exactly 3 Designated Heavy Commercial Truck Parking Bays
    // Centered along the staging yard with 3.3m bay spacing (allows 2.5m trucks with safe 0.8m margin)
    const baySpacing = 3.3;
    const bayStartX = -4.8; // Bays at -4.8m, -1.5m, +1.8m (completely clear of office wall at +4.0m)
    const bayLength = 10.5;
    const bayZCenter = 0.2;

    for (let i = 0; i < 3; i++) {
      const bayX = bayStartX + i * baySpacing;

      // Yellow Parking Stripe Markings (Left & Right borders of each space)
      const stripeMat = this.materialsManager.get('safety_yellow');
      const stripeGeo = new THREE.BoxGeometry(0.12, 0.02, bayLength);

      const leftStripe = new THREE.Mesh(stripeGeo, stripeMat);
      leftStripe.position.set(bayX - 1.45, 0.3, bayZCenter);
      this.group.add(leftStripe);

      const rightStripe = new THREE.Mesh(stripeGeo, stripeMat);
      rightStripe.position.set(bayX + 1.45, 0.3, bayZCenter);
      this.group.add(rightStripe);

      // Angled bay entry chevron markers on front edge
      const chevGeo = new THREE.BoxGeometry(0.65, 0.02, 0.12);
      const chevL = new THREE.Mesh(chevGeo, stripeMat);
      chevL.position.set(bayX - 1.15, 0.3, bayZCenter + bayLength / 2 - 0.2);
      chevL.rotation.y = Math.PI / 4;
      this.group.add(chevL);

      const chevR = new THREE.Mesh(chevGeo, stripeMat);
      chevR.position.set(bayX + 1.15, 0.3, bayZCenter + bayLength / 2 - 0.2);
      chevR.rotation.y = -Math.PI / 4;
      this.group.add(chevR);

      // Heavy Rubber Wheel Stop at rear of parking bay
      const wheelStop = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.18, 0.24),
        this.materialsManager.get('metal_structural')
      );
      wheelStop.position.set(bayX, 0.38, bayZCenter - bayLength / 2 + 0.6);
      wheelStop.castShadow = true;
      this.group.add(wheelStop);

      // Bay Number Plate Stanchion on rear wall / post
      const stanchion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6),
        this.materialsManager.get('metal_structural')
      );
      stanchion.position.set(bayX, 1.0, bayZCenter - bayLength / 2 + 0.2);
      this.group.add(stanchion);

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.4, 0.06),
        this.materialsManager.get('commercial_accent')
      );
      signBoard.position.set(bayX, 1.5, bayZCenter - bayLength / 2 + 0.2);
      this.group.add(signBoard);

      // Recessed under-canopy bay floodlight fixture
      const bayLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.4),
        this.materialsManager.get('streetlight_lamp')
      );
      bayLight.position.set(bayX, 5.3, bayZCenter);
      this.group.add(bayLight);
    }

    // 4. Overhead Cantilever Canopy Structure (5.4m overhead clearance for high-cube rigs)
    const canopyW = 10.8;
    const canopyD = 9.6;
    const canopyH = 5.4;
    const canopyX = -1.5;

    // Standing seam corrugated metal roof
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(canopyW, 0.28, canopyD),
      this.materialsManager.get('metal_corrugated_siding')
    );
    roofSlab.position.set(canopyX, canopyH, bayZCenter);
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    this.group.add(roofSlab);

    // Aluminum fascia edge border
    const fasciaMat = this.materialsManager.get('metal_structural');
    const fasciaFront = new THREE.Mesh(new THREE.BoxGeometry(canopyW + 0.1, 0.35, 0.1), fasciaMat);
    fasciaFront.position.set(canopyX, canopyH, bayZCenter + canopyD / 2 + 0.05);
    this.group.add(fasciaFront);

    // Structural open-web steel truss beams underneath canopy
    const trussMat = this.materialsManager.get('steel_truss_grey') || fasciaMat;
    [-canopyW * 0.35, 0, canopyW * 0.35].forEach((tx) => {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, canopyD * 0.92), trussMat);
      truss.position.set(canopyX + tx, canopyH - 0.2, bayZCenter);
      this.group.add(truss);
    });

    // Cantilever Support Columns along rear with concrete base pedestals
    for (let c = 0; c < 4; c++) {
      const colX = canopyX - canopyW / 2 + 0.6 + c * ((canopyW - 1.2) / 3);
      // Concrete footing pedestal
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.45, 8),
        this.materialsManager.get('concrete_foundation')
      );
      ped.position.set(colX, 0.45, bayZCenter - canopyD / 2 + 0.25);
      this.group.add(ped);

      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, canopyH - 0.45, 8),
        this.materialsManager.get('metal_structural')
      );
      col.position.set(colX, (canopyH + 0.45) / 2, bayZCenter - canopyD / 2 + 0.25);
      col.castShadow = true;
      this.group.add(col);
    }

    // 5. Fleet Dispatch Operations & Administration Annex Building (+X side)
    const officeW = 3.8;
    const officeD = d * 0.72;
    const officeH = 6.5;
    const officeX = w / 2 - officeW / 2 - 0.2;
    const officeZ = -d * 0.08;

    const office = new THREE.Mesh(
      new THREE.BoxGeometry(officeW, officeH, officeD),
      this.materialsManager.get('metal_siding_light')
    );
    office.position.set(officeX, officeH / 2 + 0.25, officeZ);
    office.castShadow = true;
    office.receiveShadow = true;
    this.group.add(office);

    // Office base water-table trim
    const officeBase = new THREE.Mesh(
      new THREE.BoxGeometry(officeW + 0.1, 1.2, officeD + 0.1),
      this.materialsManager.get('metal_structural')
    );
    officeBase.position.set(officeX, 0.85, officeZ);
    this.group.add(officeBase);

    // Office ribbon curtain glazing (upper floor dispatcher observation)
    const officeGlass = BuildingModularComponents.createRibbonCurtainWall(
      this.materialsManager,
      officeW * 0.85,
      1.6,
      2
    );
    officeGlass.position.set(officeX, 4.2, officeZ + officeD / 2 + 0.02);
    this.group.add(officeGlass);

    // Ground-floor entrance door with glass canopy
    const entryDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 0.1),
      this.materialsManager.get('metal_structural')
    );
    entryDoor.position.set(officeX - officeW / 2 - 0.04, 1.35, officeZ);
    entryDoor.rotation.y = Math.PI / 2;
    this.group.add(entryDoor);

    const doorCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.08, 1.8),
      this.materialsManager.get('skylight_glazing')
    );
    doorCanopy.position.set(officeX - officeW / 2 - 0.45, 2.5, officeZ);
    this.group.add(doorCanopy);

    // Rooftop Communications Antenna Mast & Satellite Dish
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 3.8, 6),
      this.materialsManager.get('metal_structural')
    );
    mast.position.set(officeX, officeH + 2.0, officeZ);
    this.group.add(mast);

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.1, 0.15, 12),
      this.materialsManager.get('silo_aluminum')
    );
    dish.rotation.x = Math.PI / 4;
    dish.position.set(officeX + 0.8, officeH + 1.2, officeZ - 1.2);
    this.group.add(dish);

    // 6. Level 1 Depot Entrance Signage Board with LED Status
    const signPost = new THREE.Mesh(
      new THREE.BoxGeometry(officeW * 0.9, 0.8, 0.12),
      this.materialsManager.get('commercial_accent')
    );
    signPost.position.set(officeX, officeH + 0.6, officeZ + officeD / 2);
    this.group.add(signPost);

    // Green LED Active Operations Indicator (Centralized PBR Material)
    const ledMat = this.materialsManager.get('depot_active_indicator');
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.05), ledMat);
    led.position.set(officeX, officeH + 0.6, officeZ + officeD / 2 + 0.08);
    this.group.add(led);

    // 7. Fleet Maintenance Compressor & Diesel Fuel Station on -X rear
    const tankGeo = new THREE.CylinderGeometry(0.8, 0.8, 3.2, 12);
    tankGeo.rotateZ(Math.PI / 2);
    const fuelTank = new THREE.Mesh(tankGeo, this.materialsManager.get('metal_siding_light'));
    fuelTank.position.set(-w / 2 + 2.2, 1.2, -d / 2 + 2.0);
    fuelTank.castShadow = true;
    this.group.add(fuelTank);

    // Fuel pump island stanchion
    const pumpIsland = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.4, 0.6),
      this.materialsManager.get('safety_yellow')
    );
    pumpIsland.position.set(-w / 2 + 2.2, 0.9, -d / 2 + 3.8);
    this.group.add(pumpIsland);
  }

  // =========================================================================
  // 7. Fleet Logistics Maintenance Yard (4x2 cells -> 16m x 8m, height: 8.0m)
  // =========================================================================
  private buildVehicleServiceDepot(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Main Service Workshop Bay Hall (7.0m clearance)
    const bayHallW = w * 0.74;
    const bayHallD = d * 0.84;
    const bayHallH = 6.8;
    const bayHallX = -w * 0.1;

    const bayHall = new THREE.Mesh(
      new THREE.BoxGeometry(bayHallW, bayHallH, bayHallD),
      this.materialsManager.get('metal_corrugated_siding')
    );
    bayHall.position.set(bayHallX, bayHallH / 2 + 0.2, 0);
    bayHall.castShadow = true;
    bayHall.receiveShadow = true;
    this.group.add(bayHall);

    // Triple (3x) drive-through commercial vehicle service bays on front (3.5m W x 4.8m H each)
    for (let i = 0; i < 3; i++) {
      const offsetX = bayHallX - 3.8 + i * 3.8;

      // Heavy roll-up service bay door
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 4.6, 0.12),
        this.materialsManager.get('door_rollup_shutter')
      );
      doorMesh.position.set(offsetX, 2.3 + 0.2, bayHallD / 2 + 0.04);
      doorMesh.castShadow = true;
      this.group.add(doorMesh);

      // Yellow overhead clearance height warning bar (5.0m clearance)
      const barGeo = new THREE.BoxGeometry(3.6, 0.22, 0.16);
      const bar = new THREE.Mesh(barGeo, this.materialsManager.get('safety_yellow'));
      bar.position.set(offsetX, 4.9, bayHallD / 2 + 0.08);
      this.group.add(bar);
    }

    // Elevated Dispatcher Observation Office on right (+X)
    const officeW = w * 0.24;
    const officeD = d * 0.78;
    const officeH = 6.4;
    const officeX = w * 0.35;

    const office = new THREE.Mesh(
      new THREE.BoxGeometry(officeW, officeH, officeD),
      this.materialsManager.get('metal_siding_light')
    );
    office.position.set(officeX, officeH / 2 + 0.2, 0);
    office.castShadow = true;
    this.group.add(office);

    // Wrap-around observation glazing on office
    const glass = BuildingModularComponents.createRibbonCurtainWall(
      this.materialsManager,
      officeW * 0.85,
      1.8,
      2
    );
    glass.position.set(officeX, 4.4, officeD / 2 + 0.02);
    this.group.add(glass);

    // Radio communications whip antenna mast on office roof
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.08, 3.6, 6);
    const mast = new THREE.Mesh(mastGeo, this.materialsManager.get('metal_structural'));
    mast.position.set(officeX, officeH + 2.0, 0);
    this.group.add(mast);
  }

  // =========================================================================
  // 7. Modular Intermodal Depot (3x2 cells -> 12m x 8m, height: 7.5m)
  // =========================================================================
  private buildModularDepot(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Foundation
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 1. Open Structural Steel Canopy Structure (5.8m vertical clearance for heavy rigs)
    const canopyW = w * 0.65;
    const canopyD = d * 0.85;
    const canopyH = 5.8;
    const canopyX = -w * 0.15;

    // Roof truss slab
    const canopyRoof = new THREE.Mesh(
      new THREE.BoxGeometry(canopyW, 0.35, canopyD),
      this.materialsManager.get('metal_roof_silver')
    );
    canopyRoof.position.set(canopyX, canopyH + 0.2, 0);
    canopyRoof.castShadow = true;
    this.group.add(canopyRoof);

    // 4 Wide-flange steel columns supporting canopy
    const colGeo = new THREE.BoxGeometry(0.25, canopyH, 0.25);
    const colMat = this.materialsManager.get('steel_truss_grey');
    [-canopyW / 2 + 0.4, canopyW / 2 - 0.4].forEach((cx) => {
      [-canopyD / 2 + 0.4, canopyD / 2 - 0.4].forEach((cz) => {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(canopyX + cx, canopyH / 2 + 0.2, cz);
        col.castShadow = true;
        this.group.add(col);
      });
    });

    // 2. Compact Modular Dispatch Cabin on right (+X)
    const cabinW = w * 0.28;
    const cabinD = d * 0.75;
    const cabinH = 4.2;
    const cabinX = w * 0.32;

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW, cabinH, cabinD),
      this.materialsManager.get('metal_siding_light')
    );
    cabin.position.set(cabinX, cabinH / 2 + 0.2, 0);
    cabin.castShadow = true;
    this.group.add(cabin);

    // Cabin window and door
    const cabinWindow = BuildingModularComponents.createRibbonCurtainWall(
      this.materialsManager,
      cabinW * 0.75,
      1.3,
      1
    );
    cabinWindow.position.set(cabinX, 2.4, cabinD / 2 + 0.02);
    this.group.add(cabinWindow);

    // Telemetry Satellite Dish on cabin roof
    const dishGeo = new THREE.ConeGeometry(0.8, 0.3, 12);
    dishGeo.rotateX(-Math.PI / 3);
    const dish = new THREE.Mesh(dishGeo, this.materialsManager.get('metal_roof_silver'));
    dish.position.set(cabinX, cabinH + 0.65, 0);
    this.group.add(dish);
  }

  // =========================================================================
  // 8. Intermodal Container Stacking Yard (4x3 cells -> 16m x 12m, height: 8.5m)
  // =========================================================================
  private buildContainerTerminal(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Heavy reinforced asphalt apron plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      this.materialsManager.get('road_arterial_asphalt')
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Yellow safety staging lane striping along perimeter
    const stripeGeo = new THREE.BoxGeometry(w - 0.8, 0.04, 0.2);
    const stripe = new THREE.Mesh(stripeGeo, this.materialsManager.get('safety_yellow'));
    stripe.position.set(0, 0.22, d / 2 - 0.6);
    this.group.add(stripe);

    // Authoritative ISO 40ft & 20ft Marine Shipping Containers
    // 40ft container: 12.19m L x 2.44m W x 2.59m H
    // 20ft container: 6.06m L x 2.44m W x 2.59m H
    const box40Geo = new THREE.BoxGeometry(12.19, 2.59, 2.44);
    const box20Geo = new THREE.BoxGeometry(6.06, 2.59, 2.44);

    const mGreen = this.materialsManager.get('metal_container_green');
    const mRed = this.materialsManager.get('metal_container_red');
    const mOrange = this.materialsManager.get('metal_container_orange');
    const mBlue = this.materialsManager.get('metal_container_blue');

    // Stack 1: Tier 1 & 2 (North row: 40ft containers along X axis)
    const c1 = new THREE.Mesh(box40Geo, mBlue);
    c1.position.set(0, 0.2 + 2.59 / 2, -2.6);
    c1.castShadow = true;
    c1.receiveShadow = true;
    this.group.add(c1);

    const c2 = new THREE.Mesh(box40Geo, mOrange);
    c2.position.set(0, 0.2 + 2.59 + 2.59 / 2, -2.6);
    c2.castShadow = true;
    c2.receiveShadow = true;
    this.group.add(c2);

    // Stack 2: Tier 1 & 2 (South row: 20ft containers)
    const c4 = new THREE.Mesh(box20Geo, mRed);
    c4.position.set(-3.2, 0.2 + 2.59 / 2, 1.6);
    c4.castShadow = true;
    this.group.add(c4);

    const c5 = new THREE.Mesh(box20Geo, mGreen);
    c5.position.set(3.2, 0.2 + 2.59 / 2, 1.6);
    c5.castShadow = true;
    this.group.add(c5);

    const c6 = new THREE.Mesh(box20Geo, mBlue);
    c6.position.set(-3.2, 0.2 + 2.59 + 2.59 / 2, 1.6);
    c6.castShadow = true;
    this.group.add(c6);

    // Yard Perimeter High-Mast Floodlight Tower (9.5m tall)
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.2, 9.5, 8);
    const pole = new THREE.Mesh(poleGeo, this.materialsManager.get('metal_structural'));
    pole.position.set(w / 2 - 0.8, 4.75, d / 2 - 0.8);
    pole.castShadow = true;
    this.group.add(pole);

    const rackGeo = new THREE.BoxGeometry(1.6, 0.3, 0.4);
    const lightRack = new THREE.Mesh(rackGeo, this.materialsManager.get('streetlight_post'));
    lightRack.position.set(w / 2 - 0.8, 9.3, d / 2 - 0.8);
    this.group.add(lightRack);

    // Terminal checkpoint security booth
    const boothGeo = new THREE.BoxGeometry(2.4, 3.2, 2.4);
    const booth = new THREE.Mesh(boothGeo, this.materialsManager.get('metal_siding_light'));
    booth.position.set(w / 2 - 2.4, 1.6 + 0.2, d / 2 - 1.6);
    booth.castShadow = true;
    this.group.add(booth);
  }

  // =========================================================================
  // 9. Global Dispatch Headquarters (3x2 cells -> 12m x 8m, height: 11.5m)
  // =========================================================================
  private buildCommercialHub(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // Dark granite plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2),
      this.materialsManager.get('concrete_foundation')
    );
    plinth.position.y = 0.125;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 3-Story Commercial Office Building Volume
    const bldW = w * 0.88;
    const bldD = d * 0.84;
    const bldH = 9.2;

    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(bldW, bldH, bldD),
      this.materialsManager.get('metal_siding_light')
    );
    mainBody.position.set(0, bldH / 2 + 0.25, 0);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.group.add(mainBody);

    // Alternating Continuous Ribbon Glass Facades for Floor 1, Floor 2, Floor 3
    for (let floor = 0; floor < 3; floor++) {
      const fy = 0.25 + 0.8 + floor * 2.8;

      // Front ribbon glass
      const glassFront = BuildingModularComponents.createRibbonCurtainWall(
        this.materialsManager,
        bldW * 0.88,
        1.5,
        4
      );
      glassFront.position.set(0, fy, bldD / 2 + 0.02);
      this.group.add(glassFront);

      // Back ribbon glass
      const glassBack = BuildingModularComponents.createRibbonCurtainWall(
        this.materialsManager,
        bldW * 0.88,
        1.5,
        4
      );
      glassBack.position.set(0, fy, -bldD / 2 - 0.02);
      glassBack.rotation.y = Math.PI;
      this.group.add(glassBack);
    }

    // Modern glass entrance canopy on ground floor (+Z)
    const canopyGeo = new THREE.BoxGeometry(4.2, 0.15, 1.8);
    const canopy = new THREE.Mesh(canopyGeo, this.materialsManager.get('glass_tinted_blue'));
    canopy.position.set(0, 2.8, bldD / 2 + 0.9);
    canopy.castShadow = true;
    this.group.add(canopy);

    // Rooftop Communications Satellite Dish & Enclosed Mechanical Penthouse
    const penthouseGeo = new THREE.BoxGeometry(4.4, 1.8, 3.6);
    const penthouse = new THREE.Mesh(penthouseGeo, this.materialsManager.get('metal_roof_silver'));
    penthouse.position.set(0, bldH + 0.25 + 0.9, 0);
    penthouse.castShadow = true;
    this.group.add(penthouse);

    const dishGeo = new THREE.ConeGeometry(1.2, 0.45, 16);
    dishGeo.rotateX(-Math.PI / 3);
    const dish = new THREE.Mesh(dishGeo, this.materialsManager.get('silo_aluminum'));
    dish.position.set(2.4, bldH + 0.25 + 1.8, -0.8);
    this.group.add(dish);

    // Corporate Entrance Signboard above canopy
    const hqSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.75, 0.1),
      this.materialsManager.get('commercial_accent')
    );
    hqSign.position.set(0, 3.4, bldD / 2 + 0.12);
    this.group.add(hqSign);

    // Entrance concrete walkway connecting to sidewalk
    const hqWalkway = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.04, d * 0.22),
      this.materialsManager.get('sidewalk_concrete')
    );
    hqWalkway.position.set(0, 0.22, d / 2 + d * 0.1);
    hqWalkway.receiveShadow = true;
    this.group.add(hqWalkway);

    // Corporate Antenna Tower Mast
    const towerGeo = new THREE.CylinderGeometry(0.06, 0.12, 4.8, 6);
    const tower = new THREE.Mesh(towerGeo, this.materialsManager.get('metal_structural'));
    tower.position.set(-2.4, bldH + 0.25 + 2.4, -0.8);
    this.group.add(tower);
  }

  // =========================================================================
  // Generic Fallback
  // =========================================================================
  private buildGenericIndustrial(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;
    const h = this.definition.height;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, h, d * 0.85),
      this.materialsManager.get('metal_corrugated_siding')
    );
    base.position.y = h / 2 + 0.1;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);
  }

  // =========================================================================
  // Selection and Hover Visuals
  // =========================================================================
  private buildSelectionVisuals(): void {
    const w = this.definition.footprintWidth * BuildingEntity.METERS_PER_CELL;
    const d = this.definition.footprintDepth * BuildingEntity.METERS_PER_CELL;

    // 1. Selection indicator: Glowing ground footprint outline
    this.selectionMesh = new THREE.Group();
    this.selectionMesh.name = 'selection_visual';

    const ringGeo = new THREE.PlaneGeometry(w + 0.35, d + 0.35);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.materialsManager.get('selection_glow'));
    ringMesh.position.y = 0.03;
    this.selectionMesh.add(ringMesh);

    // Outer corner bracket markers
    const bracketMat = this.materialsManager.get('selection_ring');
    const cornerSize = 1.2;
    const thickness = 0.14;

    const corners = [
      { x: -w / 2, z: -d / 2, rotY: 0 },
      { x: w / 2, z: -d / 2, rotY: Math.PI / 2 },
      { x: w / 2, z: d / 2, rotY: Math.PI },
      { x: -w / 2, z: d / 2, rotY: -Math.PI / 2 },
    ];

    corners.forEach((c) => {
      const bH = new THREE.Mesh(new THREE.BoxGeometry(cornerSize, 0.08, thickness), bracketMat);
      bH.position.set(c.x, 0.04, c.z);
      this.selectionMesh!.add(bH);

      const bV = new THREE.Mesh(new THREE.BoxGeometry(thickness, 0.08, cornerSize), bracketMat);
      bV.position.set(c.x, 0.04, c.z);
      this.selectionMesh!.add(bV);
    });

    this.selectionMesh.visible = false;
    this.group.add(this.selectionMesh);

    // 2. Hover indicator: Subtle bounding outline
    this.hoverMesh = new THREE.Group();
    this.hoverMesh.name = 'hover_visual';

    const hoverGeo = new THREE.RingGeometry(w / 2, w / 2 + 0.25, 4);
    hoverGeo.rotateX(-Math.PI / 2);
    hoverGeo.rotateY(Math.PI / 4);
    const hoverPlate = new THREE.Mesh(hoverGeo, this.materialsManager.get('selection_glow'));
    hoverPlate.position.y = 0.025;
    this.hoverMesh.add(hoverPlate);

    this.hoverMesh.visible = false;
    this.group.add(this.hoverMesh);
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (this.selectionMesh) {
      this.selectionMesh.visible = selected;
    }
  }

  public setHovered(hovered: boolean): void {
    this.isHovered = hovered;
    if (this.hoverMesh) {
      this.hoverMesh.visible = hovered && !this.isSelected;
    }
  }

  public getEffectiveDimensions(): { effectiveWidth: number; effectiveDepth: number } {
    const isSwapped = this.rotationDegrees === 90 || this.rotationDegrees === 270;
    return {
      effectiveWidth: isSwapped ? this.definition.footprintDepth : this.definition.footprintWidth,
      effectiveDepth: isSwapped ? this.definition.footprintWidth : this.definition.footprintDepth,
    };
  }

  public getPerimeterCells(): Array<{ x: number; z: number; edge: 'north' | 'south' | 'east' | 'west' }> {
    const { effectiveWidth, effectiveDepth } = this.getEffectiveDimensions();
    const cells: Array<{ x: number; z: number; edge: 'north' | 'south' | 'east' | 'west' }> = [];

    // North edge (z = this.gridZ - 1)
    for (let x = this.gridX; x < this.gridX + effectiveWidth; x++) {
      cells.push({ x, z: this.gridZ - 1, edge: 'north' });
    }
    // South edge (z = this.gridZ + effectiveDepth)
    for (let x = this.gridX; x < this.gridX + effectiveWidth; x++) {
      cells.push({ x, z: this.gridZ + effectiveDepth, edge: 'south' });
    }
    // West edge (x = this.gridX - 1)
    for (let z = this.gridZ; z < this.gridZ + effectiveDepth; z++) {
      cells.push({ x: this.gridX - 1, z, edge: 'west' });
    }
    // East edge (x = this.gridX + effectiveWidth)
    for (let z = this.gridZ; z < this.gridZ + effectiveDepth; z++) {
      cells.push({ x: this.gridX + effectiveWidth, z, edge: 'east' });
    }

    return cells;
  }

  public override dispose(): void {
    super.dispose();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });
  }
}
