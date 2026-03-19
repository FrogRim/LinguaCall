# LinguaCall — Engineering Task Breakdown

**Companion to:** `LinguaCall_PRD_v3.1_scope_locked.md`  
**Audience:** Engineering, Tech Lead, PM, QA, Codex  
**Status:** Ready for implementation planning  
**Date:** 2026-03-13

---

## 1. Purpose

This document converts the scope-locked PRD into executable engineering work.

It is designed to answer five practical questions:
1. What must be built first for Phase 1 to work end-to-end?
2. Which tasks can run in parallel, and which are blocking dependencies?
3. Which tasks belong to backend, frontend, infra, data, or QA?
4. What is the definition of done for each task?
5. How should Codex or engineers sequence implementation without drifting outside scope?

This document is normative for **engineering sequence**, not for product scope. If this document conflicts with the PRD, the **PRD v3.1** is the product source of truth and this breakdown must be updated.

---

## 2. Scope Guardrails

### 2.1 Phase 1 must stay locked to:
- EN only
- OPIC only
- user-facing 10-minute sessions only
- immediate outbound call
- one-time scheduled callback (`scheduled_once`)
- app HTML report only
- Kakao AlimTalk summary only
- no payment UI
- no recurring schedule UI
- no multilingual UI
- no PDF download UI
- no dashboard charts

### 2.2 Out of scope for Phase 1 implementation
- paid plan checkout UI
- recurring schedules
- email reports
- multilingual prompts or UI
- pronunciation analytics
- PDF generation UI
- dashboard visualization
- public caller-ID guarantees

### 2.3 Codex execution rule
If a task is not required to satisfy a Phase 1 acceptance criterion or a dependency of that criterion, it should not be implemented in the Phase 1 branch.

---

## 3. Suggested Workstream Map

Use these workstream tags in tickets and PR names.

- `ARCH` — architecture and runtime decisions
- `DB` — migrations, schema, indices, RLS, seed data
- `AUTH` — sign-in, user profile bootstrap, OTP verification
- `API` — application APIs and request validation
- `CALL` — telephony, Twilio, call state transitions
- `MEDIA` — WebSocket runtime, STT, TTS, transcoder, barge-in
- `WORKER` — scheduled jobs, reminders, async processors
- `REPORT` — evaluator, report generation, transcript shaping
- `NOTIFY` — Kakao AlimTalk integration
- `WEB` — frontend screens and flows
- `OBS` — logging, metrics, alerting, tracing
- `QA` — test plans, automation, release checks
- `BILLING` — Phase 2a payment and allowance operations
- `DASH` — Phase 2a dashboard and analytics UI
- `PDF` — Phase 2a PDF generation and delivery
- `LANG` — Phase 2b multilingual rollout
- `SCHEDULE` — Phase 2b recurring schedule system
- `EMAIL` — Phase 2b email report delivery

---

## 4. Delivery Sequence Overview

## 4.1 Phase 1 critical path

1. Architecture lock and external integration decisions
2. Database schema + migration foundation
3. Auth bootstrap + phone verification
4. Session config APIs
5. Immediate outbound call path
6. Scheduled callback path + reminder worker
7. Media runtime (Twilio ↔ STT ↔ LLM ↔ TTS)
8. Transcript/evaluation/report pipeline
9. Kakao notification delivery
10. Frontend config/home/report screens
11. End-to-end QA + observability hardening

## 4.2 Phase 1 parallelization opportunities

Can run in parallel after schema lock:
- frontend onboarding/config screens
- backend session APIs
- Twilio callback handling
- Kakao integration
- report rendering UI
- observability scaffolding

Should **not** be parallelized before interface lock:
- media runtime and evaluator JSON contract
- scheduled callback worker and session state transition rules
- allowance settlement and cached projection behavior

## 4.3 Release gates

### Gate A — data and API ready
- migrations applied
- RLS validated
- `/sessions` and `/users/me` stable
- phone verification flow works in staging

