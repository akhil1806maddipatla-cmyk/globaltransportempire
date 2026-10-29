import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GridSystem } from '../world/GridSystem';
import { MaterialsManager } from './MaterialsManager';
import { GridCoord } from '../world/RoadPathGenerator';
import { RoadValidationResult } from '../world/RoadConstructionValidator';

export class RoadPathPreview implements IDisposable {
  public readonly group: THREE.Group;
  private gridSystem: GridSystem;
  private materialsManager: MaterialsManager;

  private tileMeshes: THREE.Mesh[] = [];
  private startMarker: THREE.Mesh;
  private endMarker: THREE.Mesh;
  private sharedTileGeo: THREE.PlaneGeometry;

  constructor(gridSystem: GridSystem, materialsManager: MaterialsManager) {
    this.gridSystem = gridSystem;
    this.materialsManager = materialsManager;

    this.group = new THREE.Group();
    this.group.name = 'road_path_preview';
    this.group.visible = false;

    const cellSize = this.gridSystem.cellSize;
    this.sharedTileGeo = new THREE.PlaneGeometry(cellSize - 0.06, cellSize - 0.06);

    // Start / End waypoint rings
    const ringGeo = new THREE.RingGeometry(0.3, 0.55, 16);
    ringGeo.rotateX(-Math.PI / 2);

    const startMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const endMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.startMarker = new THREE.Mesh(ringGeo, startMat);
    this.startMarker.position.y = 0.06;
    this.startMarker.visible = false;
    this.group.add(this.startMarker);

    this.endMarker = new THREE.Mesh(ringGeo, endMat);
    this.endMarker.position.y = 0.06;
    this.endMarker.visible = false;
    this.group.add(this.endMarker);
  }

  public updatePath(
    path: GridCoord[],
    validation: RoadValidationResult
  ): void {
    const activeMat = validation.isValid
      ? this.materialsManager.get('road_preview_valid')
      : this.materialsManager.get('road_preview_invalid');

    // Ensure enough mesh tiles in pool
    while (this.tileMeshes.length < path.length) {
      const mesh = new THREE.Mesh(this.sharedTileGeo, activeMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.05;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.tileMeshes.push(mesh);
    }

    // Position active tiles
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      const center = this.gridSystem.gridToWorldCenter(cell.x, cell.z);
      const mesh = this.tileMeshes[i];

      mesh.position.set(center.x, 0.05, center.z);
      mesh.material = activeMat;
      mesh.visible = true;
    }

    // Hide extra unused pool tiles
    for (let i = path.length; i < this.tileMeshes.length; i++) {
      this.tileMeshes[i].visible = false;
    }

    // Position Start & End markers
    if (path.length > 0) {
      const startCenter = this.gridSystem.gridToWorldCenter(path[0].x, path[0].z);
      this.startMarker.position.set(startCenter.x, 0.06, startCenter.z);
      this.startMarker.visible = true;

      const endCenter = this.gridSystem.gridToWorldCenter(path[path.length - 1].x, path[path.length - 1].z);
      this.endMarker.position.set(endCenter.x, 0.06, endCenter.z);
      this.endMarker.visible = true;
    } else {
      this.startMarker.visible = false;
      this.endMarker.visible = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      for (const m of this.tileMeshes) {
        m.visible = false;
      }
      this.startMarker.visible = false;
      this.endMarker.visible = false;
    }
  }

  public getVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.sharedTileGeo.dispose();
    this.startMarker.geometry.dispose();
    this.endMarker.geometry.dispose();

    for (const mesh of this.tileMeshes) {
      this.group.remove(mesh);
    }
    this.tileMeshes = [];

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
