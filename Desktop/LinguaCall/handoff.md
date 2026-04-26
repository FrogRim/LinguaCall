# LinguaCall Handoff

Last updated: 2026-04-26

## Current state

Production stack is running on a VPS with Docker Compose.

- auth: Supabase Auth phone OTP
- billing: Toss Payments
- voice: browser WebRTC → OpenAI Realtime (PTT mode)
- database: Supabase Postgres
- deploy: `web + api + worker + caddy` on VPS

## What is deployed

Commit: `5f73fef` (billing return handling hardening)

Latest production changes:
- billing success/cancel/return copy polished for launch
- web billing now stays informational while Apps in Toss is the primary payment entry path
- browser-side checkout/confirm is no longer the primary release flow
- Supabase migrations applied:
  - `20260424_pending_billing_checkouts.sql`
  - `20260425_pending_billing_checkout_claim.sql`

All Phase 1–6 UX features are in production:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | PTT (Push-to-Talk) | ✅ |
| 2 | Stage/situation setup | ⏳ pending |
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
web → Supabase Auth (phone OTP)
web → Apps in Toss payment launch + Toss webhook sync
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

- Phase 2: stage/situation 선택 UI (준비/모의/실전 + 언어별 프리셋)
- `/billing/apps-in-toss/payment-launch`는 최근 `/billing/apps-in-toss/verify-session` 성공 이력이 있어야만 열림. 현재 구현은 `appLogin`으로 받은 `authorizationCode`/`referrer`를 서버에서 교환해 짧은 TTL 세션으로 검증함
- Apps in Toss 운영 전환 시 `APPS_IN_TOSS_PARTNER_API_KEY`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `VITE_TOSS_CLIENT_KEY`를 모두 live 값으로 교체 후 `web`/`api` 재빌드
- 운영 키 전환 후 Apps in Toss 내부에서 소액 실결제 1건으로 launch → webhook → 구독 반영까지 다시 확인

## 웹 Toss Payments 결제 — 구현 완료, 리디렉션만 비활성화 상태

### 배경

결제 채널을 이원화하기로 결정했다:
- **AppInToss 앱**: AppInToss의 tosspay API 사용 (플랫폼 필수 요건)
- **PC 웹 브라우저**: 일반 Toss Payments SDK 사용

구독(정기결제)은 빌링키 관리가 필요하고 Toss 심사 기준이 까다롭기 때문에,
백엔드·프론트엔드 코드는 모두 작성해두되 **결제창 진입 직전 단계만 의도적으로 막아둔 상태**다.

### 현재 구현 상태

**백엔드** (`apps/api/src/routes/billing.ts`)
- `POST /billing/checkout` — 웹용 체크아웃 세션 생성. 활성화됨.
- `POST /billing/toss/confirm` — Toss API 호출 → `claimPendingCheckout` → `completePendingCheckout` → `handleWebhook` 순서로 구독 활성화. 활성화됨.
- `POST /billing/apps-in-toss/verify-session` — AppInToss OAuth 검증. 활성화됨.
- `POST /billing/apps-in-toss/payment-launch` — AppInToss 결제 세션 생성. 활성화됨.

**프론트엔드** (`apps/web/src/features/billing/checkout.ts`)
- `startAppsInTossBillingLaunch()` — AppInToss 결제 시작. 사용 중.
- `startWebBillingCheckout()` — `/billing/checkout` 호출 후 `BillingCheckoutSession` 반환. 구현됨, 미사용.
- `confirmWebBillingCheckout()` — `/billing/toss/confirm` 호출. 구현됨, Toss 리디렉션 복귀 시 자동 실행됨.
- `BillingReturnState.channel` — `'web' | 'appintoss' | null`. tossRedirect 있으면 'web', checkoutResult만 있으면 'appintoss'.

**프론트엔드** (`apps/web/src/pages/ScreenBilling.tsx`)
- 웹 브라우저에서 플랜 버튼 클릭 시 → `copy.billing.planActionWebNote` 메시지만 표시하고 API 호출하지 않음.
- AppInToss 환경에서는 기존 흐름 그대로.
- Toss 리디렉션 복귀 감지(`shouldConfirm`) useEffect는 살아있음 — 나중에 웹 결제 열면 자동으로 confirm 처리됨.

### 웹 결제 활성화 방법 (나중에)

1. `infra/.env.production`에 아래 추가/수정:
   ```
   TOSS_SECRET_KEY=live_sk_...          # test → live
   TOSS_CLIENT_KEY=live_ck_...          # test → live
   VITE_TOSS_CLIENT_KEY=live_ck_...     # test → live
   BILLING_WEBHOOK_SECRET_TOSS=whsec_... # Toss 대시보드 > 웹훅에서 발급
   ```
   `ALLOWED_ORIGINS`와 `APP_BASE_URL`이 실제 앱 도메인과 일치하는지 확인 (콜백 URL 신뢰 검증에 사용됨).

2. `ScreenBilling.tsx`의 `handlePlanLaunch` 웹 분기에서 주석 부분을 실제 로직으로 교체:
   ```ts
   // 현재 (막힌 상태)
   } else {
     // web Toss checkout: backend ready, redirect intentionally disabled pending billing-key review
     setError(copy.billing.planActionWebNote);
   }

   // 교체할 내용
   } else {
     const session = await startWebBillingCheckout({
       apiPost: api.post,
       originUrl: window.location.origin + window.location.pathname,
       planCode
     });
     if (session.checkoutUrl) {
       window.location.href = session.checkoutUrl;
     } else {
       setError(copy.billing.launchFailedNotice);
     }
   }
   ```

3. `web`, `api` 이미지 재빌드 후 배포.

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