### Gate B — call runtime ready
- immediate call works end-to-end in staging
- Twilio status callbacks advance state monotonically
- WebSocket runtime generates AI reply audio successfully
- call stop path works from app and provider side

### Gate C — report and notification ready
- transcript saved
- evaluator returns valid JSON
- report page loads
- Kakao summary sends for completed call

### Gate D — beta ready
- scheduled callback and reminder worker verified
- observability dashboards in place
- runbooks exist for failure modes
- smoke test matrix passes

---

## 5. Definition of Done Template

Each engineering task is only done when all of the following are true:
- implementation merged
- request/response validation added where relevant
- logging added for success and failure paths
- tests added at the appropriate layer
- acceptance criteria from PRD mapped in the ticket
- feature flags/defaults align with phase scope
- documentation or runbook updated if operationally relevant

Use this ticket checklist:

```md
- [ ] code implemented
- [ ] migrations applied / rollback plan documented
- [ ] unit tests added
- [ ] integration tests added where needed
- [ ] logs/metrics added
- [ ] feature flags verified
- [ ] PRD acceptance criteria linked
- [ ] staging smoke-tested
```

---

## 6. Repository Touchpoint Assumptions

Adapt to actual repo layout, but use these as implementation buckets if the repo is still forming.

```text
/apps/web/                      # frontend web app
/apps/api/                      # HTTP API handlers
/packages/db/                   # schema, migrations, query layer
/packages/call-runtime/         # Twilio, media websocket, STT/TTS pipeline
/packages/workers/              # reminder, dispatch, report workers
/packages/notifications/        # Kakao integration
/packages/evaluation/           # evaluator prompts and JSON schema
/packages/shared/               # types, validators, constants
/tests/                         # integration and end-to-end tests
/docs/runbooks/                 # operational docs
```

If repo structure differs, keep the same logical separation.

---

## 7. Phase 1 — Epic to Task Breakdown

# 7.1 EPIC: Architecture Lock and Foundations

## Task ARCH-001 — Lock external integration assumptions
**Goal:** Freeze Phase 1 technical assumptions so downstream work does not fork.

**Deliverables**
- architecture note for Twilio outbound call + status callback events
- architecture note for Media Streams session mapping
- architecture note for STT ingress path
- architecture note for Kakao reminder/report template IDs

**Must decide**
- outbound call sets `StatusCallbackEvent=initiated ringing answered completed`
- Twilio status callback dedupe uses `CallSid + SequenceNumber`
- media runtime path uses one fixed STT ingress path in Phase 1
- caller ID is excluded from beta success criteria

**Dependencies:** none

**Done when**
- architecture decisions written in the architecture reference or engineering ADR
- dependent teams agree on contracts

---

## Task ARCH-002 — Shared domain contract package
**Goal:** Create central enums/types/constants used by API, workers, and frontend.

**Deliverables**
- session status enum
- contact mode enum
- failure reason code enum
- webhook provider enum
- Kakao notification type enum
- report status enum

**Dependencies:** ARCH-001

**Done when**
- all services import shared enums rather than re-defining strings
- state machine transitions are represented in one package

---

# 7.2 EPIC: Database and Persistence Layer

## Task DB-001 — Initial Phase 1 migration set
**Goal:** Create all Phase 1 required tables and indices from PRD v3.1.

**Tables**
- users
- sessions
- messages
- evaluations
- reports
- credit_ledger
- webhook_events

**Columns to include explicitly**
- `sessions.last_provider_sequence_number`
- `sessions.reminder_at_utc`
- `sessions.reminder_sent`
- `sessions.reminder_sent_at`
- `reports.storage_path`
- `credit_ledger.entry_kind`
- `credit_ledger.metadata`

**Dependencies:** ARCH-002

**Done when**
- migration applies cleanly on empty DB
- rollback tested on staging clone
- indices created for active sessions, scheduled sessions, reminders, ledger lookups

---

