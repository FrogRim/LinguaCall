# LinguaCall — Product Requirements Document

**MVP v3.1 — Scope Locked**

> Version: 3.1  
> Date: 2026-03-13  
> Status: Scope Locked for Engineering  
> Author: LinguaCall Team  
> Architecture Reference: `LinguaCall_Architecture_v3.docx`
>
> **Changelog from v3.0 → v3.1**
> - [🔴 FIX] Free/trial 10분 제한 명시 잠금
> - [🔴 FIX] `scheduled_once` 최소 예약 리드타임 15분 규칙 추가
> - [🔴 FIX] Twilio outbound call 생성 시 `StatusCallbackEvent` 명시
> - [🔴 FIX] Twilio status callback dedupe key를 `CallSid + SequenceNumber` 기준으로 변경
> - [🔴 FIX] `status` vs `failure_reason` 역할 분리
> - [🔴 FIX] platform fault 판정에서 `EndedReason` 의존 제거
> - [🔴 FIX] `credit_ledger`를 immutable event log 기준으로 재정의
> - [🟡 FIX] scheduled session 수정 시 `reminder_at_utc` 재계산 및 `reminder_sent=false` reset 명시
> - [🟡 FIX] dispatch/reminder worker atomic claim 규칙 추가
> - [🟡 FIX] `GET /plans` 예시값을 실제 placeholder 형태로 교체
> - [🟡 FIX] `grammar_corrections.timestamp_seconds`를 `timestamp_ms_from_call_start`로 통일
> - [🟡 FIX] Phase 1 사용자 가시 duration scope를 10분으로 잠금
> - [🟡 FIX] internal allowance ledger와 paid minute/billing 기능을 분리 서술

---

## Table of Contents

1. Product Overview
2. Goals & Success Metrics
3. User Personas
4. User Stories & Acceptance Criteria
5. Feature Scope — Phase 1 / Phase 2a / Phase 2b
6. Wireframe Descriptions
7. API Spec
8. Agent System Design
9. Data Model
10. Cost Model & Pricing Principles
11. Non-Functional Requirements
12. Out of Scope
13. Open Questions

---

## 1. Product Overview

### 1.1 Problem Statement

| # | Problem | Current Workaround | Pain Level |
|---|---|---|---|
| 1 | 전화 영어 과외는 비싸고 시간 맞추기 어렵다 | 텍스트 채팅 앱, 유튜브 강의 | High |
| 2 | 연습 직후 즉각적인 교정 피드백이 없다 | 튜터 코멘트 대기, 수동 복기 | High |
| 3 | OPIC/JLPT/HSK 등 시험 특화 전화 연습이 부족하다 | 일반 회화 앱, 문제집 독학 | Medium |
| 4 | 누적 이력 기반 개인화가 약하다 | 수동 노트 정리 | Medium |

### 1.2 Product Vision

LinguaCall은 사용자가 앱에서 목표 언어·시험·레벨·주제·연락 시각을 설정하면, AI가 실제 전화로 연락하여 실전형 회화를 진행하고, 통화 종료 후 60초 이내에 앱 내 상세 리포트와 카카오 알림톡 요약을 제공하는 전화 중심 AI 언어 학습 서비스다.

### 1.3 MVP Scope Summary

**Phase 1 (Week 1~4)**  
EN only / OPIC only / immediate outbound call + one-time scheduled callback / 앱 내 HTML 리포트 / 카카오 알림톡 요약 / 클로즈드 베타 50명 / **사용자 가시 세션 길이 10분 고정**

**Phase 2a (Week 5~6)**  
결제 / 플랜 카탈로그 / paid minute allowance 운영 / 성장 대시보드 / PDF 리포트 / plan-based 15분 세션

**Phase 2b (Week 7~10)**  
다국어 파일럿(JA 우선) / 이메일 리포트 / 반복 예약 통화 / 발음 분석 / 확장형 리포트

### 1.4 Launch Assumptions & Constraints

Phase 1은 **국내 대표번호 안정 표기**를 성공 기준에 넣지 않는다.

Twilio는 한국 로케일에서 voice-enabled inbound number 구매가 어렵고, outbound 발신 자체는 가능하나 수신자 화면에 표시되는 발신번호가 국내 번호가 아닐 수 있다. 따라서 Phase 1은 **발신번호 표시를 보장하지 않는 클로즈드 베타**로 정의하고, 국내 번호 안정 표기 전략(BYOC/SIP/국내 통신사 연동 등)은 유료 공개 전 필수 과제로 둔다.

실시간 통화는 Twilio bidirectional Media Streams 기준으로 설계한다. 이 방식은 call당 bidirectional stream 1개만 허용되며, `<Connect><Stream>` 사용 시 WebSocket이 닫히기 전까지 후속 TwiML이 실행되지 않는다. 또한 `<Stream>`의 `url`은 query string을 지원하지 않으므로 세션 식별자는 Custom Parameters 또는 서버 측 매핑으로 전달한다.

예약/스케줄 워커는 UTC 기준 실행 시각을 저장·계산하는 방식으로 설계한다. 카카오 알림톡은 **정보성 메시지**에 한해 승인된 템플릿으로만 발송한다.

### 1.5 Scope Lock Notes

- Phase 1은 **실제 사용자에게 노출되는 duration을 10분으로 잠근다**.
- Phase 1에서 15분 세션은 internal QA 또는 admin entitlement 전용이며, user-facing product scope가 아니다.
- internal allowance ledger는 Phase 1부터 존재하지만, paid minute allowance의 판매/결제/플랜 노출은 Phase 2a부터다.

---

## 2. Goals & Success Metrics

### 2.1 Phase 1 Goals (Week 1~4)

| Goal | Definition | Target |
|---|---|---|
| Call Initiation Success Rate | successful provider call create / valid `POST /calls/initiate` requests | ≥ 98% |
| Connected Call Success Rate | answered + duration_seconds ≥ 180 / sessions in `dialing` | ≥ 85% |
| Voice Turn Latency | user end-of-turn → AI audio first byte | p95 ≤ 1.8s |
| Report Readiness SLA | provider `completed` received_at → `reports.status = ready` | p95 ≤ 60s |
| Kakao Delivery SLA | `report_ready_at` → kakao provider accepted_at | p95 ≤ 30s |
| 14-day Reuse Rate | 14일 내 completed session 2회 이상 사용자 / completed session 1회 이상 사용자 | ≥ 35% |
| Scheduled Dispatch Timeliness | 사용자가 선택한 시각 → 실제 `dialing` 시작 | p95 ≤ 2분 |
| Scheduled Call Answer Rate | `scheduled_once` 세션 중 answered 비율 | ≥ 80% |
| Closed Beta Activation | 가입 후 48시간 내 첫 통화 완료 사용자 비율 | ≥ 60% |

### 2.2 Phase 2a Goals (Week 5~6)

| Goal | Definition | Target |
|---|---|---|
| Billing Flow Success | 결제 시도 → provider success webhook 반영 | ≥ 98% |
| Dashboard Load Time | 대시보드 API + chart render | p95 ≤ 2.0s |
| PDF Generation Success | `report_ready` → PDF stored | ≥ 99% |
| Plan Catalog Flexibility | 앱 재배포 없이 플랜 수치 변경 가능 | 100% |

### 2.3 Phase 2b Goals (Week 7~10)

| Goal | Definition | Target |
|---|---|---|
| Multilingual Pilot Success | JA completed calls / JA initiated calls | ≥ 80% |
| Recurring Schedule Execution Success | due recurring schedule → call initiated | ≥ 98% |
| Email Delivery SLA | `report_ready` → email accepted | p95 ≤ 60s |
| Paid Conversion | 활성 사용자 중 유료 전환 | ≥ 10% |

### 2.4 North Star Metric

**Monthly Completed Call Minutes (MCCM)**

이유:
1. 전화 학습 사용량을 직접 반영한다.
2. minute-based allowance 구조와 정렬된다.
3. 세션 수보다 원가·리텐션·수익성을 함께 보기 쉽다.

