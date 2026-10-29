import * as THREE from 'three';

/**
 * Procedural PBR Texture Generator
 * Generates lightweight, tileable procedural canvas textures for high-fidelity terrain & industrial materials.
 * Includes safe fallbacks for headless / Node.js test environments.
 */
export class ProceduralTextures {
  private static isBrowser(): boolean {
    return typeof document !== 'undefined' && typeof document.createElement === 'function';
  }

  /**
   * Generates a procedural Grass PBR texture with subtle blade speckles, earth undertones, and micro-roughness.
   */
  public static createGrassTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base rich turf green
    ctx.fillStyle = '#457a3e';
    ctx.fillRect(0, 0, size, size);

    // Multi-frequency noise for natural lawn variation
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      const earthNoise = Math.random() < 0.08 ? (Math.random() - 0.5) * 35 : 0;

      data[i] = Math.min(255, Math.max(0, data[i] + noise * 0.8 + earthNoise * 0.9));     // R
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 1.2));                // G
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.5 + earthNoise * 0.3)); // B
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle grass blade brush stipples
    ctx.strokeStyle = 'rgba(74, 136, 68, 0.35)';
    ctx.lineWidth = 1;
    for (let j = 0; j < 300; j++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (Math.random() - 0.5) * 3, ry - Math.random() * 5);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a Premium Asphalt Road PBR texture with fine aggregate grit, dark bitumen matrix,
   * subtle rolling compaction variation, and mineral speckling.
   */
  public static createAsphaltTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark bituminous charcoal base
    ctx.fillStyle = '#22252c';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Dual-scale mineral aggregate & subtle rolling surface sheen
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        // Low-frequency rolling compaction wave (subtle wave along rolling axis)
        const wave = Math.sin(x * 0.08) * Math.cos(y * 0.08) * 6;
        // Fine mineral aggregate noise
        const speckle = (Math.random() - 0.5) * 18;
        // Rare lighter mineral fleck (quartzite / crushed granite)
        const fleck = Math.random() < 0.03 ? (Math.random() * 32 + 10) : 0;
        const total = wave + speckle + fleck;

        data[i] = Math.min(255, Math.max(0, data[i] + total * 0.95));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + total));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + total * 1.05));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates an Industrial Concrete Yard slab texture with 4m expansion seams and light stippling.
   */
  public static createConcreteYardTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Industrial pale concrete slab
    ctx.fillStyle = '#8f959e';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Concrete expansion joint grid seams
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Subtle expansion sealant line
    ctx.strokeStyle = 'rgba(20, 24, 33, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Crushed Gravel / Ballast texture for road shoulders and construction zones.
   */
  public static createGravelTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#655e54';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const stone = (Math.random() - 0.5) * 55;
      data[i] = Math.min(255, Math.max(0, data[i] + stone * 1.1));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + stone));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + stone * 0.9));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = 2;
    return tex;
  }

  /**
   * Generates Diagonal Yellow/Black Hazard Stripes for apron borders and barrier bollards.
   */
  public static createHazardStripeTexture(size: number = 128): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Safety yellow background
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, size, size);

    // 45 degree dark grey/black diagonal stripes
    ctx.fillStyle = '#18181b';
    const stripeW = 20;
    for (let x = -size; x < size * 2; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW + size, size);
      ctx.lineTo(x + size, size);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
  }

  /**
   * Generates Civil Concrete Retaining Wall texture with horizontal formwork panel lines.
   */
  public static createRetainingWallTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#78818f';
    ctx.fillRect(0, 0, size, size);

    // Formwork horizontal lines
    const panelHeight = size / 4;
    for (let y = 0; y < size; y += panelHeight) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();

      // Tie rod holes
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      for (let x = panelHeight / 2; x < size; x += panelHeight) {
        ctx.beginPath();
        ctx.arc(x, y + panelHeight / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 1);
    return tex;
  }

  /**
   * Generates Stormwater Retention Pond water surface texture with subtle concentric wavelets.
   */
  public static createWaterTexture(size: number = 128): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#0369a1');
    gradient.addColorStop(0.5, '#0284c7');
    gradient.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Subtle wave ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    for (let r = 10; r < size; r += 20) {
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, r, r * 0.4, 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  /**
   * Generates vertical Corrugated Metal Cladding texture with structural shadow/highlight grooves.
   */
  public static createCorrugatedCladdingTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark slate cladding base
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    // Vertical corrugation ribs (period = 16px)
    const ribWidth = 16;
    for (let x = 0; x < size; x += ribWidth) {
      // Highlight edge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x, 0, 2, size);

      // Crest face
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x + 2, 0, ribWidth / 2 - 2, size);

      // Shadow groove
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x + ribWidth / 2, 0, ribWidth / 2, size);

      // Fastener rivets along horizontal girt line
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath();
      ctx.arc(x + ribWidth / 4, size / 4, 1.2, 0, Math.PI * 2);
      ctx.arc(x + ribWidth / 4, (3 * size) / 4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Photovoltaic Solar Array texture with silicon crystal cells and conductive busbars.
   */
  public static createSolarPanelTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Deep monocrystalline silicon dark blue-black
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, size, size);

    // Cell grid lines (4x4 cells)
    const cellW = size / 4;
    const cellH = size / 4;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * cellW;
        const y = r * cellH;

        // Individual cell wafer
        ctx.fillStyle = '#0f1c3f';
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

        // Thin silver finger lines
        ctx.strokeStyle = 'rgba(180, 210, 255, 0.18)';
        ctx.lineWidth = 1;
        for (let fy = y + 4; fy < y + cellH - 2; fy += 4) {
          ctx.beginPath();
          ctx.moveTo(x + 2, fy);
          ctx.lineTo(x + cellW - 2, fy);
          ctx.stroke();
        }

        // Two vertical conductive busbars
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + cellW * 0.33, y + 2);
        ctx.lineTo(x + cellW * 0.33, y + cellH - 2);
        ctx.moveTo(x + cellW * 0.67, y + 2);
        ctx.lineTo(x + cellW * 0.67, y + cellH - 2);
        ctx.stroke();
      }
    }

    // Aluminum mounting frame
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Roll-Up Commercial Overhead Shutter Door texture with horizontal slat profiles.
   */
  public static createRollUpDoorTexture(size: number = 128): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Galvanized aluminum door base
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, size, size);

    // Horizontal interlocking slats
    const slatHeight = 8;
    for (let y = 0; y < size; y += slatHeight) {
      // Highlight top of slat
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, y, size, 2);

      // Shadow groove at interlock bottom
      ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.fillRect(0, y + slatHeight - 2, size, 2);
    }

    // Vertical guide track lines on left & right
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 6, size);
    ctx.fillRect(size - 6, 0, 6, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    return tex;
  }

  /**
   * Generates Industrial Granulated Roof Membrane texture with welded lap seams.
   */
  public static createRoofMembraneTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Light grey TPO / bitumen reflective roof surface
    ctx.fillStyle = '#a1a8b3';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Fine mineral grit noise
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 20;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Longitudinal hot-air welded lap roll seams
    const seamSpacing = size / 2;
    for (let x = 0; x <= size; x += seamSpacing) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();

      // Shadow next to seam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, 0);
      ctx.lineTo(x + 2, size);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Kiln-Fired Modular Brick texture for industrial factory masonry.
   */
  public static createIndustrialBrickTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Mortar grey background
    ctx.fillStyle = '#78716c';
    ctx.fillRect(0, 0, size, size);

    const brickH = 16;
    const brickW = 32;

    let row = 0;
    for (let y = 1; y < size; y += brickH) {
      const offsetX = (row % 2) * (brickW / 2);
      for (let x = -brickW + offsetX; x < size + brickW; x += brickW) {
        // Red-terracotta variation per brick
        const rTone = 135 + Math.floor((Math.random() - 0.5) * 30);
        const gTone = 45 + Math.floor((Math.random() - 0.5) * 15);
        const bTone = 35 + Math.floor((Math.random() - 0.5) * 15);
        ctx.fillStyle = `rgb(${rTone}, ${gTone}, ${bTone})`;
        ctx.fillRect(x + 1, y, brickW - 2, brickH - 2);
      }
      row++;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Heavy-Duty Commercial Truck Tire Rubber Texture with tread sipes and shoulder blocks.
   */
  public static createTireTreadTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Deep vulcanized tire rubber dark base
    ctx.fillStyle = '#1c1c1f';
    ctx.fillRect(0, 0, size, size);

    // Circumferential deep rain water grooves
    ctx.fillStyle = '#0a0a0c';
    const grooveWidth = size / 8;
    ctx.fillRect(grooveWidth * 1.5, 0, grooveWidth * 0.8, size);
    ctx.fillRect(grooveWidth * 3.6, 0, grooveWidth * 0.8, size);
    ctx.fillRect(grooveWidth * 5.7, 0, grooveWidth * 0.8, size);

    // Lateral tread sipes & traction blocks
    ctx.fillStyle = '#141416';
    const sipeGap = 16;
    for (let y = 0; y < size; y += sipeGap) {
      ctx.fillRect(0, y, grooveWidth * 1.5, 2);
      ctx.fillRect(grooveWidth * 2.3, y + 8, grooveWidth * 1.3, 2);
      ctx.fillRect(grooveWidth * 4.4, y, grooveWidth * 1.3, 2);
      ctx.fillRect(grooveWidth * 6.5, y + 8, grooveWidth * 1.5, 2);
    }

    // Micro rubber texture noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Diamond-Plate Steel Platform Catwalk Texture for truck chassis and access steps.
   */
  public static createDiamondPlateTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Metallic silver-grey base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, size, size);

    // Raised diagonal diamond tread lugs with highlight and shadow
    const step = 32;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const cx = x + step / 2;
        const cy = y + step / 2;

        // Diamond 1 (45 deg)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);

        ctx.fillStyle = '#94a3b8'; // Highlight
        ctx.fillRect(-6, -2, 12, 4);

        ctx.fillStyle = '#334155'; // Drop shadow
        ctx.fillRect(-5, 1, 10, 2);
        ctx.restore();

        // Diamond 2 (-45 deg offset)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4);

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6, -2, 12, 4);

        ctx.fillStyle = '#334155';
        ctx.fillRect(-5, 1, 10, 2);
        ctx.restore();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Intermodal Shipping Container Corrugated Wall Texture with Stencils and Placards.
   */
  public static createContainerCorrugatedTexture(
    baseColor: string = '#1e3a8a',
    prefix: string = 'APXU 492018-7',
    size: number = 512
  ): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill base paint color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Vertical trapezoidal corrugation ribs (lighting gradient: highlight, crest, shadow, trough)
    const ribWidth = 32;
    for (let x = 0; x < size; x += ribWidth) {
      // Crest highlight
      const grad = ctx.createLinearGradient(x, 0, x + ribWidth, 0);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.22)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(0.9, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.55)');

      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, ribWidth, size);
    }

    // Industrial stencils and warning labels
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(prefix, 28, 48);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('MAX GROSS  30,480 KG / 67,200 LBS', 28, 76);
    ctx.fillText('TARE WT    3,850 KG  /  8,490 LBS', 28, 94);
    ctx.fillText('PAYLOAD   26,630 KG / 58,710 LBS', 28, 112);
    ctx.fillText('CUBE CAPAC  76.4 CU.M / 2,700 CU.FT', 28, 130);

    // Hazard diamond warning placard (Class 3 / Flammable or Industrial Cargo)
    ctx.save();
    ctx.translate(size - 90, 80);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-22, -22, 44, 44);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-20, -20, 40, 40);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('FLAMMABLE', size - 128, 118);

    // Subtle edge rust & grime on bottom border
    const bottomGrime = ctx.createLinearGradient(0, size - 40, 0, size);
    bottomGrime.addColorStop(0, 'rgba(40, 30, 20, 0)');
    bottomGrime.addColorStop(1, 'rgba(30, 20, 10, 0.45)');
    ctx.fillStyle = bottomGrime;
    ctx.fillRect(0, size - 40, size, 40);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates DOT-C2 Alternating Red & White Retroreflective Conspicuity Tape.
   */
  public static createConspicuityTapeTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const stripeW = 32;
    for (let x = 0; x < size; x += stripeW * 2) {
      // Red reflective section
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x, 0, stripeW, 32);

      // White reflective section
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + stripeW, 0, stripeW, 32);
    }

    // Micro honeycomb prismatic reflective texture
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 32);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates Refrigeration (Reefer) Unit Front Panel with compressor vents and digital temp display.
   */
  public static createReeferUnitTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White composite nose casing
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, size, size);

    // Condenser intake louver grille
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 30, size - 48, 110);

    ctx.fillStyle = '#475569';
    for (let y = 35; y < 135; y += 8) {
      ctx.fillRect(28, y, size - 56, 4);
    }

    // Brand and model header
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('THERMO-CHILL VECTOR 8500', 26, 22);

    // Digital LED status & temperature display box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(36, 160, 110, 48);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 160, 110, 48);

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('-18.5°C', 46, 192);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText('SETPOINT: -20°C · ECO MODE', 36, 224);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates a deep, high-traction highway asphalt texture with fine rolling bitumen aggregate
   */
  public static createHighwayAsphaltTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Deep dense-grade asphalt concrete (heavy bitumen binder)
    ctx.fillStyle = '#181b21';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const wave = Math.sin(x * 0.06) * 4;
        const speckle = (Math.random() - 0.5) * 14;
        const grit = Math.random() < 0.035 ? Math.random() * 22 : 0;
        const val = wave + speckle + grit;
        data[i] = Math.min(255, Math.max(0, data[i] + val * 0.9));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + val * 0.95));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + val * 1.05));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates weathered municipal local street asphalt texture
   */
  public static createLocalStreetAsphaltTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Municipal warm dark-grey asphalt
    ctx.fillStyle = '#292d35';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const microWear = Math.cos(y * 0.05) * 3;
        const speckle = (Math.random() - 0.5) * 16;
        const grit = Math.random() < 0.04 ? Math.random() * 24 : 0;
        const val = microWear + speckle + grit;
        data[i] = Math.min(255, Math.max(0, data[i] + val));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + val));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + val * 1.02));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates an industrial reinforced concrete pavement slab texture with joint sealant
   */
  public static createIndustrialPavementTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#6b7280';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 20;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // 2-grid contraction joints with subtle chamfer
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates scored pedestrian sidewalk modular pavers
   */
  public static createSidewalkTileTexture(size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#a1a8b5';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // 4x4 paver tile grid seams with chamfer shadow
    const step = size / 4;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates directional turning arrow stencil for intersection approach lanes
   */
  public static createTurnArrowTexture(type: 'straight' | 'left' | 'right' | 'combo' = 'straight', size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Clear transparent background
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = size / 2;
    const cy = size / 2;

    if (type === 'straight') {
      // Arrow shaft
      ctx.beginPath();
      ctx.moveTo(cx, cy + 80);
      ctx.lineTo(cx, cy - 30);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(cx, cy - 80);
      ctx.lineTo(cx - 40, cy - 20);
      ctx.lineTo(cx - 15, cy - 20);
      ctx.lineTo(cx - 15, cy - 10);
      ctx.lineTo(cx + 15, cy - 10);
      ctx.lineTo(cx + 15, cy - 20);
      ctx.lineTo(cx + 40, cy - 20);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'left') {
      // Curved left shaft
      ctx.beginPath();
      ctx.moveTo(cx + 25, cy + 80);
      ctx.lineTo(cx + 25, cy + 10);
      ctx.quadraticCurveTo(cx + 25, cy - 35, cx - 35, cy - 35);
      ctx.stroke();
      // Arrow head pointing left
      ctx.beginPath();
      ctx.moveTo(cx - 75, cy - 35);
      ctx.lineTo(cx - 30, cy - 65);
      ctx.lineTo(cx - 30, cy - 45);
      ctx.lineTo(cx - 15, cy - 45);
      ctx.lineTo(cx - 15, cy - 25);
      ctx.lineTo(cx - 30, cy - 25);
      ctx.lineTo(cx - 30, cy - 5);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'right') {
      // Curved right shaft
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy + 80);
      ctx.lineTo(cx - 25, cy + 10);
      ctx.quadraticCurveTo(cx - 25, cy - 35, cx + 35, cy - 35);
      ctx.stroke();
      // Arrow head pointing right
      ctx.beginPath();
      ctx.moveTo(cx + 75, cy - 35);
      ctx.lineTo(cx + 30, cy - 65);
      ctx.lineTo(cx + 30, cy - 45);
      ctx.lineTo(cx + 15, cy - 45);
      ctx.lineTo(cx + 15, cy - 25);
      ctx.lineTo(cx + 30, cy - 25);
      ctx.lineTo(cx + 30, cy - 5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Combo straight & left
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 80);
      ctx.lineTo(cx + 10, cy - 30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy - 80);
      ctx.lineTo(cx - 25, cy - 25);
      ctx.lineTo(cx - 2, cy - 25);
      ctx.lineTo(cx - 2, cy - 15);
      ctx.lineTo(cx + 22, cy - 15);
      ctx.lineTo(cx + 22, cy - 25);
      ctx.lineTo(cx + 45, cy - 25);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 30);
      ctx.quadraticCurveTo(cx + 10, cy - 10, cx - 40, cy - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 75, cy - 10);
      ctx.lineTo(cx - 40, cy - 35);
      ctx.lineTo(cx - 40, cy + 15);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates a high-visibility Interstate / Highway Directional Overhead Gantry Sign
   * Matches the visual reference: "Riverside 12 km ⬆" and "Industrial Zone 5 km ➔"
   */
  public static createHighwayGantrySignTexture(
    dest: string = 'Riverside',
    exitNum: string = 'Industrial Zone',
    width: number = 512,
    height: number = 256
  ): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Darker structural border margin
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Left Panel: Through route (Riverside)
    const panelW = (width - 24) / 2;
    const panelH = height - 16;

    // Left Green Signboard
    ctx.fillStyle = '#047857';
    ctx.fillRect(8, 8, panelW, panelH);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, panelW - 8, panelH - 8);

    // Riverside Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dest, 8 + panelW / 2, 70);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('↑  12 km', 8 + panelW / 2, 125);

    // Left Lane Arrow
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⬆', 8 + panelW / 2, 195);

    // Right Panel: Exit route (Industrial Zone)
    const rightX = 16 + panelW;
    ctx.fillStyle = '#065f46';
    ctx.fillRect(rightX, 8, panelW, panelH);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.strokeRect(rightX + 4, 12, panelW - 8, panelH - 8);

    // Route Badge
    ctx.fillStyle = '#059669';
    ctx.fillRect(rightX + panelW - 85, 18, 70, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('EXIT 4', rightX + panelW - 50, 40);

    // Industrial Zone Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(exitNum, rightX + panelW / 2 - 15, 75);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('5 km', rightX + panelW / 2, 125);

    // Right Lane Exit Arrow
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('➔', rightX + panelW / 2, 195);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates a circular or rectangular MUTCD Speed Limit Sign
   */
  public static createSpeedLimitSignTexture(speed: number = 75, size: number = 256): THREE.CanvasTexture | null {
    if (!this.isBrowser()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White reflective face
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);

    // Outer and inner black borders
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SPEED', size / 2, 54);
    ctx.fillText('LIMIT', size / 2, 86);

    ctx.font = 'bold 96px sans-serif';
    ctx.fillText(`${speed}`, size / 2, 190);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('km/h', size / 2, 228);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }
}

