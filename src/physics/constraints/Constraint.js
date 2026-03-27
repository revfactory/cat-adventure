/**
 * Constraint — 제약 베이스 클래스
 */
export class Constraint {
  constructor(bodyA, bodyB, options = {}) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.stiffness = options.stiffness ?? 1.0;
    this.damping = options.damping ?? 0.0;
    this.breakForce = options.breakForce ?? Infinity;
    this.isBroken = false;
    this.accumulatedImpulse = 0;
  }

  solveVelocity(dt) {
    // Override in subclass
  }

  solvePosition(dt) {
    // Override in subclass
  }

  checkBreak() {
    if (Math.abs(this.accumulatedImpulse) > this.breakForce) {
      this.isBroken = true;
      return true;
    }
    return false;
  }
}
