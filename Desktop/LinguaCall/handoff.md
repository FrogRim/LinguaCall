# LinguaCall Handoff

Last updated: 2026-04-25

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

## Archival

`handoff.md`의 이전 내용(Twilio/Clerk 시절 개발 로그)은 git 히스토리에서 확인 가능.
