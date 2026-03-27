/**
 * Camera — 플레이어 추적, 뷰포트 관리
 * 800x600 뷰포트, 패럴랙스 스크롤 지원
 */
export class Camera {
  constructor(viewportWidth = 800, viewportHeight = 600) {
    this.vw = viewportWidth;
    this.vh = viewportHeight;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;

    // World bounds
    this.worldWidth = 6400;
    this.worldHeight = 600;

    // Smooth follow
    this.smoothing = 0.1;
    this.deadZoneX = 60;
    this.deadZoneY = 40;

    // Look-ahead
    this.lookAheadX = 80;
    this.lookAheadDir = 0;

    // Shake
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Parallax layer refs (set by renderer)
    this.parallaxLayers = [];
  }

  setWorldBounds(width, height) {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  follow(entity, dt) {
    const cx = entity.x + entity.width / 2;
    const cy = entity.y + entity.height / 2;

    // Look-ahead based on facing direction
    if (entity.facingRight !== undefined) {
      this.lookAheadDir = entity.facingRight ? 1 : -1;
    }

    this.targetX = cx - this.vw / 2 + this.lookAheadX * this.lookAheadDir;
    this.targetY = cy - this.vh / 2;

    // Dead zone
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.abs(dx) > this.deadZoneX) {
      this.x += (dx - Math.sign(dx) * this.deadZoneX) * this.smoothing;
    }
    if (Math.abs(dy) > this.deadZoneY) {
      this.y += (dy - Math.sign(dy) * this.deadZoneY) * this.smoothing;
    }

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(this.worldWidth - this.vw, this.x));
    this.y = Math.max(0, Math.min(this.worldHeight - this.vh, this.y));

    // Screen shake
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = this.shakeTimer / this.shakeDuration;
      const intensity = this.shakeIntensity * t;
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * intensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * intensity;
    }
  }

  shake(intensity = 5, duration = 0.3) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /** Final camera position with shake applied */
  get viewX() { return Math.round(this.x + this.shakeOffsetX); }
  get viewY() { return Math.round(this.y + this.shakeOffsetY); }

  /** Check if a rectangle is visible in the viewport (with margin) */
  isVisible(x, y, w, h, margin = 100) {
    return (
      x + w > this.x - margin &&
      x < this.x + this.vw + margin &&
      y + h > this.y - margin &&
      y < this.y + this.vh + margin
    );
  }
}
