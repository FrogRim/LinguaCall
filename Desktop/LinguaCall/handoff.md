# LinguaCall Handoff Notes

Last updated: 2026-03-14

## Current status (before API-001 hardening)
- Bootstrapped monorepo from empty repo based on PRD/engineering breakdown.
- Created project structure and baseline scripts.
- Added shared domain contract package.
- Added DB migration SQL files for Phase 1 schema + RLS.
- Added API skeleton (in-memory store) for Sprint 1 auth/session/call endpoints.
- Added Web skeleton for Screen 1~3 basic flows.
- Added implementation plan doc for Phase 1 bootstrap.

## Files created/updated
- [root] `package.json`
- [root] `pnpm-workspace.yaml`
- [root] `tsconfig.base.json`
- `packages/shared/package.json`
- `packages/shared/src/enums.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `packages/db/package.json`
- `packages/db/migrations/20260313_phase1_init.sql`
- `packages/db/migrations/20260313_phase1_rls.sql`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/storage/inMemoryStore.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/sessions.ts`
- `apps/api/src/routes/calls.ts`
- `apps/api/src/index.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `docs/superpowers/plans/2026-03-13-lingua-call-phase1-bootstrap.md`

## Sprint alignment
- This matches `LinguaCall_engineering_task_breakdown_v1.md` Sprint 1 scope start:
  - ARCH-001 / ARCH-002 / DB-001/2/3 / AUTH-001/2 / API-001/2 / WEB-001~3
- Current API behavior is currently in-memory for local prototyping, not production store.

## Immediate next work (Task 2 requested)
- Replace in-memory session/user store with DB-backed persistence.
- Implement real repository layer and transaction safety for `POST /sessions`.
- Add idempotent/transaction-safe call initiation for `POST /calls/initiate`.
- Add real validation and error mapping to `ApiError` contract.
- Add `x-clerk-user-id` and auth bootstrap behavior against actual identity provider context.

## Important notes
- Do not perform broad refactors before finishing Sprint 1 blockers.
- Keep Phase 1 scope strict: EN/OPIC, 10-minute sessions, immediate + one-time scheduled, no Phase 2 items.
- This handoff intentionally excludes Twilio/Kakao/worker/media implementations (Sprint 2+.

## Resume checklist for next session
1. Continue from API-001 implementation.
2. Add DB migration application command/runbook.
3. Convert `inMemoryStore` to repository/services layer.
4. Keep frontend Screen 1~3 wiring and ensure request/response types from `@lingua/shared`.

## Task 2 checkpoint (2026-03-13)
- Fixed `apps/api/src/storage/inMemoryStore.ts` for DB-backed `Session` persistence path (validation + transaction + phone handling).
- Fixed syntax artifact in `apps/api/src/routes/sessions.ts` payload object (`\n` 문자 오염으로 인한 타입 오류 원인 정리).
- `startSession` flow now persists `sessions` with `reserved_trial_call`/`reserved_minutes` and transaction-safe creation checks.
- `startCall` flow now uses `randomUUID()` idempotency key path and webhook dedupe persistence flow.
- Updated for Task 2 handoff continuity before next implementation pass.

## Task 2 continuation checkpoint (2026-03-13)
- Fixed remaining `sessions.ts` payload line-break corruption (`\r\n` literal artifact) so POST body mapping is valid TS syntax.
- Normalized phone mask output in `inMemoryStore.ts` to ASCII-safe `***` separator.
- Verified runtime-ready path remains intact after these fixes (`createSession` flow + call initiation flow).

## Task 2 continuation checkpoint (2026-03-13)
- Implemented `API-003` scaffolding in `apps/api/src/routes/sessions.ts`:
  - Added `PATCH /sessions/:id` handling for scheduled sessions.
  - Added payload validation and session-state checks.
  - Recomputes `scheduled_for_at_utc`/`timezone` and `reminder_at_utc` with `reminder_sent=false`, `reminder_sent_at=NULL`.
  - Returns conflict/validation/not_found mappings consistent with existing API pattern.
- Implemented `API-004` backend path in `apps/api/src/routes/sessions.ts`:
  - Added `POST /sessions/:id/cancel` with idempotent behavior for already-cancelled scheduled sessions.
  - Cancels only `scheduled` sessions -> `user_cancelled`.
  - Releases reserved trial/minute reservation marks from session row and applies corresponding user allowance restoration in `apps/api/src/storage/inMemoryStore.ts`.
- Added shared type contract: `UpdateScheduledSessionPayload` in `packages/shared/src/contracts.ts`.
- Added storage methods to support routes:
  - `updateScheduledSession` in `apps/api/src/storage/inMemoryStore.ts`.
  - `cancelScheduledSession` in `apps/api/src/storage/inMemoryStore.ts`.
- Next checkpoint target: review/adjust allowance restoration semantics if balance accounting policy differs before adding worker-side scheduled dispatch hooks.

## Task 2 continuation follow-up (2026-03-13)
- Adjusted `cancelScheduledSession` to keep reservation accounting session-scoped only in this phase (no direct `users` allowance balance mutation) to avoid negative balance drift while full allowance debit/credit policy is not yet defined.
- Existing checkpoint in this file is now superseded: API-004 currently transitions `scheduled -> user_cancelled` and clears `reserved_trial_call/reserved_minutes` on session.
## Next-step checkpoint (2026-03-13)
- Next action target: extend frontend session list with `POST /calls/initiate` action on `status=ready` sessions for immediate start flow continuity before moving into worker-based scheduled dispatch tasks.
- Completed: added `Start call` action to session list for `status=ready` sessions.
- Implemented: list action triggers `POST /calls/initiate` and refreshes session list on success/failure.
- Next-step execution checkpoint: startAllowancePhase (2026-03-13)
- Implemented plan: add allowance reserve on scheduled/create and call-start; add allowance release on scheduled cancel; map insufficient allowance to conflict path.
- File targets: apps/api/src/storage/inMemoryStore.ts, apps/api/src/routes/calls.ts, apps/api/src/routes/sessions.ts.
- Completed checkpoint: allowance reservation/release path added for scheduled session create/cancel and immediate call start in store.
- API routes updated to map INSUFFICIENT_ALLOWANCE -> 409 conflict (`sessions` create, `calls` initiate).
- Next-step execution checkpoint: implementing worker tasks.
- Plan: add in-memory/db store methods `dispatchDueScheduledSessions` (WORKER-001) and `sendDueReminders` (WORKER-002), plus secured worker endpoints in API.
- Completed WORKER-001/WORKER-002 core implementation:
  - Added `dispatchDueScheduledSessions(limit?)` in `apps/api/src/storage/inMemoryStore.ts` for due scheduled claim+atomic transition to `dialing` (with per-session dedupe event and lock-safe row selection).
  - Added `sendDueReminders(limit?)` in `apps/api/src/storage/inMemoryStore.ts` for reminder_at<=now and reminder_sent=false transitions.
  - Added new worker routes `apps/api/src/routes/workers.ts`:
    - `POST /workers/scheduled-dispatch`
    - `POST /workers/scheduled-reminders`
    - optional header auth via `WORKER_SHARED_SECRET` + `x-worker-token`.
  - Wired worker router in `apps/api/src/index.ts`.
- Next optional check: add worker-friendly frontend/admin panel call buttons to trigger these endpoints manually for smoke testing.

## WORKER-003 continuation checkpoint (2026-03-13)
- Target: implement scheduled terminal handling for dispatch path.
- Implemented in `apps/api/src/storage/inMemoryStore.ts`:
  - Added `releaseScheduledAllowance(...)` helper for reserved trial/minute release with immutable ledger writes.
  - Refactored scheduled cancel flow to reuse the shared allowance-release helper.
  - Added `markMissedScheduledSessions(limit?)` to atomically claim overdue scheduled sessions (`dispatch_deadline_at_utc <= now`) and transition them to `schedule_missed`, while releasing any reserved allowance and recording `twilio:schedule_missed` webhook events.
  - Extended `markSessionTerminal(...)` to return the updated session and release reservation for terminal statuses (`no_answer`, `busy`, `voicemail`, `provider_error`, `schedule_missed`) before transition.
- Implemented in `apps/api/src/routes/workers.ts`:
  - Added `POST /workers/scheduled-missed` with optional `limit` query for missed scheduled sessions.
  - Added `POST /workers/scheduled-terminal` for worker-initiated terminaling of scheduled sessions (`no_answer`/`busy`/`provider_error`/`voicemail`) with default failure reason mapping.
- Current state: WORKER-003 storage/worker endpoint groundwork is in place. Next step is to hook `scheduled-terminal` transitions from callback jobs and finalize runbook mapping.
- NOTIFY-003/NOTIFY-002 progress checkpoint (2026-03-13):
  - Extended `sendDueReminders` in `apps/api/src/storage/inMemoryStore.ts` to log Kakao reminder dispatch attempts as webhook events:
    - writes `provider='kakao'`, `event_type='kakao_reminder'`, dedupe key `kakao:reminder:{sessionId}`
    - keeps existing `reminder_sent=true` update and idempotent behavior.
  - Added `sendReportReadyNotifications(limit?)` in `apps/api/src/storage/inMemoryStore.ts`:
    - selects `reports.status='ready'` and pending Kakao states,
    - marks `kakao_status='accepted'` / `kakao_sent_at`,
    - writes `provider='kakao'`, `event_type='kakao_report_ready'` events with dedupe keys.
  - Added `POST /workers/report-notify` in `apps/api/src/routes/workers.ts` with response `{ notified, reportIds }`.
  - `writeWebhookEvent` helper now accepts explicit event type (default remains `media_stream`), so Kakao events are not hard-coded to media stream type.

## CALLBACK terminaling checkpoint (2026-03-13)
- Next step now started: route Twilio callback → terminal state update path.
- Implemented `POST /calls/twilio-status-callback` in `apps/api/src/routes/calls.ts`.
  - Parses Twilio-style callback payload (`CallSid`, `CallStatus`, `SequenceNumber`, optional `SipResponseCode`, `AnsweredBy`).
  - Delegates to `store.handleTwilioStatusCallback(...)`.
- Implemented `handleTwilioStatusCallback(...)` in `apps/api/src/storage/inMemoryStore.ts`:
  - Uses dedupe key `twilio:status:{CallSid}:{SequenceNumber}`.
  - Enforces sequence monotonicity with `last_provider_sequence_number`.
  - Maps callback statuses to session transitions and terminal statuses (`no_answer`, `busy`, `provider_error`, `voicemail`, `completed`, `in_progress`, etc.).
  - On terminal callbacks, releases scheduled terminal reservation via existing allowance release logic.
  - Updates `provider_call_sid`, lifecycle status, `failure_reason`, and timestamps.
  - Stores raw callback payload into `webhook_events` with key `status_callback`.
- Added `express.urlencoded({ extended: true })` in `apps/api/src/index.ts` to accept Twilio form-encoded callback payloads.
- Open point: callback signature validation and more granular sip error classification remain to be added in next pass.

## CALLBACK terminaling hardening checkpoint (2026-03-13)
- Completed this pass: callback hardening + terminal outcome classifier.
- `apps/api/src/routes/calls.ts`
  - Improved Twilio signature calculation base:
    - forwarded protocol/host normalization
    - canonicalized body key ordering
    - repeated form param support for signature input
- `apps/api/src/storage/inMemoryStore.ts`
  - Added terminal failure reason classifier helper using `SipResponseCode` and `AnsweredBy`.
- Remaining point: define exact `completed` post-call accounting behavior before MVP hard lock (current behavior keeps scheduled allowance reserved through completed calls).

## CALLBACK -> WORKER scheduled-terminal routing checkpoint (2026-03-13)
- Next step executed: unify callback terminal handling and worker terminal path.
- Added private `applySessionTerminalTransition(...)` in `apps/api/src/storage/inMemoryStore.ts`:
  - encapsulates terminal status transition, allowance release, and reserved-flag cleanup
  - supports provider-side metadata (`provider_call_sid`, `last_provider_sequence_number`)
- Updated `handleTwilioStatusCallback(...)` in `apps/api/src/storage/inMemoryStore.ts`:
  - terminal statuses (`no_answer`, `busy`, `provider_error`, `voicemail`) now go through terminal transition helper before commit
  - same terminal callback event is stored with dedupe key and atomic commit
- Updated `markSessionTerminal(...)` to use the same terminal transition helper, so callback and worker share transition semantics.
- Remaining blocking item for MVP close is still `completed` post-call accounting policy (consume/commit/refund behavior still to be finalized).

## POST-CALL accounting checkpoint (2026-03-13)
- Added `commitScheduledAllowance(...)` in `apps/api/src/storage/inMemoryStore.ts` and expanded ledger entry kinds to include `commit`.
- Updated `handleTwilioStatusCallback(...)` completed transition:
  - `nextStatus === "completed"` now emits a `commit` ledger row for reserved trial/minute reservation
  - clears `reserved_trial_call` / `reserved_minutes` on completed sessions
  - continues to keep `completed_at` semantics unchanged

## CALL-006 / Platform fault classifier checkpoint (2026-03-13)
- Added callback-level platform fault path in `apps/api/src/storage/inMemoryStore.ts`:
  - `handleTwilioStatusCallback(...)` now parses `CallDuration` / `ErrorCode` (lower/upper case variants from Twilio body)
  - terminal and completed callback classification uses a shared heuristic:
    - `completed` with `answered_at` + duration < 60s + 5xx SIP/ErrorCode -> `platform_fault`
  - completed sessions now branch:
    - terminal fault -> `refundScheduledAllowance(...)` (delta +1/+minutes in user projection)
    - normal -> existing `commit` ledger behavior
  - added `refundScheduledAllowance(...)` helper with `entry_kind = refund`
- Updated callback route parser (`apps/api/src/routes/calls.ts`) to pass `CallDuration`/`ErrorCode` into callback handler.
- Remaining alignment point: broaden platform-fault signals beyond Twilio SIP/ErrorCode (media/WebSocket + app-side errors) in `CALL-006` next pass.

## CALL-006 hardening pass (2026-03-13)
- Extended `classifyFailureReason(...)` in `apps/api/src/storage/inMemoryStore.ts` so Twilio `failed` now also treats 5xx `ErrorCode` as `platform_fault` (in addition to existing 5xx `SipResponseCode`).
- Kept existing terminal mappings while broadening fault-source inputs to include callback-level error code for completed/failed path consistency.
- Remaining work: hook `media/websocket fault` and `app hangup source` signals into a separate provider error event path when media runtime is implemented.

## CALL-006 finalize checkpoint (2026-03-13)
- Extended `apps/api/src/routes/workers.ts` scheduled terminal API to accept runtime fault signals:
  - Added optional `platformFault`, `source`, and `errorCode` fields to `ScheduledTerminalPayload`.
  - `source` values (`media_stream`, `provider_internal`, `system`) are treated as platform-fault signals for terminal status mapping.
  - `no_answer`/`busy` remain non-platform-fault defaults, while `provider_error` can now be driven as `platform_fault` without changing callback contracts.
- Updated `applySessionTerminalTransition(...)` in `apps/api/src/storage/inMemoryStore.ts`:
  - `provider_error + platform_fault` now consumes reserved scheduled allowance using `refundScheduledAllowance(...)` (refund ledger entry) rather than `releaseScheduledAllowance(...)`.
  - Existing callback path still handles `completed` auto-refund via `failureReason === "platform_fault"` with existing call-duration/SIP/ErrorCode logic.
- This marks the remaining CALL-006 alignment step between platform fault signal inputs and refund split (release vs refund) on terminal updates.

## MVP remaining blocks checkpoint (2026-03-13)
- Phase 1 scope lock follow-up based on `LinguaCall_PRD_v3.1_scope_locked.md` + `LinguaCall_engineering_task_breakdown_v1.md`.
- Remaining unresolved work before minimal MVP:
  - Media Runtime wiring: `MEDIA-001` (TwiML endpoint + stream identity binding), `MEDIA-002` (inbound audio ingestion), `MEDIA-003` (LLM turn handling), `MEDIA-004` (media end/error handling)
  - Report chain: `REPORT-001` (evaluator contract), `REPORT-002` (report generation), `REPORT-003` (/sessions/:id/report /reports/:id)
  - Notification/report delivery: `NOTIF-002` (report summary delivery), `NOTIF-004` (Kakao scheduled reminder + scheduled callback reminders)
  - Billing and lifecycle completeness: `BILL-001` (payment intent + checkout session), `BILL-002` (failed payment and entitlement state sync), `BILL-003` (entitlement downgrade paths)
  - Worker hardening cleanup: `CALL-005` (call status transitions for immediate/dispatch + event persistence), `WORKER-001~003` are implemented but need productionized media/retry handling and endpoint auth hardening
  - Frontend completeness: report page, failed state copy/feedback for provider fault, scheduled card actions for terminal/retry flow, session detail/report link states
  - Ops/config: worker cron/Scheduler doc + secret rotation + idempotency docs
- PRD explicit blockers already pending in scope context but not implemented yet are `CALL-006` app-side fault source + media websocket fault signal hooks in runtime (runtime endpoint path still pending), which this block now keeps as done-by-interface + pending-by-runtime hook.
- Recommendation for next session: complete `MEDIA-001`~`MEDIA-004` first, then close `REPORT-*` and billing enablement so MVP accounting+settlement path becomes user-visible complete.

## MEDIA-001 progress checkpoint (2026-03-13)
- Implemented TwiML endpoint in `apps/api/src/routes/calls.ts`:
  - Added `POST/GET`-compatible `POST /calls/twilio-twiml` and `POST/GET /calls/twilio-twiml/:callId`.
  - Endpoint returns Twilio-compatible XML (`<Response><Connect><Stream>...</Stream></Connect></Response>`).
  - Uses `callId` (from query/body/path) as primary session lookup key and `CallSid` as fallback.
  - Stream URL is configurable via `TWILIO_MEDIA_STREAM_URL`; otherwise derived from request host as `wss://<host>/media-stream`.
  - Injects stream custom parameters without query strings:
    - `session_id`
    - `provider_call_sid`
    - `call_id`
  - Added simple XML escaping for safe TwiML response generation.