---

## 3. User Personas

> **Phase 1 scope 주의:** A/B/C 모두 `EN / OPIC` 단일 시험이다. B(민준)·C(서연)는 OPIC 세션에서 비즈니스·면접 **토픽**을 선택하는 유저일 뿐, 별도 시험/모드가 아니다.

| ID | 이름 | 사용 언어 / 시험·토픽 | Phase | 유형 |
|---|---|---|---|---|
| A | 지수 | EN / OPIC — 일반 회화 토픽 | Primary — Phase 1 | 시험 준비생 |
| B | 민준 | EN / OPIC — 비즈니스 토픽 | Secondary — Phase 1 | 직장인 유지 학습 |
| C | 서연 | EN / OPIC — 면접 토픽 | Secondary — Phase 1 | 외국계 취업 면접 준비 |
| D | 유나 | DE / Goethe-Zertifikat B2 | Phase 2b | 괴테 인스티투트 시험 준비 |
| E | 재원 | ZH / HSK 5급 | Phase 2b | 무역회사 재직 업무용 중국어 |
| F | 소희 | ES / DELE B1 | Phase 2b | 남미 어학연수/봉사 준비 |

### Persona A — 시험 준비생 지수 (Primary · Phase 1 · EN/OPIC)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 26세 / 취업 준비생 |
| 사용 시험·토픽 | EN / OPIC — 일반 회화 토픽 (자기소개, 일상, 경험 묘사) |
| 목표 / 현재 수준 | OPIC IH 취득 / IM2 |
| 고통 | 전화 영어 학원 비용 부담, 피드백이 느림 |
| 행동 패턴 | 하루 1회 10분. 원하는 시간 지정 선호. |
| 채널 / 기기 | 카카오톡 / Android |
| 지불 성향 | 가격 민감. Free trial → Basic 전환 핵심 타겟. |
| Product Fit | MCCM 기여 높음. OPIC 점수 향상이 리텐션 동기. |

### Persona B — 직장인 민준 (Secondary · Phase 1 · EN/OPIC)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 32세 / 해외영업팀 대리 |
| 사용 시험·토픽 | EN / OPIC — 비즈니스 토픽 (발표·회의·협상 상황 묘사) |
| 목표 | OPIC 시험 대비 + 실무 영어 말하기 자신감 유지 |
| 고통 | 시간 부족. 회의 직전 짧은 실전 연습 필요. 피드백 즉시 확인이 어려움. |
| 행동 패턴 | 출퇴근/점심시간 예약 콜백 선호. 주 2~3회 10분 세션. |
| 채널 / 기기 | 이메일 + 웹 리포트 / iPhone + MacBook |
| 지불 성향 | 품질 중시. PDF·이메일 니즈 높음. |
| Product Fit | `scheduled_once` 헤비 유저. Phase 2a/2b의 업셀 타겟. |

### Persona C — 외국계 면접 준비생 서연 (Secondary · Phase 1 · EN/OPIC)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 28세 / 마케터 (국내 대기업 → 외국계 이직 준비 중) |
| 사용 시험·토픽 | EN / OPIC — 면접 토픽 (자기소개·강약점·상황 대처 묘사) |
| 목표 | OPIC 시험 대비 + 외국계 기업 영어 면접 답변 유창화 |
| 현재 수준 | TOEIC 905점. speaking 자신감 부족. |
| 고통 | 원어민 1:1 면접 코칭 비용이 높고 예약이 어려움. 즉각 교정 없음. |
| 행동 패턴 | 면접 예상 질문별 10분 집중 연습. 퇴근 후 저녁 선호. 주 4~5회. |
| 채널 / 기기 | 앱 내 상세 리포트 / iPhone |
| 지불 성향 | 목표 달성 전까지 한시적 고사용량 가능. |
| Product Fit | 리포트 교정 상세도에 민감. 이직 시즌 집중 과금 가능성. |

### Persona D — 괴테 인스티투트 준비생 유나 (Phase 2b · DE)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 24세 / 예술대학원생 (독일 유학 준비) |
| 사용 시험·토픽 | DE / Goethe-Zertifikat B2 — Sprechen 파트 집중 |
| 목표 | Goethe B2 취득. 독일 예술대학 인터뷰 대비. |
| 현재 수준 | B1 수료. 실시간 speaking 반응 속도 부족. |
| 고통 | 독일어 원어민 전화 과외 비용이 높고 특화 채널이 부족함. |
| 행동 패턴 | 시험 3개월 전 집중 과금. 늦은 밤 선호. |
| 채널 / 기기 | 앱 내 HTML 리포트 + PDF / Android |
| 지불 성향 | 합격 전까지 Pro 성향. |
| Product Fit | DE 파일럿 첫 코어 타겟. 야간 트래픽 spike 가능. |

### Persona E — 무역회사 중국어 실무자 재원 (Phase 2b · ZH)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 31세 / 무역회사 대리 |
| 사용 시험·토픽 | ZH / HSK 5급 — 비즈니스·협상 토픽 |
| 목표 | HSK 5급 취득. 중국 바이어·공급사와 말하기 자신감 확보. |
| 현재 수준 | HSK 4급. 실시간 전화 발화에서 막힘. |
| 고통 | 학원 커리큘럼과 실무 용어가 맞지 않음. |
| 행동 패턴 | 점심시간 즉시 통화 선호. 주 3~4회. |
| 채널 / 기기 | 앱 내 리포트 / Android |
| 지불 성향 | Basic 선호. 성과 체감 시 Pro. |
| Product Fit | ZH 비즈니스 파일럿 핵심 유저. 즉시 통화 패턴 강함. |

### Persona F — 스페인어 어학연수 준비생 소희 (Phase 2b · ES)

| Attribute | Detail |
|---|---|
| 나이 / 직업 | 25세 / 간호사 (퇴직 후 남미 봉사 준비) |
| 사용 시험·토픽 | ES / DELE B1 — 일상·봉사 토픽 |
| 목표 | DELE B1 취득. 남미 현지 인터뷰 및 일상 스페인어 구사. |
| 현재 수준 | A2 수료. speaking 경험 부족. |
| 고통 | 중남미 억양 기준 연습 채널이 부족함. |
| 행동 패턴 | 하루 1~2회 10분. 오전 선호. |
| 채널 / 기기 | 앱 내 HTML 리포트 + PDF / iPhone |
| 지불 성향 | 가격 민감. Basic 선호, 출국 전 Pro 가능. |
| Product Fit | ES 파일럿 고빈도 단기 집중 유저. |

---

## 4. User Stories & Acceptance Criteria

### 4.1 Global Product Rules

#### Session State Machine

```text
draft -> ready -> dialing -> ringing -> in_progress -> ending -> completed
draft -> scheduled -> dialing -> ringing -> in_progress -> ending -> completed

terminal outcome:
no_answer | busy | voicemail | user_cancelled | provider_error | schedule_missed

post-call async:
report_pending -> report_ready | report_failed
```

#### Session Status vs Failure Reason Contract

- `sessions.status`는 lifecycle 상태와 terminal outcome을 함께 표현한다.
- `failure_reason`는 provider/internal detail을 저장하는 디버깅용 보조 필드다.
- `failure_reason`는 terminal outcome을 대체하지 않는다.

예시:
- `status = no_answer`
- `failure_reason = twilio_no_answer_timeout`

- `status = provider_error`
- `failure_reason = twilio_503_provider`

허용 예시 status:
`draft | ready | scheduled | dialing | ringing | in_progress | ending | completed | no_answer | busy | voicemail | user_cancelled | provider_error | schedule_missed`

#### Credit / Trial Policy

- 무료 체험: **3회 통화**, 각 통화 최대 10분
- 유료 플랜: **minute allowance** 방식
- Free / trial 사용자는 `duration_minutes = 10`만 선택 가능하다.
- 15분 옵션은 paid plan 사용자에게만 활성화된다.

- immediate call:
  - `POST /calls/initiate` accepted 시 trial call 1개 또는 target minutes를 reserve

