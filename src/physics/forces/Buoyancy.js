/**
 * Buoyancy — 부력 (물/분수 영역)
 * 물 영역 내 바디에 위로 향하는 부력 적용
 */
import { Vector2 } from '../Vector2.js';
import { AABB } from '../shapes/AABB.js';

export class Buoyancy {
  constructor(options = {}) {
    this.area = new AABB(
      new Vector2(options.area.x, options.area.y),
      new Vector2(options.area.x + options.area.width, options.area.y + options.area.height)
    );

    this.fluidDensity = options.fluidDensity ?? 1.0;
    this.upForce = options.upForce ?? 500; // 위로 밀어올리는 힘
    this.linearDrag = options.linearDrag ?? 3;
    this.angularDrag = options.angularDrag ?? 1;
    this.enabled = true;
  }

  apply(bodies, dt) {
    if (!this.enabled) return;

    for (const body of bodies) {
      if (body.isStatic || body.isSleeping) continue;

      const bodyAABB = body.getAABB();

      // 영역 내에 있는지 확인
      if (!this.area.overlaps(bodyAABB)) continue;

      // 침수율 계산 (얼마나 물에 잠겼는지)
      const overlapMinY = Math.max(bodyAABB.min.y, this.area.min.y);
      const overlapMaxY = Math.min(bodyAABB.max.y, this.area.max.y);
      const bodyHeight = bodyAABB.max.y - bodyAABB.min.y;

      if (bodyHeight <= 0) continue;

      const submergedRatio = Math.max(0, (overlapMaxY - overlapMinY) / bodyHeight);

      // 부력: 위로 향하는 힘
      const buoyancyForce = new Vector2(0, -this.upForce * submergedRatio);
      body.applyForce(buoyancyForce);

      // 수중 저항 (감쇠)
      const drag = body.velocity.scale(-this.linearDrag * submergedRatio);
      body.applyForce(drag);

      // 각 저항
      body.angularVelocity *= (1 - this.angularDrag * submergedRatio * dt);
    }
  }
}
