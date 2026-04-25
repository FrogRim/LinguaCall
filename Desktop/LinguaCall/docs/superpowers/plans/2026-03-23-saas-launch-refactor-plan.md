# SaaS Launch Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert LinguaCall into a launch-ready Korean-market SaaS with phone OTP auth, Toss-only billing, and self-hosted web/api/worker deployment while preserving the existing realtime learning flow.

**Architecture:** Keep a modular monolith. Replace Clerk with app-managed phone OTP sessions, narrow billing to Toss only, split background work into a worker process, and move deployment to a single VPS while keeping Supabase as managed PostgreSQL and OpenAI as the realtime/evaluation provider.

**Tech Stack:** TypeScript, React 18, Express 4, PostgreSQL via `pg`, Zod, Vite, Docker Compose, Toss Payments SDK/API, SMS provider API, OpenAI Realtime API

---

## File Structure Lock

### Create

- `apps/api/src/modules/auth/routes.ts`
- `apps/api/src/modules/auth/service.ts`
- `apps/api/src/modules/auth/repository.ts`
- `apps/api/src/modules/auth/schema.ts`
- `apps/api/src/modules/auth/session.ts`
- `apps/api/src/modules/auth/cookies.ts`
- `apps/api/src/modules/billing/tossService.ts`
- `apps/api/src/modules/jobs/workerApp.ts`
- `apps/api/src/modules/jobs/reportJobs.ts`
- `apps/api/src/modules/jobs/schedulerJobs.ts`
- `apps/api/src/modules/shared/requestContext.ts`
- `apps/api/src/modules/shared/logger.ts`
- `apps/api/src/modules/shared/httpErrors.ts`
- `apps/api/src/modules/users/repository.ts`
- `apps/api/src/modules/billing/repository.ts`
- `apps/api/src/modules/reports/repository.ts`
- `apps/api/src/modules/learning-sessions/repository.ts`
- `apps/api/src/__tests__/authOtp.test.ts`
- `apps/api/src/__tests__/authSession.test.ts`
- `apps/api/src/__tests__/tossBilling.test.ts`
- `apps/api/src/__tests__/workerApp.test.ts`
- `apps/web/src/features/auth/AuthProvider.tsx`
- `apps/web/src/features/auth/sessionClient.ts`
- `apps/web/src/features/auth/pages/LoginPage.tsx`
- `apps/web/src/features/auth/pages/OtpVerifyPage.tsx`
- `apps/web/src/features/auth/hooks.ts`
- `apps/web/src/features/billing/BillingPage.tsx`
- `apps/web/src/features/live-session/LiveSessionPage.tsx`
- `apps/web/src/features/session-planning/SessionPlannerPage.tsx`
- `apps/web/src/features/reports/ReportPage.tsx`
- `apps/web/src/features/shared/apiClient.ts`
- `apps/web/src/features/shared/authFetch.ts`
- `apps/web/src/features/auth/__tests__/authFlow.test.tsx`
- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `apps/worker/src/index.ts`
- `infra/docker-compose.yml`
- `infra/Caddyfile`
- `docs/runbooks/vps-deploy.md`
- `packages/db/migrations/20260323_auth_sessions.sql`

### Modify

- `apps/api/src/index.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/sessions.ts`
- `apps/api/src/routes/calls.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/workers.ts`
- `apps/api/src/storage/inMemoryStore.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/context/UserContext.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/ScreenLogin.tsx`
- `apps/web/src/pages/ScreenVerify.tsx`
- `apps/web/src/pages/ScreenBilling.tsx`
- `apps/web/src/pages/ScreenSession.tsx`
- `apps/web/package.json`
- `apps/api/package.json`
- `package.json`
- `README.md`
- `handoff.md`

### Delete

- `apps/api/src/middleware/auth.ts`
- `apps/web/src/lib/clerkAuth.ts`
- `apps/web/src/lib/clerkAuth.test.ts`

### Reference

- `docs/superpowers/specs/2026-03-23-saas-launch-refactor-design.md`
- `packages/db/migrations/20260321_phone_otp.sql`
- `packages/shared/src/contracts.ts`

## Chunk 1: App-Managed Auth Foundation

### Task 1: Introduce Auth Module Skeleton