- Added storage binding helper `getSessionByTwilioLookup(...)` in `apps/api/src/storage/inMemoryStore.ts`:
  - Resolves sessions by `call_id`, `public_id`, `id`, and `provider_call_sid`.
  - Supports TwiML lookup path for immediate call identity resolution.
- This satisfies PRD requirement: session identity is bound via TwiML stream custom parameters (not by Stream URL query string), with server-side lookup path ready for later media runtime binding.

## MEDIA-002 progress checkpoint (2026-03-13)
- Added `apps/api/src/mediaStream.ts` with `/media-stream` WebSocket ingestion pipeline:
  - Parses Twilio Media Streams JSON events: `start`, `media`, `stop`.
  - Resolves session on `start` via custom parameters (`session_id`/`call_id`) plus `provider_call_sid` fallback, then binds with `store.bindMediaStreamSession(...)`.
  - Parses inbound `media.payload` as base64 audio, validates payload shape, and calls `store.markMediaStreamActive(...)` once on first frame.
  - Dispatches audio frame into internal `onInboundAudio` hook for future STT attachment (Phase 1 keeps one fixed ingress path).
  - Emits `media_stream_error` webhook events on parse/binding/session/frame/close failures and logs socket-close without prior `stop`.
- Wired WebSocket server in `apps/api/src/index.ts`:
  - Created HTTP server from Express app (`createServer(app)`).
  - Attached `attachMediaStreamServer(server)` to keep websocket path `/media-stream` stable for TwiML stream URL.
