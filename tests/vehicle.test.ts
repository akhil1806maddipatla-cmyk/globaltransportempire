import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  VEHICLE_DEFINITIONS,
  TRAILER_DEFINITIONS,
  CONTAINER_DEFINITIONS,
} from '../src/data/vehicleDefinitions';
import { MaterialsManager } from '../src/rendering/MaterialsManager';
import { VehicleModularComponents } from '../src/entities/vehicles/VehicleModularComponents';
import { CargoTruckModel } from '../src/entities/vehicles/CargoTruckModel';
import { TrailerModel } from '../src/entities/vehicles/TrailerModel';
import { ShippingContainerModel } from '../src/entities/vehicles/ShippingContainerModel';
import { VehicleEntity } from '../src/entities/vehicles/VehicleEntity';
import { WorldManager } from '../src/world/WorldManager';
import { GameState } from '../src/game/GameState';

test('Vehicle Definitions - Integrity and dimensional bounds', () => {
  const primeMover = VEHICLE_DEFINITIONS.prime_mover_6x4;
  assert.ok(primeMover, 'prime_mover_6x4 must exist');
  assert.equal(primeMover.axleConfig, '6x4');
  assert.equal(primeMover.hasFifthWheel, true);
  assert.equal(primeMover.dimensions.width, 2.4);
  assert.equal(primeMover.dimensions.length, 6.8);
  assert.equal(primeMover.dimensions.height, 3.45);
  assert.ok(primeMover.specs.horsepower >= 500, 'Prime mover must have >= 500 HP');
  assert.ok(primeMover.fifthWheelOffset.y > 1.0, 'Fifth wheel must be at standard coupling height ~1.15m');

  const courier = VEHICLE_DEFINITIONS.courier_truck_4x2;
  assert.ok(courier, 'courier_truck_4x2 must exist');
  assert.equal(courier.axleConfig, '4x2');
  assert.equal(courier.hasFifthWheel, true);
  assert.ok(courier.dimensions.length < primeMover.dimensions.length, 'Courier truck should be shorter than 6x4');
});

test('Trailer Definitions - Attachment transforms and kingpin alignment', () => {
  const skeletal = TRAILER_DEFINITIONS.skeletal_container_chassis_40ft;
  assert.ok(skeletal, 'skeletal_container_chassis_40ft must exist');
  assert.equal(skeletal.type, 'skeletal_chassis');
  assert.equal(skeletal.dimensions.length, 12.2);
  assert.equal(skeletal.dimensions.width, 2.44);

  // Kingpin height must match prime mover fifth wheel height
  const primeMover = VEHICLE_DEFINITIONS.prime_mover_6x4;
  assert.equal(skeletal.kingpinOffset.y, primeMover.fifthWheelOffset.y);

  // Twistlock points must have 4 corners
  assert.ok(skeletal.twistlockMountPoints, 'Skeletal chassis must have twistlock mount points');
  assert.equal(skeletal.twistlockMountPoints?.length, 4);

  const dryVan = TRAILER_DEFINITIONS.enclosed_dry_van_trailer;
  assert.ok(dryVan, 'enclosed_dry_van_trailer must exist');
  assert.equal(dryVan.type, 'enclosed_dry_van');
  assert.equal(dryVan.kingpinOffset.y, primeMover.fifthWheelOffset.y);
});

test('Container Definitions - ISO dimension invariants and variants', () => {
  const dry20 = CONTAINER_DEFINITIONS.iso_container_dry_20ft;
  assert.ok(dry20, '20ft dry container must exist');
  assert.equal(dry20.isRefrigerated, false);
  assert.equal(dry20.dimensions.length, 6.06);
  assert.equal(dry20.dimensions.width, 2.44);
  assert.equal(dry20.dimensions.height, 2.59);

  const dry40 = CONTAINER_DEFINITIONS.iso_container_dry_40ft;
  assert.ok(dry40, '40ft dry container must exist');
  assert.equal(dry40.dimensions.length, 12.19);
  assert.ok(dry40.specs.cubicCapacityCbm > dry20.specs.cubicCapacityCbm);

  const reefer = CONTAINER_DEFINITIONS.iso_container_reefer_20ft;
  assert.ok(reefer, '20ft reefer container must exist');
  assert.equal(reefer.isRefrigerated, true);
  assert.equal(reefer.defaultLivery, 'white');
});

test('VehicleModularComponents - Wheel assemblies, steering axles, and hardware', () => {
  const materials = new MaterialsManager();

  // Single wheel
  const singleWheel = VehicleModularComponents.createHeavyTruckWheel(0.52, 0.28, false, materials);
  assert.ok(singleWheel.group, 'Single wheel group created');
  assert.equal(singleWheel.radius, 0.52);

  // Dual wheel
  const dualWheel = VehicleModularComponents.createHeavyTruckWheel(0.52, 0.48, true, materials);
  assert.ok(dualWheel.group, 'Dual wheel group created');

  // Steering axle
  const steerAxle = VehicleModularComponents.createFrontSteeringAxle(2.05, 0.52, materials);
  assert.ok(steerAxle.steerLeft, 'Steer left knuckle pivot exists');
  assert.ok(steerAxle.steerRight, 'Steer right knuckle pivot exists');
  assert.equal(steerAxle.wheels.length, 2);

  // Tandem drive axles
  const tandemAxle = VehicleModularComponents.createTandemDriveAxles(1.35, 2.05, 0.52, materials);
  assert.equal(tandemAxle.wheels.length, 4, 'Tandem axles have 4 dual wheel assemblies');

  // Landing legs
  const landingLegs = VehicleModularComponents.createTrailerLandingLegs(materials);
  assert.ok(landingLegs.group, 'Landing legs group exists');
  landingLegs.setDeployed(true);
  landingLegs.setDeployed(false);

  // ISO Corner castings
  const cornerCastings = VehicleModularComponents.createContainerCornerCastings(2.44, 6.06, 2.59, materials);
  assert.equal(cornerCastings.children.length, 8, '8 ISO corner castings generated');

  materials.dispose();
});

