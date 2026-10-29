import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IDisposable } from '../core/Disposable';
import { DEFAULT_GAME_CONFIG } from '../app/GameConfig';
import { MaterialsManager } from './MaterialsManager';

export class LightingSetup implements IDisposable {
  public readonly scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private materialsManager?: MaterialsManager;
  private hemiLight: THREE.HemisphereLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private envTexture: THREE.Texture | null = null;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, materialsManager?: MaterialsManager) {
    this.scene = scene;
    this.renderer = renderer;
    this.materialsManager = materialsManager;
    this.init();
  }

  private init(): void {
    const config = DEFAULT_GAME_CONFIG.rendering;

    // 1. Procedural Studio Environment Reflection (Mandatory for PBR materials)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envTexture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('RoomEnvironment generation fallback:', e);
    }

    // 2. Horizon Fog matched to sky/background
    this.scene.background = new THREE.Color(config.skyColor);
    this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);

    // 3. Cool sky / Warm ground Hemisphere Light fill
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x4a7c44, 0.75);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 4. Warm Sun Key Light with sharp readable shadows
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    this.dirLight.position.set(40, 55, 30);
    this.dirLight.castShadow = config.shadows;

    if (config.shadows) {
      this.dirLight.shadow.mapSize.width = config.shadowMapSize;
      this.dirLight.shadow.mapSize.height = config.shadowMapSize;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 160;

      // Tight orthographic shadow frustum matching the playable world + margins
      const d = 34;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0004;
      this.dirLight.shadow.normalBias = 0.025;
    }

    this.scene.add(this.dirLight);

    // 5. Soft Rim / Back Fill Light
    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    this.fillLight.position.set(-30, 25, -30);
    this.scene.add(this.fillLight);
  }

  public setMaterialsManager(materialsManager: MaterialsManager): void {
    this.materialsManager = materialsManager;
  }

  public setTimePreset(preset: 'day' | 'golden' | 'dusk'): void {
    if (!this.dirLight || !this.hemiLight) return;

    if (preset === 'golden') {
      this.dirLight.color.setHex(0xffaa55);
      this.dirLight.intensity = 1.6;
      this.hemiLight.intensity = 0.65;
      this.scene.background = new THREE.Color(0xfde68a);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xfef08a);
      }
      if (this.materialsManager) {
        this.materialsManager.setStreetlightsEmissive(1.5);
      }
    } else if (preset === 'dusk') {
      this.dirLight.color.setHex(0xf472b6);
      this.dirLight.intensity = 0.85;
      this.hemiLight.intensity = 0.45;
      this.scene.background = new THREE.Color(0x312e81);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x3730a3);
      }
      if (this.materialsManager) {
        this.materialsManager.setStreetlightsEmissive(3.0);
      }
    } else {
      // Day
      this.dirLight.color.setHex(0xfffaed);
      this.dirLight.intensity = 1.45;
      this.hemiLight.intensity = 0.75;
      this.scene.background = new THREE.Color(DEFAULT_GAME_CONFIG.rendering.skyColor);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(DEFAULT_GAME_CONFIG.rendering.fogColor);
      }
      if (this.materialsManager) {
        this.materialsManager.setStreetlightsEmissive(0.0);
      }
    }
  }

  public dispose(): void {
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
    if (this.dirLight) {
      if (this.dirLight.shadow && this.dirLight.shadow.map) {
        this.dirLight.shadow.map.dispose();
      }
      this.scene.remove(this.dirLight);
    }
    if (this.hemiLight) this.scene.remove(this.hemiLight);
    if (this.fillLight) this.scene.remove(this.fillLight);
  }
}
