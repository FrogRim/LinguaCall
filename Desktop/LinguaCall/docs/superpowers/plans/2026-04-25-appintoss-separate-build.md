# Implementation Plan: Apps in Toss 분리 빌드

## Overview

앱인토스 전용 빌드를 별도로 만든다. 로그인은 Supabase Auth 없이 AppInToss OAuth → 자체 JWT로 처리하고, 결제는 기존 AppInToss tosspay 흐름을 그대로 쓴다. 웹 브라우저 빌드는 현재 코드에서 `appsInTossAvailable` 분기를 제거해 단순화한다.

## Architecture Decisions

- **자체 JWT**: Clerk sign-in token 미지원, Supabase session 발급 불가 → API에서 `jsonwebtoken`으로 HMAC-SHA256 서명 JWT 직접 발급. payload는 기존 `AuthenticatedRequest`의 `userId` + `clerkUserId` 그대로.
- **`clerkUserId` 필드 유지**: DB와 미들웨어 전반이 이 필드를 쓴다. AppInToss 유저는 `apps_in_toss:{userKey}` 형태로 저장해 네임스페이스 충돌 방지.
- **Vite 멀티 엔트리**: 하나의 `apps/web` 패키지에서 `index.html`(웹)과 `appintoss.html`(앱인토스) 두 빌드 산출물을 만든다.
- **sessionStorage에 JWT 저장**: 앱인토스 웹뷰는 매번 새로 열리므로 mount 시 silent login → sessionStorage 저장 → 앱 전체에 전파.

## Dependency Graph

```
[Task 1] DB migration (apps_in_toss_user_key)
    │
    └── [Task 2] API: AppInToss JWT 모듈 (sign/verify)
            │
            ├── [Task 3] API: POST /auth/apps-in-toss/login
            │
            └── [Task 4] API: auth 미들웨어 확장
                        │
                        └── [Task 5] Frontend: AppInTossAuthProvider
                                    │
                                    ├── [Task 6] Frontend: AppInTossApp.tsx 라우팅
                                    │
                                    └── [Task 7] Frontend: main-appintoss.tsx + Vite 설정
                                                │
                                                └── [Task 8] 웹 빌드 cleanup
```

---

## Phase 1: Backend Foundation

### Task 1: DB 마이그레이션 — apps_in_toss_user_key 컬럼 추가

**Description:** `users` 테이블에 AppInToss userKey를 저장할 컬럼을 추가한다. 기존 유저에게는 NULL 허용.

**Acceptance criteria:**
- [ ] `users.apps_in_toss_user_key TEXT UNIQUE` 컬럼 존재
- [ ] NULL 허용 (기존 웹 유저는 값 없음)
- [ ] UNIQUE 인덱스로 userKey → userId 조회 가능

**Files:**
- `packages/db/migrations/20260425_apps_in_toss_user_key.sql` (신규)

**Verification:**
- [ ] 마이그레이션 파일 문법 검토
- [ ] 기존 마이그레이션과 충돌 없음

**Dependencies:** None  
**Scope:** XS

---

### Task 2: API — AppInToss JWT 모듈

**Description:** `jsonwebtoken` 패키지를 추가하고, AppInToss 전용 JWT sign/verify 유틸을 작성한다. 환경변수 `APPS_IN_TOSS_JWT_SECRET`으로 서명.

**Acceptance criteria:**
- [ ] `signAppsInTossJwt({ userId, clerkUserId })` → JWT 문자열 반환 (TTL 24h)
- [ ] `verifyAppsInTossJwt(token)` → `{ userId, clerkUserId }` 또는 `null`
- [ ] `APPS_IN_TOSS_JWT_SECRET` 없으면 sign 시 throw

**Files:**
- `apps/api/package.json` — `jsonwebtoken`, `@types/jsonwebtoken` 추가
- `apps/api/src/modules/auth/appsInTossJwt.ts` (신규)

**Verification:**
- [ ] `npx tsc --noEmit` 통과

**Dependencies:** None  
**Scope:** S

---

### Task 3: API — POST /auth/apps-in-toss/login 엔드포인트

