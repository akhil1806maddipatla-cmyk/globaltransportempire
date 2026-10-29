import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { MaterialsManager } from '../rendering/MaterialsManager';
import { ConstructionPlot, InitialTreeInstance } from '../data/initialWorldData';
import { TerrainModel } from './TerrainModel';

/**
 * High-Scale Continental Terrain & Natural Waterways Generator
 * Global Transport Empire — Architectural World Redesign
 *
 * Implements a massive, organic continental landmass (240m+ width, ~50,000m² dry land),
 * an irregular natural coastline, expansive ocean, prominent winding river system,
 * highland mountain ranges, inland Lake Serene, offshore islands, and seamlessly
 * integrated industrial infrastructure.
 */
export class TerrainGenerator implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;
  private materialsManager: MaterialsManager;
  private gridHelper: THREE.GridHelper | null = null;
  private tacticalTilesGroup: THREE.Group | null = null;
  private seed: number;
  private waterAnimationTime: number = 0;
  private lighthouseLight: THREE.PointLight | null = null;

  constructor(gridSystem: GridSystem, materialsManager: MaterialsManager, seed: number = 42) {
    this.gridSystem = gridSystem;
    this.materialsManager = materialsManager;
    this.seed = seed;
    this.group = new THREE.Group();
    this.group.name = 'terrain_group';
  }

  /**
   * Deterministic Linear Congruential PRNG
   */
  private createPRNG(seedOffset: number = 0): () => number {
    let s = (this.seed + seedOffset) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  public generate(): void {
    const { width: worldW, depth: worldD } = this.gridSystem.getWorldDimensions();

    // 1. Massive Continental Terrain Landmass (Continuous organic mesh, mountains, foothills, valleys)
    this.buildContinentalTerrain();

    // 2. Vast Natural Ocean Surface Plane & Seabed Shelf
    this.buildContinentalOcean();

    // 3. Prominent Winding River System (Highland origin, meanders, riverbed, embankments)
    this.buildWindingRiverSystem();

    // 4. Inland Highland Lake Serene & Pine Crest Island
    this.buildLakeSerene();

    // 5. Offshore Marine Islands (Pelican Isle & Lighthouse Rock)
    this.buildOffshoreIslands();

    // 6. Civil Stormwater Retention Pond (Southeast eco-drainage basin)
    this.buildRetentionPond();

    // 7. Eastern Maritime Deepwater Seaway & Port Berthing Basin (Quay wall, bollards, buoys)
    this.buildCoastalDeepwaterFairway();

    // 8. Architectural Bridge Crossing Infrastructure
    this.buildBridgeCrossings();

    // 9. Subtle Tactical Grid Tiles across developed industrial valley
    this.buildTacticalTiles();

    // 10. Paved Concrete Aprons & Industrial Yard Pads around Initial Facilities
    this.buildIndustrialAprons();

    // 11. Reserved Transport Corridors (Heavy Rail right-of-way and Port access)
    this.buildTransportCorridorReserves();

    // 12. Tactical Infrastructure Grid Overlay (unobtrusive during passive gameplay, enabled during active construction)
    const centerX = this.gridSystem.originX + worldW / 2;
    const centerZ = this.gridSystem.originZ + worldD / 2;
    this.gridHelper = new THREE.GridHelper(
      worldW,
      this.gridSystem.width,
      0x4a7c44, // Primary grid lines
      0x3d6938  // Secondary grid lines
    );
    this.gridHelper.name = 'world_grid_helper';
    this.gridHelper.position.set(centerX, 0.012, centerZ);
    this.gridHelper.visible = false; // Hidden during passive gameplay; activated during construction
    this.group.add(this.gridHelper);
  }

  /**
   * Evaluates the natural eastern continental coastline X position for a given Z coordinate.
   * Features Headlands, Grand Harbor Bay, South Cape, and Estuary Mouth.
   */
  public static getCoastlineX(z: number): number {
    // Grand Harbor sheltered bay indent between Z = -15m and +35m
    if (z >= -15.0 && z <= 35.0) {
      // Natural curved bay pocket hugging the port quay at X=42
      const t = (z - 10.0) / 25.0;
      return 43.5 + t * t * 10.0;
    }
    // North Headland / Cape Meridian (bluff extending east at Z = -65m)
    if (z < -15.0) {
      const headlandFactor = Math.sin((z + 15.0) * 0.04);
      return 53.5 + headlandFactor * 10.5;
    }
    // South Cape & Estuary Delta (Z > 35m)
    const southFactor = Math.cos((z - 35.0) * 0.04);
    return 52.0 + southFactor * 7.0;
  }

  /**
   * Sculpted continental landmass mesh (460m x 460m) covering the expanded regional continent.
   */
  private buildContinentalTerrain(): void {
    const continentSize = 460;
    const segs = 115; // 4.0m resolution
    const terrainGeo = new THREE.PlaneGeometry(continentSize, continentSize, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Local coordinates on the mesh placed at center (64, 0, 64)
      const wx = pos.getX(i) + 64.0;
      const wz = pos.getZ(i) + 64.0;

      let elev = 0.0;

      // 1. Expanded Continental Logistics & Industrial Plain (-48m to +174m X, -48m to +176m Z)
      if (wx >= -48.0 && wx <= 174.0 && wz >= -48.0 && wz <= 176.0) {
        // Flat alluvial plain at datum
        elev = TerrainModel.DATUM_ELEVATION;
      }
      // 2. Northern Mountain Range (Z < -48m)
      else if (wz < -48.0 && wx < 185.0) {
        const northDist = -wz - 48.0;
        // Check if inside Lake Serene basin
        const dLake = Math.hypot(wx - -15.0, (wz - -80.0) * 1.3);
        if (dLake < 22.0) {
          if (dLake <= 4.0) {
            // Pine Crest Island
            elev = 0.20;
          } else {
            // Lake Serene bed
            elev = -0.85;
          }
        } else {
          const ridgeNoise = Math.sin(wx * 0.05) * 2.2 + Math.cos(wz * 0.04) * 1.8;
          elev = (northDist / 60.0) * 4.2 + ridgeNoise;
          if (elev < 0.2) elev = 0.2;
        }
      }
      // 3. Western Foothills & Mountain Pass (X < -48m)
      else if (wx < -48.0) {
        const westDist = -wx - 48.0;
        const hillNoise = Math.sin(wz * 0.05) * 1.4 + Math.cos(wx * 0.045) * 1.1;
        elev = (westDist / 60.0) * 3.2 + hillNoise;
        if (elev < 0.15) elev = 0.15;
      }
      // 4. Southern Delta & Wetlands (Z > 176m)
      else if (wz > 176.0 && wx < 180.0) {
        const southDist = wz - 176.0;
        const marshNoise = Math.sin(wx * 0.06) * 0.2;
        elev = Math.max(-0.05, (southDist / 70.0) * -0.05 + marshNoise);
      }
      // 5. Eastern Continental Coastline & Seabed Drop-off (beyond X = 174m)
      else {
        const coastX = 180.0 + Math.sin(wz * 0.04) * 8.0;
        if (wx < coastX) {
          // Coastal land slope
          const distToWater = coastX - wx;
          elev = Math.min(1.2, distToWater * 0.08);
        } else {
          // Submerged seabed shelf sloping to -3.5m
          const distSeaward = wx - coastX;
          elev = Math.max(-3.5, -0.2 - distSeaward * 0.25);
        }
      }

      pos.setY(i, elev);
    }

    terrainGeo.computeVertexNormals();

    const continentMesh = new THREE.Mesh(terrainGeo, this.materialsManager.get('ground_grass_primary'));
    continentMesh.name = 'continental_landmass';
    continentMesh.position.set(64, 0, 64);
    continentMesh.receiveShadow = true;
    this.group.add(continentMesh);
  }

  /**
   * Vast ocean plane (450m x 600m) extending seamlessly to the seaward horizon.
   */
  private buildContinentalOcean(): void {
    const oceanGroup = new THREE.Group();
    oceanGroup.name = 'continental_ocean_system';

    // Deep oceanic seabed plane at Y = -3.5m
    const seabedGeo = new THREE.PlaneGeometry(450, 600);
    seabedGeo.rotateX(-Math.PI / 2);
    const seabed = new THREE.Mesh(seabedGeo, this.materialsManager.get('riverbed_silt'));
    seabed.position.set(270, -3.5, 64);
    seabed.receiveShadow = true;
    oceanGroup.add(seabed);

    // Oceanic Water Surface at Y = -0.15m
    const oceanGeo = new THREE.PlaneGeometry(450, 620);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = this.materialsManager.get('coastal_deep_water') || this.materialsManager.get('pond_water');
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(270, TerrainModel.WATER_SURFACE_ELEVATION, 64);
    oceanMesh.receiveShadow = true;
    oceanGroup.add(oceanMesh);

    // Natural Shoreline Sand Transitions along the coastal margin
    const sandBandGeo = new THREE.PlaneGeometry(16, 500);
    sandBandGeo.rotateX(-Math.PI / 2);
    const sandMesh = new THREE.Mesh(sandBandGeo, this.materialsManager.get('shoreline_sand'));
    sandMesh.position.set(182.0, -0.12, 64);
    sandMesh.receiveShadow = true;
    oceanGroup.add(sandMesh);

    this.group.add(oceanGroup);
  }

  /**
   * Prominent Winding River System cutting naturally across the continent.
   * Flows from Northern Mountain Springs, through the Northwest Corridor,
   * winding past the central valley to the Southern Ocean Estuary.
   */
  private buildWindingRiverSystem(): void {
    const riverGroup = new THREE.Group();
    riverGroup.name = 'winding_river_system';
    const prng = this.createPRNG(101);

    // Centerline waypoints defining natural meandering river path
    const riverWaypoints: { x: number; z: number; width: number }[] = [
      { x: -35.0, z: -115.0, width: 6.0 }, // Mountain springs
      { x: -38.0, z: -90.0, width: 7.0 },  // Highland valley
      { x: -44.0, z: -48.0, width: 8.0 },  // Northwest entrance
      { x: -44.0, z: -42.0, width: 8.0 },  // Under Northern Bridge & Island
      { x: -44.0, z: -36.0, width: 8.0 },  // Lower bridge sector
      { x: -40.0, z: -20.0, width: 9.0 },  // Valley meander
      { x: -34.0, z: 0.0, width: 10.0 },   // Central western bend
      { x: -28.0, z: 22.0, width: 10.5 },  // Southwest bend
      { x: -14.0, z: 45.0, width: 12.0 },  // Southern bend
      { x: 12.0, z: 65.0, width: 14.0 },   // Estuary approach
      { x: 38.0, z: 75.0, width: 17.0 },   // Estuary delta
      { x: 58.0, z: 80.0, width: 22.0 },   // Ocean mouth
    ];

    // Build contiguous river water surface strips connecting waypoints
    const riverWaterMat = this.materialsManager.get('river_water') || this.materialsManager.get('pond_water');
    const riverbedMat = this.materialsManager.get('riverbed_silt');
    const sandMat = this.materialsManager.get('shoreline_sand');

    for (let i = 0; i < riverWaypoints.length - 1; i++) {
      const p1 = riverWaypoints[i];
      const p2 = riverWaypoints[i + 1];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLength = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      const avgWidth = (p1.width + p2.width) / 2;
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;

      // 1. Excavated riverbed plate (Y = -0.45m)
      const bedGeo = new THREE.PlaneGeometry(segLength + 0.5, avgWidth + 1.2);
      bedGeo.rotateX(-Math.PI / 2);
      const bedMesh = new THREE.Mesh(bedGeo, riverbedMat);
      bedMesh.position.set(midX, TerrainModel.WATER_BED_ELEVATION, midZ);
      bedMesh.rotation.y = -angle;
      bedMesh.receiveShadow = true;
      riverGroup.add(bedMesh);

      // 2. Recessed Water Surface Plane (strictly at Y = -0.15m)
      const waterGeo = new THREE.PlaneGeometry(segLength + 0.3, avgWidth);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMesh = new THREE.Mesh(waterGeo, riverWaterMat);
      waterMesh.position.set(midX, TerrainModel.WATER_SURFACE_ELEVATION, midZ);
      waterMesh.rotation.y = -angle;
      waterMesh.receiveShadow = true;
      riverGroup.add(waterMesh);

      // 3. Sandy riverbank transitions
      const bankGeo = new THREE.PlaneGeometry(segLength, 0.8);
      bankGeo.rotateX(-Math.PI / 2);

      const bankLeft = new THREE.Mesh(bankGeo, sandMat);
      const perpX = -Math.sin(angle) * (avgWidth / 2 + 0.4);
      const perpZ = Math.cos(angle) * (avgWidth / 2 + 0.4);
      bankLeft.position.set(midX + perpX, -0.13, midZ + perpZ);
      bankLeft.rotation.y = -angle;
      bankLeft.receiveShadow = true;
      riverGroup.add(bankLeft);

      const bankRight = new THREE.Mesh(bankGeo, sandMat);
      bankRight.position.set(midX - perpX, -0.13, midZ - perpZ);
      bankRight.rotation.y = -angle;
      bankRight.receiveShadow = true;
      riverGroup.add(bankRight);
    }

    // Natural Scenic River Island at cell (1, 1) -> center (-42.0, -42.0)
    const islandGroup = new THREE.Group();
    islandGroup.name = 'river_island_reserve';

    const islandGeo = new THREE.CylinderGeometry(1.4, 1.7, 0.28, 12);
    const islandMesh = new THREE.Mesh(islandGeo, this.materialsManager.get('ground_grass_primary'));
    islandMesh.position.set(-42.0, -0.01, -42.0);
    islandMesh.receiveShadow = true;
    islandGroup.add(islandMesh);

    const beachGeo = new THREE.RingGeometry(1.4, 1.85, 12);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMesh = new THREE.Mesh(beachGeo, this.materialsManager.get('shoreline_sand'));
    beachMesh.position.set(-42.0, TerrainModel.WATER_SURFACE_ELEVATION + 0.01, -42.0);
    beachMesh.receiveShadow = true;
    islandGroup.add(beachMesh);

    // Conifer tree on island
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.0, 6);
    const trunk = new THREE.Mesh(trunkGeo, this.materialsManager.get('tree_bark'));
    trunk.position.set(-42.0, 1.0, -42.0);
    trunk.castShadow = true;
    islandGroup.add(trunk);

    const canopyGeo = new THREE.ConeGeometry(1.6, 3.0, 7);
    const canopy = new THREE.Mesh(canopyGeo, this.materialsManager.get('tree_foliage_lush'));
    canopy.position.set(-42.0, 3.0, -42.0);
    canopy.castShadow = true;
    islandGroup.add(canopy);

    // River rocks along the island waterline
    const rockMat = this.materialsManager.get('embankment_rock');
    const rockGeo = new THREE.DodecahedronGeometry(0.3, 0);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (prng() - 0.5) * 0.4;
      const dist = 1.6 + (prng() - 0.5) * 0.2;
      const rx = -42.0 + Math.cos(angle) * dist;
      const rz = -42.0 + Math.sin(angle) * dist;

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, -0.05, rz);
      rock.rotation.set(prng() * Math.PI, prng() * Math.PI, 0);
      rock.scale.set(0.7 + prng() * 0.4, 0.5 + prng() * 0.3, 0.7 + prng() * 0.4);
      rock.castShadow = true;
      rock.receiveShadow = true;
      islandGroup.add(rock);
    }
    riverGroup.add(islandGroup);

    // 5. Western Foothills Tributary Stream & River Confluence
    const tributaryPoints: { x: number; z: number }[] = [
      { x: -70.0, z: -15.0 }, // Foothill headwaters
      { x: -55.0, z: -10.0 }, // Mid-valley run
      { x: -38.0, z: -5.0 },  // Confluence with main river
    ];

    for (let i = 0; i < tributaryPoints.length - 1; i++) {
      const t1 = tributaryPoints[i];
      const t2 = tributaryPoints[i + 1];
      const tdx = t2.x - t1.x;
      const tdz = t2.z - t1.z;
      const tLen = Math.hypot(tdx, tdz);
      const tAngle = Math.atan2(tdz, tdx);
      const tMidX = (t1.x + t2.x) / 2;
      const tMidZ = (t1.z + t2.z) / 2;
      const tWidth = 4.5;

      const tBedGeo = new THREE.PlaneGeometry(tLen + 0.4, tWidth + 0.8);
      tBedGeo.rotateX(-Math.PI / 2);
      const tBedMesh = new THREE.Mesh(tBedGeo, riverbedMat);
      tBedMesh.position.set(tMidX, TerrainModel.WATER_BED_ELEVATION + 0.1, tMidZ);
      tBedMesh.rotation.y = -tAngle;
      tBedMesh.receiveShadow = true;
      riverGroup.add(tBedMesh);

      const tWaterGeo = new THREE.PlaneGeometry(tLen + 0.2, tWidth);
      tWaterGeo.rotateX(-Math.PI / 2);
      const tWaterMesh = new THREE.Mesh(tWaterGeo, riverWaterMat);
      tWaterMesh.position.set(tMidX, TerrainModel.WATER_SURFACE_ELEVATION, tMidZ);
      tWaterMesh.rotation.y = -tAngle;
      tWaterMesh.receiveShadow = true;
      riverGroup.add(tWaterMesh);
    }

    this.group.add(riverGroup);
  }

  /**
   * Inland Mountain Lake Serene & Pine Crest Island in northern highlands.
   */
  private buildLakeSerene(): void {
    const lakeGroup = new THREE.Group();
    lakeGroup.name = 'inland_lake_serene';
    const lakeX = -15.0;
    const lakeZ = -80.0;

    // 1. Lake water surface (36m x 24m oval) at strictly Y = -0.15m
    const lakeGeo = new THREE.RingGeometry(4.0, 18.0, 24);
    lakeGeo.rotateX(-Math.PI / 2);
    const lakeWaterMat = this.materialsManager.get('pond_water') || this.materialsManager.get('river_water');
    const lakeMesh = new THREE.Mesh(lakeGeo, lakeWaterMat);
    lakeMesh.position.set(lakeX, TerrainModel.WATER_SURFACE_ELEVATION, lakeZ);
    lakeMesh.scale.set(1.0, 1.0, 0.75);
    lakeMesh.receiveShadow = true;
    lakeGroup.add(lakeMesh);

    // 2. Lakebed plate at Y = -0.85m
    const bedGeo = new THREE.CircleGeometry(18.0, 20);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMesh = new THREE.Mesh(bedGeo, this.materialsManager.get('riverbed_silt'));
    bedMesh.position.set(lakeX, -0.85, lakeZ);
    bedMesh.scale.set(1.0, 1.0, 0.75);
    bedMesh.receiveShadow = true;
    lakeGroup.add(bedMesh);

    // 3. Pine Crest Island at lake center (dry knoll at +0.20m)
    const islandGeo = new THREE.CylinderGeometry(3.2, 4.0, 0.4, 16);
    const island = new THREE.Mesh(islandGeo, this.materialsManager.get('ground_grass_primary'));
    island.position.set(lakeX, 0.05, lakeZ);
    island.receiveShadow = true;
    lakeGroup.add(island);

    // Beach ring around lake island
    const beachGeo = new THREE.RingGeometry(3.0, 4.2, 16);
    beachGeo.rotateX(-Math.PI / 2);
    const beach = new THREE.Mesh(beachGeo, this.materialsManager.get('shoreline_sand'));
    beach.position.set(lakeX, TerrainModel.WATER_SURFACE_ELEVATION + 0.01, lakeZ);
    beach.receiveShadow = true;
    lakeGroup.add(beach);

    // Pines on lake island
    const p1 = this.createScenicPine(lakeX - 1.0, 0.25, lakeZ - 0.5, 1.1);
    const p2 = this.createScenicPine(lakeX + 1.2, 0.25, lakeZ + 0.8, 0.9);
    lakeGroup.add(p1);
    lakeGroup.add(p2);

    this.group.add(lakeGroup);
  }

  /**
   * Offshore Marine Islands: Pelican Isle and Lighthouse Rock.
   */
  private buildOffshoreIslands(): void {
    const islandsGroup = new THREE.Group();
    islandsGroup.name = 'offshore_islands';

    // 1. Pelican Isle (X = 85.0m, Z = 12.0m) - Sandy beach dunes and coastal pines
    const pelicanGroup = new THREE.Group();
    pelicanGroup.position.set(85.0, 0, 12.0);

    const pDuneGeo = new THREE.CylinderGeometry(5.0, 7.5, 0.4, 16);
    const pDune = new THREE.Mesh(pDuneGeo, this.materialsManager.get('ground_grass_primary'));
    pDune.position.y = 0.05;
    pDune.receiveShadow = true;
    pelicanGroup.add(pDune);

    const pBeachGeo = new THREE.RingGeometry(5.0, 8.5, 16);
    pBeachGeo.rotateX(-Math.PI / 2);
    const pBeach = new THREE.Mesh(pBeachGeo, this.materialsManager.get('shoreline_sand'));
    pBeach.position.y = TerrainModel.WATER_SURFACE_ELEVATION + 0.01;
    pBeach.receiveShadow = true;
    pelicanGroup.add(pBeach);

    const pTree1 = this.createScenicPine(83.5, 0.25, 11.0, 1.15);
    const pTree2 = this.createScenicPine(86.2, 0.25, 13.0, 0.95);
    pelicanGroup.add(pTree1);
    pelicanGroup.add(pTree2);
    islandsGroup.add(pelicanGroup);

    // 2. Lighthouse Rock (X = 78.0m, Z = -45.0m) - Rugged granite islet with navigation tower
    const lhGroup = new THREE.Group();
    lhGroup.position.set(78.0, 0, -45.0);

    const rockBaseGeo = new THREE.CylinderGeometry(3.5, 5.0, 0.8, 8);
    const rockBase = new THREE.Mesh(rockBaseGeo, this.materialsManager.get('retaining_wall_concrete'));
    rockBase.position.y = 0.25;
    rockBase.castShadow = true;
    rockBase.receiveShadow = true;
    lhGroup.add(rockBase);

    // Octagonal Navigation Lighthouse Tower
    const towerGeo = new THREE.CylinderGeometry(0.9, 1.3, 4.5, 8);
    const tower = new THREE.Mesh(towerGeo, this.materialsManager.get('concrete_curb'));
    tower.position.y = 0.65 + 2.25;
    tower.castShadow = true;
    lhGroup.add(tower);

    // Lantern gallery & dome
    const galleryGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 8);
    const gallery = new THREE.Mesh(galleryGeo, this.materialsManager.get('metal_industrial_orange'));
    gallery.position.y = 0.65 + 4.5 + 0.1;
    lhGroup.add(gallery);

    const lanternGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const lanternMat = this.materialsManager.get('buoy_light_green') || this.materialsManager.get('metal_industrial_orange');
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.y = 0.65 + 4.5 + 0.5;
    lhGroup.add(lantern);

    // Marine point light for navigation warning
    this.lighthouseLight = new THREE.PointLight(0xfef08a, 1.5, 50);
    this.lighthouseLight.position.set(78.0, 5.8, -45.0);
    this.group.add(this.lighthouseLight);

    islandsGroup.add(lhGroup);
    this.group.add(islandsGroup);
  }

  private createScenicPine(x: number, y: number, z: number, scale: number): THREE.Group {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6),
      this.materialsManager.get('tree_bark')
    );
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    tree.add(trunk);

    const c1 = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 2.2, 7),
      this.materialsManager.get('tree_foliage_dark')
    );
    c1.position.y = 2.0;
    c1.castShadow = true;
    tree.add(c1);

    const c2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 1.8, 7),
      this.materialsManager.get('tree_foliage_lush')
    );
    c2.position.y = 3.1;
    c2.castShadow = true;
    tree.add(c2);

    return tree;
  }

  /**
   * Civil Stormwater Retention Pond in southeast corner of the park.
   * Recessed water surface strictly below surrounding land.
   */
  private buildRetentionPond(): void {
    const pondGroup = new THREE.Group();
    pondGroup.name = 'stormwater_retention_pond';
    const prng = this.createPRNG(202);

    // Positioned at grid cells X=20..22, Z=18..20
    const c1 = this.gridSystem.gridToWorldCenter(21, 19);
    const pondRadius = 2.8;

    // 1. Excavated basin depression bottom
    const basinBottomGeo = new THREE.CircleGeometry(pondRadius - 0.2, 16);
    basinBottomGeo.rotateX(-Math.PI / 2);
    const basinBottom = new THREE.Mesh(basinBottomGeo, this.materialsManager.get('riverbed_silt'));
    basinBottom.position.set(c1.x, TerrainModel.WATER_BED_ELEVATION, c1.z);
    basinBottom.receiveShadow = true;
    pondGroup.add(basinBottom);

    // 2. Excavated basin depression rim ring (sloped gravel shoulder down to water)
    const basinGeo = new THREE.RingGeometry(pondRadius - 0.2, pondRadius + 0.9, 16);
    basinGeo.rotateX(-Math.PI / 2);
    const basinMesh = new THREE.Mesh(basinGeo, this.materialsManager.get('gravel_shoulder'));
    basinMesh.position.set(c1.x, 0.015, c1.z);
    basinMesh.receiveShadow = true;
    pondGroup.add(basinMesh);

    // 3. Recessed Translucent water surface strictly at Y = -0.15m
    const waterGeo = new THREE.CircleGeometry(pondRadius, 20);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(waterGeo, this.materialsManager.get('pond_water'));
    waterMesh.position.set(c1.x, TerrainModel.WATER_SURFACE_ELEVATION, c1.z);
    waterMesh.receiveShadow = true;
    pondGroup.add(waterMesh);

    // 4. Embankment rocks around water edge placed deterministically
    const rockMat = this.materialsManager.get('embankment_rock');
    const rockGeo = new THREE.DodecahedronGeometry(0.35, 0);

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + (prng() - 0.5) * 0.3;
      const dist = pondRadius + (prng() - 0.5) * 0.3;
      const rx = c1.x + Math.cos(angle) * dist;
      const rz = c1.z + Math.sin(angle) * dist;

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, 0.05, rz);
      rock.rotation.set(prng() * Math.PI, prng() * Math.PI, 0);
      rock.scale.set(0.7 + prng() * 0.5, 0.5 + prng() * 0.4, 0.7 + prng() * 0.5);
      rock.castShadow = true;
      rock.receiveShadow = true;
      pondGroup.add(rock);
    }

    this.group.add(pondGroup);
  }

  /**
   * Eastern Maritime Deepwater Seaway, Port Berthing Basin & Navigational Fairway.
   * Includes deepwater dredged basin (depth 3.35m), concrete quay wall with coping,
   * mooring bollards, dock fenders, and IALA navigational fairway buoys.
   */
  private buildCoastalDeepwaterFairway(): void {
    const coastalGroup = new THREE.Group();
    coastalGroup.name = 'coastal_deepwater_fairway';

    // 1. Dredged Maritime Seafloor (at Y = -3.5m)
    const seabedGeo = new THREE.PlaneGeometry(16.0, 32.0);
    seabedGeo.rotateX(-Math.PI / 2);
    const seabedMesh = new THREE.Mesh(seabedGeo, this.materialsManager.get('riverbed_silt'));
    seabedMesh.position.set(49.0, -3.5, 16.0);
    seabedMesh.receiveShadow = true;
    coastalGroup.add(seabedMesh);

    // 2. Deepwater Ocean Water Surface Plane (strictly at Y = -0.15m)
    const waterGeo = new THREE.PlaneGeometry(15.5, 31.5);
    waterGeo.rotateX(-Math.PI / 2);
    const coastalWaterMat = this.materialsManager.get('coastal_deep_water') || this.materialsManager.get('pond_water');
    const waterMesh = new THREE.Mesh(waterGeo, coastalWaterMat);
    waterMesh.position.set(49.0, TerrainModel.WATER_SURFACE_ELEVATION, 16.0);
    waterMesh.receiveShadow = true;
    coastalGroup.add(waterMesh);

    // 3. Heavy Industrial Concrete Quay Wall along port wharf frontage (worldX = 42.0m, worldZ = 12.0m to 20.0m)
    const quayThickness = 0.8;
    const quayHeight = 3.52; // from -3.5m up to +0.02m
    const quayLength = 16.0; // 4 grid cells
    const quayGeo = new THREE.BoxGeometry(quayThickness, quayHeight, quayLength);
    const quayMat = this.materialsManager.get('quay_wall_concrete') || this.materialsManager.get('retaining_wall_concrete');
    const quayMesh = new THREE.Mesh(quayGeo, quayMat);
    quayMesh.position.set(42.0, (-3.5 + 0.02) / 2, 16.0);
    quayMesh.receiveShadow = true;
    quayMesh.castShadow = true;
    coastalGroup.add(quayMesh);

    // Bullnose concrete coping along the top of the quay wall
    const copingGeo = new THREE.BoxGeometry(0.3, 0.12, quayLength);
    const copingMesh = new THREE.Mesh(copingGeo, this.materialsManager.get('concrete_curb'));
    copingMesh.position.set(42.3, 0.02 + 0.06, 16.0);
    coastalGroup.add(copingMesh);

    // 4. Mooring Bollards (Cast steel bitts at 4m spacing)
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 8);
    const bollardCapGeo = new THREE.SphereGeometry(0.18, 8, 4);
    const bollardMat = this.materialsManager.get('marine_bollard_steel');

    const bollardZCoords = [13.5, 14.5, 15.5, 16.5, 18.0];
    for (const bz of bollardZCoords) {
      const bGroup = new THREE.Group();
      bGroup.position.set(42.15, 0.02, bz);

      const shaft = new THREE.Mesh(bollardGeo, bollardMat);
      shaft.position.y = 0.22;
      shaft.castShadow = true;
      bGroup.add(shaft);

      const cap = new THREE.Mesh(bollardCapGeo, bollardMat);
      cap.position.y = 0.42;
      cap.scale.set(1.1, 0.5, 1.1);
      bGroup.add(cap);

      coastalGroup.add(bGroup);
    }

    // 5. Dock Fenders (Arch rubber fenders mounted on seaward quay face)
    const fenderGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8);
    const fenderMat = this.materialsManager.get('marine_fender_rubber');
    for (const fz of [13.8, 14.8, 15.8, 17.0]) {
      const fender = new THREE.Mesh(fenderGeo, fenderMat);
      fender.rotation.x = Math.PI / 2;
      fender.position.set(42.45, -0.05, fz);
      coastalGroup.add(fender);
    }

    // 6. Navigational Fairway Channel Buoys (IALA conforming: green starboard, red port)
    const buoyHullGeo = new THREE.ConeGeometry(0.45, 1.2, 8);
    const buoyLightGeo = new THREE.SphereGeometry(0.12, 6, 6);

    // Green starboard buoy (south entrance)
    const buoySb1 = new THREE.Group();
    buoySb1.position.set(48.0, TerrainModel.WATER_SURFACE_ELEVATION + 0.45, 24.0);
    const sb1Hull = new THREE.Mesh(buoyHullGeo, this.materialsManager.get('buoy_green_starboard'));
    sb1Hull.castShadow = true;
    buoySb1.add(sb1Hull);
    const sb1Light = new THREE.Mesh(buoyLightGeo, this.materialsManager.get('buoy_light_green'));
    sb1Light.position.y = 0.65;
    buoySb1.add(sb1Light);
    coastalGroup.add(buoySb1);

    // Red port buoy (south entrance)
    const buoyPt1 = new THREE.Group();
    buoyPt1.position.set(43.5, TerrainModel.WATER_SURFACE_ELEVATION + 0.45, 24.0);
    const pt1Hull = new THREE.Mesh(buoyHullGeo, this.materialsManager.get('buoy_red_port'));
    pt1Hull.castShadow = true;
    buoyPt1.add(pt1Hull);
    const pt1Light = new THREE.Mesh(buoyLightGeo, this.materialsManager.get('buoy_light_red'));
    pt1Light.position.y = 0.65;
    buoyPt1.add(pt1Light);
    coastalGroup.add(buoyPt1);

    // Green starboard buoy (north seaway)
    const buoySb2 = new THREE.Group();
    buoySb2.position.set(48.0, TerrainModel.WATER_SURFACE_ELEVATION + 0.45, 8.0);
    const sb2Hull = new THREE.Mesh(buoyHullGeo, this.materialsManager.get('buoy_green_starboard'));
    sb2Hull.castShadow = true;
    buoySb2.add(sb2Hull);
    const sb2Light = new THREE.Mesh(buoyLightGeo, this.materialsManager.get('buoy_light_green'));
    sb2Light.position.y = 0.65;
    buoySb2.add(sb2Light);
    coastalGroup.add(buoySb2);

    // Red port buoy (north seaway)
    const buoyPt2 = new THREE.Group();
    buoyPt2.position.set(43.5, TerrainModel.WATER_SURFACE_ELEVATION + 0.45, 8.0);
    const pt2Hull = new THREE.Mesh(buoyHullGeo, this.materialsManager.get('buoy_red_port'));
    pt2Hull.castShadow = true;
    buoyPt2.add(pt2Hull);
    const pt2Light = new THREE.Mesh(buoyLightGeo, this.materialsManager.get('buoy_light_red'));
    pt2Light.position.y = 0.65;
    buoyPt2.add(pt2Light);
    coastalGroup.add(buoyPt2);

    this.group.add(coastalGroup);
  }

  /**
   * Architectural Bridge Crossing over Northern Mountain River.
   * Guarantees vertical clearance >= 0.65m above high water datum (-0.15m).
   */
  private buildBridgeCrossings(): void {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'bridge_crossings';

    const deckLength = 8.0;
    const deckWidth = 3.6;
    const deckThickness = 0.25;
    const deckElevation = 0.80;

    // Concrete pier footings in river channel
    const pierGeo = new THREE.BoxGeometry(0.8, 1.15, 0.8);
    const pierMat = this.materialsManager.get('bridge_pier_concrete');

    const pier1 = new THREE.Mesh(pierGeo, pierMat);
    pier1.position.set(-44.0, (0.55 + -0.45) / 2, -45.0);
    pier1.castShadow = true;
    pier1.receiveShadow = true;
    bridgeGroup.add(pier1);

    const pier2 = new THREE.Mesh(pierGeo, pierMat);
    pier2.position.set(-44.0, (0.55 + -0.45) / 2, -39.0);
    pier2.castShadow = true;
    pier2.receiveShadow = true;
    bridgeGroup.add(pier2);

    // Bridge deck girder slab
    const deckGeo = new THREE.BoxGeometry(deckWidth, deckThickness, deckLength);
    const deckMesh = new THREE.Mesh(deckGeo, this.materialsManager.get('bridge_deck_asphalt'));
    deckMesh.position.set(-44.0, deckElevation - deckThickness / 2, -42.0);
    deckMesh.receiveShadow = true;
    deckMesh.castShadow = true;
    bridgeGroup.add(deckMesh);

    // Safety crash barriers on both sides of deck
    const barrierGeo = new THREE.BoxGeometry(0.18, 0.45, deckLength);
    const barrierMat = this.materialsManager.get('retaining_wall_concrete');

    const barrierW = new THREE.Mesh(barrierGeo, barrierMat);
    barrierW.position.set(-44.0 - deckWidth / 2 + 0.1, deckElevation + 0.22, -42.0);
    barrierW.castShadow = true;
    bridgeGroup.add(barrierW);

    const barrierE = new THREE.Mesh(barrierGeo, barrierMat);
    barrierE.position.set(-44.0 + deckWidth / 2 - 0.1, deckElevation + 0.22, -42.0);
    barrierE.castShadow = true;
    bridgeGroup.add(barrierE);

    // Concrete Abutments on North and South riverbanks
    const abutmentGeo = new THREE.BoxGeometry(deckWidth + 0.6, 1.2, 0.8);
    const abutmentMat = this.materialsManager.get('retaining_wall_concrete');

    const abutmentNorth = new THREE.Mesh(abutmentGeo, abutmentMat);
    abutmentNorth.position.set(-44.0, (deckElevation + -0.45) / 2, -46.2);
    abutmentNorth.castShadow = true;
    abutmentNorth.receiveShadow = true;
    bridgeGroup.add(abutmentNorth);

    const abutmentSouth = new THREE.Mesh(abutmentGeo, abutmentMat);
    abutmentSouth.position.set(-44.0, (deckElevation + -0.45) / 2, -37.8);
    abutmentSouth.castShadow = true;
    abutmentSouth.receiveShadow = true;
    bridgeGroup.add(abutmentSouth);

    // Ramped Road Approaches (smooth civil engineering transition from +0.04m ground to +0.80m deck)
    const rampLength = 4.0;
    const rampThickness = 0.2;
    const rampSlopeAngle = Math.atan2(deckElevation - 0.04, rampLength);
    const rampGeo = new THREE.BoxGeometry(deckWidth, rampThickness, Math.hypot(rampLength, deckElevation - 0.04));

    // North Approach Ramp (Z = -50m to -46m)
    const rampNorth = new THREE.Mesh(rampGeo, this.materialsManager.get('bridge_deck_asphalt'));
    rampNorth.position.set(-44.0, (deckElevation + 0.04) / 2, -48.0);
    rampNorth.rotation.x = -rampSlopeAngle;
    rampNorth.receiveShadow = true;
    bridgeGroup.add(rampNorth);

    // South Approach Ramp (Z = -38m to -34m)
    const rampSouth = new THREE.Mesh(rampGeo, this.materialsManager.get('bridge_deck_asphalt'));
    rampSouth.position.set(-44.0, (deckElevation + 0.04) / 2, -36.0);
    rampSouth.rotation.x = rampSlopeAngle;
    rampSouth.receiveShadow = true;
    bridgeGroup.add(rampSouth);

    // --- 2. Grand Harbor Interstate Highway Viaduct (Transcontinental I-1 Causeway Bridge) ---
    // Location: gridX = 42..46, gridZ = 11 (worldX = 124m to 140m, worldZ = -2.0m)
    const viaductDeckLength = 18.0;
    const viaductDeckWidth = 4.4;
    const viaductDeckThickness = 0.35;
    const viaductDeckElev = 1.20;

    // Heavy marine concrete piers standing in deep coastal water
    const vPierGeo = new THREE.BoxGeometry(1.2, 4.7, 1.2);
    const vPier1 = new THREE.Mesh(vPierGeo, pierMat);
    vPier1.position.set(128.0, (0.85 + -3.5) / 2, -2.0);
    vPier1.castShadow = true;
    vPier1.receiveShadow = true;
    bridgeGroup.add(vPier1);

    const vPier2 = new THREE.Mesh(vPierGeo, pierMat);
    vPier2.position.set(136.0, (0.85 + -3.5) / 2, -2.0);
    vPier2.castShadow = true;
    vPier2.receiveShadow = true;
    bridgeGroup.add(vPier2);

    // Viaduct Deck Slab (running East-West)
    const vDeckGeo = new THREE.BoxGeometry(viaductDeckLength, viaductDeckThickness, viaductDeckWidth);
    const vDeckMesh = new THREE.Mesh(vDeckGeo, this.materialsManager.get('highway_asphalt') || this.materialsManager.get('bridge_deck_asphalt'));
    vDeckMesh.position.set(132.0, viaductDeckElev - viaductDeckThickness / 2, -2.0);
    vDeckMesh.receiveShadow = true;
    vDeckMesh.castShadow = true;
    bridgeGroup.add(vDeckMesh);

    // Steel Safety Barriers along north and south flanks of viaduct
    const vBarrierGeo = new THREE.BoxGeometry(viaductDeckLength, 0.45, 0.18);
    const vBarrierN = new THREE.Mesh(vBarrierGeo, barrierMat);
    vBarrierN.position.set(132.0, viaductDeckElev + 0.22, -2.0 - viaductDeckWidth / 2 + 0.1);
    vBarrierN.castShadow = true;
    bridgeGroup.add(vBarrierN);

    const vBarrierS = new THREE.Mesh(vBarrierGeo, barrierMat);
    vBarrierS.position.set(132.0, viaductDeckElev + 0.22, -2.0 + viaductDeckWidth / 2 - 0.1);
    vBarrierS.castShadow = true;
    bridgeGroup.add(vBarrierS);

    // Smooth Ramped Approaches on West (X = 120m to 123m) and East (X = 141m to 144m)
    const vRampLen = 4.0;
    const vRampSlope = Math.atan2(viaductDeckElev - 0.04, vRampLen);
    const vRampGeo = new THREE.BoxGeometry(Math.hypot(vRampLen, viaductDeckElev - 0.04), rampThickness, viaductDeckWidth);

    const vRampWest = new THREE.Mesh(vRampGeo, this.materialsManager.get('bridge_deck_asphalt'));
    vRampWest.position.set(121.0, (viaductDeckElev + 0.04) / 2, -2.0);
    vRampWest.rotation.z = -vRampSlope;
    vRampWest.receiveShadow = true;
    bridgeGroup.add(vRampWest);

    const vRampEast = new THREE.Mesh(vRampGeo, this.materialsManager.get('bridge_deck_asphalt'));
    vRampEast.position.set(143.0, (viaductDeckElev + 0.04) / 2, -2.0);
    vRampEast.rotation.z = vRampSlope;
    vRampEast.receiveShadow = true;
    bridgeGroup.add(vRampEast);

    // --- 3. Delta Regional Highway Bridge (Delta Boulevard Crossing at Z = 36, X = 32..36) ---
    // Location: gridX = 32..36, gridZ = 36 (worldX = 88.0m, worldZ = 96.0m)
    const dBridgeLen = 16.0;
    const dBridgeWidth = 4.2;
    const dBridgeElev = 0.85;

    const dPierGeo = new THREE.BoxGeometry(1.0, 1.4, 1.0);
    const dPier = new THREE.Mesh(dPierGeo, pierMat);
    dPier.position.set(88.0, (0.60 + -0.45) / 2, 96.0);
    dPier.castShadow = true;
    dPier.receiveShadow = true;
    bridgeGroup.add(dPier);

    const dDeckGeo = new THREE.BoxGeometry(dBridgeLen, 0.25, dBridgeWidth);
    const dDeckMesh = new THREE.Mesh(dDeckGeo, this.materialsManager.get('bridge_deck_asphalt'));
    dDeckMesh.position.set(88.0, dBridgeElev - 0.12, 96.0);
    dDeckMesh.receiveShadow = true;
    dDeckMesh.castShadow = true;
    bridgeGroup.add(dDeckMesh);

    this.group.add(bridgeGroup);
  }

  /**
   * Checker-toned grass grid tiles for tactical tycoon readability.
   */
  private buildTacticalTiles(): void {
    const tileGroup = new THREE.Group();
    tileGroup.name = 'tactical_grass_tiles';
    // Full cell size produces seamless, natural terrain blending without artificial dark grid seams
    const tileGeo = new THREE.PlaneGeometry(
      this.gridSystem.cellSize,
      this.gridSystem.cellSize
    );
    tileGeo.rotateX(-Math.PI / 2);

    for (let x = 0; x < this.gridSystem.width; x++) {
      for (let z = 0; z < this.gridSystem.height; z++) {
        // Skip water cells to allow clean recessed water rendering
        if (this.gridSystem.terrainModel.isWaterCell(x, z)) continue;

        const isAlternate = (x + z) % 2 === 0;
        const mat = isAlternate
          ? this.materialsManager.get('ground_grass_light')
          : this.materialsManager.get('ground_grass_mid');

        const tileMesh = new THREE.Mesh(tileGeo, mat);
        const center = this.gridSystem.gridToWorldCenter(x, z);
        tileMesh.position.set(center.x, 0.008, center.z);
        tileMesh.receiveShadow = true;
        tileGroup.add(tileMesh);
      }
    }
    tileGroup.visible = false; // Hidden during passive gameplay; activated on 'G' or construction mode
    this.tacticalTilesGroup = tileGroup;
    this.group.add(tileGroup);
  }

  /**
   * Paved Industrial Aprons & Concrete Yards connecting facilities to the road network.
   * Includes the Level 1 Starter Truck Depot's dedicated 3-space staging pad.
   */
  private buildIndustrialAprons(): void {
    const apronGroup = new THREE.Group();
    apronGroup.name = 'industrial_aprons';

    const yardMat = this.materialsManager.get('concrete_industrial_yard');
    const loadingMat = this.materialsManager.get('concrete_loading_apron');
    const hazardMat = this.materialsManager.get('hazard_apron_border');

    // 1. Sector Logistics Hub Apron: (gridX=5, gridZ=12..13, width 4 cells, depth 2 cells)
    const logCorner = this.gridSystem.gridToWorldCorner(5, 12);
    const logW = 4 * this.gridSystem.cellSize;
    const logD = 2 * this.gridSystem.cellSize;

    const logApronGeo = new THREE.PlaneGeometry(logW, logD);
    logApronGeo.rotateX(-Math.PI / 2);
    const logApron = new THREE.Mesh(logApronGeo, loadingMat);
    logApron.position.set(logCorner.x + logW / 2, TerrainModel.GRADED_PAD_ELEVATION, logCorner.z + logD / 2);
    logApron.receiveShadow = true;
    apronGroup.add(logApron);

    const stripeGeo = new THREE.PlaneGeometry(logW, 0.18);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeMesh = new THREE.Mesh(stripeGeo, hazardMat);
    stripeMesh.position.set(logCorner.x + logW / 2, TerrainModel.GRADED_PAD_ELEVATION + 0.002, logCorner.z + 0.1);
    apronGroup.add(stripeMesh);

    // 2. Apex Manufacturing Plant Apron: (gridX=9, gridZ=5..7, width 2 cells, depth 3 cells)
    const mfgCorner = this.gridSystem.gridToWorldCorner(9, 5);
    const mfgW = 2 * this.gridSystem.cellSize;
    const mfgD = 3 * this.gridSystem.cellSize;

    const mfgApronGeo = new THREE.PlaneGeometry(mfgW, mfgD);
    mfgApronGeo.rotateX(-Math.PI / 2);
    const mfgApron = new THREE.Mesh(mfgApronGeo, yardMat);
    mfgApron.position.set(mfgCorner.x + mfgW / 2, TerrainModel.GRADED_PAD_ELEVATION, mfgCorner.z + mfgD / 2);
    mfgApron.receiveShadow = true;
    apronGroup.add(mfgApron);

    // 3. Commercial HQ Entrance Plaza & Parking Apron: (gridX=12, gridZ=6..7, width 2 cells, depth 2 cells)
    const hqCorner = this.gridSystem.gridToWorldCorner(12, 6);
    const hqW = 2 * this.gridSystem.cellSize;
    const hqD = 2 * this.gridSystem.cellSize;

    const hqApronGeo = new THREE.PlaneGeometry(hqW, hqD);
    hqApronGeo.rotateX(-Math.PI / 2);
    const hqApron = new THREE.Mesh(hqApronGeo, loadingMat);
    hqApron.position.set(hqCorner.x + hqW / 2, TerrainModel.GRADED_PAD_ELEVATION, hqCorner.z + hqD / 2);
    hqApron.receiveShadow = true;
    apronGroup.add(hqApron);

    // 4. Starter Level 1 Truck Depot Apron & 3 Designated Staging Spaces (gridX=12, gridZ=13..15, width 4 cells, depth 3 cells)
    const depotCorner = this.gridSystem.gridToWorldCorner(12, 13);
    const depotW = 4 * this.gridSystem.cellSize; // 16m
    const depotD = 3 * this.gridSystem.cellSize; // 12m

    const depotApronGeo = new THREE.PlaneGeometry(depotW, depotD);
    depotApronGeo.rotateX(-Math.PI / 2);
    const depotApron = new THREE.Mesh(depotApronGeo, yardMat);
    depotApron.position.set(depotCorner.x + depotW / 2, TerrainModel.GRADED_PAD_ELEVATION, depotCorner.z + depotD / 2);
    depotApron.receiveShadow = true;
    apronGroup.add(depotApron);

    // Hazard stripe along starter depot entrance facing spur road (at gridX=11)
    const depotStripeGeo = new THREE.PlaneGeometry(0.2, depotD);
    depotStripeGeo.rotateX(-Math.PI / 2);
    const depotStripe = new THREE.Mesh(depotStripeGeo, hazardMat);
    depotStripe.position.set(depotCorner.x + 0.1, TerrainModel.GRADED_PAD_ELEVATION + 0.002, depotCorner.z + depotD / 2);
    apronGroup.add(depotStripe);

    this.group.add(apronGroup);
  }

  /**
   * Reserved Future Transport Corridors (Rail right-of-way and Port access)
   */
  private buildTransportCorridorReserves(): void {
    const corridorGroup = new THREE.Group();
    corridorGroup.name = 'transport_corridors_reserve';

    // 1. Northern Transcontinental Rail Right-of-Way (gridZ = 1, gridX = 4..23)
    const railCorner = this.gridSystem.gridToWorldCorner(4, 1);
    const railW = 20 * this.gridSystem.cellSize;
    const railD = 1 * this.gridSystem.cellSize;

    const railBedGeo = new THREE.PlaneGeometry(railW, railD);
    railBedGeo.rotateX(-Math.PI / 2);
    const ballastMat = this.materialsManager.get('rail_ballast') || this.materialsManager.get('gravel_shoulder');
    const railBed = new THREE.Mesh(railBedGeo, ballastMat);
    railBed.position.set(railCorner.x + railW / 2, TerrainModel.CORRIDOR_ELEVATION, railCorner.z + railD / 2);
    railBed.receiveShadow = true;
    corridorGroup.add(railBed);

    // Right-of-Way boundary markers along rail reserve
    const markerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6);
    const markerMat = this.materialsManager.get('survey_marker');
    for (let x = 4; x <= 23; x += 4) {
      const pos = this.gridSystem.gridToWorldCorner(x, 1);
      const mN = new THREE.Mesh(markerGeo, markerMat);
      mN.position.set(pos.x + 0.2, 0.3, pos.z + 0.2);
      corridorGroup.add(mN);

      const mS = new THREE.Mesh(markerGeo, markerMat);
      mS.position.set(pos.x + 0.2, 0.3, pos.z + railD - 0.2);
      corridorGroup.add(mS);
    }

    // 2. Eastern Maritime Deepwater Port Access Corridor (gridX = 22..23, gridZ = 13..16)
    const portCorner = this.gridSystem.gridToWorldCorner(22, 13);
    const portW = 2 * this.gridSystem.cellSize;
    const portD = 4 * this.gridSystem.cellSize;

    const portPadGeo = new THREE.PlaneGeometry(portW, portD);
    portPadGeo.rotateX(-Math.PI / 2);
    const portPad = new THREE.Mesh(portPadGeo, this.materialsManager.get('concrete_industrial_yard'));
    portPad.position.set(portCorner.x + portW / 2, TerrainModel.CORRIDOR_ELEVATION, portCorner.z + portD / 2);
    portPad.receiveShadow = true;
    corridorGroup.add(portPad);

    this.group.add(corridorGroup);
  }

  public setGridVisible(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
    if (this.tacticalTilesGroup) {
      this.tacticalTilesGroup.visible = visible;
    }
  }

  public getGridVisible(): boolean {
    return this.gridHelper ? this.gridHelper.visible : false;
  }

  public setConstructionMode(active: boolean): void {
    this.setGridVisible(active);
  }

  public isConstructionMode(): boolean {
    return this.getGridVisible();
  }

  /**
   * Designated Construction Plots (with gravel foundation, survey stakes & pennants)
   */
  public buildConstructionPlots(plots: ConstructionPlot[]): void {
    const plotGroup = new THREE.Group();
    plotGroup.name = 'construction_plots';

    plots.forEach((plot) => {
      const plotW = plot.width * this.gridSystem.cellSize;
      const plotD = plot.depth * this.gridSystem.cellSize;
      const corner = this.gridSystem.gridToWorldCorner(plot.gridX, plot.gridZ);
      const centerX = corner.x + plotW / 2;
      const centerZ = corner.z + plotD / 2;

      // Flattened crushed gravel survey pad
      const dirtGeo = new THREE.PlaneGeometry(plotW - 0.2, plotD - 0.2);
      const dirtMesh = new THREE.Mesh(dirtGeo, this.materialsManager.get('ground_dirt'));
      dirtMesh.rotation.x = -Math.PI / 2;
      dirtMesh.position.set(centerX, 0.02, centerZ);
      dirtMesh.receiveShadow = true;
      plotGroup.add(dirtMesh);

      // Yellow/Black striped corner boundary survey stakes
      const stakeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
      const stakePositions = [
        { x: corner.x + 0.2, z: corner.z + 0.2 },
        { x: corner.x + plotW - 0.2, z: corner.z + 0.2 },
        { x: corner.x + plotW - 0.2, z: corner.z + plotD - 0.2 },
        { x: corner.x + 0.2, z: corner.z + plotD - 0.2 },
      ];

      stakePositions.forEach((pos) => {
        const stake = new THREE.Mesh(stakeGeo, this.materialsManager.get('survey_marker'));
        stake.position.set(pos.x, 0.4, pos.z);
        stake.castShadow = true;
        plotGroup.add(stake);

        const flagGeo = new THREE.ConeGeometry(0.12, 0.2, 4);
        const flag = new THREE.Mesh(flagGeo, this.materialsManager.get('metal_industrial_orange'));
        flag.position.set(pos.x, 0.8, pos.z);
        plotGroup.add(flag);
      });

      // Register plot occupancy
      this.gridSystem.setAreaOccupancy(
        plot.gridX,
        plot.gridZ,
        plot.width,
        plot.depth,
        'reserved',
        plot.id
      );
    });

    this.group.add(plotGroup);
  }

  /**
   * Procedural Trees (Multi-tier stylized canopies with grounded contact shadows)
   */
  public buildTrees(trees: InitialTreeInstance[]): void {
    const treeGroup = new THREE.Group();
    treeGroup.name = 'greenery_trees';

    trees.forEach((treeData) => {
      const cellCenter = this.gridSystem.gridToWorldCenter(treeData.gridX, treeData.gridZ);
      const posX = cellCenter.x + treeData.offsetX * this.gridSystem.cellSize;
      const posZ = cellCenter.z + treeData.offsetZ * this.gridSystem.cellSize;

      const singleTree = new THREE.Group();
      singleTree.position.set(posX, 0, posZ);
      singleTree.scale.setScalar(treeData.scale);

      const trunkH = 2.4;
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.38, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, this.materialsManager.get('tree_bark'));
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      singleTree.add(trunk);

      if (treeData.species === 'conifer') {
        const tier1Geo = new THREE.ConeGeometry(2.2, 3.2, 8);
        const tier1 = new THREE.Mesh(tier1Geo, this.materialsManager.get('tree_foliage_dark'));
        tier1.position.y = trunkH + 1.2;
        tier1.castShadow = true;
        singleTree.add(tier1);

        const tier2Geo = new THREE.ConeGeometry(1.7, 2.6, 8);
        const tier2 = new THREE.Mesh(tier2Geo, this.materialsManager.get('tree_foliage_lush'));
        tier2.position.y = trunkH + 2.8;
        tier2.castShadow = true;
        singleTree.add(tier2);

        const tier3Geo = new THREE.ConeGeometry(1.2, 2.2, 8);
        const tier3 = new THREE.Mesh(tier3Geo, this.materialsManager.get('tree_foliage_light'));
        tier3.position.y = trunkH + 4.2;
        tier3.castShadow = true;
        singleTree.add(tier3);
      } else {
        const sphereGeo = new THREE.DodecahedronGeometry(2.4, 1);
        const foliage = new THREE.Mesh(sphereGeo, this.materialsManager.get('tree_foliage_lush'));
        foliage.position.y = trunkH + 2.0;
        foliage.castShadow = true;
        singleTree.add(foliage);

        const topGeo = new THREE.DodecahedronGeometry(1.8, 1);
        const topFoliage = new THREE.Mesh(topGeo, this.materialsManager.get('tree_foliage_light'));
        topFoliage.position.set(0.3, trunkH + 3.4, -0.3);
        topFoliage.castShadow = true;
        singleTree.add(topFoliage);
      }

      const shadowGeo = new THREE.CircleGeometry(2.2, 12);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x1b3815,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const treeShadow = new THREE.Mesh(shadowGeo, shadowMat);
      treeShadow.rotation.x = -Math.PI / 2;
      treeShadow.position.y = 0.015;
      singleTree.add(treeShadow);

      treeGroup.add(singleTree);
    });

    this.group.add(treeGroup);
  }

  public update(deltaTime: number): void {
    this.waterAnimationTime += deltaTime;

    const riverMat = this.materialsManager.get('river_water') as THREE.MeshStandardMaterial;
    if (riverMat && riverMat.map) {
      riverMat.map.offset.x = (this.waterAnimationTime * 0.04) % 1;
      riverMat.map.offset.y = (this.waterAnimationTime * 0.02) % 1;
    }
    const coastalMat = this.materialsManager.get('coastal_deep_water') as THREE.MeshStandardMaterial;
    if (coastalMat && coastalMat.map) {
      coastalMat.map.offset.x = (this.waterAnimationTime * 0.03) % 1;
      coastalMat.map.offset.y = (this.waterAnimationTime * 0.015) % 1;
    }

    if (this.lighthouseLight) {
      // Periodic flashing marine beacon (period 3.0s)
      const flash = (Math.sin(this.waterAnimationTime * 2.1) + 1.0) / 2.0;
      this.lighthouseLight.intensity = flash > 0.8 ? 2.5 : 0.4;
    }
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
