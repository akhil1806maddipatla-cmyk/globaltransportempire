import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { GameState } from '../game/GameState';
import { WorldManager } from '../world/WorldManager';
import { VehicleEntity } from '../entities/vehicles/VehicleEntity';
import { VehicleRouteProgressInfo } from '../world/traffic/TrafficTypes';

/**
 * RouteVisualizer
 * Renders an elevated 3D animated route ribbon and destination beacon
 * for the currently selected vehicle in Global Transport Empire.
 *
 * Ensures:
 * - 0 visual clutter: strictly renders for the selected vehicle.
 * - Accurate lane-level trajectory matching the vehicle's actual waypoints.
 * - Elevation offset (y + 0.10m) and depthWrite: false to eliminate z-fighting.
 * - Dynamic path shortening as vehicle travels.
 * - Procedural animated directional pulse texture.
 * - 3D destination beacon with hover animation and ground projection ring.
 */
export class RouteVisualizer implements IDisposable {
  private scene: THREE.Scene;
  private worldManager: WorldManager;
  private gameState: GameState;

  // Root container in scene
  private rootGroup: THREE.Group;

  // Route ribbon components
  private ribbonMesh: THREE.Mesh;
  private ribbonGeometry: THREE.BufferGeometry;
  private ribbonMaterial: THREE.MeshBasicMaterial;
  private ribbonTexture: THREE.Texture;

  // Destination beacon components
  private beaconGroup: THREE.Group;
  private beaconDiamond: THREE.Mesh;
  private beaconDiamondMaterial: THREE.MeshStandardMaterial;
  private groundRing: THREE.Mesh;
  private groundRingMaterial: THREE.MeshBasicMaterial;

  private animTime: number = 0;
  private isDisposed: boolean = false;

  constructor(scene: THREE.Scene, worldManager: WorldManager, gameState: GameState) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.gameState = gameState;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'RouteVisualizer_Root';
    this.scene.add(this.rootGroup);

    // 1. Build procedural animated chevron texture
    this.ribbonTexture = this.createChevronTexture();
    this.ribbonTexture.wrapS = THREE.RepeatWrapping;
    this.ribbonTexture.wrapT = THREE.RepeatWrapping;

    // 2. Build Ribbon Mesh & Material
    this.ribbonGeometry = new THREE.BufferGeometry();
    this.ribbonMaterial = new THREE.MeshBasicMaterial({
      map: this.ribbonTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    this.ribbonMesh = new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbonMesh.visible = false;
    this.ribbonMesh.renderOrder = 10;
    this.rootGroup.add(this.ribbonMesh);

    // 3. Build Destination Beacon
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.name = 'DestinationBeacon';
    this.beaconGroup.visible = false;
    this.rootGroup.add(this.beaconGroup);

    // Diamond marker
    const diamondGeo = new THREE.OctahedronGeometry(0.55, 0);
    diamondGeo.scale(1.0, 1.8, 1.0);
    this.beaconDiamondMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber / Gold
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.beaconDiamond = new THREE.Mesh(diamondGeo, this.beaconDiamondMaterial);
    this.beaconDiamond.position.y = 2.8;
    this.beaconDiamond.castShadow = false;
    this.beaconGroup.add(this.beaconDiamond);

    // Ground projection ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.7, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.groundRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.groundRing = new THREE.Mesh(ringGeo, this.groundRingMaterial);
    this.groundRing.position.y = 0.08;
    this.groundRing.renderOrder = 9;
    this.beaconGroup.add(this.groundRing);
  }

  /**
   * Generates a procedural 64x256 glowing chevron arrow texture
   */
  private createChevronTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      const data = new Uint8Array([
        6, 182, 212, 255, 56, 189, 248, 255,
        14, 165, 233, 255, 6, 182, 212, 255,
      ]);
      const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, 64, 256);

      // Subtle cyan route track background
      ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.fillRect(8, 0, 48, 256);

      // Bright edge guide lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(8, 256);
      ctx.moveTo(56, 0);
      ctx.lineTo(56, 256);
      ctx.stroke();