**Description:** authorizationCode + referrer를 받아 AppInToss OAuth로 userKey를 얻고, 기존 유저면 조회, 신규면 생성 후 JWT를 발급한다.

**Acceptance criteria:**
- [ ] `POST /auth/apps-in-toss/login` — 인증 불필요 (public)
- [ ] `{ authorizationCode, referrer }` 입력 검증
- [ ] userKey로 `users.apps_in_toss_user_key` 조회 → 있으면 해당 유저 JWT 발급
- [ ] 없으면 `clerk_user_id = "apps_in_toss:{userKey}"` 로 신규 유저 생성 후 JWT 발급
- [ ] 응답: `{ ok: true, data: { token: string } }`
- [ ] AppInToss OAuth 실패 시 401

**Files:**
- `apps/api/src/routes/auth.ts` (신규 또는 기존에 추가)
- `apps/api/src/storage/inMemoryStore.ts` — `upsertAppsInTossUser` 메서드 추가
- `apps/api/src/app.ts` 또는 라우터 등록 위치 — `/auth` 라우트 연결

**Verification:**
- [ ] `npx tsc --noEmit` 통과
- [ ] curl 테스트 (mock authCode로 401 확인)

**Dependencies:** Task 1, Task 2  
**Scope:** M

---

### Task 4: API — auth 미들웨어 AppInToss JWT 경로 추가

**Description:** `requireAuthenticatedUser`에서 Supabase JWT 검증 실패 시 AppInToss JWT 검증을 시도한다. 성공하면 동일하게 `req.userId`, `req.clerkUserId`를 세팅한다.

**Acceptance criteria:**
- [ ] Supabase JWT → 기존 동작 유지
- [ ] AppInToss JWT → `verifyAppsInTossJwt`로 검증 후 `req.userId`, `req.clerkUserId` 세팅
- [ ] 둘 다 실패 시 401
- [ ] 기존 Supabase auth 테스트 깨지지 않음

**Files:**
- `apps/api/src/middleware/auth.ts`

**Verification:**
- [ ] `npx tsc --noEmit` 통과
- [ ] 기존 auth 테스트 통과

**Dependencies:** Task 2  
**Scope:** S

---

### Checkpoint 1: Backend 완료
- [ ] `npx tsc --noEmit` (API) 통과
- [ ] `/auth/apps-in-toss/login` curl 테스트 — 잘못된 authCode → 401 반환
- [ ] 미들웨어가 AppInToss JWT를 Bearer로 받아 통과하는지 수동 확인

---

## Phase 2: Frontend AppInToss 빌드

### Task 5: Frontend — AppInTossAuthProvider

**Description:** 앱 마운트 시 `requestAppsInTossLogin()`으로 silent login을 시도하고, 발급받은 JWT를 sessionStorage에 저장한다. `useAppsInTossAuth()` hook으로 token을 전파한다.

**Acceptance criteria:**
- [ ] 마운트 시 자동으로 `/auth/apps-in-toss/login` 호출
- [ ] 성공: JWT를 sessionStorage 저장, `{ token, ready: true }` 제공
- [ ] 실패: `{ token: null, ready: true, error }` 제공 (에러 화면 표시)
- [ ] `apiClient`가 이 token을 Bearer로 사용

**Files:**
- `apps/web/src/lib/appsInTossAuth.ts` (신규) — context + provider + hook

**Verification:**
- [ ] `npx tsc --noEmit` (web) 통과

**Dependencies:** Task 3  
**Scope:** S

---

### Task 6: Frontend — AppInTossApp.tsx 라우팅

**Description:** 앱인토스 전용 라우팅. 로그인 화면 없이 `/session`이 기본 진입점. `AppInTossAuthProvider`로 감싸며, 로그인 실패 시 에러 화면 표시.

**Acceptance criteria:**
- [ ] `/` → `/session` 자동 redirect
- [ ] `/session`, `/billing`, `/report/:reportId` 라우트 존재
- [ ] `/privacy`, `/terms` 라우트 존재
- [ ] `ScreenLogin`, Supabase auth 관련 import 없음
- [ ] auth 실패 시 "앱인토스 로그인에 실패했습니다" 에러 화면

**Files:**
- `apps/web/src/AppInToss.tsx` (신규)

