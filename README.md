# AI 투자 하니스

앱인토스 미니앱에서 초보 투자자가 자연어 또는 가이드형 입력으로 가격/조건 알림 하니스를 만들 수 있게 하는 프로젝트입니다.
현재 저장소는 프런트엔드(Vite/React)와 백엔드(Fastify/Prisma)로 나뉘어 있습니다.

## 저장소 구성

- `frontend/` — Vite + React + Vitest 기반 미니앱 UI
- `backend/` — Fastify + TypeScript + Prisma API 서버
- `tasks/` — 현재 진행 중인 launch-readiness 계획과 체크리스트

## 로컬 실행

### 1) 백엔드

```bash
cd backend
npm install
cp .env.example .env
npm run migrate:deploy
npm run dev
```

- 기본 포트: `http://localhost:3000`
- 헬스체크: `http://localhost:3000/health`
- 새 로컬 DB 초기화는 `migrate:deploy`, 이후 스키마 변경 작업은 `migrate:dev -- --name <change-name>` 를 사용합니다.

### 2) 프런트엔드

```bash
cd frontend
npm install
npm run dev
```

- 기본 개발 주소: `http://localhost:5173`
- 백엔드 API는 기본적으로 `http://localhost:3000`을 사용합니다.

## 품질 검증

### 프런트엔드

```bash
cd frontend
npm run lint
npm run test
npm run build
```

### 백엔드

```bash
cd backend
npm run build
npm test
npm run typecheck
```

## Secret hygiene

- 실제 비밀값은 저장소에 넣지 말고 `backend/.env.example`를 복사한 로컬 `.env` 또는 배포 환경 변수에만 넣습니다.
- `backend/.gitignore`는 `.env`, `.env.*`, 인증서/키 파일(`*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`)을 무시하도록 유지합니다.
- `MTLS_CERT`, `MTLS_KEY`는 인증서 내용 자체가 아니라 **로컬/서버 파일 경로**를 가리켜야 합니다.
- `SESSION_TOKEN_SECRET`는 서버에서만 보관하는 서명 키이며, 클라이언트 번들/브라우저 저장소/문서 스크린샷에 노출되면 안 됩니다.
- `LLM_API_KEY`, `KIS_APPROVAL_KEY`, mTLS 인증서/키, `SESSION_TOKEN_SECRET`가 노출되었거나 사람 간에 임시 공유되었다면 출시 전에 새 값으로 교체합니다.

## Launch secret checklist

출시 직전에는 아래 항목을 다시 확인합니다.

