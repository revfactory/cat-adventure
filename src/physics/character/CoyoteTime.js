/**
 * CoyoteTime — 코요테 타임 + 점프 버퍼
 * - 코요테 타임: 절벽 이탈 후 짧은 시간 동안 점프 허용
 * - 점프 버퍼: 착지 직전 점프 입력을 버퍼링
 */
export class CoyoteTime {
  constructor(options = {}) {
    this.coyoteDuration = options.coyoteDuration ?? 0.1;
    this.jumpBufferDuration = options.jumpBufferDuration ?? 0.15;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this._wasGrounded = false;
  }

  update(isGrounded, jumpPressed, dt) {
    // 코요테 타임: 지면에서 벗어난 순간부터 카운트다운
    if (isGrounded) {
      this.coyoteTimer = this.coyoteDuration;
    } else {
      if (this._wasGrounded) {
        // 방금 지면을 떠남 — 코요테 타임 시작
        this.coyoteTimer = this.coyoteDuration;
      }
      this.coyoteTimer -= dt;
    }

    // 점프 버퍼: 점프 버튼 누르면 버퍼 시작
    if (jumpPressed) {
      this.jumpBufferTimer = this.jumpBufferDuration;
    } else {
      this.jumpBufferTimer -= dt;
    }

    this._wasGrounded = isGrounded;
  }

  get canJump() {
    return this.coyoteTimer > 0;
  }

  get hasBufferedJump() {
    return this.jumpBufferTimer > 0;
  }

  consumeJump() {
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  consumeBuffer() {
    this.jumpBufferTimer = 0;
  }
}
