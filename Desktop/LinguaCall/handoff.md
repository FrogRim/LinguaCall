# LinguaCall Handoff

Last updated: 2026-06-09

## Current state

Production stack is running on a VPS with Docker Compose.

- auth: Supabase Auth anonymous demo login; phone OTP code preserved but hidden from the public portfolio flow
- billing: Toss Payments implemented, checkout launch disabled by default for portfolio demo
- voice: browser WebRTC → OpenAI Realtime (PTT mode)
- database: Supabase Postgres
- deploy: `web + api + worker + caddy` on VPS

## What is deployed

Commit: `5f73fef` (billing return handling hardening)

Latest local changes pending deployment:
- public login now starts a Supabase anonymous demo session from `ScreenLogin.tsx`; `/#/verify` redirects away so phone OTP is not visible to interviewers
- free/demo session duration UI now follows the active plan limit, defaulting to 3 minutes for the portfolio cost profile
- OpenAI report-evaluation default model changed to `gpt-4.1-nano` for lower demo cost; env can still override
- OpenAI Realtime WebRTC now uses GA `client_secrets` on the API and `/v1/realtime/calls` in the browser. If the VPS still has `OPENAI_REALTIME_SESSION_URL=https://api.openai.com/v1/realtime/sessions`, the API rewrites that legacy default to `/v1/realtime/client_secrets`; prefer setting `OPENAI_REALTIME_CLIENT_SECRET_URL` explicitly.
- VPS web Docker builds now pass `VITE_BUILD_APPINTOSS=false` by default, so the portfolio build skips the heavy AppInToss Vite entry unless that flag is explicitly set to `true`.
- Supabase Auth/RLS alignment migration added: `packages/db/migrations/20260609_supabase_auth_rls_alignment.sql`
- billing UI/API now treat Toss as implemented-but-deferred: `ENABLE_TOSS_BILLING=false`, `VITE_ENABLE_TOSS_BILLING=false` keep checkout/payment launch/legacy confirm closed
- shared/api/worker TypeScript build scripts were tightened so build/typecheck failures are visible instead of masked

Previously deployed Supabase migrations:
  - `20260424_pending_billing_checkouts.sql`
  - `20260425_pending_billing_checkout_claim.sql`

All Phase 1–6 UX features are in production:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | PTT (Push-to-Talk) | ✅ |
| 2 | Session mode (준비/모의/실전) | ⚙️ 구현 완료, 미배포 — DB 마이그레이션 적용 필요 |
| 3 | Early exit keyword detection | ✅ |
| 4 | Session delete (terminal sessions) | ✅ |
| 5 | Report transcript highlighting | ✅ |
| 6 | Word dictionary popover | ✅ |
| — | UI aligned to DESIGN.md | ✅ |

## Architecture

```
Browser
  → Caddy (HTTPS)
    → web  (nginx serving Vite build)
    → api  (Express)
    → worker (async report + billing jobs)

api / worker → Supabase Postgres
web → Supabase Auth (anonymous demo sign-in; phone OTP hidden)
web → deferred billing surface; Toss/AppInToss payment launch requires explicit billing flags
web → OpenAI Realtime (WebRTC, PTT mode)
```

## Key files

```
infra/docker-compose.yml        — service definitions
infra/Caddyfile                 — reverse proxy config
infra/.env.production           — secrets (VPS only, gitignored)

apps/web/src/
  lib/webVoiceClient.ts         — Realtime client with PTT
  lib/pttHelpers.ts             — PTT pure helpers
  lib/highlightHelpers.ts       — grammar correction highlighting
  pages/ScreenSession.tsx       — session hub + live session
  pages/ScreenReport.tsx        — report with highlighting + dictionary
  components/layout/            — AppShell, AuthLayout, SectionCard

apps/api/src/
  routes/sessions.ts            — CRUD + DELETE
  routes/dictionary.ts          — GET /dictionary (gpt-4o-mini)
  modules/learning-sessions/    — repository pattern
  modules/auth/                 — Supabase token verification
```

## Deploy workflow

```bash
# 로컬
git add ... && git commit -m "..." && git push origin main

# VPS — 반드시 main 브랜치에서 실행
git checkout main   # ← 항상 먼저 확인 (saas-launch-refactor 등 다른 브랜치면 새 코드 안 들어옴)
git pull
docker compose --env-file infra/.env.production -f infra/docker-compose.yml build web api
docker compose --env-file infra/.env.production -f infra/docker-compose.yml up -d
```

## Next work

