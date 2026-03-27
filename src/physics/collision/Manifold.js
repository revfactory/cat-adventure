/**
 * Manifold — 충돌 접촉 정보
 * normal, depth, contactPoints
 */
import { Vector2 } from '../Vector2.js';

export class Manifold {
  constructor(bodyA, bodyB, normal, depth, contactPoints = null) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.normal = normal;  // A→B 방향
    this.depth = depth;    // 관통 깊이
    this.contactPoints = contactPoints || [];

    // Warm starting 용
    this.warmNormalImpulse = 0;
    this.warmTangentImpulse = 0;

    // 임펄스 축적 (클램핑용)
    this.accumulatedNormalImpulse = 0;
    this.accumulatedTangentImpulse = 0;
  }

  addContactPoint(point) {
    this.contactPoints.push(point instanceof Vector2 ? point : new Vector2(point.x, point.y));
  }

  getContactCenter() {
    if (this.contactPoints.length === 0) {
      return this.bodyA.position.add(this.bodyB.position).scale(0.5);
    }
    let sum = new Vector2(0, 0);
    for (const cp of this.contactPoints) {
      sum = sum.add(cp);
    }
    return sum.scale(1 / this.contactPoints.length);
  }

  getImpulseMagnitude() {
    return Math.abs(this.accumulatedNormalImpulse);
  }
}
