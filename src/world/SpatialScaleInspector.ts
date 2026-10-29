import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from './GridSystem';
import { EntityRegistry } from '../entities/EntityRegistry';
import { VehicleEntity } from '../entities/vehicles/VehicleEntity';
import { BuildingEntity } from '../entities/BuildingEntity';
import { RoadNetwork } from './RoadNetwork';
import { WORLD_SCALE_STANDARDS, WorldScaleValidator } from '../data/worldScale';

export interface SpatialAuditItem {
  id: string;
  category: 'road_clearance' | 'dock_clearance' | 'overhead_clearance' | 'coupling' | 'ground_contact';
  subject: string;
  target: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  measuredValue: string;
  standardValue: string;
  margin: string;
  details: string;
}

export interface SpatialScaleAuditSummary {
  timestamp: number;
  totalChecks: number;
  passedChecks: number;
  warningsCount: number;
  failedChecks: number;
  overallStatus: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'NON_COMPLIANT';
  items: SpatialAuditItem[];
}

/**
 * 3D Spatial Scale Inspector & Validation Visualizer
 * Renders real-time bounding boxes, dimension callouts, clearance envelopes,
 * and lane alignment guides directly inside the Three.js viewport.
 */
export class SpatialScaleInspector implements IDisposable {
  public readonly group: THREE.Group;
  private scene: THREE.Scene;
  private gridSystem: GridSystem;
  private entityRegistry: EntityRegistry;
  private roadNetwork: RoadNetwork;

  public isEnabled: boolean = false;
  private visualObjects: THREE.Object3D[] = [];

  constructor(
    scene: THREE.Scene,
    gridSystem: GridSystem,
    entityRegistry: EntityRegistry,
    roadNetwork: RoadNetwork
  ) {
    this.scene = scene;
    this.gridSystem = gridSystem;
    this.entityRegistry = entityRegistry;
    this.roadNetwork = roadNetwork;

    this.group = new THREE.Group();
    this.group.name = 'spatial_scale_inspector_overlay';
    this.group.visible = false;
    this.scene.add(this.group);
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.group.visible = enabled;
    if (enabled) {
      this.refreshVisuals();
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  /**
   * Rebuilds all 3D inspection overlays: wireframe bounding boxes,
   * dimension callout rings, clearance envelopes, and lane margin markers.
   */
  public refreshVisuals(): void {
    this.clearVisuals();
    if (!this.isEnabled) return;

    this.renderRoadLaneEnvelopes();
    this.renderVehicleBoundingBoxes();
    this.renderBuildingBoundingBoxes();
  }

  private clearVisuals(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        if (child.geometry) child.geometry.dispose();
      }
    }
    this.visualObjects = [];
  }

