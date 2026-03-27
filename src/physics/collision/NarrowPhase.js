/**
 * NarrowPhase — SAT 기반 정밀 충돌 감지
 * polygon-polygon, circle-circle, circle-polygon, capsule 특수 처리
 */
import { Vector2 } from '../Vector2.js';
import { Manifold } from './Manifold.js';

export class NarrowPhase {
  detect(bodyA, bodyB) {
    const shapeA = bodyA.shape;
    const shapeB = bodyB.shape;

    if (!shapeA || !shapeB) return null;

    const typeA = shapeA.type;
    const typeB = shapeB.type;

    // 디스패치 테이블
    if (typeA === 'circle' && typeB === 'circle') {
      return this._circleVsCircle(bodyA, bodyB);
    }
    if (typeA === 'circle' && typeB === 'polygon') {
      return this._circleVsPolygon(bodyA, bodyB, false);
    }
    if (typeA === 'polygon' && typeB === 'circle') {
      return this._circleVsPolygon(bodyB, bodyA, true);
    }
    if (typeA === 'polygon' && typeB === 'polygon') {
      return this._polygonVsPolygon(bodyA, bodyB);
    }
    if (typeA === 'capsule' || typeB === 'capsule') {
      return this._capsuleCollision(bodyA, bodyB);
    }

    return null;
  }

  _circleVsCircle(bodyA, bodyB) {
    const centerA = bodyA.shape.getCenter();
    const centerB = bodyB.shape.getCenter();
    const rA = bodyA.shape.radius;
    const rB = bodyB.shape.radius;

    const diff = centerB.sub(centerA);
    const distSq = diff.lengthSq();
    const totalR = rA + rB;

    if (distSq >= totalR * totalR) return null;

    const dist = Math.sqrt(distSq);
    let normal;
    if (dist < 1e-10) {
      normal = new Vector2(0, -1);
    } else {
      normal = diff.scale(1 / dist);
    }

    const depth = totalR - dist;
    const contactPoint = centerA.add(normal.scale(rA));

    const manifold = new Manifold(bodyA, bodyB, normal, depth);
    manifold.addContactPoint(contactPoint);
    return manifold;
  }

  _circleVsPolygon(circleBody, polyBody, flipped) {
    const center = circleBody.shape.getCenter();
    const radius = circleBody.shape.radius;
    const verts = polyBody.shape.getWorldVertices();

    let minDist = Infinity;
    let closestPoint = null;
    let closestNormal = null;
    let isInside = true;

    for (let i = 0; i < verts.length; i++) {
      const v1 = verts[i];
      const v2 = verts[(i + 1) % verts.length];
      const edge = v2.sub(v1);
      const normal = edge.perpendicular().normalize();

      // 원 중심을 에지에 투영
      const toCenter = center.sub(v1);
      const projOnNormal = toCenter.dot(normal);

      if (projOnNormal > 0) isInside = false;

      // 에지 위의 가장 가까운 점
      const t = Math.max(0, Math.min(1, toCenter.dot(edge) / edge.lengthSq()));
      const closest = v1.add(edge.scale(t));
      const dist = center.distanceTo(closest);

      if (dist < minDist) {
        minDist = dist;
        closestPoint = closest;
        closestNormal = normal;
      }
    }

    // 내부에 있는 경우 또는 거리가 반지름 이내
    if (isInside) {
      // 원 중심이 폴리곤 내부에 있음
      const depth = radius + minDist;
      const normal = flipped ? closestNormal.negate() : closestNormal;
      const manifold = new Manifold(
        flipped ? circleBody : polyBody,
        flipped ? polyBody : circleBody,
        flipped ? normal.negate() : normal,
        depth
      );
      manifold.addContactPoint(closestPoint);
      // 올바른 순서로 재배치
      if (flipped) {
        manifold.bodyA = polyBody;
        manifold.bodyB = circleBody;
        manifold.normal = closestNormal;
      } else {
        manifold.bodyA = circleBody;
        manifold.bodyB = polyBody;
        manifold.normal = closestNormal.negate();
      }
      return manifold;
    }

    if (minDist >= radius) return null;

    const depth = radius - minDist;
    let normal = center.sub(closestPoint);
    if (normal.lengthSq() < 1e-10) {
      normal = closestNormal;
    } else {
      normal = normal.normalize();
    }

    const manifold = new Manifold(
      flipped ? polyBody : circleBody,
      flipped ? circleBody : polyBody,
      flipped ? normal.negate() : normal,
      depth
    );
    manifold.addContactPoint(closestPoint);

    // 순서 보정: bodyA, bodyB 순서를 원래 호출 순서에 맞춤
    if (flipped) {
      manifold.bodyA = polyBody;
      manifold.bodyB = circleBody;
      manifold.normal = normal.negate();
    }

    return manifold;
  }

