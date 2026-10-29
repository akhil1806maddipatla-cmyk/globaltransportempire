import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ASSET_STANDARDS } from '../src/rendering/AssetStandards';
import { AssetValidator } from '../src/rendering/AssetValidator';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { CargoTruckModel } from '../src/entities/vehicles/CargoTruckModel';
import { TrailerModel } from '../src/entities/vehicles/TrailerModel';
import { VEHICLE_DEFINITIONS, TRAILER_DEFINITIONS } from '../src/data/vehicleDefinitions';
import { BuildingEntity } from '../src/entities/BuildingEntity';
import { BUILDING_DEFINITIONS } from '../src/data/buildingDefinitions';
import { FacilityManager } from '../src/facilities/FacilityManager';

test('AssetStandards - World Units, Coordinate Axes, and Metric Invariants', () => {
  const { coordinates, pivots, envelopes, futureExpansions } = ASSET_STANDARDS;

  // 1. SI Metric Standard (1.0 world unit = 1.0 metre)
  assert.equal(coordinates.groundContactPlaneY, 0.0, 'Ground contact plane must be Y=0.0m');
  assert.equal(coordinates.gridCellSizeMeters, 4.0, 'Standard grid cell size must be 4.0m x 4.0m');
  assert.equal(coordinates.verticalAxis, '+Y (Upward)');
  assert.equal(coordinates.forwardHeadingAxis, '+Z (Forward movement direction)');
  assert.equal(coordinates.lateralAxis, '+X (Right / Starboard; -X = Left / Port)');

  // 2. Pivots and hitch coupling heights
  assert.equal(pivots.fifthWheelHeightY, 1.15, 'Tractor fifth-wheel coupling plane standard is 1.15m');
  assert.equal(pivots.trailerKingpinHeightY, 1.15, 'Trailer kingpin bolster seating plane standard is 1.15m');
  assert.equal(pivots.trailerChassisPlatformHeightY, 1.45, 'Container bolster twistlock seating plane is 1.45m');

  // 3. Dimensional Envelopes & Single-Lane Bounds
  assert.ok(envelopes.roadVehicles.maxTotalWidthWithMirrors <= 3.0, 'Vehicle envelope with mirrors must not exceed 3.0m');
  assert.ok(envelopes.roadVehicles.maxVehicleWidthExcludingMirrors <= 2.6, 'Standard vehicle width must not exceed 2.6m');

  // 4. Level 1 Depot Standards
  assert.equal(envelopes.level1Depot.designatedSpacesCount, 3, 'Level 1 depot must specify exactly 3 designated spaces');
  assert.ok(envelopes.level1Depot.bayWidthMeters >= 3.5, 'Parking bay width must accommodate heavy vehicles with clearance');
  assert.ok(envelopes.level1Depot.overheadCanopyClearanceY >= 5.0, 'Canopy clearance must exceed 5.0m for high-cube vehicles');

  // 5. Multi-Modal Expansion Compatibility (Future Rail, Aviation, Maritime)
  assert.equal(futureExpansions.railway.standardTrackGaugeMeters, 1.435, 'Standard rail gauge is 1.435m');
  assert.ok(futureExpansions.railway.locomotiveEnvelope.height <= 5.0, 'Locomotive height within standard rail envelope');
  assert.ok(futureExpansions.aviation.runwayStripWidthMeters >= 40.0, 'Runway width standard is 45.0m');
  assert.ok(futureExpansions.maritime.feederContainerVessel.beam >= 20.0, 'Feeder vessel beam is realistic');
});

