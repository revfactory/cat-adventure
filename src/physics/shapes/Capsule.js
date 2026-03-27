/**
 * Capsule — 캡슐 충돌체 (고양이 몸통)
 * radius: 캡슐 반지름, halfHeight: 중심에서 끝까지 거리 (반지름 미포함)
 */
import { Shape } from './Shape.js';
import { Vector2 } from '../Vector2.js';
import { AABB } from './AABB.js';

export class Capsule extends Shape {
  constructor(radius, halfHeight) {
    super('capsule');
    this.radius = radius;
    this.halfHeight = halfHeight;
  }

  getTopCenter() {
    const offset = new Vector2(0, -this.halfHeight);
    if (!this.body) return offset;
    return this.body.position.add(offset.rotate(this.body.angle));
  }

  getBottomCenter() {
    const offset = new Vector2(0, this.halfHeight);
    if (!this.body) return offset;
    return this.body.position.add(offset.rotate(this.body.angle));
  }

  getWorldVertices() {
    return [this.getTopCenter(), this.getBottomCenter()];
  }

  getNormals() {
    const top = this.getTopCenter();
    const bottom = this.getBottomCenter();
    const axis = bottom.sub(top).normalize();
    return [axis, axis.perpendicular()];
  }

  project(axis) {
    const top = this.getTopCenter();
    const bottom = this.getBottomCenter();
    const projTop = top.dot(axis);
    const projBottom = bottom.dot(axis);
    const min = Math.min(projTop, projBottom) - this.radius;
    const max = Math.max(projTop, projBottom) + this.radius;
    return { min, max };
  }

  getAABB() {
    const top = this.getTopCenter();
    const bottom = this.getBottomCenter();
    const r = this.radius;
    return new AABB(
      new Vector2(
        Math.min(top.x, bottom.x) - r,
        Math.min(top.y, bottom.y) - r
      ),
      new Vector2(
        Math.max(top.x, bottom.x) + r,
        Math.max(top.y, bottom.y) + r
      )
    );
  }

  computeArea() {
    return Math.PI * this.radius * this.radius + 2 * this.radius * this.halfHeight * 2;
  }

  computeInertia(mass) {
    const r = this.radius;
    const h = this.halfHeight * 2;
    const circleArea = Math.PI * r * r;
    const rectArea = 2 * r * h;
    const totalArea = circleArea + rectArea;
    const circleMass = mass * (circleArea / totalArea);
    const rectMass = mass * (rectArea / totalArea);
    const circleI = 0.5 * circleMass * r * r + circleMass * (h / 2) * (h / 2);
    const rectI = rectMass * ((2 * r) * (2 * r) + h * h) / 12;
    return circleI + rectI;
  }

  closestPointOnSegment(point) {
    const top = this.getTopCenter();
    const bottom = this.getBottomCenter();
    const seg = bottom.sub(top);
    const lenSq = seg.lengthSq();
    if (lenSq < 1e-10) return top;
    let t = point.sub(top).dot(seg) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return top.add(seg.scale(t));
  }
}
