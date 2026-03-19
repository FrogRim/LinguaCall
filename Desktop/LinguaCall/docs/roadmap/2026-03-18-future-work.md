# LinguaCall 향후 작업 로드맵
**작성일**: 2026-03-18
**기준 코드 상태**: React + WebVoice(OpenAI Realtime) + Express API + Supabase/Postgres

---

## 1. 현재 실제 구현 상태

### 완료 또는 MVP 사용 가능 수준
- Frontend React 18 + React Router + Tailwind/shadcn 스타일 UI
- ScreenLogin / ScreenVerify / ScreenSession / ScreenBilling / ScreenReport
- WebVoice 경로
  - `/calls/initiate`
  - `/calls/:id/join`
  - `/calls/:id/runtime-event`
  - `/calls/:id/runtime-complete`
- Mock billing flow
- PostgreSQL migration 기반 기본 데이터 모델
- shared contracts 정리
- local `.env` 자동 로드 (`apps/api/src/loadEnv.ts`)

### 아직 남은 핵심 작업
- Session 상태 자동 polling 마감
- 핵심 통합 테스트
- Zod 입력 검증
- 배포 설정
  - Vercel / Railway / Docker 중 최소 1개 확정
- `.env.example` 정리
- CI 파이프라인
- Stripe 실결제 연동
- Kakao / Telegram 실알림 연동
- 구조적 로깅 / 관측성
- 대시보드 API/UI

---

## 2. 우선순위 재정렬

현재 실제 코드 기준으로는 새 기능 추가보다 안정화가 우선이다.

### 1순위: MVP 안정화
- 깨진 UI 문자열 복구
- 운영용 에러 메시지 sanitize
- OpenAI realtime 기본 fallback 정렬
- env 로딩 우선순위 정리
- Session / Report pending polling 보강
- 수동 smoke 문서 정합성 회복

### 2순위: QA-001 핵심 통합 테스트
- session create
- webvoice initiate / runtime complete
- transcript 저장
- report 생성
- billing mock 조회/checkout

### 3순위: DEPLOY-001 배포 가능 상태
- `apps/web/vercel.json` 또는 동등 설정
- `apps/api/railway.toml` 또는 `Dockerfile`
- `.env.example`
- 기본 CI (`typecheck`, `build`)

### 4순위: API-HARD-001
- Zod 기반 request validation
- 422 응답 표준화

### 5순위: Phase 2a
- Dashboard API
- Dashboard UI
- Billing UX 개선

### 6순위: Phase 2b
- Stripe 실결제
- Kakao / Telegram 알림
- 다국어 확장
- Observability

---

## 3. 권장 스프린트 순서

### Sprint A - 지금 바로 필요한 안정화
- MVP-STABILIZE-001
  - UI string fix
  - users route error sanitize
  - openai/env alignment
  - session polling
- manual smoke 재실행

### Sprint B - 검증 가능 상태 확보
- QA-001 핵심 통합 테스트
- `.env.example` 작성
- 배포 전 최소 build/typecheck CI

### Sprint C - 배포 가능 상태
- DEPLOY-001
- staging 환경 smoke

### Sprint D - 후속 기능
- Dashboard
- Stripe
- Notification
- Logging / Sentry

---

## 4. 구현 메모

### WebVoice 우선
- Twilio PSTN 경로는 현재 MVP 주 경로가 아니다.
- 기본 사용 흐름은 browser mic + OpenAI Realtime WebRTC이다.

### Billing
- 현재 MVP 검증은 mock provider만으로도 가능하다.
- Stripe는 수동 smoke가 안정화된 뒤 붙인다.

### Notification
- Kakao/Telegram은 실연동 후순위다.
- 현재 worker / report-ready 경로는 구조만 유지한다.

---

## 5. 관련 문서
- `LinguaCall_engineering_task_breakdown_v1.md`
- `LinguaCall_PRD_v3.1_scope_locked.md`
- `docs/reports/2026-03-18-web-react-migration.md`
- `docs/runbooks/manual-screen-test-scenarios.md`
- `handoff.md`