- Dependency update for API transport layer:
  - `apps/api/package.json` added `ws` (+ `@types/ws`).
- In-memory store hardening before runtime handoff:
  - `bindMediaStreamSession(...)` now updates `provider_call_sid` only from explicit stream payload (prevents fallback to callId).
  - `markMediaStreamActive(...)` now wraps unexpected exceptions as `internal_error` instead of rethrowing raw failures.

## MEDIA-003 progress checkpoint (2026-03-13)
- Added `apps/api/src/mediaRuntime.ts` for Phase 1 inline runtime:
  - Implements a `MediaRuntime` with stream-bound session state and 3-second silence timer.
  - On each inbound audio frame (`onInboundAudio`), it adds a deterministic pseudo-STT token to the current user utterance buffer.
  - On silence timeout, it finalizes one turn and writes transcript-style rows into `messages` via `store.appendMessage(...)` for both `user` and `assistant`.
  - Assistant response is generated by a minimal deterministic mock LLM path (`buildAssistantReply`) and keyed by `MEDIA_PROMPT_VERSION` fallback (`mock-en-v1`).
- Extended `apps/api/src/storage/inMemoryStore.ts` with:
  - `appendMessage(...)` method to persist `(session_id, sequence_no, role, content, timestamp_ms, is_final)` for turn persistence.
- Wired runtime into websocket ingress in `apps/api/src/index.ts`:
  - `attachMediaStreamServer(...)` now passes `onInboundAudio` callback to `mediaRuntime.handleInboundAudio`.
  - Added stream-close callback to clear runtime session state.
- Extended `apps/api/src/mediaStream.ts` callback options with `onStreamClose` to support deterministic session cleanup on `stop` / websocket close.
- This keeps `MEDIA-003` path implemented as a fixed ingress/turning pipeline before STT/LLM real providers are wired.

## MEDIA-004 progress checkpoint (2026-03-13)
- Implemented mock outbound media playback path for Twilio media stream:
  - `apps/api/src/mediaStream.ts` now tracks active websocket sessions by `sessionId` at `/media-stream`.
  - Added outbound helpers:
    - `sendAssistantMockAudio(sessionId, text)` to emit Twilio `clear` and `media` events.
    - in-process mock μ-law/base64 generator for placeholder assistant audio frames.
  - session mapping is removed on `stop` and socket close to prevent stale sends.
- `apps/api/src/mediaRuntime.ts` now calls `sendAssistantMockAudio(...)` when a turn flushes.
- Result: assistant mock text can now be sent back through Twilio WS path with `clear` message support.
- Next risk: replace mock payload generator with real TTS+transcoder (`pcm_16000 -> mulaw/8000/base64`) in a follow-up pass.

## CALL-006 media fault hook checkpoint (2026-03-13)
- Wired media websocket fault events into platform-fault terminalization path:
  - `apps/api/src/mediaStream.ts`:
    - Added `onStreamFault` option to `attachMediaStreamServer`.
    - Media parse/runtime/close/error paths now emit fault signals (`media_stream_fault`) and keep existing webhook logging.
  - `apps/api/src/index.ts`:
    - Added `onStreamFault` callback mapping media stream fault reasons to:
      - `store.markSessionTerminal(sessionId, "provider_error", "platform_fault")` (best-effort)
      - an additional `markMediaStreamError(... "media_stream_fault" ...)` write.
- This finalizes the remaining CALL-006 integration point (runtime/media-side fault signal -> platform fault accounting rule path).

## MEDIA-004 hardening checkpoint (2026-03-13)
- Replaced placeholder base64 payload generator with in-process mock audio pipeline:
  - Added `apps/api/src/mediaTranscoder.ts`:
    - text → pseudo PCM (16kHz),
    - downsample to 8kHz,
    - μ-law encode,
    - split into Twilio-sized 160-byte frames and base64 encode.
  - `apps/api/src/mediaStream.ts` now emits these frame payloads for `sendAssistantMockAudio`.
- This keeps Phase 1 path dependency-free while matching PRD requirement shape (`audio/x-mulaw`, `8k`, base64) for outbound messages.
## MEDIA-005 progress checkpoint (2026-03-13)
- Added session transcript retrieval path:
  - `apps/api/src/storage/inMemoryStore.ts`
    - Added transcript row mapping fields for `messages`.
    - Added `getSessionMessages(clerkUserId, sessionId, limit?)`:
      - validates ownership via existing `getSession` guard,
      - returns `{ sessionId, messages }` ordered by `sequence_no`,
      - maps nullable `timestamp_ms` safely to contract `timestampMs`.
  - `apps/api/src/routes/sessions.ts`
    - Added `GET /sessions/:id/messages`.
    - Supports optional positive integer `limit` query param.
    - Maps session-missing to 404 and invalid limit to 422.
- Next step: connect transcript UI in web and add fixtures for transcript ordering and empty-state handling.

## NOTIFY/WORKER route cleanup checkpoint (2026-03-13)
- Cleaned `apps/api/src/routes/workers.ts` to remove duplicate `/scheduled-reminders` inline handler and keep only the shared `sendScheduledReminders` path.
- Kept compatibility aliases:
  - `POST /scheduled-reminders` (primary)
  - `POST /dispatch-reminder` (alias to same handler)
- Progress intent: unblock next phase of worker callback-to-runner integration (scheduled terminal path + report notification verification) with a single coherent handler wiring.
## REPORT-001/002/003 progress checkpoint (2026-03-13)
- Added evaluator/report contract + report API scaffold for MVP:
  - `packages/shared/src/contracts.ts`
    - Added `Report` contract (`id`, `publicId`, `sessionId`, `status`, `summaryText`, `recommendations`, `attemptCount`, timing/status fields).
  - `apps/api/src/storage/inMemoryStore.ts`
    - Added report row typing + `mapReport` mapping.
    - Added `getSessionReport(clerkUserId, sessionId)` for owned-session report lookup.
    - Added `getReportByPublicId(clerkUserId, publicId)` for `/reports/:id` ownership-safe lookup.
    - Added `generateSessionReport(clerkUserId, sessionId)`:
      - requires completed sessions,
      - materializes/updates report rows (idempotent per session_id),
      - writes a default evaluation row,
      - marks session `report_status` as `ready`.
  - `apps/api/src/routes/sessions.ts`
    - Added `POST /sessions/:id/report` and `GET /sessions/:id/report`.
    - Kept transcript endpoint `/sessions/:id/messages` and moved specific-id subroutes ahead of generic `/:id`.
  - `apps/api/src/routes/reports.ts` + `apps/api/src/index.ts`
    - Added `GET /reports/:id` for report-by-public-id lookup.
  - Next step: wire this into web session detail/report UI and add real evaluator scoring model in `mediaRuntime`/`report` worker path.

## REPORT-UI progress checkpoint (2026-03-13)
- Added minimal frontend report/transcript path on Screen 3 (`apps/web/src/main.ts`):
  - Added session detail pane and actions for completed sessions:
    - `View report` -> `POST /sessions/:id/report` then render report summary/recommendations.
    - `View transcript` -> `GET /sessions/:id/messages?limit=50`.
  - Added session failureReason display and quick identity reset button (`Clear identity`).
  - Keeps existing session update/cancel/start actions intact.
