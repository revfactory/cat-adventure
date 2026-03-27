/**
 * RigidBody — 리지드바디 (질량, 관성, 속도, 각속도)
 * type: 'static' | 'dynamic' | 'kinematic'
 */
import { Vector2 } from './Vector2.js';
import { getMaterial } from './materials/PhysicsMaterial.js';

let _nextBodyId = 0;

export class RigidBody {
  constructor(options = {}) {
    this.id = _nextBodyId++;
    this.type = options.type || 'dynamic';

    this.position = options.position
      ? new Vector2(options.position.x, options.position.y)
      : new Vector2(0, 0);
    this.angle = options.angle || 0;

    this.velocity = options.velocity
      ? new Vector2(options.velocity.x, options.velocity.y)
      : new Vector2(0, 0);
    this.angularVelocity = options.angularVelocity || 0;

    this.force = new Vector2(0, 0);
    this.torque = 0;

    this.shape = options.shape || null;
    if (this.shape) this.shape.body = this;

    this.material = getMaterial(options.material || 'CONCRETE');

    // 질량 / 관성
    if (this.type === 'static') {
      this.mass = 0;
      this.invMass = 0;
      this.inertia = 0;
      this.invInertia = 0;
    } else {
      this.mass = options.mass || 1;
      this.invMass = 1 / this.mass;
      this.inertia = this.shape ? this.shape.computeInertia(this.mass) : this.mass;
      this.invInertia = this.inertia > 0 ? 1 / this.inertia : 0;
    }

    // 이전 상태 (보간용)
    this.prevPosition = this.position.clone();
    this.prevAngle = this.angle;

    // Sleep 시스템
    this.isSleeping = false;
    this.sleepTimer = 0;
    this.sleepThreshold = 0.5;  // 속도 임계값
    this.sleepTimeRequired = 0.5; // 초

    // 충돌 필터링
    this.collisionLayer = options.collisionLayer || 0x0001;
    this.collisionMask = options.collisionMask || 0xFFFF;

    // 고정 회전 (캐릭터용)
    this.fixedRotation = options.fixedRotation || false;

    // 사용자 데이터
    this.userData = options.userData || null;

    // 감쇠
    this.linearDamping = options.linearDamping || 0;
    this.angularDamping = options.angularDamping || 0;

    // breakable 설정
    this.breakable = options.breakable || null;

    // 센서 (충돌 감지만, 응답 없음)
    this.isSensor = options.isSensor || false;

    // 이벤트 콜백
    this.onCollision = options.onCollision || null;
    this.onBreak = options.onBreak || null;
  }

  get isStatic() {
    return this.type === 'static';
  }

  get isDynamic() {
    return this.type === 'dynamic';
  }

  get isKinematic() {
    return this.type === 'kinematic';
  }

  savePreviousState() {
    this.prevPosition.copyFrom(this.position);
    this.prevAngle = this.angle;
  }

  integrate(dt) {
    if (this.isStatic) return;

    // Symplectic Euler: 속도 먼저 갱신, 그 다음 위치
    const acceleration = this.force.scale(this.invMass);
    this.velocity = this.velocity.add(acceleration.scale(dt));

    // 감쇠
    if (this.linearDamping > 0) {
      this.velocity = this.velocity.scale(1 / (1 + this.linearDamping * dt));
    }

    this.position = this.position.add(this.velocity.scale(dt));

    if (!this.fixedRotation) {
      const angularAcceleration = this.torque * this.invInertia;
      this.angularVelocity += angularAcceleration * dt;

      if (this.angularDamping > 0) {
        this.angularVelocity /= (1 + this.angularDamping * dt);
      }

      this.angle += this.angularVelocity * dt;
    }

    // 힘/토크 초기화
    this.force.set(0, 0);
    this.torque = 0;
  }

  applyForce(force) {
    if (this.isStatic) return;
    this.force = this.force.add(force);
    this.wake();
  }

  applyForceAt(force, point) {
    if (this.isStatic) return;
    this.force = this.force.add(force);
    const r = point.sub(this.position);
    this.torque += r.cross(force);
    this.wake();
  }

  applyImpulse(impulse) {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(impulse.scale(this.invMass));
    this.wake();
  }

  applyImpulseAt(impulse, point) {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(impulse.scale(this.invMass));
    if (!this.fixedRotation) {
      const r = point.sub(this.position);
      this.angularVelocity += r.cross(impulse) * this.invInertia;
    }
    this.wake();
  }

  setPosition(x, y) {
    this.position.set(x, y);
    this.wake();
  }

  setVelocity(x, y) {
    this.velocity.set(x, y);
    this.wake();
  }

  setAngle(angle) {
    this.angle = angle;
    this.wake();
  }

  getAABB() {
    if (this.shape) return this.shape.getAABB();
    return {
      min: { x: this.position.x, y: this.position.y },
      max: { x: this.position.x, y: this.position.y },
    };
  }

  getInterpolatedPosition(alpha) {
    return this.prevPosition.lerp(this.position, alpha);
  }

  getInterpolatedAngle(alpha) {
    return this.prevAngle + (this.angle - this.prevAngle) * alpha;
  }

  // Sleep
  updateSleep(dt) {
    if (this.isStatic) return;
    const speed = this.velocity.length() + Math.abs(this.angularVelocity);
    if (speed < this.sleepThreshold) {
      this.sleepTimer += dt;
      if (this.sleepTimer >= this.sleepTimeRequired) {
        this.sleep();
      }
    } else {
      this.sleepTimer = 0;
      this.isSleeping = false;
    }
  }

  sleep() {
    this.isSleeping = true;
    this.velocity.set(0, 0);
    this.angularVelocity = 0;
  }

  wake() {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }

  canCollideWith(other) {
    return (this.collisionLayer & other.collisionMask) !== 0 &&
           (other.collisionLayer & this.collisionMask) !== 0;
  }

  // 속도/위치 클램핑 (발산 방지)
  clamp(maxVelocity = 2000, maxAngularVelocity = 50) {
    const speed = this.velocity.length();
    if (speed > maxVelocity) {
      this.velocity = this.velocity.normalize().scale(maxVelocity);
    }
    if (Math.abs(this.angularVelocity) > maxAngularVelocity) {
      this.angularVelocity = Math.sign(this.angularVelocity) * maxAngularVelocity;
    }
  }
}
