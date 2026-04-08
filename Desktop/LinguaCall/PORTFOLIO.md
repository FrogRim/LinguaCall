# LinguaCall — 포트폴리오 문서

> 이 문서는 LinguaCall의 구현 과정, 아키텍처 설계 의도, 핵심 기술 결정을 정리한 포트폴리오용 참고 자료입니다.

---

## 1. 프로젝트 개요

**LinguaCall**은 언어 시험 준비를 위한 AI 실시간 회화 연습 서비스입니다.

- 사용자가 원하는 언어(영어·독어·중어·스페인어·일어·프랑스어)와 수준을 선택해 세션을 생성
- 브라우저에서 직접 OpenAI Realtime API에 WebRTC로 연결해 AI 튜터와 실시간 음성 대화
- 세션 종료 후 GPT-4o 기반 문법 교정 리포트 자동 생성
- 리포트에서 단어 클릭 시 사전 팝오버, 대화 중 번역 버튼 제공

**타겟**: 한국 시장 어학 시험 준비자 (OPIc, TOEIC Speaking 등)

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 18, React Router 6, Vite 6, Tailwind CSS, i18next |
| 백엔드 | Express 4, Node.js 20, TypeScript 5 (strict mode) |
| 데이터베이스 | Supabase-managed PostgreSQL (`pg` 드라이버 직접 사용) |
| AI / 음성 | OpenAI Realtime API (WebRTC), gpt-4o-mini, gpt-4.1-mini |
| 인증 | Supabase Auth 전화번호 OTP + bearer session |
| 결제 | Toss Payments |
| 비동기 작업 | 독립 worker 프로세스 |
| 배포 | VPS + Docker Compose + Caddy (HTTPS) |
| 테스트 | Vitest, Supertest |

---

## 3. 시스템 아키텍처

```
Browser (React + WebRTC)
    │
    ├──(HTTPS)──▶ Caddy (reverse proxy + TLS 자동 발급)
    │                 │
    │                 ├──▶ web  (nginx serving Vite build, :8080)
    │                 └──▶ api  (Express, :3000)
    │                           │
    │                           └──▶ Supabase Postgres
    │                           └──▶ worker (POST /workers/run)
    │
    ├──(WebRTC SDP)──▶ OpenAI Realtime API (직접 연결)
    └──(checkout)───▶ Toss Payments
```

### 왜 이 구조인가

**브라우저 → OpenAI 직접 연결 (서버 프록시 없음)**

음성 스트림을 서버를 경유하면 레이턴시가 최소 100~200ms 추가됩니다. 회화 연습에서 레이턴시는 자연스러운 대화 리듬을 직접 깨뜨리기 때문에, OpenAI Realtime API의 ephemeral client secret 방식을 사용해 브라우저가 OpenAI에 직접 WebRTC 연결하도록 설계했습니다. API 서버는 bootstrap 데이터(ephemeral key, 세션 설정)만 발급하고 오디오 스트림에는 관여하지 않습니다.

**worker 프로세스 분리**

리포트 생성은 GPT-4o 추론을 포함하므로 응답 시간이 5~15초 걸립니다. 이를 API 요청 사이클 안에 넣으면 타임아웃 위험과 API 프로세스 부하가 동시에 발생합니다. 별도 worker 프로세스가 주기적으로 `pending_report` 상태 세션을 폴링해 처리하는 구조로 분리했습니다. API와 worker는 Postgres 상태를 통해 통신하며, REST 트리거(`POST /workers/run`)로 즉시 실행도 가능합니다.

**VPS 단일 서버 자체 호스팅**

초기 MVP 단계에서 Railway/Vercel 같은 PaaS는 cold start, 요금 예측 불확실성, 한국 시장 레이턴시 문제가 있습니다. 싱가포르 리전 VPS에 Docker Compose로 배포하면 전체 스택을 하나의 `docker compose up`으로 관리할 수 있고, Caddy가 TLS 인증서를 자동 발급합니다.

---

## 4. 핵심 구현 상세

### 4.1 PTT(Push-to-Talk) 음성 모드

**문제**: OpenAI Realtime API의 기본 VAD(Voice Activity Detection)는 배경 소음이나 짧은 침묵에도 반응해 불필요한 AI 응답을 유발합니다.

**구현**: WebRTC `MediaStreamTrack.enabled` 속성을 이용해 마이크 트랙을 물리적으로 끄고 켜는 방식을 선택했습니다. 버튼을 누를 때만 `track.enabled = true`로 전환하고, 떼면 `false`로 되돌립니다. 이와 함께 OpenAI Realtime session에 `input_audio_buffer.commit` + `response.create` 이벤트를 전송해 즉각적인 응답을 트리거합니다.

```ts
// webVoiceClient.ts
startSpeaking: () => {
  stream.getTracks().forEach(t => { t.enabled = true; });
},
stopSpeaking: () => {
  stream.getTracks().forEach(t => { t.enabled = false; });
  dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  dataChannel.send(JSON.stringify({ type: "response.create" }));
}
```