- Next step: add dedicated /report page and report-public-id share view using `/reports/:id`.
## REPORT-UI continuation checkpoint (2026-03-13)
- Added standalone report page route in web SPA using hash routing (`#report/:id`):
  - `apps/web/src/main.ts` now parses `location.hash` via `route()`.
  - Added `bindReportScreen(publicReportId)` that fetches `/reports/:id` and renders a dedicated report view.
  - Added `renderReportScreen`, `mountHomeRoute`, `openReportPageById` helpers.
- Session list `View report` action now:
  - keeps inline render,
  - adds `Open standalone report` action linking to `#report/<publicReportId>`.
- Added hashchange-driven navigation and `Back` action from report view.
- Next steps: reuse same report screen for a public share link UX and add transcript + evaluator details on report view.

## CALLBACK->REPORT automation checkpoint (2026-03-13)
- Added automatic report materialization in callback path:
  - `apps/api/src/storage/inMemoryStore.ts`
    - Added private helper `ensureSessionReportReady(...)` for session-completed auto upsert.
    - Called from `handleTwilioStatusCallback(...)` when transitioning into `completed` (first transition only).
    - Updates/creates `reports` rows and evaluation row in the same callback transaction.
    - Sets `sessions.report_status = 'ready'`.
- This shifts report generation from manual-only action toward automatic call-close path for MVP readiness and aligns notification pipeline (`sendReportReadyNotifications`) prerequisites.

## MVP sequence continuation checkpoint (2026-03-13)
- Updated web report access flow in `apps/web/src/main.ts`:
  - `View report` on completed sessions now loads existing report via `GET /sessions/:id/report` first.
  - Falls back to `POST /sessions/:id/report` only when report is not found / not ready.
  - Keeps standalone report jump and refresh action paths.
- Benefit for MVP: removed unnecessary manual regeneration path and enables immediate access to auto-generated reports after callback completion.

## NOTIFICATION worker batch checkpoint (2026-03-13)
- Added worker orchestration endpoint set in `apps/api/src/routes/workers.ts` for notification scheduling automation:
  - Added `/workers/run` and `/workers/run-all` (alias) to execute in one pass:
    - `store.dispatchDueScheduledSessions`
    - `store.sendDueReminders`
    - `store.markMissedScheduledSessions`
    - `store.sendReportReadyNotifications`
  - Added `WorkerBatchRunResult` response with per-step counts and `ranAt` timestamp.
- Purpose: provide a single operational endpoint for periodic runner and reduce manual multi-step execution in MVP.

## NOTIFICATION worker auto-loop checkpoint (2026-03-13)
- Added optional in-process worker loop in `apps/api/src/index.ts` for MVP auto-run:
  - Env controls:
    - `ENABLE_WORKER_BATCH_LOOP=true` to activate
    - `WORKER_BATCH_INTERVAL_MS` (default `30000`, min `1000`)
    - `WORKER_BATCH_LIMIT` (default `20`)
  - Each cycle calls, inside one guarded loop to avoid overlap:
    - `store.dispatchDueScheduledSessions`
    - `store.sendDueReminders`
    - `store.markMissedScheduledSessions`
    - `store.sendReportReadyNotifications`
  - Logs batch summary only when there are pending actions and logs failures without crashing the process.
- This finalizes the MVP notification/worker auto-execution path on single-node API when enabled.

## NOTIFICATION retry policy checkpoint (2026-03-13)
- Enhanced `apps/api/src/storage/inMemoryStore.ts` `sendReportReadyNotifications(...)` for retryable delivery:
  - Added `kakao_status` states: `sent`, `retrying`, `failed`.
  - Reports in `failed` remain eligible for retry until `error_code` indicates `retry_5_*`.
- Retry attempts are tracked in `error_code` as `retry_<n>_<reason>` (up to 5 attempts).
  - Success or terminal failure updates report row inside callback transaction and webhook event logs `nextStatus`.
- `apps/api/src/routes/workers.ts` batch runner remains the explicit operator path (`/workers/run`, `/workers/run-all`) for manual/cron trigger, now compatible with retryed failed reports.

## NOTIFICATION worker query hardening checkpoint (2026-03-13)
- Fixed dynamic SQL placeholder branching in pps/api/src/storage/inMemoryStore.ts for getReportDeliveryStates to avoid positional-parameter edge cases.
  - Replaced interpolated LIMIT / switching with explicit query branches by filter path (status present / absent).
  - Kept public response contract unchanged for GET /workers/report-delivery and continued preserving etry_ retry audit compatibility.
- Next step target remains: proceed to remaining MVP completion blocks from plan (frontend visibility + billing/finalization touchpoints).

## CALL/INTEGRATION hardening checkpoint (2026-03-14)
- Fixed `apps/api/src/storage/inMemoryStore.ts` Twilio outbound integration gaps for MVP hardening:
  - corrected `confirmPhoneVerification` update query column typo (`clerk_user_id`).
  - hardened `resolveToNumber(...)` so already-prefixed E.164 values remain valid and country-code prefixing is explicit.
- Connected `POST /calls/initiate` to pass explicit call-provider options to store:
  - `twimlUrl` and `statusCallbackUrl` resolution from env or derived host.
  - provider sender number (`from`) resolution from env (`TWILIO_FROM_NUMBER` / `TWILIO_FROM_PHONE_NUMBER` / `TWILIO_FROM`).
- Added route-side base URL fallback helper to ensure TwiML/status callback defaults resolve consistently.
- This does not include any destructive migrations or production provider credential rotation work.


## BILLING-001 lightweight bootstrap checkpoint (2026-03-13)
- Added shared contracts for billing objects (BillingPlan, UserSubscription) in packages/shared/src/contracts.ts.
- Added DB row mappers + store methods in pps/api/src/storage/inMemoryStore.ts:
  - listBillingPlans() to return active catalog from plans table.
  - getUserActiveSubscription(clerkUserId) to return latest active/trialing subscription for authenticated user or null.
- Added new API routes in pps/api/src/routes/billing.ts:
  - GET /billing/plans (unauthenticated catalog lookup).
  - GET /billing/subscription (authenticated current subscription lookup).
- Wired billing router in pps/api/src/index.ts at /billing.
- This is the BILLING-001 선행 경로(Plan API)으로, 다음 단계에서 결제 provider/checkout/webhook( BILLING-002/003 )과 동기화는 이어서 진행.

## BILLING-002 / BILLING-003 continuation checkpoint (2026-03-13)
- Extended webhook handling and checkout path for paid billing in:
  - `apps/api/src/routes/billing.ts`
  - `apps/api/src/storage/inMemoryStore.ts`
- Billing route hardening:
  - webhook parser now supports more provider-like shapes (`body.type/event`, `data`, `object`, metadata, `status` derivation fallback).
  - idempotency key for webhook events now uses `{provider}:{eventType}:{eventId|providerSubscriptionId}`.
  - explicit payload validation for required fields before store call.
- Billing state transitions:
  - `handlePaymentWebhook` now uses normalized status helper and active-status checks.
  - idempotent duplicates return latest subscription row via dedupe key without reapplying ledger grants.
  - grant/refund policy:
    - grants allowance only when entering active/trialing from non-active (prevents duplicate credits on repeated active events).
    - active plan switch updates user `plan_code` without adding credits when already active.
    - canceled/inactive transitions fall back to other active subscriptions first, then `free`.
- `BILLING-003` policy hook for entitlement behavior:
  - session creation now respects user-plan max duration (`plan.max_session_minutes`) for non-admin users.
  - allows duration up to plan max while preserving admin override.

## BILLING-002/003 hardening checkpoint (2026-03-13)
- Implemented optional payment webhook verification:
  - `apps/api/src/index.ts`
    - `express.json`에 raw 바디를 보존하는 `verify` 훅을 추가해 `req.rawBody`에 원문 문자열 저장.
  - `apps/api/src/routes/billing.ts`
    - `BILLING_WEBHOOK_SECRET`가 설정된 경우에만 동작하는 시그니처 검증 추가.
    - 지원 헤더: `x-signature`, `x-payment-signature`, `x-webhook-signature`, `payment-signature`, `stripe-signature`.
    - `sha256` HMAC `hex`/`base64` 일치 여부로 검증하며 실패 시 401/`forbidden` 반환.
- BILLING 상태 동기화 보강:
  - `apps/api/src/storage/inMemoryStore.ts`
    - 활성 구독 전환 시 allowance 반영을 `applyActiveSubscriptionAllowance`로 통합.
    - `paid_minutes_balance`/`trial_calls_remaining` 증액과 함께 `credit_ledger`에 `grant` 항목 기록.
    - 기존 `shouldGrantAllowance` 조건(비활성 → 활성 전환, 신규 활성 구독)에서만 신규 크레딧을 부여.
