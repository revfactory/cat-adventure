/**
 * PhysicsWorld — 물리 월드
 * 고정 timestep 1/60, accumulator 패턴, 전체 시뮬레이션 관리
 */
import { Vector2 } from './Vector2.js';
import { RigidBody } from './RigidBody.js';
import { BroadPhase } from './collision/BroadPhase.js';
import { NarrowPhase } from './collision/NarrowPhase.js';
import { Solver } from './constraints/Solver.js';
import { Gravity } from './forces/Gravity.js';
import { Polygon } from './shapes/Polygon.js';
import { Circle } from './shapes/Circle.js';
import { Capsule } from './shapes/Capsule.js';
import { getMaterial } from './materials/PhysicsMaterial.js';
import { Breakable } from './environment/Breakable.js';
import { OneWayPlatform } from './environment/OneWayPlatform.js';

export class PhysicsWorld {
  constructor(config = {}) {
    this.timestep = config.timestep || 1 / 60;
    this.maxSubsteps = config.maxSubsteps || 5;
    this.accumulator = 0;

    this.bodies = [];
    this.constraints = [];
    this.forces = [];

    this.broadPhase = new BroadPhase(config.cellSize || 128);
    this.narrowPhase = new NarrowPhase();
    this.solver = new Solver({
      velocityIterations: config.velocityIterations || 8,
      positionIterations: config.positionIterations || 3,
    });

    // 기본 중력
    this.gravity = new Gravity({
      gravity: config.gravity || { x: 0, y: 980 },
    });
    this.forces.push(this.gravity);

    // 환경 오브젝트
    this._movingPlatforms = [];
    this._conveyors = [];
    this._breakables = new Map(); // bodyId → Breakable
    this._oneWayPlatforms = new Map(); // bodyId → OneWayPlatform
    this._fragments = [];

    // 이벤트
    this.onCollision = null;
    this.onBreak = null;
    this.onPreStep = null;  // 각 substep 전에 호출 (CharacterController 업데이트용)

    // 디버그
    this._lastManifolds = [];
  }

  update(dt) {
    this.accumulator += dt;
    let steps = 0;

    // 보간용 이전 상태 저장: substep 루프 시작 전에 한 번만
    if (this.accumulator >= this.timestep) {
      for (const body of this.bodies) {
        if (body.isStatic || body.isSleeping) continue;
        body.savePreviousState();
      }
    }

    while (this.accumulator >= this.timestep && steps < this.maxSubsteps) {
      // 각 substep 전에 컨트롤러 업데이트 (힘/속도 적용)
      if (this.onPreStep) this.onPreStep(this.timestep);
      this.step(this.timestep);
      this.accumulator -= this.timestep;
      steps++;
    }

    // 보간 alpha 반환
    return this.accumulator / this.timestep;
  }

  step(dt) {
    // 0. 움직이는 플랫폼 갱신
    for (const mp of this._movingPlatforms) {
      mp.update(dt);
    }

    // 0.5 단방향 플랫폼 갱신
    for (const owp of this._oneWayPlatforms.values()) {
      owp.update(dt);
    }

    // 1. 외력 적용
    for (const force of this.forces) {
      force.apply(this.bodies, dt);
    }

    // 2. 적분 (Symplectic Euler)
    for (const body of this.bodies) {
      if (body.isStatic || body.isSleeping) continue;
      body.integrate(dt);
    }

    // 3. 브로드페이즈
    this.broadPhase.update(this.bodies);
    const pairs = this.broadPhase.getPotentialPairs();

    // 4. 내로페이즈
    const manifolds = [];
    for (const [a, b] of pairs) {
      // 단방향 플랫폼 필터
      if (this._shouldFilterOneWay(a, b)) continue;
      if (this._shouldFilterOneWay(b, a)) continue;

      const manifold = this.narrowPhase.detect(a, b);
      if (manifold) {
        manifolds.push(manifold);

        // 충돌 이벤트
        if (a.onCollision) a.onCollision(manifold, b);
        if (b.onCollision) b.onCollision(manifold, a);
        if (this.onCollision) this.onCollision(manifold);

        // 파괴 체크
        this._checkBreakable(manifold);

        // 컨베이어 체크
        this._applyConveyorForce(a, b, dt);
      }
    }

    this._lastManifolds = manifolds;

    // 5. 제약 + 충돌 해결
    const activeConstraints = this.constraints.filter(c => !c.isBroken);
    this.solver.solve(manifolds, activeConstraints, dt);

    // 6. 바디 갱신
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      body.clamp();
      body.updateSleep(dt);
    }

