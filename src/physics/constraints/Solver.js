/**
 * Solver — Sequential Impulse Solver (warm starting)
 * velocityIterations, positionIterations 기반 반복 솔버
 */
import { CollisionResolver } from '../collision/CollisionResolver.js';

export class Solver {
  constructor(options = {}) {
    this.velocityIterations = options.velocityIterations || 8;
    this.positionIterations = options.positionIterations || 3;
    this.resolver = new CollisionResolver();

    // Warm starting: 이전 프레임 매니폴드 캐시
    this._manifoldCache = new Map();
  }

  solve(manifolds, constraints, dt) {
    // Warm starting: 이전 프레임에서 축적된 임펄스를 초기값으로 적용
    this._warmStart(manifolds);

    // 속도 반복
    for (let i = 0; i < this.velocityIterations; i++) {
      // 제약 조건 속도 솔브
      for (const constraint of constraints) {
        if (constraint.isBroken) continue;
        constraint.solveVelocity(dt);
      }

      // 충돌 속도 솔브
      for (const manifold of manifolds) {
        this.resolver.resolveVelocity(manifold);
      }
    }

    // 위치 반복
    for (let i = 0; i < this.positionIterations; i++) {
      // 제약 조건 위치 솔브
      for (const constraint of constraints) {
        if (constraint.isBroken) continue;
        constraint.solvePosition(dt);
      }

      // 충돌 위치 보정
      for (const manifold of manifolds) {
        this.resolver.resolvePosition(manifold);
      }
    }

    // 매니폴드 캐시 갱신
    this._updateCache(manifolds);
  }

  _warmStart(manifolds) {
    for (const manifold of manifolds) {
      const key = this._manifoldKey(manifold);
      const cached = this._manifoldCache.get(key);

      if (cached) {
        manifold.accumulatedNormalImpulse = cached.accumulatedNormalImpulse * 0.8;
        manifold.accumulatedTangentImpulse = cached.accumulatedTangentImpulse * 0.8;

        // warm impulse 적용
        const normalImpulse = manifold.normal.scale(manifold.accumulatedNormalImpulse);
        const tangent = manifold.normal.perpendicular();
        const tangentImpulse = tangent.scale(manifold.accumulatedTangentImpulse);
        const totalImpulse = normalImpulse.add(tangentImpulse);

        if (!manifold.bodyA.isStatic) {
          manifold.bodyA.applyImpulse(totalImpulse.negate());
        }
        if (!manifold.bodyB.isStatic) {
          manifold.bodyB.applyImpulse(totalImpulse);
        }
      }
    }
  }

  _updateCache(manifolds) {
    this._manifoldCache.clear();
    for (const manifold of manifolds) {
      const key = this._manifoldKey(manifold);
      this._manifoldCache.set(key, {
        accumulatedNormalImpulse: manifold.accumulatedNormalImpulse,
        accumulatedTangentImpulse: manifold.accumulatedTangentImpulse,
      });
    }
  }

  _manifoldKey(manifold) {
    const idA = Math.min(manifold.bodyA.id, manifold.bodyB.id);
    const idB = Math.max(manifold.bodyA.id, manifold.bodyB.id);
    return `${idA}:${idB}`;
  }
}
