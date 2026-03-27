/**
 * Gravity — 전역 중력 (0, 980)
 */
import { Vector2 } from '../Vector2.js';

export class Gravity {
  constructor(options = {}) {
    this.gravity = options.gravity
      ? new Vector2(options.gravity.x, options.gravity.y)
      : new Vector2(0, 980);
    this.enabled = true;
  }

  setGravity(x, y) {
    this.gravity.set(x, y);
  }

  apply(bodies, dt) {
    if (!this.enabled) return;

    for (const body of bodies) {
      if (body.isStatic || body.isSleeping) continue;
      if (body.type === 'kinematic') continue;

      // F = m * g
      const gravityForce = this.gravity.scale(body.mass);
      body.applyForce(gravityForce);
    }
  }
}
