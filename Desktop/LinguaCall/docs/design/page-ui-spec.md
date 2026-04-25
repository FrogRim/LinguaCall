# LinguaCall page-ui-spec.md

## 목적

이 문서는 LinguCall의 주요 페이지에 대한 실제 UI 구현 기준 문서다.
PRD의 screen description을 프론트엔드 작업 단위에 맞게 다시 정리한 문서이며, Codex가 컴포넌트 구조, 상태, 인터랙션, 우선순위를 이해하도록 돕는다.

이 문서는 scope-locked PRD와 함께 읽는다.

---

## 1. 공통 원칙

### 1.1 화면 공통 우선순위

모든 페이지는 다음 우선순위를 따른다.

1. 핵심 행동이 가장 먼저 보여야 한다.
2. 상태가 명확해야 한다.
3. 읽는 화면은 오래 봐도 피곤하지 않아야 한다.
4. 에러와 제한은 숨기지 않는다.
5. Phase 1에서는 분석보다 행동 중심 UI를 우선한다.

### 1.2 전역 레이아웃

권장 app shell 구조:

- top nav 또는 compact header
- main content container
- mobile first
- centered width
- desktop에서 과도한 다열 금지

### 1.3 전역 컴포넌트 세트

공통 컴포넌트 권장 목록:

- AppHeader
- PageTitle
- PrimaryButton
- SecondaryButton
- StatusBadge
- SummaryCard
- ScheduledCallCard
- ReportCard
- CorrectionCard
- EmptyState
- InlineMessage
- FieldGroup
- SegmentedControl
- DurationSelector
- TopicCardGroup
- TranscriptBlock
- MetricRow

---

## 2. Screen 1, 온보딩 / 로그인

### 목적

- 처음 보는 사용자에게 바로 신뢰감을 준다
- 가입 흐름을 짧게 만든다
- 전화 학습 제품이라는 메시지를 너무 길지 않게 전달한다

### 핵심 컴포넌트

- LogoBlock
- HeroText
- SocialLoginButtons
- ExistingAccountLink

### 필수 요소

- 카카오로 시작하기
- 구글로 시작하기
- 기존 사용자 로그인 링크
- 짧은 제품 가치 문장

### 추천 레이아웃

- centered hero
- 상단 여백 충분히 확보
- 버튼은 세로 스택 우선
- 모바일에서 hero copy는 2~3줄 내 유지

### 상태

- default
- loading
- error toast

### 금지

- 장문의 설명 문단
- 복잡한 social proof wall
- 많은 secondary CTA

---

## 3. Screen 2, 전화번호 등록 / OTP 인증

### 목적

- 전화 수신 가능한 사용자임을 빠르게 확인
- 인증 과정을 명확하게 안내

### 핵심 컴포넌트

- CountryCodeSelect
- PhoneNumberInput
- SendOtpButton
- OtpInput
- CountdownText
- RetryButton
- VerificationSubmitButton

### 필수 규칙

- 국가코드와 전화번호를 한 그룹처럼 보이게 배치
- OTP 발송 전에는 OTP input 숨김
- 발송 후 카운트다운 노출
- 에러는 input 아래 inline + toast 병행 가능

### 상태

- phone_input
- otp_sent
- verifying
- verified
- error

### 에러 예시

- 잘못된 번호 형식
- OTP 만료
- 3회 실패
- 재발송 제한

---

## 4. Screen 3, 세션 설정

### 목적

- 사용자가 한 번에 설정을 이해하고 행동할 수 있게 한다
- 예약 폼처럼 느껴져야 한다
- Phase 1에서는 scope 밖 기능이 보이면 안 된다

### 핵심 컴포넌트

- LanguageSelector
- ExamSelector
- LevelSelector
- TopicRecommendationGrid
- TopicManualInput
- DurationSelector
- ContactModeSegment
- ScheduledDateTimePicker
- ConfigSummaryBox
- PrimaryCTA

