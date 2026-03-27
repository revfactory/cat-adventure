/**
 * Shape — 충돌 형상 베이스 클래스
 */
export class Shape {
  constructor(type) {
    this.type = type;
    this.body = null;
  }

  getWorldVertices() {
    return [];
  }

  getNormals() {
    return [];
  }

  project(axis) {
    return { min: 0, max: 0 };
  }

  getAABB() {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  computeArea() {
    return 0;
  }

  computeInertia(mass) {
    return 0;
  }
}