test('MaterialsManager - PBR Standards, Central Registry, and Fallback Safety', () => {
  const materialsManager = new MaterialsManager();

  // 1. Verify existence of primary material categories
  const requiredMaterials = [
    'road_asphalt',
    'road_arterial_asphalt',
    'road_highway_asphalt',
    'asphalt_corridor',
    'road_marking_white',
    'road_marking_yellow',
    'concrete_foundation',
    'concrete_industrial_yard',
    'truck_chassis_steel',
    'truck_wheel_chrome',
    'truck_tire_rubber',
    'truck_glass_windshield',
    'truck_cab_paint_blue',
    'truck_cab_paint_orange',
    'depot_active_indicator',
    'trailer_chassis_dark',
    'trailer_conspicuity_tape',
    'container_corrugated_blue',
  ];

  for (const matName of requiredMaterials) {
    assert.ok(materialsManager.has(matName), `MaterialsManager must register standard material: ${matName}`);
    const mat = materialsManager.get(matName);
    assert.ok(mat instanceof THREE.Material, `Material '${matName}' must be a valid THREE.Material`);
  }

  // 2. Physical PBR Property Bounds Validation (Roughness & Metalness in [0, 1])
  const validation = AssetValidator.validateMaterialsRegistry(materialsManager);
  assert.equal(validation.valid, true, `All materials must have physically plausible PBR parameters: ${validation.issues.join(', ')}`);

  // 3. Graceful Fallback for Unregistered Materials (Returns diagnostic fallback without throwing)
  const unknownMat = materialsManager.get('non_existent_spec_material_123');
  assert.ok(unknownMat instanceof THREE.Material, 'Must return a valid material instance as diagnostic fallback');
  assert.equal((unknownMat as THREE.MeshStandardMaterial).color.getHex(), 0xff00ff, 'Fallback material must be diagnostic magenta (0xff00ff)');

  materialsManager.dispose();
});

test('AssetValidator - Hierarchy Inspection, Transform Checks, and Bounding Envelopes', () => {
  // 1. Clean valid hierarchy passes validation
  const validGroup = new THREE.Group();
  validGroup.name = 'ValidTestGroup';
  const geo = new THREE.BoxGeometry(2, 2, 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 1, 0);
  validGroup.add(mesh);

  const cleanReport = AssetValidator.validateHierarchy(validGroup, { width: 3.0, height: 3.0, length: 3.0 });
  assert.equal(cleanReport.isValid, true, 'Clean model hierarchy must pass validation');
  assert.equal(cleanReport.errors.length, 0);

  // 2. Detect NaN position error
  const invalidGroup = new THREE.Group();
  invalidGroup.name = 'InvalidGroup';
  const badMesh = new THREE.Mesh(geo, mat);
  badMesh.position.set(NaN, 0, 0);
  invalidGroup.add(badMesh);

  const badReport = AssetValidator.validateHierarchy(invalidGroup);
  assert.equal(badReport.isValid, false, 'Must flag NaN position as an error');
  assert.ok(badReport.errors.some((e) => e.property === 'position'));

  // 3. Detect oversized width exceeding envelope
  const wideGroup = new THREE.Group();
  wideGroup.name = 'WideGroup';
  const wideGeo = new THREE.BoxGeometry(5.0, 2.0, 2.0); // 5m wide
  wideGroup.add(new THREE.Mesh(wideGeo, mat));

  const wideReport = AssetValidator.validateHierarchy(wideGroup, { width: 3.0 });
  assert.equal(wideReport.isValid, false, 'Must detect model exceeding maximum spatial width envelope');
  assert.ok(wideReport.errors.some((e) => e.property === 'width'));
});