- one-time scheduled callback:
  - 예약 저장 시 reserve
  - 사용자가 취소하면 release
  - 통화 종료 후 실제 사용분에 맞춰 settlement
  - 잔여 예약분은 release

- `no_answer`, `busy`, `provider_error`, `schedule_missed` 발생 시 reserve release
- answered 후 60초 미만 종료이고 platform fault로 판정되면 auto-refund
- Phase 1에서 upcoming one-time scheduled session은 사용자당 최대 1개

#### Platform Fault 판정 기준

아래 조건 중 하나 이상 충족 시 platform fault로 판정하고 auto-refund를 적용한다.

1. provider call create 이후, answered 이전에 provider/internal error 성격의 실패가 기록된 경우  
   - 근거 필드: Twilio `CallStatus`, `SipResponseCode`, provider error classification
2. answered 이후 60초 미만 종료이며, provider/internal error 성격의 종료로 분류된 경우  
   - 근거 필드: Twilio `CallStatus`, `SipResponseCode`, provider error classification
3. Media Stream WebSocket이 서버 측 오류로 비정상 종료된 경우  
   - 예: 서버 5xx, internal WebSocket close code, stream handler exception
4. 앱/서버가 provider/system fault로 명시적으로 종료 처리한 경우

아래는 platform fault가 아니다.
- 사용자의 자발적 종료
- `no_answer`
- `busy`
- `voicemail`

`EndedReason`는 platform fault 판정의 필수 전제 필드로 사용하지 않는다.

#### One-time Scheduled Callback Policy

- `scheduled_once`는 반복 예약 기능이 아니다.
- Phase 1 예약 가능 범위는 **현재 시각 + 15분 이후 ~ 7일 이내**다.
- 리마인더는 예약 시각 **10분 전** 발송한다.
- no-answer 시 **1회 발신 후 종료**한다.
- 반복 예약은 Phase 2b 범위다.

#### Idempotency Rule

아래 흐름은 모두 idempotent 해야 한다.
- `POST /calls/initiate`
- `POST /billing/checkout-sessions`
- provider webhook 처리
- due session dispatch worker 처리
- due reminder dispatch worker 처리

---

### Epic 1: Onboarding & Setup

#### US-001 — 회원가입

**Acceptance Criteria**
- AC-001-1: 카카오/구글 로그인 성공 시 `users` 레코드 생성
- AC-001-2: `users.clerk_user_id` 와 Clerk `sub` 매핑 저장
- AC-001-3: 신규 가입자에게 `trial_calls_remaining = 3` 부여
- AC-001-4: 가입 직후 전화번호 미등록이면 Screen 2로 이동
- AC-001-5: 이미 전화번호 인증된 기존 사용자는 홈으로 이동

#### US-002 — 전화번호 등록 & 검증

**Acceptance Criteria**
- AC-002-1: 국가 코드 선택 UI 제공 (`+82` 기본)
- AC-002-2: SMS OTP 발송
- AC-002-3: OTP 유효시간 5분
- AC-002-4: 3회 실패 시 재발송 필요
- AC-002-5: 검증 성공 시 `users.phone_verified = true`, `phone_verified_at` 저장
- AC-002-6: 전화번호는 암호화 저장, UI는 마스킹 표시

#### US-003 — 세션 설정

**Acceptance Criteria**
- AC-003-1: Phase 1은 EN만 노출한다.
- AC-003-2: Phase 1은 OPIC만 활성화한다.
- AC-003-3: 레벨 선택 목록은 `NL / IL / IM1 / IM2 / IM3 / IH / AL` 이다.
- AC-003-4: 추천 주제 3개와 직접 입력 옵션을 제공한다.
- AC-003-5: duration 값은 plan entitlement에 따라 서버가 검증한다.
- AC-003-6: 통화 방식 선택을 제공한다 — `지금 전화받기` / `원하는 시간에 전화받기`
- AC-003-7: `원하는 시간에 전화받기` 선택 시 날짜/시간 picker를 노출한다.
- AC-003-8: timezone 기본값은 `Asia/Seoul` 이다.
- AC-003-9: 과거 시각은 선택 불가하다.
- AC-003-10: `scheduled_once`는 향후 7일 이내만 허용한다.
- AC-003-11: 저장 시 immediate → `status=ready`, scheduled_once → `status=scheduled`
- AC-003-12: 마지막 설정 1-click 복원 가능
- AC-003-13: Free / trial 사용자는 `duration_minutes=10`만 선택 가능하다.
- AC-003-14: 15분 옵션은 paid plan 사용자에게만 활성화된다.
- AC-003-15: `scheduled_once`는 현재 시각 + 15분 이후부터 예약 가능하다.
- AC-003-16: `scheduled_for_at_utc` 와 `reminder_at_utc` 는 서버가 계산한다.

---

### Epic 2: AI Call

#### US-004 — 즉시 통화 시작

**Acceptance Criteria**
- AC-004-1: 클릭 후 1초 내 API 요청 완료
- AC-004-2: 서버는 202 + `call_id` + `status=dialing` 반환
- AC-004-3: 10초 내 `ringing` 진입 실패 시 `status=provider_error`
- AC-004-4: answered 후 2초 내 opening audio 시작
- AC-004-5: 앱은 polling 또는 websocket으로 상태 표시
- AC-004-6: 사용자는 앱에서 종료 요청 가능
- AC-004-7: 동시 active call은 사용자당 1개만 허용

#### US-004A — 1회 예약 통화 저장

**Acceptance Criteria**
- AC-004A-1: 사용자는 날짜/시간을 선택해 1회 예약 통화를 생성할 수 있다.
- AC-004A-2: 서버는 `scheduled_for_at_utc` 와 `timezone` 을 함께 저장한다.
- AC-004A-3: 저장 성공 시 `status=scheduled`
- AC-004A-4: 응답에 `session_id`, `scheduled_for_local`, `status=scheduled` 포함
- AC-004A-5: 예약 저장 시 trial call 1개 또는 target minutes reserve
- AC-004A-6: Phase 1에서는 사용자당 upcoming scheduled session 최대 1개
- AC-004A-7: 저장 후 홈 화면에 upcoming scheduled card 노출
- AC-004A-8: 리마인더는 예약 시각 10분 전 카카오 알림톡 자동 발송

#### US-004B — 예약된 1회 통화 자동 발신

**Acceptance Criteria**
- AC-004B-1: due worker는 `status=scheduled` 이고 `scheduled_for_at_utc <= now()` 인 세션을 조회한다.
- AC-004B-2: 실제 call initiation은 선택 시각 기준 p95 2분 이내 시작
- AC-004B-3: 발신 성공 시 `scheduled -> dialing -> ringing` 으로 전이
- AC-004B-4: provider call create 실패 시 `status=provider_error`
- AC-004B-5: 예약 시각 이후 15분 안에 발신 실패 시 `status=schedule_missed`
- AC-004B-6: 실패 시 예약된 trial/minutes는 release
- AC-004B-7: no-answer 시 자동 재시도 없이 `status=no_answer` 로 종료한다.
- AC-004B-8: `failure_reason` 는 provider/internal detail code만 저장한다.

#### US-004C — 예약 통화 수정/취소

**Acceptance Criteria**
- AC-004C-1: `status=scheduled` 인 세션만 수정/취소 가능
- AC-004C-2: 시간 수정 시 `scheduled_for_at_utc` 재계산
- AC-004C-3: 취소 시 `status=user_cancelled`
- AC-004C-4: 취소 시 예약된 trial/minutes release
- AC-004C-5: 홈 화면 upcoming scheduled card에서 수정/취소 가능

#### US-005 — AI Talker 대화 품질

**Acceptance Criteria**
- AC-005-1: 레벨에 맞는 속도와 어휘
- AC-005-2: 사용자 발화 종료 → AI 응답 시작 p95 ≤ 1.8s
- AC-005-3: 질문 → 답변 → follow-up 구조 유지
- AC-005-4: 3초 침묵 시 힌트 제공
- AC-005-5: 교정은 turn당 최대 1개
- AC-005-6: 목표 시간 1분 전 closing cue
- AC-005-7: 통화 종료 시 session status와 provider call state 일치

