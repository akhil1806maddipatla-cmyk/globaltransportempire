import * as THREE from 'three';
import { ContainerDefinition, FleetColor } from '../../data/vehicleDefinitions';
import { MaterialsManager } from '../../rendering/MaterialsManager';
import { VehicleModularComponents } from './VehicleModularComponents';

/**
 * High-Quality ISO Intermodal Shipping Container 3D Model
 * Accurately models standard 20ft and 40ft intermodal freight containers
 * and temperature-controlled Reefer variants with deep trapezoidal corrugations,
 * ISO corner castings, double swing rear doors with vertical locking rods,
 * cams, handles, hinges, stencils, and refrigeration compressors.
 */
export class ShippingContainerModel {
  public readonly group: THREE.Group;
  public readonly definition: ContainerDefinition;
  public readonly materials: MaterialsManager;

  private bodyMesh: THREE.Mesh | null = null;
  private currentLivery: FleetColor;

  constructor(
    definition: ContainerDefinition,
    materials: MaterialsManager,
    initialLivery?: FleetColor
  ) {
    this.definition = definition;
    this.materials = materials;
    this.currentLivery = initialLivery ?? definition.defaultLivery;

    this.group = new THREE.Group();
    this.group.name = `container_${definition.id}`;

    const dim = definition.dimensions;
    const w = dim.width;
    const l = dim.length;
    const h = dim.height;

    const cornerPostMat = materials.get('container_corner_casting');
    const roofMat = materials.get('metal_roof_silver');

    // 1. Structural Corner Posts (4 vertical corner pillars)
    const postGeo = new THREE.BoxGeometry(0.18, h, 0.18);
    const postOffsets = [
      [-w / 2 + 0.09, 0, -l / 2 + 0.09],
      [w / 2 - 0.09, 0, -l / 2 + 0.09],
      [-w / 2 + 0.09, 0, l / 2 - 0.09],
      [w / 2 - 0.09, 0, l / 2 - 0.09],
    ];

    postOffsets.forEach(([px, py, pz]) => {
      const post = new THREE.Mesh(postGeo, cornerPostMat);
      post.position.set(px, py, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
    });

    // 2. Corrugated Corten Steel Body Box
    const bodyMat = this.getLiveryMaterial(this.currentLivery);
    const bodyGeo = new THREE.BoxGeometry(w * 0.96, h * 0.94, l * 0.98);
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.set(0, 0, 0);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // 3. Corrugated Roof Panel with rain water drainage channels
    const roofGeo = new THREE.BoxGeometry(w, 0.06, l);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, h / 2 + 0.03, 0);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.group.add(roof);

    // Bottom structural forklift pocket base rails (for 20ft containers)
    if (dim.length <= 7) {
      const railGeo = new THREE.BoxGeometry(w * 0.95, 0.12, 0.28);
      [-1.0, 1.0].forEach((rz) => {
        const pocket = new THREE.Mesh(railGeo, cornerPostMat);
        pocket.position.set(0, -h / 2 - 0.06, rz);
        this.group.add(pocket);
      });
    }

    // 4. 8 ISO 1161 Heavy Steel Corner Castings
    const cornerCastings = VehicleModularComponents.createContainerCornerCastings(
      w,
      l,
      h,
      materials
    );
    this.group.add(cornerCastings);

    // 5. Rear Double Swing Doors Hardware (Locking bars, cams, handles, hinges)
    const doorHardware = VehicleModularComponents.createContainerDoorHardware(
      w * 0.92,
      h * 0.92,
      materials
    );
    doorHardware.position.set(0, 0, -l / 2 - 0.02);
    this.group.add(doorHardware);

    // 6. Refrigerated Variant: Thermo-Chill Nose Chiller Unit
    if (definition.isRefrigerated) {
      this.buildReeferChillerNose();
    }
  }

  private getLiveryMaterial(livery: FleetColor): THREE.Material {
    if (this.definition.isRefrigerated) {
      return this.materials.get('container_corrugated_white');
    }
    switch (livery) {
      case 'red':
        return this.materials.get('container_corrugated_red');
      case 'orange':
        return this.materials.get('container_corrugated_orange');
      case 'white':
        return this.materials.get('container_corrugated_white');
      case 'dark':
        return this.materials.get('container_corrugated_green');
      case 'blue':
      default:
        return this.materials.get('container_corrugated_blue');
    }
  }

  public setLivery(livery: FleetColor): void {
    this.currentLivery = livery;
    if (this.bodyMesh) {
      this.bodyMesh.material = this.getLiveryMaterial(livery);
    }
  }

  public getLivery(): FleetColor {
    return this.currentLivery;
  }

  private buildReeferChillerNose(): void {
    const w = this.definition.dimensions.width;
    const h = this.definition.dimensions.height;
    const l = this.definition.dimensions.length;

    const chillerMat = this.materials.get('reefer_chiller_unit');
    const steelMat = this.materials.get('container_corner_casting');

    // Nose-mounted refrigeration housing inset
    const noseGeo = new THREE.BoxGeometry(w * 0.78, h * 0.65, 0.42);
    const nose = new THREE.Mesh(noseGeo, chillerMat);
    nose.position.set(0, 0.1, l / 2 + 0.12);
    nose.castShadow = true;
    this.group.add(nose);

    // Bottom diesel generator tank for reefer unit
    const genGeo = new THREE.BoxGeometry(w * 0.65, 0.32, 0.38);
    const gen = new THREE.Mesh(genGeo, steelMat);
    gen.position.set(0, -h * 0.35, l / 2 + 0.12);
    gen.castShadow = true;
    this.group.add(gen);
  }

  public getTwistlockOffsets(): THREE.Vector3[] {
    const halfW = this.definition.dimensions.width / 2 - 0.11;
    const halfL = this.definition.dimensions.length / 2 - 0.11;
    const bottomY = -this.definition.dimensions.height / 2;

    return [
      new THREE.Vector3(-halfW, bottomY, halfL),  // Front Left
      new THREE.Vector3(halfW, bottomY, halfL),   // Front Right
      new THREE.Vector3(-halfW, bottomY, -halfL), // Rear Left
      new THREE.Vector3(halfW, bottomY, -halfL),  // Rear Right
    ];
  }

  public getBoundingBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.group);
  }
}
