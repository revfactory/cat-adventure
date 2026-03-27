/**
 * Wind — 바람 영역 (방향, 세기, 난류)
 * 영역 내 바디에 바람 힘 적용
 */
import { Vector2 } from '../Vector2.js';
import { AABB } from '../shapes/AABB.js';

export class Wind {
  constructor(options = {}) {
    this.area = options.area
      ? new AABB(
          new Vector2(options.area.x, options.area.y),
          new Vector2(options.area.x + options.area.width, options.area.y + options.area.height)
        )
      : null; // null = 전역

    this.direction = options.direction
      ? new Vector2(options.direction.x, options.direction.y)
      : new Vector2(100, 0);

    this.strength = options.strength ?? this.direction.length();
    this.turbulence = options.turbulence ?? 0;
    this.enabled = true;

    // 주기적 변경
    this.oscillate = options.oscillate || false;
    this.oscillatePeriod = options.oscillatePeriod || 3; // 초
    this._time = 0;
  }

  apply(bodies, dt) {
    if (!this.enabled) return;

    this._time += dt;

    let windForce = this.direction.clone();

    // 주기적 변경
    if (this.oscillate) {
      const factor = Math.sin(this._time * Math.PI * 2 / this.oscillatePeriod);
      windForce = windForce.scale(factor);
    }

    // 난류
    if (this.turbulence > 0) {
      const tx = (Math.random() - 0.5) * 2 * this.turbulence * this.strength;
      const ty = (Math.random() - 0.5) * 2 * this.turbulence * this.strength;
      windForce = windForce.add(new Vector2(tx, ty));
    }

    for (const body of bodies) {
      if (body.isStatic || body.isSleeping) continue;

      // 영역 체크
      if (this.area) {
        if (!this.area.contains(body.position)) continue;
      }

      // 바람 힘은 표면적(크기)에 비례 — 질량의 역수 효과 적용
      const dragFactor = body.invMass > 0 ? Math.sqrt(1 / body.invMass) : 1;
      body.applyForce(windForce.scale(dragFactor * 0.5));
    }
  }

  setDirection(x, y) {
    this.direction.set(x, y);
  }

  setStrength(strength) {
    const dir = this.direction.normalize();
    this.direction = dir.scale(strength);
    this.strength = strength;
  }
}