**PTT 버튼 race condition 해결**

초기 구현에서 PTT 버튼이 `live` 상태에서도 보이지 않는 버그가 있었습니다. 원인은 WebRTC data channel "open" 이벤트(`onStateChange('live')`)가 `await startWebVoiceClient()` 후속 처리(`attachOrDisposeResolvedController`) 중 JavaScript event loop에서 선점 발화하는 race condition이었습니다. `state === 'live'`는 됐지만 `controller`가 아직 `null`인 상태로 React state가 저장된 것입니다.

해결: `attachOrDisposeResolvedController` 완료 후 stale snapshot이 아닌 `activeRef.current`(live ref)에서 spread해 controller를 붙이도록 수정했습니다.

```ts
// 수정 전: resolution.nextActiveSession (stale snapshot 사용)
// 수정 후: activeRef.current에 controller만 추가
if (activeRef.current && activeRef.current.sessionId === sessionId) {
  syncActive({ ...activeRef.current, controller });
}
```

---

### 4.2 조기 종료 키워드 감지

특정 단어("끝내자", "let's finish", "終わりにしよう" 등 7개 언어 키워드)가 transcript에 포함되면 세션을 자동 종료합니다. OpenAI Realtime transcript 완료 이벤트(`conversation.item.input_audio_transcription.completed`)를 수신할 때마다 정규화 후 키워드 매칭을 수행합니다. 키워드 목록은 세션 시작 시 클라이언트에 주입되어 서버 왕복 없이 브라우저에서 판단합니다.

---

### 4.3 실시간 번역 버튼

대화 중 transcript 각 줄마다 번역 버튼을 제공합니다. 번역 상태는 `TranscriptLine` 컴포넌트 단위로 독립적으로 관리(per-line `useState`)합니다.

- 번역은 `POST /translate`(gpt-4o-mini)를 호출하며, 현재 UI 언어(`i18n.language`)를 `targetLang`으로 전달합니다
- API 서버에 in-memory Map 캐시(`"targetLang:text"` 키)가 있어 동일 텍스트 반복 번역 시 OpenAI 호출을 생략합니다
- 다시 누르면 번역을 접어 원문만 표시합니다

---

### 4.4 리포트 문법 교정 하이라이팅

세션 종료 후 worker가 전체 대화 transcript를 GPT-4o에 전달해 문법 오류를 JSON 형태로 추출합니다. 리포트 페이지에서 `highlightHelpers.ts`가 원문 텍스트와 오류 목록을 비교해 오류 구간을 `<mark>` 태그로 감싸 렌더링합니다.

- 교정 필요 부분: 빨간 하이라이트
- 자연스러운 표현: 파란 하이라이트

---

### 4.5 단어 사전 팝오버

리포트에서 단어를 클릭하면 `GET /dictionary?word=&lang=`를 호출해 품사, 한국어 의미, 예문을 팝오버로 표시합니다. gpt-4o-mini가 고정 JSON 스키마(`{"pos":"...","meaning":"...","example":"..."}`)로 응답하도록 prompt를 설계했습니다. API 레이어에 in-memory 캐시를 두어 같은 단어 재조회 시 즉시 응답합니다.

---

### 4.6 인증 아키텍처

초기에는 Clerk를 사용했으나 한국 전화번호 OTP 지원과 자체 서버에서의 토큰 검증 복잡도 문제로 Supabase Auth로 전환했습니다.

```
브라우저 → Supabase Auth (전화 OTP 발급/검증)
브라우저 → API (Authorization: Bearer <supabase_access_token>)
API → Supabase Auth (토큰 검증 + userId 추출)
API → Postgres (userId 기반 데이터 조회)
```

Supabase RLS는 이중 방어선으로 설정돼 있지만, 실제 사용자 격리의 1차 경계는 API 레이어입니다. 이는 RLS만으로는 API 로직의 세부 권한 분기를 표현하기 어렵고, 디버깅이 복잡해지기 때문입니다.

---

### 4.7 결제 — Toss Payments 연동

1. 프론트: `POST /billing/checkout` → Toss checkout widget 실행
2. 결제 완료 → Toss webhook → `POST /billing/webhooks/toss`
3. API가 Toss 서버에서 결제 건 검증 후 subscription 및 credit ledger 업데이트

결제 금액 계산은 Toss 서버 응답을 신뢰하고, 내부 ledger는 멱등성 키로 중복 처리를 방지합니다.

---

## 5. 프론트엔드 설계 원칙

### 디자인 토큰 시스템

`DESIGN.md`와 `docs/design/design-tokens.md`에 정의된 CSS 변수 기반 토큰을 Tailwind 유틸리티 클래스에 매핑했습니다.

- `bg-background`, `bg-card`, `bg-secondary`: 배경 계층
- `text-foreground`, `text-muted-foreground`: 텍스트 계층
- `border-border`: 단일 테두리 컬러
- `text-primary`: 강조색 (`#2f5bea`)

