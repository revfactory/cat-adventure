/**
 * PhysicsDebugRenderer — 충돌체/힘 벡터/접촉점 시각화
 * Canvas 기반 오버레이. ?debug=physics 쿼리로 활성화
 */
export class PhysicsDebugRenderer {
  constructor(options = {}) {
    this.enabled = options.enabled ?? false;
    this.canvas = null;
    this.ctx = null;
    this.camera = options.camera || { x: 0, y: 0, zoom: 1 };

    this.showColliders = options.showColliders ?? true;
    this.showVelocity = options.showVelocity ?? true;
    this.showForces = options.showForces ?? false;
    this.showContacts = options.showContacts ?? true;
    this.showConstraints = options.showConstraints ?? true;
    this.showAABB = options.showAABB ?? false;
    this.showGrid = options.showGrid ?? false;

    this._manifolds = [];
    this._constraints = [];

    // URL 파라미터 체크
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'physics') {
        this.enabled = true;
      }
    }
  }

  init(container) {
    if (!this.enabled) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    this.canvas.width = container.clientWidth || 800;
    this.canvas.height = container.clientHeight || 600;

    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  setManifolds(manifolds) {
    this._manifolds = manifolds;
  }

  setConstraints(constraints) {
    this._constraints = constraints;
  }

  render(world, alpha) {
    if (!this.enabled || !this.ctx) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Spatial Hash Grid
    if (this.showGrid) {
      this._drawGrid(ctx, world);
    }

    // AABB
    if (this.showAABB) {
      for (const body of world.bodies) {
        this._drawAABB(ctx, body);
      }
    }

    // 충돌체
    if (this.showColliders) {
      for (const body of world.bodies) {
        this._drawCollider(ctx, body, alpha);
      }
    }

    // 속도 벡터
    if (this.showVelocity) {
      for (const body of world.bodies) {
        if (body.isStatic || body.isSleeping) continue;
        this._drawVelocity(ctx, body);
      }
    }

    // 접촉점
    if (this.showContacts) {
      for (const m of this._manifolds) {
        this._drawContact(ctx, m);
      }
    }

    // 제약
    if (this.showConstraints) {
      for (const c of this._constraints) {
        this._drawConstraint(ctx, c);
      }
    }

    ctx.restore();
  }

  _drawCollider(ctx, body, alpha) {
    const shape = body.shape;
    if (!shape) return;

    const pos = body.getInterpolatedPosition(alpha || 1);
    const angle = body.getInterpolatedAngle(alpha || 1);

    // 색상: 초록(정상), 빨강(충돌 중), 파랑(sleep)
    let color = '#00ff00';
    if (body.isSleeping) color = '#4488ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    if (shape.type === 'polygon') {
      const verts = shape.getWorldVertices();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (shape.type === 'circle') {
      const center = shape.getCenter();
      ctx.beginPath();
      ctx.arc(center.x, center.y, shape.radius, 0, Math.PI * 2);
      ctx.stroke();
      // 회전 표시선
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + Math.cos(angle) * shape.radius,
        center.y + Math.sin(angle) * shape.radius
      );
      ctx.stroke();
    } else if (shape.type === 'capsule') {
      const top = shape.getTopCenter();
      const bot = shape.getBottomCenter();
      const r = shape.radius;
      ctx.beginPath();
      ctx.arc(top.x, top.y, r, Math.PI, 0);
      ctx.lineTo(bot.x + r, bot.y);
      ctx.arc(bot.x, bot.y, r, 0, Math.PI);
      ctx.closePath();
      ctx.stroke();
    }
  }

  _drawVelocity(ctx, body) {
    const pos = body.position;
    const vel = body.velocity;
    const scale = 0.1;

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + vel.x * scale, pos.y + vel.y * scale);
    ctx.stroke();

    // 화살표 머리
    const endX = pos.x + vel.x * scale;
    const endY = pos.y + vel.y * scale;
    const angle = Math.atan2(vel.y, vel.x);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - 5 * Math.cos(angle - 0.4),
      endY - 5 * Math.sin(angle - 0.4)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - 5 * Math.cos(angle + 0.4),
      endY - 5 * Math.sin(angle + 0.4)
    );
    ctx.stroke();
  }

  _drawContact(ctx, manifold) {
    ctx.fillStyle = '#ffffff';
    for (const cp of manifold.contactPoints) {
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 법선 벡터
    if (manifold.contactPoints.length > 0) {
      const center = manifold.getContactCenter();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + manifold.normal.x * 20,
        center.y + manifold.normal.y * 20
      );
      ctx.stroke();
    }
  }

  _drawConstraint(ctx, constraint) {
    if (constraint.isBroken) return;

    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const anchorA = constraint._getWorldAnchorA
      ? constraint._getWorldAnchorA()
      : constraint.bodyA.position;
    const anchorB = constraint._getWorldAnchorB
      ? constraint._getWorldAnchorB()
      : constraint.bodyB.position;

    ctx.beginPath();
    ctx.moveTo(anchorA.x, anchorA.y);
    ctx.lineTo(anchorB.x, anchorB.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 앵커 포인트
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(anchorA.x, anchorA.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(anchorB.x, anchorB.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawAABB(ctx, body) {
    const aabb = body.getAABB();
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      aabb.min.x, aabb.min.y,
      aabb.max.x - aabb.min.x,
      aabb.max.y - aabb.min.y
    );
  }

  _drawGrid(ctx, world) {
    const cellSize = world.broadPhase ? world.broadPhase.cellSize : 128;
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
    ctx.lineWidth = 0.5;

    const startX = Math.floor(this.camera.x / cellSize) * cellSize;
    const startY = Math.floor(this.camera.y / cellSize) * cellSize;
    const endX = startX + this.canvas.width / this.camera.zoom + cellSize;
    const endY = startY + this.canvas.height / this.camera.zoom + cellSize;

    for (let x = startX; x <= endX; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