- MVP 정책 정합성 정리:
  - `apps/api/src/routes/sessions.ts`
    - Phase 1 고정 10분 duration 제한 체크 제거.
    - duration 제한은 사용자 plan 기반 정책(`plan.max_session_minutes`)으로 이동.

## CALL-003 implementation checkpoint (2026-03-14)
- Completed user-facing call-control API additions in `apps/api/src/routes/calls.ts`:
  - Added `GET /calls/:id` for owner-scoped lookup.
  - Added `POST /calls/:id/end` for app-initiated call completion.
- Added matching store APIs in `apps/api/src/storage/inMemoryStore.ts`:
  - `getSessionByIdentifierForUser(clerkUserId, identifier)` for lookup by session id / call_id / public_id / provider_call_sid with ownership check.
  - `endSessionCall(clerkUserId, callOrSessionId)` for deterministic end behavior.
- End behavior in MVP:
  - allowed for active states (`dialing`, `ringing`, `in_progress`, `ending`) only.
  - idempotent for terminal sessions.
  - reserved allowance is committed and session is finalized to `completed`.
- Remaining follow-up (post-MVP scope): Twilio call update/cancel API integration when available.

## CALL-005 transition-hardening checkpoint (2026-03-14)
- Completed provider callback transition hardening in `apps/api/src/storage/inMemoryStore.ts`:
  - Added callback status normalization (`_` -> `-`, case-insensitive handling).
  - Extended non-standard terminal statuses (`canceled`, `cancelled`, `error`) to mapped `provider_error` terminal transitions.
  - Kept `no_answer`, `busy`, `voicemail`, `provider_error` as terminal statuses per PRD.
  - Adjusted `completed` platform-fault classification to evaluate call-duration/error-code signals without requiring `answered_at` pre-set.
- This satisfies `CALL-005` state mapper behavior expectations and keeps terminal state/failure_reason separation.

## CALL-003 hardening checkpoint (2026-03-14)
- Completed `POST /calls/:id/end` provider-runtime tie-in:
  - Added `endOutboundCall` in `apps/api/src/services/callProvider.ts` (Twilio `Calls` API status update path + mock fallback).
  - Updated `apps/api/src/storage/inMemoryStore.ts` `endSessionCall(...)` to attempt provider hangup before local terminal transition.
  - Added webhook event trail (`event_type=call_end`, event `app_end_provider_failed`) for provider-side termination failures; DB state transition remains idempotent and still commits allowance.
- Result: app-side end now triggers provider call completion path (best-effort) as close-form `CALL-003` hardening target.

## CALL-006 hardening checkpoint (2026-03-14)
- Reduced platform-fault false positives from stream lifecycle handling:
  - `apps/api/src/mediaStream.ts` now treats websocket close codes 1000/1001 as normal-close and only emits unexpected-close fault for abnormal close codes.
  - Close callbacks now include close-code context in `onStreamClose`.
- Reduced invalid provider-hangup attempts in app end path:
  - `apps/api/src/storage/inMemoryStore.ts` now only calls `endOutboundCall` when `provider_call_sid` looks like a Twilio SID (`CA*`).

## WEB-004 continuation checkpoint (2026-03-14)
- Completed minimal in-call action visibility for MVP flow in `apps/web/src/main.ts`:
  - Added `Call` action controls on session cards for live states (`dialing` / `ringing` / `in_progress` / `ending`):
    - `Check call status` -> `GET /calls/:id`
    - `End call` -> `POST /calls/:id/end`
  - Session list now surfaces immediate feedback for app-side call polling and end attempts, and refreshes list after status/end updates.
- This completes the basic Screen-5 style call control affordance and keeps progression on frontend side without changing scope.


## CALL-006/IN-MEDIA integration follow-up checkpoint (2026-03-14)
- Fixed pps/api/src/index.ts runtime cleanup callback bug: onStreamClose now receives sessionId and early-returns when missing (_sessionId undefined reference removed). This unblocks compilation for the CALL-006 hardening path.


## REPORT-004 baseline checkpoint (2026-03-14)
- Added report failure accounting in pps/api/src/storage/inMemoryStore.ts:
  - markReportFailure / markReportFailureInTransaction helpers added to persist eport_status='failed' and error_code, with ttempt_count increment behavior.
  - generateSessionReport now hard-blocks manual retries after 3 consecutive failed attempts (alidation_error: report generation retry limit reached) and persists failure on non-terminal failures.
  - In callback flow (handleTwilioStatusCallback), ensureSessionReportReady failures now mark report as failed in the same session transaction instead of aborting callback transition.
- This gives report retry budget visibility and delayed-failure state capture for MVP hardening.

## REPORT-004 retry-handling continuation checkpoint (2026-03-14)
- `POST /sessions/:id/report` flow finalized for retry budget signaling:
  - `generateSessionReport` now throws `AppError("conflict", "report generation retry limit reached")` after 3 failed attempts.
  - `/sessions/:id/report` route now maps conflict errors to `409` explicitly.
  - Non-terminal report generation failures continue to persist failure state (`status=failed`, `error_code`, `attempt_count` increment), including auto-generation path in callback.
- This keeps failure state observable in UI/report lookup before full evaluator/queueing work.
## BILLING-002 mock checkout correction checkpoint (2026-03-14)
- Adjusted `apps/api/src/storage/inMemoryStore.ts` `createCheckoutSession` to pass caller `clerkUserId` into `billing/mock-checkout` session params (`user` field) instead of internal DB user UUID.
- This keeps mock webhook/provider payloads aligned with `getUser(clerk_user_id)` lookup expectations in payment webhook handling.
- No external payment provider integration was added yet; mock checkout route wiring remains as next optional hardening item.
## REPORT-004 UI visibility continuation (2026-03-14)
- Updated `apps/web/src/main.ts` report rendering to expose `errorCode` and explicit `failed` status message when `/sessions/:id/report` returns failed state.
- Keeps manual refresh action so users/operators can trigger retry path after transient generation issues.
## BILLING-002 mock checkout flow continuation (2026-03-14)
- Added mock checkout endpoints in `apps/api/src/routes/billing.ts`:
  - `GET /billing/mock-checkout` renders a minimal approve/cancel HTML for manual local simulations.
  - `GET /billing/mock-checkout/result` applies mock webhook transitions via `store.handlePaymentWebhook` and returns/redirects to provided `returnUrl` or `cancelUrl`.
- Restored crypto imports (`createHmac`, `timingSafeEqual`, `randomUUID`) and added helper utilities for mock-query parsing and page rendering in the same route file.
## BILLING UI hardening continuation (2026-03-14)
- Added billing workflow screen in `apps/web/src/main.ts`:
  - New nav entry `Screen 4: Billing`.
  - New `screenBilling()` + `bindBillingScreen()`:
    - loads `/billing/subscription` and `/billing/plans`,
    - renders available plans,
    - triggers `/billing/checkout` for selected plan and navigates to returned checkout URL.
- This closes the MVP gap for manual mock-payment path access from front-end.

## Media fault classification continuation (2026-03-14)
- Fixed duplicate crypto import in `apps/api/src/routes/billing.ts` (`createHmac` now imported once with `randomUUID` and `timingSafeEqual`).
- Refined `apps/api/src/index.ts` media-fault terminal mapping for websocket/runtime incidents:
  - `onStreamFault` now maps abnormal close/runtime errors to explicit `FailureReason` before terminaling a session:
    - `websocket_error` / `media_runtime_error` -> `platform_fault`
    - `websocket_unexpected_close` -> `platform_fault` for server-close class errors (`1011`, `1014`, 5xx) otherwise `provider_error`
    - other stream faults -> `provider_error`
  - Keeps stream close cleanup via `mediaRuntime.clearSession(sessionId)` and logs stream fault payload through `markMediaStreamError`.
- Duplicate `attachMediaStreamServer` registration was removed so runtime callback wiring is single-sourced.

## REPORT-004 evaluator hardening continuation (2026-03-14)
- `apps/api/src/storage/inMemoryStore.ts`
  - Replaced ad-hoc report-summary generation in `generateSessionReport` and `ensureSessionReportReady` with shared evaluator path:
    - Added `buildReportEvaluatorInput`, `loadSessionMessagesForEvaluation`, and `persistSessionReportArtifacts`.
    - Both manual (`POST /sessions/:id/report`) and callback auto-generation now call one shared persistence path that writes report summary/recommendations and full evaluator scores.
  - `evaluations` persistence now stores:
    - `grammar_score`, `vocabulary_score`, `fluency_score`, `topic_score`, `total_score`
    - `level_assessment`
    - `score_delta` (computed against previous stored total if present)
    - `grammar_corrections`, `vocabulary_analysis`, `fluency_metrics`, `scoring_version`
  - Maintained existing report retry policy:
    - manual path still blocks at 3+ failed attempts.
    - `markReportFailure` remains as the failure sink for non-terminal report generation errors.

