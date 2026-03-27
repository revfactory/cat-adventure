/**
 * OneWayPlatform — 단방향 플랫폼 (위에서만 착지)
 * 충돌 법선 Y + 캐릭터 속도 방향으로 판단
 */
export class OneWayPlatform {
  constructor(body) {
    this.body = body;
    this.body.userData = this.body.userData || {};
    this.body.userData.oneWay = true;
    this.enabled = true;
    this.dropThrough = false; // 아래로 내려가기 (하강 점프)
    this._dropTimer = 0;
    this._dropDuration = 0.25;
  }

  update(dt) {
    if (this._dropTimer > 0) {
      this._dropTimer -= dt;
      if (this._dropTimer <= 0) {
        this.dropThrough = false;
      }
    }
  }

  startDropThrough() {
    this.dropThrough = true;
    this._dropTimer = this._dropDuration;
  }

  /**
   * 충돌 필터: 이 매니폴드를 무시해야 하는지 판단
   * @returns {boolean} true이면 충돌 무시
   */
  shouldIgnoreCollision(manifold, otherBody) {
    if (!this.enabled) return false;
    if (this.dropThrough) return true;

    // 아래에서 위로 올라오는 경우 충돌 무시
    // 충돌 법선이 위를 가리키고 (normal.y < 0), 상대 바디가 아래서 올라오는 경우
    const isFromBelow = otherBody.velocity.y < 0;
    const bodyAbovePlatform = otherBody.position.y < this.body.position.y;

    // 바디가 플랫폼 아래에 있거나 위로 올라오는 중이면 무시
    if (!bodyAbovePlatform) return true;
    if (otherBody.velocity.y < -10 && !bodyAbovePlatform) return true;

    return false;
  }
}
