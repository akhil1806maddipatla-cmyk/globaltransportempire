import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';
import { ProceduralTextures } from './ProceduralTextures';

export class MaterialsManager implements IDisposable {
  private materials = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];

  constructor() {
    this.initDefaultMaterials();
  }

  private initDefaultMaterials(): void {
    const palette = DEFAULT_GAME_CONFIG.palette;

    // 1. Procedural PBR Canvas Textures
    const grassTex = ProceduralTextures.createGrassTexture();
    const asphaltTex = ProceduralTextures.createAsphaltTexture();
    const concreteYardTex = ProceduralTextures.createConcreteYardTexture();
    const gravelTex = ProceduralTextures.createGravelTexture();
    const hazardTex = ProceduralTextures.createHazardStripeTexture();
    const wallTex = ProceduralTextures.createRetainingWallTexture();
    const waterTex = ProceduralTextures.createWaterTexture();
    const claddingTex = ProceduralTextures.createCorrugatedCladdingTexture();
    const solarTex = ProceduralTextures.createSolarPanelTexture();
    const shutterTex = ProceduralTextures.createRollUpDoorTexture();
    const roofTex = ProceduralTextures.createRoofMembraneTexture();
    const brickTex = ProceduralTextures.createIndustrialBrickTexture();

    // Vehicle & Freight Textures
    const tireTex = ProceduralTextures.createTireTreadTexture();
    const catwalkTex = ProceduralTextures.createDiamondPlateTexture();
    const containerTexBlue = ProceduralTextures.createContainerCorrugatedTexture('#1e40af', 'APXU 492018-7');
    const containerTexRed = ProceduralTextures.createContainerCorrugatedTexture('#b91c1c', 'CRMU 881042-3');
    const containerTexOrange = ProceduralTextures.createContainerCorrugatedTexture('#c2410c', 'HLXU 339105-0');
    const containerTexGreen = ProceduralTextures.createContainerCorrugatedTexture('#15803d', 'EGLU 910244-1');
    const containerTexWhite = ProceduralTextures.createContainerCorrugatedTexture('#f1f5f9', 'RFLU 772091-6');
    const conspicuityTex = ProceduralTextures.createConspicuityTapeTexture();
    const reeferTex = ProceduralTextures.createReeferUnitTexture();

    // Road Hierarchy & Roadside Procedural Textures
    const highwayAsphaltTex = ProceduralTextures.createHighwayAsphaltTexture();
    const localAsphaltTex = ProceduralTextures.createLocalStreetAsphaltTexture();
    const industrialPaveTex = ProceduralTextures.createIndustrialPavementTexture();
    const sidewalkTileTex = ProceduralTextures.createSidewalkTileTexture();
    const arrowStraightTex = ProceduralTextures.createTurnArrowTexture('straight');
    const arrowLeftTex = ProceduralTextures.createTurnArrowTexture('left');
    const arrowRightTex = ProceduralTextures.createTurnArrowTexture('right');
    const arrowComboTex = ProceduralTextures.createTurnArrowTexture('combo');
    const gantrySignTex = ProceduralTextures.createHighwayGantrySignTexture();
    const speed50Tex = ProceduralTextures.createSpeedLimitSignTexture(50);
    const speed75Tex = ProceduralTextures.createSpeedLimitSignTexture(75);
    const speed110Tex = ProceduralTextures.createSpeedLimitSignTexture(110);

    // Cache textures for cleanup
    [
      grassTex,
      asphaltTex,
      concreteYardTex,
      gravelTex,
      hazardTex,
      wallTex,
      waterTex,
      claddingTex,
      solarTex,
      shutterTex,
      roofTex,
      brickTex,
      tireTex,
      catwalkTex,
      containerTexBlue,
      containerTexRed,
      containerTexOrange,
      containerTexGreen,
      containerTexWhite,
      conspicuityTex,
      reeferTex,
      highwayAsphaltTex,
      localAsphaltTex,
      industrialPaveTex,
      sidewalkTileTex,
      arrowStraightTex,
      arrowLeftTex,
      arrowRightTex,
      arrowComboTex,
      gantrySignTex,
      speed50Tex,
      speed75Tex,
      speed110Tex,
    ].forEach((t) => {
      if (t) this.textures.push(t);
    });

    // --- Terrain & Ground Materials ---
    this.createStandard('ground_grass_primary', {
      color: palette.grassMid,
      map: grassTex || undefined,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: false,
    });

    this.createStandard('ground_grass_mid', {
      color: palette.grassMid,
      map: grassTex || undefined,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: false,
    });

    this.createStandard('ground_grass_light', {
      color: palette.grassLight,
      map: grassTex || undefined,
      roughness: 0.85,
      metalness: 0.03,
    });

    this.createStandard('ground_grass_dark', {
      color: palette.grassDark,
      map: grassTex || undefined,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.createStandard('ground_dirt', {
      color: 0x7a6348,
      map: gravelTex || undefined,
      roughness: 0.96,
      metalness: 0.02,
    });

    // Paved Industrial Yard & Concrete Apron Slab
    this.createStandard('concrete_industrial_yard', {
      color: 0xd1d5db,
      map: concreteYardTex || undefined,
      roughness: 0.78,
      metalness: 0.12,
    });

    this.createStandard('concrete_loading_apron', {
      color: 0xe5e7eb,
      map: concreteYardTex || undefined,
      roughness: 0.72,
      metalness: 0.1,
    });

    this.createStandard('hazard_apron_border', {
      color: 0xffffff,
      map: hazardTex || undefined,
      roughness: 0.5,
      metalness: 0.1,
    });

    this.createStandard('retaining_wall_concrete', {
      color: 0x9ca3af,
      map: wallTex || undefined,
      roughness: 0.82,
      metalness: 0.15,
    });

    this.createStandard('gravel_shoulder', {
      color: 0x5a544b,
      map: gravelTex || undefined,
      roughness: 0.95,
      metalness: 0.04,
    });

    // Civil Stormwater Retention Pond & Water Bodies
    this.createStandard('pond_water', {
      color: 0x0284c7,
      map: waterTex || undefined,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
    });

    this.createStandard('river_water', {
      color: 0x0369a1,
      map: waterTex || undefined,
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.85,
    });

    this.createStandard('shoreline_sand', {
      color: 0x928267,
      roughness: 0.94,
      metalness: 0.02,
    });

    this.createStandard('riverbed_silt', {
      color: 0x292524,
      roughness: 0.98,
      metalness: 0.05,
    });

    this.createStandard('rail_ballast', {
      color: 0x475569,
      map: gravelTex || undefined,
      roughness: 0.96,
      metalness: 0.06,
    });

    this.createStandard('coastal_deep_water', {
      color: 0x0c4a6e,
      map: waterTex || undefined,
      roughness: 0.05,
      metalness: 0.22,
      transparent: true,
      opacity: 0.88,
    });

    this.createStandard('quay_wall_concrete', {
      color: 0x64748b,
      map: wallTex || undefined,
      roughness: 0.84,
      metalness: 0.12,
    });

    this.createStandard('marine_fender_rubber', {
      color: 0x18181b,
      roughness: 0.92,
      metalness: 0.05,
    });

    this.createStandard('marine_bollard_steel', {
      color: 0x334155,
      roughness: 0.38,
      metalness: 0.85,
    });

    this.createStandard('buoy_green_starboard', {
      color: 0x16a34a,
      roughness: 0.42,
      metalness: 0.3,
    });

    this.createStandard('buoy_red_port', {
      color: 0xdc2626,
      roughness: 0.42,
      metalness: 0.3,
    });

    this.createStandard('buoy_light_green', {
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.createStandard('buoy_light_red', {
      color: 0xf87171,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.createStandard('bridge_deck_asphalt', {
      color: 0x27272a,
      map: asphaltTex || undefined,
      roughness: 0.72,
      metalness: 0.15,
    });

    this.createStandard('bridge_pier_concrete', {
      color: 0x94a3b8,
      map: wallTex || undefined,
      roughness: 0.82,
      metalness: 0.1,
    });

    this.createStandard('embankment_rock', {
      color: 0x475569,
      roughness: 0.92,
      metalness: 0.1,
      flatShading: true,
    });

    // --- Infrastructure & Roads ---
    this.createStandard('road_asphalt', {
      color: palette.asphalt,
      map: asphaltTex || undefined,
      roughness: 0.68,
      metalness: 0.18,
    });

    this.createStandard('road_local_asphalt', {
      color: 0x2d3239,
      map: localAsphaltTex || asphaltTex || undefined,
      roughness: 0.76,
      metalness: 0.12,
    });

    this.createStandard('road_arterial_asphalt', {
      color: 0x1e2229,
      map: asphaltTex || undefined,
      roughness: 0.62,
      metalness: 0.22,
    });

    this.createStandard('asphalt_corridor', {
      color: palette.asphalt,
      map: asphaltTex || undefined,
      roughness: 0.65,
      metalness: 0.18,
    });

    this.createStandard('road_access_gravel', {
      color: 0x4b515a,
      map: gravelTex || undefined,
      roughness: 0.88,
      metalness: 0.08,
    });

    this.createStandard('road_industrial_pavement', {
      color: 0x6b7280,
      map: industrialPaveTex || concreteYardTex || undefined,
      roughness: 0.82,
      metalness: 0.10,
    });

    this.createStandard('sidewalk_concrete', {
      color: 0x9ca3af,
      map: sidewalkTileTex || undefined,
      roughness: 0.84,
      metalness: 0.08,
    });

    this.createStandard('jersey_barrier_concrete', {
      color: 0xd1d5db,
      map: wallTex || undefined,
      roughness: 0.78,
      metalness: 0.10,
    });

    this.createStandard('road_marking', {
      color: palette.roadMarking,
      roughness: 0.45,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.createStandard('road_marking_white', {
      color: palette.roadMarking,
      roughness: 0.45,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.createStandard('road_marking_yellow', {
      color: 0xf59e0b,
      roughness: 0.42,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.createStandard('concrete_curb', {
      color: palette.curb,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.createStandard('highway_guardrail_steel', {
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.88,
    });

    this.createStandard('highway_asphalt', {
      color: 0x16191f,
      map: highwayAsphaltTex || asphaltTex || undefined,
      roughness: 0.52,
      metalness: 0.26,
    });

    this.createStandard('road_highway_asphalt', {
      color: 0x16191f,
      map: highwayAsphaltTex || asphaltTex || undefined,
      roughness: 0.52,
      metalness: 0.26,
    });

    // Roadway Stencil Markings (Turn Arrows & Gantry Signs)
    this.createStandard('road_arrow_straight', {
      color: 0xffffff,
      map: arrowStraightTex || undefined,
      transparent: true,
      roughness: 0.4,
      metalness: 0.05,
    });

    this.createStandard('road_arrow_left', {
      color: 0xffffff,
      map: arrowLeftTex || undefined,
      transparent: true,
      roughness: 0.4,
      metalness: 0.05,
    });

    this.createStandard('road_arrow_right', {
      color: 0xffffff,
      map: arrowRightTex || undefined,
      transparent: true,
      roughness: 0.4,
      metalness: 0.05,
    });

    this.createStandard('road_arrow_combo', {
      color: 0xffffff,
      map: arrowComboTex || undefined,
      transparent: true,
      roughness: 0.4,
      metalness: 0.05,
    });

    this.createStandard('highway_sign_gantry', {
      color: 0xffffff,
      map: gantrySignTex || undefined,
      roughness: 0.35,
      metalness: 0.25,
    });

    this.createStandard('speed_sign_50', {
      color: 0xffffff,
      map: speed50Tex || undefined,
      roughness: 0.35,
      metalness: 0.2,
    });

    this.createStandard('speed_sign_75', {
      color: 0xffffff,
      map: speed75Tex || undefined,
      roughness: 0.35,
      metalness: 0.2,
    });

    this.createStandard('speed_sign_110', {
      color: 0xffffff,
      map: speed110Tex || undefined,
      roughness: 0.35,
      metalness: 0.2,
    });

    // Street Furniture & Fixtures
    this.createStandard('street_bench_wood', {
      color: 0x78350f,
      roughness: 0.75,
      metalness: 0.05,
    });

    this.createStandard('trash_bin_metal', {
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.75,
    });

    this.createStandard('fire_hydrant_red', {
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.45,
    });

    this.createStandard('concrete_foundation', {
      color: palette.concrete,
      roughness: 0.88,
      metalness: 0.08,
    });

    // --- Environmental Props & Street Furniture ---
    this.createStandard('streetlight_post', {
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.85,
    });

    // Streetlight lamp head with dynamic emissive glow
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfffaed,
      emissive: new THREE.Color(0xffd599),
      emissiveIntensity: 0.0, // starts off during day
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('streetlight_lamp', lampMat);

    this.createStandard('safety_bollard_yellow', {
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.3,
    });

    this.createStandard('bollard_black_ring', {
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.1,
    });

    this.createStandard('fence_mesh', {
      color: 0x94a3b8,
      roughness: 0.4,
      metalness: 0.85,
      transparent: true,
      opacity: 0.7,
      wireframe: true,
    });

    this.createStandard('fence_post', {
      color: 0x64748b,
      roughness: 0.35,
      metalness: 0.9,
    });

    this.createStandard('pallet_wood', {
      color: 0xd4a373,
      roughness: 0.88,
      metalness: 0.02,
    });

    this.createStandard('drum_chemical_blue', {
      color: 0x0284c7,
      roughness: 0.38,
      metalness: 0.65,
    });

    this.createStandard('drum_hazard_red', {
      color: 0xdc2626,
      roughness: 0.38,
      metalness: 0.65,
    });

    this.createStandard('utility_transformer', {
      color: 0x365314,
      roughness: 0.55,
      metalness: 0.45,
    });

    this.createStandard('road_sign_pole', {
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.85,
    });

    this.createStandard('road_sign_face', {
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.2,
    });

    this.createStandard('storm_drain_grate', {
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.88,
    });

    this.createStandard('fire_hydrant_red', {
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.5,
    });

    this.createStandard('hedge_foliage', {
      color: 0x225e27,
      roughness: 0.82,
      metalness: 0.05,
    });

    // --- Industrial & Structural Materials ---
    this.createStandard('metal_structural', {
      color: palette.industrialSteel,
      roughness: 0.35,
      metalness: 0.85,
    });

    this.createStandard('metal_roof_silver', {
      color: 0x94a3b8,
      map: roofTex || undefined,
      roughness: 0.45,
      metalness: 0.65,
    });

    this.createStandard('metal_industrial_orange', {
      color: palette.industrialOrange,
      roughness: 0.45,
      metalness: 0.3,
    });

    this.createStandard('metal_cargo_blue', {
      color: palette.commercialBlue,
      roughness: 0.4,
      metalness: 0.45,
    });

    this.createStandard('commercial_accent', {
      color: 0x2563eb,
      roughness: 0.35,
      metalness: 0.3,
    });

    this.createStandard('logistics_yellow', {
      color: palette.logisticsYellow,
      roughness: 0.5,
      metalness: 0.2,
    });

    this.createStandard('glass_tinted_blue', {
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.9,
      transparent: true,
      opacity: 0.75,
    });

    // Detailed Industrial Assets Materials
    this.createStandard('metal_corrugated_siding', {
      color: 0x334155,
      map: claddingTex || undefined,
      roughness: 0.52,
      metalness: 0.45,
    });

    this.createStandard('metal_siding_light', {
      color: 0xe2e8f0,
      map: claddingTex || undefined,
      roughness: 0.42,
      metalness: 0.35,
    });

    this.createStandard('metal_container_green', {
      color: 0x15803d,
      map: claddingTex || undefined,
      roughness: 0.45,
      metalness: 0.35,
    });

    this.createStandard('metal_container_red', {
      color: 0xb91c1c,
      map: claddingTex || undefined,
      roughness: 0.45,
      metalness: 0.35,
    });

    this.createStandard('metal_container_orange', {
      color: 0xc2410c,
      map: claddingTex || undefined,
      roughness: 0.45,
      metalness: 0.35,
    });

    this.createStandard('metal_container_blue', {
      color: 0x0369a1,
      map: claddingTex || undefined,
      roughness: 0.45,
      metalness: 0.35,
    });

    this.createStandard('metal_solar_panel', {
      color: 0x0f172a,
      map: solarTex || undefined,
      roughness: 0.15,
      metalness: 0.85,
    });

    this.createStandard('door_rollup_shutter', {
      color: 0xe2e8f0,
      map: shutterTex || undefined,
      roughness: 0.38,
      metalness: 0.65,
    });

    this.createStandard('rubber_dock_seal', {
      color: 0x18181b,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.createStandard('dock_bumper_black', {
      color: 0x09090b,
      roughness: 0.85,
      metalness: 0.1,
    });

    this.createStandard('safety_yellow', {
      color: 0xfacc15,
      roughness: 0.5,
      metalness: 0.15,
    });

    this.createStandard('industrial_brick', {
      color: 0x991b1b,
      map: brickTex || undefined,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.createStandard('silo_aluminum', {
      color: 0xcfd8dc,
      map: claddingTex || undefined,
      roughness: 0.28,
      metalness: 0.92,
    });

    this.createStandard('roof_hvac_galvanized', {
      color: 0x94a3b8,
      roughness: 0.42,
      metalness: 0.7,
    });

    this.createStandard('pipe_process_yellow', {
      color: 0xeab308,
      roughness: 0.35,
      metalness: 0.3,
    });

    this.createStandard('pipe_coolant_blue', {
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.3,
    });

    this.createStandard('steel_truss_grey', {
      color: 0x64748b,
      roughness: 0.4,
      metalness: 0.85,
    });

    this.createStandard('skylight_glazing', {
      color: 0xbae6fd,
      roughness: 0.12,
      metalness: 0.92,
      transparent: true,
      opacity: 0.65,
    });

    // Foliage & Nature
    this.createStandard('tree_foliage_lush', {
      color: 0x3d7e35,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });

    this.createStandard('tree_foliage_dark', {
      color: 0x275924,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    this.createStandard('tree_foliage_light', {
      color: 0x56a642,
      roughness: 0.78,
      metalness: 0.05,
      flatShading: true,
    });

    this.createStandard('tree_bark', {
      color: 0x5c4033,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.createStandard('rock_granite', {
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
    });

    // Construction boundary markers
    this.createStandard('survey_marker', {
      color: palette.boundaryStake,
      roughness: 0.3,
      metalness: 0.6,
    });

    // --- Road Freight Vehicles & Shipping Containers Materials ---
    // Cab automotive paint finishes
    this.createStandard('truck_cab_paint_blue', {
      color: 0x1d4ed8, // Apex Sapphire Blue
      roughness: 0.28,
      metalness: 0.35,
    });

    this.createStandard('truck_cab_paint_red', {
      color: 0xdc2626, // Crimson Fleet
      roughness: 0.28,
      metalness: 0.35,
    });

    this.createStandard('truck_cab_paint_orange', {
      color: 0xea580c, // Industrial Logistics Orange
      roughness: 0.32,
      metalness: 0.3,
    });

    this.createStandard('truck_cab_paint_white', {
      color: 0xf8fafc, // Arctic Courier White
      roughness: 0.3,
      metalness: 0.2,
    });

    this.createStandard('truck_cab_paint_dark', {
      color: 0x1e293b, // Heavy Duty Charcoal
      roughness: 0.35,
      metalness: 0.45,
    });

    // Truck Chassis, Powertrain, Wheels & Glass
    this.createStandard('truck_chassis_steel', {
      color: 0x18181b,
      roughness: 0.58,
      metalness: 0.82,
    });

    this.createStandard('truck_tire_rubber', {
      color: 0x1f2024,
      map: tireTex || undefined,
      roughness: 0.86,
      metalness: 0.06,
    });

    this.createStandard('truck_wheel_chrome', {
      color: 0xf1f5f9,
      roughness: 0.16,
      metalness: 0.95,
    });

    this.createStandard('truck_wheel_hub', {
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.8,
    });

    this.createStandard('truck_glass_windshield', {
      color: 0x60a5fa,
      roughness: 0.08,
      metalness: 0.95,
      transparent: true,
      opacity: 0.55,
    });

    this.createStandard('truck_catwalk_diamond', {
      color: 0x94a3b8,
      map: catwalkTex || undefined,
      roughness: 0.32,
      metalness: 0.85,
    });

    this.createStandard('truck_grille_mesh', {
      color: 0x09090b,
      roughness: 0.65,
      metalness: 0.65,
    });

    this.createStandard('fifth_wheel_greased', {
      color: 0x111827,
      roughness: 0.38,
      metalness: 0.88,
    });

    // Modular Trailer Materials
    this.createStandard('trailer_chassis_dark', {
      color: 0x1c1917,
      roughness: 0.62,
      metalness: 0.78,
    });

    this.createStandard('trailer_conspicuity_tape', {
      color: 0xffffff,
      map: conspicuityTex || undefined,
      roughness: 0.22,
      metalness: 0.15,
    });

    this.createStandard('trailer_mudflap', {
      color: 0x0a0a0c,
      roughness: 0.92,
      metalness: 0.04,
    });

    // ISO Intermodal Shipping Containers
    this.createStandard('container_corrugated_blue', {
      color: 0xffffff,
      map: containerTexBlue || undefined,
      roughness: 0.44,
      metalness: 0.38,
    });

    this.createStandard('container_corrugated_red', {
      color: 0xffffff,
      map: containerTexRed || undefined,
      roughness: 0.44,
      metalness: 0.38,
    });

    this.createStandard('container_corrugated_orange', {
      color: 0xffffff,
      map: containerTexOrange || undefined,
      roughness: 0.44,
      metalness: 0.38,
    });

    this.createStandard('container_corrugated_green', {
      color: 0xffffff,
      map: containerTexGreen || undefined,
      roughness: 0.44,
      metalness: 0.38,
    });

    this.createStandard('container_corrugated_white', {
      color: 0xffffff,
      map: containerTexWhite || undefined,
      roughness: 0.44,
      metalness: 0.38,
    });

    this.createStandard('container_corner_casting', {
      color: 0x475569,
      roughness: 0.48,
      metalness: 0.88,
    });

    this.createStandard('container_door_hardware', {
      color: 0x94a3b8,
      roughness: 0.32,
      metalness: 0.92,
    });

    this.createStandard('reefer_chiller_unit', {
      color: 0xffffff,
      map: reeferTex || undefined,
      roughness: 0.35,
      metalness: 0.55,
    });

    // Vehicle Lighting Fixtures (Standard Materials with Emissive Properties)
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xfffaed),
      emissiveIntensity: 0.0,
      roughness: 0.15,
      metalness: 0.2,
    });
    this.materials.set('vehicle_headlight', headlightMat);

    const indicatorMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.0,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('vehicle_indicator', indicatorMat);

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 0.15,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('vehicle_brake_light', brakeMat);

    const reverseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.0,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('vehicle_reverse_light', reverseMat);

    const markerAmberMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('vehicle_marker_amber', markerAmberMat);

    const markerRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.materials.set('vehicle_marker_red', markerRedMat);

    // Interactive Selection Effects
    const selectionRingMat = new THREE.MeshBasicMaterial({
      color: palette.selectionRing,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materials.set('selection_ring', selectionRingMat);

    const selectionGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materials.set('selection_glow', selectionGlowMat);

    // Road Construction Preview & Demolition Materials
    this.materials.set(
      'road_preview_valid',
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );

    this.materials.set(
      'road_preview_invalid',
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );

    this.materials.set(
      'road_demolish_highlight',
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );

    // Fleet Depot Active Status Indicator & Contact Shadows
    this.createStandard('depot_active_indicator', {
      color: 0x10b981,
      emissive: new THREE.Color(0x10b981),
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.materials.set(
      'building_contact_shadow',
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
  }

  private fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    roughness: 0.5,
    metalness: 0.0,
  });

  public setStreetlightsEmissive(intensity: number): void {
    const lamp = this.materials.get('streetlight_lamp');
    if (lamp && lamp instanceof THREE.MeshStandardMaterial) {
      lamp.emissiveIntensity = intensity;
    }
  }

  public createStandard(
    name: string,
    params: THREE.MeshStandardMaterialParameters
  ): THREE.MeshStandardMaterial {
    const cleanParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        cleanParams[k] = v;
      }
    }
    const mat = new THREE.MeshStandardMaterial(cleanParams as THREE.MeshStandardMaterialParameters);
    this.materials.set(name, mat);
    return mat;
  }

  public has(name: string): boolean {
    return this.materials.has(name);
  }

  public getAllMaterialNames(): string[] {
    return Array.from(this.materials.keys());
  }

  public get<T extends THREE.Material = THREE.MeshStandardMaterial>(name: string): T {
    const mat = this.materials.get(name);
    if (!mat) {
      console.warn(`[MaterialsManager] Material '${name}' not found, falling back to diagnostic material.`);
      return this.fallbackMaterial as unknown as T;
    }
    return mat as T;
  }

  public dispose(): void {
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();
    this.fallbackMaterial.dispose();

    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures = [];
  }
}