**Verification:**
- [ ] `npx tsc --noEmit` (web) 통과

**Dependencies:** Task 5  
**Scope:** S

---

### Task 7: Frontend — main-appintoss.tsx + Vite 멀티 엔트리

**Description:** 앱인토스 전용 진입점과 HTML을 만들고, Vite가 두 빌드를 모두 산출하도록 설정한다.

**Acceptance criteria:**
- [ ] `apps/web/appintoss.html` — `main-appintoss.tsx`를 진입점으로 참조
- [ ] `apps/web/src/main-appintoss.tsx` — `AppInToss.tsx`를 마운트
- [ ] `vite.config.ts` — `build.rollupOptions.input`에 두 HTML 모두 등록
- [ ] `pnpm build` 성공 시 `dist/index.html`, `dist/appintoss.html` 모두 생성

**Files:**
- `apps/web/appintoss.html` (신규)
- `apps/web/src/main-appintoss.tsx` (신규)
- `apps/web/vite.config.ts`

**Verification:**
- [ ] `pnpm --filter @lingua/web build` 성공
- [ ] `dist/appintoss.html` 존재

**Dependencies:** Task 6  
**Scope:** S

---

### Checkpoint 2: 앱인토스 빌드 완료
- [ ] `pnpm build` 통과
- [ ] `dist/appintoss.html` 생성됨
- [ ] 앱인토스 환경 시뮬레이션(`__LINGUACALL_HOST__ = "apps-in-toss"`)에서 silent login flow 동작 확인

---

## Phase 3: 웹 빌드 Cleanup

### Task 8: ScreenBilling.tsx — appsInTossAvailable 분기 제거

**Description:** 웹 빌드에서 `appsInTossAvailable` 관련 코드를 정리한다. 웹 빌드는 Toss Payments 웹 결제(현재 비활성)만 담당하므로 AppInToss 분기가 불필요하다.

**Acceptance criteria:**
- [ ] `canLaunchAppsInTossPayment` import 제거
- [ ] `appsInTossAvailable` 변수 제거
- [ ] `hostNotice` — AppInToss ready 안내 문구 제거
- [ ] `handlePlanLaunch` — AppInToss 분기 제거, 웹 결제 비활성 메시지만 유지
- [ ] `startAppsInTossBillingLaunch` import 제거
- [ ] `npx tsc --noEmit` 통과

**Files:**
- `apps/web/src/pages/ScreenBilling.tsx`

**Verification:**
- [ ] `npx tsc --noEmit` (web) 통과
- [ ] 웹 빌드에서 빌링 페이지 정상 렌더링

**Dependencies:** Task 7  
**Scope:** S

---

### Checkpoint 3: 전체 완료
- [ ] `pnpm build` 통과 (web)
- [ ] `npx tsc --noEmit` 통과 (api, web)
- [ ] `dist/index.html` — 웹 브라우저용, ScreenLogin 포함
- [ ] `dist/appintoss.html` — 앱인토스용, 로그인 화면 없음
- [ ] handoff.md 업데이트 (배포 시 appintoss.html Caddy 라우팅 추가 필요 기록)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AppInToss OAuth가 테스트 환경에서 실제 호출 불가 | High | `__LINGUACALL_HOST__` override로 플랫폼 시뮬레이션, JWT 발급 로직은 unit 검증 |
| `jsonwebtoken` 패키지 추가 시 번들 크기 증가 | Low | API 전용 의존성, 프론트엔드 번들에 포함 안 됨 |
| 앱인토스 유저와 웹 유저 계정 중복 | Med | 현재는 허용. 나중에 phone_e164_hash 기준 연동 가능 |
| Caddy에서 `/appintoss.html` 라우팅 미설정 | High | 배포 체크리스트에 명시 |

## Open Questions

- `APPS_IN_TOSS_JWT_SECRET` VPS infra.env에 추가 필요 — 값 생성: `openssl rand -hex 32`
- 앱인토스 심사 제출 시 `appintoss.html`을 별도 도메인으로 서빙할지, 동일 도메인 경로로 할지
- 앱인토스 유저의 JWT TTL을 24h로 할지 (웹뷰 세션 길이 고려)
