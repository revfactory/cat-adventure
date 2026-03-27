/**
 * PrismaticJoint — 직선 슬라이드 제약 (엘리베이터, 크레인)
 * 한 축 방향으로만 이동 가능, 다른 축 고정
 */
import { Constraint } from './Constraint.js';
import { Vector2 } from '../Vector2.js';

export class PrismaticJoint extends Constraint {
  constructor(bodyA, bodyB, options = {}) {
    super(bodyA, bodyB, options);

    // 슬라이드 축 (월드 좌표)
    this.axis = options.axis
      ? new Vector2(options.axis.x, options.axis.y).normalize()
      : new Vector2(1, 0);

    this.anchorA = options.anchorA
      ? new Vector2(options.anchorA.x, options.anchorA.y)
      : new Vector2(0, 0);
    this.anchorB = options.anchorB
      ? new Vector2(options.anchorB.x, options.anchorB.y)
      : new Vector2(0, 0);

    // 이동 범위 제한
    this.enableLimits = options.enableLimits ?? true;
    this.lowerLimit = options.lowerLimit ?? -100;
    this.upperLimit = options.upperLimit ?? 100;

    // 모터
    this.enableMotor = options.enableMotor || false;
    this.motorSpeed = options.motorSpeed || 0;
    this.maxMotorForce = options.maxMotorForce || 1000;

    this._referenceOffset = this._computeOffset();
  }

  _getWorldAnchorA() {
    return this.bodyA.position.add(this.anchorA.rotate(this.bodyA.angle));
  }

  _getWorldAnchorB() {
    return this.bodyB.position.add(this.anchorB.rotate(this.bodyB.angle));
  }

  _computeOffset() {
    const diff = this._getWorldAnchorB().sub(this._getWorldAnchorA());
    return diff.dot(this.axis);
  }

  solveVelocity(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const rA = anchorA.sub(this.bodyA.position);
    const rB = anchorB.sub(this.bodyB.position);

    // 축에 수직인 방향의 속도를 제거
    const perpAxis = this.axis.perpendicular();

    const velA = this.bodyA.velocity.add(
      new Vector2(-this.bodyA.angularVelocity * rA.y, this.bodyA.angularVelocity * rA.x)
    );
    const velB = this.bodyB.velocity.add(
      new Vector2(-this.bodyB.angularVelocity * rB.y, this.bodyB.angularVelocity * rB.x)
    );

    const relVel = velB.sub(velA);

    // 수직 방향 제약
    const perpVel = relVel.dot(perpAxis);
    const rAxP = rA.cross(perpAxis);
    const rBxP = rB.cross(perpAxis);
    const invMassPerp = this.bodyA.invMass + this.bodyB.invMass +
      rAxP * rAxP * this.bodyA.invInertia +
      rBxP * rBxP * this.bodyB.invInertia;

    if (invMassPerp > 0) {
      const impulse = -perpVel / invMassPerp;
      const j = perpAxis.scale(impulse);
      this.bodyA.applyImpulseAt(j.negate(), anchorA);
      this.bodyB.applyImpulseAt(j, anchorB);
    }

    // 모터
    if (this.enableMotor) {
      const axisVel = relVel.dot(this.axis);
      const motorError = axisVel - this.motorSpeed;
      const rAxA = rA.cross(this.axis);
      const rBxA = rB.cross(this.axis);
      const invMassAxis = this.bodyA.invMass + this.bodyB.invMass +
        rAxA * rAxA * this.bodyA.invInertia +
        rBxA * rBxA * this.bodyB.invInertia;

      if (invMassAxis > 0) {
        let motorImpulse = -motorError / invMassAxis;
        const maxImpulse = this.maxMotorForce * dt;
        motorImpulse = Math.max(-maxImpulse, Math.min(maxImpulse, motorImpulse));

        const j = this.axis.scale(motorImpulse);
        this.bodyA.applyImpulseAt(j.negate(), anchorA);
        this.bodyB.applyImpulseAt(j, anchorB);
      }
    }

    // 이동 범위 제한
    if (this.enableLimits) {
      const offset = this._computeOffset() - this._referenceOffset;
      const axisVel = relVel.dot(this.axis);

      if (offset <= this.lowerLimit && axisVel < 0) {
        const rAxA = rA.cross(this.axis);
        const rBxA = rB.cross(this.axis);
        const invMassAxis = this.bodyA.invMass + this.bodyB.invMass +
          rAxA * rAxA * this.bodyA.invInertia +
          rBxA * rBxA * this.bodyB.invInertia;
        if (invMassAxis > 0) {
          const impulse = -axisVel / invMassAxis;
          const j = this.axis.scale(impulse);
          this.bodyA.applyImpulseAt(j.negate(), anchorA);
          this.bodyB.applyImpulseAt(j, anchorB);
        }
      } else if (offset >= this.upperLimit && axisVel > 0) {
        const rAxA = rA.cross(this.axis);
        const rBxA = rB.cross(this.axis);
        const invMassAxis = this.bodyA.invMass + this.bodyB.invMass +
          rAxA * rAxA * this.bodyA.invInertia +
          rBxA * rBxA * this.bodyB.invInertia;
        if (invMassAxis > 0) {
          const impulse = -axisVel / invMassAxis;
          const j = this.axis.scale(impulse);
          this.bodyA.applyImpulseAt(j.negate(), anchorA);
          this.bodyB.applyImpulseAt(j, anchorB);
        }
      }
    }
  }

  solvePosition(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const diff = anchorB.sub(anchorA);

    // 수직 방향 위치 보정
    const perpAxis = this.axis.perpendicular();
    const perpError = diff.dot(perpAxis);

    if (Math.abs(perpError) < 0.01) return;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum <= 0) return;

    const correction = perpAxis.scale(perpError * 0.4 / invMassSum);
    if (!this.bodyA.isStatic) {
      this.bodyA.position = this.bodyA.position.add(correction.scale(this.bodyA.invMass));
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position = this.bodyB.position.sub(correction.scale(this.bodyB.invMass));
    }
  }
}