- [ ] production 환경에 `DATABASE_URL`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `APPS_IN_TOSS_API_BASE_URL`, `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `SESSION_TOKEN_SECRET`이 올바르게 설정되어 있다.
- [ ] 실시간 감시를 켤 경우 `KIS_WS_URL`, `KIS_APPROVAL_KEY`가 함께 설정되어 있다.
- [ ] 현재 production 런타임에 필요한 `MTLS_CERT`, `MTLS_KEY`가 서버 로컬 경로를 가리키며, 인증서/키 원본 파일은 저장소 밖에 보관되어 있다.
- [ ] `.env`, `.env.*`, 인증서/키 파일이 git 추적 대상이 아닌지 확인했다.
- [ ] launch 직전 `LLM_API_KEY`, `KIS_APPROVAL_KEY`, mTLS 인증서/키의 최신 유효값과 교체 이력을 확인했다.

## Production dependency audit status (2026-04-13)

- 프런트엔드 `npm audit --omit=dev`는 `@apps-in-toss/web-framework`를 `2.4.6`까지 올린 뒤에도 **20건(High 14 / Low 6)** 을 보고합니다.
- 남은 High는 모두 `@apps-in-toss/web-framework`가 끌고 오는 App-in-Toss / Granite CLI·native 체인(`@apps-in-toss/cli`, `@granite-js/mpack`, `fastify@4.x`, `react-native` 호환 패키지)에서 발생합니다.
- 현재 앱 소스는 `@apps-in-toss/web-framework`의 웹 API만 사용하며, 빌드 산출물 `frontend/dist/**/*.js`에는 `fastify`, `find-my-way`, `react-native`, `@granite-js` 문자열이 남지 않아 브라우저 런타임 번들에는 포함되지 않음을 확인했습니다.
- 따라서 프런트 audit High는 **현재 출시 후보의 브라우저 런타임 경로가 아니라 SDK 패키징/도구 체인에 묶인 upstream residual risk** 로 분류합니다. App-in-Toss SDK 신규 릴리스가 나오면 재점검이 필요합니다.
- 백엔드 `npm audit --omit=dev`는 **3건의 Moderate** 를 보고하며, 모두 `@prisma/client -> prisma -> @prisma/dev -> @hono/node-server` 체인에 있습니다.
- 백엔드 앱 코드는 Hono를 직접 사용하지 않고, 현재 최신 Prisma(`7.7.0`)도 같은 체인을 포함하므로 이는 **Prisma tooling 쪽 upstream residual risk** 로 기록합니다.
- 정리하면 현재 Task 9 기준 unresolved 항목은 모두 문서화된 upstream/tooling residual risk이며, 직접 앱 코드/브라우저 번들 경로의 Critical/High blocker는 확인되지 않았습니다.

## Final pre-launch rehearsal & rollback

### Engineering verification completed in this repo
- Frontend: `npm run lint`, `npm run test`, `npm run build`
- Backend: `npm run migrate:status`, `npm run migrate:deploy`, `npm run build`, `npm test`, `npm run typecheck`
- Result: current local release candidate passes the repo-controlled checks above.

### Manual launch gate still required
- [ ] 실 App-in-Toss 컨테이너에서 auth bootstrap 성공 확인
- [ ] Builder에서 하니스 생성 1회 이상 확인
- [ ] Dashboard에서 하니스 조회 후 토글 또는 삭제 1회 확인
- [ ] History 화면 진입 확인
- [ ] production 값 확정: `DATABASE_URL`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `SESSION_TOKEN_SECRET`, `VITE_API_URL`
- [ ] 실시간 감시를 켤 경우 `KIS_WS_URL`, `KIS_APPROVAL_KEY` 확정
- [ ] `MTLS_CERT`, `MTLS_KEY` 경로와 인증서 유효기간 확인
- [ ] App-in-Toss SDK / Prisma residual-risk 문구 검토 및 수용 여부 확정
- [ ] rollback 실행 담당자와 트리거(`/health` 실패, `POST /users/login` 실패, `/harnesses` 이상) 확정
- [ ] launch 중 확인할 monitoring/alert 채널 존재 여부 확정

### Rollback triggers
- **Frontend artifact issue**: 배포 직후 앱 진입, bootstrap, 주요 화면 렌더가 깨지면 직전 정상 프런트 산출물로 즉시 복귀 후 재확인합니다.
- **Backend deploy issue**: `/health` 실패 또는 보호 API(`POST /users/login`, `/harnesses`) 이상 시 직전 정상 백엔드 산출물/설정으로 복귀 후 헬스체크와 보호 API를 재확인합니다.
- **Migration/app mismatch**: 새 migration 추가 적용을 중단하고, 현재 적용된 schema와 호환되는 직전 앱 버전으로 되돌립니다. 검증되지 않은 DB 다운그레이드는 즉시 수행하지 않습니다.

## 데이터베이스 / 배포 상태

현재 저장소에는 `backend/prisma/migrations/` 기준의 초기 Prisma migration baseline이 커밋되어 있습니다.
새 환경을 올릴 때는 `backend`에서 `npm run migrate:deploy` 로 스키마를 초기화하고, 이후 스키마 변경은 `npm run migrate:dev -- --name <change-name>` 로 추가합니다.

`db:push`는 일회성 로컬 개발 보조 명령으로만 남겨 두며, 배포/재현 가능한 DB 절차로 간주하지 않습니다.

## 앱인토스 연동 참고

앱인토스 SDK/TDS 교체와 검수 체크리스트는 아래 문서를 기준으로 진행합니다.

- `frontend/APPINTOSS_INTEGRATION.md`

## 현재 알려진 하드닝 진행 항목

`tasks/plan.md`, `tasks/todo.md`에 launch-readiness와 security hardening 계획이 정리되어 있습니다.
