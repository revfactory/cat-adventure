/**
 * CharacterController — 고양이 전용 물리 컨트롤러
 * 코요테 타임, 점프 버퍼, 가변 점프, 벽 슬라이드/점프, 착지 스쿼시
 */
import { Vector2 } from '../Vector2.js';
import { GroundCheck } from './GroundCheck.js';
import { CoyoteTime } from './CoyoteTime.js';
import { WallSlide } from './WallSlide.js';

const DEFAULT_CONFIG = {
  mass: 4,
  moveForce: 2000,
  maxSpeed: 300,
  jumpImpulse: 550,
  airControl: 0.7,
  coyoteTime: 0.1,
  jumpBuffer: 0.15,
  wallSlideSpeed: 50,
  wallJumpHorizontal: 250,
  wallJumpVertical: -300,
  terminalVelocity: 600,
  landingSquashThreshold: 400,
  groundDeceleration: 2000,
  airDeceleration: 500,
};

export class CharacterController {
  constructor(body, world, config = {}) {
    this.body = body;
    this.world = world;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.groundCheck = new GroundCheck();
    this.coyoteTime = new CoyoteTime({
      coyoteDuration: this.config.coyoteTime,
      jumpBufferDuration: this.config.jumpBuffer,
    });
    this.wallSlide = new WallSlide({
      wallSlideSpeed: this.config.wallSlideSpeed,
      wallJumpHorizontal: this.config.wallJumpHorizontal,
      wallJumpVertical: this.config.wallJumpVertical,
    });

    this.jumpHeld = false;
    this.facingDirection = 1; // 1: 오른쪽, -1: 왼쪽

    // 착지 스쿼시 상태
    this.squashFactor = 1;
    this._squashTimer = 0;
    this._squashDuration = 0.15;
    this._preLandVelocityY = 0;

    // 상태
    this.state = 'idle'; // idle, running, jumping, falling, wall_sliding, wall_jumping, landing, hurt
    this._hurtTimer = 0;
    this._invincibleTimer = 0;

    // 캐리 속도 (움직이는 플랫폼)
    this._carryVelocityApplied = false;
    this._carriedVx = 0;

    // 벽 점프 후 이동 입력 잠금 (벽 점프 수평 속도가 즉시 덮어써지는 것 방지)
    this._wallJumpLockTimer = 0;
    this._wallJumpLockDuration = 0.15;

    // 이벤트 콜백
    this.onLand = null;
    this.onJump = null;
    this.onWallJump = null;
    this.onHurt = null;
  }

  get isOnGround() {
    return this.groundCheck.isGrounded;
  }

  get isOnWall() {
    return this.wallSlide.isOnWall;
  }

  get isInvincible() {
    return this._invincibleTimer > 0;
  }

  update(input, dt) {
    // 지면/벽 감지
    this.groundCheck.update(this.body, this.world);
    this.wallSlide.update(this.body, this.world, input.horizontal || 0, dt);

    // 타이머 갱신
    this.coyoteTime.update(this.isOnGround, input.jumpPressed, dt);
    this._updateTimers(dt);

    // 피격 상태면 제어 불가
    if (this.state === 'hurt') {
      this._hurtTimer -= dt;
      if (this._hurtTimer <= 0) {
        this.state = 'idle';
      }
      this._clampVelocity();
      return;
    }

    // 이동
    this._handleMovement(input, dt);

    // 점프
    this._handleJump(input);

    // 벽 슬라이드
    this._handleWallSlide(input);

    // 착지 감지 & 스쿼시
    this._handleLanding(dt);

    // 속도 클램핑
    this._clampVelocity();

    // 상태 갱신
    this._updateState(input);
  }

  _handleMovement(input, dt) {
    // 벽 점프 잠금 중이면 이동 입력 무시 (수평 속도 보존)
    if (this._wallJumpLockTimer > 0) {
      this._wallJumpLockTimer -= dt;
      return;
    }

    const horizontal = input.horizontal || 0; // -1, 0, 1

    if (horizontal !== 0) {
      this.facingDirection = horizontal > 0 ? 1 : -1;
    }

    const isGrounded = this.isOnGround;
    const controlFactor = isGrounded ? 1 : this.config.airControl;

    // 직접 속도 설정 방식 (collision solver 마찰과 충돌하지 않음)
    if (horizontal !== 0) {
      const targetVx = horizontal * this.config.maxSpeed * controlFactor;
      const accel = this.config.moveForce / this.config.mass; // 가속도 (px/s^2)
      const currentVx = this.body.velocity.x;

      // 목표 속도를 향해 가속
      if (Math.abs(targetVx - currentVx) < accel * dt) {
        this.body.velocity.x = targetVx;
      } else {
        this.body.velocity.x += Math.sign(targetVx - currentVx) * accel * dt;
      }
    } else {
      // 감속 (입력 없을 때)
      const decel = isGrounded ? this.config.groundDeceleration : this.config.airDeceleration;
      const vx = this.body.velocity.x;
      if (Math.abs(vx) > 1) {
        const reduction = decel * dt;
        if (Math.abs(vx) <= reduction) {
          this.body.velocity.x = 0;
        } else {
          this.body.velocity.x -= Math.sign(vx) * reduction;
        }
      } else {
        this.body.velocity.x = 0;
      }
    }
  }

