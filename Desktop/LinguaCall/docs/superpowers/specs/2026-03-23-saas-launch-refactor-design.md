# SaaS Launch Refactor Design

**Goal:** Refactor LinguaCall into a launch-ready paid real-time conversation SaaS for the Korean market with phone OTP authentication, Toss-only billing, managed PostgreSQL, and self-hosted web/api/worker deployment.

## 1. Product Constraint

The target is not a demo-friendly MVP. The target is a service that can be launched, charged for, operated by one developer, and iterated without depending on a large number of external SaaS vendors.

The governing constraints are:

- Minimize the number of external SaaS dependencies.
- Keep the audio/AI experience strong enough for paid usage.
- Ship a Korean-market first version before adding global payment or social login.
- Favor operational clarity over feature breadth.
- Avoid a rewrite unless a boundary is already structurally broken.

## 2. Current Codebase Assessment

### 2.1 Runtime Dependencies

Current core external dependencies are:

- OpenAI for realtime voice bootstrap and report evaluation
- Clerk for auth and identity
- Supabase for managed PostgreSQL
- Railway for API hosting
- Vercel for web hosting
- Toss and Stripe for billing flows
- Sentry for monitoring
- Twilio as a legacy/optional provider path

### 2.2 Current Structural Issues

The codebase works as an MVP, but several design choices are wrong for the launch target:

- Auth is tightly bound to Clerk across API and web.
- Billing is over-generalized around multiple providers when the product only needs Korean billing now.
- `apps/api/src/storage/inMemoryStore.ts` is a god object containing user, session, billing, worker, call, report, and webhook logic.
- Background jobs run inside the API process via `setInterval`.
- The web session experience is concentrated in a single orchestration-heavy screen.
- Deployment assumes separate platform vendors for web and API.
- Optional or legacy integrations remain in the hot path and increase maintenance risk.

## 3. Architectural Decision

This refactor will use a **modular monolith transition**.

This means:

- One web app
- One API app
- One worker app
- One PostgreSQL database
- Clear internal module boundaries
- No microservices
- No immediate rewrite of all business logic

This is the correct tradeoff for a one-developer launch path. It preserves momentum, reduces vendor count, and creates boundaries that support later extraction if growth demands it.

## 4. Target External Dependency Map

### 4.1 Keep

- OpenAI
- Supabase, but only as managed PostgreSQL
- Toss Payments
- One SMS provider for OTP delivery

### 4.2 Remove

- Clerk
- Railway
- Vercel
- Stripe
- Sentry

### 4.3 Disable or Defer

- Twilio outbound/media-stream path
- Telegram notifier
- Kakao notifier, unless it becomes a required launch feature
- Provider-agnostic billing abstractions that only exist to support non-launch payment paths

## 5. Target Runtime Topology

### 5.1 Deployment Topology

Deploy on one VPS with Docker Compose:

- `reverse-proxy`
  - Caddy or Nginx
  - TLS termination
  - route `/api` to API
  - serve web build or proxy to web container
- `web`
  - static built React app
- `api`
  - Express application
- `worker`
  - background job processor

Managed externally:

- Supabase PostgreSQL
- OpenAI
- Toss
- SMS provider

### 5.2 Failure Domains

- If web crashes, API and worker stay up.
- If worker crashes, live sessions and login continue, while reminders/report notifications are delayed.
- If API crashes, web stays available as static assets but business functions fail.
- If Supabase/OpenAI/Toss/SMS fail, only the corresponding flow fails.

This is materially better than the current API-plus-worker coupling.

## 6. Target Product Flows

### 6.1 Auth and Identity

Authentication becomes **phone OTP only**.

Launch flow:

1. User enters phone number.
2. API creates an OTP challenge.
3. SMS provider sends code.
4. User confirms code.
5. API issues session cookies.
6. User proceeds to onboarding/session flow.

No social login. No Clerk user bootstrap. No email-first auth.