### Phase 1 고정 규칙

- 언어는 EN만 보인다
- 시험은 OPIC만 보인다
- Free, trial 사용자는 10분만 선택 가능
- 15분 옵션은 paid plan에서만 보인다
- contact mode는 immediate 또는 scheduled_once
- scheduled_once는 현재 시각 + 15분 이후, 7일 이내만 허용

### 추천 정보 구조 순서

1. 언어
2. 시험
3. 레벨
4. 주제
5. 통화 시간
6. 연락 방식
7. 예약 시간
8. 설정 요약
9. CTA

### CTA 규칙

- immediate 선택 시 `지금 전화받기`
- scheduled_once 선택 시 `이 시간으로 저장`

### 상태

- default
- validation_error
- submitting
- saved

### 유효성 메시지 예시

- free plan에서는 10분만 선택할 수 있습니다
- 예약 통화는 최소 15분 이후부터 가능합니다
- 예약은 7일 이내만 가능합니다

---

## 5. Screen 4, 홈 대시보드, Phase 1

### 목적

- 행동을 다시 시작하게 한다
- 예약된 통화를 바로 확인하게 한다
- 최근 리포트 복습을 돕는다

### 핵심 컴포넌트

- GreetingCard
- AllowanceSummaryCard
- QuickStartButton
- LastConfigQuickStartButton
- ScheduledCallCard
- RecentReportList
- UsageSummaryBlock
- EmptyState

### 정보 우선순위

1. 남은 체험 횟수 또는 분수
2. 새 연습 시작
3. upcoming scheduled_once 카드
4. 최근 리포트 3개
5. 누적 연습 시간
6. 최근 세션 대비 텍스트 델타

### Phase 1 금지 사항

- line chart
- radar chart
- streak heatmap
- 복잡한 productivity dashboard

### Empty State

- 첫 세션 전
- 예약 없음
- 리포트 없음

### Scheduled Call Card 필수 내용

- 예정 시각
- EN / OPIC / IM2 / 10분 등 설정 요약
- 수정 버튼
- 취소 버튼
- reminder 문구는 짧게

---

## 6. Screen 5, 통화 중 화면

### 목적

- 사용자가 긴장하지 않게 한다
- 필요한 정보만 보여준다
- AI voice experience를 부드럽게 느끼게 한다

### 핵심 컴포넌트

- AiPersonaHeader
- CallStatusIndicator
- CallTimer
- TargetDurationProgress
- RealTimeTranscriptPanel
- EndCallButton
- AudioStatusHint

### 정보 우선순위

1. 현재 연결 상태
2. 경과 시간
3. transcript
4. 종료 버튼

### 상태

- connecting
- ringing
- active
- ending
- report_generating

### 인터랙션 규칙

- transcript는 line-by-line 안정적으로 추가
- 사용자가 종료를 누르면 즉시 feedback 제공
- active 상태는 subtle pulse 허용
- 과도한 animation 금지

### 디자인 메모

- 이 화면만 약간 더 atmospheric tone 허용
- 하지만 functional clarity가 항상 우선

---

## 7. Screen 6, 리포트 상세

### 목적

- 사용자가 바로 복습할 수 있어야 한다
- 점수보다 교정과 transcript를 쉽게 읽게 해야 한다
- 공부 노트처럼 느껴져야 한다

### 핵심 컴포넌트

- ReportSummaryCard
- ScoreBreakdownBlock
- CorrectionList
- TranscriptSection
- RecommendationList
- ReportMetaHeader
- PdfActionButton, Phase 2a only

### 추천 정보 구조 순서

1. 세션 메타, 날짜, 길이, 토픽
2. 종합 점수
3. 항목별 점수
4. 주요 교정
5. transcript
6. 추천 표현
7. 과거 리포트 이동

### correction card 필수 필드

- original
- corrected
- explanation
- timestamp, optional deep-link

### transcript 표현 방식

