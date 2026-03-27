# 물리엔진 구현 가이드

## 목차
1. [아키텍처 개요](#아키텍처-개요)
2. [고정 Timestep 패턴](#고정-timestep-패턴)
3. [충돌 감지 파이프라인](#충돌-감지-파이프라인)
4. [SAT 알고리즘](#sat-알고리즘)
5. [임펄스 기반 충돌 해결](#임펄스-기반-충돌-해결)
6. [제약 솔버](#제약-솔버)
7. [캐릭터 컨트롤러](#캐릭터-컨트롤러)
8. [환경 물리](#환경-물리)
9. [최적화 전략](#최적화-전략)
10. [디버그 렌더러](#디버그-렌더러)

## 아키텍처 개요

물리엔진은 게임 루프와 분리된 고정 timestep으로 동작한다. 렌더링은 물리 상태를 보간(interpolation)하여 부드러운 시각적 결과를 제공한다.

```
Game Loop (variable dt)
  │
  ├── accumulator += dt
  ├── while (accumulator >= TIMESTEP):
  │     ├── PhysicsWorld.step(TIMESTEP)
  │     │     ├── applyForces()        — 중력, 바람, 부력
  │     │     ├── integrate()          — 속도/위치 적분 (Symplectic Euler)
  │     │     ├── broadPhase()         — 공간 분할로 후보 쌍 수집
  │     │     ├── narrowPhase()        — SAT 정밀 충돌 검사
  │     │     ├── solveConstraints()   — 제약 반복 솔버
  │     │     ├── solveCollisions()    — 임펄스 기반 충돌 응답
  │     │     └── updateBodies()       — 최종 위치/회전 갱신
  │     └── accumulator -= TIMESTEP
  │
  ├── alpha = accumulator / TIMESTEP
  ├── interpolatedState = lerp(prevState, currState, alpha)
  └── render(interpolatedState)
```

## 고정 Timestep 패턴

가변 프레임레이트에서도 물리가 일관되게 동작하려면 고정 timestep이 필수다.

```javascript
class PhysicsWorld {
  constructor(config) {
    this.timestep = config.timestep || 1/60;
    this.maxSubsteps = config.maxSubsteps || 5;
    this.accumulator = 0;
    this.bodies = [];
    this.constraints = [];
    this.forces = [];
    this.broadphase = new SpatialHashGrid(config.cellSize || 128);
    this.narrowphase = new SATDetector();
    this.solver = new SequentialImpulseSolver({
      velocityIterations: config.velocityIterations || 8,
      positionIterations: config.positionIterations || 3,
    });
  }

  update(dt) {
    this.accumulator += dt;
    let steps = 0;

    while (this.accumulator >= this.timestep && steps < this.maxSubsteps) {
      this.step(this.timestep);
      this.accumulator -= this.timestep;
      steps++;
    }

    // 보간 alpha 반환 (렌더러가 사용)
    return this.accumulator / this.timestep;
  }

  step(dt) {
    // 1. 외력 적용
    for (const force of this.forces) {
      force.apply(this.bodies, dt);
    }

    // 2. 속도/위치 적분
    for (const body of this.bodies) {
      if (body.isStatic || body.isSleeping) continue;
      body.savePreviousState();
      body.integrate(dt);
    }

    // 3. 브로드페이즈
    this.broadphase.update(this.bodies);
    const pairs = this.broadphase.getPotentialPairs();

    // 4. 내로페이즈
    const manifolds = [];
    for (const [a, b] of pairs) {
      const manifold = this.narrowphase.detect(a, b);
      if (manifold) manifolds.push(manifold);
    }

    // 5. 제약 + 충돌 해결
    this.solver.solve(manifolds, this.constraints, dt);
  }
}
```

## 충돌 감지 파이프라인

### 브로드페이즈: Spatial Hash Grid

공간을 균등 격자로 나누어, 같은 셀에 있는 바디 쌍만 내로페이즈로 전달한다.

```javascript
class SpatialHashGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _hash(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  update(bodies) {
    this.grid.clear();
    for (const body of bodies) {
      const aabb = body.getAABB();
      const minCX = Math.floor(aabb.min.x / this.cellSize);
      const minCY = Math.floor(aabb.min.y / this.cellSize);
      const maxCX = Math.floor(aabb.max.x / this.cellSize);
      const maxCY = Math.floor(aabb.max.y / this.cellSize);

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          const key = `${cx},${cy}`;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(body);
        }
      }
    }
  }

  getPotentialPairs() {
    const pairs = new Set();
    for (const cell of this.grid.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const id = cell[i].id < cell[j].id
            ? `${cell[i].id}:${cell[j].id}`
            : `${cell[j].id}:${cell[i].id}`;
          if (!pairs.has(id)) {
            pairs.add(id);
          }
        }
      }
    }
    return [...pairs].map(id => {
      const [a, b] = id.split(':');
      return [this._getBody(a), this._getBody(b)];
    });
  }
}
```

### 내로페이즈: SAT (Separating Axis Theorem)

두 볼록 다각형이 충돌하는지 검사한다. 분리축이 하나라도 존재하면 충돌하지 않는다.

## SAT 알고리즘

```javascript
class SATDetector {
  detect(bodyA, bodyB) {
    const shapeA = bodyA.shape;
    const shapeB = bodyB.shape;

    // 각 shape의 법선(축) 수집
    const axes = [...shapeA.getNormals(), ...shapeB.getNormals()];

    let minOverlap = Infinity;
    let collisionNormal = null;

    for (const axis of axes) {
      const projA = shapeA.project(axis);
      const projB = shapeB.project(axis);

      const overlap = Math.min(projA.max - projB.min, projB.max - projA.min);

      if (overlap <= 0) return null; // 분리축 발견 → 충돌 없음

      if (overlap < minOverlap) {
        minOverlap = overlap;
        collisionNormal = axis;
      }
    }

    // 법선 방향 보정 (A→B를 가리키도록)
    const d = bodyB.position.sub(bodyA.position);
    if (d.dot(collisionNormal) < 0) {
      collisionNormal = collisionNormal.negate();
    }

    return new Manifold(bodyA, bodyB, collisionNormal, minOverlap);
  }
}
```

## 임펄스 기반 충돌 해결

```javascript
function resolveCollision(manifold) {
  const { bodyA, bodyB, normal, depth } = manifold;

  // 상대 속도
  const relVel = bodyB.velocity.sub(bodyA.velocity);
  const velAlongNormal = relVel.dot(normal);

  // 이미 분리 중이면 무시
  if (velAlongNormal > 0) return;

  // 반발 계수 (두 머티리얼의 조합)
  const e = Math.min(bodyA.material.restitution, bodyB.material.restitution);

  // 임펄스 크기
  const invMassSum = bodyA.invMass + bodyB.invMass;
  const j = -(1 + e) * velAlongNormal / invMassSum;

  // 임펄스 적용
  const impulse = normal.scale(j);
  bodyA.velocity = bodyA.velocity.sub(impulse.scale(bodyA.invMass));
  bodyB.velocity = bodyB.velocity.add(impulse.scale(bodyB.invMass));

  // 마찰 임펄스
  const tangent = relVel.sub(normal.scale(velAlongNormal)).normalize();
  const jt = -relVel.dot(tangent) / invMassSum;

  const mu = Math.sqrt(
    bodyA.material.friction * bodyA.material.friction +
    bodyB.material.friction * bodyB.material.friction
  );

  const frictionImpulse = Math.abs(jt) < j * mu
    ? tangent.scale(jt)
    : tangent.scale(-j * mu);

  bodyA.velocity = bodyA.velocity.sub(frictionImpulse.scale(bodyA.invMass));
  bodyB.velocity = bodyB.velocity.add(frictionImpulse.scale(bodyB.invMass));

  // 위치 보정 (Baumgarte stabilization)
  const correction = normal.scale(
    Math.max(depth - 0.01, 0) / invMassSum * 0.4
  );
  bodyA.position = bodyA.position.sub(correction.scale(bodyA.invMass));
  bodyB.position = bodyB.position.add(correction.scale(bodyB.invMass));
}
```

## 제약 솔버

### Sequential Impulse Solver

```javascript
class SequentialImpulseSolver {
  solve(manifolds, constraints, dt) {
    // Warm starting: 이전 프레임 임펄스를 초기값으로
    for (const m of manifolds) {
      if (m.warmImpulse) {
        m.bodyA.applyImpulse(m.warmImpulse.negate());
        m.bodyB.applyImpulse(m.warmImpulse);
      }
    }

    // 속도 반복
    for (let i = 0; i < this.velocityIterations; i++) {
      for (const m of manifolds) resolveCollision(m);
      for (const c of constraints) c.solveVelocity(dt);
    }

    // 위치 반복
    for (let i = 0; i < this.positionIterations; i++) {
      for (const m of manifolds) positionalCorrection(m);
      for (const c of constraints) c.solvePosition(dt);
    }
  }
}
```

### 제약 유형

| 제약 | 용도 | 스테이지 |
|------|------|---------|
| DistanceJoint | 빨래줄 스윙, 체인 | 1. 골목길 |
| RevoluteJoint | 시소, 문 경첩, 그네 | 2. 공원 |
| SpringJoint | 탄성 플랫폼, 트램폴린 | 3. 시장 |
| PrismaticJoint | 엘리베이터, 크레인 | 4. 공사장 |
| MouseJoint | (디버그) 오브젝트 드래그 | 개발용 |

## 캐릭터 컨트롤러

고양이 캐릭터에 게임적 편의성(game feel)을 위한 물리 보정을 적용한다.

### 코요테 타임 (Coyote Time)
절벽에서 떨어진 직후에도 짧은 시간(0.1초) 동안 점프를 허용한다. 플레이어가 "늦게 점프했는데 안 돼요"라고 느끼는 것을 방지한다.

### 점프 버퍼 (Jump Buffer)
착지 직전(0.15초 이내)에 점프 버튼을 누르면, 착지 즉시 점프가 발동한다. 타이밍이 빠듯한 플랫포밍을 편안하게 만든다.

### 가변 점프 높이
점프 버튼을 짧게 누르면 낮게, 길게 누르면 높게 점프한다. 상승 중 버튼을 떼면 상승 속도를 즉시 감쇄(×0.5)한다.

### 벽 미끄러짐 / 벽 점프
벽에 접촉한 상태에서 낙하 속도를 제한(50px/s)하고, 점프 입력 시 벽 반대 방향 + 위로 점프한다.

### 착지 스쿼시 (Landing Squash)
높은 곳에서 착지 시 낙하 속도에 비례하여 캐릭터를 일시적으로 납작하게(scaleY 0.7) 만들었다가 복귀한다. SVG transform으로 구현.

```javascript
class CharacterController {
  constructor(body, config) {
    this.body = body;
    this.config = config;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.isOnGround = false;
    this.isOnWall = false;
    this.wallDirection = 0; // -1: 왼쪽 벽, 1: 오른쪽 벽
    this.jumpHeld = false;
  }

  update(input, dt) {
    this._updateGroundCheck();
    this._updateWallCheck();
    this._updateTimers(dt);
    this._handleMovement(input, dt);
    this._handleJump(input);
    this._handleWallSlide(input);
    this._clampVelocity();
  }

  _handleJump(input) {
    if (input.jumpPressed) {
      this.jumpBufferTimer = this.config.JUMP_BUFFER;
    }

    const canJump = this.isOnGround || this.coyoteTimer > 0;
    const wantsJump = this.jumpBufferTimer > 0;

    if (canJump && wantsJump) {
      this.body.velocity.y = -this.config.JUMP_IMPULSE;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpHeld = true;
    }

    // 가변 점프 높이
    if (!input.jumpHeld && this.jumpHeld && this.body.velocity.y < 0) {
      this.body.velocity.y *= 0.5;
      this.jumpHeld = false;
    }
  }
}
```

## 환경 물리

### 움직이는 플랫폼
경로 기반 이동. 위에 올라탄 캐릭터에게 플랫폼의 속도를 전달(carry velocity)하여 자연스러운 이동 제공.

### 단방향 플랫폼
아래에서 위로 통과 가능, 위에서 아래로는 충돌. 충돌 법선의 Y 방향과 캐릭터 속도 방향으로 판단.

### 파괴 가능 오브젝트
체력 시스템. 충돌 임펄스가 임계값을 넘으면 파괴 → 파편 RigidBody 여러 개로 분해 → 일정 시간 후 fade out.

### 컨베이어 벨트
접촉 중인 바디의 속도에 벨트 방향/속도를 마찰력으로 추가.

## 최적화 전략

1. **Sleep 시스템** — 일정 시간 이상 속도가 임계값 이하인 바디를 sleep 처리. 외부 힘/충돌 시 깨움.
2. **Spatial Hash 셀 크기** — 가장 큰 오브젝트의 2배를 기본 셀 크기로 설정.
3. **충돌 필터링** — 레이어 비트마스크로 불필요한 충돌 쌍을 사전 제외.
4. **Object Pool** — 파티클, 파편 등 빈번히 생성/소멸되는 오브젝트를 풀링.
5. **먼 오브젝트 비활성화** — 카메라 뷰포트 밖 오브젝트를 시뮬레이션에서 제외.

## 디버그 렌더러

개발 중 물리 상태를 시각적으로 확인하는 오버레이. `?debug=physics` 쿼리로 활성화.

- 충돌체 외곽선 (초록: 정상, 빨강: 충돌 중, 파랑: sleep)
- 속도 벡터 (노란 화살표)
- 힘 벡터 (빨간 화살표)
- 접촉점 (흰 점)
- 제약 연결선 (회색 점선)
- AABB (반투명 사각형)
- Spatial Hash Grid 셀 (격자선)
