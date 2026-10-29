import * as THREE from 'three';
import { Entity } from './Entity';
import { IDisposable } from '../core/Disposable';

export class EntityRegistry implements IDisposable {
  private entities = new Map<string, Entity>();
  private meshToEntity = new WeakMap<THREE.Object3D, Entity>();

  public register(entity: Entity): void {
    this.entities.set(entity.id, entity);
    this.mapObjectTree(entity.group, entity);
  }

  private mapObjectTree(obj: THREE.Object3D, entity: Entity): void {
    this.meshToEntity.set(obj, entity);
    for (const child of obj.children) {
      this.mapObjectTree(child, entity);
    }
  }

  public unregister(id: string): Entity | undefined {
    const entity = this.entities.get(id);
    if (entity) {
      entity.dispose();
      this.entities.delete(id);
    }
    return entity;
  }

  public get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  public getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  public findEntityFromObject(obj: THREE.Object3D | null): Entity | null {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const match = this.meshToEntity.get(curr);
      if (match) return match;
      if (curr.userData && curr.userData.entityRef) {
        return curr.userData.entityRef as Entity;
      }
      curr = curr.parent;
    }
    return null;
  }

  public update(deltaTime: number): void {
    for (const entity of this.entities.values()) {
      entity.update(deltaTime);
    }
  }

  public dispose(): void {
    for (const entity of this.entities.values()) {
      entity.dispose();
    }
    this.entities.clear();
  }
}
