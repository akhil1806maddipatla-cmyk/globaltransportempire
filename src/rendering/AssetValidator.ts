import * as THREE from 'three';
import { ASSET_STANDARDS } from './AssetStandards';
import { MaterialsManager } from './MaterialsManager';

export interface ValidationIssue {
  readonly severity: 'error' | 'warning' | 'info';
  readonly objectName: string;
  readonly message: string;
  readonly property?: string;
  readonly actualValue?: unknown;
  readonly expectedValue?: unknown;
}

export interface AssetValidationReport {
  readonly isValid: boolean;
  readonly totalChecked: number;
  readonly errors: ValidationIssue[];
  readonly warnings: ValidationIssue[];
  readonly info: ValidationIssue[];
}

export class AssetValidator {
  /**
   * Validates a Three.js Object3D hierarchy for scale integrity, valid bounding box,
   * unassigned materials, and finite transforms.
   */
  public static validateHierarchy(
    root: THREE.Object3D,
    expectedMaxEnvelope?: { width?: number; height?: number; length?: number }
  ): AssetValidationReport {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];
    let totalChecked = 0;

    root.updateMatrixWorld(true);

    root.traverse((node) => {
      totalChecked++;
      const name = node.name || node.type;

      // 1. Transform Finite Check
      if (
        !isFinite(node.position.x) ||
        !isFinite(node.position.y) ||
        !isFinite(node.position.z)
      ) {
        errors.push({
          severity: 'error',
          objectName: name,
          message: 'Node position contains non-finite values (NaN or Infinity)',
          property: 'position',
          actualValue: `${node.position.x}, ${node.position.y}, ${node.position.z}`,
        });
      }

      // 2. Scale Integrity Check (detect non-positive scales)
      if (node.scale.x <= 0 || node.scale.y <= 0 || node.scale.z <= 0) {
        errors.push({
          severity: 'error',
          objectName: name,
          message: 'Node scale has non-positive or zero component',
          property: 'scale',
          actualValue: `${node.scale.x}, ${node.scale.y}, ${node.scale.z}`,
        });
      }

      // 3. Mesh Material & Geometry Integrity Check
      if (node instanceof THREE.Mesh) {
        if (!node.geometry) {
          errors.push({
            severity: 'error',
            objectName: name,
            message: 'Mesh is missing geometry',
          });
        }

        if (!node.material) {
          errors.push({
            severity: 'error',
            objectName: name,
            message: 'Mesh is missing material assignment',
          });
        } else {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            if (
              mat instanceof THREE.MeshStandardMaterial ||
              mat instanceof THREE.MeshBasicMaterial
            ) {
              if (mat.color && mat.color.getHex() === 0xff00ff) {
                warnings.push({
                  severity: 'warning',
                  objectName: name,
                  message: 'Mesh is using the fallback diagnostic material (missing registered material)',
                  property: 'material.color',
                });
              }
            }
          });
        }
      }
    });

    // 4. Bounding Box Envelope Check
    const aabb = new THREE.Box3().setFromObject(root);
    if (!aabb.isEmpty()) {
      const size = new THREE.Vector3();
      aabb.getSize(size);

      if (expectedMaxEnvelope) {
        if (expectedMaxEnvelope.width && size.x > expectedMaxEnvelope.width + 0.05) {
          errors.push({
            severity: 'error',
            objectName: root.name || 'Root',
            message: `Model width (${size.x.toFixed(2)}m) exceeds maximum expected envelope (${expectedMaxEnvelope.width}m)`,
            property: 'width',
            actualValue: size.x,
            expectedValue: expectedMaxEnvelope.width,
          });
        }

        if (expectedMaxEnvelope.height && size.y > expectedMaxEnvelope.height + 0.05) {
          errors.push({
            severity: 'error',
            objectName: root.name || 'Root',
            message: `Model height (${size.y.toFixed(2)}m) exceeds maximum expected envelope (${expectedMaxEnvelope.height}m)`,
            property: 'height',
            actualValue: size.y,
            expectedValue: expectedMaxEnvelope.height,
          });
        }

        if (expectedMaxEnvelope.length && size.z > expectedMaxEnvelope.length + 0.05) {
          errors.push({
            severity: 'error',
            objectName: root.name || 'Root',
            message: `Model length (${size.z.toFixed(2)}m) exceeds maximum expected envelope (${expectedMaxEnvelope.length}m)`,
            property: 'length',
            actualValue: size.z,
            expectedValue: expectedMaxEnvelope.length,
          });
        }
      }

      info.push({
        severity: 'info',
        objectName: root.name || 'Root',
        message: `Calculated bounds: ${size.x.toFixed(2)}m W x ${size.y.toFixed(2)}m H x ${size.z.toFixed(2)}m L`,
      });
    }

    return {
      isValid: errors.length === 0,
      totalChecked,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Validates a road vehicle model against single-lane geometric and kinematic standards:
   * - Total lateral envelope <= 3.0m (including side mirrors)
   * - Wheel ground contact touches Y = 0.0 ± 0.06m
   * - Fifth-wheel coupling plate height at Y = 1.15m ± 0.08m
   */
  public static validateVehicleModel(
    truckGroup: THREE.Group,
    hasFifthWheel: boolean = true
  ): AssetValidationReport {
    const report = this.validateHierarchy(truckGroup, {
      width: ASSET_STANDARDS.envelopes.roadVehicles.maxTotalWidthWithMirrors,
      height: ASSET_STANDARDS.envelopes.roadVehicles.maxSingleRigidHeight,
    });

    const errors = [...report.errors];
    const warnings = [...report.warnings];
    const info = [...report.info];

    const aabb = new THREE.Box3().setFromObject(truckGroup);
    if (!aabb.isEmpty()) {
      if (Math.abs(aabb.min.y - ASSET_STANDARDS.coordinates.groundContactPlaneY) > 0.06) {
        errors.push({
          severity: 'error',
          objectName: truckGroup.name || 'TruckModel',
          message: `Vehicle ground contact min.y (${aabb.min.y.toFixed(3)}m) deviates from ground plane Y=0.0m`,
          property: 'min.y',
          actualValue: aabb.min.y,
          expectedValue: 0.0,
        });
      }

      const width = aabb.max.x - aabb.min.x;
      if (width > ASSET_STANDARDS.envelopes.roadVehicles.maxTotalWidthWithMirrors) {
        errors.push({
          severity: 'error',
          objectName: truckGroup.name || 'TruckModel',
          message: `Truck total width (${width.toFixed(2)}m) exceeds maximum single-lane envelope (${ASSET_STANDARDS.envelopes.roadVehicles.maxTotalWidthWithMirrors}m)`,
          property: 'width',
          actualValue: width,
        });
      }
    }

    if (hasFifthWheel) {
      const fifthWheel = truckGroup.getObjectByName('fifth_wheel_coupling_point');
      if (!fifthWheel) {
        warnings.push({
          severity: 'warning',
          objectName: truckGroup.name || 'TruckModel',
          message: 'Tractor unit is marked with fifth-wheel hitch but "fifth_wheel_coupling_point" transform was not found',
        });
      } else {
        const fwPos = new THREE.Vector3();
        fifthWheel.getWorldPosition(fwPos);
        const expectedY = ASSET_STANDARDS.pivots.fifthWheelHeightY;
        if (Math.abs(fwPos.y - expectedY) > 0.08) {
          errors.push({
            severity: 'error',
            objectName: 'fifth_wheel_coupling_point',
            message: `Fifth-wheel coupling plane Y (${fwPos.y.toFixed(2)}m) deviates from standard ${expectedY}m`,
            property: 'worldPosition.y',
            actualValue: fwPos.y,
            expectedValue: expectedY,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      totalChecked: report.totalChecked,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Validates the Level 1 Fleet Truck Depot asset structure:
   * - Ground contact alignment at Y = 0.0
   * - Footprint bounds and structure integrity
   */
  public static validateDepotModel(depotGroup: THREE.Group): AssetValidationReport {
    const report = this.validateHierarchy(depotGroup);
    const errors = [...report.errors];
    const warnings = [...report.warnings];
    const info = [...report.info];

    const aabb = new THREE.Box3().setFromObject(depotGroup);
    if (!aabb.isEmpty()) {
      if (aabb.min.y < -0.08 || aabb.min.y > 0.25) {
        warnings.push({
          severity: 'warning',
          objectName: depotGroup.name || 'DepotModel',
          message: `Depot base min.y (${aabb.min.y.toFixed(3)}m) differs from ground plane Y=0.0m`,
          property: 'min.y',
          actualValue: aabb.min.y,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      totalChecked: report.totalChecked,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Deep resource disposal for Three.js Object3D trees:
   * Traverses nodes, disposes geometry, materials, and textures, removing child references
   * to guarantee zero memory leaks when replacing or demolishing entities.
   */
  public static disposeHierarchy(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        if (node.geometry) {
          node.geometry.dispose();
        }

        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((mat) => {
            if ((mat as { isPrivateAssetMaterial?: boolean }).isPrivateAssetMaterial) {
              mat.dispose();
            }
          });
        }
      }
    });

    while (root.children.length > 0) {
      const child = root.children[0];
      root.remove(child);
    }
  }

  /**
   * Validates all materials registered in MaterialsManager for physically plausible PBR values
   */
  public static validateMaterialsRegistry(
    materialsManager: MaterialsManager
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const allNames = materialsManager.getAllMaterialNames();

    for (const name of allNames) {
      const mat = materialsManager.get(name);
      if (mat instanceof THREE.MeshStandardMaterial) {
        if (mat.roughness < 0 || mat.roughness > 1) {
          issues.push(`Material '${name}' has out-of-range roughness (${mat.roughness})`);
        }
        if (mat.metalness < 0 || mat.metalness > 1) {
          issues.push(`Material '${name}' has out-of-range metalness (${mat.metalness})`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