    // 7. 파편 갱신
    this._fragments = Breakable.updateFragments(this._fragments, dt);
    // 사라진 파편 제거
    const fragmentIds = new Set(this._fragments.map(f => f.id));
    this.bodies = this.bodies.filter(b =>
      !(b.userData && b.userData.isFragment) || fragmentIds.has(b.id)
    );
  }

  // === Body API ===

  createBody(options = {}) {
    // shape 편의 생성
    if (options.shape && !(options.shape.type)) {
      if (options.shape.type === 'box' || (options.shape.width && options.shape.height)) {
        options.shape = Polygon.createBox(options.shape.width, options.shape.height);
      }
    }

    const body = new RigidBody(options);
    this.bodies.push(body);

    // breakable 설정
    if (options.breakable) {
      const breakable = new Breakable(body, options.breakable);
      this._breakables.set(body.id, breakable);
    }

    return body;
  }

  removeBody(body) {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      this.bodies.splice(idx, 1);
    }
    this._breakables.delete(body.id);
    this._oneWayPlatforms.delete(body.id);

    // 관련 제약 제거
    this.constraints = this.constraints.filter(
      c => c.bodyA !== body && c.bodyB !== body
    );
  }

  // === Constraint API ===

  addConstraint(constraint) {
    this.constraints.push(constraint);
    return constraint;
  }

  removeConstraint(constraint) {
    const idx = this.constraints.indexOf(constraint);
    if (idx !== -1) {
      this.constraints.splice(idx, 1);
    }
  }

  // === Force API ===

  addForce(force) {
    this.forces.push(force);
    return force;
  }

  removeForce(force) {
    const idx = this.forces.indexOf(force);
    if (idx !== -1) {
      this.forces.splice(idx, 1);
    }
  }

  // === Environment API ===

  addMovingPlatform(platform) {
    this._movingPlatforms.push(platform);
  }

  addOneWayPlatform(body) {
    const owp = new OneWayPlatform(body);
    this._oneWayPlatforms.set(body.id, owp);
    return owp;
  }

  addConveyor(conveyor) {
    this._conveyors.push(conveyor);
  }

  // === Query API ===

  queryAABB(aabb) {
    return this.broadPhase.query(aabb);
  }

  raycast(origin, direction, maxDistance) {
    return this.broadPhase.raycast(origin, direction, maxDistance);
  }

  getManifolds() {
    return this._lastManifolds;
  }

  // === Internal ===

  _shouldFilterOneWay(platformBody, otherBody) {
    const owp = this._oneWayPlatforms.get(platformBody.id);
    if (!owp) return false;

    // 단방향 플랫폼 필터링
    return owp.shouldIgnoreCollision(null, otherBody);
  }

  _checkBreakable(manifold) {
    const impulse = manifold.getImpulseMagnitude();

    for (const body of [manifold.bodyA, manifold.bodyB]) {
      const breakable = this._breakables.get(body.id);
      if (!breakable) continue;

      // 충돌 속도 기반 임펄스 추정
      const relSpeed = manifold.bodyB.velocity.sub(manifold.bodyA.velocity).length();
      const estimatedImpulse = relSpeed * Math.min(manifold.bodyA.mass || 1, manifold.bodyB.mass || 1);

      const fragments = breakable.checkBreak(Math.max(impulse, estimatedImpulse));
      if (fragments) {
        // 원본 제거, 파편 추가
        this.removeBody(body);
        for (const frag of fragments) {
          this.bodies.push(frag);
          this._fragments.push(frag);
        }
        if (this.onBreak) this.onBreak(body, fragments);
      }
    }
  }

  _applyConveyorForce(bodyA, bodyB, dt) {
    for (const conveyor of this._conveyors) {
      if (conveyor.body === bodyA) {
        conveyor.applyBeltForce(bodyB, dt);
      } else if (conveyor.body === bodyB) {
        conveyor.applyBeltForce(bodyA, dt);
      }
    }
  }

  // === 유틸리티 ===

  clear() {
    this.bodies = [];
    this.constraints = [];
    this.forces = [this.gravity];
    this._movingPlatforms = [];
    this._conveyors = [];
    this._breakables.clear();
    this._oneWayPlatforms.clear();
    this._fragments = [];
    this._lastManifolds = [];
  }

  getBodyCount() {
    return this.bodies.length;
  }

  getDynamicBodyCount() {
    return this.bodies.filter(b => b.isDynamic).length;
  }
}
