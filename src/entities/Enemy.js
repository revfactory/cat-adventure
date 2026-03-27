/**
 * Enemy — 적 캐릭터 (AI 상태 머신)
 * 졸개 불독, 광견 자동차, 까마귀, 보스 불탱
 */
import { Entity } from './Entity.js';

const ENEMY_TYPES = {
  DOG: 'dog',
  CAR: 'car',
  CROW: 'crow',
  BOSS: 'boss',
};

const AI_STATES = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  STUNNED: 'STUNNED',
  // Car-specific
  ALERT: 'ALERT',
  CHARGE: 'CHARGE',
  // Crow-specific
  FLY: 'FLY',
  DIVE: 'DIVE',
  RISE: 'RISE',
  // Boss phases
  BOSS_PHASE1: 'BOSS_PHASE1',
  BOSS_PHASE2: 'BOSS_PHASE2',
  BOSS_PHASE3: 'BOSS_PHASE3',
  BOSS_STUNNED: 'BOSS_STUNNED',
};

export class Enemy extends Entity {
  constructor(x, y, enemyType = 'dog', config = {}) {
    const sizes = {
      dog: [56, 50],
      car: [80, 44],
      crow: [44, 38],
      boss: [120, 100],
    };
    const [w, h] = sizes[enemyType] || [40, 36];
    super(x, y, w, h);

    this.type = enemyType === 'boss' ? 'boss' : 'enemy';
    this.enemyType = enemyType;

    // Colors
    const colors = {
      dog: '#D4A574',
      car: '#E74C3C',
      crow: '#2C3E50',
      boss: '#8B6914',
    };
    this.color = colors[enemyType] || '#D4A574';
    this.label = { dog: '불독', car: '자동차', crow: '까마귀', boss: '불탱' }[enemyType] || '적';

    // Stats
    this.mass = config.mass || { dog: 15, car: 50, crow: 2, boss: 80 }[enemyType] || 15;
    this.damage = config.damage || { dog: 1, car: 2, crow: 1, boss: 2 }[enemyType] || 1;
    this.knockbackImpulse = config.knockback_impulse || { dog: 300, car: 500, crow: 200, boss: 400 }[enemyType] || 300;
    this.stompCount = 0;
    this.stompToKill = { dog: 2, car: Infinity, crow: 1, boss: Infinity }[enemyType] || 2;
    this.killPoints = { dog: 150, car: 0, crow: 200, boss: 2000 }[enemyType] || 150;
    this.dead = false;

    // AI
    this.aiState = this._initialAIState();
    this.aiTimer = 0;
    this.detectRange = config.detectRange || 200;
    this.attackRange = config.attackRange || 50;
    this.patrolMin = config.patrol?.min ?? (x - 100);
    this.patrolMax = config.patrol?.max ?? (x + 100);
    this.patrolSpeed = { dog: 80, car: 200, crow: 100, boss: 100 }[enemyType] || 80;
    this.chaseSpeed = { dog: 120, car: 300, crow: 0, boss: 150 }[enemyType] || 120;
    this.patrolDir = 1;

    // Crow specific
    this.flyHeight = config.flyHeight || 120;
    this.flyBaseY = y;
    this.flyAngle = 0;

    // Boss specific
    this.bossHealth = 3; // 3 hits to kill
    this.bossPhase = 1;

    // Gravity (fallback)
    this.gravity = enemyType === 'crow' ? 0 : 600;
    this.onGround = false;
  }

  _initialAIState() {
    switch (this.enemyType) {
      case 'crow': return AI_STATES.FLY;
      case 'boss': return AI_STATES.BOSS_PHASE1;
      default: return AI_STATES.PATROL;
    }
  }