## Task DB-002 — RLS and access policy implementation
**Goal:** Protect user-scoped tables with Supabase RLS.

**Deliverables**
- RLS policy for `users`
- RLS policy for `sessions`
- RLS policy for `reports`
- RLS policy for `credit_ledger`
- deny-by-default checks for non-owner reads

**Dependencies:** DB-001

**Done when**
- owner can access own rows
- non-owner cannot access another user's rows
- service role bypass is documented for workers

---

## Task DB-003 — Cached projection update helpers
**Goal:** Keep `users.trial_calls_remaining` and `users.paid_minutes_balance` in sync with ledger writes.

**Deliverables**
- transactional helper that writes ledger row(s) and updates cached projection
- projection recompute script for repair/backfill
- invariant test that projection equals ledger-derived balance for sample cases

**Dependencies:** DB-001

**Done when**
- reserve/commit/release/refund flows update both ledger and cached projection in one transaction
- recompute script can repair a corrupted projection

---

# 7.3 EPIC: Auth, User Bootstrap, and Phone Verification

## Task AUTH-001 — Social sign-in bootstrap
**Goal:** On successful social sign-in, ensure a user profile exists.

**Deliverables**
- user upsert on first authenticated request or auth webhook
- default values for free plan and trial calls
- redirect logic based on phone verification state

**Dependencies:** DB-001, DB-002

**Done when**
- first login creates user
- repeat login does not duplicate user
- `users.clerk_user_id` stays unique

---

## Task AUTH-002 — Phone verification API and UI
**Goal:** Let the user verify phone ownership via SMS OTP.

**Deliverables**
- API to start OTP verification
- API to confirm OTP
- masked phone display helper
- frontend screen state handling

**Dependencies:** AUTH-001

**Done when**
- valid OTP marks `phone_verified=true`
- invalid OTP path and retry limit behave per PRD
- numbers are stored encrypted or envelope-encrypted per security requirements

---

# 7.4 EPIC: Session Configuration and Allowance Reservation

## Task API-001 — `POST /sessions` validation and creation
**Goal:** Create immediate or scheduled session configs within scope rules.

**Validation rules**
- only `language=en`
- only `exam=opic`
- free/trial users can only request `duration_minutes=10`
- paid users in Phase 1 still do not see 15 minutes in user-facing UI, but backend may allow admin/internal entitlements only if needed
- `scheduled_once` requires lead time >= 15 minutes
- `scheduled_once` must be within 7 days
- one upcoming scheduled session max per user

**Deliverables**
- session insert logic
- conflict handling for active or existing scheduled session
- reserve allowance on create for scheduled session
- reserve allowance on call initiate for immediate session

**Dependencies:** DB-003, AUTH-002

**Done when**
- all validation errors map to documented error codes
- `409` includes conflicting session info
- server computes `scheduled_for_at_utc` and `reminder_at_utc`

---

## Task API-002 — `GET /sessions`, `GET /sessions/:id`
**Goal:** Support frontend session list/detail pages and status polling.

**Deliverables**
- list filtering by status and contact mode
- session detail endpoint
- serialization of local scheduled time and reminder time

**Dependencies:** API-001

**Done when**
- list and detail payloads match PRD contract
- owner-only access enforced

---

## Task API-003 — `PATCH /sessions/:id` scheduled update
**Goal:** Allow editing of a `scheduled_once` session.

**Deliverables**
- update handler for scheduled time/timezone
- recompute `scheduled_for_at_utc`
- recompute `reminder_at_utc`
- reset `reminder_sent=false`
- optional `reminder_sent_at=NULL`

**Dependencies:** API-001

**Done when**
- only `status=scheduled` sessions can be edited
- reminder fields reset correctly after change
- lead time and 7-day validation still enforced

---

## Task API-004 — `POST /sessions/:id/cancel`
**Goal:** Allow canceling a scheduled session.

**Deliverables**
- transition `scheduled -> user_cancelled`
- release reserved allowance
- idempotent cancel behavior

