export type RoutingMode = 'horizontal_first' | 'vertical_first';

export interface GridCoord {
  x: number;
  z: number;
}

export interface RoadCorridorCell extends GridCoord {
  corridorAxis: 'horizontal' | 'vertical' | 'junction';
  corridorIndex: number; // 0 .. widthBlocks - 1 across cross section
  widthBlocks: number;
  forwardBlocks: number;
  backwardBlocks: number;
  isOuterEdgeMin: boolean; // outer edge on lower coordinate (North if horizontal, West if vertical)
  isOuterEdgeMax: boolean; // outer edge on higher coordinate (South if horizontal, East if vertical)
  isCentreDividerEdgeMin: boolean; // border at min side is centre divider
  isCentreDividerEdgeMax: boolean; // border at max side is centre divider
  hasInternalDashedMin: boolean; // border at min side is dashed lane divider
  hasInternalDashedMax: boolean; // border at max side is dashed lane divider
}

export class RoadPathGenerator {
  /**
   * Generates a deterministic orthogonal path from start to end without duplicate cells or diagonals.
   */
  public static generatePath(
    start: GridCoord,
    end: GridCoord,
    mode: RoutingMode = 'horizontal_first'
  ): GridCoord[] {
    const path: GridCoord[] = [];
    const visited = new Set<string>();

    const addCell = (x: number, z: number) => {
      const key = `${x},${z}`;
      if (!visited.has(key)) {
        visited.add(key);
        path.push({ x, z });
      }
    };

    if (start.x === end.x && start.z === end.z) {
      addCell(start.x, start.z);
      return path;
    }

    if (mode === 'horizontal_first') {
      const stepX = end.x >= start.x ? 1 : -1;
      for (let x = start.x; stepX > 0 ? x <= end.x : x >= end.x; x += stepX) {
        addCell(x, start.z);
      }
      const stepZ = end.z >= start.z ? 1 : -1;
      for (let z = start.z; stepZ > 0 ? z <= end.z : z >= end.z; z += stepZ) {
        addCell(end.x, z);
      }
    } else {
      const stepZ = end.z >= start.z ? 1 : -1;
      for (let z = start.z; stepZ > 0 ? z <= end.z : z >= end.z; z += stepZ) {
        addCell(start.x, z);
      }
      const stepX = end.x >= start.x ? 1 : -1;
      for (let x = start.x; stepX > 0 ? x <= end.x : x >= end.x; x += stepX) {
        addCell(x, end.z);
      }
    }

    return path;
  }

  /**
   * Calculates directional allocation (forward & backward blocks) for a given total width.
   * Ensures forwardBlocks + backwardBlocks === widthBlocks.
   */
  public static calculateDirectionalAllocation(
    widthBlocks: number,
    preferredForward?: number,
    preferredBackward?: number
  ): { forwardBlocks: number; backwardBlocks: number } {
    const W = Math.max(1, Math.round(widthBlocks));
    if (W === 1) {
      return { forwardBlocks: 1, backwardBlocks: 0 };
    }

    if (
      preferredForward !== undefined &&
      preferredBackward !== undefined &&
      preferredForward + preferredBackward === W &&
      preferredForward >= 1 &&
      preferredBackward >= 1
    ) {
      return { forwardBlocks: preferredForward, backwardBlocks: preferredBackward };
    }

    if (W % 2 === 0) {
      return { forwardBlocks: W / 2, backwardBlocks: W / 2 };
    } else {
      // Odd width default: forward gets the extra block (e.g. 2 forward, 1 backward for 3-block road)
      const forward = Math.ceil(W / 2);
      const backward = W - forward;
      return { forwardBlocks: forward, backwardBlocks: backward };
    }
  }

