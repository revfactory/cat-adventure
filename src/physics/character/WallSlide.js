/**
 * WallSlide — 벽 미끄러지기 + 벽 점프
 * - 벽 접촉 시 낙하 속도 제한 (50px/s)
 * - 벽 점프: 벽 반대 방향 + 위로 (250, -300)
 */
import { Vector2 } from '../Vector2.js';

export class WallSlide {
  constructor(options = {}) {
    this.wallSlideSpeed = options.wallSlideSpeed ?? 50;
    this.wallJumpHorizontal = options.wallJumpHorizontal ?? 250;
    this.wallJumpVertical = options.wallJumpVertical ?? -300;
    this.wallCheckDistance = options.wallCheckDistance ?? 3;

    this.isOnWall = false;
    this.wallDirection = 0; // -1: 왼쪽 벽, 1: 오른쪽 벽
    this.wallBody = null;

    this._wallStickTimer = 0;
    this._wallStickDuration = 0.1; // 벽에서 떨어지기 위한 최소 시간
  }

  update(body, world, inputDir, dt) {
    this.isOnWall = false;
    this.wallDirection = 0;
    this.wallBody = null;

    // 공중에 있을 때만 벽 슬라이드
    const bodyAABB = body.getAABB();

    // 좌우 레이캐스트
    const checkDirs = [
      { dir: -1, x: bodyAABB.min.x },
      { dir: 1, x: bodyAABB.max.x },
    ];

    for (const check of checkDirs) {
      const hit = this._wallRaycast(
        new Vector2(check.x, body.position.y),
        new Vector2(check.dir, 0),
        this.wallCheckDistance,
        body,
        world
      );

      if (hit) {
        this.isOnWall = true;
        this.wallDirection = check.dir;
        this.wallBody = hit.body;
        break;
      }
    }

    // 벽 미끄러짐 속도 제한
    if (this.isOnWall && body.velocity.y > this.wallSlideSpeed) {
      body.velocity.y = this.wallSlideSpeed;
    }
  }

  performWallJump(body) {
    if (!this.isOnWall) return false;

    // 벽 반대 방향으로 점프
    body.velocity.x = -this.wallDirection * this.wallJumpHorizontal;
    body.velocity.y = this.wallJumpVertical;

    this.isOnWall = false;
    this.wallDirection = 0;
    return true;
  }

  _wallRaycast(origin, direction, maxDist, selfBody, world) {
    let closestHit = null;
    let closestDist = maxDist;

    for (const body of world.bodies) {
      if (body === selfBody) continue;
      if (body.isSensor) continue;
      if (!body.isStatic && !body.isKinematic) continue; // 벽은 정적/키네마틱만

      const aabb = body.getAABB();

      if (direction.x > 0) {
        // 오른쪽 벽
        const dist = aabb.min.x - origin.x;
        if (dist >= 0 && dist < closestDist) {
          if (origin.y >= aabb.min.y && origin.y <= aabb.max.y) {
            closestDist = dist;
            closestHit = { body, distance: dist, normal: new Vector2(-1, 0) };
          }
        }
      } else {
        // 왼쪽 벽
        const dist = origin.x - aabb.max.x;
        if (dist >= 0 && dist < closestDist) {
          if (origin.y >= aabb.min.y && origin.y <= aabb.max.y) {
            closestDist = dist;
            closestHit = { body, distance: dist, normal: new Vector2(1, 0) };
          }
        }
      }
    }

    return closestHit;
  }
}
