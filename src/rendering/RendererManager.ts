import * as THREE from 'three';
import { IDisposable } from '../core/Disposable';
import { CameraController } from './CameraController';
import { LightingSetup } from './LightingSetup';
import { WorldManager } from '../world/WorldManager';
import { SelectionManager } from '../input/SelectionManager';
import { ConstructionController } from '../input/ConstructionController';
import { RoadConstructionController } from '../input/RoadConstructionController';
import { RouteVisualizer } from './RouteVisualizer';
import { GameState } from '../game/GameState';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';

export class RendererManager implements IDisposable {
  public readonly container: HTMLElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly cameraController: CameraController;
  public readonly lightingSetup: LightingSetup;
  public readonly worldManager: WorldManager;
  public readonly selectionManager: SelectionManager;
  public readonly constructionController: ConstructionController;
  public readonly roadConstructionController: RoadConstructionController;
  public readonly routeVisualizer: RouteVisualizer;

  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  private boundOnResize: () => void;

  constructor(container: HTMLElement, gameState: GameState) {
    this.container = container;

    // 1. Initialize Scene
    this.scene = new THREE.Scene();

    // 2. Initialize WebGLRenderer with PBR & ACES Filmic standards
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isHeadless,
      alpha: false,
      depth: true,
      stencil: false,
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = DEFAULT_GAME_CONFIG.rendering.exposure;
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    if (DEFAULT_GAME_CONFIG.rendering.shadows && !isHeadless) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.appendChild(this.renderer.domElement);

    // 3. Initialize Camera Controller
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.cameraController = new CameraController(this.renderer.domElement, aspect);

    // 4. Initialize Studio Lighting Setup
    this.lightingSetup = new LightingSetup(this.scene, this.renderer);

    // 5. Initialize World Manager (Terrain, Roads, Initial Buildings)
    this.worldManager = new WorldManager(this.scene, gameState);
    this.worldManager.initializeWorld();
    this.lightingSetup.setMaterialsManager(this.worldManager.materialsManager);

    // 6. Initialize Selection Manager
    this.selectionManager = new SelectionManager(
      this.cameraController.camera,
      this.scene,
      this.renderer.domElement,
      this.worldManager.entityRegistry,
      gameState
    );

    // 7. Initialize Interactive Construction Controller
    this.constructionController = new ConstructionController(
      this.cameraController.camera,
      this.scene,
      this.renderer.domElement,
      this.worldManager,
      gameState
    );

    // 8. Initialize Road Construction Controller
    this.roadConstructionController = new RoadConstructionController(
      this.cameraController.camera,
      this.scene,
      this.renderer.domElement,
      this.worldManager,
      gameState
    );

    // 9. Initialize 3D Route Visualizer for selected vehicle
    this.routeVisualizer = new RouteVisualizer(this.scene, this.worldManager, gameState);

    // 10. Pre-warm shaders
    try {
      this.renderer.compile(this.scene, this.cameraController.camera);
    } catch {
      // Ignored
    }

    // 11. Bind resize listener
    this.boundOnResize = this.onResize.bind(this);
    window.addEventListener('resize', this.boundOnResize);

    // 12. Start Main Animation Loop
    this.startLoop(gameState);
  }

  private onResize(): void {
    if (this.isDisposed || !this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.cameraController.setAspect(width / height);
    this.renderer.setSize(width, height);
  }

  private startLoop(gameState: GameState): void {
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const minFrameInterval = isHeadless ? 1000 / 25 : 0; // ~25fps in headless CPU WebGL
    let lastTimestamp = 0;

    const tick = (timestamp: number) => {
      if (this.isDisposed) return;

      if (isHeadless && timestamp - lastTimestamp < minFrameInterval) {
        this.animationFrameId = requestAnimationFrame(tick);
        return;
      }
      lastTimestamp = timestamp;

      const rawDt = this.clock.getDelta();
      // Clamp delta time to avoid large jumps after tab suspension or frame drops
      const dt = Math.min(rawDt, 0.05);

      // Update simulation clock and game state
      gameState.update(dt);

      // Update camera smooth kinematics
      this.cameraController.update(dt);

      // Update world entities
      this.worldManager.update(dt);

      // Update selected vehicle 3D route visualization
      this.routeVisualizer.update(dt);

      // Render 3D scene
      this.renderer.render(this.scene, this.cameraController.camera);

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.boundOnResize);

    this.routeVisualizer.dispose();
    this.roadConstructionController.dispose();
    this.constructionController.dispose();
    this.selectionManager.dispose();
    this.worldManager.dispose();
    this.lightingSetup.dispose();
    this.cameraController.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