- Phase 2: stage/situation 선택 UI (준비/모의/실전 + 언어별 프리셋) — **session_mode 컬럼 추가 완료, UI 완료. Supabase SQL Editor에서 마이그레이션 실행 필요: `packages/db/migrations/20260510_session_mode.sql`**
- Supabase Dashboard에서 `Authentication > Sign In / Providers > Anonymous Sign-Ins` 활성화 필요. 공개 포트폴리오 데모는 Twilio/SMS 없이 이 경로로 로그인함
- Supabase SQL Editor에서 `packages/db/migrations/20260510_appintoss_session_limits.sql` 적용 필요. 이 migration이 free plan을 3분/평생 3회 데모 한도로 맞춤
- Supabase SQL Editor에서 `packages/db/migrations/20260609_supabase_auth_rls_alignment.sql` 적용 필요. 이 migration은 `users.clerk_user_id`가 raw Supabase sub 또는 `supabase:<sub>` 둘 다 매칭되도록 RLS를 정렬하고 `sessions.updated_at`을 보강함
- `/billing/apps-in-toss/payment-launch`는 최근 `/billing/apps-in-toss/verify-session` 성공 이력과 `ENABLE_TOSS_BILLING=true`가 모두 있어야만 열림
- Apps in Toss 운영 전환 시 `APPS_IN_TOSS_PARTNER_API_KEY`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `VITE_TOSS_CLIENT_KEY`를 모두 live 값으로 교체하고 `ENABLE_TOSS_BILLING=true`, `VITE_ENABLE_TOSS_BILLING=true`로 `web`/`api` 재빌드
- 운영 키 전환 후 Apps in Toss 내부에서 소액 실결제 1건으로 launch → webhook → 구독 반영까지 다시 확인
- **[미배포] AppInToss 월 세션 한도 마이그레이션 적용 필요** — 아래 섹션 참고

## Toss Payments 결제 — 구현 완료, 포트폴리오 데모에서는 결제 진입 비활성

### 배경

결제 채널을 이원화하기로 결정했다:
- **AppInToss 앱**: AppInToss의 tosspay API 사용 (플랫폼 필수 요건)
- **PC 웹 브라우저**: 일반 Toss Payments SDK 사용

구독(정기결제)은 빌링키 관리가 필요하고 Toss 심사 기준이 까다롭기 때문에,
백엔드·프론트엔드 코드는 모두 작성해두되 포트폴리오 공개 상태에서는 **결제 진입 전체를 flag로 막아둔 상태**다.

### 현재 구현 상태

**백엔드** (`apps/api/src/routes/billing.ts`)
- `POST /billing/checkout` — `ENABLE_TOSS_BILLING=false` 기본값에서는 403 반환.
- `POST /billing/toss/confirm` — legacy web confirm도 403 반환. 포트폴리오 데모에서 자동 confirm 없음.
- `POST /billing/apps-in-toss/verify-session` — AppInToss OAuth 검증. 활성화됨.
- `POST /billing/apps-in-toss/payment-launch` — verify-session 성공 + `ENABLE_TOSS_BILLING=true`가 모두 있어야 결제 세션 생성.

**프론트엔드** (`apps/web/src/features/billing/checkout.ts`)
- `resolveBillingLaunch()` — `paymentEnabled=false`면 web/AppInToss 모두 결제 보류 메시지 반환.
- `isTossBillingEnabled()` — `VITE_ENABLE_TOSS_BILLING === "true"`일 때만 결제 시작 허용.
- `startAppsInTossBillingLaunch()` — AppInToss 결제 시작 구현은 유지.
- `startWebBillingCheckout()` — `/billing/checkout` 호출 후 `BillingCheckoutSession` 반환. 구현됨, 미사용.
- `confirmWebBillingCheckout()` — 구현은 남아 있지만 `ScreenBilling`에서 자동 실행하지 않음.
- `BillingReturnState.channel` — `'web' | 'appintoss' | null`. tossRedirect 있으면 'web', checkoutResult만 있으면 'appintoss'.

**프론트엔드** (`apps/web/src/pages/ScreenBilling.tsx`)
- billing 페이지 상단에 포트폴리오 결제 보류 안내를 항상 표시.
- 플랜 버튼 클릭 시 `VITE_ENABLE_TOSS_BILLING=false`면 API 호출 없이 결제 보류 메시지만 표시.
- Toss legacy success/cancel 복귀 URL은 안내 후 URL 정리만 수행. confirm API 자동 호출 없음.

### 결제 활성화 방법 (나중에)

