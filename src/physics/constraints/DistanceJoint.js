/**
 * DistanceJoint — 거리 제약 (로프, 빨래줄, 체인)
 */
import { Constraint } from './Constraint.js';
import { Vector2 } from '../Vector2.js';

export class DistanceJoint extends Constraint {
  constructor(bodyA, bodyB, options = {}) {
    super(bodyA, bodyB, options);

    this.anchorA = options.anchorA
      ? new Vector2(options.anchorA.x, options.anchorA.y)
      : new Vector2(0, 0);
    this.anchorB = options.anchorB
      ? new Vector2(options.anchorB.x, options.anchorB.y)
      : new Vector2(0, 0);

    this.targetLength = options.length ?? this._computeCurrentLength();
    this.minLength = options.minLength ?? 0;
    this.maxLength = options.maxLength ?? this.targetLength;
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

    // 로프 모드: 최대 길이만 제약
    if (dist <= this.maxLength && dist >= this.minLength) return;

    const normal = diff.scale(1 / dist);
    const rA = anchorA.sub(this.bodyA.position);
    const rB = anchorB.sub(this.bodyB.position);

    // 접촉점에서의 상대 속도
    const velA = this.bodyA.velocity.add(
      new Vector2(-this.bodyA.angularVelocity * rA.y, this.bodyA.angularVelocity * rA.x)
    );
    const velB = this.bodyB.velocity.add(
      new Vector2(-this.bodyB.angularVelocity * rB.y, this.bodyB.angularVelocity * rB.x)
    );

    const relVel = velB.sub(velA).dot(normal);

    // 유효 질량
    const rAxN = rA.cross(normal);
    const rBxN = rB.cross(normal);
    const invMass = this.bodyA.invMass + this.bodyB.invMass +
      rAxN * rAxN * this.bodyA.invInertia +
      rBxN * rBxN * this.bodyB.invInertia;

    if (invMass <= 0) return;

    // 바이어스 (위치 에러 보정)
    let bias = 0;
    if (dist > this.maxLength) {
      bias = (dist - this.maxLength) * 0.2 / dt;
    } else if (dist < this.minLength) {
      bias = (dist - this.minLength) * 0.2 / dt;
    }

    let impulse = -(relVel + bias + this.damping * relVel) * this.stiffness / invMass;

    this.accumulatedImpulse += impulse;

    const j = normal.scale(impulse);
    this.bodyA.applyImpulseAt(j.negate(), anchorA);
    this.bodyB.applyImpulseAt(j, anchorB);

    this.checkBreak();
  }

  solvePosition(dt) {
    if (this.isBroken) return;

    const anchorA = this._getWorldAnchorA();
    const anchorB = this._getWorldAnchorB();
    const diff = anchorB.sub(anchorA);
    const dist = diff.length();

    if (dist < 1e-10) return;

    let error = 0;
    if (dist > this.maxLength) {
      error = dist - this.maxLength;
    } else if (dist < this.minLength) {
      error = dist - this.minLength;
    }

    if (Math.abs(error) < 0.01) return;

    const normal = diff.scale(1 / dist);
    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum <= 0) return;

    const correction = normal.scale(error * 0.4 / invMassSum);

    if (!this.bodyA.isStatic) {
      this.bodyA.position = this.bodyA.position.add(correction.scale(this.bodyA.invMass));
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position = this.bodyB.position.sub(correction.scale(this.bodyB.invMass));
    }
  }
}
