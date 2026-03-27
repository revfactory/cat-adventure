/**
 * Entity — 베이스 엔티티
 * 위치, 크기, 물리 컴포넌트 슬롯
 */
let _entityId = 0;

export class Entity {
  constructor(x = 0, y = 0, width = 32, height = 32) {
    this.id = _entityId++;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.prevX = x;
    this.prevY = y;

    // Velocity (fallback physics)
    this.vx = 0;
    this.vy = 0;

    // Physics integration slot
    this.rigidBody = null;

    // Visual
    this.svgElement = null;
    this.color = '#888';
    this.label = '';
    this.type = 'entity';
    this.facingRight = true;
    this.scaleX = 1;
    this.scaleY = 1;

    // State
    this.active = true;
    this.destroyed = false;
  }

  update(dt, scene) {
    this.prevX = this.x;
    this.prevY = this.y;

    // If physics body is attached, sync position from physics
    if (this.rigidBody) {
      this.x = this.rigidBody.position.x - this.width / 2;
      this.y = this.rigidBody.position.y - this.height / 2;
      this.vx = this.rigidBody.velocity.x;
      this.vy = this.rigidBody.velocity.y;
    }
  }

  /** AABB collision bounds */
  getBounds() {
    return {
      left: this.x,
      right: this.x + this.width,
      top: this.y,
      bottom: this.y + this.height,
    };
  }

  destroy() {
    this.destroyed = true;
    this.active = false;
  }
}