- AI와 user를 구분하되 과한 chat bubble 금지
- 문서처럼 읽히는 block style 권장
- timestamp는 secondary 정보로 표현

### 상태

- loading
- ready
- report_pending
- error

---

## 8. Screen 7, 반복 예약, Phase 2b

### 목적

- recurring logic을 안전하고 명확하게 보여준다
- timezone 혼란을 막는다

### 핵심 컴포넌트

- WeekdaySelector
- LocalTimePicker
- TimezoneLabel
- SessionConfigPreview
- ReminderToggle
- SaveButton
- PauseResumeButton
- DeleteButton
- NextRunPreview

### 필수 규칙

- next_run preview를 반드시 보여준다
- weekday selection은 compact chip UI 권장
- recurring은 scheduled_once와 다른 엔터티로 보이게 해야 한다

---

## 9. Screen 8, 플랜 / 결제, Phase 2a

### 목적

- 가격과 포함 항목을 쉽게 비교하게 한다
- 업그레이드 결정을 쉽게 한다
- 신뢰감을 준다

### 핵심 컴포넌트

- PricingHeader
- PlanCardGrid
- RecommendedPlanBadge
- IncludedMinutesRow
- EntitlementList
- CheckoutButton
- BillingPolicyNote

### 필수 규칙

- recommended plan은 하나만 강하게 강조
- included minutes는 큰 숫자로 보여줌
- entitlements는 bullet 대신 compact list나 chip으로 스캔 가능하게
- manipulative urgency 문구 금지

### 상태

- loading
- ready
- checkout_redirecting
- provider_error

---

## 10. 공통 에러 / 제한 상태 UI

### 에러 메시지 원칙

- 기술적 디테일을 과하게 노출하지 않는다
- 사용자가 다음 행동을 알 수 있어야 한다
- destructive tone 금지

### 예시

- 지금은 전화를 연결할 수 없습니다. 잠시 후 다시 시도해주세요.
- 예약은 최소 15분 이후부터 가능합니다.
- free 체험은 10분만 선택할 수 있습니다.
- 이미 예약된 통화가 있습니다.

### conflict 상태

409 conflict가 오면, 화면은 기존 예약 정보를 카드 형태로 바로 보여주는 것이 좋다.

---

## 11. 상태별 표시 규칙

### Session Status UI Mapping

- ready: neutral action state
- scheduled: info badge + scheduled card
- dialing: pending indicator
- ringing: pending indicator
- in_progress: active call indicator
- report_pending: warm pending state
- report_ready: success state
- no_answer: muted warning state
- provider_error: stronger warning or danger state

### failure_reason 노출 규칙

- 일반 사용자에게는 raw failure_reason를 직접 노출하지 않는다
- support/debug log에서는 저장한다

---

## 12. 추천 파일 매핑

이 문서를 기준으로 프론트엔드를 나누면 좋다.

예시:

- `apps/web/src/features/auth/`
- `apps/web/src/features/verification/`
- `apps/web/src/features/session-config/`
- `apps/web/src/features/home/`
- `apps/web/src/features/call/`
- `apps/web/src/features/report/`
- `apps/web/src/features/billing/`
- `apps/web/src/features/recurring-schedule/`

공통 컴포넌트:

- `apps/web/src/components/ui/`
- `apps/web/src/components/domain/`

---

## 13. Codex용 구현 우선순위

Phase 1에서 먼저 구현할 화면 우선순위:

1. Screen 1
2. Screen 2
3. Screen 3
4. Screen 4
5. Screen 5
6. Screen 6

Phase 2a:
- Screen 8
- charts 추가된 home/report 확장

Phase 2b:
- Screen 7

Codex는 항상 다음 순서로 판단한다.

- 먼저 PRD 상태와 feature flag 확인
- 다음 `DESIGN.md`로 전체 스타일 확인
- 다음 `design-tokens.md`로 시각 토큰 반영
- 마지막으로 이 문서로 페이지별 구조 구현