  _polygonVsPolygon(bodyA, bodyB) {
    const shapeA = bodyA.shape;
    const shapeB = bodyB.shape;

    const normalsA = shapeA.getNormals();
    const normalsB = shapeB.getNormals();
    const axes = [...normalsA, ...normalsB];

    let minOverlap = Infinity;
    let collisionNormal = null;

    for (const axis of axes) {
      const projA = shapeA.project(axis);
      const projB = shapeB.project(axis);

      const overlap = Math.min(projA.max - projB.min, projB.max - projA.min);

      if (overlap <= 0) return null;

      if (overlap < minOverlap) {
        minOverlap = overlap;
        collisionNormal = axis;
      }
    }

    // 법선 방향 보정 (A→B)
    const d = bodyB.position.sub(bodyA.position);
    if (d.dot(collisionNormal) < 0) {
      collisionNormal = collisionNormal.negate();
    }

    const manifold = new Manifold(bodyA, bodyB, collisionNormal, minOverlap);

    // 접촉점 계산
    const contacts = this._findContactPoints(bodyA, bodyB, collisionNormal);
    for (const cp of contacts) {
      manifold.addContactPoint(cp);
    }

    return manifold;
  }

  _findContactPoints(bodyA, bodyB, normal) {
    const vertsA = bodyA.shape.getWorldVertices();
    const vertsB = bodyB.shape.getWorldVertices();

    // 가장 깊이 파고든 꼭짓점을 접촉점으로
    const contacts = [];

    // bodyB의 꼭짓점 중 bodyA 내부에 가장 깊이 들어간 점
    let bestDist = -Infinity;
    let bestPoint = null;
    for (const v of vertsB) {
      const dist = v.sub(bodyA.position).dot(normal.negate());
      if (dist > bestDist) {
        bestDist = dist;
        bestPoint = v;
      }
    }
    if (bestPoint) contacts.push(bestPoint);

    // bodyA의 꼭짓점 중 bodyB 내부에 가장 깊이 들어간 점
    bestDist = -Infinity;
    bestPoint = null;
    for (const v of vertsA) {
      const dist = v.sub(bodyB.position).dot(normal);
      if (dist > bestDist) {
        bestDist = dist;
        bestPoint = v;
      }
    }
    if (bestPoint) contacts.push(bestPoint);

    return contacts;
  }

  _capsuleCollision(bodyA, bodyB) {
    // 캡슐은 두 원의 라인세그먼트로 분해
    const capsuleBody = bodyA.shape.type === 'capsule' ? bodyA : bodyB;
    const otherBody = capsuleBody === bodyA ? bodyB : bodyA;
    const capsule = capsuleBody.shape;
    const otherShape = otherBody.shape;

    if (otherShape.type === 'circle') {
      return this._capsuleVsCircle(capsuleBody, otherBody);
    }
    if (otherShape.type === 'polygon') {
      return this._capsuleVsPolygon(capsuleBody, otherBody);
    }
    if (otherShape.type === 'capsule') {
      return this._capsuleVsCapsule(bodyA, bodyB);
    }

    return null;
  }

  _capsuleVsCircle(capsuleBody, circleBody) {
    const capsule = capsuleBody.shape;
    const circle = circleBody.shape;
    const circleCenter = circle.getCenter();

    const closest = capsule.closestPointOnSegment(circleCenter);
    const diff = circleCenter.sub(closest);
    const distSq = diff.lengthSq();
    const totalR = capsule.radius + circle.radius;

    if (distSq >= totalR * totalR) return null;

    const dist = Math.sqrt(distSq);
    let normal;
    if (dist < 1e-10) {
      normal = new Vector2(0, -1);
    } else {
      normal = diff.scale(1 / dist);
    }

    const depth = totalR - dist;
    const contactPoint = closest.add(normal.scale(capsule.radius));

    const manifold = new Manifold(capsuleBody, circleBody, normal, depth);
    manifold.addContactPoint(contactPoint);
    return manifold;
  }