### 6.2 Billing

Billing becomes **Toss only**.

Launch billing flow:

1. User opens billing page.
2. Web requests checkout metadata from API.
3. Toss SDK launches payment flow.
4. API confirms payment.
5. API records subscription state and credit/entitlement changes.
6. Web refreshes subscription state.

No Stripe path. No provider selector. No auto provider routing.

### 6.3 Live Session

The realtime audio model remains browser-direct to OpenAI Realtime for now because:

- It is already implemented.
- It reduces infrastructure complexity.
- It avoids self-hosted media relay work before launch.

The server remains responsible for:

- user/session authorization
- policy issuance for realtime bootstrap
- session state transitions
- runtime event ingestion
- usage accounting
- transcript persistence
- report job enqueue

### 6.4 Reports

Call completion must stop doing expensive downstream work inline.

Required launch flow:

1. call runtime completes
2. transcript and terminal session state are persisted
3. report generation job is enqueued
4. worker evaluates transcript through OpenAI
5. report/evaluation tables are updated
6. UI polls or fetches report status

This separates the paid-user call experience from report-generation latency.

## 7. Target Module Boundaries

### 7.1 API Modules

Target module layout:

- `apps/api/src/modules/auth`
  - OTP start
  - OTP verify
  - refresh/logout
  - auth session validation
- `apps/api/src/modules/users`
  - profile read/update
  - UI language
  - account metadata
- `apps/api/src/modules/learning-sessions`
  - create/list/cancel
  - reservation state
  - session constraints
- `apps/api/src/modules/realtime`
  - OpenAI realtime bootstrap
  - runtime ingest
  - completion handoff
- `apps/api/src/modules/billing`
  - Toss checkout
  - Toss confirm/webhook
  - plan/subscription/ledger coordination
- `apps/api/src/modules/reports`
  - report job request
  - evaluation
  - report fetch
- `apps/api/src/modules/jobs`
  - scheduled dispatch
  - reminders
  - report-ready notifications

### 7.2 Shared Internal Layers

Each module should be split into:

- route layer
- service layer
- repository layer
- schema/validation layer

Rules:

- routes validate and map HTTP to services
- services contain domain rules
- repositories perform SQL access
- OpenAI/Toss/SMS integrations live behind adapter-like service files

### 7.3 Web Modules

Target web layout:

- `apps/web/src/features/auth`
  - phone input
  - OTP verification
  - auth session bootstrap
- `apps/web/src/features/session-planning`
  - create/list/start scheduled sessions
- `apps/web/src/features/live-session`
  - realtime voice UI
  - transcript state
  - terminal session handling
- `apps/web/src/features/billing`
  - Toss launch
  - subscription status
- `apps/web/src/features/reports`
  - report page and polling
- `apps/web/src/shared`
  - API client
  - auth storage/state
  - common hooks/utilities

## 8. Data Model Direction

The database stays in PostgreSQL, but the auth and billing model must be simplified.

### 8.1 Required Auth Tables

- `users`
  - `id`
  - `phone_e164`
  - `phone_verified_at`
  - `display_name`
  - `ui_language`
  - `created_at`
  - `updated_at`
- `phone_otp_challenges`
  - `id`
  - `phone_e164`
  - `code_hash`
  - `expires_at`
  - `attempt_count`
  - `consumed_at`
  - `created_at`
- `auth_sessions`
  - `id`
  - `user_id`
  - `refresh_token_hash`
  - `expires_at`
  - `revoked_at`
  - `ip`
  - `user_agent`
  - `created_at`

### 8.2 Billing Tables

Existing billing tables can stay if they are already viable, but the runtime model must be narrowed to Toss-only assumptions:

- subscription source is Toss
- webhook normalization only needs Toss event shapes
- plan entitlements remain internal
- ledger remains append-only

### 8.3 Session and Report Tables