  /**
   * Renders road travel lane clearance boundaries and overhead safety envelope
   */
  private renderRoadLaneEnvelopes(): void {
    const roadCells = this.roadNetwork.model.getAllRoadCells();
    const cellSize = this.gridSystem.cellSize;
    const laneWidth = 3.5; // Standard 3.5m travel lane
    const overheadHeight = 5.2; // Standard 5.2m overhead bridge clearance

    const laneMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    });

    const envelopeMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35,
      depthTest: true,
    });

    for (const cell of roadCells) {
      const center = this.gridSystem.gridToWorldCenter(cell.gridX, cell.gridZ);

      // 1. Lane boundary guide lines on road surface
      const points: THREE.Vector3[] = [];
      const halfLane = laneWidth / 2;

      // Draw dashed lane guidelines
      points.push(new THREE.Vector3(center.x - halfLane, 0.08, center.z - cellSize / 2));
      points.push(new THREE.Vector3(center.x - halfLane, 0.08, center.z + cellSize / 2));
      points.push(new THREE.Vector3(center.x + halfLane, 0.08, center.z - cellSize / 2));
      points.push(new THREE.Vector3(center.x + halfLane, 0.08, center.z + cellSize / 2));

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const lines = new THREE.LineSegments(geo, laneMat);
      this.group.add(lines);

      // 2. Overhead clearance portal marker at key intersections
      if (cell.connections.north && cell.connections.south && cell.connections.east) {
        const portalGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(center.x - halfLane - 0.2, 0, center.z),
          new THREE.Vector3(center.x - halfLane - 0.2, overheadHeight, center.z),
          new THREE.Vector3(center.x + halfLane + 0.2, overheadHeight, center.z),
          new THREE.Vector3(center.x + halfLane + 0.2, 0, center.z),
        ]);
        const portalLine = new THREE.Line(portalGeo, envelopeMat);
        this.group.add(portalLine);
      }
    }
  }

  /**
   * Renders color-coded 3D oriented bounding boxes for Prime Movers, Trailers, and Containers
   */
  private renderVehicleBoundingBoxes(): void {
    const vehicles = this.entityRegistry.getAll().filter((e) => e instanceof VehicleEntity) as VehicleEntity[];

    for (const veh of vehicles) {
      const truckDef = veh.truckDefinition;
      const tDim = truckDef.dimensions;

      // 1. Prime Mover Tractor Bounding Wireframe (Cyan)
      const truckBoxGeo = new THREE.BoxGeometry(tDim.width, tDim.height, tDim.length);
      const truckEdges = new THREE.EdgesGeometry(truckBoxGeo);
      const truckLine = new THREE.LineSegments(
        truckEdges,
        new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 })
      );
      truckLine.position.set(0, tDim.height / 2, 0);

      const truckOverlayGroup = new THREE.Group();
      truckOverlayGroup.position.copy(veh.group.position);
      truckOverlayGroup.rotation.copy(veh.group.rotation);
      truckOverlayGroup.add(truckLine);

      // Ground contact baseline (Green Y=0.00 indicator)
      const groundPoints = [
        new THREE.Vector3(-tDim.width / 2 - 0.2, 0.04, -tDim.length / 2),
        new THREE.Vector3(tDim.width / 2 + 0.2, 0.04, -tDim.length / 2),
        new THREE.Vector3(tDim.width / 2 + 0.2, 0.04, tDim.length / 2),
        new THREE.Vector3(-tDim.width / 2 - 0.2, 0.04, tDim.length / 2),
        new THREE.Vector3(-tDim.width / 2 - 0.2, 0.04, -tDim.length / 2),
      ];
      const groundGeo = new THREE.BufferGeometry().setFromPoints(groundPoints);
      const groundLine = new THREE.Line(
        groundGeo,
        new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 })
      );
      truckOverlayGroup.add(groundLine);

      // Fifth-wheel hitch alignment height marker (Y=1.15m)
      if (truckDef.hasFifthWheel) {
        const fwOffset = truckDef.fifthWheelOffset;
        const fwRingGeo = new THREE.RingGeometry(0.35, 0.45, 16);
        const fwRing = new THREE.Mesh(
          fwRingGeo,
          new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
        );
        fwRing.rotation.x = Math.PI / 2;
        fwRing.position.set(fwOffset.x, fwOffset.y, fwOffset.z);
        truckOverlayGroup.add(fwRing);
      }

      this.group.add(truckOverlayGroup);

      // 2. Trailer & Container Bounding Wireframe (Amber & Emerald)
      if (veh.trailerDefinition) {
        const trDef = veh.trailerDefinition;
        const trDim = trDef.dimensions;
        const totalTrailerH = veh.containerDefinition ? trDim.height + 2.59 : trDim.height;

        const trailerBoxGeo = new THREE.BoxGeometry(trDim.width, totalTrailerH, trDim.length);
        const trailerEdges = new THREE.EdgesGeometry(trailerBoxGeo);
        const trailerLine = new THREE.LineSegments(
          trailerEdges,
          new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 })
        );
        trailerLine.position.set(0, totalTrailerH / 2, 0);

        const trailerOverlay = new THREE.Group();
        // Position at vehicle position with trailer kingpin offset
        trailerOverlay.position.copy(veh.group.position);
        trailerOverlay.rotation.copy(veh.group.rotation);

        const kpZ = truckDef.fifthWheelOffset.z - trDef.dimensions.length * 0.38;
        trailerOverlay.translateZ(kpZ);
        trailerOverlay.add(trailerLine);

        this.group.add(trailerOverlay);
      }
    }
  }

  /**
   * Renders color-coded wireframe bounding boxes and loading dock clearance frames for Buildings
   */
  private renderBuildingBoundingBoxes(): void {
    const buildings = this.entityRegistry.getAll().filter((e) => e instanceof BuildingEntity) as BuildingEntity[];
    const cellSize = this.gridSystem.cellSize;

    for (const bld of buildings) {
      const def = bld.definition;
      const bldW = def.footprintWidth * cellSize;
      const bldD = def.footprintDepth * cellSize;
      const bldH = def.height;

      // 1. Building Footprint & Volume Envelope (Purple / Indigo wireframe)
      const boxGeo = new THREE.BoxGeometry(bldW, bldH, bldD);
      const boxEdges = new THREE.EdgesGeometry(boxGeo);
      const bldLine = new THREE.LineSegments(
        boxEdges,
        new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.7 })
      );
      bldLine.position.set(0, bldH / 2, 0);

      const bldOverlay = new THREE.Group();
      bldOverlay.position.copy(bld.group.position);
      bldOverlay.rotation.copy(bld.group.rotation);
      bldOverlay.add(bldLine);

      // 2. Loading Dock Clearance Portals (3.2m W x 4.2m H)
      if (def.category === 'logistics' || def.category === 'industrial') {
        const dockDoorW = 3.2;
        const dockDoorH = 4.2;
        const dockPortalGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-dockDoorW / 2, 0, bldD / 2 + 0.1),
          new THREE.Vector3(-dockDoorW / 2, dockDoorH, bldD / 2 + 0.1),
          new THREE.Vector3(dockDoorW / 2, dockDoorH, bldD / 2 + 0.1),
          new THREE.Vector3(dockDoorW / 2, 0, bldD / 2 + 0.1),
        ]);
        const dockLine = new THREE.Line(
          dockPortalGeo,
          new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
        );
        bldOverlay.add(dockLine);
      }

      this.group.add(bldOverlay);
    }
  }

  /**
   * Generates a comprehensive real-time spatial scale audit report
   */
  public performFullAudit(): SpatialScaleAuditSummary {
    return this.generateAuditReport();
  }

  /**
   * Generates a comprehensive real-time spatial scale audit report
   */
  public generateAuditReport(): SpatialScaleAuditSummary {
    const items: SpatialAuditItem[] = [];
    const vehicles = this.entityRegistry.getAll().filter((e) => e instanceof VehicleEntity) as VehicleEntity[];
    const buildings = this.entityRegistry.getAll().filter((e) => e instanceof BuildingEntity) as BuildingEntity[];

    // 1. Road Vehicles vs Travel Lane Width Checks
    const laneWidth = 3.5;
    for (const veh of vehicles) {
      const truckDef = veh.truckDefinition;
      const laneValidation = WorldScaleValidator.validateLaneClearance(truckDef.dimensions.width, laneWidth);

      items.push({
        id: `audit_lane_${veh.id}`,
        category: 'road_clearance',
        subject: `${truckDef.name} (${veh.id})`,
        target: `Standard Travel Lane (3.50m)`,
        status: laneValidation.passes ? 'PASS' : 'FAIL',
        measuredValue: `${truckDef.dimensions.width.toFixed(2)}m W`,
        standardValue: `${laneWidth.toFixed(2)}m Lane`,
        margin: `+${laneValidation.clearancePerSide.toFixed(2)}m / side`,
        details: laneValidation.message,
      });

      // 2. Articulated Trailer Docking Clearance
      if (veh.trailerDefinition) {
        const trDef = veh.trailerDefinition;
        const dockDoorW = 3.2;
        const dockDoorH = 4.2;
        const loadedH = veh.containerDefinition ? trDef.dimensions.height + 2.59 : trDef.dimensions.height;

        const dockValidation = WorldScaleValidator.validateDockClearance(
          trDef.dimensions.width,
          loadedH,
          dockDoorW,
          dockDoorH
        );

        items.push({
          id: `audit_dock_${veh.id}`,
          category: 'dock_clearance',
          subject: `${trDef.name}`,
          target: `Industrial Bay Door (${dockDoorW.toFixed(2)}m x ${dockDoorH.toFixed(2)}m)`,
          status: dockValidation.passes ? 'PASS' : 'FAIL',
          measuredValue: `${trDef.dimensions.width.toFixed(2)}m W x ${loadedH.toFixed(2)}m H`,
          standardValue: `${dockDoorW.toFixed(2)}m x ${dockDoorH.toFixed(2)}m`,
          margin: `+${(dockValidation.widthMargin / 2).toFixed(2)}m lat / +${dockValidation.heightMargin.toFixed(2)}m vert`,
          details: dockValidation.message,
        });

        // 3. Overhead Clearance Verification
        const overheadValidation = WorldScaleValidator.validateOverheadClearance(loadedH, 5.2);
        items.push({
          id: `audit_overhead_${veh.id}`,
          category: 'overhead_clearance',
          subject: `Combined Rig Height (${veh.id})`,
          target: `Overhead Bridge Envelope (5.20m)`,
          status: overheadValidation.passes ? 'PASS' : 'FAIL',
          measuredValue: `${loadedH.toFixed(2)}m Max Height`,
          standardValue: `5.20m Min Clearance`,
          margin: `+${overheadValidation.clearanceMargin.toFixed(2)}m safety headroom`,
          details: overheadValidation.message,
        });

        // 4. Coupling Kingpin Alignment Check
        const kpY = trDef.kingpinOffset.y;
        const fwY = truckDef.fifthWheelOffset.y;
        const couplingDiff = Math.abs(kpY - fwY);
        const couplingPasses = couplingDiff < 0.05;

        items.push({
          id: `audit_coupling_${veh.id}`,
          category: 'coupling',
          subject: `Fifth-Wheel Coupling Alignment`,
          target: `Tractor Y:${fwY.toFixed(2)}m vs Kingpin Y:${kpY.toFixed(2)}m`,
          status: couplingPasses ? 'PASS' : 'FAIL',
          measuredValue: `Delta: ${(couplingDiff * 100).toFixed(1)}cm`,
          standardValue: `0.00cm (Coincident Y=1.15m)`,
          margin: couplingPasses ? 'PERFECT' : 'MISALIGNED',
          details: couplingPasses
            ? 'Fifth wheel bearing plate and trailer kingpin lock are perfectly coplanar at Y=1.15m.'
            : 'Warning: Kingpin height does not match tractor fifth wheel plate.',
        });
      }

      // 5. Ground Contact Check
      const groundY = veh.group.position.y;
      const groundPasses = Math.abs(groundY) < 0.01;
      items.push({
        id: `audit_ground_${veh.id}`,
        category: 'ground_contact',
        subject: `Wheel Ground Plane Contact (${veh.id})`,
        target: `Road Asphalt Plane (Y = 0.00m)`,
        status: groundPasses ? 'PASS' : 'FAIL',
        measuredValue: `Y = ${groundY.toFixed(3)}m`,
        standardValue: `Y = 0.000m`,
        margin: '0.00m',
        details: groundPasses
          ? 'Tire treads rest directly on the asphalt surface without ground clipping or floating.'
          : 'Defect: Vehicle elevation departs from the ground plane.',
      });
    }

    // 6. Building Height Proportions vs Vehicles
    for (const bld of buildings) {
      const def = bld.definition;
      const bldH = def.height;
      const maxTruckH = 4.05;
      const heightRatio = bldH / maxTruckH;
      const passes = heightRatio >= 1.5; // Building should be at least 1.5x vehicle height

      items.push({
        id: `audit_bld_${bld.id}`,
        category: 'dock_clearance',
        subject: `${def.name} (${bld.id})`,
        target: `Vehicle Height Ratio (min 1.5x)`,
        status: passes ? 'PASS' : 'WARNING',
        measuredValue: `${bldH.toFixed(1)}m H (${heightRatio.toFixed(1)}x truck height)`,
        standardValue: `8.0m - 14.0m Standard`,
        margin: `+${(bldH - maxTruckH).toFixed(1)}m over vehicles`,
        details: passes
          ? `Building height (${bldH.toFixed(1)}m) provides natural industrial proportions relative to 4.0m road freight vehicles.`
          : `Building height (${bldH.toFixed(1)}m) may appear small against full-size semi-trucks.`,
      });
    }

    // 7. World Dimensions & Playable Usable Area Metric
    const { width: worldW, depth: worldD, areaMetersSquared } = this.gridSystem.getWorldDimensions();
    const areaRatio = areaMetersSquared / 9216.0; // 9,216 m² was baseline 24x24 grid
    items.push({
      id: 'audit_world_area_scale',
      category: 'road_clearance',
      subject: 'Playable World Usable Domain',
      target: 'Expanded Regional Scale (target >= 4.0x baseline)',
      status: areaRatio >= 4.0 ? 'PASS' : 'WARNING',
      measuredValue: `${worldW.toFixed(0)}m x ${worldD.toFixed(0)}m (${areaMetersSquared.toLocaleString()} m²)`,
      standardValue: '96m x 96m baseline (9,216 m²)',
      margin: `${areaRatio.toFixed(2)}x expansion`,
      details: `Usable construction domain expanded to ${worldW}m x ${worldD}m (${areaRatio.toFixed(2)}x baseline land area).`,
    });

    const passedChecks = items.filter((i) => i.status === 'PASS').length;
    const warningsCount = items.filter((i) => i.status === 'WARNING').length;
    const failedChecks = items.filter((i) => i.status === 'FAIL').length;

    return {
      timestamp: Date.now(),
      totalChecks: items.length,
      passedChecks,
      warningsCount,
      failedChecks,
      overallStatus: failedChecks === 0 ? (warningsCount === 0 ? 'COMPLIANT' : 'NEEDS_ATTENTION') : 'NON_COMPLIANT',
      items,
    };
  }

  public dispose(): void {
    this.clearVisuals();
    this.scene.remove(this.group);
  }
}
