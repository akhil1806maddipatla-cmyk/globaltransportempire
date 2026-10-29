import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';

export type EntityType = 'building' | 'road' | 'vehicle' | 'prop' | 'plot';

export abstract class Entity implements IDisposable {
  public readonly id: string;
  public readonly name: string;
  public readonly entityType: EntityType;
  public readonly gridX: number;
  public readonly gridZ: number;
  public readonly width: number;
  public readonly depth: number;
  public readonly height: number;

  public isSelected: boolean = false;
  public isHovered: boolean = false;

  public group: THREE.Group;

  constructor(
    id: string,
    name: string,
    entityType: EntityType,
    gridX: number,
    gridZ: number,
    width: number,
    depth: number,
    height: number = 1
  ) {
    this.id = id;
    this.name = name;
    this.entityType = entityType;
    this.gridX = gridX;
    this.gridZ = gridZ;
    this.width = width;
    this.depth = depth;
    this.height = height;

    this.group = new THREE.Group();
    this.group.name = `entity_${id}`;
    // Attach entity reference for raycasting
    this.group.userData = {
      entityId: id,
      entityType,
      entityRef: this,
    };
  }

  public abstract setSelected(selected: boolean): void;
  public abstract setHovered(hovered: boolean): void;

  public update(_deltaTime: number): void {
    // Override in subclasses if animated
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
