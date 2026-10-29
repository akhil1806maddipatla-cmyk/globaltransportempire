import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SCALE_STANDARDS, WorldScaleValidator } from '../src/data/worldScale';

test('World Scale Standards - Authoritative conventions and constants', () => {
  const { conventions, roadVehicles, roadInfrastructure, buildingInfrastructure, railwayInfrastructure, maritimeInfrastructure, aviationInfrastructure, humanReferences } = WORLD_SCALE_STANDARDS;

  // 1. Metric SI 1.0m standard
  assert.equal(conventions.worldUnitToMeters, 1.0, '1 world unit must equal exactly 1.0 metre');
  assert.equal(conventions.gridCellSizeMeters, 4.0, 'Standard grid cell must equal 4.0m x 4.0m');
  assert.equal(conventions.fifthWheelCouplingHeightY, 1.15, 'Fifth-wheel coupling plane standard is 1.15m');
  assert.equal(conventions.wheelGroundContactPlaneY, 0.0, 'Ground contact plane standard is Y=0.0m');

  // 2. Road Freight Vehicles Dimensions
  const primeMover = roadVehicles.standards.heavyPrimeMover6x4;
  assert.ok(primeMover.nominalDimensions.width <= 2.6 && primeMover.nominalDimensions.width >= 2.4, 'Truck width must conform to international road vehicle laws (2.4m - 2.6m)');
  assert.ok(primeMover.nominalDimensions.height <= 4.2 && primeMover.nominalDimensions.height >= 3.6, 'Truck height must conform to bridge clearance laws (3.6m - 4.2m)');

  const container40 = roadVehicles.standards.isoContainer40ft;
  assert.ok(Math.abs(container40.nominalDimensions.length - 12.192) < 0.01, 'ISO 40ft container length must match 12.192m standard');
  assert.ok(Math.abs(container40.nominalDimensions.width - 2.438) < 0.01, 'ISO 40ft container width must match 2.438m standard');

  // 3. Infrastructure specifications
  const lane = roadInfrastructure.standards.standardTravelLane;
  assert.ok(lane.nominalDimensions.width >= 3.2 && lane.nominalDimensions.width <= 3.8, 'Standard travel lane must be between 3.2m and 3.8m');

  // 4. Loading bay standards
  const bay = buildingInfrastructure.standards.standardTruckLoadingBay;
  assert.ok(bay.nominalDimensions.width >= 3.0, 'Loading bay door width must accommodate 2.5m vehicle with clearance');
  assert.ok(bay.nominalDimensions.height >= 4.0, 'Loading bay door height must accommodate 4.0m vehicle with clearance');
  assert.equal(bay.dockFloorHeight, 1.2, 'Standard industrial dock floor height is 1.2m');

  // 5. Future modes groundings
  assert.equal(railwayInfrastructure.standards.standardTrackGauge.trackGauge, 1.435, 'Standard rail gauge is 1.435m');
  assert.ok(maritimeInfrastructure.standards.feederContainerVessel.nominalDimensions.length >= 100, 'Container feeder vessel dimensions must be realistic');
  assert.ok(aviationInfrastructure.standards.airportRunwayStrip.nominalDimensions.width >= 40, 'Runway width standard is 45m');
  assert.ok(humanReferences.standards.averageHuman.nominalDimensions.height >= 1.7, 'Human reference height is 1.78m');
});

test('WorldScaleValidator - Spatial validation formulas', () => {
  // Lane clearance: 2.5m truck in 3.5m lane (0.5m margin per side) -> PASS
  const laneOk = WorldScaleValidator.validateLaneClearance(2.5, 3.5);
  assert.equal(laneOk.passes, true);
  assert.equal(laneOk.clearancePerSide, 0.5);

  // Oversized truck in narrow alley: 3.2m vehicle in 3.4m lane (0.1m margin per side < 0.3m min) -> FAIL
  const laneFail = WorldScaleValidator.validateLaneClearance(3.2, 3.4);
  assert.equal(laneFail.passes, false);

  // Loading dock clearance: 2.5m W x 4.0m H vehicle in 3.2m W x 4.2m H bay -> PASS
  const dockOk = WorldScaleValidator.validateDockClearance(2.5, 4.0, 3.2, 4.2);
  assert.equal(dockOk.passes, true);
  assert.ok(dockOk.widthMargin >= 0.7);
  assert.ok(dockOk.heightMargin >= 0.2);

  // Dock fail: 2.8m W vehicle in 2.9m W door -> FAIL
  const dockFail = WorldScaleValidator.validateDockClearance(2.8, 4.0, 2.9, 4.2);
  assert.equal(dockFail.passes, false);

  // Overhead clearance: 4.05m high-cube vehicle under 5.2m bridge -> PASS (1.15m margin >= 0.5m)
  const overheadOk = WorldScaleValidator.validateOverheadClearance(4.05, 5.2);
  assert.equal(overheadOk.passes, true);
  assert.ok(overheadOk.clearanceMargin >= 1.0);

  // Overhead fail: 4.8m oversized rig under 5.0m bridge -> FAIL (0.2m margin < 0.5m)
  const overheadFail = WorldScaleValidator.validateOverheadClearance(4.8, 5.0);
  assert.equal(overheadFail.passes, false);
});
