/**
 * MovingPlatform — 움직이는 플랫폼 (경로 기반, carry velocity)
 * 웨이포인트 경로를 따라 이동하며, 위에 올라탄 캐릭터에게 속도 전달
 */
import { Vector2 } from '../Vector2.js';

export class MovingPlatform {
  constructor(body, options = {}) {
    this.body = body;
    this.body.type = 'kinematic';

    // 경로 (웨이포인트 목록)
    this.waypoints = (options.path || []).map(
      p => new Vector2(p.x, p.y)
    );

    this.speed = options.speed || 60; // px/s
    this.pauseDuration = options.pauseDuration || 0.5; // 웨이포인트에서 대기 시간
    this.loop = options.loop ?? true;
    this.pingPong = options.pingPong ?? true;

    this._currentWaypoint = 0;
    this._direction = 1; // 1: 정방향, -1: 역방향
    this._pauseTimer = 0;
    this._riding = []; // 플랫폼 위에 탄 바디 목록
  }

  update(dt) {
    if (this.waypoints.length < 2) return;
    if (this._pauseTimer > 0) {
      this._pauseTimer -= dt;
      this.body.velocity.set(0, 0);
      return;
    }

    const target = this.waypoints[this._getNextWaypoint()];
    const diff = target.sub(this.body.position);
    const dist = diff.length();

    if (dist < this.speed * dt) {
      // 웨이포인트 도착
      this.body.position.copyFrom(target);
      this.body.velocity.set(0, 0);
      this._advanceWaypoint();
      this._pauseTimer = this.pauseDuration;
    } else {
      // 이동
      const dir = diff.scale(1 / dist);
      this.body.velocity = dir.scale(this.speed);
      this.body.position = this.body.position.add(this.body.velocity.scale(dt));
    }
  }

  _getNextWaypoint() {
    if (this._direction === 1) {
      return Math.min(this._currentWaypoint + 1, this.waypoints.length - 1);
    }
    return Math.max(this._currentWaypoint - 1, 0);
  }

  _advanceWaypoint() {
    this._currentWaypoint += this._direction;

    if (this._currentWaypoint >= this.waypoints.length - 1) {
      if (this.pingPong) {
        this._direction = -1;
        this._currentWaypoint = this.waypoints.length - 1;
      } else if (this.loop) {
        this._currentWaypoint = 0;
      } else {
        this._currentWaypoint = this.waypoints.length - 1;
      }
    } else if (this._currentWaypoint <= 0) {
      if (this.pingPong) {
        this._direction = 1;
        this._currentWaypoint = 0;
      }
    }
  }

  // 플랫폼 위에 탄 바디에게 carry velocity 전달
  applyCarryVelocity(riders) {
    for (const rider of riders) {
      if (rider.isStatic) continue;
      rider.position = rider.position.add(this.body.velocity.scale(1 / 60));
    }
  }
}