**Dependencies:** API-001, DB-003

**Done when**
- second cancel does not corrupt balance
- canceled session disappears from upcoming card queries

---

# 7.5 EPIC: Immediate Outbound Call Flow

## Task CALL-001 — `POST /calls/initiate`
**Goal:** Trigger an immediate provider outbound call for a ready session.

**Deliverables**
- `status=ready` guard
- idempotency key handling
- reserve allowance for immediate call if not already reserved
- provider call create request
- create `call_id`
- transition session to `dialing`

**Dependencies:** API-001, DB-003, ARCH-001

**Done when**
- Twilio outbound call is created with required callback fields
- duplicate requests with same idempotency key do not create duplicate calls

---

## Task CALL-002 — Twilio call creation adapter
**Goal:** Encapsulate Twilio call creation and provider config.

**Required provider fields**
- `StatusCallback`
- `StatusCallbackMethod=POST`
- `StatusCallbackEvent=initiated ringing answered completed`
- TwiML endpoint or application callback for media stream connect

**Dependencies:** CALL-001

**Done when**
- adapter is reusable by immediate and scheduled dispatch paths
- request/response logging excludes secrets and PII

---

## Task CALL-003 — `GET /calls/:id` and `POST /calls/:id/end`
**Goal:** Expose live status and allow hangup from the app.

**Deliverables**
- call status polling endpoint
- user-initiated end endpoint
- provider hangup integration

**Dependencies:** CALL-001

**Done when**
- app can stop a call
- `ending -> completed` or provider terminal status flow works predictably

---

# 7.6 EPIC: Provider Callbacks and State Machine

## Task CALL-004 — Twilio status callback endpoint
**Goal:** Persist raw callback events and advance state monotonically.

**Rules**
- verify `X-Twilio-Signature`
- persist raw event before business logic completion
- dedupe key: `twilio:status:{CallSid}:{SequenceNumber}`
- ignore regressive state changes from older sequence numbers

**Dependencies:** DB-001, ARCH-001, CALL-002

**Done when**
- callback writes are durable
- out-of-order events do not corrupt session state
- `last_provider_sequence_number` updates correctly

---

## Task CALL-005 — Provider state transition mapper
**Goal:** Convert callback data into LinguaCall session states.

**Mapping examples**
- `initiated` -> keep `dialing`
- `ringing` -> `ringing`
- `answered` -> `in_progress`
- `completed` -> terminal or `report_pending` transition starter depending on post-processing design
- `busy` -> `busy`
- `no-answer` -> `no_answer`
- provider/internal failure -> `provider_error`

**Dependencies:** CALL-004

**Done when**
- session status and failure_reason semantics are separated
- terminal states are consistent with PRD

---

## Task CALL-006 — Platform fault classifier
**Goal:** Classify terminal outcomes for refund logic.

**Inputs**
- provider call status
- `SipResponseCode`
- server-side WebSocket errors
- app-side user hangup source

**Outputs**
- boolean `platform_fault`
- optional `failure_reason` code

**Dependencies:** CALL-005, MEDIA-004

**Done when**
- classifier does not depend on `EndedReason`
- no-answer and busy are not marked as platform fault

---

# 7.7 EPIC: Media Runtime (Twilio ↔ STT ↔ LLM ↔ TTS)

## Task MEDIA-001 — TwiML endpoint and stream session binding
**Goal:** Return TwiML that opens the media WebSocket and binds it to the correct session.

**Deliverables**
- TwiML endpoint
- custom parameters or server-side lookup for session identity
- session verification before stream accept

**Dependencies:** CALL-002

**Done when**
- WebSocket accepts only valid, expected streams
- session identity is resolved without using query string

---

## Task MEDIA-002 — Inbound audio ingestion path
**Goal:** Handle inbound Twilio audio frames and feed them to STT.

**Deliverables**
- media message parser for `mulaw/8k/base64`
- one chosen Phase 1 ingress path locked in code and docs
- STT stream client setup

