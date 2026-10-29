import * as THREE from 'three';
import { Entity } from '../Entity';
import {
  VehicleDefinition,
  TrailerDefinition,
  ContainerDefinition,
  FleetColor,
} from '../../data/vehicleDefinitions';
import { MaterialsManager } from '../../rendering/MaterialsManager';
import { CargoTruckModel } from './CargoTruckModel';
import { TrailerModel } from './TrailerModel';
import { ShippingContainerModel } from './ShippingContainerModel';

/**
 * Composite Road Freight Vehicle Entity
 * Integrates prime mover truck, articulated semi-trailer, and intermodal shipping container
 * with unified selection, steering, articulation, lighting, and lifecycle management.
 */
export class VehicleEntity extends Entity {
  public readonly truckDefinition: VehicleDefinition;
  public trailerDefinition: TrailerDefinition | null = null;
  public containerDefinition: ContainerDefinition | null = null;

  public readonly materialsManager: MaterialsManager;
  public readonly truckModel: CargoTruckModel;
  public trailerModel: TrailerModel | null = null;
  public containerModel: ShippingContainerModel | null = null;
  public paintColor: FleetColor;

  // Hierarchical trailer articulation pivot
  public readonly trailerPivot: THREE.Group;

  // Selection & Ground Contact Shadow
  private selectionMesh: THREE.Group | null = null;
  private contactShadow: THREE.Mesh | null = null;

  // Articulation and animation state
  private articulationAngleRad: number = 0;
  private flashTimer: number = 0;
  private flashState: boolean = false;

  // Calibrated render scale so prime mover (originally 6.8m x 2.4m) scales to ~4.08m x 1.44m,
  // fitting cleanly inside a 1.8m road lane and depot parking bay without overlapping
  public static readonly VEHICLE_RENDER_SCALE = 0.60;

  constructor(
    id: string,
    truckDefinition: VehicleDefinition,
    gridX: number,
    gridZ: number,
    worldX: number,
    worldZ: number,
    materialsManager: MaterialsManager,
    options: {
      rotationDegrees?: number;
      trailerDefinition?: TrailerDefinition | null;
      containerDefinition?: ContainerDefinition | null;
      paintColor?: FleetColor;
      worldY?: number;
    } = {}
  ) {
    const totalLength =
      options.trailerDefinition
        ? truckDefinition.dimensions.length + options.trailerDefinition.dimensions.length * 0.75
        : truckDefinition.dimensions.length;

    super(
      id,
      truckDefinition.name,
      'vehicle',
      gridX,
      gridZ,
      Math.ceil(truckDefinition.dimensions.width / 2),
      Math.ceil(totalLength / 2),
      truckDefinition.dimensions.height
    );

    this.truckDefinition = truckDefinition;
    this.materialsManager = materialsManager;

    const spawnY = options.worldY !== undefined ? options.worldY : 0.042;
    this.group.position.set(worldX, spawnY, worldZ);
    const rotDeg = options.rotationDegrees ?? 0;
    this.group.rotation.y = (rotDeg * Math.PI) / 180;

    // 1. Build Cargo Truck Model with scaled transform
    this.paintColor = options.paintColor ?? truckDefinition.defaultColor;
    this.truckModel = new CargoTruckModel(
      truckDefinition,
      materialsManager,
      this.paintColor
    );
    this.truckModel.group.scale.setScalar(VehicleEntity.VEHICLE_RENDER_SCALE);
    this.group.add(this.truckModel.group);

    // 2. Articulation Pivot anchored at the Truck's Fifth Wheel
    this.trailerPivot = new THREE.Group();
    this.trailerPivot.name = 'trailer_articulation_pivot';
    this.trailerPivot.scale.setScalar(VehicleEntity.VEHICLE_RENDER_SCALE);
    this.trailerPivot.position.set(
      truckDefinition.fifthWheelOffset.x * VehicleEntity.VEHICLE_RENDER_SCALE,
      truckDefinition.fifthWheelOffset.y * VehicleEntity.VEHICLE_RENDER_SCALE,
      truckDefinition.fifthWheelOffset.z * VehicleEntity.VEHICLE_RENDER_SCALE
    );
    this.group.add(this.trailerPivot);

    // 3. Attach Trailer if defined
    if (options.trailerDefinition) {
      this.attachTrailer(options.trailerDefinition);
    }

    // 4. Mount Container if defined
    if (options.containerDefinition) {
      this.mountContainer(options.containerDefinition);
    }

    // 5. Contact Shadow & Selection Visuals
    this.buildContactShadow();
    this.buildSelectionVisuals();
  }

  public getRenderedDimensions(): { width: number; length: number; height: number } {
    return {
      width: this.truckDefinition.dimensions.width * VehicleEntity.VEHICLE_RENDER_SCALE,
      length: (this.trailerDefinition ? 16.5 : this.truckDefinition.dimensions.length) * VehicleEntity.VEHICLE_RENDER_SCALE,
      height: this.truckDefinition.dimensions.height * VehicleEntity.VEHICLE_RENDER_SCALE,
    };
  }

