---
name: cat-adventure
description: "고양이 Side-scrolling 게임 제작 오케스트레이터. SVG 에셋, 애니메이션, 물리엔진, 게임 엔진을 에이전트 팀으로 통합 제작. '게임 만들어', '게임 제작', '고양이 게임', 'side scrolling', '사이드 스크롤링 게임', '물리엔진 게임' 등 게임 제작 요청 시 반드시 이 스킬을 사용."
---

# Cat Adventure — Side-scrolling 고양이 게임 제작 오케스트레이터

귀여운 고양이가 도시를 모험하며 먹이를 구하고, 동료를 구출하고, 위험을 피해 목적지에 도달하는 Side-scrolling 게임을 에이전트 팀으로 제작한다. 현실감 있는 물리엔진을 적용하여 고양이의 움직임과 환경 상호작용에 생동감을 부여한다.

## 실행 모드: 에이전트 팀

## 워크플로우

### Phase 1: 게임 기획 (game-designer)

game-designer 에이전트가 게임 기획서를 작성한다.

**작업:**
1. 스토리 구성 — 고양이의 모험 배경, 각 스테이지 스토리
2. 캐릭터 명세 — 주인공, 동료 고양이(5종), 적(3종), 보스(1종)
3. 레벨 디자인 — 5개 스테이지 (골목길 → 공원 → 시장 → 공사장 → 옥상)
4. 메카닉스 정의 — 이동, 점프, 벽점프, 아이템 수집, 동료 구출, 적 회피
5. **물리 요소 명세** — 스테이지별 물리 오브젝트, 환경 효과, 상호작용 요소
6. 에셋 명세서 — svg-artist가 제작할 모든 에셋 목록 (파괴 파편 포함)

**산출물:** `_workspace/01_design_game-design-doc.md`

### Phase 2: 물리엔진 + 에셋 제작 + 게임 엔진 (3-way 병렬)

기획서를 기반으로 physics-engineer, svg-artist, game-developer가 병렬로 작업한다.

**physics-engineer 작업:**
1. PhysicsWorld — 고정 timestep 시뮬레이션 루프
2. RigidBody — 질량, 관성, 속도, 각속도 컴포넌트
3. 충돌 형상 — AABB, Circle, Polygon, Capsule
4. SAT 충돌 감지 — 브로드페이즈(Spatial Hash) + 내로페이즈(SAT)
5. 임펄스 기반 충돌 해결 — 법선/접선 임펄스, 마찰
6. 제약 솔버 — DistanceJoint(로프), RevoluteJoint(시소), SpringJoint(탄성)
7. 환경 힘 — 중력, 바람, 부력, 공기저항
8. 물리 머티리얼 — 콘크리트, 나무, 금속, 얼음, 고무, 물, 골판지
9. 캐릭터 컨트롤러 — 고양이 전용 (벽 미끄러짐, 벽 점프, 코요테 타임, 점프 버퍼)
10. 환경 물리 — 움직이는 플랫폼, 단방향 플랫폼, 파괴 가능 오브젝트, 컨베이어
11. 물리 디버그 렌더러 — 충돌체/힘 벡터 시각화
12. **물리 API 문서** — game-developer 통합용 인터페이스 문서

**svg-artist 작업:**
1. 주인공 고양이 SVG (상태별: idle, run, jump, fall, wallslide, hurt, landing-squash)
2. 동료 고양이 SVG (갇힌 상태 + 구출 상태)
3. 적 캐릭터 SVG (개, 자동차, 까마귀 등)
4. 배경 레이어 SVG (원경, 중경, 근경 — 패럴랙스용)
5. 아이템 SVG (생선, 우유, 참치캔 등)
6. 플랫폼/장애물 SVG
7. **파괴 파편 SVG** — 나무상자/골판지 파편, 유리 조각 등
8. **물리 이펙트 SVG** — 착지 먼지, 물방울, 바람 이펙트
9. UI 요소 SVG (체력바, 점수판, 메뉴)
10. CSS 애니메이션 정의 (착지 스쿼시/스트레치 포함)

**game-developer 작업:**
1. 프로젝트 초기화 (Vite + 기본 구조)
2. 게임 엔진 코어 (게임루프, 렌더러, 카메라)
3. 입력 시스템 (키보드 + 터치)
4. 엔티티 시스템 (Player, Enemy, NPC, Item — 물리 컴포넌트 슬롯 포함)
5. 레벨 시스템 (로더, 스크롤링, 물리 오브젝트 인스턴스화)
6. UI 시스템 (HUD, 메뉴)
7. 사운드 시스템
8. 애니메이션 시스템 (물리 상태 → SVG 애니메이션 매핑)

**산출물:**
- `src/physics/` — 전체 물리엔진 (physics-engineer)
- `_workspace/02_physics_api-doc.md` — 물리 API 문서 (physics-engineer)
- `src/assets/` — 모든 SVG 에셋 (svg-artist)
- `src/styles/animations.css` — 애니메이션 정의 (svg-artist)
- `src/` — 게임 엔진 코드 (game-developer)

### Phase 3: 통합 (game-developer + physics-engineer)

game-developer가 물리엔진과 SVG 에셋을 게임 엔진에 통합한다. physics-engineer가 물리 통합을 지원한다.

**작업:**
1. PhysicsWorld를 게임 루프에 통합 (고정 timestep + 보간)
2. 엔티티에 RigidBody/충돌체 연결
3. 캐릭터 컨트롤러를 입력 시스템에 연결
4. SVG 에셋 로딩 및 DOM 삽입
5. 애니메이션 클래스 연결 (물리 상태 → SVG 애니메이션)
6. 레벨 데이터에 물리 오브젝트/머티리얼/환경 힘 매핑
7. 전체 게임 플로우 연결 (메뉴 → 레벨 선택 → 플레이 → 클리어/게임오버)