#### US-006 — 통화 종료 & 리포트 트리거

**Acceptance Criteria**
- AC-006-1: provider `completed` 수신 후 `report_pending`
- AC-006-2: p95 60초 내 `report_ready`
- AC-006-3: 카카오 알림톡은 점수 + 핵심 교정 3개 + 딥링크 전송
- AC-006-4: 리포트 생성 실패 시 exponential backoff로 3회 재시도
- AC-006-5: 최종 실패 시 앱 내 `리포트 생성 지연` 상태 표시
- AC-006-6: raw provider event 추적 가능

---

### Epic 3: Report & Learning

#### US-007 — 통화 후 리포트 조회

**Acceptance Criteria**
- AC-007-1: 상단 점수 카드 표시
- AC-007-2: 사용자/AI 발화 분리 스크립트 제공
- AC-007-3: 문법 교정: 원문 → 수정문 → 설명
- AC-007-4: 추천 표현 5개 제공
- AC-007-5: 과거 리포트 목록 최신순 제공
- AC-007-6: Phase 1은 HTML 리포트만 제공
- AC-007-7: PDF 저장 버튼은 Phase 2a부터 노출

#### US-008 — 성장 대시보드 (Phase 2a)

**Acceptance Criteria**
- AC-008-1: 최근 세션 추이 line chart
- AC-008-2: grammar / vocabulary / fluency radar chart
- AC-008-3: streak / calendar heatmap
- AC-008-4: 같은 scoring version끼리만 비교
- AC-008-5: scoring version 변경 시 UI에 버전 표시

---

### Epic 4: Scheduling (Phase 2b)

#### US-009 — 반복 예약 통화

**Acceptance Criteria**
- AC-009-1: 요일 + 시간 + timezone 선택
- AC-009-2: 저장 시 `next_run_at_utc` 계산
- AC-009-3: 예약 10분 전 알림톡 리마인더
- AC-009-4: due recurring schedule은 worker가 UTC 기준 실행
- AC-009-5: pause / resume / delete 가능
- AC-009-6: Free 플랜은 recurring schedule 비활성화

---

### Epic 5: Billing & Plans (Phase 2a)

#### US-010 — 플랜 선택 & 결제

**Acceptance Criteria**
- AC-010-1: Free / Basic / Pro 카드가 `plans` 테이블 기반으로 렌더링
- AC-010-2: 플랜은 session count가 아니라 included minutes 기준
- AC-010-3: 결제 성공 webhook 반영 후 즉시 allowance 업데이트
- AC-010-4: 갱신 3일 전 사전 안내
- AC-010-5: 취소 시 `cancel_at_period_end` 지원
- AC-010-6: 앱 재배포 없이 price/minutes 변경 가능

---

## 5. Feature Scope — Phase 1 / Phase 2a / Phase 2b

| Feature | Phase 1 | Phase 2a | Phase 2b | Notes |
|---|:---:|:---:|:---:|---|
| 카카오/구글 로그인 | ✅ | ✅ | ✅ | Clerk |
| 전화번호 OTP 인증 | ✅ | ✅ | ✅ | |
| EN / OPIC 설정 UI | ✅ | ✅ | ✅ | Phase 1 locked |
| 즉시 outbound call | ✅ | ✅ | ✅ | |
| 1회 예약 콜백 (`scheduled_once`) | ✅ | ✅ | ✅ | 단건 예약 |
| 반복 예약 통화 | ❌ | ❌ | ✅ | recurring only |
| 실시간 자막 | ✅ | ✅ | ✅ | |
| 앱 내 HTML 리포트 | ✅ | ✅ | ✅ | |
| 카카오 알림톡 요약 | ✅ | ✅ | ✅ | 정보성 템플릿만 |
| 성장 차트 | ❌ | ✅ | ✅ | 홈 차트는 Phase 1 비노출 |
| PDF 리포트 | ❌ | ✅ | ✅ | |
| 결제 / 플랜 | ❌ | ✅ | ✅ | dynamic plans |
| internal allowance ledger (reserve / settlement) | ✅ | ✅ | ✅ | internal only |
| paid minute allowance 판매/운영 | ❌ | ✅ | ✅ | billing-coupled |
| 이메일 리포트 | ❌ | ❌ | ✅ | |
| JA 파일럿 | ❌ | ❌ | ✅ | first non-EN |
| ZH / DE / ES | ❌ | ❌ | ✅ | JA 안정화 후 |
| 발음 분석 | ❌ | ❌ | ✅ | |
| LMS 연동 API | ❌ | ❌ | ❌ | Phase 3+ |
| 모바일 앱 (RN) | ❌ | ❌ | ❌ | Phase 3+ |

**Phase 1 Feature Flag Policy**
- 숨김 대상: TOEIC Speaking, IELTS, 자유회화, charts, PDF, payment, recurring schedule, multilingual
- 숨김 방식: UI 비노출 + backend validation + config registry 미등록
- caller ID presentation은 Phase 1 success criteria에서 제외
- Phase 1 end-user visible duration은 10분으로 고정한다.

---

## 6. Wireframe Descriptions

### Screen 1 — 온보딩 / 로그인

레이아웃: 로고 / 카카오로 시작하기 / 구글로 시작하기 / 기존 사용자 로그인 링크

States: default / loading / error toast

Navigation:
- 신규 + 전화번호 미인증 → Screen 2
- 신규 + 전화번호 인증 완료 → Screen 3
- 기존 사용자 → Screen 4

### Screen 2 — 전화번호 등록

레이아웃: 국가 코드 드롭다운 / 전화번호 입력 / `인증 문자 받기` 버튼 / OTP 6자리 입력 / 카운트다운 / `인증 완료` 버튼

States: `phone_input` / `otp_sent` / `verifying` / `verified` / `error`

### Screen 3 — 세션 설정 (Phase 1 Locked)

레이아웃:
- 언어: 영어만 노출
- 시험: OPIC만 활성
- 목표 레벨 드롭다운
- 추천 주제 카드 3개 + 직접 입력
- 통화 시간: Phase 1 end-user는 10분만 노출
- 통화 방식 segmented control: `지금 전화받기` / `원하는 시간에 전화받기`
- 예약 선택 시 날짜/시간 picker + timezone 표시 (`Asia/Seoul`)
- CTA: immediate → `지금 전화받기` / scheduled_once → `이 시간으로 저장`

Behavior:
- 과거 시간 선택 불가
- `scheduled_once`는 현재 시각 + 15분 이후, 7일 이내만 허용
- Free / trial 사용자는 10분만 선택 가능
- 15분 옵션은 paid plan entitlement가 있는 경우에만 노출
- scheduled_once 저장 성공 시: 토스트 (`10분 전에 알림을 보내드릴게요`) + 홈 이동

### Screen 4 — 홈 대시보드 (Phase 1)

레이아웃:
- 인사 카드
- 남은 무료 체험 횟수 또는 남은 분수
- `새 연습 시작하기` / `마지막 설정으로 빠른 시작`
- upcoming scheduled call 카드 (있는 경우): 예정 시각 / 설정 요약 / `수정` / `취소`
- 최근 리포트 3개 카드
- 누적 연습 시간 / 최근 세션 대비 텍스트 델타

Important:
- Phase 1에서 line/radar/streak chart 비노출
- 탭: `[홈] [리포트] [설정]`

### Screen 5 — 통화 중

레이아웃: AI 이름 / 연결 상태 / 경과 시간 / 목표 시간 프로그레스 바 / 실시간 자막 / 종료 버튼

States: `connecting` / `ringing` / `active` / `ending` / `report_generating`

### Screen 6 — 리포트 상세

레이아웃: 상단 점수 카드 / 항목별 점수 / 주요 교정 3개 / 전체 스크립트 아코디언 / 추천 표현 5개 / 과거 리포트 이동