  update(dt, scene) {
    if (this.dead) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.aiTimer += dt;

    if (this.rigidBody) {
      this.x = this.rigidBody.position.x - this.width / 2;
      this.y = this.rigidBody.position.y - this.height / 2;
    }

    const player = scene.player;
    const distToPlayer = player ? Math.hypot(player.x - this.x, player.y - this.y) : Infinity;

    switch (this.enemyType) {
      case 'dog': this._updateDog(dt, scene, player, distToPlayer); break;
      case 'car': this._updateCar(dt, scene, player, distToPlayer); break;
      case 'crow': this._updateCrow(dt, scene, player, distToPlayer); break;
      case 'boss': this._updateBoss(dt, scene, player, distToPlayer); break;
    }

    // Fallback physics
    if (!this.rigidBody && this.gravity > 0) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;

      // Simple ground collision
      if (scene.levelData) {
        for (const p of scene.levelData.platforms) {
          if (p.type === 'one-way') continue;
          if (this.x + this.width > p.x && this.x < p.x + p.width &&
              this.y + this.height > p.y && this.y + this.height < p.y + p.height + 10) {
            if (this.vy > 0) {
              this.y = p.y - this.height;
              this.vy = 0;
              this.onGround = true;
            }
          }
        }
      }
    }
  }

  // --- Dog AI ---
  _updateDog(dt, scene, player, dist) {
    switch (this.aiState) {
      case AI_STATES.PATROL:
        this.vx = this.patrolDir * this.patrolSpeed;
        this.facingRight = this.patrolDir > 0;
        if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
          this.patrolDir *= -1;
        }
        if (dist < this.detectRange && player && player.state !== 'DEAD') {
          this._setAIState(AI_STATES.CHASE);
        }
        break;

      case AI_STATES.CHASE:
        if (player) {
          this.facingRight = player.x > this.x;
          this.vx = (this.facingRight ? 1 : -1) * this.chaseSpeed;
        }
        if (dist < this.attackRange) {
          this._setAIState(AI_STATES.ATTACK);
        } else if (dist > this.detectRange * 1.5) {
          this._setAIState(AI_STATES.PATROL);
        }
        break;

      case AI_STATES.ATTACK:
        // Rush impulse
        if (this.aiTimer < 0.5) {
          this.vx = (this.facingRight ? 1 : -1) * 400;
        } else {
          this._setAIState(AI_STATES.IDLE);
        }
        break;

      case AI_STATES.IDLE:
        this.vx = 0;
        if (this.aiTimer > 1) {
          this._setAIState(AI_STATES.PATROL);
        }
        break;

      case AI_STATES.STUNNED:
        this.vx = 0;
        if (this.aiTimer > 1) {
          this._setAIState(AI_STATES.PATROL);
        }
        break;
    }
  }

  // --- Car AI ---
  _updateCar(dt, scene, player, dist) {
    switch (this.aiState) {
      case AI_STATES.PATROL:
        this.vx = this.patrolDir * this.patrolSpeed;
        this.facingRight = this.patrolDir > 0;
        if (this.x <= this.patrolMin) {
          this.patrolDir = 1;
          this.vx = 0;
        } else if (this.x + this.width >= this.patrolMax) {
          this.patrolDir = -1;
          this.vx = 0;
        }
        if (dist < this.detectRange && player && player.state !== 'DEAD') {
          this._setAIState(AI_STATES.ALERT);
        }
        break;

      case AI_STATES.ALERT:
        this.vx = 0;
        if (this.aiTimer > 0.5) {
          this._setAIState(AI_STATES.CHARGE);
        }
        break;

      case AI_STATES.CHARGE:
        if (player) {
          this.facingRight = player.x > this.x;
          this.vx = (this.facingRight ? 1 : -1) * 300;
        }
        // Stun on wall hit
        if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
          this._setAIState(AI_STATES.STUNNED);
        }
        break;

      case AI_STATES.STUNNED:
        this.vx = 0;
        if (this.aiTimer > 2) {
          this._setAIState(AI_STATES.PATROL);
        }
        break;
    }
  }

  // --- Crow AI ---
  _updateCrow(dt, scene, player, dist) {
    switch (this.aiState) {
      case AI_STATES.FLY:
        this.flyAngle += dt * 2;
        this.y = this.flyBaseY + Math.sin(this.flyAngle) * 25;
        this.vx = this.patrolDir * this.patrolSpeed;
        this.facingRight = this.patrolDir > 0;
        if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
          this.patrolDir *= -1;
        }
        // Dive when player is below
        if (player && Math.abs(player.x - this.x) < 50 && player.y > this.y) {
          this._setAIState(AI_STATES.DIVE);
        }
        break;

      case AI_STATES.DIVE:
        this.vx = (this.facingRight ? 1 : -1) * 150;
        this.vy = 250;
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        // Near ground
        if (this.y > this.flyBaseY + 200) {
          this._setAIState(AI_STATES.RISE);
        }
        break;

      case AI_STATES.RISE:
        this.vy = -200;
        this.y += this.vy * dt;
        if (this.y <= this.flyBaseY) {
          this.y = this.flyBaseY;
          this.vy = 0;
          this._setAIState(AI_STATES.FLY);
        }
        break;

      case AI_STATES.STUNNED:
        this.vx = 0;
        this.vy = 0;
        if (this.aiTimer > 1.5) {
          this._setAIState(AI_STATES.FLY);
        }
        break;
    }
  }

  // --- Boss AI (3-phase full implementation) ---
  _updateBoss(dt, scene, player, dist) {
    // Boss attack sub-state tracking
    if (!this._bossAttack) {
      this._bossAttack = null; // 'charge','bark','jump','throw','multi_charge'
      this._bossAttackTimer = 0;
      this._bossChargeCount = 0;
      this._bossJumpY = 0;
    }
    this._bossAttackTimer += dt;

    switch (this.aiState) {
      case AI_STATES.BOSS_PHASE1:
        this._bossPhase1(dt, scene, player);
        break;
      case AI_STATES.BOSS_PHASE2:
        this._bossPhase2(dt, scene, player);
        break;
      case AI_STATES.BOSS_PHASE3:
        this._bossPhase3(dt, scene, player);
        break;
      case AI_STATES.BOSS_STUNNED:
        this.vx = 0;
        this.vy = 0;
        const stunTime = this.bossHealth === 1 ? 3 : 2;
        if (this.aiTimer > stunTime) {
          this._setBossPhase();
        }
        break;
    }
  }

  // Phase 1: charge + bark
  _bossPhase1(dt, scene, player) {
    if (!this._bossAttack) {
      // Patrol for 2 seconds then pick attack
      this._bossPatrol(dt, 100);
      if (this.aiTimer > 2 && player) {
        this._bossAttack = Math.random() < 0.6 ? 'charge' : 'bark';
        this._bossAttackTimer = 0;
      }
      return;
    }
    if (this._bossAttack === 'charge') {
      this._bossCharge(dt, player, 400);
    } else if (this._bossAttack === 'bark') {
      this._bossBark(dt, scene, player, 200, 400);
    }
  }

  // Phase 2: charge(600) + jump + throw + bark
  _bossPhase2(dt, scene, player) {
    if (!this._bossAttack) {
      this._bossPatrol(dt, 150);
      if (this.aiTimer > 1.5 && player) {
        const r = Math.random();
        if (r < 0.35) this._bossAttack = 'charge';
        else if (r < 0.6) this._bossAttack = 'jump';
        else if (r < 0.8) this._bossAttack = 'throw';
        else this._bossAttack = 'bark';
        this._bossAttackTimer = 0;
      }
      return;
    }
    switch (this._bossAttack) {
      case 'charge': this._bossCharge(dt, player, 600); break;
      case 'jump': this._bossJumpAttack(dt, scene, player); break;
      case 'throw': this._bossThrowAttack(dt, scene, player); break;
      case 'bark': this._bossBark(dt, scene, player, 200, 400); break;
    }
  }

  // Phase 3: random + multi_charge + jump(floor break)
  _bossPhase3(dt, scene, player) {
    if (!this._bossAttack) {
      this._bossPatrol(dt, 180);
      if (this.aiTimer > 1 && player) {
        const r = Math.random();
        if (r < 0.3) this._bossAttack = 'multi_charge';
        else if (r < 0.55) this._bossAttack = 'jump';
        else if (r < 0.75) this._bossAttack = 'throw';
        else this._bossAttack = 'bark';
        this._bossAttackTimer = 0;
        this._bossChargeCount = 0;
      }
      return;
    }
    switch (this._bossAttack) {
      case 'multi_charge': this._bossMultiCharge(dt, player); break;
      case 'jump': this._bossJumpAttack(dt, scene, player, true); break;
      case 'throw': this._bossThrowAttack(dt, scene, player); break;
      case 'bark': this._bossBark(dt, scene, player, 250, 500); break;
    }
  }

  // Charge: telegraph 1s, rush, wall hit → stunned
  _bossCharge(dt, player, speed) {
    if (this._bossAttackTimer < 1) {
      // Telegraph: scrape ground
      this.vx = 0;
      if (player) this.facingRight = player.x > this.x;
    } else {
      this.vx = (this.facingRight ? 1 : -1) * speed;
      if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
        this._bossAttack = null;
        this._setAIState(AI_STATES.BOSS_STUNNED);
      }
    }
  }

  // Multi-charge: 3 consecutive charges (phase 3)
  _bossMultiCharge(dt, player) {
    if (this._bossAttackTimer < 0.5) {
      this.vx = 0;
      if (player) this.facingRight = player.x > this.x;
    } else {
      this.vx = (this.facingRight ? 1 : -1) * 700;
      if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
        this._bossChargeCount++;
        if (this._bossChargeCount >= 3) {
          this._bossAttack = null;
          this._setAIState(AI_STATES.BOSS_STUNNED);
        } else {
          // Reverse direction for next charge
          this.facingRight = !this.facingRight;
          this._bossAttackTimer = 0;
        }
      }
    }
  }

  // Bark: shockwave in front (knockback)
  _bossBark(dt, scene, player, range, knockback) {
    if (this._bossAttackTimer < 0.5) {
      this.vx = 0;
    } else if (this._bossAttackTimer < 0.8) {
      // Fire shockwave once
      if (!this._barkFired) {
        this._barkFired = true;
        if (player) {
          const px = player.x + player.width / 2;
          const bx = this.x + this.width / 2;
          const dx = Math.abs(px - bx);
          const dir = px > bx ? 1 : -1;
          if (dx < range && dir === (this.facingRight ? 1 : -1)) {
            // Hit player with knockback
            player.hurt(this, scene);
          }
        }
        scene.camera?.shake(4, 0.3);
      }
    } else if (this._bossAttackTimer > 1.5) {
      this._bossAttack = null;
      this._barkFired = false;
      this.aiTimer = 0;
    }
  }

  // Jump attack: leap up, slam down with shockwave
  _bossJumpAttack(dt, scene, player, breakFloor = false) {
    if (this._bossAttackTimer < 0.3) {
      // Crouch
      this.vx = 0;
    } else if (this._bossAttackTimer < 0.6) {
      // Rise
      this.vy = -600;
      this.y += this.vy * dt;
      if (player) {
        // Track player X while airborne
        const diff = player.x - this.x;
        this.vx = Math.sign(diff) * Math.min(200, Math.abs(diff));
      }
      this.x += this.vx * dt;
    } else if (this._bossAttackTimer < 1.2) {
      // Slam down
      this.vy = 800;
      this.y += this.vy * dt;
      this.x += this.vx * 0.3 * dt;
      // Check if landed
      const groundY = (scene.levelData?.platforms?.[0]?.y || 520) - this.height;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.vx = 0;
        // Shockwave: damage nearby player
        if (player) {
          const dist = Math.abs(player.x - this.x);
          if (dist < 200) {
            player.hurt(this, scene);
          }
        }
        scene.camera?.shake(10, 0.4);
        // Phase 3: break floor
        if (breakFloor && scene.levelData?.platforms) {
          for (const p of scene.levelData.platforms) {
            const px = p.x + p.width / 2;
            if (Math.abs(px - (this.x + this.width / 2)) < 150 && p.type === 'one-way') {
              p._collapsing = true;
              p._collapseTimer = 1;
            }
          }
        }
        this._bossAttackTimer = 1.5; // Skip to cooldown
      }
    } else if (this._bossAttackTimer > 2.5) {
      this._bossAttack = null;
      this.aiTimer = 0;
    }
  }

  // Throw attack: rip antenna and throw as projectile
  _bossThrowAttack(dt, scene, player) {
    if (this._bossAttackTimer < 0.8) {
      // Windup
      this.vx = 0;
      if (player) this.facingRight = player.x > this.x;
    } else if (this._bossAttackTimer < 1) {
      // Launch projectile (represented as a fast-moving entity)
      if (!this._throwFired) {
        this._throwFired = true;
        const projDir = this.facingRight ? 1 : -1;
        // Create a simple projectile entity
        const proj = new Entity(this.x + (this.facingRight ? this.width : -10), this.y + 20, 10, 60);
        proj.type = 'effect';
        proj.color = '#95A5A6';
        proj.vx = projDir * 400;
        proj.vy = -50;
        proj.active = true;
        proj._isProjectile = true;
        proj._lifetime = 2;
        proj._damage = 2;
        const origUpdate = proj.update.bind(proj);
        proj.update = (pdt, pscene) => {
          proj.prevX = proj.x;
          proj.prevY = proj.y;
          proj.x += proj.vx * pdt;
          proj.y += proj.vy * pdt;
          proj.vy += 300 * pdt; // gravity
          proj._lifetime -= pdt;
          if (proj._lifetime <= 0) { proj.destroyed = true; return; }
          // Hit player
          const pl = pscene.player;
          if (pl && !pl.invincible && pl.state !== 'DEAD' &&
              proj.x < pl.x + pl.width && proj.x + proj.width > pl.x &&
              proj.y < pl.y + pl.height && proj.y + proj.height > pl.y) {
            pl.hurt({ x: proj.x, y: proj.y, damage: 2, knockbackImpulse: 400 }, pscene);
            proj.destroyed = true;
          }
        };
        scene.addEntity(proj);
      }
    } else if (this._bossAttackTimer > 1.8) {
      this._bossAttack = null;
      this._throwFired = false;
      this.aiTimer = 0;
    }
  }

  _bossPatrol(dt, speed) {
    if (this.aiTimer < 2) {
      this.vx = this.patrolDir * speed;
      this.facingRight = this.patrolDir > 0;
      if (this.x <= this.patrolMin || this.x + this.width >= this.patrolMax) {
        this.patrolDir *= -1;
      }
    }
  }

  _setBossPhase() {
    if (this.bossHealth <= 0) {
      this.dead = true;
      return;
    }
    if (this.bossHealth === 2) this.aiState = AI_STATES.BOSS_PHASE2;
    else if (this.bossHealth === 1) this.aiState = AI_STATES.BOSS_PHASE3;
    else this.aiState = AI_STATES.BOSS_PHASE1;
    this.aiTimer = 0;
  }

  bossTakeDamage(scene) {
    if (this.aiState !== AI_STATES.BOSS_STUNNED) return;
    this.bossHealth--;
    scene.camera?.shake(10, 0.5);
    if (this.bossHealth <= 0) {
      this.dead = true;
      scene.addScore(this.killPoints);
    }
  }

  stomp(scene) {
    this.stompCount++;
    this._setAIState(AI_STATES.STUNNED);
    if (scene.player?.audio) scene.player.audio.playStomp();
    if (this.stompCount >= this.stompToKill) {
      this.dead = true;
      this.active = false;
      scene.addScore(this.killPoints);
    }
  }

  _setAIState(newState) {
    this.aiState = newState;
    this.aiTimer = 0;
    const target = this._svgInner || this.svgElement;
    if (target) {
      target.className.baseVal = `entity-enemy anim-${newState.toLowerCase()}`;
    }
  }
}

export { ENEMY_TYPES, AI_STATES };