  public attachTrailer(trailerDef: TrailerDefinition): void {
    if (this.trailerModel) {
      this.detachTrailer();
    }

    this.trailerDefinition = trailerDef;
    this.trailerModel = new TrailerModel(trailerDef, this.materialsManager);

    // Position trailer so its kingpin aligns with the fifth-wheel articulation pivot
    const kingpinOffset = trailerDef.kingpinOffset;
    this.trailerModel.group.position.set(
      -kingpinOffset.x,
      -kingpinOffset.y,
      -kingpinOffset.z
    );

    // Retract landing legs since trailer is hitched to the prime mover
    this.trailerModel.setLandingLegs(false);

    this.trailerPivot.add(this.trailerModel.group);
  }

  public detachTrailer(): void {
    if (!this.trailerModel) return;

    this.unmountContainer();
    this.trailerModel.setLandingLegs(true);
    this.trailerPivot.remove(this.trailerModel.group);
    this.trailerModel = null;
    this.trailerDefinition = null;
  }

  public mountContainer(containerDef: ContainerDefinition): void {
    if (this.containerModel) {
      this.unmountContainer();
    }

    this.containerDefinition = containerDef;
    this.containerModel = new ShippingContainerModel(containerDef, this.materialsManager);

    if (this.trailerModel) {
      // Mount onto trailer chassis deck
      const trailerDeckY = 1.45 + containerDef.dimensions.height / 2;
      this.containerModel.group.position.set(0, trailerDeckY, 0);
      this.trailerModel.group.add(this.containerModel.group);
    } else {
      // Mount onto truck rear deck
      const truckDeckY = 1.25 + containerDef.dimensions.height / 2;
      this.containerModel.group.position.set(0, truckDeckY, -1.2);
      this.truckModel.group.add(this.containerModel.group);
    }
  }

  public unmountContainer(): void {
    if (!this.containerModel) return;

    if (this.containerModel.group.parent) {
      this.containerModel.group.parent.remove(this.containerModel.group);
    }
    this.containerModel = null;
    this.containerDefinition = null;
  }

  // =========================================================================
  // Articulation, Steering & Simulation Controls
  // =========================================================================

  public setArticulationAngle(angleRad: number): void {
    const maxRad = (45 * Math.PI) / 180;
    const clamped = Math.max(-maxRad, Math.min(maxRad, angleRad));
    this.articulationAngleRad = clamped;
    this.trailerPivot.rotation.y = clamped;
  }

  public getArticulationAngle(): number {
    return this.articulationAngleRad;
  }

  public setSteeringAngle(angleRad: number): void {
    this.truckModel.setSteeringAngle(angleRad);
  }

  public rollWheels(deltaDistanceMeters: number): void {
    this.truckModel.rollWheels(deltaDistanceMeters);
    if (this.trailerModel) {
      this.trailerModel.rollWheels(deltaDistanceMeters);
    }
  }

  public setHeadlights(on: boolean): void {
    this.truckModel.setHeadlights(on);
  }

  public setHazardLights(on: boolean): void {
    this.truckModel.setHazardLights(on);
  }

  public setBrakeLights(on: boolean): void {
    this.truckModel.setBrakeLights(on);
  }

  public setPaintColor(color: FleetColor): void {
    this.paintColor = color;
    this.truckModel.setPaintColor(color);
  }

  public setGroundElevation(y: number): void {
    this.group.position.y = y;
  }

  // =========================================================================
  // Contact Shadow & Selection
  // =========================================================================

  private buildContactShadow(): void {
    if (typeof document === 'undefined') return;

    const scale = VehicleEntity.VEHICLE_RENDER_SCALE;
    const shadowGeo = new THREE.PlaneGeometry(2.5 * scale, 7.2 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createRadialGradient(32, 64, 12, 32, 64, 58);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });

    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.set(0, 0.02, -0.6 * scale);
    this.group.add(this.contactShadow);
  }

  private buildSelectionVisuals(): void {
    const group = new THREE.Group();
    group.name = 'vehicle_selection_indicator';
    group.visible = false;

    // Outer neon bounding selection ellipse sized to fit truck footprint
    const scale = VehicleEntity.VEHICLE_RENDER_SCALE;
    const ringMat = this.materialsManager.get('selection_ring');
    const ringGeo = new THREE.RingGeometry(1.35 * scale, 1.45 * scale, 32);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.scale(0.95, 1, 2.4);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.05, -0.6 * scale);
    group.add(ring);

    this.selectionMesh = group;
    this.group.add(this.selectionMesh);
  }

  public override setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (this.selectionMesh) {
      this.selectionMesh.visible = selected;
    }
  }

  public override setHovered(hovered: boolean): void {
    this.isHovered = hovered;
    if (this.selectionMesh && !this.isSelected) {
      this.selectionMesh.visible = hovered;
    }
  }

  public override update(deltaTime: number): void {
    // Pulse hazard lights / turn signals at 2Hz
    this.flashTimer += deltaTime;
    if (this.flashTimer >= 0.5) {
      this.flashTimer -= 0.5;
      this.flashState = !this.flashState;
      this.truckModel.updateLightsFlash(this.flashState);
    }
  }

  public override dispose(): void {
    super.dispose();
  }
}