Phase Rules:
- Phase 1은 HTML만
- Phase 2a부터 `[PDF 저장]` 노출
- scoring version 다르면 비교 배지 비노출

### Screen 7 — 반복 예약 설정 (Phase 2b)

레이아웃: 요일 선택 / 시간 선택 / timezone (`Asia/Seoul`) / 마지막 세션 설정 가져오기 / 리마인더 on/off / 저장 / 일시정지 / 삭제

### Screen 8 — 플랜/결제 (Phase 2a)

레이아웃: Free / Basic / Pro 카드 / included minutes / 1회 최대 통화 시간 / entitlements / 결제 버튼 / 구독 안내

Behavior:
- `GET /plans` 결과를 그대로 렌더링
- price, minutes, entitlements는 서버가 소유

---

## 7. API Spec

Base URL: `https://api.linguacall.app/v1`  
Auth: Bearer token (Clerk session token)  
Content-Type: `application/json`

**Error Envelope**

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "request_id": "req_..."
  }
}
```

### 7.1 Session API

#### `POST /sessions`

세션 설정을 생성한다. immediate 또는 `scheduled_once` 모두 여기서 저장한다.

**Request**

```json
{
  "language": "en",
  "exam": "opic",
  "level": "im2",
  "topic": "business_meeting",
  "duration_minutes": 10,
  "contact_mode": "scheduled_once",
  "scheduled_for_local": "2026-03-15T20:00:00",
  "timezone": "Asia/Seoul"
}
```

**Response `201` — immediate**

```json
{
  "session_id": "sess_01...",
  "status": "ready",
  "contact_mode": "immediate",
  "created_at": "2026-03-13T09:00:00Z"
}
```

**Response `201` — scheduled_once**

```json
{
  "session_id": "sess_01...",
  "status": "scheduled",
  "contact_mode": "scheduled_once",
  "scheduled_for_at_utc": "2026-03-15T11:00:00Z",
  "scheduled_for_local": "2026-03-15T20:00:00+09:00",
  "reminder_at_utc": "2026-03-15T10:50:00Z",
  "created_at": "2026-03-13T09:00:00Z"
}
```

> `reminder_at_utc = scheduled_for_at_utc - 10분` 으로 서버가 계산해 반환한다.

**Errors**
- `400` invalid params
- `402` insufficient allowance
- `409` active session exists OR existing upcoming scheduled session exists
- `422` unsupported config
- `422` invalid_duration_for_plan
- `422` invalid_scheduled_lead_time

**409 Example**

```json
{
  "error": {
    "code": "conflict_scheduled_session",
    "message": "A scheduled session already exists.",
    "request_id": "req_...",
    "conflicting_session_id": "sess_existing_01...",
    "conflicting_scheduled_for_local": "2026-03-15T20:00:00+09:00"
  }
}
```

#### `GET /sessions`

Query: `limit` (default 20, max 100) / `offset` / `status` / `contact_mode`

**Response `200`**

```json
{
  "sessions": [
    {
      "session_id": "sess_01...",
      "status": "scheduled",
      "contact_mode": "scheduled_once",
      "language": "en",
      "exam": "opic",
      "level": "im2",
      "topic": "business_meeting",
      "duration_target_minutes": 10,
      "scheduled_for_local": "2026-03-15T20:00:00+09:00",
      "reminder_at_utc": "2026-03-15T10:50:00Z",
      "created_at": "2026-03-13T09:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### `GET /sessions/:session_id`

```json
{
  "session_id": "sess_01...",
  "status": "scheduled",
  "contact_mode": "scheduled_once",
  "report_status": "not_requested",
  "config": {
    "language": "en",
    "exam": "opic",
    "level": "im2",
    "topic": "business_meeting",
    "duration_minutes": 10
  },
  "scheduled_for_local": "2026-03-15T20:00:00+09:00",
  "reminder_at_utc": "2026-03-15T10:50:00Z",
  "call_id": null,
  "failure_reason": null
}
```

#### `PATCH /sessions/:session_id`

`status=scheduled` 인 세션만 수정 가능.

**Request**

```json
{
  "scheduled_for_local": "2026-03-15T21:00:00",
  "timezone": "Asia/Seoul"
}
```

**Response `200`**

```json
{
  "session_id": "sess_01...",
  "status": "scheduled",
  "scheduled_for_at_utc": "2026-03-15T12:00:00Z",
  "scheduled_for_local": "2026-03-15T21:00:00+09:00",
  "reminder_at_utc": "2026-03-15T11:50:00Z"
}
```

> scheduled session 수정 시 서버는 다음을 반드시 수행한다.
> - `scheduled_for_at_utc` 재계산
> - `reminder_at_utc` 재계산
> - `reminder_sent = false` reset

#### `POST /sessions/:session_id/cancel`

```json
{
  "session_id": "sess_01...",
  "status": "user_cancelled"
}
```

### 7.2 Call API

#### `POST /calls/initiate`

`status=ready` 인 세션만 허용.

Headers: `Idempotency-Key: <uuid>`

**Request / Response `202`**

```json
// request
{ "session_id": "sess_01..." }

// response
{
  "call_id": "call_01...",
  "session_id": "sess_01...",
  "status": "dialing",
  "reserved_trial_call": true,
  "reserved_minutes": 0,
  "created_at": "2026-03-13T09:00:03Z"
}
```

> **Twilio outbound call 생성 규칙**  
> 서버는 outbound call 생성 시 아래 값을 반드시 설정한다.
> - `StatusCallback`
> - `StatusCallbackMethod = POST`
> - `StatusCallbackEvent = initiated ringing answered completed`
>
> 이를 설정하지 않으면 `ringing` / `answered` 상태 전이를 안정적으로 수신할 수 없다.

#### `GET /calls/:call_id`

```json
{
  "call_id": "call_01...",
  "session_id": "sess_01...",
  "status": "ringing",
  "provider_call_sid": "CA123456...",
  "answered_at": null,
  "ended_at": null,
  "failure_reason": null
}
```

#### `POST /calls/:call_id/end`

```json
{ "call_id": "call_01...", "status": "ending" }
```

### 7.3 Twilio Webhooks

#### `POST /webhooks/twilio/status`

Server Requirements:
- `X-Twilio-Signature` HMAC 검증
- raw payload durable write
- dedupe_key = `twilio:status:{CallSid}:{SequenceNumber}`
- callback state transition은 monotonic 하게 처리
- 더 낮은 `SequenceNumber` 가 늦게 도착하면 상태 회귀(regression)에 사용하지 않음
- 세션 상태 전이 후 2xx 반환

> Twilio webhook 검증은 Twilio에 등록된 정확한 URL과 파라미터 기준이다. reverse proxy 환경에서는 외부 URL 기준으로 검증해야 한다.
>
> Twilio status callback 이벤트는 fired order와 arrival order가 다를 수 있다. 따라서 상태 전이는 `SequenceNumber` 기준으로 처리하며, older callback이 later callback 뒤에 도착해도 상태를 되돌리면 안 된다.

#### `POST /webhooks/twilio/twiml`

**Response**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.linguacall.app/media-stream" />
  </Connect>
</Response>
```

Implementation Notes:
- `session_id`는 custom parameters 또는 server-side lookup으로 전달 (query string 미지원)
- bidirectional stream은 call당 1개
- WebSocket 종료 전까지 후속 TwiML 실행 안 함

#### Media WebSocket Contract

- Twilio inbound media는 `audio/x-mulaw`, 8kHz, base64 형태로 수신한다.
- Twilio outbound media로 다시 보내는 오디오도 `audio/x-mulaw`, 8kHz, base64 형태여야 한다.
- 새 응답을 시작하거나 barge-in을 처리할 때는 Twilio `clear` message를 보내 이전 버퍼를 비운다.

**Transcoder 책임 소재**

ElevenLabs 기본 출력: `pcm_16000` (16kHz, 16-bit PCM)  
Twilio 요구 포맷: `audio/x-mulaw` (8kHz, 8-bit μ-law, base64)

- **Transcoding 위치:** Media Stream WebSocket handler 내부의 in-process transcoder
- **변환:** `pcm_16000` → 8kHz downsample → μ-law encode → base64
- **권장 구현:** in-process audio transform 유틸리티 또는 ffmpeg 기반 경량 변환
- 특정 서드파티 utility 패키지는 PRD의 normative dependency로 지정하지 않는다.

### 7.4 Report API

#### `GET /sessions/:session_id/report`

```json
// pending
{ "status": "pending", "report_id": null }

// ready
{ "status": "ready", "report_id": "rpt_01..." }
```

#### `GET /reports/:report_id`

```json
{
  "report_id": "rpt_01...",
  "session_id": "sess_01...",
  "status": "ready",
  "score": {
    "total": 78,
    "grammar": 79,
    "vocabulary": 72,
    "fluency": 85,
    "topic_relevance": 76
  },
  "level_assessment": "IM3 근접",
  "score_delta": 4,
  "grammar_corrections": [
    {
      "original": "I have went to the meeting",
      "corrected": "I had gone to the meeting",
      "explanation": "과거완료형 사용 필요",
      "category": "tense",
      "timestamp_ms_from_call_start": 142000
    }
  ],
  "recommendations": [
    "By the time I arrived, they had already...",
    "Let's align on the schedule.",
    "I was responsible for..."
  ],
  "transcript": [
    { "role": "ai",   "content": "Hi! This is Jamie...",      "timestamp_ms_from_call_start": 0 },
    { "role": "user", "content": "Hello, nice to meet you.", "timestamp_ms_from_call_start": 5200 }
  ],
  "created_at": "2026-03-13T09:45:10Z"
}
```

> `transcript[].timestamp_ms_from_call_start`, `grammar_corrections[].timestamp_ms_from_call_start`, `messages.timestamp_ms` 는 모두 **통화 시작 기준 상대 ms** 로 통일한다.

#### `GET /reports/:report_id/pdf` *(Phase 2a)*

Response: `302 Redirect` → signed storage URL (runtime 생성, 유효 1시간)

> PDF URL은 DB 저장 안 함. `reports.storage_path`만 저장하고 signed URL은 요청 시 runtime 생성 후 302 반환한다.

### 7.5 Recurring Schedule API *(Phase 2b)*

#### `POST /recurring-schedules`

```json
// request
{
  "weekdays": [1, 3, 5],
  "local_time": "08:00",
  "timezone": "Asia/Seoul",
  "session_config": {
    "language": "en",
    "exam": "opic",
    "level": "im2",
    "topic": "business_meeting",
    "duration_minutes": 10
  }
}

// response 201
{
  "schedule_id": "rsch_01...",
  "status": "active",
  "next_run_at_utc": "2026-03-16T23:00:00Z"
}
```

> Vercel Cron은 UTC 기준이므로 `timezone`, `local_time`, `weekdays`, `next_run_at_utc`를 함께 저장한다.

### 7.6 User API

#### `GET /users/me`

```json
{
  "user_id": "usr_01...",
  "name": "김지수",
  "email": "jisu@example.com",
  "phone": "010-****-5678",
  "plan": "free",
  "trial_calls_remaining": 2,
  "paid_minutes_balance": 0,
  "total_sessions": 5,
  "created_at": "2026-03-01T00:00:00Z"
}
```

#### `PATCH /users/me`

```json
{ "name": "김지수", "notification_kakao": true, "notification_email": false }
```

### 7.7 Billing API *(Phase 2a)*

#### `GET /plans`

```json
{
  "plans": [
    {
      "code": "free",
      "display_name": "Free",
      "price_krw": 0,
      "included_minutes": 0,
      "trial_calls": 3,
      "max_session_minutes": 10,
      "entitlements": []
    },
    {
      "code": "basic",
      "display_name": "Basic",
      "price_krw": "<configured>",
      "included_minutes": "<configured>",
      "trial_calls": 0,
      "max_session_minutes": 15,
      "entitlements": ["scheduled_once"]
    },
    {
      "code": "pro",
      "display_name": "Pro",
      "price_krw": "<configured>",
      "included_minutes": "<configured>",
      "trial_calls": 0,
      "max_session_minutes": 15,
      "entitlements": ["scheduled_once", "recurring_schedule", "pdf", "email_report"]
    }
  ]
}
```

> 위 값은 launch-approved 숫자가 아니라 illustrative placeholder다. 실제 가격/분수는 Finance Gating 완료 후 `plans` 테이블에서 운영자가 관리한다.

#### `POST /billing/checkout-sessions`

```json
// request
{ "plan_code": "basic" }

// response 201
{ "checkout_session_id": "chk_01...", "provider": "tbd", "checkout_url": "https://payments.example/checkout/..." }
```

#### `POST /webhooks/payments`

Server Requirements:
- provider signature 검증
- raw event 저장 (`dedupe_key = {provider}:{event_type}:{provider_event_id}`)
- subscription / allowance 반영
- idempotent 처리

### 7.8 Internal APIs / Jobs

#### `POST /internal/evaluate`

```json
{ "session_id": "sess_01...", "language": "en", "exam": "opic", "level": "im2", "transcript": [] }
```

#### `POST /internal/report/generate`

```json
{ "session_id": "sess_01...", "evaluation_result": {} }
```

#### `POST /internal/sessions/dispatch-due`

Behavior:
- `status=scheduled`
- `scheduled_for_at_utc <= now()`
- `dispatch_deadline_at_utc > now()`

조건을 만족하는 세션을 조회한 뒤 **atomic claim** 후 provider call initiation을 수행한다.

권장 패턴:
- `UPDATE ... SET status='dialing' WHERE id=? AND status='scheduled' RETURNING *`
또는
- `SELECT ... FOR UPDATE SKIP LOCKED`

no-answer 시 재시도 없이 `status=no_answer` 종료.  
`failure_reason` 는 provider/internal detail code만 저장한다.

#### `POST /internal/sessions/dispatch-reminder`

Behavior:
- `status=scheduled`
- `reminder_at_utc <= now()`
- `reminder_sent = false`

조건을 만족하는 세션을 조회한 뒤 **atomic claim 또는 transaction lock** 기반으로 리마인더를 발송한다.

발송 성공 후:
- `reminder_sent = true`
- `reminder_sent_at` 기록

예약 시간이 수정되면:
- `reminder_at_utc` 재계산
- `reminder_sent = false` reset

#### `POST /internal/recurring-schedules/dispatch-due` *(Phase 2b)*

Behavior:
- `status=active`
- `next_run_at_utc <= now()`

조건을 만족하는 recurring schedule을 세션으로 materialize 한 뒤 발신한다.

---

## 8. Agent System Design

### 8.1 Realtime Voice Stack

| Layer | Phase 1 Choice | Notes |
|---|---|---|
| Telephony | Twilio Programmable Voice + Media Streams | real phone call |
| STT | Deepgram Flux | EN voice-agent optimized, turn detection 포함 |
| LLM | Claude Sonnet 4.5 | talk + evaluate |
| TTS | ElevenLabs Flash/Turbo | low-latency synthesis |
| DB/Storage | Supabase | Postgres + Storage |
| Messaging | Kakao BizMessage | AlimTalk summary |

### 8.2 Config Agent

**Trigger:** `POST /sessions`

**Output**

```json
{
  "prompt_version": "en_opic_im2_v3_1",
  "persona_name": "Jamie",
  "voice_vendor": "elevenlabs",
  "voice_model": "flash_or_turbo",
  "voice_id": "jamie_en_01",
  "stt_vendor": "deepgram",
  "stt_model": "flux-general-en",
  "llm_vendor": "anthropic",
  "llm_model": "claude-sonnet-4-5",
  "max_duration_seconds": 600,
  "hint_silence_threshold_seconds": 3,
  "soft_correction_max_per_turn": 1
}
```

### 8.3 Talker Runtime

```text
Twilio inbound media (mulaw 8kHz, base64)
  -> STT stream (Deepgram Flux)
  -> end-of-turn detection
  -> Claude response generation
  -> response normalization layer
  -> TTS generation (ElevenLabs -> pcm_16000)
  -> [Transcoder] pcm_16000 -> mulaw 8kHz -> base64
  -> Twilio outbound media websocket
```

**Transcoder 상세**
- 위치: Media Stream WebSocket handler 내 인라인 처리
- 변환: `pcm_16000` → downsample 8kHz → μ-law encode → base64
- 버퍼 클리어: 새 응답 생성 시 Twilio clear message 전송

**STT ingress default**

Phase 1 기본 경로는 아래 중 하나를 Architecture Reference에 고정한다.

A. Twilio inbound `mulaw/8000` 를 decode 후 raw `mulaw/8000` 로 STT 전달  
B. `linear16/16000` 으로 normalize 후 STT 전달

PRD 차원에서는 Phase 1 기본 경로를 **하나로 lock** 해야 하며, 구현 중 동적 분기는 허용하지 않는다.

### 8.4 Session Dispatch Worker

Responsibilities:
1. `scheduled_once` 세션 중 due item 조회
2. reserve 검증
3. provider outbound call initiation
4. `scheduled -> dialing` 전이
5. timeout 시 `schedule_missed` 처리
6. no-answer 시 재시도 없이 `status=no_answer` 처리

**Reminder Sub-worker**
- polling cadence: 1 minute
- `reminder_at_utc <= now()` AND `reminder_sent = false` AND `status=scheduled` 조회
- 카카오 알림톡 발송 → `sessions.reminder_sent = true`

Phase 1 Guardrails:
- polling 1분
- user당 scheduled 세션 1개
- dispatch deadline: `scheduled_for_at_utc + 15m`

**Worker Concurrency Rule**

dispatch worker와 reminder worker는 동일 row를 중복 처리하지 않도록 row-level atomic claim 규칙을 사용해야 한다.

Phase 1에서는 다음 두 패턴 중 하나를 강제한다.
- optimistic single-row update claim
- `FOR UPDATE SKIP LOCKED`

### 8.5 Evaluator Agent

**Output**

```json
{
  "grammar_score": 79,
  "vocabulary_score": 72,
  "fluency_score": 85,
  "topic_score": 76,
  "total_score": 78,
  "level_assessment": "IM3 근접",
  "grammar_corrections": [],
  "vocabulary_analysis": [],
  "fluency_metrics": { "avg_wpm": 113, "filler_count": 7, "pause_count": 5 },
  "scoring_version": "opic_en_v1"
}
```

Guardrails:
- valid JSON only
- malformed JSON 1회 자동 재시도
- scoring_version 저장 필수

### 8.6 Report Agent

Responsibilities:
1. evaluation → user-facing report JSON 변환
2. app report 저장
3. 카카오 알림톡 payload 생성
4. Phase 2a: PDF 생성 → Supabase Storage `storage_path`만 저장 (URL은 runtime 생성)
5. Phase 2b: 이메일 HTML 생성

Notification Policy:
- AlimTalk: report summary / scheduled_once reminder (10분 전) / recurring reminder / payment receipt
- In-app: upgrade CTA / announcements
- Email: Phase 2b only

### 8.7 Multilingual Strategy (Phase 2b)

Launch order: `JA -> ZH -> DE -> ES`

- `language = en` → Flux
- `language != en` → Nova-3 multilingual
- prompt registry / QA checklist / voice QA 없으면 UI 노출 금지

---

## 9. Data Model

### 9.1 Core Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone_encrypted TEXT,
  phone_last4 TEXT,
  phone_e164_hash TEXT UNIQUE,
  phone_country_code TEXT DEFAULT '+82',
  phone_verified BOOLEAN DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  plan_code TEXT DEFAULT 'free',
  trial_calls_remaining INTEGER DEFAULT 3,
  paid_minutes_balance INTEGER DEFAULT 0,
  native_lang TEXT DEFAULT 'ko',
  notification_kakao BOOLEAN DEFAULT true,
  notification_email BOOLEAN DEFAULT false,
  streak_days INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE [v3.1]:
-- trial_calls_remaining / paid_minutes_balance 는 조회 최적화를 위한 cached projection이다.
-- allowance의 source of truth는 credit_ledger 이며,
-- projection 값은 ledger write와 같은 transaction 안에서 갱신한다.

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NOTE [v3.1]: call_id UNIQUE는 단일 call 가정. 재시도 로직 추가 시 calls 별도 테이블 분리 검토.
  call_id TEXT UNIQUE,
  -- status는 lifecycle + terminal outcome을 표현한다.
  -- 예: draft, ready, scheduled, dialing, ringing, in_progress, ending,
  --     completed, no_answer, busy, voicemail, user_cancelled, provider_error, schedule_missed
  status TEXT NOT NULL DEFAULT 'draft',
  status_detail TEXT,
  contact_mode TEXT NOT NULL DEFAULT 'immediate', -- immediate | scheduled_once
  language TEXT NOT NULL,
  exam TEXT NOT NULL,
  level TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_target_minutes INTEGER NOT NULL,
  timezone TEXT DEFAULT 'Asia/Seoul',
  scheduled_for_at_utc TIMESTAMPTZ,
  dispatch_deadline_at_utc TIMESTAMPTZ,
  reminder_at_utc TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_version TEXT,
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_call_sid TEXT,
  reserved_trial_call BOOLEAN DEFAULT false,
  reserved_minutes INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  report_status TEXT DEFAULT 'not_requested',
  -- provider/internal detail only. terminal outcome 자체를 대체하지 않는다.
  failure_reason TEXT,
  -- Twilio status callback monotonic 처리용
  last_provider_sequence_number INTEGER DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'ai'
  content TEXT NOT NULL,
  -- 통화 시작 시각 기준 상대값 (milliseconds)
  timestamp_ms BIGINT,
  is_final BOOLEAN DEFAULT true,
  stt_confidence NUMERIC,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  grammar_score INTEGER,
  vocabulary_score INTEGER,
  fluency_score INTEGER,
  topic_score INTEGER,
  total_score INTEGER,
  level_assessment TEXT,
  score_delta INTEGER,
  grammar_corrections JSONB,
  vocabulary_analysis JSONB,
  fluency_metrics JSONB,
  scoring_version TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  summary_text TEXT,
  recommendations JSONB,
  storage_path TEXT,
  kakao_status TEXT,
  kakao_sent_at TIMESTAMPTZ,
  email_status TEXT,
  email_sent_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  attempt_count INTEGER DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekdays INTEGER[] NOT NULL,
  local_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  session_config JSONB NOT NULL,
  next_run_at_utc TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,      -- 'trial_call' | 'paid_minute'
  entry_kind TEXT NOT NULL,     -- 'grant' | 'reserve' | 'release' | 'commit' | 'refund'
  delta INTEGER NOT NULL,       -- signed; commit row는 0 허용
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_krw INTEGER NOT NULL,
  included_minutes INTEGER NOT NULL DEFAULT 0,
  trial_calls INTEGER NOT NULL DEFAULT 0,
  max_session_minutes INTEGER NOT NULL DEFAULT 10,
  entitlements JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT UNIQUE NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,      -- 'twilio' | 'kakao' | 'payments'
  event_type TEXT NOT NULL,
  -- dedupe_key 생성 규칙:
  --   Twilio status callback : 'twilio:status:{CallSid}:{SequenceNumber}'
  --     예) 'twilio:status:CA1234567890abcdef:3'
  --   Twilio media event     : 'twilio:media:{CallSid}:{sequence}'
  --   결제 provider webhook  : '{provider}:{event_type}:{provider_event_id}'
  --     예) 'toss:payment.completed:pmt_abc123'
  --   카카오 AlimTalk 결과   : 'kakao:alimtalk_result:{message_id}'
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**credit_ledger semantics**

- `credit_ledger`는 immutable event log다.
- `grant` / `reserve` / `release` / `commit` / `refund`를 append-only로 기록한다.
- `users.trial_calls_remaining`, `users.paid_minutes_balance`는 cached projection일 뿐 source of truth가 아니다.
- current available allowance는 ledger 전체의 누적 결과와 projection을 통해 계산한다.
- v3.0의 `status IN ('reserved','committed')` 기반 합산 규칙은 사용하지 않는다.

### 9.2 Indexes

```sql
CREATE UNIQUE INDEX uniq_active_session_per_user
ON sessions(user_id)
WHERE status IN ('dialing', 'ringing', 'in_progress', 'ending');

CREATE UNIQUE INDEX uniq_one_upcoming_scheduled_session_per_user
ON sessions(user_id)
WHERE status = 'scheduled';

CREATE INDEX idx_sessions_user_created_at
ON sessions(user_id, created_at DESC);

CREATE INDEX idx_messages_session_sequence
ON messages(session_id, sequence_no);

CREATE INDEX idx_reports_ready_at
ON reports(ready_at DESC);

CREATE INDEX idx_recurring_schedules_next_run
ON recurring_schedules(next_run_at_utc)
WHERE status = 'active';

CREATE INDEX idx_sessions_reminder
ON sessions(reminder_at_utc)
WHERE status = 'scheduled' AND reminder_sent = false;

CREATE INDEX idx_credit_ledger_user_unit_created_at
ON credit_ledger(user_id, unit_type, created_at DESC);

CREATE INDEX idx_sessions_provider_sequence
ON sessions(provider_call_sid, last_provider_sequence_number);
```

### 9.3 RLS Policy Pattern

- `users`: 자기 레코드만 접근
- `sessions`, `reports`, `recurring_schedules`, `credit_ledger`: `user_id` 기준 접근
- background worker: service role 사용

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users USING (clerk_user_id = auth.jwt()->>'sub');
```

---

## 10. Cost Model & Pricing Principles

### 10.1 Published Vendor Inputs

| Item | Published Unit | Notes |
|---|---|---|
| Twilio KR mobile outbound voice | $0.0368 / min | mobile 가정 |
| Twilio Media Streams | $0.0040 / min | realtime media |
| Deepgram Flux | $0.0077 / min | Phase 1 STT |
| Deepgram Nova-3 multilingual | $0.0092 / min | Phase 2b STT |
| Twilio Verify | $0.05 / successful verification | channel fee 별도 |
| KR SMS outbound | $0.0494 / SMS | Verify SMS 참고 |
| Claude Sonnet 4.5 | $3 / MTok input, $15 / MTok output | token priced |
| ElevenLabs Flash/Turbo | $0.06 / 1K chars | character priced |

### 10.2 Hard Baseline

`0.0368 + 0.0040 + 0.0077 = $0.0485 / min`

- 10분 세션 baseline = **$0.485**
- 15분 세션 baseline = **$0.7275**

TTS와 LLM은 character/token 기반 과금이므로 session telemetry 기반으로 별도 추정한다.

### 10.3 Pricing Principles

1. paid plan은 **included minutes 기준**으로 운영한다.
2. Free trial만 예외적으로 `3회 x 최대 10분` 구조를 유지한다.
3. `plans`는 DB-driven 으로 관리한다.
4. public price는 beta telemetry 2주 전까지 lock 금지
5. sub-₩10,000 plan은 현재 stack 기준 위험
6. exact TTS/LLM usage는 session telemetry 측정 후 반영
7. one-time scheduled callback은 allowance 안에 포함한다. 별도 surcharge는 없다.

### 10.4 Commercial Design (Illustrative Only)

- **Free:** 3 trial calls / max 10min per call / no recurring / no PDF / no email
- **Basic:** included minutes server-configured / `scheduled_once` 포함 / no recurring
- **Pro:** included minutes server-configured / `scheduled_once` + recurring + PDF + email

### 10.5 Finance Gating

확정 가격표는 아래 telemetry 확보 전까지 운영 상수로 유지한다.
- G1: provider-level call cost
- G2: LLM token median
- G3: TTS character median
- G4: report retry overhead
- G5: gross margin guardrail

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Item | Target |
|---|---|
| `POST /sessions` p99 | ≤ 500ms |
| `POST /calls/initiate` p99 | ≤ 500ms |
| call request → provider create success | ≤ 1s |
| answered → opening audio | ≤ 2s |
| user turn end → AI audio first byte | p95 ≤ 1.8s |
| report ready | p95 ≤ 60s |
| scheduled dispatch lag | p95 ≤ 2m |
| reminder dispatch lag | p95 ≤ 2m |
| home page load | p95 ≤ 2.0s |
| dashboard load (Phase 2a) | p95 ≤ 2.0s |

### 11.2 Reliability

- API availability: ≥ 99.5%
- webhook durable write success: ≥ 99.99%
- report retry: max 3 attempts
- raw provider event retention: 90 days
- one user active call: max 1
- one user upcoming scheduled_once: max 1
- graceful degradation: Kakao 실패 시 앱 내 리포트 계속 제공

### 11.3 Security

- phone number: envelope encryption / masking in UI
- provider webhook signature validation (`X-Twilio-Signature` HMAC)
- server-side only provider secrets
- signed URL expiry (runtime 생성, DB 미저장)
- admin action audit logging
- service-role only background workers

### 11.4 Privacy & Data Retention

- raw audio 저장: 사용자 명시적 동의(opt-in) 시에만
- raw audio retention: 30일
- transcript retention: 사용자 삭제 전까지
- report retention: 계정 유지 기간 동안
- account deletion 시 personal data purge workflow 필요

### 11.5 Telephony Constraints

- Phase 1: outbound call 발신 자체는 가능
- 수신자 화면의 발신번호가 국내 번호로 표시되지 않을 수 있음 (국제/비국내 번호)
- caller ID presentation은 Phase 1 success criteria에서 제외
- 국내 번호 안정 표기 전략은 유료 공개 전 필수 과제

### 11.6 Accessibility

- 기본 UI 언어: 한국어
- 영어 UI 토글: optional
- 최소 16px font
- 충분한 contrast
- 실시간 자막 제공
- 키보드 접근성 지원

### 11.7 Observability

- request_id / call_id / session_id / provider_call_sid correlation
- metrics:
  - call initiation success
  - answer rate
  - duration
  - turn latency
  - scheduled dispatch lag
  - reminder dispatch lag
  - report SLA
  - Kakao accepted rate
- structured logs / provider raw event archive
- alerting:
  - report backlog
  - webhook failure
  - scheduled dispatch miss
  - reminder miss
  - call error spikes

---

## 12. Out of Scope

| Item | Reason | Expected Phase |
|---|---|---|
| React Native 앱 | 웹 우선 검증 | Phase 3 |
| LMS 연동 | B2B complexity 높음 | Phase 3+ |
| 그룹 통화 / 멀티유저 학습 | 별도 제품 정의 필요 | Phase 4 |
| 영상/아바타 통화 | 범위 초과 | Phase 4+ |
| 자체 STT/TTS 모델 호스팅 | infra burden 큼 | Growth |
| 자체 전화번호/통신 스택 | MVP 범위 초과 | Later |
| 기업 관리자 콘솔 / 팀 대시보드 | B2B 전용 범위 | Phase 3 |

---

## 13. Open Questions

| ID | Question | Owner | Due | Status |
|---|---|---|---|---|
| OQ-01 | public paid launch 전 국내 발신번호 전략은? | PM + Dev | before Phase 2a end | 🔴 Open |
| OQ-02 | 결제 provider: Toss Payments vs Kakao Pay 우선순위? | PM | before Phase 2a build | 🔴 Open |
| OQ-03 | OPIC prompt/rubric의 시험 기관 IP 침해 legal redline? | Legal | Week 2 | 🔴 Open |
| OQ-04 | JA 이후 ZH vs DE 우선순위? | PM | before Phase 2b | 🔴 Open |

---

**Scope Lock Readiness:** v3.1 기준 Phase 1 구현 착수 가능