  /**
   * Computes marking flags for a corridor cross-section index k in [0 .. widthBlocks - 1].
   */
  public static computeMarkingFlags(
    k: number,
    widthBlocks: number,
    forwardBlocks: number,
    backwardBlocks: number
  ): {
    isOuterEdgeMin: boolean;
    isOuterEdgeMax: boolean;
    isCentreDividerEdgeMin: boolean;
    isCentreDividerEdgeMax: boolean;
    hasInternalDashedMin: boolean;
    hasInternalDashedMax: boolean;
  } {
    const W = widthBlocks;
    const F = forwardBlocks;
    const B = backwardBlocks;

    const isOuterEdgeMin = k === 0;
    const isOuterEdgeMax = k === W - 1;

    let isCentreDividerEdgeMin = false;
    let isCentreDividerEdgeMax = false;
    let hasInternalDashedMin = false;
    let hasInternalDashedMax = false;

    if (B > 0) {
      // Centre divider separates forward blocks (0 .. F-1) from backward blocks (F .. W-1)
      if (k === F - 1) {
        isCentreDividerEdgeMax = true;
      }
      if (k === F) {
        isCentreDividerEdgeMin = true;
      }
    }

    // Forward carriageway internal lane dividers (requires F >= 2)
    if (F >= 2) {
      if (k < F - 1) {
        hasInternalDashedMax = true;
      }
      if (k > 0 && k < F) {
        hasInternalDashedMin = true;
      }
    }

    // Backward carriageway internal lane dividers (requires B >= 2)
    if (B >= 2) {
      if (k >= F && k < W - 1) {
        hasInternalDashedMax = true;
      }
      if (k > F && k < W) {
        hasInternalDashedMin = true;
      }
    }

    return {
      isOuterEdgeMin,
      isOuterEdgeMax,
      isCentreDividerEdgeMin,
      isCentreDividerEdgeMax,
      hasInternalDashedMin,
      hasInternalDashedMax,
    };
  }

  /**
   * Generates a complete multi-block road corridor with accurate width, cross-section indexing,
   * and lane-divider / centre-divider marking attributes.
   */
  public static generateCorridor(
    start: GridCoord,
    end: GridCoord,
    widthBlocks: number = 2,
    preferredForward?: number,
    preferredBackward?: number,
    mode: RoutingMode = 'horizontal_first'
  ): RoadCorridorCell[] {
    const W = Math.max(1, Math.round(widthBlocks));
    const { forwardBlocks, backwardBlocks } = this.calculateDirectionalAllocation(
      W,
      preferredForward,
      preferredBackward
    );

    const cellsMap = new Map<string, RoadCorridorCell>();

    const addCell = (
      x: number,
      z: number,
      axis: 'horizontal' | 'vertical' | 'junction',
      index: number
    ) => {
      const key = `${x},${z}`;
      const existing = cellsMap.get(key);
      const flags = this.computeMarkingFlags(index, W, forwardBlocks, backwardBlocks);

      if (existing) {
        // If cell is visited from both directions, it's a multi-lane junction/corner
        existing.corridorAxis = 'junction';
        return;
      }

      cellsMap.set(key, {
        x,
        z,
        corridorAxis: axis,
        corridorIndex: index,
        widthBlocks: W,
        forwardBlocks,
        backwardBlocks,
        ...flags,
      });
    };

    if (start.x === end.x && start.z === end.z) {
      for (let k = 0; k < W; k++) {
        addCell(start.x, start.z + k, 'horizontal', k);
      }
      return Array.from(cellsMap.values());
    }

    if (start.z === end.z) {
      // Purely horizontal corridor
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (let x = minX; x <= maxX; x++) {
        for (let k = 0; k < W; k++) {
          addCell(x, start.z + k, 'horizontal', k);
        }
      }
      return Array.from(cellsMap.values());
    }

    if (start.x === end.x) {
      // Purely vertical corridor
      const minZ = Math.min(start.z, end.z);
      const maxZ = Math.max(start.z, end.z);
      for (let z = minZ; z <= maxZ; z++) {
        for (let k = 0; k < W; k++) {
          addCell(start.x + k, z, 'vertical', k);
        }
      }
      return Array.from(cellsMap.values());
    }

    if (mode === 'horizontal_first') {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minZ = Math.min(start.z, end.z);
      const maxZ = Math.max(start.z, end.z);

      // 1. Horizontal Corridor (travel along X, cross-section in Z)
      for (let x = minX; x <= maxX; x++) {
        for (let k = 0; k < W; k++) {
          addCell(x, start.z + k, 'horizontal', k);
        }
      }

      // 2. Vertical Corridor (travel along Z, cross-section in X)
      for (let z = minZ; z <= maxZ; z++) {
        for (let k = 0; k < W; k++) {
          addCell(end.x + k, z, 'vertical', k);
        }
      }
    } else {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minZ = Math.min(start.z, end.z);
      const maxZ = Math.max(start.z, end.z);

      // 1. Vertical Corridor (travel along Z, cross-section in X)
      for (let z = minZ; z <= maxZ; z++) {
        for (let k = 0; k < W; k++) {
          addCell(start.x + k, z, 'vertical', k);
        }
      }

      // 2. Horizontal Corridor (travel along X, cross-section in Z)
      for (let x = minX; x <= maxX; x++) {
        for (let k = 0; k < W; k++) {
          addCell(x, end.z + k, 'horizontal', k);
        }
      }
    }

    return Array.from(cellsMap.values());
  }
}