## NOTIFY-002 continuation (2026-03-14)
- `apps/api/src/storage/inMemoryStore.ts`
  - `sendReportReadyNotifications` hardening completed:
    - Kakao report payload now includes optional deep-link (`publicSummaryUrl`) when public base URL is available.
    - Success statuses are now normalized to terminal `sent`/`accepted` and stop re-queueing.
    - On success, stored `error_code` is cleared to avoid stale failure carry-over.
    - `kakao_status='accepted'` and `'sent'` are both treated as terminal completion states (including sent timestamp update).
  - Existing behavior continues to keep failures non-blocking:
  - failure/retry statuses and webhook event emission remain unchanged so app availability is unaffected by Kakao outage.

- `apps/api/src/storage/inMemoryStore.ts`
  - Fixed small regression in `sendDueReminders`: removed unreachable `_notifications` write path so reminder worker no longer references an undefined variable and remains purely transaction-safe.

## STRIPE/TELEGRAM hardening continuation (2026-03-14)
- Implemented operational contract hardening for live billing checkout routing and Telegram routing:
  - `apps/api/src/storage/inMemoryStore.ts`
    - Added checkout callback URL resolver with provider-aware env override chain:
      - `PAYMENT_RETURN_URL_<PROVIDER>` / `PAYMENT_CANCEL_URL_<PROVIDER>`
      - `PAYMENT_RETURN_URL` / `PAYMENT_CANCEL_URL`
      - fallback to `PUBLIC_BASE_URL`-based `/billing/checkout?provider=...` path
    - `createCheckoutSession()` now injects resolved return/cancel URLs into live and mock checkout payloads and mock URL params.
    - Live checkout request body now always carries explicit callback URLs (`success_url`, `cancel_url`) for provider compatibility.
  - `apps/api/src/services/telegramNotifier.ts`
    - Added user-specific Telegram chat routing hooks:
      - `TELEGRAM_CHAT_ID_MAP` / `TELEGRAM_CHAT_ID_MAP_JSON` map lookup.
      - `TELEGRAM_CHAT_ID_<USER_ID_UPPER>` per-user override (best-effort).
      - `TELEGRAM_CHAT_ID_DEFAULT` fallback.
    - Fixed mock fallback guard for custom `TELEGRAM_API_URL` endpoints that do not require explicit bot token.
- `apps/web/src/main.ts` unchanged in this checkpoint (billing UI already passes selected provider as-is).
- Next remaining hardening target: explicit Stripe event/response scenario checklist + provider-replay smoke test plan before turning test execution on.

## BILLING-002 provider split continuation (2026-03-14)
- `packages/shared/src/contracts.ts`
  - Extended `CreateCheckoutSessionPayload` with optional `provider` input for provider override at checkout create time.
- `apps/api/src/storage/inMemoryStore.ts`
  - Added checkout provider resolution in `createCheckoutSession`:
    - `provider=mock` keeps the built-in mock checkout route.
    - non-mock providers call `PAYMENT_PROVIDER_CREATE_URL` via HTTP and parse response fields for `checkoutUrl` and optional provider session id.
  - Added checkout response parsing + auth helpers for live provider integration:
    - `PAYMENT_PROVIDER_BEARER_TOKEN`
    - `PAYMENT_PROVIDER_AUTH_HEADER` + `PAYMENT_PROVIDER_AUTH_VALUE`.
- `apps/api/src/routes/billing.ts`
  - Added `/webhooks/:provider` alias with provider-specific secret lookup (`BILLING_WEBHOOK_SECRET_<PROVIDER>` fallback to `BILLING_WEBHOOK_SECRET`).
  - Checkout request now forwards optional `provider` field to the store.

## Stripe/Telegram extension continuation (2026-03-14)
- `packages/shared/src/enums.ts`
  - Added `"telegram"` to `WebhookProvider` union.
- `apps/api/src/storage/inMemoryStore.ts`
  - Added provider-aware checkout path in `createCheckoutSession`:
    - `provider=mock` route stays local; non-mock routes call live provider endpoint with provider-specific env resolution.
  - Added provider-level endpoint/auth helpers:
    - `PAYMENT_PROVIDER_CREATE_URL_<PROVIDER>` / `PAYMENT_PROVIDER_CREATE_URL`
    - `PAYMENT_PROVIDER_BEARER_TOKEN_<PROVIDER>` / `PAYMENT_PROVIDER_BEARER_TOKEN`
    - `PAYMENT_PROVIDER_AUTH_HEADER_<PROVIDER>` + `PAYMENT_PROVIDER_AUTH_VALUE_<PROVIDER>`
    - default `PAYMENT_PROVIDER` fallback remains `"mock"`.
  - Added `kakao` + `telegram` provider-aware notification dispatch helpers:
    - provider discovery from env
    - per-provider send attempts for reminders/report notifications
    - per-provider webhook event rows (`kakao_reminder`, `telegram_reminder`, `kakao_report_ready`, `telegram_report_ready`)
    - event-level summary row for report delivery.
- `apps/api/src/services/telegramNotifier.ts` (new)
  - Telegram bot sender for reminder and report-ready payloads with mock fallback when env is not configured.
- `apps/api/src/routes/billing.ts`
  - `/billing/checkout` receives optional `provider` and forwards to store.
  - Added `/webhooks/:provider` alias to allow provider-specific secret + signature validation.
- `apps/web/src/main.ts`
  - Billing screen added provider selector (`auto`/`stripe`/`mock`), and passes it to checkout request.
- Current behavior notes:
  - `createCheckoutSession` still returns Stripe-compatible request payload with fields like `line_items`, `mode`, `success_url`, `cancel_url` for provider `"stripe"`.
  - Telegram dispatch currently uses global recipient config (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) and shared report payload fields.

## Next step target
- Validate live Stripe endpoint contract and Telegram destination policy (`TELEGRAM_CHAT_ID` mapping strategy) before enabling real mvp external smoke test.

## Stripe/Telegram polish continuation (2026-03-14)
- Telegram sender normalization completed in `apps/api/src/services/telegramNotifier.ts`:
  - Message templates rewritten to ASCII-safe text.
  - `chat_id` passed only when available; custom endpoint mode (`TELEGRAM_API_URL`/`TELEGRAM_API_ENDPOINT`) can now be used without hard-requiring `TELEGRAM_CHAT_ID` in transport layer.

## BILLING-003 implementation continuation (2026-03-14)
- Aligned API error semantics to PRD expectations for allowance + duration paths:
  - `apps/api/src/routes/sessions.ts`
    - `DURATION_SCOPE_ERROR` now maps to `422` with `invalid_duration_for_plan`.
    - `INSUFFICIENT_ALLOWANCE` now maps to `402` with `insufficient_allowance`.
  - `apps/api/src/routes/calls.ts`
    - `INSUFFICIENT_ALLOWANCE` now maps to `402` with `insufficient_allowance`.
  - Extended shared error code contract in `packages/shared/src/contracts.ts`:
  - Added `insufficient_allowance` and `invalid_duration_for_plan` to `ApiErrorCode`.
- Enabled plan-aware session duration options on Session screen in `apps/web/src/main.ts`:
  - Binds available duration options after loading `/users/me` and `/billing/plans`.
  - Keeps free/trial default to `10` and allows `15` when subscribed plan `maxSessionMinutes >= 15`.

## CALL-006 continuation (2026-03-14)
- Added shared callback fault classifier in `apps/api/src/callFaultClassifier.ts`:
  - `classifyTwilioFailureReason` + `isTwilioCompletedPlatformFault` for Twilio status callback path.
  - `classifyMediaStreamFailureReason` for Twilio media-stream/websocket fault path.
  - Rule alignment now enforces: no-answer/busy are never platform_fault by this classifier, while completed short calls and transport 5xx/normal close-fault paths still map to platform_fault when intended.
- Applied Twilio callback path to the shared classifier in `apps/api/src/storage/inMemoryStore.ts` (`handleTwilioStatusCallback`), removing duplicated local platform-fault classification logic.
- Applied shared media-stream fault classifier in `apps/api/src/index.ts` `onStreamFault` callback.

## BILLING-004 continuation (2026-03-14)
- Implemented subscription transition settlement policy in `apps/api/src/storage/inMemoryStore.ts`:
  - Added `resolveAnyPlan` (active-agnostic plan lookup) for transition calculations.
  - Added `applyPlanUpgradeAllowanceDelta` to grant only positive deltas on active subscription plan upgrades:
    - `trial_calls` and `included_minutes` are increased only when the new plan increases each dimension.
  - In `handlePaymentWebhook`:
    - New subscriptions only grant on active/trialing statuses.
    - Active→active events with plan changes now apply delta top-up instead of re-granting full allowance.
    - Existing fallback behavior for inactive/active status changes and user `plan_code` fallback remains intact.

