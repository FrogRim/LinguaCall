# LinguaCall Web Voice MVP Transition Design

Last updated: 2026-03-14

## 1. Goal

This design changes LinguaCall from a PSTN-phone-centered MVP into a web-based real-time voice MVP while preserving the core product identity:

- immediate spoken communication
- scheduled spoken communication
- transcript and report after conversation
- session, billing, notification, and allowance flows

The design does not change the core learning proposition. It only removes the dependency on phone numbers, country-specific telephony regulation, and PSTN provider lock-in from the MVP path.

## 2. Product Redefinition

### Previous framing

- phone-number-based AI foreign language call

### New framing

- phone-like instant web voice foreign language session

### Product truth

What matters for the user is:

- speaking and listening in real time
- feeling like they are entering a live call
- getting post-session feedback

What does not need to remain in the MVP:

- PSTN phone number delivery
- carrier routing
- country-specific outbound telephony

## 3. Scope

### In scope

- replace PSTN/Twilio-first call path with browser-based real-time voice session path
- keep existing session lifecycle, billing, notification, transcript, and report surfaces where possible
- preserve current user flow semantics:
  - create session
  - start immediately or join scheduled session
  - speak in real time
  - end session
  - inspect transcript and report

### Out of scope

- mobile native app
- real PSTN fallback for MVP
- dual-provider abstraction in this phase
- full redesign of billing or report domain behavior

## 4. Recommended Approach

### Approach A: keep current `calls` API surface, replace internals with web voice

This is the recommended approach.

Meaning:

- keep the existing `call` concept in product and API language
- reinterpret `POST /calls/initiate` as “start web voice session”
- reinterpret `End call` as “end live web voice session”
- stop treating Twilio callback/TwiML/media routes as MVP-critical paths

Why this is recommended:

- lowest disruption to the rest of the codebase
- smallest UI rewrite
- preserves existing session/report/billing pages
- keeps user-facing language stable during MVP completion

### Approach B: add separate `web-voice` API family

Not recommended for MVP.

Why:

- cleaner naming
- but larger surface change
- requires more frontend and docs churn

### Approach C: keep both PSTN and web voice active

Not recommended for MVP.

Why:

- increases complexity
- duplicates runbooks and failure modes
- not aligned with current constraint that PSTN viability is blocked for a personal toy project

## 5. Architecture

### High-level architecture

1. User creates or opens a session in the web app.
2. User clicks `Start call` or joins scheduled session from the browser.
3. Browser requests microphone permission and opens a real-time voice connection.
4. Server creates/binds a live voice runtime session for the LinguaCall session id.
5. Real-time audio flows through the web voice runtime.
6. Session completion persists transcript/report artifacts.
7. Existing report, billing, and notification surfaces continue to work.

### System boundary changes

Remove from MVP-critical architecture:

- PSTN outbound call provider dependency
- phone-number delivery
- TwiML-based call bootstrap
- telephony callback sequencing as primary state source

Add to MVP-critical architecture:

- browser microphone capture
- browser live-voice session join
- browser/session connectivity state model
- browser-oriented media failure classification

## 6. Component Plan

### 6.1 `apps/web/src/main.ts`

Responsibilities after transition:

- keep current session creation / billing / report UI
- keep `Start call` / `End call` interaction language
- add browser microphone permission request
- add in-session web voice UI state:
  - connecting
  - live
  - ending
  - failed
- support scheduled “join session” behavior instead of phone callback expectation

### 6.2 `apps/api/src/routes/calls.ts`

Responsibilities after transition:

- keep `POST /calls/initiate`
- reinterpret route as live web voice session bootstrap
- return whatever live connection metadata/token the browser needs
- keep `POST /calls/:id/end` or equivalent session-ending route semantics

Routes that become non-critical or deprecated in MVP:

- Twilio status callback routes
- TwiML routes

They may remain in the codebase temporarily, but they should no longer define the main user path.

### 6.3 `apps/api/src/mediaStream.ts`

Responsibilities after transition:

- move from Twilio event-shape parser to browser/realtime-voice ingress handler
- bind live audio to LinguaCall session id
- surface connection, media, and fault events in a provider-agnostic way where possible

### 6.4 `apps/api/src/index.ts`

Responsibilities after transition:

- mount the web-voice runtime ingress
- classify browser/media/network failures
- stop assuming Twilio media events are the main runtime contract

### 6.5 `apps/api/src/storage/inMemoryStore.ts`

Responsibilities that stay:

