/**
 * GroundCheck — 지면 감지 (레이캐스트)
 * 캐릭터 하단에서 아래로 레이를 쏴서 지면 접촉 여부 판정
 */
import { Vector2 } from '../Vector2.js';

export class GroundCheck {
  constructor(options = {}) {
    this.rayLength = options.rayLength ?? 2;
    this.rayOffsets = options.rayOffsets ?? [
      new Vector2(-6, 0),
      new Vector2(0, 0),
      new Vector2(6, 0),
    ];
    this.isGrounded = false;
    this.groundNormal = new Vector2(0, -1);
    this.groundBody = null;
    this.slopeAngle = 0;
  }

  update(body, world) {
    this.isGrounded = false;
    this.groundBody = null;
    this.groundNormal = new Vector2(0, -1);
    this.slopeAngle = 0;

    const bodyAABB = body.getAABB();
    const feetY = bodyAABB.max.y;

    for (const offset of this.rayOffsets) {
      const rayOrigin = new Vector2(body.position.x + offset.x, feetY);
      const rayDir = new Vector2(0, 1);

      const hit = this._raycast(rayOrigin, rayDir, this.rayLength, body, world);
      if (hit) {
        this.isGrounded = true;
        this.groundNormal = hit.normal;
        this.groundBody = hit.body;
        this.slopeAngle = Math.acos(Math.abs(hit.normal.dot(new Vector2(0, -1))));
        return;
      }
    }
  }

  _raycast(origin, direction, maxDist, selfBody, world) {
    let closestHit = null;
    let closestDist = maxDist;

    for (const body of world.bodies) {
      if (body === selfBody) continue;
      if (body.isSensor) continue;

      const aabb = body.getAABB();

      // 빠른 AABB 체크
      if (origin.y + maxDist < aabb.min.y) continue;
      if (origin.x < aabb.min.x || origin.x > aabb.max.x) continue;

      // AABB 상단과의 거리
      const hitY = aabb.min.y;
      const dist = hitY - origin.y;

      if (dist >= 0 && dist < closestDist) {
        closestDist = dist;
        closestHit = {
          body: body,
          point: new Vector2(origin.x, hitY),
          normal: new Vector2(0, -1),
          distance: dist,
        };
      }
    }

    return closestHit;
  }
}