**Dependencies:** MEDIA-001, ARCH-001

**Done when**
- inbound audio reaches STT reliably
- chosen ingress path is documented and not dynamically switched in Phase 1

---

## Task MEDIA-003 — LLM turn handling and response generation
**Goal:** Convert end-of-turn events into AI responses.

**Deliverables**
- end-of-turn handling
- prompt selection by `prompt_version`
- silence hint behavior after 3s
- soft correction limit per turn

**Dependencies:** MEDIA-002

**Done when**
- user speech results in timely assistant response
- prompt version is included in runtime logs

---

## Task MEDIA-004 — TTS and in-process transcoder
**Goal:** Generate assistant audio and send it back to Twilio in required format.

**Deliverables**
- ElevenLabs call for assistant text
- in-process transcoder: `pcm_16000 -> mulaw/8000/base64`
- Twilio outbound media messages
- `clear` message support before replacement/barge-in response

**Dependencies:** MEDIA-003

**Done when**
- Twilio can play assistant speech cleanly
- previous buffered audio can be cleared before new response

---

## Task MEDIA-005 — Transcript persistence
**Goal:** Save user and AI messages with relative timestamps.

**Deliverables**
- relative `timestamp_ms` from call start
- sequence numbers
- role separation
- `is_final` handling

**Dependencies:** MEDIA-002, MEDIA-004

**Done when**
- transcript ordering is stable
- timestamps are in ms from call start across all persisted messages

---

# 7.8 EPIC: Scheduled Callback and Reminder Workers

## Task WORKER-001 — Scheduled dispatch worker
**Goal:** Turn due scheduled sessions into live calls.

**Rules**
- only `status=scheduled`
- `scheduled_for_at_utc <= now()`
- `dispatch_deadline_at_utc > now()`
- atomic claim before call initiation

**Recommended claim patterns**
- `UPDATE ... WHERE status='scheduled' RETURNING *`
- or `FOR UPDATE SKIP LOCKED`

**Dependencies:** API-001, CALL-002, DB-003

**Done when**
- one scheduled session cannot be dispatched twice
- session transitions `scheduled -> dialing` atomically

---

## Task WORKER-002 — Reminder worker
**Goal:** Send Kakao reminders 10 minutes before scheduled calls.

**Rules**
- only `status=scheduled`
- `reminder_at_utc <= now()`
- `reminder_sent=false`
- atomic claim or transaction lock

**Dependencies:** API-001, NOTIFY-001

**Done when**
- reminder sends once
- updating scheduled time resets reminder state

---

## Task WORKER-003 — Scheduled terminal handling
**Goal:** Resolve no-answer, schedule miss, or provider failure in scheduled path.

**Dependencies:** WORKER-001, CALL-005, CALL-006

**Done when**
- no-answer ends with `status=no_answer`
- missed dispatch ends with `status=schedule_missed`
- reserved allowance is released or refunded correctly

---

# 7.9 EPIC: Evaluation, Report Generation, and App Report Rendering

## Task REPORT-001 — Evaluator contract and validation
**Goal:** Enforce valid evaluator JSON and scoring version output.

**Deliverables**
- evaluator prompt contract
- JSON schema validator
- malformed response retry once

**Dependencies:** MEDIA-005

**Done when**
- invalid JSON does not silently enter DB
- `scoring_version` is always present

---

## Task REPORT-002 — Report generation worker
**Goal:** Build user-facing report payload from evaluation and transcript.

**Deliverables**
- report JSON composition
- summary text generation
- grammar corrections with `timestamp_ms_from_call_start`
- recommendations block

**Dependencies:** REPORT-001

**Done when**
- completed session produces a report record
- timestamp units are consistent across report structures

---

## Task REPORT-003 — `/sessions/:id/report` and `/reports/:id`
**Goal:** Serve report status and report details to the frontend.

**Dependencies:** REPORT-002

**Done when**
- pending and ready states are exposed correctly
- access control is enforced

