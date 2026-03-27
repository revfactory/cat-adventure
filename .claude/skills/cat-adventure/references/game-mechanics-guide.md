# 게임 메카닉스 구현 가이드

## 목차
1. [물리엔진 통합](#물리엔진-통합)
2. [캐릭터 상태 머신](#캐릭터-상태-머신)
3. [레벨 데이터 구조](#레벨-데이터-구조)
4. [게임 밸런스 파라미터](#게임-밸런스-파라미터)
5. [스테이지별 물리 상호작용](#스테이지별-물리-상호작용)

## 물리엔진 통합

physics-engineer가 구현한 물리엔진을 게임 루프에 통합하는 방법. 물리엔진 내부 구현은 `physics-engine-guide.md` 참조.

### 게임 루프 통합 패턴
```javascript
// main.js
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { CharacterController } from './physics/character/CharacterController.js';

const world = new PhysicsWorld({
  timestep: 1/60,
  maxSubsteps: 5,
  velocityIterations: 8,
  positionIterations: 3,
  cellSize: 128,
});

function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // 입력 처리
  inputSystem.update();

  // 캐릭터 컨트롤러 업데이트 (입력 → 물리 힘)
  characterController.update(inputSystem.getState(), dt);

  // 물리 시뮬레이션 (고정 timestep)
  const alpha = world.update(dt);

  // 렌더링 (보간된 위치)
  renderer.render(alpha);

  requestAnimationFrame(gameLoop);
}
```

### 엔티티-물리 연결
```javascript
// 플레이어 생성
const catBody = world.createBody({
  type: 'dynamic',
  position: { x: 50, y: 400 },
  shape: new Capsule(12, 24),  // 고양이 충돌체
  material: 'RUBBER',          // 약간의 반발
  mass: 4,
});

// 플랫폼 생성
const platform = world.createBody({
  type: 'static',
  position: { x: 0, y: 520 },
  shape: new Polygon([0, 0, 800, 0, 800, 80, 0, 80]),
  material: 'CONCRETE',
});

// 파괴 가능 상자
const crate = world.createBody({
  type: 'dynamic',
  position: { x: 600, y: 480 },
  shape: new Polygon([0, 0, 40, 0, 40, 40, 0, 40]),
  material: 'WOOD',
  mass: 5,
  breakable: { threshold: 300, fragments: 4 },
});
```

## 캐릭터 상태 머신

물리 컨트롤러와 연동된 확장 상태 머신.

### 플레이어 상태
```
IDLE ──(이동 입력)──→ RUNNING
IDLE ──(점프 입력)──→ JUMPING
IDLE ──(지면 없음, 코요테 타임 내)──→ COYOTE (점프 가능)
RUNNING ──(점프 입력)──→ JUMPING
RUNNING ──(이동 해제)──→ IDLE
RUNNING ──(지면 없음)──→ FALLING
JUMPING ──(상승 속도 0)──→ FALLING
JUMPING ──(벽 접촉)──→ WALL_SLIDING
FALLING ──(지면 착지, 고속)──→ LANDING_SQUASH → IDLE
FALLING ──(지면 착지, 저속)──→ IDLE 또는 RUNNING
FALLING ──(벽 접촉)──→ WALL_SLIDING
WALL_SLIDING ──(점프 입력)──→ WALL_JUMPING
WALL_SLIDING ──(지면 착지)──→ IDLE
WALL_JUMPING ──(정점 도달)──→ FALLING
COYOTE ──(점프 입력)──→ JUMPING
COYOTE ──(타임아웃)──→ FALLING
ANY ──(피격)──→ HURT (넉백 임펄스 적용)
HURT ──(1.5초 후)──→ IDLE
ANY ──(체력 0)──→ DEAD (래그돌 효과)
```

### 적 AI 패턴
```
PATROL: 좌우 왕복 이동 (물리 기반 — 지면 감지 레이캐스트로 절벽 앞에서 반전)
CHASE: 플레이어 감지 시 추적 (감지 범위 200px, 물리 이동력 적용)
IDLE: 정지 상태, 일정 주기로 PATROL 전환
ATTACK: 플레이어 근접 시 공격 (임펄스 기반 넉백)
STUNNED: 피격 시 경직 (물리 속도 0으로 클램핑)
```

## 레벨 데이터 구조

물리 오브젝트와 환경 힘을 포함한 확장 레벨 JSON.

```json
{
  "id": "stage-1",
  "name": "골목길 모험",
  "width": 6400,
  "height": 600,
  "background": {
    "layers": [
      { "image": "bg-sky.svg", "speed": 0.1 },
      { "image": "bg-buildings-far.svg", "speed": 0.3 },
      { "image": "bg-buildings-mid.svg", "speed": 0.6 },
      { "image": "bg-buildings-near.svg", "speed": 0.8 }
    ]
  },
  "platforms": [
    { "x": 0, "y": 520, "width": 800, "height": 80, "type": "ground", "material": "CONCRETE" },
    { "x": 300, "y": 400, "width": 120, "height": 20, "type": "one-way", "material": "WOOD" },
    { "x": 900, "y": 350, "width": 100, "height": 20, "type": "moving",
      "material": "METAL",
      "path": [{"x": 900, "y": 350}, {"x": 900, "y": 200}],
      "speed": 60 }
  ],
  "physics_objects": [
    { "type": "crate", "x": 600, "y": 480, "material": "CARDBOARD",
      "breakable": { "threshold": 200, "fragments": 3 } },
    { "type": "trash_can", "x": 400, "y": 470, "material": "METAL", "mass": 8 },
    { "type": "clothesline", "x1": 200, "y1": 150, "x2": 500, "y2": 150,
      "constraint": "distance", "swingable": true }
  ],
  "forces": [
    { "type": "wind", "area": {"x": 1000, "y": 0, "width": 200, "height": 600},
      "direction": {"x": 100, "y": 0}, "turbulence": 0.3 }
  ],
  "enemies": [
    { "type": "dog", "x": 500, "y": 480, "patrol": { "min": 400, "max": 600 },
      "mass": 15, "knockback_impulse": 300 }
  ],
  "items": [
    { "type": "fish", "x": 350, "y": 370, "points": 100, "physics": false },
    { "type": "milk", "x": 700, "y": 300, "points": 50, "physics": true, "mass": 0.5 }
  ],
  "npcs": [
    { "type": "gray-cat", "x": 1200, "y": 480, "rescue_condition": "reach",
      "trapped_by": "crate_stack" }
  ],
  "goal": { "x": 6200, "y": 480 },
  "spawn": { "x": 50, "y": 400 }
}
```

## 게임 밸런스 파라미터

### 플레이어 스탯
```
체력: 5 (하트) — 물리 기반 넉백으로 인한 추가 위험 고려하여 3→5 증가
무적 시간: 1.5초 (피격 후)
넉백 임펄스: 300 (피격 시)
코요테 타임: 0.1초
점프 버퍼: 0.15초
```

### 점수 시스템
```
생선: 100점
우유: 50점
참치캔: 200점 (희귀)
동료 구출: 500점
상자 파괴: 25점
스테이지 클리어 보너스: 1000점
```

### 난이도 곡선
| 스테이지 | 적 수 | 물리 오브젝트 | 환경 힘 | 특수 메카닉 |
|---------|-------|-------------|--------|-----------|
| 1. 골목길 | 3 | 쓰레기통, 상자, 빨래줄 | 없음 | 튜토리얼 (기본 이동+점프) |
| 2. 공원 | 5 | 시소, 그네, 벤치 | 분수 부력 | 움직이는 플랫폼, 벽점프 |
| 3. 시장 | 7 | 상자 탑, 생선 물리, 차양 | 없음 | 파괴 가능 오브젝트, 연쇄 반응 |
| 4. 공사장 | 9 | 파이프, 크레인, 컨베이어 | 없음 | 컨베이어, 무너지는 플랫폼, 스프링 |
| 5. 옥상 | 5+보스 | 안테나, 물탱크 | 강풍 | 바람 저항, 보스 넉백전 |

## 스테이지별 물리 상호작용

### 1단계: 골목길
- 쓰레기통을 밀어서 넘어뜨려 적의 경로를 차단
- 빨래줄에 매달려 스윙 (DistanceJoint)
- 골판지 상자를 밟으면 찌그러짐 (breakable)

### 2단계: 공원
- 시소: 한쪽에 올라서면 반대편 아이템이 날아오름 (RevoluteJoint)
- 그네: 타이밍 맞춰 뛰어내려 높이 도달
- 분수 물줄기: 부력으로 위로 밀려남 (Buoyancy)

### 3단계: 시장
- 상자 탑: 밀어서 무너뜨리면 갇힌 고양이 구출
- 생선 물리: 생선이 물리적으로 튕기며 날아감
- 노점 차양: 위에서 뛰면 탄성으로 높이 점프 (SpringJoint)

### 4단계: 공사장
- 크레인: 매달린 짐이 진자 운동 (DistanceJoint + 중력)
- 파이프 롤링: 원형 충돌체가 경사면을 굴러감
- 컨베이어 벨트: 위에 서면 자동 이동 (마찰력 기반)
- 비계 무너짐: 시간 경과 후 제약 해제 → 낙하

### 5단계: 옥상
- 강풍: 주기적으로 방향/세기가 변하는 바람 (Wind force)
- 안테나 흔들림: 바람에 반응하는 스프링 (SpringJoint)
- 물탱크: 밀어서 구르게 하면 보스에게 피해
- 보스전: 넉백 임펄스 교환, 보스가 환경을 파괴하며 공격