test('CargoTruckModel - 3D model construction and kinematic controls', () => {
  const materials = new MaterialsManager();
  const truckDef = VEHICLE_DEFINITIONS.prime_mover_6x4;
  const truck = new CargoTruckModel(truckDef, materials);

  assert.ok(truck.group, 'Truck root group exists');
  assert.ok(truck.steerLeft, 'Steer left transform exists');
  assert.ok(truck.steerRight, 'Steer right transform exists');
  assert.ok(truck.fifthWheelTransform, 'Fifth wheel transform exists');
  assert.equal(truck.wheels.length, 6, '6x4 truck has 6 wheel groups (2 front single + 4 rear dual)');

  // Steering control
  truck.setSteeringAngle(0.3);
  assert.ok(Math.abs(truck.getSteeringAngle() - 0.3) < 0.001);

  // Wheel rolling
  truck.rollWheels(5.0);

  // Lighting controls
  truck.setHeadlights(true);
  assert.equal(truck.lightingState.headlights, true);
  truck.setHazardLights(true);
  assert.equal(truck.lightingState.hazardLights, true);
  truck.setBrakeLights(true);
  assert.equal(truck.lightingState.brakeLights, true);

  // Paint color
  truck.setPaintColor('red');
  assert.equal(truck.getPaintColor(), 'red');

  materials.dispose();
});

test('TrailerModel & ShippingContainerModel - Articulation and twistlock mounts', () => {
  const materials = new MaterialsManager();

  // Skeletal trailer
  const trailerDef = TRAILER_DEFINITIONS.skeletal_container_chassis_40ft;
  const trailer = new TrailerModel(trailerDef, materials);
  assert.ok(trailer.group, 'Trailer group exists');
  assert.ok(trailer.kingpinTransform, 'Kingpin transform exists');
  assert.equal(trailer.twistlockPoints.length, 4, '4 twistlock points created');

  // Landing legs
  trailer.setLandingLegs(true);
  assert.equal(trailer.getLandingLegsDeployed(), true);
  trailer.setLandingLegs(false);
  assert.equal(trailer.getLandingLegsDeployed(), false);

  // Container model
  const contDef = CONTAINER_DEFINITIONS.iso_container_dry_40ft;
  const container = new ShippingContainerModel(contDef, materials);
  assert.ok(container.group, 'Container group exists');

  const twistlocks = container.getTwistlockOffsets();
  assert.equal(twistlocks.length, 4, '4 container twistlock mounting offsets');

  materials.dispose();
});

test('VehicleEntity - Composite entity lifecycle, articulation, and selection', () => {
  const materials = new MaterialsManager();
  const truckDef = VEHICLE_DEFINITIONS.prime_mover_6x4;
  const trailerDef = TRAILER_DEFINITIONS.skeletal_container_chassis_40ft;
  const containerDef = CONTAINER_DEFINITIONS.iso_container_dry_40ft;

  const vehicle = new VehicleEntity(
    'test_veh_01',
    truckDef,
    10,
    10,
    -20,
    -20,
    materials,
    {
      trailerDefinition: trailerDef,
      containerDefinition: containerDef,
      paintColor: 'blue',
    }
  );

  assert.equal(vehicle.entityType, 'vehicle');
  assert.ok(vehicle.trailerModel, 'Trailer model is coupled');
  assert.ok(vehicle.containerModel, 'Container model is mounted');

  // Articulation
  vehicle.setArticulationAngle(0.35);
  assert.ok(Math.abs(vehicle.getArticulationAngle() - 0.35) < 0.001);

  // Selection
  vehicle.setSelected(true);
  assert.equal(vehicle.isSelected, true);
  vehicle.setSelected(false);
  assert.equal(vehicle.isSelected, false);

  // Decouple and re-couple trailer
  vehicle.detachTrailer();
  assert.equal(vehicle.trailerModel, null);
  assert.equal(vehicle.containerModel, null);

  vehicle.attachTrailer(trailerDef);
  assert.ok(vehicle.trailerModel, 'Trailer re-coupled');
  vehicle.mountContainer(containerDef);
  assert.ok(vehicle.containerModel, 'Container re-mounted');

  // Clean disposal
  vehicle.dispose();
  materials.dispose();
});

test('WorldManager - Vehicle placement, query, and removal transactions', () => {
  const scene = new THREE.Scene();
  const gameState = new GameState();
  const world = new WorldManager(scene, gameState);

  world.initializeWorld();

  // Initial vehicles should be spawned
  const entities = world.entityRegistry.getAll();
  const vehicles = entities.filter((e) => e.entityType === 'vehicle');
  assert.equal(vehicles.length, 3, 'Initial world has 3 road freight vehicles spawned');

  // Dynamic vehicle placement
  const placeRes = world.placeVehicle(
    'courier_truck_4x2',
    16,
    12,
    {
      trailerDefinitionId: 'enclosed_dry_van_trailer',
      paintColor: 'orange',
    }
  );

  assert.equal(placeRes.success, true);
  assert.ok(placeRes.entity, 'VehicleEntity returned');
  const spawnedId = placeRes.entity!.id;

  // Retrieve by ID
  const retrieved = world.entityRegistry.get(spawnedId);
  assert.ok(retrieved instanceof VehicleEntity);

  // Safe removal
  const removed = world.removeVehicle(spawnedId);
  assert.equal(removed, true);
  assert.equal(world.entityRegistry.get(spawnedId), undefined);

  world.dispose();
});