---

## Task REPORT-004 — Report failure and retry handling
**Goal:** Retry report generation up to 3 times and expose delayed state in the app.

**Dependencies:** REPORT-002

**Done when**
- exponential backoff is applied
- final failure leaves an observable state for support and UI

---

# 7.10 EPIC: Kakao Notification Delivery

## Task NOTIFY-001 — Kakao adapter and template mapping
**Goal:** Integrate AlimTalk with approved informational templates.

**Template types Phase 1**
- scheduled reminder
- report summary

**Dependencies:** ARCH-001

**Done when**
- provider adapter handles success and failure responses
- template IDs are environment-configured

---

## Task NOTIFY-002 — Report summary send flow
**Goal:** Send Kakao report summary after report readiness.

**Dependencies:** REPORT-002, NOTIFY-001

**Done when**
- report summary is sent once
- provider result is logged
- failure does not block app report availability

---

## Task NOTIFY-003 — Reminder send flow
**Goal:** Send Kakao reminder 10 minutes before scheduled callback.

**Dependencies:** WORKER-002, NOTIFY-001

**Done when**
- reminder is sent once
- duplicate sends are prevented by claim/state update rules

---

# 7.11 EPIC: Frontend Phase 1 Experience

## Task WEB-001 — Login and phone verification flow
**Goal:** Build Screen 1 and Screen 2.

**Dependencies:** AUTH-001, AUTH-002

**Done when**
- first-time user can sign in and verify phone
- correct navigation happens after verification

---

## Task WEB-002 — Session config screen
**Goal:** Build Screen 3 with Phase 1 scope lock.

**Requirements**
- EN only
- OPIC only
- duration shown as 10 minutes only for normal users
- immediate vs scheduled_once segmented control
- date/time picker for scheduled mode
- 15-minute option hidden from normal Phase 1 users

**Dependencies:** API-001

**Done when**
- validation errors surface correctly
- scheduled lead time guard enforced in UI
- success path matches immediate vs scheduled mode

---

## Task WEB-003 — Home dashboard Phase 1
**Goal:** Build Screen 4 without charts.

**Requirements**
- remaining trial calls or allowance
- quick start CTA
- upcoming scheduled call card
- recent reports list
- simple text deltas only

**Dependencies:** API-002, REPORT-003

**Done when**
- no line/radar/streak charts are visible
- scheduled card supports edit/cancel actions

---

## Task WEB-004 — In-call screen
**Goal:** Build Screen 5.

**Dependencies:** CALL-003

**Done when**
- call status updates live enough for product needs
- user can end call
- report generating state is visible at end

---

## Task WEB-005 — Report detail screen
**Goal:** Build Screen 6 for HTML reports only.

**Dependencies:** REPORT-003

**Done when**
- report renders score, corrections, transcript, recommendations
- no PDF button appears in Phase 1

---

# 7.12 EPIC: Observability and Runbooks

## Task OBS-001 — Structured logging and trace IDs
**Goal:** Ensure all critical flows have correlated identifiers.

**Identifiers**
- request_id
- session_id
- call_id
- provider_call_sid

**Dependencies:** API-001, CALL-001, CALL-004, REPORT-002

**Done when**
- logs can reconstruct a call lifecycle end-to-end

---

## Task OBS-002 — Metrics instrumentation
**Goal:** Emit KPI-supporting metrics from Phase 1.

**Required metrics**
- call initiation success rate
- answer rate
- duration
- turn latency
- scheduled dispatch lag
- reminder dispatch lag
- report readiness SLA
- Kakao accepted rate

**Dependencies:** OBS-001

**Done when**
- dashboards or metric panels exist in staging/production tooling

---

## Task OBS-003 — Runbooks
**Goal:** Create operator docs for likely failure scenarios.

**Runbooks**
- Twilio callback verification failure
- scheduled dispatch stuck
- reminder backlog
- report backlog
- Kakao template/provider failure
- ledger/projection mismatch repair

