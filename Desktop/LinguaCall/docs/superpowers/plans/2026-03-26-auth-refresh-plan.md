# Auth Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep users logged in for 30 days on the same device without repeated SMS OTP prompts.

**Architecture:** Reuse the existing SOLAPI OTP login and auth cookie model. Add refresh token rotation on the API and one-time 401 recovery on the web client so access token expiry becomes invisible to users.

**Tech Stack:** Express, pg, custom auth cookies, React, fetch-based API client, node:test / vitest

---

## Chunk 1: API refresh and revoke

### Task 1: Extend auth repository surface

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/repository.ts`

- [ ] Add repository interfaces for refresh session lookup, rotation, and revoke.
- [ ] Keep method names explicit around hashed refresh tokens.

### Task 2: Add failing auth route tests

**Files:**
- Modify: `apps/api/src/__tests__/authRoutes.test.ts`

- [ ] Add a failing test for `POST /auth/refresh` reissuing cookies from `lc_refresh`.
- [ ] Add a failing test for `POST /auth/logout` revoking current refresh session before clearing cookies.

### Task 3: Implement auth service refresh flow

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/repository.ts`

- [ ] Add refresh session validation and refresh-token rotation.
- [ ] Add logout revoke behavior.
- [ ] Keep access token lifetime at 1 hour and refresh lifetime at 30 days.

### Task 4: Wire refresh/logout routes

**Files:**
- Modify: `apps/api/src/modules/auth/routes.ts`

- [ ] Implement `POST /auth/refresh`.
- [ ] Update logout to revoke the stored refresh session when possible.

## Chunk 2: Web auto-refresh

### Task 5: Add failing API client tests

**Files:**
- Modify: `apps/web/src/lib/api.test.ts`

- [ ] Add a failing test for one-time refresh and request retry on `401`.
- [ ] Add a failing test for no infinite retry loop when refresh also fails.

### Task 6: Implement API client refresh retry

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] Add shared response parsing.
- [ ] Add one-time refresh retry path on `401`.
- [ ] Ensure refresh call itself never recursively retries.

### Task 7: Restore app session on boot

**Files:**
- Modify: `apps/web/src/context/UserContext.tsx`

- [ ] Update `refreshSession()` to try refresh before `/auth/me`.
- [ ] Keep logout redirect behavior unchanged.

## Chunk 3: Verification and rollout

### Task 8: Verify local tests

**Files:**
- No code changes required

- [ ] Run targeted auth tests that can execute in this environment.
- [ ] Run web typecheck.
- [ ] Record known local runner limits if any remain.

### Task 9: Deployment note

**Files:**
- Modify: `README.md`

- [ ] Add a short note that auth now keeps returning users signed in for 30 days via refresh cookies.
