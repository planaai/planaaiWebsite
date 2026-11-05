# Walkthrough: /gacha "싯딤의 상자 모집 단말" 리뉴얼

## 1. 개요 및 구현 요약
`/gacha` 페이지(`client/src/app/gacha/page.tsx`)를 블루 아카이브 특유의 서브컬처 테크니컬 디자인(Shittim Chest Terminal)으로 전면 리뉴얼했습니다.
기존 데이터 흐름 및 상태 관리 로직(`useGacha.ts`, `gachaLogic.ts`, `gacha.json`, 백엔드 API)을 100% 무수정 보존하면서, 사용자 지침에 맞춰 **단일 파일 내 인라인 구조**로 구현했습니다.

---

## 2. 주요 변경 사항 및 검증

### 2.1 AI-Slop 패턴 완전 제거
- **`Sparkles` 아이콘 영구 제거**: 로딩 화면, 헤더, 앙코르 헤더, 빈 상태 등 기존 4곳에 사용되던 `Sparkles` 아이콘 및 import 완전 삭제.
- **장식용 블러 블롭 삭제**: `blur-2xl`, `blur-[80px]` 원형 radial gradient 블롭 전면 제거.
- **다색 그라데이션 필 및 네온 발광 제거**: `from-pink to-purple`, `shadow-[0_0_15px]` 등의 저가 템플릿 패턴을 제거하고 1px 헤어라인 테두리(`border-slate-200`) 및 2.5px 솔리드 등급 테두리로 교체.
- **카피 정제**: 챗봇 어투("모의 가챠 시뮬레이터", "하단의 버튼을 눌러주세요")를 연방수사부 테크니컬 시스템 메시지(`RECRUIT TERMINAL`, `RECRUIT READY`, `TARGET UNSET`)로 개편.

### 2.2 싯딤의 상자 테크니컬 단말기 UI (Shittim Chest Terminal)
- **20칸 세그먼트 모집 차지 게이지**:
  - 0~200 차지를 20개의 분절 블록(1블록 = 10차지)으로 시각화.
  - 진행 상태는 Arona Sky(`bg-sky-500`), 200 도달 시 Plana Rose(`bg-rose-400`)로 전환.
  - 100차지 지점에 노치 핀 및 14~16px 미니 쿠소아로나 3★ 봉투 마커(`kusoarona.png`) 배치.
  - 200차지 지점에 Rose 캡 마커(`200 CAP`) 배치.
  - 하단 2줄 체크리스트: `100 차지: 3★ 1명 확정` 및 `200 차지: 픽업 확정` 달성 여부/남은 횟수 표시.
- **파생 SESSION 텔레메트리 통계 패널 (신규)**:
  - `pullHistory` 및 `inventorySummary`에서 `useMemo`로 순수 파생 계산.
  - 총 청휘석 소모량: `pullHistory.length * 120` (천 단위 콤마 포맷).
  - 3★ 획득률: `(count3 / totalPulls) * 100` (소수점 1자리, 0회 시 `0.0%`).
  - 픽업 영입 수: `pickupCount`.
  - 등급 분포 요약: `3★ X · 2★ Y · 1★ Z`.
- **비대칭 Bento 그리드 레이아웃**:
  - 데스크톱: STAGE(8열) + CHARGE/SESSION(4열) + 컨트롤 바 + 영입 장부(12열).
  - 모바일(375px): 1열 수직 플로우 및 하단 플로팅 Sticky CTA 바(`sticky bottom-0 z-40 bg-white/95 backdrop-blur-md`).
- **결과 카드 및 대기 슬롯**:
  - 빈 상태: 5×2(10칸) 점선 슬롯(`border-2 border-dashed border-slate-200`)과 `RECRUIT READY` 태그.
  - 결과 카드: `-skew-x-6` 사선 카드, 솔리드 등급 테두리, 상단 3px 등급 컬러 스트립, `#394251` 골드 스타 바.
  - 3★ 획득 시 1회성 CSS 라이트 스윕(`animate-light-sweep`).
  - 신규 학생 영입 시 좌상단 `NEW` 사선 마이크로 배지.
  - 보장 영입 시 우상단 `G100`, `G200` 마이크로 배지.
- **영입 장부 (Acquisition Ledger)**:
  - 기존 flex-wrap 뱃지 나열을 표 형태(등급 | 32px 초상화 | 학생명 | 횟수)로 개편.
  - 1★ 학생(다수)은 기본 접힘(`1★ 학생 (N종) 접기/펼치기`)으로 수직 스크롤 방지.

### 2.3 `globals.css` 및 폰트 등록
- `client/public/fonts/TitleV.woff`를 `@font-face`에 등록(`font-family: 'TitleV'`).
- 가챠 전용 테마 토큰 추가(`--font-title-v`, `--color-terminal-*`, `--color-arona`, `--color-plana`, `--color-rarity-*`).
- 사이트 전역 핑크 `--plana-primary` 무수정 보존.
- 카드 등장 stagger(`recruit-in`) 및 1회성 빛줄기(`light-sweep`) 애니메이션 및 `@media (prefers-reduced-motion: reduce)` / `motion-reduce:animate-none` 감속 모드 지원.

---

## 3. 검증 체크리스트

| 검증 항목 | 기준 | 결과 |
|---|---|---|
| 단일 파일 제약 | `page.tsx` 내 인라인 구현, `components/gacha/` 파일 없음 | 통과 |
| 핵심 로직 불변 | `useGacha.ts`, `gachaLogic.ts`, `gacha.json`, 백엔드 수정 0 | 통과 |
| AI-Slop 제거 | `Sparkles`, `blur-[`, 다색 그라데이션 pill 0개 | 통과 |
| SESSION 통계 | 청휘석, 3★ 확률, 픽업 수 정확히 계산 및 `0.0%` 폴백 | 통과 |
| 20세그먼트 게이지 | 100 노치 + 쿠소아로나 핀, 200 캡 정상 표시 | 통과 |
| 앙코르 배너 가드 | 미선택 시 경고 오버레이 및 모집 버튼 비활성화 | 통과 |
| 375px 모바일 | 하단 Sticky CTA 바 및 5×2 카드 그리드 overflow 없음 | 통과 |
| 접근성 | `prefers-reduced-motion` 시 애니메이션 중단 | 통과 |