## BILLING-002/Stripe contract hardening continuation (2026-03-14)
- `apps/api/src/routes/billing.ts`:
  - `readWebhookStatus` now checks additional status keys (`payment_status`, `subscription_status`) from body/object.
  - Added event-type fallback mapping for `succeeded`/`paid`/`completed` webhook events to avoid null status rejection on Stripe-style payloads.
  - Extended `parseWebhookPayload` to resolve `providerSubscriptionId` from more Stripe-like paths (`subscription`, `subscription_data`, and invoice line item subscription references).
- `apps/api/src/storage/inMemoryStore.ts`:
  - Fixed live Stripe checkout request payload URL mapping:
    - `success_url` now always uses resolved return URL.
    - `cancel_url` now always uses resolved cancel URL.
  - Added `subscription_data.metadata` in Stripe checkout request body to carry plan/user context back through downstream provider payloads.
- Current checkpoint:
  - Ready for external provider smoke-run setup (live Stripe URL + webhook signing validation + mock/real URL overrides).
  - Next target: collect one explicit STRIPE provider test contract matrix (checkout create + webhook scenarios + retry/failure path) and then move to MVP completion confirmation.

## FLOW-CLOSE implementation continuation (2026-03-14)
- `apps/web/src/main.ts`
  - Added hash-route aware billing return handling:
    - `#billing?checkout=success|cancel&provider=...&plan=...`
    - billing screen now loads directly from route and clears one-time return params after showing the result.
  - Session UI now surfaces:
    - status + report status
    - failure reason
    - formatted scheduled time
    - tighter action matrix by lifecycle status
    - clearer next-step messages after start/end/update/cancel actions
  - Inline and standalone report views now render stored evaluator details when available:
    - total/sub scores
    - level assessment
    - grammar corrections
    - vocabulary analysis
    - fluency metrics
  - Frontend error handling now maps allowance/duration/conflict/not-found cases to user-facing guidance instead of generic failures.
- `packages/shared/src/contracts.ts`
  - Extended `Report` with optional `evaluation` payload.
- `apps/api/src/storage/inMemoryStore.ts`
  - `getSessionReport` / `getReportByPublicId` now attach evaluator rows to report payloads when present.
  - Public report URLs now point to SPA hash route (`/#report/...`).
  - Checkout fallback callback route now points to `#billing`.
- `apps/api/src/routes/billing.ts`
  - Checkout route now preserves actionable `validation_error` messages.
- `apps/api/src/routes/calls.ts`
  - Call initiation route now preserves actionable `validation_error` messages from store-level setup failures.
- Remaining work after this checkpoint:
  - external provider E2E validation only (Stripe/Telegram/Twilio live contract verification and scenario testing)

## PROVIDER hardening continuation (2026-03-14)
- `apps/api/src/routes/billing.ts`
  - Fixed provider-specific webhook route behavior so `/billing/webhooks/:provider` no longer silently falls back to `mock` when the payload omits `provider`.
  - Webhook error responses now preserve `validation_error` and `not_found` details from store processing, improving live provider smoke debugging.
  - Stripe-style webhook parsing widened further:
    - additional event name aliases (`event`, `event_name`)
    - `expired` -> canceled mapping
    - extra metadata lookup (`userId`, `user_id`, `priceId`, `price_id`)
    - line-item / price based plan resolution
    - period start/end extraction from invoice/subscription style payloads
- `apps/api/src/storage/inMemoryStore.ts`
  - Live checkout request body now includes extra Stripe-friendly aliases:
    - `success_redirect_url`
    - `cancel_redirect_url`
    - `metadata.priceId`
    - `subscription_data.metadata.priceId`
  - Live checkout response parsing now accepts broader provider shapes:
    - `checkout_url`
    - `sessionUrl` / `session_url`
    - nested `checkout_session.url`
    - `sessionId` / `session_id`
    - nested `checkout_session.id`
  - Telegram notification provider detection no longer hard-requires `TELEGRAM_BOT_TOKEN` when custom endpoint mode is used.
- `apps/api/src/services/telegramNotifier.ts`
  - Telegram per-user routing env keys are now normalized (`A-Z0-9_`) so user ids containing `-` or other symbols can still map through `TELEGRAM_CHAT_ID_<NORMALIZED_USER_ID>`.
  - `TELEGRAM_CHAT_ID_MAP(_JSON)` now supports both raw and normalized user-id keys.
- Current next step:
  - real provider scenario validation only: Stripe create-checkout response contract, Stripe webhook sample matrix, Telegram destination policy final values.

## PROVIDER E2E runbook continuation (2026-03-14)
- Added runbook: `docs/runbooks/provider-e2e-matrix.md`
  - fixed live-provider validation order and preconditions
  - documented Stripe checkout create request/response contract
  - documented Stripe webhook scenario matrix
  - documented Telegram routing priority and per-user env normalization
  - documented Twilio smoke scenarios and go/no-go criteria
- Immediate next session target:
  - inject real provider values
  - run smoke in this order:
    1. Stripe checkout create
    2. Stripe webhook success/update/delete/replay
    3. Telegram reminder/report-ready
    4. Twilio immediate call
    5. Twilio scheduled/failure/replay

## POSTGRES first-time onboarding continuation (2026-03-14)
- Added beginner runbook: `docs/runbooks/postgres-first-time-setup.md`
  - explains recommended Supabase path
  - explains where to get `DATABASE_URL`
  - explains how to run both migration SQL files
  - explains `pgcrypto` prerequisite for `gen_random_uuid()`
  - explains why `20260313_phase1_rls.sql` is Supabase-oriented due to `auth.jwt()`
  - includes seed SQL for initial `plans` rows: `free`, `basic_mock`, `pro_mock`

## OPERATOR live setup checklist continuation (2026-03-14)
- Added operator checklist: `docs/runbooks/operator-live-setup-checklist.md`
  - reorganized the provider onboarding sequence into the exact operator flow:
    - Postgres
    - migration + seed
    - Twilio
    - Telegram
    - Stripe product/price preparation
    - env population
    - public URL fixation
    - Stripe webhook registration
    - smoke execution
  - includes exact `.env` insertion points and concrete examples of what to copy from each provider console

## OPERATOR live setup checklist localization checkpoint (2026-03-14)
- Translated `docs/runbooks/operator-live-setup-checklist.md` into Korean for direct operator use.
- Preserved the same step order and operational meaning:
  - Postgres / migration / plans
  - Twilio
  - Telegram
  - Stripe product + price
  - env population
  - public URL setup
  - Stripe webhook
  - smoke execution

## RUNBOOK localization checkpoint (2026-03-14)
- Translated `docs/runbooks/postgres-first-time-setup.md` into Korean.
  - Preserved Supabase-first recommendation, migration order, `pgcrypto` prerequisite, and plain PostgreSQL caveat.
- Translated `docs/runbooks/provider-e2e-matrix.md` into Korean.
  - Preserved Stripe/Telegram/Twilio contract details, smoke scenarios, and go/no-go checks.

## TWILIO runbook expansion checkpoint (2026-03-14)
- Added dedicated Twilio operator runbook: `docs/runbooks/twilio-live-setup.md`
  - covers trial vs upgraded account constraints
  - voice-capable number purchase
  - verified caller ids for trial
  - geographic permissions
  - required public URLs and media-stream websocket expectations
  - exact env values and smoke sequence
- Linked the new Twilio runbook from:
  - `docs/runbooks/operator-live-setup-checklist.md`
  - `docs/runbooks/provider-e2e-matrix.md`

## WEB VOICE transition design checkpoint (2026-03-14)
- Wrote design spec: `docs/superpowers/specs/2026-03-14-web-voice-mvp-transition-design.md`
  - redefines MVP from PSTN phone delivery to phone-like live web voice
  - preserves session/billing/report/notification core flows
  - recommends keeping current `calls` API surface while swapping internals to web voice runtime
  - replaces PSTN-centric status/failure model with browser/media-centric live session model

## WEB VOICE implementation checkpoint (2026-03-14)
- Implemented first vertical slice of the web voice transition:
  - extended shared contracts/enums for web voice bootstrap and runtime events
  - added `apps/api/src/services/openaiRealtime.ts`
  - added `apps/api/src/services/webVoiceSessionService.ts`
  - switched `/calls/initiate` to OpenAI Realtime bootstrap path
  - added `/calls/:id/join`, `/calls/:id/runtime-event`, `/calls/:id/runtime-complete`
  - added store methods for web voice bootstrap, runtime event handling, bootstrap failure cleanup, and runtime completion
  - added browser client helper `apps/web/src/lib/webVoiceClient.ts`
  - updated session UI to start/join live web sessions in-browser
- Remaining blocks after this checkpoint:
  - docs/runbook migration from Twilio-first to web-voice-first
  - optional removal of Twilio media server from default boot path
  - deeper transcript/report hardening against partial Realtime event shapes

## WEB VOICE docs migration checkpoint (2026-03-14)
- Added `docs/runbooks/web-voice-live-setup.md`
  - OpenAI Realtime / browser microphone / HTTPS 기준 운영 세팅 문서화
