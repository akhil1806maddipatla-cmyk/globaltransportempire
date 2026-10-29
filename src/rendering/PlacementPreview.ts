import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from '../world/GridSystem';
import { BuildingDefinition } from '../data/buildingDefinitions';
import { PlacementValidationResult } from '../world/PlacementValidator';

export class PlacementPreview implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;

  private footprintMesh: THREE.Mesh;
  private footprintOutline: THREE.LineSegments;
  private ghostBuildingGroup: THREE.Group;
  private entranceIndicator: THREE.Group;

  // Shared preview materials
  private validMaterial: THREE.MeshBasicMaterial;
  private invalidMaterial: THREE.MeshBasicMaterial;
  private validLineMaterial: THREE.LineBasicMaterial;
  private invalidLineMaterial: THREE.LineBasicMaterial;
  private ghostMaterial: THREE.MeshStandardMaterial;
  private entranceArrowMaterial: THREE.MeshBasicMaterial;

  private currentDefinition: BuildingDefinition | null = null;
  private currentRotation: number = 0;

  constructor(gridSystem: GridSystem) {
    this.gridSystem = gridSystem;
    this.group = new THREE.Group();
    this.group.name = 'placement_preview';
    this.group.visible = false;

    // Materials
    this.validMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.invalidMaterial = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.validLineMaterial = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 2,
    });

    this.invalidLineMaterial = new THREE.LineBasicMaterial({
      color: 0xfb7185,
      linewidth: 2,
    });

    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3,
      metalness: 0.4,
      wireframe: false,
    });

    this.entranceArrowMaterial = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Hazard yellow entrance arrow
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Ground footprint plane
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    this.footprintMesh = new THREE.Mesh(planeGeo, this.validMaterial);
    this.footprintMesh.rotation.x = -Math.PI / 2;
    this.footprintMesh.position.y = 0.05;
    this.group.add(this.footprintMesh);

    // Footprint perimeter outline
    const edgesGeo = new THREE.EdgesGeometry(planeGeo);
    this.footprintOutline = new THREE.LineSegments(edgesGeo, this.validLineMaterial);
    this.footprintOutline.rotation.x = -Math.PI / 2;
    this.footprintOutline.position.y = 0.052;
    this.group.add(this.footprintOutline);

    // Directional service entrance arrow
    this.entranceIndicator = new THREE.Group();
    const arrowCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.6, 8),
      this.entranceArrowMaterial
    );
    arrowCone.rotation.x = Math.PI / 2;
    this.entranceIndicator.add(arrowCone);

    const arrowShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.05, 0.45),
      this.entranceArrowMaterial
    );
    arrowShaft.position.z = -0.4;
    this.entranceIndicator.add(arrowShaft);

    this.entranceIndicator.position.y = 0.07;
    this.group.add(this.entranceIndicator);

    // Ghost structure group
    this.ghostBuildingGroup = new THREE.Group();
    this.group.add(this.ghostBuildingGroup);
  }

  public setBuilding(definition: BuildingDefinition, rotationDegrees: number = 0): void {
    this.currentDefinition = definition;
    this.currentRotation = rotationDegrees;
    this.rebuildGhostGeometry();
  }

  public setRotation(rotationDegrees: number): void {
    this.currentRotation = rotationDegrees;
    this.rebuildGhostGeometry();
  }

  private rebuildGhostGeometry(): void {
    if (!this.currentDefinition) return;

    // Clear previous ghost meshes
    while (this.ghostBuildingGroup.children.length > 0) {
      const child = this.ghostBuildingGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      this.ghostBuildingGroup.remove(child);
    }

    const { effectiveWidth, effectiveDepth } = this.gridSystem.calculateRotatedFootprint(
      this.currentDefinition.footprintWidth,
      this.currentDefinition.footprintDepth,
      this.currentRotation
    );

    const worldW = effectiveWidth * this.gridSystem.cellSize;
    const worldD = effectiveDepth * this.gridSystem.cellSize;
    const height = this.currentDefinition.height;

    // Update footprint plane & outline
    this.footprintMesh.geometry.dispose();
    this.footprintMesh.geometry = new THREE.PlaneGeometry(worldW - 0.06, worldD - 0.06);

    this.footprintOutline.geometry.dispose();
    this.footprintOutline.geometry = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(worldW - 0.06, worldD - 0.06)
    );

    // Position entrance indicator arrow pointing toward the building's front (+Z in local coords, rotated)
    const arrowDistance = worldD / 2 + 0.5;
    const rad = (this.currentRotation * Math.PI) / 180;
    const arrowX = Math.sin(rad) * arrowDistance;
    const arrowZ = Math.cos(rad) * arrowDistance;
    this.entranceIndicator.position.set(arrowX, 0.07, arrowZ);
    this.entranceIndicator.rotation.y = rad;

    // Build multi-box ghost representing the facility silhouette
    const baseBox = new THREE.Mesh(
      new THREE.BoxGeometry(worldW - 0.2, height * 0.75, worldD - 0.2),
      this.ghostMaterial
    );
    baseBox.position.y = (height * 0.75) / 2 + 0.05;
    this.ghostBuildingGroup.add(baseBox);

    // Upper tier / roof silhouette
    const roofTier = new THREE.Mesh(
      new THREE.BoxGeometry(worldW * 0.65, height * 0.28, worldD * 0.65),
      this.ghostMaterial
    );
    roofTier.position.y = height * 0.75 + (height * 0.28) / 2 + 0.05;
    this.ghostBuildingGroup.add(roofTier);
  }

  public updateTransform(
    anchorX: number,
    anchorZ: number,
    validation: PlacementValidationResult
  ): void {
    if (!this.currentDefinition) return;

    const center = this.gridSystem.getFootprintWorldCenter(
      anchorX,
      anchorZ,
      this.currentDefinition.footprintWidth,
      this.currentDefinition.footprintDepth,
      this.currentRotation
    );

    this.group.position.set(center.x, 0, center.z);

    // Update valid/invalid styling
    if (validation.isValid) {
      this.footprintMesh.material = this.validMaterial;
      this.footprintOutline.material = this.validLineMaterial;
      this.ghostMaterial.color.setHex(0x10b981);
      this.entranceArrowMaterial.color.setHex(0x34d399);
    } else {
      this.footprintMesh.material = this.invalidMaterial;
      this.footprintOutline.material = this.invalidLineMaterial;
      this.ghostMaterial.color.setHex(0xf43f5e);
      this.entranceArrowMaterial.color.setHex(0xfb7185);
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public getVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.footprintMesh.geometry.dispose();
    this.footprintOutline.geometry.dispose();
    this.validMaterial.dispose();
    this.invalidMaterial.dispose();
    this.validLineMaterial.dispose();
    this.invalidLineMaterial.dispose();
    this.ghostMaterial.dispose();
    this.entranceArrowMaterial.dispose();

    while (this.ghostBuildingGroup.children.length > 0) {
      const child = this.ghostBuildingGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      this.ghostBuildingGroup.remove(child);
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