**Dependencies:** OBS-002

**Done when**
- on-call or operator can follow documented steps without source spelunking

---

# 7.13 EPIC: QA and Release Readiness

## Task QA-001 — Phase 1 test matrix
**Goal:** Produce a canonical test matrix from PRD acceptance criteria.

**Must cover**
- signup and phone verification
- free user immediate call
- free user scheduled call
- invalid lead time
- conflict scheduled session
- no-answer
- provider error
- report delayed / retry
- reminder send once

**Dependencies:** all Phase 1 implementation tasks

**Done when**
- test matrix maps to PRD stories and critical edge cases

---

## Task QA-002 — API integration suite
**Goal:** Automate backend integration coverage for session, call, report, worker flows.

**Dependencies:** API/CALL/WORKER/REPORT tasks

**Done when**
- CI validates core API contracts
- idempotency and monotonic state transitions are tested

---

## Task QA-003 — End-to-end beta smoke suite
**Goal:** Verify top user flows in staging before beta launch.

**Flows**
- signup -> verify phone -> create immediate session -> answer call -> receive report
- signup -> create scheduled session -> receive reminder -> answer call -> receive report
- scheduled cancel and conflict behavior

**Dependencies:** WEB tasks, all backend tasks

**Done when**
- smoke suite passes on staging with real or controlled provider integrations

---

## 8. Phase 2a Breakdown

# 8.1 Billing and Allowance Operations

## Task BILLING-001 — Plans API and plan admin model
- finalize `plans` table usage
- support `max_session_minutes`
- support entitlements
- build seed/admin update path

## Task BILLING-002 — Payment provider integration
- checkout session creation
- webhook verification and idempotency
- subscription persistence
- allowance grant ledger writes

## Task BILLING-003 — Paid allowance settlement
- allow user-facing 15-minute sessions for entitled plans
- enforce allowance deduction by minutes
- update cached projections transactionally

# 8.2 Dashboard and PDF

## Task DASH-001 — Dashboard data aggregation APIs
- recent score trend
- radar category values
- streak summary
- scoring-version-safe comparisons

## Task DASH-002 — Dashboard frontend
- line chart
- radar chart
- streak heatmap
- empty states

## Task PDF-001 — PDF report generator
- render from report payload
- store by `storage_path`
- no URL persisted in DB

## Task PDF-002 — `/reports/:id/pdf`
- create signed URL at request time
- redirect response

---

## 9. Phase 2b Breakdown

# 9.1 Multilingual Rollout

## Task LANG-001 — Prompt registry expansion
- JA first
- language-specific prompt versions
- QA checklist before UI exposure

## Task LANG-002 — STT/TTS model strategy for non-EN
- Nova-3 multilingual or selected monolingual variants
- language-specific voices and QA

## Task LANG-003 — Frontend language/exam unlock
- controlled rollout by feature flags
- local config maps for language/exam/level/topic

# 9.2 Recurring Scheduling

## Task SCHEDULE-001 — recurring_schedules APIs
- create
- list
- pause/resume
- delete

## Task SCHEDULE-002 — recurring materialization worker
- due recurring schedule -> session materialization
- next_run_at_utc recompute
- reminder integration

# 9.3 Email and Pronunciation

## Task EMAIL-001 — HTML email report delivery
- provider integration
- templates
- send status persistence

## Task REPORT-005 — pronunciation analysis block
- provider score ingestion
- report payload integration

---

## 10. Dependency Matrix

## 10.1 Phase 1 blockers

| Task | Blocks |
|---|---|
| ARCH-001 | CALL-002, MEDIA-002, NOTIFY-001 |
| DB-001 | almost everything backend |
| DB-003 | API-001, API-004, CALL-001, WORKER-001 |
| CALL-002 | CALL-004, MEDIA-001, WORKER-001 |
| CALL-004 | CALL-005, CALL-006 |
| MEDIA-005 | REPORT-001 |
| REPORT-002 | REPORT-003, NOTIFY-002 |
| NOTIFY-001 | WORKER-002, NOTIFY-002, NOTIFY-003 |
| API-001 | WEB-002, API-002, API-003, API-004 |

