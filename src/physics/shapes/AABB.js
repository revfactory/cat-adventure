/**
 * AABB — 축 정렬 바운딩 박스
 */
import { Vector2 } from '../Vector2.js';

export class AABB {
  constructor(min, max) {
    this.min = min instanceof Vector2 ? min : new Vector2(min.x, min.y);
    this.max = max instanceof Vector2 ? max : new Vector2(max.x, max.y);
  }

  overlaps(other) {
    return !(
      this.max.x < other.min.x ||
      this.min.x > other.max.x ||
      this.max.y < other.min.y ||
      this.min.y > other.max.y
    );
  }

  contains(point) {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y
    );
  }

  merge(other) {
    return new AABB(
      new Vector2(Math.min(this.min.x, other.min.x), Math.min(this.min.y, other.min.y)),
      new Vector2(Math.max(this.max.x, other.max.x), Math.max(this.max.y, other.max.y))
    );
  }

  get width() {
    return this.max.x - this.min.x;
  }

  get height() {
    return this.max.y - this.min.y;
  }

  get center() {
    return new Vector2(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5
    );
  }

  expand(margin) {
    return new AABB(
      new Vector2(this.min.x - margin, this.min.y - margin),
      new Vector2(this.max.x + margin, this.max.y + margin)
    );
  }
}
