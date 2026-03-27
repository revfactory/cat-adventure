/**
 * Circle — 원형 충돌체
 */
import { Shape } from './Shape.js';
import { Vector2 } from '../Vector2.js';
import { AABB } from './AABB.js';

export class Circle extends Shape {
  constructor(radius, offset = null) {
    super('circle');
    this.radius = radius;
    this.offset = offset || new Vector2(0, 0);
  }

  getCenter() {
    if (!this.body) return this.offset.clone();
    return this.body.position.add(this.offset.rotate(this.body.angle));
  }

  getWorldVertices() {
    return [this.getCenter()];
  }

  getNormals() {
    return [];
  }

  project(axis) {
    const center = this.getCenter();
    const proj = center.dot(axis);
    return { min: proj - this.radius, max: proj + this.radius };
  }

  getAABB() {
    const center = this.getCenter();
    return new AABB(
      new Vector2(center.x - this.radius, center.y - this.radius),
      new Vector2(center.x + this.radius, center.y + this.radius)
    );
  }

  computeArea() {
    return Math.PI * this.radius * this.radius;
  }

  computeInertia(mass) {
    return 0.5 * mass * this.radius * this.radius;
  }
}
