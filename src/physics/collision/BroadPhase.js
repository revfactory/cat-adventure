/**
 * BroadPhase — Spatial Hash Grid
 * cellSize 128 기반 브로드페이즈 충돌 후보 수집
 */
export class BroadPhase {
  constructor(cellSize = 128) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this._bodyMap = new Map();
  }

  update(bodies) {
    this.grid.clear();
    this._bodyMap.clear();

    for (const body of bodies) {
      if (body.isSleeping && body.isStatic) continue;
      this._bodyMap.set(body.id, body);

      const aabb = body.getAABB();
      const minCX = Math.floor(aabb.min.x / this.cellSize);
      const minCY = Math.floor(aabb.min.y / this.cellSize);
      const maxCX = Math.floor(aabb.max.x / this.cellSize);
      const maxCY = Math.floor(aabb.max.y / this.cellSize);

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          const key = (cx * 73856093) ^ (cy * 19349663); // 해시 함수
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(body);
        }
      }
    }
  }

  getPotentialPairs() {
    const pairSet = new Set();
    const pairs = [];

    for (const cell of this.grid.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i];
          const b = cell[j];

          // 둘 다 static이면 검사 불필요
          if (a.isStatic && b.isStatic) continue;

          // 둘 다 sleeping이면 검사 불필요
          if (a.isSleeping && b.isSleeping) continue;

          // 충돌 레이어 필터
          if (!a.canCollideWith(b)) continue;

          const idA = Math.min(a.id, b.id);
          const idB = Math.max(a.id, b.id);
          const pairId = idA * 100000 + idB;

          if (!pairSet.has(pairId)) {
            pairSet.add(pairId);
            pairs.push([a, b]);
          }
        }
      }
    }

    return pairs;
  }

  query(aabb) {
    const results = new Set();
    const minCX = Math.floor(aabb.min.x / this.cellSize);
    const minCY = Math.floor(aabb.min.y / this.cellSize);
    const maxCX = Math.floor(aabb.max.x / this.cellSize);
    const maxCY = Math.floor(aabb.max.y / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = (cx * 73856093) ^ (cy * 19349663);
        const cell = this.grid.get(key);
        if (cell) {
          for (const body of cell) {
            results.add(body);
          }
        }
      }
    }

    return [...results];
  }

  raycast(origin, direction, maxDistance) {
    const results = [];
    const step = this.cellSize * 0.5;
    const steps = Math.ceil(maxDistance / step);

    const checked = new Set();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxDistance;
      const px = origin.x + direction.x * t;
      const py = origin.y + direction.y * t;
      const cx = Math.floor(px / this.cellSize);
      const cy = Math.floor(py / this.cellSize);
      const key = (cx * 73856093) ^ (cy * 19349663);

      const cell = this.grid.get(key);
      if (cell) {
        for (const body of cell) {
          if (!checked.has(body.id)) {
            checked.add(body.id);
            results.push(body);
          }
        }
      }
    }

    return results;
  }
}