      // Repeating directional chevron arrows (pointing along -V direction)
      const chevronCount = 4;
      const step = 256 / chevronCount;
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < chevronCount; i++) {
        const yCenter = i * step + step * 0.5;
        ctx.beginPath();
        ctx.moveTo(14, yCenter + 14);
        ctx.lineTo(32, yCenter - 10);
        ctx.lineTo(50, yCenter + 14);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Per-frame animation tick
   */
  public update(dt: number): void {
    if (this.isDisposed) return;
    this.animTime += dt;

    // 1. Check currently selected entity
    const selectedId = this.gameState.getSelectedEntityId();
    if (!selectedId) {
      this.hide();
      return;
    }

    const entity = this.worldManager.entityRegistry.get(selectedId);
    if (!entity || !(entity instanceof VehicleEntity)) {
      this.hide();
      return;
    }

    // 2. Query route progress from TrafficSimulationManager
    const progress: VehicleRouteProgressInfo | null =
      this.worldManager.getVehicleRouteProgress(selectedId);

    if (!progress || !progress.hasActiveRoute || progress.remainingWaypoints.length === 0) {
      this.hide();
      return;
    }

    // 3. Update route ribbon geometry
    this.updateRibbon(entity, progress, dt);

    // 4. Update destination beacon
    this.updateBeacon(progress, dt);
  }

  /**
   * Rebuilds ribbon vertices along the vehicle's remaining trajectory
   */
  private updateRibbon(
    vehicle: VehicleEntity,
    progress: VehicleRouteProgressInfo,
    dt: number
  ): void {
    const rawWaypoints = progress.remainingWaypoints;
    if (rawWaypoints.length === 0) {
      this.ribbonMesh.visible = false;
      return;
    }

    // Points array begins at vehicle current ground position
    const vPos = vehicle.group.position;
    const points: THREE.Vector3[] = [
      new THREE.Vector3(vPos.x, vPos.y + 0.10, vPos.z),
    ];

    for (let i = 0; i < rawWaypoints.length; i++) {
      const wp = rawWaypoints[i];
      // Ensure vertical elevation offset (+0.10m above lane waypoint)
      points.push(new THREE.Vector3(wp.x, wp.y + 0.10, wp.z));
    }

    if (points.length < 2) {
      this.ribbonMesh.visible = false;
      return;
    }

    // Animate forward texture flow along direction of travel
    this.ribbonTexture.offset.y -= dt * 1.5;

    // Color theme based on return trip vs delivery
    if (progress.isReturnTrip) {
      this.ribbonMaterial.color.setHex(0x38bdf8); // Sky blue
    } else {
      this.ribbonMaterial.color.setHex(0x10b981); // Emerald green
    }

    // Build ribbon triangle strip geometry
    const ribbonHalfWidth = 0.28; // ~0.56m total ribbon width (fits comfortably inside road lane)
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let accumulatedDist = 0;

    for (let i = 0; i < points.length; i++) {
      const cur = points[i];

      // Calculate tangent vector
      let dir = new THREE.Vector3();
      if (i < points.length - 1) {
        dir.subVectors(points[i + 1], cur);
      } else {
        dir.subVectors(cur, points[i - 1]);
      }
      dir.y = 0;
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
      } else {
        dir.set(0, 0, 1);
      }

      // Normal perpendicular to tangent on XZ plane
      const norm = new THREE.Vector3(-dir.z, 0, dir.x);

      // Left and right vertices
      const pLeft = new THREE.Vector3().copy(cur).addScaledVector(norm, ribbonHalfWidth);
      const pRight = new THREE.Vector3().copy(cur).addScaledVector(norm, -ribbonHalfWidth);

      positions.push(pLeft.x, pLeft.y, pLeft.z);
      positions.push(pRight.x, pRight.y, pRight.z);

      if (i > 0) {
        accumulatedDist += cur.distanceTo(points[i - 1]);
      }

      const vCoord = accumulatedDist * 0.45; // Texture repetition factor
      uvs.push(0.0, vCoord);
      uvs.push(1.0, vCoord);

      // Form two triangles per segment
      if (i < points.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    this.ribbonGeometry.dispose();
    this.ribbonGeometry = new THREE.BufferGeometry();
    this.ribbonGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    this.ribbonGeometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    this.ribbonGeometry.setIndex(indices);
    this.ribbonGeometry.computeVertexNormals();

    this.ribbonMesh.geometry = this.ribbonGeometry;
    this.ribbonMesh.visible = true;
  }

  /**
   * Updates destination beacon hovering, rotation, and ground ring pulse
   */
  private updateBeacon(progress: VehicleRouteProgressInfo, _dt: number): void {
    let targetX = 0;
    let targetY = 0.08;
    let targetZ = 0;

    if (progress.accessPoint) {
      targetX = progress.accessPoint.worldX;
      targetZ = progress.accessPoint.worldZ;
    } else if (progress.remainingWaypoints.length > 0) {
      const lastWp = progress.remainingWaypoints[progress.remainingWaypoints.length - 1];
      targetX = lastWp.x;
      targetY = lastWp.y;
      targetZ = lastWp.z;
    } else {
      this.beaconGroup.visible = false;
      return;
    }

    this.beaconGroup.position.set(targetX, targetY, targetZ);

    // Hover animation: 2.8m height + gentle sinusoidal oscillation
    const hoverY = 2.8 + Math.sin(this.animTime * 2.8) * 0.22;
    this.beaconDiamond.position.y = hoverY;
    this.beaconDiamond.rotation.y = this.animTime * 1.6;

    // Ground ring pulse animation
    const ringScale = 1.0 + Math.sin(this.animTime * 3.2) * 0.14;
    this.groundRing.scale.set(ringScale, ringScale, 1.0);

    // Color coordination: Gold/Amber for deliveries, Cyan for depot return
    if (progress.isReturnTrip) {
      this.beaconDiamondMaterial.color.setHex(0x38bdf8);
      this.beaconDiamondMaterial.emissive.setHex(0x0284c7);
      this.groundRingMaterial.color.setHex(0x38bdf8);
    } else {
      this.beaconDiamondMaterial.color.setHex(0xf59e0b);
      this.beaconDiamondMaterial.emissive.setHex(0xd97706);
      this.groundRingMaterial.color.setHex(0xf59e0b);
    }

    this.beaconGroup.visible = true;
  }

  /**
   * Hides all visualization artifacts
   */
  public hide(): void {
    if (this.ribbonMesh) this.ribbonMesh.visible = false;
    if (this.beaconGroup) this.beaconGroup.visible = false;
  }

  public dispose(): void {
    this.isDisposed = true;
    this.hide();

    if (this.rootGroup && this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }

    if (this.ribbonGeometry) this.ribbonGeometry.dispose();
    if (this.ribbonMaterial) this.ribbonMaterial.dispose();
    if (this.ribbonTexture) this.ribbonTexture.dispose();

    if (this.beaconDiamond && this.beaconDiamond.geometry) {
      this.beaconDiamond.geometry.dispose();
    }
    if (this.beaconDiamondMaterial) this.beaconDiamondMaterial.dispose();

    if (this.groundRing && this.groundRing.geometry) {
      this.groundRing.geometry.dispose();
    }
    if (this.groundRingMaterial) this.groundRingMaterial.dispose();
  }
}