Existing session/message/report tables remain valid, but the report generation flow should move to asynchronous job processing.

## 9. Security Model

### 9.1 Auth Security

Required launch decisions:

- use `httpOnly`, `secure`, `sameSite=lax` cookies for session credentials
- store only hashed refresh tokens
- hash OTP codes before persistence
- enforce OTP expiration and attempt limits
- rate-limit OTP start and verify endpoints
- log suspicious repeated attempts without storing raw codes

### 9.2 Authorization Model

Authorization becomes API-centric.

This means:

- the API is the primary security boundary
- database RLS is treated as defense-in-depth, not the primary application access model
- every authenticated route resolves `req.userId` from the app session instead of `req.clerkUserId`

### 9.3 Payment Security

Required launch controls:

- verify Toss callbacks and confirmation responses
- preserve raw webhook payloads
- make webhook handling idempotent
- never trust client-reported plan status
- update entitlements only from server-confirmed payment state

## 10. Operational Model

### 10.1 Logging

Replace Sentry-first thinking with strong baseline logging:

- structured JSON logs
- correlation IDs
- user ID, session ID, billing event ID, report ID where relevant
- log levels by flow

### 10.2 Monitoring

For launch, keep monitoring simple:

- container logs
- uptime probe
- disk and memory alerting
- failed worker job visibility
- periodic backup checks

### 10.3 Backups

Because PostgreSQL remains managed, app-side responsibilities are:

- environment backup
- deployment config backup
- restore runbook
- exportable migration history

## 11. Migration Strategy

Do not rewrite the system at once.

Use the following order:

1. Introduce internal auth abstraction while Clerk still exists.
2. Build phone OTP session auth in parallel.
3. Switch web and API to app-session auth.
4. Remove Clerk.
5. Simplify billing to Toss only.
6. Split worker from API.
7. Move deployment from Railway/Vercel to VPS.
8. Decompose the god object by module.

This order keeps revenue-critical and login-critical transitions controlled.

## 12. Current File Impact

### 12.1 Highest-Impact Existing Files

- `apps/api/src/index.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/sessions.ts`
- `apps/api/src/routes/calls.ts`
- `apps/api/src/routes/workers.ts`
- `apps/api/src/storage/inMemoryStore.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/context/UserContext.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/ScreenLogin.tsx`
- `apps/web/src/pages/ScreenVerify.tsx`
- `apps/web/src/pages/ScreenSession.tsx`
- `apps/web/src/pages/ScreenBilling.tsx`

### 12.2 Immediate Removal Candidates

- Clerk provider/bootstrap code
- Clerk auth helpers/tests
- Stripe-specific checkout paths
- provider selector UI
- Twilio runtime paths from default launch flow
- in-process worker scheduling from API entrypoint

## 13. Acceptance Criteria

This refactor is considered launch-ready when all of the following are true:

- users can sign up and sign in with phone OTP only
- session auth works without Clerk in both web and API
- users can pay using Toss and receive correct entitlements
- Stripe paths are removed from launch runtime
- web, api, and worker run on a VPS via Docker Compose
- background work no longer depends on API `setInterval`
- realtime session start, completion, and report generation still work end-to-end
- the app can be operated with only OpenAI, Supabase Postgres, Toss, and one SMS provider as external SaaS dependencies

## 14. Non-Goals For This Refactor

The following are explicitly out of scope for the launch refactor:

- global payment support
- Apple/Google/Kakao social login
- native mobile apps
- multi-region deployment
- media relay architecture
- microservice extraction
- replacing OpenAI

## 15. Final Recommendation

The correct launch architecture for this codebase is:

- modular monolith
- phone OTP auth
- Toss-only billing
- managed Postgres only
- self-hosted web/api/worker on one VPS
- browser-direct realtime audio retained for launch

This is the smallest architecture that is operationally credible, commercially usable, and maintainable by one developer without accumulating unnecessary external dependencies.
