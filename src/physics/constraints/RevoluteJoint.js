/**
 * RevoluteJoint — 회전 조인트 (시소, 문, 그네)
 * 두 바디를 한 점에서 연결하여 회전만 허용
 */
import { Constraint } from './Constraint.js';
import { Vector2 } from '../Vector2.js';

export class RevoluteJoint extends Constraint {
  constructor(bodyA, bodyB, options = {}) {
    super(bodyA, bodyB, options);

    this.anchorA = options.anchorA
      ? new Vector2(options.anchorA.x, options.anchorA.y)
      : new Vector2(0, 0);
    this.anchorB = options.anchorB
      ? new Vector2(options.anchorB.x, options.anchorB.y)
      : new Vector2(0, 0);

    this.enableLimits = options.enableLimits || false;
    this.lowerAngle = options.lowerAngle ?? -Math.PI;
    this.upperAngle = options.upperAngle ?? Math.PI;

    this.enableMotor = options.enableMotor || false;
    this.motorSpeed = options.motorSpeed || 0;
    this.maxMotorTorque = options.maxMotorTorque || 0;

    this.referenceAngle = options.referenceAngle ?? (bodyB.angle - bodyA.angle);
  }

  _getWorldAnchorA() {
    return this.bodyA.position.add(this.anchorA.rotate(this.bodyA.angle));
  }

  _getWorldAnchorB() {
    return this.bodyB.position.add(this.anchorB.rotate(this.bodyB.angle));
  }

  solveVelocity(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const rA = anchorA.sub(this.bodyA.position);
    const rB = anchorB.sub(this.bodyB.position);

    // 선형 제약: 앵커 점을 일치시킴
    const velA = this.bodyA.velocity.add(
      new Vector2(-this.bodyA.angularVelocity * rA.y, this.bodyA.angularVelocity * rA.x)
    );
    const velB = this.bodyB.velocity.add(
      new Vector2(-this.bodyB.angularVelocity * rB.y, this.bodyB.angularVelocity * rB.x)
    );

    const relVel = velB.sub(velA);

    // X축, Y축 각각에 대해 제약
    for (const axis of [new Vector2(1, 0), new Vector2(0, 1)]) {
      const velAlongAxis = relVel.dot(axis);

      const rAxN = rA.cross(axis);
      const rBxN = rB.cross(axis);
      const invMass = this.bodyA.invMass + this.bodyB.invMass +
        rAxN * rAxN * this.bodyA.invInertia +
        rBxN * rBxN * this.bodyB.invInertia;

      if (invMass <= 0) continue;

      const impulse = -velAlongAxis / invMass;
      const j = axis.scale(impulse);

      this.bodyA.applyImpulseAt(j.negate(), anchorA);
      this.bodyB.applyImpulseAt(j, anchorB);
    }

    // 모터
    if (this.enableMotor) {
      const relAngVel = this.bodyB.angularVelocity - this.bodyA.angularVelocity;
      const motorError = relAngVel - this.motorSpeed;
      const invI = this.bodyA.invInertia + this.bodyB.invInertia;
      if (invI > 0) {
        let motorImpulse = -motorError / invI;
        motorImpulse = Math.max(-this.maxMotorTorque * dt, Math.min(this.maxMotorTorque * dt, motorImpulse));
        this.bodyA.angularVelocity -= motorImpulse * this.bodyA.invInertia;
        this.bodyB.angularVelocity += motorImpulse * this.bodyB.invInertia;
      }
    }

    // 각도 제한
    if (this.enableLimits) {
      const currentAngle = this.bodyB.angle - this.bodyA.angle - this.referenceAngle;
      const relAngVel = this.bodyB.angularVelocity - this.bodyA.angularVelocity;
      const invI = this.bodyA.invInertia + this.bodyB.invInertia;
      if (invI > 0) {
        if (currentAngle <= this.lowerAngle && relAngVel < 0) {
          const impulse = -relAngVel / invI;
          this.bodyA.angularVelocity -= impulse * this.bodyA.invInertia;
          this.bodyB.angularVelocity += impulse * this.bodyB.invInertia;
        } else if (currentAngle >= this.upperAngle && relAngVel > 0) {
          const impulse = -relAngVel / invI;
          this.bodyA.angularVelocity -= impulse * this.bodyA.invInertia;
          this.bodyB.angularVelocity += impulse * this.bodyB.invInertia;
        }
      }
    }
  }

  solvePosition(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const diff = anchorB.sub(anchorA);
    const error = diff.length();

    if (error < 0.01) return;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum <= 0) return;

    const correction = diff.scale(0.4 / invMassSum);

    if (!this.bodyA.isStatic) {
      this.bodyA.position = this.bodyA.position.add(correction.scale(this.bodyA.invMass));
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position = this.bodyB.position.sub(correction.scale(this.bodyB.invMass));
    }
  }
}
