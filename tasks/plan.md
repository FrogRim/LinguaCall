# Implementation Plan: Launch Readiness & Security Hardening

## Status update (2026-04-13)
- Tasks 1-10 기준의 저장소 내 엔지니어링 작업은 완료되었습니다.
- 현재 남은 최종 외부 게이트는 **production 값/인증서 확정**, **실 App-in-Toss 컨테이너 smoke test**, **rollback 담당/트리거 확인**입니다.
- 최종 rehearsal 및 rollback 기준 문서는 `README.md`, `backend/README.md`, `frontend/APPINTOSS_INTEGRATION.md`를 사용합니다.

## Overview
현재 브랜치는 기능적으로는 준비가 많이 됐지만, 배포 기준으로는 아직 no-go 상태입니다. 이번 작업은 **가장 작은 blocker 제거부터 시작해**, 최종적으로는 **사전 배포 체크리스트를 통과하고 보안 리스크를 줄인 launch candidate** 상태까지 단계적으로 끌어올리는 것입니다.

## Final decisions already made
- 인증은 `x-toss-user-key` 직접 bearer 모델을 유지하지 않고, **`/users/login` 이후 서버 발급 세션/서명 토큰** 기반으로 전환합니다.
- 프런트엔드는 출시 범위에 **실제 Toss TDS 교체**를 포함합니다.

## Architecture decisions
- **Phase-first hardening**: 가장 작은 blocker부터 제거하고, 범위가 큰 auth/session/migration/TDS는 뒤 단계로 분리합니다.
- **No speculative refactor**: logger, headers, scripts, docs는 기존 구조에 얹는 방식으로 처리합니다.
- **Structured logging over console**: 백엔드 런타임 로그는 Fastify/pino 계열로 통일합니다.
- **Truthful deployment story**: README, package scripts, Prisma lifecycle은 실제 배포 방식과 일치해야 합니다.

## Dependency graph
```text
Frontend lint cleanup
  └─ clean build/test/lint baseline
        ↓
Backend scripts + truthful docs
  └─ reproducible dev/build/start/typecheck/migrate workflow
        ↓
Structured backend logging
  └─ consistent observability across API / scheduler / worker / pusher
        ↓
Security headers + secret hygiene
  └─ minimum launch-review hardening
        ↓
Session-token auth
        ↓
Prisma migrations baseline
        ↓
App-in-Toss/TDS review closure + audit triage
        ↓
Full pre-launch rehearsal + rollback runbook
```

## Existing code to reuse
- `frontend/src/bootstrapAuth.ts` — single-flight bootstrap, 실패 시 promise reset, localhost fallback
- `frontend/src/AuthBootstrapGate.test.tsx` — loading/success/retry UI 테스트 패턴
- `frontend/src/pages/Builder.test.tsx` — React Query + Testing Library flow 테스트 패턴
- `backend/src/server.ts` — Fastify logger, CORS allowlist, global rate limit, error handler
- `backend/src/api/harness.ts` — route-level rate limit, logger 사용 패턴
- `backend/src/db/client.ts` — Prisma lazy proxy 패턴
- `backend/prisma/schema.prisma` — migration baseline 기준 schema
- `frontend/APPINTOSS_INTEGRATION.md` — 앱인토스 검수/TDS checklist

## Critical files
- `frontend/src/AuthBootstrapGate.tsx`
- `frontend/src/AuthBootstrapGate.test.tsx`
- `frontend/src/pages/Builder.test.tsx`
- `frontend/package.json`
- `backend/package.json`
- `backend/README.md`
- `README.md`
- `backend/src/server.ts`
- `backend/src/scheduler/batchRunner.ts`
- `backend/src/worker/kisClient.ts`
- `backend/src/pusher/pushClient.ts`
- `backend/src/api/auth.ts`
- `backend/src/api/user.ts`
- `backend/prisma/migrations/**`

## Task list

### Phase 1 — Minimum deploy baseline

#### Task 1: frontend lint blocker 제거 및 auth bootstrap 상태 전환 정리
**Acceptance criteria**
- `frontend/src/AuthBootstrapGate.tsx`의 `react-hooks/set-state-in-effect` 경고 제거
- `frontend/src/pages/Builder.test.tsx`의 `no-useless-escape` 경고 제거
- auth bootstrap loading/success/retry UX 유지

**Verification**
- `cd frontend && npm run lint`
- `cd frontend && npm run test`

#### Task 2: backend scripts와 운영 문서 정합성 맞추기
**Acceptance criteria**
- backend에 `start`, `typecheck`, migration 관련 실행 경로 명시
- `backend/README.md`와 실제 scripts 모순 제거
- root `README.md`를 placeholder에서 repo-level 실행 문서로 교체
- `db push` vs migration 전략 문서 충돌 제거

**Verification**
- `cd backend && npm run build`
- `cd backend && npm run test`
- `cd backend && npm run typecheck`

### Checkpoint — Baseline ready
- frontend lint/test/build 정리
- backend build/test/typecheck/start 경로 정리
- 실행 문서가 현실과 일치