**Files:**
- Create: `apps/api/src/modules/auth/routes.ts`
- Create: `apps/api/src/modules/auth/service.ts`
- Create: `apps/api/src/modules/auth/repository.ts`
- Create: `apps/api/src/modules/auth/schema.ts`
- Create: `apps/api/src/modules/auth/session.ts`
- Create: `apps/api/src/modules/auth/cookies.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/authOtp.test.ts`

- [ ] **Step 1: Write the failing auth OTP route test**

```ts
import request from "supertest";
import app from "../index";

it("starts a phone OTP challenge", async () => {
  const response = await request(app)
    .post("/auth/otp/start")
    .send({ phone: "+821012345678" });

  expect(response.status).toBe(200);
  expect(response.body.ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts`
Expected: FAIL with missing route or module error

- [ ] **Step 3: Add minimal schema and route wiring**

```ts
export const StartOtpSchema = z.object({
  phone: z.string().min(8)
});
```

```ts
router.post("/otp/start", async (req, res) => {
  res.json({ ok: true, data: { challengeId: "placeholder" } });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/index.ts apps/api/src/__tests__/authOtp.test.ts
git commit -m "feat: add auth module skeleton"
```

### Task 2: Add OTP Persistence and Hashing

**Files:**
- Modify: `apps/api/src/modules/auth/repository.ts`
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/storage/inMemoryStore.ts`
- Create: `packages/db/migrations/20260323_auth_sessions.sql`
- Test: `apps/api/src/__tests__/authOtp.test.ts`

- [ ] **Step 1: Write the failing repository/service test for hashed OTP storage**

```ts
it("stores hashed OTP values instead of raw codes", async () => {
  const result = await authService.startOtp("+821012345678");
  const row = await authRepository.findLatestChallenge("+821012345678");

  expect(row?.code_hash).toBeDefined();
  expect(row?.code_hash).not.toContain(result.debugCode);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts`
Expected: FAIL because raw code handling is not implemented yet

- [ ] **Step 3: Implement OTP challenge storage and hashing**

```ts
const code = generateSixDigitCode();
const codeHash = createHash("sha256").update(code).digest("hex");
await repo.insertChallenge({ phoneE164, codeHash, expiresAt });
```

- [ ] **Step 4: Add migration for auth session tables**

```sql
create table if not exists auth_sessions (
  id uuid primary key,
  user_id uuid not null references users(id),
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/storage/inMemoryStore.ts packages/db/migrations/20260323_auth_sessions.sql
git commit -m "feat: persist hashed otp challenges"
```

### Task 3: Add OTP Verify and Cookie Session Issuance

**Files:**
- Modify: `apps/api/src/modules/auth/routes.ts`
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/session.ts`
- Modify: `apps/api/src/modules/auth/cookies.ts`
- Test: `apps/api/src/__tests__/authSession.test.ts`

- [ ] **Step 1: Write the failing session issuance test**

```ts
it("issues auth cookies after valid otp verification", async () => {
  const response = await request(app)
    .post("/auth/otp/verify")
    .send({ phone: "+821012345678", code: "123456" });

  expect(response.status).toBe(200);
  expect(response.headers["set-cookie"]).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- authSession.test.ts`
Expected: FAIL because verify/session cookies do not exist yet

- [ ] **Step 3: Implement verify flow and cookie helpers**

```ts
res.cookie("lc_access", accessToken, accessCookieOptions);
res.cookie("lc_refresh", refreshToken, refreshCookieOptions);
```

```ts
if (!repo.verifyChallenge(phoneE164, code)) {
  throw new AppError("validation_error", "invalid_verification_code_or_expired");
}
```

- [ ] **Step 4: Run auth tests**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts authSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/__tests__/authSession.test.ts
git commit -m "feat: issue app sessions from otp verification"
```

## Chunk 2: Replace Clerk Across API and Web

### Task 4: Introduce App Session Middleware and `/auth/me`

**Files:**
- Create: `apps/api/src/modules/shared/httpErrors.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/modules/auth/routes.ts`
- Delete: `apps/api/src/middleware/auth.ts`
- Test: `apps/api/src/__tests__/authSession.test.ts`

- [ ] **Step 1: Write failing `/auth/me` test**

```ts
it("returns the current user from app session cookies", async () => {
  const response = await request(app)
    .get("/auth/me")
    .set("Cookie", validSessionCookies);

  expect(response.status).toBe(200);
  expect(response.body.data.phoneVerified).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- authSession.test.ts`
Expected: FAIL with auth middleware missing

- [ ] **Step 3: Implement app session middleware and route migration**

```ts
export interface AuthenticatedRequest extends Request {
  userId: string;
}
```

```ts
const session = await authService.readSession(req);
if (!session) return res.status(401).json(...);
```

- [ ] **Step 4: Replace `req.clerkUserId` usage in `users.ts` with `req.userId`**

- [ ] **Step 5: Run auth tests**

Run: `pnpm --filter lingua-call-api test -- authSession.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/users.ts apps/api/src/modules/auth apps/api/src/modules/shared
git commit -m "refactor: replace clerk middleware with app session auth"
```

### Task 5: Replace Clerk on the Web

**Files:**
- Create: `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/sessionClient.ts`
- Create: `apps/web/src/features/auth/pages/LoginPage.tsx`
- Create: `apps/web/src/features/auth/pages/OtpVerifyPage.tsx`
- Create: `apps/web/src/features/auth/hooks.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/context/UserContext.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Delete: `apps/web/src/lib/clerkAuth.ts`
- Delete: `apps/web/src/lib/clerkAuth.test.ts`
- Test: `apps/web/src/features/auth/__tests__/authFlow.test.tsx`

- [ ] **Step 1: Write failing auth flow test**

```tsx
it("redirects unauthenticated users to phone login", async () => {
  render(<App />);
  expect(await screen.findByText(/phone/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-web typecheck`
Expected: FAIL or unresolved Clerk references remain

- [ ] **Step 3: Add app-managed auth provider and session bootstrap**

```tsx
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
}
```

- [ ] **Step 4: Rewrite `App.tsx` routes to use login and OTP pages instead of Clerk gates**

- [ ] **Step 5: Rewrite `api.ts` to rely on cookies with `credentials: "include"`**

```ts
await fetch(url, {
  credentials: "include",
  headers: { "Content-Type": "application/json" }
});
```

- [ ] **Step 6: Run web verification**

Run: `pnpm --filter lingua-call-web typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/features apps/web/src/lib/api.ts apps/web/src/context/UserContext.tsx
git commit -m "refactor: replace clerk web auth with otp session flow"
```

## Chunk 3: Narrow Billing to Toss Only

### Task 6: Remove Provider Selector From Web Billing

**Files:**
- Create: `apps/web/src/features/billing/BillingPage.tsx`
- Modify: `apps/web/src/pages/ScreenBilling.tsx`

- [ ] **Step 1: Remove provider state and selector UI**

- [ ] **Step 2: Make checkout requests provider-free and Toss-only**

```ts
const checkout = await api.post("/billing/checkout", {
  planCode,
  returnUrl,
  cancelUrl
});
```

- [ ] **Step 3: Run web verification**

Run: `pnpm --filter lingua-call-web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ScreenBilling.tsx apps/web/src/features/billing
git commit -m "refactor: simplify billing ui to toss only"
```

### Task 7: Remove Stripe and Generic Provider Paths From API

**Files:**
- Create: `apps/api/src/modules/billing/tossService.ts`
- Create: `apps/api/src/modules/billing/repository.ts`
- Modify: `apps/api/src/routes/billing.ts`
- Modify: `apps/api/src/storage/inMemoryStore.ts`
- Test: `apps/api/src/__tests__/tossBilling.test.ts`

- [ ] **Step 1: Write failing Toss-only API test**

```ts
it("rejects non-toss provider checkout requests", async () => {
  const response = await request(app)
    .post("/billing/checkout")
    .set("Cookie", validSessionCookies)
    .send({ planCode: "basic", provider: "stripe" });

  expect(response.status).toBe(422);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- tossBilling.test.ts`
Expected: FAIL because generic provider behavior still accepts multiple modes

- [ ] **Step 3: Implement Toss-only billing service**

```ts
if (payload.provider && payload.provider !== "toss") {
  throw new AppError("validation_error", "only toss is supported");
}
```

- [ ] **Step 4: Remove Stripe env and provider branching from repository logic**

- [ ] **Step 5: Run billing tests**

Run: `pnpm --filter lingua-call-api test -- tossBilling.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/modules/billing apps/api/src/storage/inMemoryStore.ts
git commit -m "refactor: narrow billing to toss only"
```

## Chunk 4: Split Worker From API

### Task 8: Extract Worker Batch Loop Into Dedicated Entry Point

**Files:**
- Create: `apps/api/src/modules/jobs/workerApp.ts`
- Create: `apps/api/src/modules/jobs/reportJobs.ts`
- Create: `apps/api/src/modules/jobs/schedulerJobs.ts`
- Create: `apps/api/src/__tests__/workerApp.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/workers.ts`
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/index.ts`

- [ ] **Step 1: Write failing worker loop test**

```ts
it("runs scheduled jobs without starting the API server", async () => {
  const result = await runWorkerBatchOnce();
  expect(result).toHaveProperty("dispatched");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- workerApp.test.ts`
Expected: FAIL because the batch loop only exists inside `index.ts`

- [ ] **Step 3: Move batch logic into reusable job modules**

```ts
export async function runWorkerBatchOnce(limit: number) {
  return {
    dispatched: await store.dispatchDueScheduledSessions(limit),
    reminders: await store.sendDueReminders(limit)
  };
}
```

- [ ] **Step 4: Wire `apps/worker/src/index.ts` to schedule the batch loop**

- [ ] **Step 5: Remove worker scheduling from API bootstrap**

- [ ] **Step 6: Run worker/API tests**

Run: `pnpm --filter lingua-call-api test -- workerApp.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/jobs apps/api/src/index.ts apps/worker apps/api/src/__tests__/workerApp.test.ts
git commit -m "refactor: split background jobs into worker app"
```

## Chunk 5: Async Report Completion

### Task 9: Stop Generating Reports Inline During Runtime Completion

**Files:**
- Modify: `apps/api/src/routes/calls.ts`
- Modify: `apps/api/src/storage/inMemoryStore.ts`
- Modify: `apps/api/src/modules/jobs/reportJobs.ts`
- Modify: `apps/api/src/routes/reports.ts`
- Test: `apps/api/src/__tests__/reportEvaluator.test.ts`

- [ ] **Step 1: Write failing completion-path test**

```ts
it("marks session complete before report generation finishes", async () => {
  const result = await completeRuntimeCall(sessionId, payload);
  expect(result.status).toBe("completed");
  expect(result.reportStatus).toBe("pending");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- reportEvaluator.test.ts`
Expected: FAIL because report work is still inline

- [ ] **Step 3: Change completion flow to enqueue report generation**

```ts
await reportJobs.enqueueReportGeneration({ sessionId });
return { status: "completed", reportStatus: "pending" };
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter lingua-call-api test -- reportEvaluator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/calls.ts apps/api/src/storage/inMemoryStore.ts apps/api/src/modules/jobs/reportJobs.ts apps/api/src/routes/reports.ts
git commit -m "refactor: make report generation asynchronous"
```

## Chunk 6: Decompose the God Object by Domain

### Task 10: Extract User and Billing Repository Surfaces

**Files:**
- Create: `apps/api/src/modules/users/repository.ts`
- Create: `apps/api/src/modules/billing/repository.ts`
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/routes/billing.ts`
- Modify: `apps/api/src/storage/inMemoryStore.ts`
- Test: `apps/api/src/__tests__/tossBilling.test.ts`

- [ ] **Step 1: Write a failing repository usage test or route test that uses the new abstraction**

```ts
it("loads a user through the users repository", async () => {
  const user = await usersRepository.getById(userId);
  expect(user?.id).toBe(userId);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter lingua-call-api test -- tossBilling.test.ts`
Expected: FAIL or repository not found

- [ ] **Step 3: Move only user and billing SQL calls behind focused repository files**

- [ ] **Step 4: Keep `inMemoryStore.ts` as a compatibility layer while shrinking it**

- [ ] **Step 5: Run tests**

Run: `pnpm --filter lingua-call-api test -- tossBilling.test.ts authSession.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/users/repository.ts apps/api/src/modules/billing/repository.ts apps/api/src/routes/users.ts apps/api/src/routes/billing.ts apps/api/src/storage/inMemoryStore.ts
git commit -m "refactor: extract user and billing repositories"
```

### Task 11: Extract Session and Report Repository Surfaces

**Files:**
- Create: `apps/api/src/modules/learning-sessions/repository.ts`
- Create: `apps/api/src/modules/reports/repository.ts`
- Modify: `apps/api/src/routes/sessions.ts`
- Modify: `apps/api/src/routes/reports.ts`
- Modify: `apps/api/src/routes/calls.ts`
- Modify: `apps/api/src/storage/inMemoryStore.ts`
- Test: `apps/api/src/__tests__/sessionSchema.test.ts`

- [ ] **Step 1: Write failing route-level regression tests around session creation/report fetch**

- [ ] **Step 2: Run tests**

Run: `pnpm --filter lingua-call-api test -- sessionSchema.test.ts`
Expected: FAIL or unchanged dependency surface

- [ ] **Step 3: Move session/report SQL access to module repositories**

- [ ] **Step 4: Re-run tests**

Run: `pnpm --filter lingua-call-api test -- sessionSchema.test.ts reportEvaluator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/learning-sessions/repository.ts apps/api/src/modules/reports/repository.ts apps/api/src/routes/sessions.ts apps/api/src/routes/reports.ts apps/api/src/routes/calls.ts apps/api/src/storage/inMemoryStore.ts
git commit -m "refactor: extract session and report repositories"
```

## Chunk 7: Deployment Migration

### Task 12: Add Self-Hosted Deployment Assets

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/Caddyfile`
- Create: `docs/runbooks/vps-deploy.md`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write down the container topology in the deploy runbook**

```md
services:
  caddy
  web
  api
  worker
```

- [ ] **Step 2: Add Compose definitions for web, api, worker, and reverse proxy**

- [ ] **Step 3: Add VPS deployment instructions**

- [ ] **Step 4: Verify compose file syntax**

Run: `docker compose -f infra/docker-compose.yml config`
Expected: Valid rendered compose output

- [ ] **Step 5: Commit**

```bash
git add infra/docker-compose.yml infra/Caddyfile docs/runbooks/vps-deploy.md apps/api/package.json apps/web/package.json package.json
git commit -m "ops: add self-hosted deployment assets"
```

## Chunk 8: Launch Hardening and Cleanup

### Task 13: Remove Dead Vendor Paths and Env Surface

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/config/deploymentReadiness.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `README.md`
- Modify: `handoff.md`

- [ ] **Step 1: Remove Clerk, Stripe, Railway, Vercel, and Sentry references from launch docs/config**

- [ ] **Step 2: Update readiness checks for the new required env set**

- [ ] **Step 3: Run targeted tests and typechecks**

Run: `pnpm --filter lingua-call-api test -- authOtp.test.ts authSession.test.ts tossBilling.test.ts workerApp.test.ts`
Expected: PASS

Run: `pnpm --filter lingua-call-web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/config/deploymentReadiness.ts apps/web/src/main.tsx README.md handoff.md
git commit -m "chore: remove deprecated vendor paths from launch surface"
```

### Task 14: Full Launch Verification

**Files:**
- Reference: `docs/runbooks/manual-screen-test-scenarios.md`
- Reference: `docs/runbooks/vps-deploy.md`
- Reference: `docs/superpowers/specs/2026-03-23-saas-launch-refactor-design.md`

- [ ] **Step 1: Run API targeted verification**

Run: `pnpm --filter lingua-call-api test`
Expected: Passing auth, billing, session, and worker tests required for launch

- [ ] **Step 2: Run web verification**

Run: `pnpm --filter lingua-call-web build`
Expected: Successful production build

- [ ] **Step 3: Perform manual end-to-end launch checks**

Run through:
- phone OTP sign-in
- Toss checkout success
- live session start
- runtime completion
- report pending to ready transition

- [ ] **Step 4: Capture launch checklist updates in docs**

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/manual-screen-test-scenarios.md docs/runbooks/vps-deploy.md
git commit -m "test: record launch verification checklist"
```

## Recommended Execution Order

1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 4
5. Chunk 5
6. Chunk 6
7. Chunk 7
8. Chunk 8

## Risks To Watch

- Auth cutover breaks existing protected routes because `req.clerkUserId` remains in hidden branches.
- OTP rate limiting and code expiry are too weak for production abuse patterns.
- Toss webhook idempotency fails during retries.
- `inMemoryStore.ts` extraction creates silent behavior regressions.
- Worker split changes timing behavior for reminders and report notifications.
- VPS deployment misses cookie/TLS settings and breaks auth in production.

## Stop Conditions

Pause execution and reassess if any of the following happens:

- auth tests require broad rewrites outside the auth surface
- Toss integration cannot express required subscription semantics
- realtime completion path depends too deeply on inline report generation
- deployment requires a media relay or additional stateful infrastructure before launch

Plan complete and saved to `docs/superpowers/plans/2026-03-23-saas-launch-refactor-plan.md`. Ready to execute?
