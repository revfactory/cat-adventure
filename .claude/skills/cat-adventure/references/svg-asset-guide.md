# SVG 에셋 제작 가이드

## 목차
1. [색상 팔레트](#색상-팔레트)
2. [캐릭터 디자인 가이드](#캐릭터-디자인-가이드)
3. [배경 제작 가이드](#배경-제작-가이드)
4. [애니메이션 패턴](#애니메이션-패턴)
5. [SVG 최적화 규칙](#svg-최적화-규칙)

## 색상 팔레트

### 주인공 고양이 (오렌지 탭비)
```
주 색상: #FF8C42 (오렌지)
줄무늬: #E06B1F (다크 오렌지)
배: #FFF5E6 (크림)
눈: #4ECDC4 (민트) + #2C3E50 (동공)
코: #FF6B9D (핑크)
```

### 동료 고양이들
```
회색 고양이: #95A5A6, #7F8C8D
검은 고양이: #2C3E50, #1A252F
하얀 고양이: #ECF0F1, #BDC3C7
삼색 고양이: #FF8C42, #2C3E50, #ECF0F1
샴 고양이: #F5E6CC, #8B7355
```

### 환경
```
하늘: #87CEEB → #2C3E50 (그라데이션, 시간대별)
건물: #7F8C8D, #95A5A6, #BDC3C7
풀/나무: #27AE60, #2ECC71
도로: #5D6D7E, #ABB2B9
```

### UI
```
체력바: #E74C3C (빨강) → #2ECC71 (초록)
점수: #F1C40F (골드)
위험: #E74C3C
안전: #2ECC71
```

## 캐릭터 디자인 가이드

### 주인공 고양이 비율
```
머리: 전체 높이의 40%
몸통: 전체 높이의 35%
다리: 전체 높이의 25%
눈: 머리의 30% (큰 눈이 귀여움의 핵심)
귀: 삼각형, 머리 상단에 위치
꼬리: 몸통 길이의 80%
```

### 상태별 SVG 변형
```
idle: 기본 자세, 꼬리 살랑살랑
run: 다리 교차, 몸 약간 앞으로 기울임
jump: 앞다리 위로, 뒷다리 아래로, 꼬리 위로
fall: 네 다리 벌림, 꼬리 위로 (고양이 낙하 자세)
hurt: 눈 X자, 몸 떨림
happy: 눈 반달형 (^_^), 꼬리 하트 모양
```

### 적 캐릭터
```
불독: 무섭지만 약간 코믹하게, 침 흘리는 모습
자동차: 단순화된 형태, 헤드라이트가 눈처럼
까마귀: 날카로운 부리, 번뜩이는 눈
```

## 배경 제작 가이드

### 패럴랙스 레이어 구조
```
Layer 0 (최원경): 하늘 + 구름 — 스크롤 속도 0.1x
Layer 1 (원경): 먼 건물 실루엣 — 스크롤 속도 0.3x
Layer 2 (중경): 중간 건물, 나무 — 스크롤 속도 0.6x
Layer 3 (근경): 앞쪽 건물, 가로등 — 스크롤 속도 0.8x
Layer 4 (지면): 플랫폼, 도로 — 스크롤 속도 1.0x
```

### 스테이지별 배경 테마
```
1. 골목길: 좁은 골목, 쓰레기통, 빨래줄, 계단
2. 공원: 나무, 벤치, 분수, 놀이터
3. 시장: 노점상, 생선가게, 차양, 상자
4. 공사장: 크레인, 파이프, 비계, 경고 표지판
5. 옥상: 옥상 정원, 물탱크, 안테나, 석양 배경
```

## 애니메이션 패턴

### 걷기 애니메이션 (CSS)
```css
@keyframes cat-run {
  0% { transform: translateY(0); }
  25% { transform: translateY(-2px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-1px); }
  100% { transform: translateY(0); }
}

.cat-running {
  animation: cat-run 0.3s steps(4) infinite;
}
```

### 호흡 애니메이션 (idle)
```css
@keyframes cat-breathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.03); }
}

.cat-idle {
  animation: cat-breathe 2s ease-in-out infinite;
}
```

### 꼬리 흔들기
```css
@keyframes tail-wag {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}

.cat-tail {
  transform-origin: bottom left;
  animation: tail-wag 1s ease-in-out infinite;
}
```

### 아이템 반짝임
```css
@keyframes item-sparkle {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.8; filter: brightness(1.5); }
}

.collectible {
  animation: item-sparkle 1.5s ease-in-out infinite;
}
```

### 적 패트롤
```css
@keyframes patrol {
  0%, 100% { transform: scaleX(1); }
  49% { transform: scaleX(1); }
  50% { transform: scaleX(-1); }
  99% { transform: scaleX(-1); }
}
```

## SVG 최적화 규칙

1. **`<defs>` 재사용** — 반복되는 그라데이션, 패턴, 클립패스는 `<defs>`에 정의
2. **패스 단순화** — 불필요한 앵커 포인트 제거, 곡선은 최소 제어점 사용
3. **그룹 활용** — 관련 요소를 `<g>`로 묶어 일괄 변환 가능하게
4. **ID 네이밍** — `cat-body`, `cat-eye-left` 등 의미 있는 ID 부여 (JS 조작용)
5. **viewBox 일관성** — 같은 카테고리의 에셋은 동일한 viewBox 사용
6. **소수점 제한** — 좌표값은 소수점 1자리까지만 (파일 크기 절감)
