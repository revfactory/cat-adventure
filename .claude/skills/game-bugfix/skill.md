---
name: game-bugfix
description: "Side-scrolling 게임의 물리/게임플레이 버그를 진단하고 수정하는 오케스트레이터. 순간이동, 떨림, 관통, 부자연스러운 움직임, 점프 이상, 충돌 오류 등 게임 버그 수정 요청 시 반드시 이 스킬을 사용. '버그 수정', '버그 고쳐', '이상해', '순간이동', '텔레포트', '떨림', '자연스럽지 않다', '움직임 이상' 등 게임 동작 이상 보고 시 트리거."
---

# Game Bugfix — 게임 버그 수정 오케스트레이터

Side-scrolling 게임의 물리/게임플레이 버그를 진단 → 수정 → 검증하는 파이프라인을 실행한다.

## 실행 모드: 서브 에이전트 (파이프라인 패턴)

```
[오케스트레이터]
    ├── Phase 1: physics-debugger (진단)
    │     └── 산출물: _workspace/bugfix_diagnosis.md
    ├── Phase 2: physics-engineer (수정)
    │     └── 산출물: 코드 변경 + _workspace/bugfix_changes.md
    └── Phase 3: qa-tester (검증)
          └── 산출물: _workspace/bugfix_verification.md
```

## 워크플로우

### Phase 1: 버그 진단 (physics-debugger)

physics-debugger 에이전트에게 버그 증상을 전달한다. 에이전트 정의 파일(`.claude/agents/physics-debugger.md`)을 읽고 역할을 수행하라고 지시한다.

**프롬프트 템플릿:**
```
당신은 physics-debugger입니다. .claude/agents/physics-debugger.md를 읽고 역할을 따르라.

## 버그 보고
{사용자가 보고한 증상}

## 프로젝트 경로
/Users/robin/Downloads/Side-scrolling

## 핵심 파일
- src/physics/character/CharacterController.js
- src/physics/character/GroundCheck.js
- src/physics/character/CoyoteTime.js
- src/physics/RigidBody.js
- src/physics/PhysicsWorld.js
- src/entities/Player.js
- src/main.js (특히 _syncPhysicsToEntities, onPreStep)

## 작업
1. 위 파일들을 모두 읽어라
2. 물리 파이프라인을 따라가며 버그 원인을 진단하라
3. 진단 결과를 _workspace/bugfix_diagnosis.md에 저장하라
```

### Phase 2: 버그 수정 (physics-engineer)

진단 보고서를 기반으로 physics-engineer가 코드를 수정한다.

**프롬프트 템플릿:**
```
당신은 physics-engineer입니다. .claude/agents/physics-engineer.md를 읽고 역할을 따르라.

## 버그 진단 보고서
{_workspace/bugfix_diagnosis.md 내용}

## 작업
1. 진단 보고서의 수정안을 구현하라
2. 최소 변경 원칙을 따르라 — 버그 수정에 필요한 코드만 변경
3. 변경 사항을 _workspace/bugfix_changes.md에 기록하라
   - 변경한 파일과 줄 번호
   - 변경 전/후 코드
   - 변경 이유
```

### Phase 3: 검증 (qa-tester)

수정된 코드를 qa-tester가 검증한다.

**프롬프트 템플릿:**
```
당신은 qa-tester입니다. .claude/agents/qa-tester.md를 읽고 역할을 따르라.

## 원본 버그
{사용자가 보고한 증상}

## 수정 내역
{_workspace/bugfix_changes.md 내용}

## 작업
1. 수정된 코드를 읽고 논리적으로 검증하라
2. 수정이 원본 버그를 해결하는지 확인
3. 수정이 다른 기능에 부작용을 일으키지 않는지 확인
4. npm run build로 빌드 검증
5. 결과를 _workspace/bugfix_verification.md에 기록하라
```

## 데이터 전달: 파일 기반

| Phase | 입력 | 출력 |
|-------|------|------|
| 1. 진단 | 사용자 버그 보고 + 소스 코드 | `_workspace/bugfix_diagnosis.md` |
| 2. 수정 | 진단 보고서 | 코드 변경 + `_workspace/bugfix_changes.md` |
| 3. 검증 | 버그 보고 + 변경 내역 | `_workspace/bugfix_verification.md` |

## 에러 핸들링

| 에러 유형 | 전략 |
|----------|------|
| 진단 불완전 | physics-debugger에게 추가 파일 탐색 지시 후 재시도 |
| 수정 후 빌드 실패 | physics-engineer에게 에러 로그 전달, 수정 재시도 |
| QA 검증 실패 | 진단 보고서 보완 → Phase 2 재실행 (최대 1회) |
| 수정이 다른 기능 깨뜨림 | 수정 롤백 후 대안 수정안으로 재시도 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "연속 점프 시 순간이동 발생"
2. physics-debugger: 코드 추적 → GroundCheck 레이 길이/적분 순서 문제 진단
3. physics-engineer: GroundCheck 수정 + CharacterController 안전장치 추가
4. qa-tester: 빌드 성공, 로직 검증 통과 → 수정 완료

### 에러 흐름
1. 사용자: "벽 점프 시 벽을 관통함"
2. physics-debugger: WallSlide + NarrowPhase 분석 → 원인 불명확
3. 오케스트레이터: 추가 파일(CollisionResolver.js) 읽기 지시
4. physics-debugger: CollisionResolver의 관통 보정 로직 문제 식별
5. physics-engineer: 보정 로직 수정
6. qa-tester: 검증 통과