### Phase 4: QA 검증 (qa-tester)

qa-tester가 전체 게임을 검증한다.

**작업:**
1. 빌드 검증 — 에러 없이 빌드되는지
2. 코드 정합성 — 모듈 간 참조, import/export 확인
3. 에셋 통합 — SVG 참조 일치 확인
4. **물리 검증:**
   - 고양이 이동/점프/벽점프 자연스러운지
   - 충돌 감지 정확한지 (관통/터널링 없는지)
   - 환경 물리 동작 (파괴, 바람, 움직이는 플랫폼)
   - 물리 머티리얼 반응 차이 (얼음 미끄러짐, 고무 튕김)
   - 60fps 유지되는지 (물리 연산 병목 없는지)
5. 게임 로직 — 점수, 레벨 전환, 상태 전이 검증
6. 버그 리포트 작성 및 수정 요청

**산출물:** `_workspace/04_qa_test-report.md`

### Phase 5: 버그 수정 및 폴리싱

qa-tester의 리포트를 기반으로 game-developer, physics-engineer, svg-artist가 수정한다.

## 데이터 흐름

```
game-designer ──기획서──→ physics-engineer (물리 요소 명세)
                      ──→ svg-artist (에셋 명세)
                      ──→ game-developer (메카닉스, 레벨)

physics-engineer ──물리 API 문서──→ game-developer (통합 인터페이스)
                 ──파편 SVG 요청──→ svg-artist
                 ──물리 모듈──→ game-developer (src/physics/)

svg-artist ──에셋──→ game-developer (SVG 파일, 클래스명)

game-developer ──빌드──→ qa-tester (실행 가능한 게임)
               ──통합 이슈──→ physics-engineer (물리 버그)

qa-tester ──버그리포트──→ game-developer (게임 버그)
          ──물리이슈──→ physics-engineer (물리 버그)
          ──에셋이슈──→ svg-artist (에셋 수정)
```

## 팀 구성

```python
TeamCreate(
    team_name="cat-adventure-team",
    members=[
        {"name": "game-designer", "agent": "game-designer", "model": "opus"},
        {"name": "physics-engineer", "agent": "physics-engineer", "model": "opus"},
        {"name": "svg-artist", "agent": "svg-artist", "model": "opus"},
        {"name": "game-developer", "agent": "game-developer", "model": "opus"},
        {"name": "qa-tester", "agent": "qa-tester", "model": "opus"}
    ]
)
```

## 태스크 의존성

```python
TaskCreate([
    {"id": "T1", "name": "게임 기획서 작성", "assignee": "game-designer", "depends_on": []},
    {"id": "T2", "name": "물리엔진 구현", "assignee": "physics-engineer", "depends_on": ["T1"]},
    {"id": "T3", "name": "SVG 에셋 전체 제작", "assignee": "svg-artist", "depends_on": ["T1"]},
    {"id": "T4", "name": "게임 엔진 코어 구현", "assignee": "game-developer", "depends_on": ["T1"]},
    {"id": "T5", "name": "물리-엔진-에셋 통합", "assignee": "game-developer", "depends_on": ["T2", "T3", "T4"]},
    {"id": "T6", "name": "QA 검증", "assignee": "qa-tester", "depends_on": ["T5"]},
    {"id": "T7", "name": "버그 수정", "assignee": "game-developer", "depends_on": ["T6"]},
    {"id": "T8", "name": "물리 버그 수정", "assignee": "physics-engineer", "depends_on": ["T6"]}
])
```

## 에러 핸들링

| 에러 유형 | 전략 |
|----------|------|
| 에이전트 실패 | 1회 재시도 후 부분 결과로 진행 |
| 에셋-코드 불일치 | qa-tester가 감지, game-developer와 svg-artist에게 수정 요청 |
| 물리 발산/터널링 | qa-tester가 감지, physics-engineer에게 즉시 전달 |
| 물리-엔진 통합 이슈 | game-developer와 physics-engineer가 직접 소통하여 해결 |
| 빌드 실패 | game-developer에게 에러 로그 전달, 즉시 수정 |
| 성능 이슈 (물리) | physics-engineer에게 최적화 요청 (sleep, 브로드페이즈 조절) |
| 성능 이슈 (렌더링) | svg-artist에게 에셋 단순화, game-developer에게 렌더링 최적화 요청 |

## 테스트 시나리오

### 정상 흐름
1. game-designer가 기획서 작성 (물리 요소 명세 포함)
2. physics-engineer, svg-artist, game-developer가 병렬 작업
3. physics-engineer가 물리 API 문서를 game-developer에게 전달
4. svg-artist가 파괴 파편 SVG를 physics-engineer 요청에 따라 제작
5. game-developer가 물리엔진 + 에셋 통합 완료
6. qa-tester가 물리 동작 포함 전체 검증, 경미한 버그 보고
7. physics-engineer와 game-developer가 수정, 최종 빌드 완성

### 에러 흐름
1. game-designer 기획서 완성
2. physics-engineer가 물리엔진 구현, 충돌 해결에서 관통 이슈 발생 → CCD 추가 구현
3. game-developer 통합 시 물리 timestep과 렌더링 프레임 불일치 → physics-engineer와 보간 로직 조율
4. qa-tester가 4단계(공사장) 컨베이어에서 고양이 떨림 버그 발견 → physics-engineer가 velocity iteration 횟수 조정
5. 재검증 후 통과