- session persistence
- status transitions
- transcript storage
- report generation
- billing allowance logic
- notifications

Responsibilities that change:

- state model and failure reasons shift from PSTN-centric outcomes to browser/media outcomes

## 7. State Model

### Session/call statuses to keep as primary

- `ready`
- `scheduled`
- `connecting`
- `in_progress`
- `ending`
- `completed`
- `failed`
- `cancelled`

### PSTN-specific states to remove from MVP-critical path

- `dialing`
- `ringing`
- `busy`
- `no_answer`
- `voicemail`

These may temporarily remain for backward compatibility but should not drive new UI logic.

### Failure reasons to prioritize

- `mic_permission_denied`
- `network_error`
- `media_connection_failed`
- `user_no_show`
- `platform_fault`

### Mapping principle

The system should classify failures based on browser/runtime/media behavior instead of telephony callback codes.

## 8. User Flows

### 8.1 Immediate session

1. User creates immediate session.
2. User clicks `Start call`.
3. Browser asks for microphone permission.
4. Session enters `connecting`.
5. Live voice session begins.
6. Session enters `in_progress`.
7. User ends session or runtime ends it.
8. Transcript and report are generated.

### 8.2 Scheduled session

1. User creates scheduled session.
2. Reminder is sent before scheduled time.
3. At scheduled time, user opens the web session link.
4. Browser asks for microphone permission.
5. Session joins live voice flow.
6. Session completes and generates transcript/report.

### Scheduled-session design note

Scheduled sessions no longer mean “the system calls the user by phone”.

They mean:

- the system reserves a live practice slot
- reminds the user
- the user joins a live web voice session at the scheduled time

This preserves scheduling value without telephony dependency.

## 9. Data Flow

### Start flow

1. Frontend requests session start.
2. Backend validates plan/allowance/session state.
3. Backend creates or binds a live runtime session.
4. Backend returns connection metadata/token.
5. Browser establishes real-time connection.
6. Backend updates session state to `connecting` then `in_progress`.

### End flow

1. User ends session or runtime ends session.
2. Backend persists terminal session state.
3. Transcript artifacts are finalized.
4. Report generation starts.
5. Notification/report-ready flows continue as they already do.

## 10. Error Handling

### Browser-side failures

- microphone permission denied
- browser audio device unavailable
- user closed tab
- browser network drop

### Server/runtime failures

- runtime session creation failure
- media ingestion failure
- transcript pipeline failure
- report generation failure

### Design rule

The UI should explain failures in browser/media terms, not telephony terms.

Good examples:

- microphone permission denied
- network connection failed
- live audio connection could not be established

Bad examples for the new MVP:

- callee busy
- no answer
- voicemail

## 11. Testing Strategy

### Manual smoke coverage for the new path

1. Immediate web voice happy path
2. Scheduled web voice happy path
3. Microphone permission denied
4. Browser disconnect during live session
5. Runtime/media failure path
6. Transcript/report generation after successful live session

### Regression areas to protect

- session creation
- billing plan gating
- allowance depletion behavior
- report rendering
- notification delivery

## 12. Migration Strategy

### Phase 1

- keep existing call/session UI labels
- introduce web-voice bootstrap behavior behind current start call path
- stop relying on PSTN callbacks for normal operation

### Phase 2

- remove or isolate Twilio-specific routes from the primary runtime path
- rewrite runbooks and env docs around web voice
- clean status/failure taxonomy fully

## 13. Risks

### Risk 1: product wording still sounds like phone telephony

Mitigation:

- describe experience as “phone-like live conversation”

### Risk 2: scheduled session expectations may be misunderstood

Mitigation:

- clearly message that the user joins from the web at the scheduled time

### Risk 3: browser audio UX can feel less familiar than phone

Mitigation:

- keep one-click join flow
- minimize setup friction
- keep call-like controls and language

## 14. Acceptance Criteria

The transition is considered successful when:

- the MVP no longer depends on owning a PSTN provider number
- users can start a live spoken session from the web
- users can schedule and later join a live spoken session from the web
- transcript/report generation still works
- billing/allowance/report/notification flows remain intact
- PSTN-specific status language is no longer required for core user flows

## 15. Recommendation Summary

Use a web-based real-time voice session as the new LinguaCall MVP core.

Preserve:

- live communication
- scheduled practice
- transcript/report
- billing and allowance control

Remove from MVP-critical path:

- phone-number telephony
- country/provider phone-number constraints
- Twilio-first runtime assumptions
