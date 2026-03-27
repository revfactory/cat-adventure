/**
 * Player — 주인공 나비 (상태 머신 11종, 입력 처리)
 * 폴백 물리 포함 (physics-engineer 통합 전)
 */
import { Entity } from './Entity.js';

const STATES = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  FALLING: 'FALLING',
  WALL_SLIDING: 'WALL_SLIDING',
  WALL_JUMPING: 'WALL_JUMPING',
  LANDING_SQUASH: 'LANDING_SQUASH',
  HURT: 'HURT',
  DEAD: 'DEAD',
  HAPPY: 'HAPPY',
  COYOTE: 'COYOTE',
};

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 56, 64);
    this.type = 'player';
    this.color = '#FF8C42';
    this.label = '나비';

    // Stats
    this.maxHealth = 5;
    this.health = 5;
    this.speed = 200;
    this.airSpeed = 160;
    this.jumpImpulse = -520;
    this.wallJumpImpulseX = 300;
    this.wallJumpImpulseY = -450;
    this.wallSlideSpeed = 60;
    this.gravity = 1400;
    this.maxFallSpeed = 600;

    // State machine
    this.state = STATES.IDLE;
    this.prevState = STATES.IDLE;
    this.stateTimer = 0;

    // Coyote time & jump buffer
    this.coyoteTime = 0.1;
    this.coyoteTimer = 0;
    this.jumpBufferTime = 0.15;
    this.jumpBufferTimer = 0;

    // Invincibility
    this.invincible = false;
    this.invincibleTimer = 0;
    this.invincibleDuration = 1.5;

    // Hurt
    this.hurtTimer = 0;
    this.hurtDuration = 0.3;

    // Landing squash
    this.squashTimer = 0;
    this.squashDuration = 0.15;

    // Happy
    this.happyTimer = 0;

    // Ground/Wall detection (fallback)
    this.onGround = false;
    this.onWallLeft = false;
    this.onWallRight = false;
    this.wallDirection = 0; // -1 left, 1 right

    // Input reference (set by main)
    this.input = null;
  }

  update(dt, scene) {
    this.stateTimer += dt;

    // When CharacterController is attached (physics-driven mode),
    // position/velocity/state/ground flags are all managed by
    // _syncPhysicsToEntities() in main.js. Only update timers here.
    if (this.characterController) {
      this._updateTimers(dt);
      return;
    }

    this.prevX = this.x;
    this.prevY = this.y;

    // Update timers (invincibility, hurt, squash, happy)
    this._updateTimers(dt);

    // State machine (fallback mode only)
    this._updateState(dt, scene);

    // Fallback physics (no rigidBody)
    if (!this.rigidBody) {
      this._fallbackPhysics(dt, scene);
    }

    // Death check: fell off the world
    if (this.y > scene.levelData?.height + 100) {
      this.health = 0;
      this._changeState(STATES.DEAD);
    }
  }

  _updateTimers(dt) {
    if (this.characterController) {
      // CharacterController 모드에서는 invincible/happy 타이머만 업데이트
      if (this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
        if (this.invincibleTimer <= 0) this.invincible = false;
      }
      if (this.happyTimer > 0) {
        this.happyTimer -= dt;
        if (this.happyTimer <= 0) this._changeState(STATES.IDLE);
      }
      return;
    }

    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
      }
    }
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.squashTimer > 0) {
      this.squashTimer -= dt;
      const t = this.squashTimer / this.squashDuration;
      this.scaleX = 1 + 0.3 * t;
      this.scaleY = 1 - 0.3 * t;
      if (this.squashTimer <= 0) {
        this.scaleX = 1;
        this.scaleY = 1;
      }
    }
    if (this.happyTimer > 0) {
      this.happyTimer -= dt;
      if (this.happyTimer <= 0) {
        this._changeState(STATES.IDLE);
      }
    }
  }

  _updateState(dt, scene) {
    const input = this.input;
    if (!input) return;

    // Jump buffer
    if (input.jumpPressed) {
      this.jumpBufferTimer = this.jumpBufferTime;
    }

    switch (this.state) {
      case STATES.IDLE:
      case STATES.COYOTE:
        if (input.left || input.right) {
          this._changeState(STATES.RUNNING);
        }
        if (this._tryJump()) break;
        if (!this.onGround && this.coyoteTimer <= 0) {
          this._changeState(STATES.FALLING);
        }
        break;

      case STATES.RUNNING:
        if (!input.left && !input.right) {
          this._changeState(STATES.IDLE);
        }
        if (this._tryJump()) break;
        if (!this.onGround) {
          this.coyoteTimer = this.coyoteTime;
          this._changeState(STATES.COYOTE);
        }
        break;

      case STATES.JUMPING:
        // Variable jump height
        if (!input.jump && this.vy < 0) {
          this.vy *= 0.5;
        }
        if (this.vy >= 0) {
          this._changeState(STATES.FALLING);
        }
        if ((this.onWallLeft || this.onWallRight) && this.vy > 0) {
          this._changeState(STATES.WALL_SLIDING);
        }
        break;

      case STATES.FALLING:
        if (this.onGround) {
          if (Math.abs(this.vy) > 200) {
            this._changeState(STATES.LANDING_SQUASH);
          } else if (input.left || input.right) {
            this._changeState(STATES.RUNNING);
          } else {
            this._changeState(STATES.IDLE);
          }
        }
        // Jump buffer
        if (this.onGround && this.jumpBufferTimer > 0) {
          this._jump();
          break;
        }
        if ((this.onWallLeft || this.onWallRight)) {
          this._changeState(STATES.WALL_SLIDING);
        }
        break;

      case STATES.WALL_SLIDING:
        this.wallDirection = this.onWallLeft ? -1 : 1;
        if (this.onGround) {
          this._changeState(STATES.IDLE);
        }
        if (input.jumpPressed) {
          this._wallJump();
        }
        if (!this.onWallLeft && !this.onWallRight) {
          this._changeState(STATES.FALLING);
        }
        break;

      case STATES.WALL_JUMPING:
        if (this.vy >= 0) {
          this._changeState(STATES.FALLING);
        }
        break;

      case STATES.LANDING_SQUASH:
        this.squashTimer = this.squashDuration;
        if (this.stateTimer > this.squashDuration) {
          if (input.left || input.right) {
            this._changeState(STATES.RUNNING);
          } else {
            this._changeState(STATES.IDLE);
          }
        }
        break;

      case STATES.HURT:
        if (this.hurtTimer <= 0) {
          if (this.health <= 0) {
            this._changeState(STATES.DEAD);
          } else {
            this._changeState(STATES.IDLE);
          }
        }
        break;

      case STATES.DEAD:
        // Handled externally (respawn)
        break;

      case STATES.HAPPY:
        // Wait for timer
        break;
    }
  }

  _tryJump() {
    if ((this.onGround || this.coyoteTimer > 0) &&
        (this.jumpBufferTimer > 0 || (this.input && this.input.jumpPressed))) {
      this._jump();
      return true;
    }
    return false;
  }

  _jump() {
    this.vy = this.jumpImpulse;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this._changeState(STATES.JUMPING);
    if (this.rigidBody) {
      this.rigidBody.velocity.y = this.jumpImpulse;
    }
    if (this.audio) this.audio.playJump();
  }

  _wallJump() {
    this.vx = -this.wallDirection * this.wallJumpImpulseX;
    this.vy = this.wallJumpImpulseY;
    this.facingRight = this.wallDirection < 0;
    this._changeState(STATES.WALL_JUMPING);
    if (this.rigidBody) {
      this.rigidBody.velocity.x = this.vx;
      this.rigidBody.velocity.y = this.vy;
    }
    if (this.audio) this.audio.playJump();
  }

  _changeState(newState) {
    if (this.state === newState) return;
    const prevState = this.state;
    this.prevState = prevState;
    this.state = newState;
    this.stateTimer = 0;

    // Sound effects (fallback mode — no CharacterController callbacks)
    if (this.audio && !this.characterController) {
      if (newState === STATES.LANDING_SQUASH ||
          (newState === STATES.IDLE && (prevState === STATES.FALLING || prevState === STATES.JUMPING))) {
        this.audio.playLand();
      }
      if (newState === STATES.HURT) this.audio.playHurt();
      if (newState === STATES.DEAD) this.audio.playDeath();
      if (newState === STATES.HAPPY) this.audio.playRescue();
    }

    // Update SVG animation class on inner group
    const target = this._svgInner || this.svgElement;
    if (target) {
      target.className.baseVal = `entity-player anim-${newState.toLowerCase().replace('_', '-')}`;
    }
  }

  hurt(source, scene) {
    if (this.invincible || this.state === STATES.DEAD || this.state === STATES.HURT) return;

    const damage = source.damage || 1;
    this.health -= damage;

    // Knockback direction
    const dir = this.x < source.x ? -1 : 1;

    // Use CharacterController.hurt() if available (physics-driven knockback)
    if (this.characterController) {
      const knockbackDir = { x: dir, y: -0.5, normalize() { const l = Math.hypot(this.x, this.y); return { x: this.x / l, y: this.y / l, scale(s) { return { x: this.x * s, y: this.y * s }; } }; }, scale(s) { return { x: this.x * s, y: this.y * s }; } };
      this.characterController.hurt(knockbackDir, source.knockbackImpulse || 300, this.invincibleDuration);
    } else {
      // Fallback knockback
      this.invincible = true;
      this.invincibleTimer = this.invincibleDuration;
      this.hurtTimer = this.hurtDuration;
      this.vx = dir * 300;
      this.vy = -150;
      if (this.rigidBody) {
        this.rigidBody.velocity.x = this.vx;
        this.rigidBody.velocity.y = this.vy;
      }
    }

    this._changeState(STATES.HURT);
    scene.camera?.shake(6, 0.2);
  }

  triggerHappy(duration = 1.5) {
    this._changeState(STATES.HAPPY);
    this.happyTimer = duration;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.invincible = true;
    this.invincibleTimer = 2;
    this._changeState(STATES.IDLE);
    if (this.rigidBody) {
      this.rigidBody.position.x = x + this.width / 2;
      this.rigidBody.position.y = y + this.height / 2;
      this.rigidBody.velocity.x = 0;
      this.rigidBody.velocity.y = 0;
    }
  }

  /**
   * Fallback physics (no rigidBody attached).
   * Simple AABB vs platform collision.
   */
  _fallbackPhysics(dt, scene) {
    // dt 클램핑: 탭 전환 등으로 큰 dt가 들어오면 순간이동 방지
    dt = Math.min(dt, 1 / 30);

    const input = this.input;
    const canMove = this.state !== STATES.HURT && this.state !== STATES.DEAD && this.state !== STATES.HAPPY;

    // Horizontal movement
    if (canMove && input) {
      const spd = this.onGround ? this.speed : this.airSpeed;
      if (input.left) {
        this.vx = -spd;
        this.facingRight = false;
      } else if (input.right) {
        this.vx = spd;
        this.facingRight = true;
      } else {
        // Friction — 지면에서 빠르게 멈춤, 공중에서는 약간의 관성
        this.vx *= this.onGround ? 0.5 : 0.92;
        if (Math.abs(this.vx) < 10) this.vx = 0;
      }
    }

    // Wall sliding speed limit
    if (this.state === STATES.WALL_SLIDING) {
      if (this.vy > this.wallSlideSpeed) {
        this.vy = this.wallSlideSpeed;
      }
    }

    // Gravity
    this.vy += this.gravity * dt;
    if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collision with platforms (simple fallback)
    this.onGround = false;
    this.onWallLeft = false;
    this.onWallRight = false;

    if (scene.levelData && scene.levelData.platforms) {
      for (const p of scene.levelData.platforms) {
        if (this._collideWithPlatform(p, dt)) break;
      }
    }
  }

  _collideWithPlatform(p, dt) {
    const px = p.x, py = p.y, pw = p.width, ph = p.height;
    const bx = this.x, by = this.y, bw = this.width, bh = this.height;

    // AABB overlap check
    if (bx + bw <= px || bx >= px + pw || by + bh <= py || by >= py + ph) {
      return false;
    }

    // Determine smallest overlap axis
    const overlapLeft = (bx + bw) - px;
    const overlapRight = (px + pw) - bx;
    const overlapTop = (by + bh) - py;
    const overlapBottom = (py + ph) - by;

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (p.type === 'one-way') {
      // One-way platforms: only collide from top
      if (this.vy > 0 && this.prevY + bh <= py + 4) {
        this.y = py - bh;
        this.vy = 0;
        this.onGround = true;
        return true;
      }
      return false;
    }

    if (minOverlap === overlapTop && this.vy > 0) {
      // Landing on top
      this.y = py - bh;
      this.vy = 0;
      this.onGround = true;
    } else if (minOverlap === overlapBottom && this.vy < 0) {
      // Hit ceiling
      this.y = py + ph;
      this.vy = 0;
    } else if (minOverlap === overlapLeft) {
      // Hit right side of entity → wall on right
      this.x = px - bw;
      this.vx = 0;
      this.onWallRight = true;
    } else if (minOverlap === overlapRight) {
      // Hit left side of entity → wall on left
      this.x = px + pw;
      this.vx = 0;
      this.onWallLeft = true;
    }
    return false;
  }
}

export { STATES as PlayerStates };
