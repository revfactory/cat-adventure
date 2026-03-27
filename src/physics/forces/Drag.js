/**
 * Drag — 공기/수중 저항
 * F_drag = -c * v * |v|
 */
import { Vector2 } from '../Vector2.js';

export class Drag {
  constructor(options = {}) {
    this.coefficient = options.coefficient ?? 0.01;
    this.angularCoefficient = options.angularCoefficient ?? 0.005;
    this.enabled = true;
  }

  apply(bodies, dt) {
    if (!this.enabled) return;

    for (const body of bodies) {
      if (body.isStatic || body.isSleeping) continue;

      const speed = body.velocity.length();
      if (speed > 0.01) {
        const dragForce = body.velocity.normalize().scale(-this.coefficient * speed * speed);
        body.applyForce(dragForce);
      }

      if (Math.abs(body.angularVelocity) > 0.01) {
        const angularDrag = -this.angularCoefficient * body.angularVelocity * Math.abs(body.angularVelocity);
        body.torque += angularDrag;
      }
    }
  }
}