직접 색상 값(`slate-200`, `#fff8ee`) 대신 시맨틱 토큰만 사용해 다크 모드 확장이나 테마 변경 시 컴포넌트를 수정하지 않아도 됩니다.

### 다국어(i18n)

`react-i18next`로 7개 언어(ko/en/de/zh/es/ja/fr)를 지원합니다. UI 언어는 언어 학습 대상 언어와 독립적으로 설정됩니다. 번역 버튼은 UI 언어를 target으로 삼아 학습 중인 언어의 발화를 모국어로 번역합니다.

### 세션 페이지 UX 설계 의도

초기 설계에는 "가장 먼저 할 행동부터" 섹션이 같은 페이지 내 스크롤 앵커 버튼 3개로 이루어져 있었습니다. 실사용에서 이 섹션이 핵심 컨텐츠(세션 목록, 세션 상세)를 아래로 밀어내고, 세션 생성 후 통화 시작까지 스크롤이 필요한 문제가 확인돼 다음과 같이 개선했습니다:

- QuickActions 섹션 제거
- HeroSection의 스크롤 CTA 버튼 제거
- **즉시실행 세션 생성 시 자동 `beginWebVoiceSession` 호출** (사용자가 아무것도 하지 않아도 통화 시작)

---

## 6. 배포 파이프라인

```bash
# 로컬
git commit && git push origin main

# VPS (반드시 main 브랜치 확인)
git checkout main && git pull
docker compose --env-file infra/.env.production \
  -f infra/docker-compose.yml build --no-cache web api
docker compose --env-file infra/.env.production \
  -f infra/docker-compose.yml up -d
```

### Dockerfile 구조 (web)

Vite 빌드 시 `VITE_*` 환경 변수가 번들에 인라인됩니다. Docker build arg → ENV로 주입해 빌드 타임에 포함시킵니다. nginx 이미지로 복사해 런타임은 정적 서빙만 담당합니다.

```dockerfile
FROM node:20-alpine AS builder
# ... install deps, inject VITE_ args, run pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
```

---

## 7. 주요 기술적 도전과 해결

| 도전 | 원인 | 해결 |
|------|------|------|
| PTT 버튼 미표시 (race condition) | WebRTC data channel "open" 이벤트가 JS event loop에서 선점 발화 | stale snapshot 대신 live ref(`activeRef.current`) 사용 |
| 리포트 생성 타임아웃 | GPT-4 추론 5~15초, API 요청 사이클 초과 | worker 프로세스 분리, Postgres 상태 폴링 |
| 음성 레이턴시 | 서버 프록시 경유 시 100~200ms 추가 | 브라우저 → OpenAI 직접 WebRTC 연결 |
| VPS 구코드 배포 | VPS가 `saas-launch-refactor` 브랜치에 있었음 | `git checkout main` 단계를 배포 runbook에 명시 |
| `dictionary.ts` 인증 오류 | `requireClerkUser` (삭제된 export) import | `requireAuthenticatedUser`로 수정 |
| ApiErrorCode 타입 오류 | `"service_unavailable"` 등 유니온에 없는 코드 사용 | 유효한 코드(`"validation_error"`)로 통일 |

---

## 8. 파일 구조 요약

```
apps/
  web/src/
    lib/
      webVoiceClient.ts      — WebRTC + PTT + transcript + early exit
      pttHelpers.ts          — PTT 세션 업데이트 헬퍼
      highlightHelpers.ts    — 리포트 문법 교정 하이라이팅
      api.ts                 — API 클라이언트 (bearer token 자동 첨부)
    pages/
      ScreenSession.tsx      — 세션 생성 · 실시간 세션 · 세션 목록
      ScreenReport.tsx       — 리포트 + 하이라이팅 + 사전 팝오버
      ScreenLogin.tsx        — 전화번호 OTP 로그인
    features/session/
      liveSession.ts         — 컨트롤러 attach/dispose 순수 함수
    i18n/locales/            — ko / en / de / zh / es / ja / fr

  api/src/
    routes/
      sessions.ts            — 세션 CRUD + DELETE
      calls.ts               — initiate / join / runtime-event / complete / end
      billing.ts             — Toss checkout + webhook
      dictionary.ts          — GET /dictionary (gpt-4o-mini)
      translate.ts           — POST /translate (gpt-4o-mini, 캐시 포함)
      reports.ts             — GET /reports/:id
    middleware/auth.ts       — Supabase bearer token 검증
    storage/inMemoryStore.ts — 세션 상태 인메모리 store

  worker/src/
    index.ts                 — 배치 루프 + report 처리

packages/
  shared/                    — 공유 타입 (Session, ApiResponse 등)
  db/                        — Postgres 마이그레이션

infra/
  docker-compose.yml
  Caddyfile
```

---

## 9. 미구현 / 향후 과제

- Phase 2: 준비/모의/실전 stage 선택 + 언어별 situation 프리셋 UI
- Database RLS를 1차 사용자 격리 경계로 격상
- 세션 수준에 따른 AI 튜터 프롬프트 동적 조정 고도화
- 리포트 생성 실패 시 재시도 UI