  _handleJump(input) {
    const canJump = this.isOnGround || this.coyoteTime.canJump;
    const wantsJump = this.coyoteTime.hasBufferedJump;

    // 일반 점프
    if (canJump && wantsJump) {
      this.body.velocity.y = -this.config.jumpImpulse;
      this.coyoteTime.consumeJump();
      this.jumpHeld = true;
      if (this.onJump) this.onJump();
      return;
    }

    // 벽 점프
    if (!canJump && this.wallSlide.isOnWall && wantsJump) {
      this.wallSlide.performWallJump(this.body);
      this.coyoteTime.consumeBuffer();
      this.jumpHeld = true;
      this._wallJumpLockTimer = this._wallJumpLockDuration;
      if (this.onWallJump) this.onWallJump(this.wallSlide.wallDirection);
      return;
    }

    // 가변 점프 높이: 버튼 떼면 상승속도 ×0.5
    if (!input.jumpHeld && this.jumpHeld && this.body.velocity.y < 0) {
      this.body.velocity.y *= 0.5;
      this.jumpHeld = false;
    }
  }

  _handleWallSlide(input) {
    // 벽에서 미끄러질 때 낙하 속도 제한은 WallSlide.update에서 처리
  }

  _handleLanding(dt) {
    if (this.isOnGround && this._preLandVelocityY > this.config.landingSquashThreshold) {
      // 착지 스쿼시 발동
      const intensity = Math.min(this._preLandVelocityY / this.config.terminalVelocity, 1);
      this.squashFactor = 1 - 0.3 * intensity; // 최소 0.7
      this._squashTimer = this._squashDuration;
      if (this.onLand) this.onLand(intensity);
    }

    // 스쿼시 복원
    if (this._squashTimer > 0) {
      this._squashTimer -= dt;
      const t = Math.max(0, this._squashTimer / this._squashDuration);
      this.squashFactor = 1 - (1 - this.squashFactor) * t;
      if (this._squashTimer <= 0) {
        this.squashFactor = 1;
      }
    }

    // 착지 전 속도 기록
    if (!this.isOnGround) {
      this._preLandVelocityY = Math.max(0, this.body.velocity.y);
    } else {
      this._preLandVelocityY = 0;
    }
  }

  _clampVelocity() {
    // 최대 이동 속도
    if (Math.abs(this.body.velocity.x) > this.config.maxSpeed) {
      this.body.velocity.x = Math.sign(this.body.velocity.x) * this.config.maxSpeed;
    }

    // 최대 낙하 속도
    if (this.body.velocity.y > this.config.terminalVelocity) {
      this.body.velocity.y = this.config.terminalVelocity;
    }
  }

  _updateTimers(dt) {
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= dt;
    }
  }

  _updateState(input) {
    if (this.state === 'hurt') return;

    if (this.isOnGround) {
      if (this._squashTimer > 0) {
        this.state = 'landing';
      } else if (Math.abs(this.body.velocity.x) > 10) {
        this.state = 'running';
      } else {
        this.state = 'idle';
      }
    } else if (this.wallSlide.isOnWall && this.body.velocity.y > 0) {
      this.state = 'wall_sliding';
    } else if (this.body.velocity.y < 0) {
      this.state = 'jumping';
    } else {
      this.state = 'falling';
    }
  }

  hurt(knockbackDir, knockbackForce = 300, invincibleTime = 1.5) {
    if (this.isInvincible) return false;

    this.state = 'hurt';
    this._hurtTimer = 0.3;
    this._invincibleTimer = invincibleTime;

    // 넉백 임펄스
    const impulse = knockbackDir.normalize().scale(knockbackForce);
    this.body.applyImpulse(impulse);

    if (this.onHurt) this.onHurt();
    return true;
  }

  getTransform() {
    return {
      x: this.body.position.x,
      y: this.body.position.y,
      scaleX: this.facingDirection,
      scaleY: this.squashFactor,
      scaleXStretch: 1 + (1 - this.squashFactor) * 0.5, // 납작해지면 넓어짐
    };
  }

  // 움직이는 플랫폼 위에 서있을 때 플랫폼 속도 전달
  applyCarryVelocity(dt) {
    if (this.isOnGround && this.groundCheck.groundBody) {
      const ground = this.groundCheck.groundBody;
      if (ground.isKinematic || ground.isDynamic) {
        this.body.velocity.x += ground.velocity.x;
        this._carryVelocityApplied = true;
        this._carriedVx = ground.velocity.x;
      }
    }
  }

  removeCarryVelocity() {
    if (this._carryVelocityApplied) {
      this.body.velocity.x -= this._carriedVx;
      this._carryVelocityApplied = false;
      this._carriedVx = 0;
    }
  }
}