### Phase 2 — Minimum launch hardening

#### Task 3: backend runtime logging을 structured logger로 통일
**Acceptance criteria**
- `batchRunner.ts`, `kisClient.ts`, `pushClient.ts`의 production `console.*` 제거
- harness/ticker/attempt/error context 포함
- 기존 retry/startup/error control flow 유지

**Verification**
- `console\.(log|error|warn|info)` 검색으로 runtime 모듈 0건 확인
- `cd backend && npm run test`
- `cd backend && npm run build`

#### Task 4: backend 보안 헤더 추가 및 CORS 회귀 방지
**Acceptance criteria**
- 보안 헤더 middleware 추가
- production에서 HSTS 등 환경 의존 헤더 올바르게 적용
- localhost/앱인토스 origin CORS 유지

**Verification**
- `cd backend && npm test`
- `/health` 및 API 응답 헤더 점검

#### Task 5: secret hygiene와 launch checklist 정리
**Acceptance criteria**
- 실제 secret을 repo에 저장하지 않는 규칙 명시
- `.env.example` 또는 setup 문서 보강
- launch checklist에 secret rotation/validation 항목 추가

**Verification**
- ignore 규칙과 setup 문서 교차 확인
- 문서상 실제 key 값 예시 제거/마스킹

### Checkpoint — Minimum hardening ready
- runtime raw console logging 제거
- baseline security headers 적용
- secret handling 규칙 문서화

### Phase 3 — Auth and deploy correctness

#### Task 6: 서버 발급 세션 토큰 기반 인증으로 전환
**Acceptance criteria**
- `/users/login` 응답에 세션/서명 토큰 포함
- 프런트는 bootstrap 이후 보호 API 호출에 해당 토큰 사용
- `backend/src/api/auth.ts`는 raw `x-toss-user-key` 직접 신뢰 금지
- unauthorized / malformed / forged token 요청은 일관된 401
- bootstrap 이후 harness CRUD / alerts / parse 흐름 유지

**Verification**
- auth 관련 테스트 추가/갱신
- bootstrap → protected API E2E smoke
- forged/malformed token 거부 확인

#### Task 7: Prisma migration baseline 확립
**Acceptance criteria**
- `backend/prisma/migrations/**` 생성
- fresh DB에서 migration만으로 기동 가능
- README/scripts가 migration 중심으로 정렬

**Verification**
- 빈 DB에 migration 적용
- backend 테스트 재실행
- schema와 migration diff 없음 확인

### Checkpoint — Security & deploy correctness ready
- auth 경계가 테스트로 보호됨
- migration-backed deploy story 확보
- docs/scripts/schema lifecycle 모순 제거

### Phase 4 — Final launch closure

#### Task 8: 앱인토스 검수 항목 닫기 및 실제 Toss TDS 교체
**Acceptance criteria**
- `src/components/tds/` 스텁 사용처를 실제 Toss TDS import로 교체
- 필수 메타/네비게이션/CTA/모드 정책 충족
- 접근성 최소 항목 검증
- 성능 최소 기준 확인
- 앱인토스 제출 관점 checklist pass/fail 정리

**Verification**
- `cd frontend && npm run build`
- TDS 적용 화면 수동 확인
- DevTools 또는 수동 a11y/perf 점검

#### Task 9: npm audit remediation 및 residual risk 정리
**Acceptance criteria**
- 해결 가능한 high/critical production 취약점 제거
- 남는 항목은 dev-only/reachable 여부와 함께 기록
- launch 판단 기준 명확화

**Verification**
- `npm audit --omit=dev` (frontend/backend)
- 수정 후 build/test 회귀

#### Task 10: full pre-launch rehearsal 및 rollback runbook 고정
**Acceptance criteria**
- build/test/typecheck/migration/auth/core flow 점검 완료
- known blocker가 모두 해결되었거나 명시적으로 수용됨
- rollback 절차가 실행 가능한 수준으로 정리됨

**Verification**
- pre-launch runbook 실행
- rollback plan 문서화
- 최종 ship report 작성

## Risks and mitigations
- auth hardening이 세션 재설계로 번져 scope가 커질 수 있음 → phase 분리 + 테스트 우선
- security headers 기본값이 앱인토스/내장 환경과 충돌할 수 있음 → 보수적 API 중심 정책부터 적용
- migration baseline 생성 시 로컬 DB drift 노출 가능 → fresh DB 기준 검증
- TDS 교체가 UI 작업량을 키울 수 있음 → launch checklist 단위로 분리 검증

## End-to-end verification
1. `cd frontend && npm run lint && npm run test && npm run build`
2. `cd backend && npm run build && npm run test && npm run typecheck`
3. `/health` 헤더, structured 로그, CORS 회귀 확인
4. `/users/login` → 세션 토큰 bootstrap → protected API 호출 확인
5. fresh DB migration 적용 후 backend 기동 확인
6. 실제 Toss TDS 화면, a11y/perf, audit, rollback까지 최종 점검
