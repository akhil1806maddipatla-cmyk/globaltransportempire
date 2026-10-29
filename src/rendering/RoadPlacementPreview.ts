import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from '../world/GridSystem';
import { GridCoord } from '../world/RoadPathGenerator';
import { RoadValidationResult } from '../world/RoadConstructionValidator';

export class RoadPlacementPreview implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;

  private pathTileMeshes: THREE.Mesh[] = [];
  private pathLineMeshes: THREE.LineSegments[] = [];

  // Start anchor marker
  private startAnchorMesh: THREE.Mesh;
  private cursorMesh: THREE.Mesh;
  private cursorOutline: THREE.LineSegments;

  // Demolition / Bulldozer marker
  private bulldozerGroup: THREE.Group;
  private bulldozerMesh: THREE.Mesh;
  private bulldozerCross: THREE.LineSegments;

  // Shared preview materials
  private validTileMaterial: THREE.MeshBasicMaterial;
  private existingTileMaterial: THREE.MeshBasicMaterial;
  private invalidTileMaterial: THREE.MeshBasicMaterial;
  private validLineMaterial: THREE.LineBasicMaterial;
  private invalidLineMaterial: THREE.LineBasicMaterial;
  private startAnchorMaterial: THREE.MeshBasicMaterial;
  private bulldozerMaterial: THREE.MeshBasicMaterial;
  private bulldozerLineMaterial: THREE.LineBasicMaterial;

  constructor(gridSystem: GridSystem) {
    this.gridSystem = gridSystem;
    this.group = new THREE.Group();
    this.group.name = 'road_placement_preview';
    this.group.visible = false;

    // Materials
    this.validTileMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.existingTileMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.invalidTileMaterial = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.65,
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

    this.startAnchorMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.bulldozerMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.bulldozerLineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
    });

    const cellSize = this.gridSystem.cellSize;

    // Start anchor marker (cylinder pin)
    const anchorGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 16);
    this.startAnchorMesh = new THREE.Mesh(anchorGeo, this.startAnchorMaterial);
    this.startAnchorMesh.position.y = 0.25;
    this.startAnchorMesh.visible = false;
    this.group.add(this.startAnchorMesh);

    // Cursor indicator
    const planeGeo = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
    this.cursorMesh = new THREE.Mesh(planeGeo, this.validTileMaterial);
    this.cursorMesh.rotation.x = -Math.PI / 2;
    this.cursorMesh.position.y = 0.05;
    this.group.add(this.cursorMesh);

    const edgesGeo = new THREE.EdgesGeometry(planeGeo);
    this.cursorOutline = new THREE.LineSegments(edgesGeo, this.validLineMaterial);
    this.cursorOutline.rotation.x = -Math.PI / 2;
    this.cursorOutline.position.y = 0.052;
    this.group.add(this.cursorOutline);

    // Bulldozer highlight group
    this.bulldozerGroup = new THREE.Group();
    this.bulldozerGroup.visible = false;

    this.bulldozerMesh = new THREE.Mesh(planeGeo, this.bulldozerMaterial);
    this.bulldozerMesh.rotation.x = -Math.PI / 2;
    this.bulldozerMesh.position.y = 0.06;
    this.bulldozerGroup.add(this.bulldozerMesh);

    // X cross mark for bulldozer
    const crossGeo = new THREE.BufferGeometry();
    const half = (cellSize * 0.7) / 2;
    const crossVerts = new Float32Array([
      -half, 0.07, -half,
       half, 0.07,  half,
      -half, 0.07,  half,
       half, 0.07, -half,
    ]);
    crossGeo.setAttribute('position', new THREE.BufferAttribute(crossVerts, 3));
    this.bulldozerCross = new THREE.LineSegments(crossGeo, this.bulldozerLineMaterial);
    this.bulldozerGroup.add(this.bulldozerCross);

    this.group.add(this.bulldozerGroup);
  }

  public updateHoverCursor(gridX: number, gridZ: number, isValid: boolean): void {
    const center = this.gridSystem.gridToWorldCenter(gridX, gridZ);
    this.cursorMesh.position.set(center.x, 0.05, center.z);
    this.cursorOutline.position.set(center.x, 0.052, center.z);

    this.cursorMesh.material = isValid ? this.validTileMaterial : this.invalidTileMaterial;
    this.cursorOutline.material = isValid ? this.validLineMaterial : this.invalidLineMaterial;
    this.cursorMesh.visible = true;
    this.cursorOutline.visible = true;
  }

  public updateBulldozerPreview(gridX: number, gridZ: number, hasRoad: boolean): void {
    const center = this.gridSystem.gridToWorldCenter(gridX, gridZ);
    this.bulldozerGroup.position.set(center.x, 0, center.z);
    this.bulldozerGroup.visible = hasRoad;
    this.cursorMesh.visible = !hasRoad;
    this.cursorOutline.visible = !hasRoad;
    if (!hasRoad) {
      this.cursorMesh.position.set(center.x, 0.05, center.z);
      this.cursorOutline.position.set(center.x, 0.052, center.z);
      this.cursorMesh.material = this.invalidTileMaterial;
      this.cursorOutline.material = this.invalidLineMaterial;
    }
  }

  public hideBulldozerPreview(): void {
    this.bulldozerGroup.visible = false;
  }

  public setStartAnchor(start: GridCoord | null): void {
    if (!start) {
      this.startAnchorMesh.visible = false;
      return;
    }
    const center = this.gridSystem.gridToWorldCenter(start.x, start.z);
    this.startAnchorMesh.position.set(center.x, 0.25, center.z);
    this.startAnchorMesh.visible = true;
  }

  public updatePathPreview(
    path: GridCoord[],
    validation: RoadValidationResult | null,
    existingCellsLookup: Set<string>
  ): void {
    this.clearPathMeshes();

    if (!path || path.length === 0) return;

    const cellSize = this.gridSystem.cellSize;
    const isOverallValid = validation ? validation.isValid : true;

    const planeGeo = new THREE.PlaneGeometry(cellSize * 0.94, cellSize * 0.94);
    const edgesGeo = new THREE.EdgesGeometry(planeGeo);

    for (let i = 0; i < path.length; i++) {
      const coord = path[i];
      const key = `${coord.x},${coord.z}`;
      const isExisting = existingCellsLookup.has(key);

      let tileMat = isOverallValid
        ? (isExisting ? this.existingTileMaterial : this.validTileMaterial)
        : this.invalidTileMaterial;
      let lineMat = isOverallValid ? this.validLineMaterial : this.invalidLineMaterial;

      const center = this.gridSystem.gridToWorldCenter(coord.x, coord.z);

      const mesh = new THREE.Mesh(planeGeo, tileMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(center.x, 0.048 + i * 0.0005, center.z);
      this.group.add(mesh);
      this.pathTileMeshes.push(mesh);

      const line = new THREE.LineSegments(edgesGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(center.x, 0.05 + i * 0.0005, center.z);
      this.group.add(line);
      this.pathLineMeshes.push(line);
    }
  }

  public clearPathMeshes(): void {
    for (const mesh of this.pathTileMeshes) {
      this.group.remove(mesh);
    }
    this.pathTileMeshes = [];

    for (const line of this.pathLineMeshes) {
      this.group.remove(line);
    }
    this.pathLineMeshes = [];
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      this.clearPathMeshes();
      this.startAnchorMesh.visible = false;
      this.bulldozerGroup.visible = false;
    }
  }

  public dispose(): void {
    this.clearPathMeshes();

    this.startAnchorMesh.geometry.dispose();
    this.cursorMesh.geometry.dispose();
    this.cursorOutline.geometry.dispose();
    this.bulldozerMesh.geometry.dispose();
    this.bulldozerCross.geometry.dispose();

    this.validTileMaterial.dispose();
    this.existingTileMaterial.dispose();
    this.invalidTileMaterial.dispose();
    this.validLineMaterial.dispose();
    this.invalidLineMaterial.dispose();
    this.startAnchorMaterial.dispose();
    this.bulldozerMaterial.dispose();
    this.bulldozerLineMaterial.dispose();

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
