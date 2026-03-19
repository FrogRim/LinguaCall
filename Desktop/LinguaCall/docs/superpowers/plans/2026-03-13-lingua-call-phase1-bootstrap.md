# Phase 1 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if available) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a runnable Phase-1 bootstrap codebase (monorepo structure, shared domain contract, session APIs, and minimal web screens) from the existing PRD/engineering breakdown.

**Architecture:** Keep the workspace split by responsibility: shared domain enums/contracts, backend API (Express + in-memory state for bootstrap), and web screens for first 3 user touchpoints. Avoid over-implementing media/runtime/worker/reporting until schema and contracts are locked.

**Tech Stack:** TypeScript, Node.js, Express, Vite.

---

### Task 1: Repository scaffold and workspace

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`.

- [ ] **Step 1: Define workspace scripts and TypeScript base config**
  - `package.json`
  - `tsconfig.base.json`
  - `pnpm-workspace.yaml`

### Task 2: Shared domain contract package

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/src/enums.ts`, `packages/shared/src/contracts.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: Define `SessionStatus`, `ContactMode`, and API payload contracts**
- [ ] **Step 2: Export domain contracts from shared index**

### Task 3: DB baseline migration assets

**Files:**
- Create: `packages/db/package.json`, `packages/db/migrations/20260313_phase1_init.sql`

- [ ] **Step 1: Add Phase 1 schema for tables and indexes**
  - users, sessions, messages, evaluations, reports, recurring_schedules, credit_ledger, plans, subscriptions, webhook_events
- [ ] **Step 2: Add Phase 1 required columns and constraints**
  - `sessions.last_provider_sequence_number`, `sessions.reminder_at_utc`, `sessions.reminder_sent`, `sessions.reminder_sent_at`, `credit_ledger.entry_kind`, `credit_ledger.metadata`

### Task 4: API in-memory bootstrap for `AUTH` and `API` slice

**Files:**
- Create: `apps/api/src/storage/inMemoryStore.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/users.ts`, `apps/api/src/routes/sessions.ts`, `apps/api/src/routes/calls.ts`, `apps/api/src/index.ts`

- [ ] **Step 1: Implement auth bootstrap + phone verification stubs**
  - `POST /users/me`
  - `GET /users/me`
  - `POST /users/phone/start`
  - `POST /users/phone/confirm`

- [ ] **Step 2: Implement phase-locked session APIs**
  - `POST /sessions`
  - `GET /sessions`
  - `GET /sessions/:id`
  - enforce EN/OPIC, scheduled constraints, one upcoming scheduled session

- [ ] **Step 3: Implement call initiation endpoint**
  - `POST /calls/initiate`
  - idempotent behavior via idempotency key + in-memory dedupe record
  - status transition checks (`ready|scheduled -> dialing`)

### Task 5: Web bootstrap screens (Screen 1~3)

**Files:**
- Create: `apps/web/src/main.ts`, `apps/web/src/styles.css`, `apps/web/src/screens/*` if needed

- [ ] **Step 1: Create screen navigation shell (Screen 1~3)**
  - Login bootstrap
  - phone verification flow
  - session config form with immediate vs scheduled_once
- [ ] **Step 2: Wire API calls to backend endpoints and show basic session list**

### Task 6: Initial run readiness

- [ ] **Step 1: Verify root package references all workspace package scripts**
- [ ] **Step 2: Confirm migration and API contract files exist**