- Updated `docs/runbooks/operator-live-setup-checklist.md`
  - Twilio 번호 확보 단계를 제거하고 OpenAI Realtime 준비 단계로 교체
- Updated `docs/runbooks/provider-e2e-matrix.md`
  - Twilio smoke matrix를 Web Voice live session matrix로 교체
- Marked `docs/runbooks/twilio-live-setup.md` as deprecated for MVP primary path
- Remaining blocks after this checkpoint:
  - Twilio media server default boot path 제거
  - Realtime transcript/report hardening

## WEB VOICE runtime boot checkpoint (2026-03-14)
- Updated `apps/api/src/index.ts` so `attachMediaStreamServer(...)` only boots when `ENABLE_TWILIO_MEDIA_STREAM=true` or `CALL_PROVIDER=twilio`.
- Default server startup now favors the browser Web Voice runtime path; Twilio media stream runtime is no longer attached by default for MVP.
- Existing Twilio media fault handling remains intact for fallback/dev scenarios behind the explicit env gate.
- Remaining blocks after this checkpoint:
  - Realtime transcript/report hardening
  - browser runtime event edge-case cleanup

## WEB VOICE transcript hardening checkpoint (2026-03-14)
- Hardened `apps/web/src/lib/webVoiceClient.ts` for browser runtime edge cases:
  - microphone denial now emits `permission_denied` and runtime completion failure payloads
  - assistant transcript aggregation now accepts additional Realtime event shapes such as `response.output_text.delta` and `response.output_item.done`
  - explicit user end now emits `participant_left` before completion
- Hardened `apps/api/src/storage/inMemoryStore.ts` completion handling:
  - malformed or blank transcript segments no longer wipe existing stored messages
  - transcript persistence now accepts only `assistant` / `user` / `system` roles with trimmed non-empty content
  - completion metadata now records normalized transcript count
- Remaining blocks after this checkpoint:
  - OpenAI Realtime session/response contract hardening if live API differs
  - end-to-end scenario testing after MVP coding closure

## WEB VOICE OpenAI contract hardening checkpoint (2026-03-14)
- Hardened `apps/api/src/services/openaiRealtime.ts` to accept broader Realtime bootstrap response shapes.
- Client secret extraction now tolerates nested or aliased fields such as:
  - `client_secret.value`
  - `client_secret.secret`
  - `secret.value`
  - `ephemeral_key.secret`
  - `clientSecret`
  - `token`
  - nested `session.*` variants
- Expiration parsing now tolerates string or numeric epoch-style values and normalizes numeric values to ISO strings.
- Model resolution now prefers provider-returned `payload.model` or `payload.session.model` before falling back to configured default.
- Remaining blocks after this checkpoint:
  - full end-to-end scenario testing after MVP coding closure

## WEB VOICE local env model alignment checkpoint (2026-03-14)
- Confirmed local `apps/api/.env` now contains `OPENAI_API_KEY`.
- Set local OpenAI runtime defaults for current MVP direction:
  - `OPENAI_REALTIME_MODEL=gpt-realtime`
  - `OPENAI_REALTIME_VOICE=alloy`
  - `OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`
  - `OPENAI_REALTIME_SESSION_URL=https://api.openai.com/v1/realtime/sessions`
- Removed lingering Twilio credential lines from the primary local env so the file matches the Web Voice-first runtime path.
- Stripe / Telegram values remain intentionally unset until after first smoke testing.

## API env auto-load checkpoint (2026-03-14)
- Added `apps/api/src/loadEnv.ts` to load local env files before route/store modules initialize.
- `apps/api/src/index.ts` now imports `./loadEnv` first, so `process.env.DATABASE_URL` and `OPENAI_*` values are available during store construction.
- Env loading checks both:
  - current working directory `.env`
  - repo-root execution fallback `apps/api/.env`
- This fixes the local dev boot failure where `DATABASE_URL` existed in `apps/api/.env` but the API process never loaded that file.

## API boot syntax fix checkpoint (2026-03-14)
- Fixed a syntax error in `apps/api/src/mediaRuntime.ts` inside `flushTurn()`.
- Root cause: `state.processingTurn = false` had slipped outside the `finally` block, leaving mismatched braces before `buildAssistantReply(...)`.
- Result: esbuild stopped parsing the file and the API dev server could not boot.

## User bootstrap error visibility checkpoint (2026-03-14)
- Hardened `apps/api/src/routes/users.ts` so `/users/me` no longer hides bootstrap/load failures behind generic messages only.
- The route now logs the underlying error with `clerkUserId` context and returns the actual `Error.message` when available.
- Purpose: make `failed_to_upsert_user` debugging actionable without guessing at DB schema or request-shape issues.

## Manual screen smoke scenario checkpoint (2026-03-14)
- Added `docs/runbooks/manual-screen-test-scenarios.md`.
- Documented local MVP manual test flow by screen:
  - Screen 1 bootstrap
  - Screen 2 phone verification
  - Screen 3 immediate/scheduled/live/transcript/report flows
  - Screen 4 billing load flow
- Each scenario now includes:
  - action steps
  - success criteria
  - failure signals
- Stripe / Telegram real-integration checks remain intentionally out of this first-pass smoke document.

## React/WebVoice stabilization checkpoint (2026-03-18)
- Updated React screen files to remove visible mojibake/broken labels in Billing, Report, Verify, and Session detail close button.
- Added session polling in `apps/web/src/pages/ScreenSession.tsx` for active/live statuses and `reportStatus === 'pending'`.
- Reset stale detail panel state after session create/update/cancel/end mutations.
- Tightened `/users/me` error exposure so production falls back to sanitized messages while local development can still surface raw errors.
- Changed OpenAI realtime code fallback model from deprecated preview default to `gpt-realtime`.
- Reworked `apps/api/src/loadEnv.ts` so API-local `.env` is preferred when running from repo root, reducing accidental root `.env` overrides.
- Rewrote:
  - `docs/roadmap/2026-03-18-future-work.md`
  - `docs/runbooks/manual-screen-test-scenarios.md`
  to match the current React + WebVoice codebase rather than the old vanilla/hash assumptions.
- Remaining risks after this checkpoint:
  - no automated verification run yet
  - actual OpenAI Realtime live SDP contract still needs end-to-end smoke confirmation
  - Stripe / Telegram remain intentionally unset and unverified

## Runtime/docs hardening checkpoint (2026-03-18)

- Fixed Billing price rendering in the React screen to use `₩...` instead of a broken literal template string.
- Billing success/cancel flash is now one-shot: the query params are removed after the screen consumes them.
- Locked `apps/api/src/services/openaiRealtime.ts` fallback model to `gpt-realtime` so unset envs do not fall back to the deprecated preview model.
- Tightened `/users/me` error responses to always return sanitized messages while keeping server-side logs for investigation.
- Rewrote `DEPLOY.md` and `docs/runbooks/web-voice-live-setup.md` into clean Korean docs aligned with the current React + WebVoice deployment path.
- Updated `docs/runbooks/operator-live-setup-checklist.md` model guidance to `gpt-realtime`.
- Remaining risk: no live smoke has been run after these changes, and the provider/deploy docs still need a final wording pass if deployment scope changes again.

## Accuracy architecture v1 checkpoint (2026-03-18)

- Added shared accuracy contracts to `packages/shared/src/contracts.ts`:
  - `SessionAccuracyPolicy`
  - `SessionAccuracyState`
  - `AccuracyValidationResult`
  - `CompleteWebVoiceCallPayload` turn-count/validation hint fields
- Added `apps/api/src/services/sessionAccuracy.ts` as the v1 server-side accuracy layer.
  - `buildSessionAccuracyPolicy(...)`
  - `validateCompletedTranscript(...)`
  - `toAccuracyState(...)`
- `apps/api/src/services/openaiRealtime.ts` now accepts an accuracy policy and builds stronger English/OPIC instructions around topic lock, explicit topic switch, short responses, and correction relevance.
- `apps/api/src/services/webVoiceSessionService.ts` now computes accuracy policy during start/join bootstrap and passes it into realtime session creation.
- Added DB migration `packages/db/migrations/20260318_accuracy_policy_v1.sql` for `sessions.accuracy_policy` and `sessions.accuracy_state` JSONB columns.
- `apps/api/src/storage/inMemoryStore.ts` now:
  - maps `accuracyPolicy` / `accuracyState` on sessions
  - persists accuracy policy on web voice bootstrap
  - validates completed transcript on runtime-complete
  - stores accuracy state on the session
  - writes `web_voice_accuracy_validated` webhook/media events
  - passes accuracy state into report evaluation
- `apps/api/src/services/reportEvaluator.ts` now uses accuracy flags to bias recommendations when drift / intent mismatch / correction mismatch are detected.
- `apps/web/src/lib/webVoiceClient.ts` now sends `assistantTurns`, `userTurns`, and `validationHints` in runtime completion payloads.
- Remaining risk:
  - no migration has been run yet
  - no live smoke or typecheck has been run yet
  - validator v1 is heuristic only and English/OPIC-specific by design
