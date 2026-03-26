# LinguaCall Architecture Overview

This document describes the current active runtime path for LinguaCall.

If another document conflicts with this one, prefer this file, `README.md`, and the runbooks in `docs/runbooks/`.

## 1. Current product shape

LinguaCall is a self-hosted Korean-market MVP for short AI speaking practice sessions.

Current launch assumptions:

- auth: Supabase Auth phone OTP
- session auth: Supabase access and refresh session in the browser, bearer auth to the API
- billing: Toss only
- voice runtime: browser WebRTC directly to OpenAI Realtime
- database: Supabase Postgres
- deploy: VPS with Docker Compose and Caddy

## 2. Top-level architecture

```text
Browser
  -> Caddy
    -> web
    -> api
    -> worker

api / worker
  -> Supabase Postgres

web
  -> Supabase Auth
  -> Toss widget
  -> OpenAI Realtime over WebRTC
```

External providers in the active path:

- Supabase
- OpenAI
- Toss Payments
- Twilio through Supabase Phone Auth

## 3. Repository layout

- `apps/web`
  - React/Vite frontend
- `apps/api`
  - Express API
- `apps/worker`
  - async worker and scheduler loops
- `packages/shared`
  - shared contracts and types
- `packages/db`
  - SQL migrations
- `infra`
  - Docker Compose and Caddy config
- `docs`
  - runbooks, plans, specs, reports

## 4. Frontend structure

Key files:

- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/context/UserContext.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/supabaseAuth.ts`

### Routes

- `/#/`
  - landing and login start
- `/#/verify`
  - phone OTP verification
- `/#/session`
  - session hub, live session, history
- `/#/billing`
  - plan and checkout flow
- `/#/report/:reportId`
  - report detail
- `/#/privacy`
  - privacy page
- `/#/terms`
  - terms page

### Frontend auth model

The frontend no longer uses the old custom `/auth/otp/*` route family for active login.

Current flow:

1. `supabaseAuth.ts` requests phone OTP from Supabase
2. `supabaseAuth.ts` verifies the OTP with Supabase
3. access and refresh tokens are stored locally
4. protected API calls use `Authorization: Bearer <token>`
5. on expiry, the web app refreshes the session with Supabase and retries once

### Main UI surfaces

#### Login and verify

- `ScreenLogin.tsx`
- `ScreenVerify.tsx`

Purpose:

- enter the product
- request phone OTP
- verify OTP
- continue into the app

#### Session hub

- `ScreenSession.tsx`

Purpose:

- create a session
- start a live speaking session
- view current and historical sessions
- jump to reports

#### Billing

- `ScreenBilling.tsx`

Purpose:

- show plan state
- compare plans
- start Toss checkout
- confirm post-payment subscription state

#### Report

- `ScreenReport.tsx`

Purpose:

- show session score
- show summary and corrections
- show recommendations for next practice

## 5. Backend structure

Key files:

- `apps/api/src/index.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/storage/inMemoryStore.ts`
- `apps/api/src/modules/auth/supabase.ts`

### API route groups

- `/users`
  - current user profile and preferences
- `/sessions`
  - session creation, listing, detail, report access
- `/calls`
  - live voice bootstrap, join, runtime events, completion, end
- `/billing`
  - plans, checkout, Toss confirm and webhook
- `/reports`
  - report access
- `/workers`
  - manual worker trigger

### Backend auth model

`requireAuthenticatedUser` in `middleware/auth.ts` is the active authorization gate.

Current flow:

1. API reads bearer token from the `Authorization` header
2. API verifies the token against Supabase Auth
3. API maps the Supabase user id to an internal user row
4. downstream routes use the internal user id for data access

Important:

- authorization is still primarily enforced in the API layer
- RLS exists in the database, but it is not the primary active user-isolation boundary yet

## 6. Data model

Database is Supabase-managed Postgres, accessed from the app via `pg`.

Important tables in the active path:

- `users`
  - internal user identity and profile
- `plans`
  - subscription plan catalog
- `subscriptions`
  - active billing state
- `credit_ledger`
  - credit and billing history
- `learning_sessions`
  - practice session records
- `session_messages`
  - transcript/message entries
- `reports`
  - generated report payloads
- `call_runtime_events`
  - runtime event persistence

Legacy auth-oriented tables from the old app-managed flow may still exist in the database, but they are no longer part of the active login path.

## 7. Voice runtime

Current voice path:

1. browser requests live-session bootstrap data from the API
2. browser connects directly to OpenAI Realtime over WebRTC
3. browser sends runtime/completion events back to the API
4. API marks the session for async report processing
5. worker generates the report later

Twilio PSTN/media-stream code may still exist in the repository, but it is not the primary MVP runtime path.

## 8. Billing runtime

Current billing path:

1. web requests checkout data from the API
2. web launches Toss checkout
3. Toss returns to the app
4. web calls API confirm route
5. API updates `subscriptions` and ledger state

The app is Toss-only in the active launch path.

## 9. Deploy architecture

Runtime services in Docker Compose:

- `web`
  - static frontend served by nginx
- `api`
  - Express API
- `worker`
  - async background processor
- `caddy`
  - reverse proxy and HTTPS termination

Data services:

- Supabase Postgres

## 10. Required environment categories

### Frontend build-time

- `VITE_API_BASE_URL`
- `VITE_TOSS_CLIENT_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### API runtime

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_*`
- `TOSS_*`
- `WORKER_SHARED_SECRET`

### Worker runtime

- `DATABASE_URL`
- `OPENAI_*`
- `API_BASE_URL`
- `WORKER_SHARED_SECRET`

## 11. Current security boundary

Current active security model:

- user identity comes from Supabase Auth
- protected API access is bearer-token based
- API maps Supabase user identity to internal database users
- database RLS is a secondary guard, not the primary enforcement point

This is the main nuance to keep in mind when reviewing security or data access behavior.

## 12. Active vs archival

Active:

- Supabase Auth phone OTP
- Toss billing
- OpenAI Realtime browser voice
- VPS self-hosted deploy

Archival or secondary:

- Clerk
- Stripe
- Railway
- Vercel
- SOLAPI login path
- app-managed cookie auth
- Twilio PSTN/media-stream runtime
