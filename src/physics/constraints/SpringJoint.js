/**
 * SpringJoint — 스프링 (탄성 플랫폼, 트램폴린, 안테나)
 * Hooke's law: F = -k * (x - restLength) - c * v
 */
import { Constraint } from './Constraint.js';
import { Vector2 } from '../Vector2.js';

export class SpringJoint extends Constraint {
  constructor(bodyA, bodyB, options = {}) {
    super(bodyA, bodyB, options);

    this.anchorA = options.anchorA
      ? new Vector2(options.anchorA.x, options.anchorA.y)
      : new Vector2(0, 0);
    this.anchorB = options.anchorB
      ? new Vector2(options.anchorB.x, options.anchorB.y)
      : new Vector2(0, 0);

    this.springConstant = options.springConstant ?? options.stiffness ?? 800;
    this.dampingCoefficient = options.dampingCoefficient ?? options.damping ?? 0.2;
    this.restLength = options.restLength ?? this._computeCurrentLength();
  }

  _getWorldAnchorA() {
    return this.bodyA.position.add(this.anchorA.rotate(this.bodyA.angle));
  }

  _getWorldAnchorB() {
    return this.bodyB.position.add(this.anchorB.rotate(this.bodyB.angle));
  }

  _computeCurrentLength() {
    return this._getWorldAnchorA().distanceTo(this._getWorldAnchorB());
  }

  solveVelocity(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const diff = anchorB.sub(anchorA);
    const dist = diff.length();

    if (dist < 1e-10) return;

    const normal = diff.scale(1 / dist);
    const displacement = dist - this.restLength;

    // Hooke's law + damping
    const rA = anchorA.sub(this.bodyA.position);
    const rB = anchorB.sub(this.bodyB.position);

    const velA = this.bodyA.velocity.add(
      new Vector2(-this.bodyA.angularVelocity * rA.y, this.bodyA.angularVelocity * rA.x)
    );
    const velB = this.bodyB.velocity.add(
      new Vector2(-this.bodyB.angularVelocity * rB.y, this.bodyB.angularVelocity * rB.x)
    );

    const relVel = velB.sub(velA).dot(normal);

    const springForce = this.springConstant * displacement;
    const dampingForce = this.dampingCoefficient * relVel;

    const totalForce = springForce + dampingForce;
    const force = normal.scale(totalForce);

    this.bodyA.applyForceAt(force, anchorA);
    this.bodyB.applyForceAt(force.negate(), anchorB);

    this.accumulatedImpulse += Math.abs(totalForce * dt);
    this.checkBreak();
  }

  solvePosition(dt) {
    // 스프링은 위치 보정 없이 힘으로만 동작
  }
}
