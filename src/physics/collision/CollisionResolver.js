/**
 * CollisionResolver — 임펄스 기반 충돌 응답
 * 법선 임펄스 + 접선/마찰 임펄스 + Baumgarte position correction
 */
import { Vector2 } from '../Vector2.js';
import { PhysicsMaterial } from '../materials/PhysicsMaterial.js';

const BAUMGARTE_FACTOR = 0.4;
const SLOP = 0.01;

export class CollisionResolver {
  resolveVelocity(manifold) {
    const { bodyA, bodyB, normal } = manifold;

    if (bodyA.isSensor || bodyB.isSensor) return;

    for (const contact of manifold.contactPoints) {
      this._resolveContactVelocity(manifold, contact);
    }
  }

  _resolveContactVelocity(manifold, contact) {
    const { bodyA, bodyB, normal } = manifold;

    const rA = contact.sub(bodyA.position);
    const rB = contact.sub(bodyB.position);

    // 접촉점에서의 상대 속도
    const velA = bodyA.velocity.add(new Vector2(-bodyA.angularVelocity * rA.y, bodyA.angularVelocity * rA.x));
    const velB = bodyB.velocity.add(new Vector2(-bodyB.angularVelocity * rB.y, bodyB.angularVelocity * rB.x));
    const relVel = velB.sub(velA);

    const velAlongNormal = relVel.dot(normal);

    // 이미 분리 중이면 무시
    if (velAlongNormal > 0) return;

    // 반발 계수
    const e = Math.min(bodyA.material.restitution, bodyB.material.restitution);

    // 유효 질량 (회전 포함)
    const rAxN = rA.cross(normal);
    const rBxN = rB.cross(normal);
    const invMassSum = bodyA.invMass + bodyB.invMass +
      rAxN * rAxN * bodyA.invInertia +
      rBxN * rBxN * bodyB.invInertia;

    if (invMassSum <= 0) return;

    // 법선 임펄스
    let j = -(1 + e) * velAlongNormal / invMassSum;
    j /= manifold.contactPoints.length; // 접촉점 수로 나눔

    // 임펄스 축적 (클램핑)
    const oldAccumulated = manifold.accumulatedNormalImpulse;
    manifold.accumulatedNormalImpulse = Math.max(oldAccumulated + j, 0);
    j = manifold.accumulatedNormalImpulse - oldAccumulated;

    const impulse = normal.scale(j);
    bodyA.applyImpulseAt(impulse.negate(), contact);
    bodyB.applyImpulseAt(impulse, contact);

    // 마찰 임펄스
    const relVelAfter = this._getRelativeVelocity(bodyA, bodyB, rA, rB);
    const tangent = relVelAfter.sub(normal.scale(relVelAfter.dot(normal)));
    const tangentLen = tangent.length();
    if (tangentLen < 1e-10) return;

    const tangentDir = tangent.scale(1 / tangentLen);

    const rAxT = rA.cross(tangentDir);
    const rBxT = rB.cross(tangentDir);
    const invMassSumT = bodyA.invMass + bodyB.invMass +
      rAxT * rAxT * bodyA.invInertia +
      rBxT * rBxT * bodyB.invInertia;

    if (invMassSumT <= 0) return;

    let jt = -relVelAfter.dot(tangentDir) / invMassSumT;
    jt /= manifold.contactPoints.length;

    // Coulomb 마찰 법칙 (기하 평균 — 한쪽이 0이면 마찰 없음)
    const mu = Math.sqrt(bodyA.material.friction * bodyB.material.friction);

    // 마찰 임펄스 클램핑
    const oldTangent = manifold.accumulatedTangentImpulse;
    const maxFriction = manifold.accumulatedNormalImpulse * mu;
    manifold.accumulatedTangentImpulse = Math.max(
      -maxFriction,
      Math.min(maxFriction, oldTangent + jt)
    );
    jt = manifold.accumulatedTangentImpulse - oldTangent;

    const frictionImpulse = tangentDir.scale(jt);
    bodyA.applyImpulseAt(frictionImpulse.negate(), contact);
    bodyB.applyImpulseAt(frictionImpulse, contact);
  }

  resolvePosition(manifold) {
    const { bodyA, bodyB, normal, depth } = manifold;

    if (bodyA.isSensor || bodyB.isSensor) return;

    const invMassSum = bodyA.invMass + bodyB.invMass;
    if (invMassSum <= 0) return;

    const correction = normal.scale(
      Math.max(depth - SLOP, 0) / invMassSum * BAUMGARTE_FACTOR
    );

    if (!bodyA.isStatic) {
      bodyA.position = bodyA.position.sub(correction.scale(bodyA.invMass));
    }
    if (!bodyB.isStatic) {
      bodyB.position = bodyB.position.add(correction.scale(bodyB.invMass));
    }
  }

  _getRelativeVelocity(bodyA, bodyB, rA, rB) {
    const velA = bodyA.velocity.add(
      new Vector2(-bodyA.angularVelocity * rA.y, bodyA.angularVelocity * rA.x)
    );
    const velB = bodyB.velocity.add(
      new Vector2(-bodyB.angularVelocity * rB.y, bodyB.angularVelocity * rB.x)
    );
    return velB.sub(velA);
  }
}
