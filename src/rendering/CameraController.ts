import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';

export class CameraController implements IDisposable {
  public readonly camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Camera Target (pivot point on ground plane: y = 0)
  private currentTarget = new THREE.Vector3(0, 0, 0);
  private desiredTarget = new THREE.Vector3(0, 0, 0);

  // Velocity for smooth kinetic panning with inertia
  private panVelocity = new THREE.Vector3(0, 0, 0);

  // Distance / Zoom
  private currentDistance: number;
  private desiredDistance: number;

  // Rotation angles (Isometric default: Yaw = 45 deg, Pitch = 35.264 deg)
  private currentYaw: number = Math.PI / 4;
  private desiredYaw: number = Math.PI / 4;
  private pitch: number = Math.atan(1 / Math.SQRT2); // ~35.264 degrees

  // Raycasting plane for ground intersection & zoom-to-cursor
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2(0, 0);

  // Input states
  private isDragging: boolean = false;
  private dragButton: number = -1;
  private previousMousePosition = { x: 0, y: 0 };
  private dragDistanceMoved: number = 0;
  private keysPressed: Set<string> = new Set();
  private isPointerOverCanvas: boolean = false;

  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnContextMenu: (e: MouseEvent) => void;
  private boundOnBlur: () => void;
  private boundOnPointerEnter: () => void;
  private boundOnPointerLeave: () => void;

  constructor(domElement: HTMLElement, aspect: number) {
    this.domElement = domElement;
    const config = DEFAULT_GAME_CONFIG.camera;

    this.currentDistance = config.initialDistance;
    this.desiredDistance = config.initialDistance;

    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far
    );

    this.updateCameraTransform();