test('Vehicle Assets - Single-Lane Fit, Ground Contact, and Fifth-Wheel Alignment', () => {
  const materialsManager = new MaterialsManager();
  const truckDef = VEHICLE_DEFINITIONS.prime_mover_6x4;
  const truckModel = new CargoTruckModel(truckDef, materialsManager, 'blue');

  // 1. Vehicle Model Validation
  const report = AssetValidator.validateVehicleModel(truckModel.group, true);
  assert.equal(report.isValid, true, `Prime mover must pass asset validation: ${report.errors.map(e => e.message).join(', ')}`);

  // 2. Strict Single-Lane Envelope Fit
  const aabb = new THREE.Box3().setFromObject(truckModel.group);
  const truckWidth = aabb.max.x - aabb.min.x;
  assert.ok(truckWidth <= 2.85, `Truck total width (${truckWidth.toFixed(2)}m) must fit inside 3.5m lane with safe margins`);
  assert.ok(truckWidth >= 2.4, 'Truck width must be physically realistic (>= 2.4m)');

  // 3. Ground contact: Lowest wheels must sit flush on Y = 0.0
  assert.ok(Math.abs(aabb.min.y) <= 0.04, `Truck ground contact (${aabb.min.y.toFixed(3)}m) must rest flush on ground plane Y=0.0m`);

  // 4. Fifth-wheel coupling alignment
  const fifthWheel = truckModel.group.getObjectByName('fifth_wheel_coupling_point');
  assert.ok(fifthWheel, 'Truck must possess fifth-wheel coupling transform');
  const fwPos = new THREE.Vector3();
  fifthWheel!.getWorldPosition(fwPos);
  assert.ok(Math.abs(fwPos.y - 1.15) <= 0.05, `Fifth-wheel height (${fwPos.y.toFixed(2)}m) must match 1.15m standard`);

  // 5. Trailer Kingpin Match
  const trailerDef = TRAILER_DEFINITIONS.skeletal_container_chassis_40ft;
  const trailerModel = new TrailerModel(trailerDef, materialsManager);
  const kingpin = trailerModel.group.getObjectByName('trailer_kingpin_point');
  assert.ok(kingpin, 'Trailer must possess kingpin coupling point');
  const kpPos = new THREE.Vector3();
  kingpin!.getWorldPosition(kpPos);
  assert.ok(Math.abs(kpPos.y - 1.15) <= 0.05, `Trailer kingpin height (${kpPos.y.toFixed(2)}m) must match fifth-wheel height 1.15m`);

  materialsManager.dispose();
});

test('Level 1 Truck Depot - 3-Space Capacity, Overhead Clearance, and Facility Integrity', () => {
  const materialsManager = new MaterialsManager();
  const facilityManager = new FacilityManager();
  const depotFacility = facilityManager.ensureDefaultStartingDepot(12, 13);

  // 1. Capacity Invariant
  assert.equal(depotFacility.level, 1, 'Starting depot must be Level 1');
  assert.equal(depotFacility.getTotalCapacity(), 3, 'Level 1 starting depot must have exactly 3 parking bays');
  assert.equal(depotFacility.isPlayerOwned, true, 'Starting depot is owned by default');

  // 2. Building 3D Asset Validation
  const depotDef = BUILDING_DEFINITIONS.truck_depot_level1;
  const depotEntity = new BuildingEntity(
    'test_depot_asset',
    depotDef,
    12,
    13,
    48,
    52,
    materialsManager,
    0
  );

  const report = AssetValidator.validateDepotModel(depotEntity.group);
  assert.equal(report.isValid, true, `Depot 3D model must pass validation: ${report.errors.map(e => e.message).join(', ')}`);

  // 3. Ground contact and footprint dimensions
  const aabb = new THREE.Box3().setFromObject(depotEntity.group);
  assert.ok(aabb.min.y >= -0.05 && aabb.min.y <= 0.15, 'Depot foundation must align with ground plane');
  const footprintW = aabb.max.x - aabb.min.x;
  const footprintD = aabb.max.z - aabb.min.z;
  assert.ok(footprintW >= 15.0 && footprintW <= 17.5, `Depot width (${footprintW.toFixed(1)}m) must match ~16m footprint`);
  assert.ok(footprintD >= 11.0 && footprintD <= 13.5, `Depot depth (${footprintD.toFixed(1)}m) must match ~12m footprint`);

  materialsManager.dispose();
});

test('AssetValidator - Deep Hierarchy Disposal (Memory Leak Prevention)', () => {
  const root = new THREE.Group();
  const geo1 = new THREE.BoxGeometry(1, 1, 1);
  const mat1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh1 = new THREE.Mesh(geo1, mat1);
  root.add(mesh1);

  const subGroup = new THREE.Group();
  const geo2 = new THREE.SphereGeometry(0.5);
  const mat2 = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const mesh2 = new THREE.Mesh(geo2, mat2);
  subGroup.add(mesh2);
  root.add(subGroup);

  assert.equal(root.children.length, 2);

  // Dispose hierarchy
  AssetValidator.disposeHierarchy(root);

  assert.equal(root.children.length, 0, 'Disposed hierarchy must remove all child nodes');
});