  _capsuleVsPolygon(capsuleBody, polyBody) {
    const capsule = capsuleBody.shape;
    const polyVerts = polyBody.shape.getWorldVertices();
    const capsuleTop = capsule.getTopCenter();
    const capsuleBottom = capsule.getBottomCenter();
    const r = capsule.radius;

    // 전략: 캡슐 세그먼트 위의 여러 "구" 중심에서 폴리곤까지 최단 거리를 구함.
    // 폴리곤의 각 에지에 대해 캡슐 세그먼트와의 최소 거리를 구하고
    // 가장 깊이 침투한 에지의 법선을 사용.

    // 1. 캡슐 세그먼트와 폴리곤 에지 간 최소 거리 구하기
    let minDist = Infinity;
    let closestOnCapsule = null;
    let closestOnPoly = null;
    let bestEdgeIndex = -1;

    for (let i = 0; i < polyVerts.length; i++) {
      const v1 = polyVerts[i];
      const v2 = polyVerts[(i + 1) % polyVerts.length];

      const result = this._segmentToSegment(capsuleTop, capsuleBottom, v1, v2);
      if (result.dist < minDist) {
        minDist = result.dist;
        closestOnCapsule = result.closestA;
        closestOnPoly = result.closestB;
        bestEdgeIndex = i;
      }
    }

    // 폴리곤 꼭짓점도 검사
    let isVertexCollision = false;
    for (const v of polyVerts) {
      const closest = capsule.closestPointOnSegment(v);
      const dist = closest.distanceTo(v);
      if (dist < minDist) {
        minDist = dist;
        closestOnCapsule = closest;
        closestOnPoly = v;
        bestEdgeIndex = -1;
        isVertexCollision = true;
      }
    }

    if (minDist >= r) return null;

    // 2. 충돌 법선 결정
    let normal;
    const diff = closestOnPoly.sub(closestOnCapsule);
    const diffLen = diff.length();

    if (diffLen > 1e-6) {
      // 가장 가까운 점이 분리되어 있음 → 점 연결 방향이 법선
      normal = diff.scale(1 / diffLen);
    } else {
      // 캡슐 세그먼트가 폴리곤 에지와 교차/접촉 → 에지 법선 사용
      if (bestEdgeIndex >= 0) {
        const v1 = polyVerts[bestEdgeIndex];
        const v2 = polyVerts[(bestEdgeIndex + 1) % polyVerts.length];
        const edge = v2.sub(v1);
        const edgeN = edge.perpendicular().normalize();
        // perpendicular()은 이 polygon winding에서 내향 법선.
        // manifold normal은 A(capsule)→B(polygon) 방향 = 내향이 맞음.
        normal = edgeN;
      } else {
        // 폴백: 캡슐→폴리곤 중심 방향
        const cd = polyBody.position.sub(capsuleBody.position);
        normal = cd.lengthSq() > 1e-10 ? cd.normalize() : new Vector2(0, 1);
      }
    }

    const depth = r - minDist;
    const contactPoint = closestOnCapsule.add(normal.scale(r));

    const manifold = new Manifold(capsuleBody, polyBody, normal, depth);
    manifold.addContactPoint(contactPoint);
    return manifold;
  }

  _capsuleVsCapsule(bodyA, bodyB) {
    const capA = bodyA.shape;
    const capB = bodyB.shape;

    const topA = capA.getTopCenter();
    const botA = capA.getBottomCenter();
    const topB = capB.getTopCenter();
    const botB = capB.getBottomCenter();

    const result = this._segmentToSegment(topA, botA, topB, botB);
    const totalR = capA.radius + capB.radius;

    if (result.dist >= totalR) return null;

    const diff = result.closestB.sub(result.closestA);
    let normal;
    if (diff.lengthSq() < 1e-10) {
      normal = new Vector2(0, -1);
    } else {
      normal = diff.normalize();
    }

    const depth = totalR - result.dist;
    const contactPoint = result.closestA.add(normal.scale(capA.radius));

    const manifold = new Manifold(bodyA, bodyB, normal, depth);
    manifold.addContactPoint(contactPoint);
    return manifold;
  }

  _segmentToSegment(a1, a2, b1, b2) {
    const d1 = a2.sub(a1);
    const d2 = b2.sub(b1);
    const r = a1.sub(b1);

    const a = d1.dot(d1);
    const e = d2.dot(d2);
    const f = d2.dot(r);

    let s, t;

    if (a < 1e-10 && e < 1e-10) {
      s = t = 0;
    } else if (a < 1e-10) {
      s = 0;
      t = Math.max(0, Math.min(1, f / e));
    } else {
      const c = d1.dot(r);
      if (e < 1e-10) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else {
        const b = d1.dot(d2);
        const denom = a * e - b * b;
        if (denom !== 0) {
          s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
        } else {
          s = 0;
        }
        t = (b * s + f) / e;
        if (t < 0) {
          t = 0;
          s = Math.max(0, Math.min(1, -c / a));
        } else if (t > 1) {
          t = 1;
          s = Math.max(0, Math.min(1, (b - c) / a));
        }
      }
    }

    const closestA = a1.add(d1.scale(s));
    const closestB = b1.add(d2.scale(t));
    const dist = closestA.distanceTo(closestB);

    return { closestA, closestB, dist, s, t };
  }
}