1. `infra/.env.production`에 아래 추가/수정:
   ```
   TOSS_SECRET_KEY=live_sk_...          # test → live
   TOSS_CLIENT_KEY=live_ck_...          # test → live
   VITE_TOSS_CLIENT_KEY=live_ck_...     # test → live
   ENABLE_TOSS_BILLING=true
   VITE_ENABLE_TOSS_BILLING=true
   BILLING_WEBHOOK_SECRET_TOSS=whsec_... # Toss 대시보드 > 웹훅에서 발급
   ```
   `ALLOWED_ORIGINS`와 `APP_BASE_URL`이 실제 앱 도메인과 일치하는지 확인 (콜백 URL 신뢰 검증에 사용됨).

2. 일반 웹 checkout까지 다시 열려면 `ScreenBilling.tsx`에서 `startWebBillingCheckout()` 호출 분기를 별도로 복구해야 한다. 현재 포트폴리오 공개 빌드는 Apps in Toss payment launch만 flag로 다시 열 수 있게 남겨둔 상태다.

3. `web`, `api` 이미지 재빌드 후 배포.

## Session Mode (준비/모의/실전) — 구현 완료, 미배포 (2026-05-10)

### 개요

세션 생성 폼에 학습 모드 선택(준비/모의/실전)을 추가했다. 모드에 따라 AI 교정 강도와 페르소나가 다르게 적용되며, `sessions.session_mode` 컬럼에 저장된다.

| 모드 | correctionMode | maxSentences | topicLock | AI 페르소나 |
|------|---------------|-------------|-----------|-----------|
| 준비 (practice) | aggressive | 4 | true | 친절, 설명 위주 |
| 모의 (mock, 기본값) | light_inline | 3 | true | 시험관 |
| 실전 (real) | none | 2 | false | 대화 흐름 최우선 |

### 배포 전 반드시 적용

```bash
psql $DATABASE_URL -f packages/db/migrations/20260510_session_mode.sql
```

또는 Supabase SQL Editor에서 해당 파일 내용 실행.

### 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `packages/db/migrations/20260510_session_mode.sql` | 신규 마이그레이션 |
| `packages/shared/src/contracts.ts` | `SessionMode` 타입, `Session.sessionMode`, `CreateSessionPayload.sessionMode`, `correctionMode` 유니온 확장 |
| `apps/api/src/services/sessionAccuracy.ts` | `applyModeOverrides` 함수 추가 |
| `apps/api/src/services/openaiRealtime.ts` | `buildConversationPolicyParts` 교정 모드 분기 |
| `apps/api/src/services/webVoiceSessionService.ts` | `applyModeOverrides` 적용 |
| `apps/api/src/storage/inMemoryStore.ts` | `DbSessionRow.session_mode`, `mapSession`, `createSession` INSERT, `startWebVoiceCall` |
| `apps/api/src/routes/sessions.ts` | Zod 스키마에 `sessionMode` 추가 |
| `apps/web/src/pages/ScreenSession.tsx` | 폼 하단 모드 셀렉트 + 카드 뱃지 |
| `apps/web/src/i18n/locales/ko.json`, `en.json` | `learningMode*` 키 추가 |

---

## AppInToss 월 세션 한도 과금 — 구현 완료, 미배포 (2026-05-10)

### 개요

AppInToss 플랫폼용 세션 횟수 기반 과금 모델을 추가했다. 기존 `paid_minutes_balance` (분 단위 풀) 로직은 그대로 유지하고, `monthly_session_limit > 0`인 플랜에서는 새 분기가 우선 적용된다.

### 플랜 구조

| 플랜 | 가격 | 세션 시간 | 월 한도 |
|------|------|----------|---------|
| free | 무료 | 3분 | 평생 3회 (trialCalls) |
| basic | ₩7,900 | 5분 | 월 10회 |
| pro | ₩15,900 | 15분 | 월 12회 |

### 마이그레이션 — 배포 전 반드시 적용

```bash
psql $DATABASE_URL -f packages/db/migrations/20260510_appintoss_session_limits.sql
```

이 마이그레이션이 하는 일:
- `plans` 테이블에 `monthly_session_limit INTEGER NOT NULL DEFAULT 0` 추가
- `users` 테이블에 `monthly_sessions_used INTEGER NOT NULL DEFAULT 0`, `monthly_period_start DATE` 추가
- `sessions` 테이블에 `reserved_monthly_session BOOLEAN NOT NULL DEFAULT false` 추가
- free / basic / pro 플랜 upsert

