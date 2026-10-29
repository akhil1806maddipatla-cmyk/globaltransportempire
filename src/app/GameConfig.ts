export interface GameConfig {
  app: {
    name: string;
    version: string;
    debug: boolean;
  };
  grid: {
    width: number;
    height: number;
    cellSize: number;
    originX: number;
    originZ: number;
  };
  camera: {
    fov: number;
    near: number;
    far: number;
    initialDistance: number;
    minDistance: number;
    maxDistance: number;
    isometricAngle: number;
    panSpeed: number;
    zoomSpeed: number;
    damping: number;
    bounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
  };
  rendering: {
    shadows: boolean;
    shadowMapSize: number;
    fogDensity: number;
    fogColor: number;
    skyColor: number;
    groundColor: number;
    exposure: number;
  };
  palette: {
    grassLight: number;
    grassDark: number;
    grassMid: number;
    asphalt: number;
    roadMarking: number;
    curb: number;
    concrete: number;
    industrialSteel: number;
    industrialOrange: number;
    commercialBlue: number;
    logisticsYellow: number;
    selectionRing: number;
    selectionGlow: number;
    boundaryStake: number;
  };
  company: {
    startingCash: number;
    currency: string;
    companyName: string;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  app: {
    name: 'Global Transport Empire',
    version: '0.1.0',
    debug: false,
  },
  grid: {
    width: 56,
    height: 56,
    cellSize: 4,
    originX: -48,
    originZ: -48,
  },
  camera: {
    fov: 35,
    near: 0.1,
    far: 1200,
    initialDistance: 75,
    minDistance: 16,
    maxDistance: 320,
    isometricAngle: Math.PI / 4, // 45 degrees
    panSpeed: 1.8,
    zoomSpeed: 0.1,
    damping: 8,
    bounds: {
      minX: -160,
      maxX: 260,
      minZ: -160,
      maxZ: 260,
    },
  },
  rendering: {
    shadows: true,
    shadowMapSize: 2048,
    fogDensity: 0.007,
    fogColor: 0xd9e7ef,
    skyColor: 0xd8eaf7,
    groundColor: 0x5a9159,
    exposure: 1.1,
  },
  palette: {
    grassLight: 0x76b066,
    grassDark: 0x5b934d,
    grassMid: 0x69a259,
    asphalt: 0x2e323b,
    roadMarking: 0xf3f4f6,
    curb: 0x8b939e,
    concrete: 0xc8ced6,
    industrialSteel: 0x4a5568,
    industrialOrange: 0xe06a3b,
    commercialBlue: 0x2b6cb0,
    logisticsYellow: 0xdf9a26,
    selectionRing: 0x38bdf8,
    selectionGlow: 0x0284c7,
    boundaryStake: 0xf59e0b,
  },
  company: {
    startingCash: 250000,
    currency: 'USD',
    companyName: 'Apex Transport Global',
  },
};