## 10.2 Safe parallel bundles

### Bundle A
- DB-001
- AUTH-001
- OBS-001 scaffolding

### Bundle B
- API-001
- WEB-002
- NOTIFY-001

### Bundle C
- CALL-001
- CALL-002
- CALL-004
- MEDIA-001

### Bundle D
- MEDIA-002
- MEDIA-003
- MEDIA-004
- MEDIA-005

### Bundle E
- WORKER-001
- WORKER-002
- REPORT-001
- REPORT-002
- WEB-003
- WEB-005

---

## 11. Ticket Writing Format for Codex

Use this ticket template when assigning work to Codex.

```md
### <TASK ID> — <Title>
Goal:
Scope:
Files / modules likely touched:
Dependencies:
Implementation notes:
Acceptance checks:
Tests required:
Out of scope:
```

### Example

```md
### API-003 — PATCH /sessions/:id scheduled update
Goal:
Allow editing of a scheduled_once session.

Scope:
- validate owner access
- validate status=scheduled
- validate lead time >= 15 minutes
- recompute scheduled_for_at_utc and reminder_at_utc
- reset reminder_sent=false

Files / modules likely touched:
- apps/api/session.routes
- packages/db/session.repository
- packages/shared/session.validators
- tests/integration/session-update.test

Dependencies:
- API-001

Acceptance checks:
- updated local time is reflected in response
- reminder_at_utc is recomputed
- reminder_sent resets to false
- invalid lead time returns 422

Tests required:
- unit validator tests
- integration test for scheduled update
- regression test for reminder reset

Out of scope:
- recurring schedules
- payment entitlement changes
```

---

## 12. Phase 1 Recommended Sprint Cut

## Sprint 1
- ARCH-001, ARCH-002
- DB-001, DB-002, DB-003
- AUTH-001, AUTH-002
- API-001, API-002
- WEB-001, WEB-002

## Sprint 2
- CALL-001, CALL-002, CALL-003
- CALL-004, CALL-005, CALL-006
- MEDIA-001, MEDIA-002
- OBS-001

## Sprint 3
- MEDIA-003, MEDIA-004, MEDIA-005
- WORKER-001, WORKER-002, WORKER-003
- NOTIFY-001, NOTIFY-003
- WEB-003, WEB-004

## Sprint 4
- REPORT-001, REPORT-002, REPORT-003, REPORT-004
- NOTIFY-002
- WEB-005
- OBS-002, OBS-003
- QA-001, QA-002, QA-003

---

## 13. Launch Checklist

### Product scope
- [ ] no non-EN UI exposed
- [ ] no non-OPIC UI exposed
- [ ] no payment UI exposed
- [ ] no recurring schedule UI exposed
- [ ] no PDF button exposed
- [ ] no charts exposed on home
- [ ] normal users only see 10-minute sessions

### Runtime
- [ ] immediate call works
- [ ] scheduled callback works
- [ ] reminder sends once
- [ ] provider callbacks are monotonic
- [ ] no-answer ends correctly
- [ ] platform fault refund path works

### Reporting
- [ ] transcript saved with relative ms timestamps
- [ ] evaluator returns valid JSON
- [ ] report generated within SLA target range in staging
- [ ] Kakao summary sends or degrades gracefully

### Ops
- [ ] dashboards/alerts configured
- [ ] runbooks published
- [ ] beta support owner assigned

---

## 14. Final Note for Codex

When implementing against this document:
- prefer the smallest safe change that satisfies the PRD
- do not unlock future-phase UI or APIs unless explicitly required as an internal dependency
- preserve state-machine and ledger invariants
- treat callback ordering, worker idempotency, and balance settlement as correctness-critical

**Implementation priority:** correctness of state transitions and settlement logic over feature breadth.