    // Event bindings
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnContextMenu = (e) => e.preventDefault();
    this.boundOnBlur = () => {
      this.keysPressed.clear();
      this.isDragging = false;
      this.panVelocity.set(0, 0, 0);
    };
    this.boundOnPointerEnter = () => {
      this.isPointerOverCanvas = true;
    };
    this.boundOnPointerLeave = () => {
      this.isPointerOverCanvas = false;
    };

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.domElement.addEventListener('mousedown', this.boundOnMouseDown);
      this.domElement.addEventListener('wheel', this.boundOnWheel, { passive: false });
      this.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
      this.domElement.addEventListener('pointerenter', this.boundOnPointerEnter);
      this.domElement.addEventListener('pointerleave', this.boundOnPointerLeave);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.boundOnMouseMove);
      window.addEventListener('mouseup', this.boundOnMouseUp);
      window.addEventListener('keydown', this.boundOnKeyDown);
      window.addEventListener('keyup', this.boundOnKeyUp);
      window.addEventListener('blur', this.boundOnBlur);
    }
  }

  private detachEventListeners(): void {
    if (this.domElement && typeof this.domElement.removeEventListener === 'function') {
      this.domElement.removeEventListener('mousedown', this.boundOnMouseDown);
      this.domElement.removeEventListener('wheel', this.boundOnWheel);
      this.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);
      this.domElement.removeEventListener('pointerenter', this.boundOnPointerEnter);
      this.domElement.removeEventListener('pointerleave', this.boundOnPointerLeave);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.boundOnMouseMove);
      window.removeEventListener('mouseup', this.boundOnMouseUp);
      window.removeEventListener('keydown', this.boundOnKeyDown);
      window.removeEventListener('keyup', this.boundOnKeyUp);
      window.removeEventListener('blur', this.boundOnBlur);
    }
  }

  private onMouseDown(e: MouseEvent): void {
    // Check if clicking directly on or inside interactive HTML UI
    const target = e.target as HTMLElement;
    if (target && target !== this.domElement && !this.domElement.contains(target)) {
      return;
    }

    // Support Middle click (button 1), Right click drag (button 2), or Left click drag with modifier keys
    const isPanButton =
      e.button === 1 ||
      e.button === 2 ||
      (e.button === 0 && (e.altKey || e.shiftKey || this.keysPressed.has('Space')));

    if (isPanButton) {
      this.isDragging = true;
      this.dragButton = e.button;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.dragDistanceMoved = 0;
      this.panVelocity.set(0, 0, 0); // Halt any residual inertia
    }
  }

  private onMouseMove(e: MouseEvent): void {
    // Keep mouse NDC updated for zoom-to-cursor calculations
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    if (!this.isDragging) return;

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    this.dragDistanceMoved += Math.hypot(deltaX, deltaY);
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    // Pan factor scales dynamically with zoom distance for uniform visual velocity
    const panFactor = (this.currentDistance / 38) * 0.042;

    // Movement vectors oriented along the current camera yaw
    const forward = new THREE.Vector3(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
    const right = new THREE.Vector3(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));

    // Shift desired target on ground plane
    const moveVector = new THREE.Vector3()
      .addScaledVector(right, -deltaX * panFactor)
      .addScaledVector(forward, deltaY * panFactor);

    this.desiredTarget.add(moveVector);
    this.clampDesiredTarget();

    // Store instantaneous movement for smooth release inertia
    this.panVelocity.copy(moveVector.multiplyScalar(0.75));
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === this.dragButton || this.dragButton === -1) {
      this.isDragging = false;
      this.dragButton = -1;
    }
  }

  /**
   * Precision Zoom with Zoom-To-Cursor ground anchoring
   */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const config = DEFAULT_GAME_CONFIG.camera;

    // Calibrated zoom step
    const zoomStep = Math.sign(e.deltaY) * 3.5;
    const nextDistance = THREE.MathUtils.clamp(
      this.desiredDistance + zoomStep,
      config.minDistance,
      config.maxDistance
    );

    if (nextDistance === this.desiredDistance) return;

    // Zoom-To-Cursor: When zooming in towards cursor, nudge target towards cursor world ground point
    if (zoomStep < 0) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const groundHit = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, groundHit);

      if (hit) {
        // Nudge proportional to zoom step ratio
        const shiftRatio = 0.12;
        const toHit = groundHit.clone().sub(this.desiredTarget);
        this.desiredTarget.addScaledVector(toHit, shiftRatio);
        this.clampDesiredTarget();
      }
    }

    this.desiredDistance = nextDistance;
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Strict Input Isolation: Do not trigger navigation keys if user is typing in a search bar or modal input
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    this.keysPressed.add(e.code);

    // Q: Rotate camera 45 degrees counter-clockwise
    if (e.code === 'KeyQ') {
      this.rotateLeft();
    }
    // E: Rotate camera 45 degrees clockwise
    else if (e.code === 'KeyE') {
      this.rotateRight();
    }
    // R: Reset view to default isometric overview
    else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      this.resetView();
    }
    // + / =: Zoom In
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      this.zoomIn();
    }
    // -: Zoom Out
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      this.zoomOut();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysPressed.delete(e.code);
  }

  /**
   * Smooth 45-degree orbital camera rotation
   */
  public rotateLeft(): void {
    this.desiredYaw += Math.PI / 4;
  }

  public rotateRight(): void {
    this.desiredYaw -= Math.PI / 4;
  }

  /**
   * Main Per-Frame Update (called from rendererManager render loop)
   */
  public update(deltaTime: number): void {
    const config = DEFAULT_GAME_CONFIG.camera;

    // 1. Keyboard Panning (WASD / Arrow Keys)
    let moveX = 0;
    let moveZ = 0;

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveZ += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveZ -= 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveX -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      // Scale movement speed with zoom distance for consistent screen velocity
      const keySpeed = 26 * (this.currentDistance / 35) * deltaTime;

      // Calculate directions relative to current camera yaw
      const forward = new THREE.Vector3(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
      const right = new THREE.Vector3(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));

      const dir = new THREE.Vector3()
        .addScaledVector(right, moveX)
        .addScaledVector(forward, moveZ)
        .normalize();

      this.desiredTarget.addScaledVector(dir, keySpeed);
      this.clampDesiredTarget();
      this.panVelocity.set(0, 0, 0); // Active key press cancels residual inertia
    } else if (!this.isDragging && this.panVelocity.lengthSq() > 0.0001) {
      // 2. Smooth Inertia Decay
      this.desiredTarget.add(this.panVelocity);
      this.clampDesiredTarget();
      // Apply friction damping
      this.panVelocity.multiplyScalar(Math.max(0, 1.0 - 12.0 * deltaTime));
    }

    // 3. Smooth Exponential Interpolation for Target, Distance & Yaw
    const dampFactor = 1.0 - Math.exp(-config.damping * deltaTime);
    this.currentTarget.lerp(this.desiredTarget, dampFactor);
    this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, this.desiredDistance, dampFactor);
    this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, this.desiredYaw, dampFactor);

    // 4. Update Camera Projection and Transform
    this.updateCameraTransform();
  }

  private clampDesiredTarget(): void {
    const b = DEFAULT_GAME_CONFIG.camera.bounds;
    this.desiredTarget.x = THREE.MathUtils.clamp(this.desiredTarget.x, b.minX, b.maxX);
    this.desiredTarget.z = THREE.MathUtils.clamp(this.desiredTarget.z, b.minZ, b.maxZ);
  }

  private updateCameraTransform(): void {
    // Spherical position offset from target using dynamic yaw and isometric pitch
    const x = this.currentTarget.x + this.currentDistance * Math.sin(this.currentYaw) * Math.cos(this.pitch);
    const y = this.currentTarget.y + this.currentDistance * Math.sin(this.pitch);
    const z = this.currentTarget.z + this.currentDistance * Math.cos(this.currentYaw) * Math.cos(this.pitch);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.currentTarget);
  }

  public focusOn(x: number, z: number, zoomLevel?: number): void {
    this.desiredTarget.set(x, 0, z);
    this.panVelocity.set(0, 0, 0);
    if (zoomLevel !== undefined) {
      this.desiredDistance = zoomLevel;
    }
    this.clampDesiredTarget();
  }

  public resetView(): void {
    this.desiredTarget.set(0, 0, 0);
    this.desiredDistance = DEFAULT_GAME_CONFIG.camera.initialDistance;
    this.desiredYaw = Math.PI / 4;
    this.panVelocity.set(0, 0, 0);
  }

  public zoomIn(): void {
    const config = DEFAULT_GAME_CONFIG.camera;
    this.desiredDistance = Math.max(config.minDistance, this.desiredDistance - 5);
  }

  public zoomOut(): void {
    const config = DEFAULT_GAME_CONFIG.camera;
    this.desiredDistance = Math.min(config.maxDistance, this.desiredDistance + 5);
  }

  public getCurrentDistance(): number {
    return this.currentDistance;
  }

  public getCurrentTarget(): THREE.Vector3 {
    return this.currentTarget.clone();
  }

  public getDesiredTarget(): THREE.Vector3 {
    return this.desiredTarget.clone();
  }

  public getCurrentYaw(): number {
    return this.currentYaw;
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.detachEventListeners();
    this.keysPressed.clear();
    this.panVelocity.set(0, 0, 0);
  }
}