### 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `packages/db/migrations/20260510_appintoss_session_limits.sql` | 신규 마이그레이션 |
| `packages/shared/src/contracts.ts` | `UserProfile`에 `monthlySessionsUsed`, `monthlySessionLimit` 추가; `BillingPlan`에 `monthlySessionLimit` 추가 |
| `apps/api/src/storage/inMemoryStore.ts` | `startWebVoiceCall` 월 세션 분기, lazy 기간 리셋, `failWebVoiceBootstrap` 슬롯 환불 |
| `apps/api/src/modules/billing/repository.ts` | `mapPlan`에 `monthlySessionLimit` 추가 |
| `apps/api/src/modules/users/repository.ts` | `mapUserProfile`에 `monthlySessionsUsed`, `monthlySessionLimit` 추가 |
| `apps/web/src/pages/ScreenReport.tsx` | 무료 플랜 페이월 (문법 교정, 추천 사항 잠금) |
| `apps/web/src/pages/ScreenSession.tsx` | `AllowanceGate` — `insufficient_allowance` 에러 시 업그레이드 안내 화면 |
| `apps/web/src/pages/ScreenBilling.tsx` | `formatPlanFeatures`로 세션 횟수 모델 표기 |

### 알려진 제약

- `monthly_period_start` 리셋은 lazy evaluation (다음 세션 시작 시점에 평가). 월초에 카운터가 즉시 초기화되지 않음 — UX상 허용 범위.
- basic/pro 유저가 한도 초과 시 `insufficient_allowance` 에러 반환 → 프론트에서 `AllowanceGate`로 처리.

## AppInToss 분리 빌드 — 구현 완료 (2026-04-26)

### 개요

앱인토스 전용 Vite 엔트리(`appintoss.html`)를 분리해, Supabase Auth 없이 AppInToss OAuth → 자체 JWT로 인증하는 별도 빌드를 추가했다.

### 새로 추가된 파일

| 파일 | 역할 |
|------|------|
| `packages/db/migrations/20260426_apps_in_toss_user_key.sql` | `users.apps_in_toss_user_key TEXT UNIQUE` 컬럼 + 인덱스 |
| `apps/api/src/modules/auth/appsInTossJwt.ts` | HMAC-SHA256 JWT sign/verify (`APPS_IN_TOSS_JWT_SECRET`) |
| `apps/api/src/routes/auth.ts` | `POST /auth/apps-in-toss/login` — OAuth → userKey → JWT 발급 |
| `apps/web/src/lib/appsInTossAuth.ts` | `AppsInTossAuthProvider` + `useAppsInTossAuth` hook |
| `apps/web/src/AppInToss.tsx` | AppInToss 전용 라우팅 (로그인 화면 없음, `/` → `/session`) |
| `apps/web/src/main-appintoss.tsx` | AppInToss 빌드 진입점 |
| `apps/web/appintoss.html` | AppInToss HTML 엔트리 |

### 수정된 파일

- `apps/api/package.json` — `jsonwebtoken`, `@types/jsonwebtoken` 추가
- `apps/api/src/middleware/auth.ts` — Supabase JWT 실패 시 AppInToss JWT 검증 시도
- `apps/api/src/index.ts` — `/auth` 라우터 등록
- `apps/web/vite.config.ts` — `build.rollupOptions.input`에 `appintoss.html` 추가
- `apps/web/src/context/UserContext.tsx` — `UserContext`, `UserContextValue` export 추가
- `apps/web/src/pages/ScreenBilling.tsx` — `appsInTossAvailable` 분기 제거 (웹 전용 단순화)

### 배포 시 필수 작업

1. **DB 마이그레이션 적용** (아직 VPS에 적용 안 됨):
   ```bash
   psql $DATABASE_URL -f packages/db/migrations/20260426_apps_in_toss_user_key.sql
   ```

2. **Caddy 라우팅 추가** — `/appintoss` 경로를 `appintoss.html`로 서빙:
   ```
   handle /appintoss* {
     root * /srv/web
     try_files {path} /appintoss.html
   }
   ```
   nginx는 이미 설정됨 (`apps/web/nginx.conf`).

3. **env var 확인** (VPS에 이미 추가됨):
   - `APPS_IN_TOSS_JWT_SECRET` — `openssl rand -hex 32`로 생성
   - `APPS_IN_TOSS_PARTNER_API_KEY` — Toss 파트너 콘솔에서 발급

4. `web`, `api` 이미지 재빌드 후 배포.

### 알려진 제약

- AppInToss 유저와 웹 유저는 별도 계정 (연동 미지원, 나중에 phone_e164_hash 기준으로 연동 가능)
- AppInToss JWT TTL 24h — 웹뷰 세션이 24시간 이상 열려있으면 재로그인 필요

## Archival

`handoff.md`의 이전 내용(Twilio/Clerk 시절 개발 로그)은 git 히스토리에서 확인 가능.
