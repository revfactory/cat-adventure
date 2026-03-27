/**
 * Polygon — 볼록 다각형 충돌체
 * vertices: [x0,y0, x1,y1, ...] 또는 [{x,y}, ...] 형태
 */
import { Shape } from './Shape.js';
import { Vector2 } from '../Vector2.js';
import { AABB } from './AABB.js';

export class Polygon extends Shape {
  constructor(vertices) {
    super('polygon');
    this.localVertices = Polygon._parseVertices(vertices);
  }

  static _parseVertices(verts) {
    if (verts.length === 0) return [];
    if (typeof verts[0] === 'number') {
      const result = [];
      for (let i = 0; i < verts.length; i += 2) {
        result.push(new Vector2(verts[i], verts[i + 1]));
      }
      return result;
    }
    return verts.map(v => new Vector2(v.x, v.y));
  }

  static createBox(width, height) {
    const hw = width / 2;
    const hh = height / 2;
    return new Polygon([
      new Vector2(-hw, -hh),
      new Vector2(hw, -hh),
      new Vector2(hw, hh),
      new Vector2(-hw, hh),
    ]);
  }

  getWorldVertices() {
    if (!this.body) return this.localVertices.map(v => v.clone());
    const pos = this.body.position;
    const angle = this.body.angle;
    return this.localVertices.map(v => {
      const rotated = v.rotate(angle);
      return new Vector2(pos.x + rotated.x, pos.y + rotated.y);
    });
  }

  getNormals() {
    const verts = this.getWorldVertices();
    const normals = [];
    for (let i = 0; i < verts.length; i++) {
      const next = verts[(i + 1) % verts.length];
      const edge = next.sub(verts[i]);
      normals.push(edge.perpendicular().normalize());
    }
    return normals;
  }

  project(axis) {
    const verts = this.getWorldVertices();
    let min = Infinity;
    let max = -Infinity;
    for (const v of verts) {
      const proj = v.dot(axis);
      if (proj < min) min = proj;
      if (proj > max) max = proj;
    }
    return { min, max };
  }

  getAABB() {
    const verts = this.getWorldVertices();
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return new AABB(new Vector2(minX, minY), new Vector2(maxX, maxY));
  }

  computeArea() {
    const verts = this.localVertices;
    let area = 0;
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      area += verts[i].cross(verts[j]);
    }
    return Math.abs(area) / 2;
  }

  computeInertia(mass) {
    const verts = this.localVertices;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < verts.length; i++) {
      const v1 = verts[i];
      const v2 = verts[(i + 1) % verts.length];
      const cross = Math.abs(v1.cross(v2));
      numerator += cross * (v1.dot(v1) + v1.dot(v2) + v2.dot(v2));
      denominator += cross;
    }
    if (denominator < 1e-10) return 0;
    return (mass / 6) * (numerator / denominator);
  }
}
