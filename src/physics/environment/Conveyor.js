/**
 * Conveyor — 컨베이어 벨트 (마찰력 기반 이동)
 * 접촉 바디에 벨트 방향 마찰력 추가
 */
import { Vector2 } from '../Vector2.js';

export class Conveyor {
  constructor(body, options = {}) {
    this.body = body;
    this.body.userData = this.body.userData || {};
    this.body.userData.conveyor = true;

    this.beltSpeed = options.beltSpeed || 120; // px/s
    this.direction = options.direction
      ? new Vector2(options.direction.x, options.direction.y).normalize()
      : new Vector2(1, 0); // 기본: 오른쪽

    this.frictionForce = options.frictionForce || 500;
    this.enabled = true;
  }

  /**
   * 컨베이어 위에 있는 바디에 벨트 힘 적용
   */
  applyBeltForce(contactBody, dt) {
    if (!this.enabled) return;
    if (contactBody.isStatic) return;

    // 벨트 방향의 목표 속도
    const targetVelocity = this.direction.scale(this.beltSpeed);

    // 현재 바디의 벨트 방향 속도
    const currentAlongBelt = contactBody.velocity.dot(this.direction);
    const targetAlongBelt = targetVelocity.dot(this.direction);

    // 속도 차이
    const diff = targetAlongBelt - currentAlongBelt;

    // 마찰력 방향으로 힘 적용
    const forceMagnitude = Math.sign(diff) * Math.min(Math.abs(diff) * contactBody.mass / dt, this.frictionForce);
    const force = this.direction.scale(forceMagnitude);

    contactBody.applyForce(force);
  }

  setDirection(x, y) {
    this.direction = new Vector2(x, y).normalize();
  }

  setSpeed(speed) {
    this.beltSpeed = speed;
  }

  reverse() {
    this.direction = this.direction.negate();
  }
}
