# 앱인토스 SDK 통합 가이드

이 문서는 앱인토스 파트너 포털에서 SDK를 수령한 후 완료해야 할 통합 작업을 설명합니다.

## 1. SDK 패키지 설치

```bash
npm install @apps-in-toss/web-framework @toss/tds-mobile
npx ait init
```

## 2. TDS 적용 방식

현재는 실제 `@toss/tds-mobile`를 직접 사용하되, 기존 화면 API 차이를 최소화하기 위해 `src/components/tdsCompat.tsx`에서 얇은 호환 래퍼를 두고 있습니다.

각 화면은 더 이상 로컬 스텁(`src/components/tds/`)을 직접 import 하지 않고 아래 래퍼를 사용합니다.

```typescript
import { Text, Button, Badge, ListRow, ProgressBar } from '../components/tdsCompat';
```

영향받는 파일:
- `src/AuthBootstrapGate.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Builder.tsx`
- `src/pages/History.tsx`
- `src/components/HarnessCard.tsx`
- `src/components/ConditionSlider.tsx`
- `src/components/SummaryCard.tsx`

`src/components/tds/index.tsx`는 더 이상 스텁 구현이 아니라 `tdsCompat` 재-export만 유지합니다.

## 3. 앱인토스 로그인 SDK 연동

현재 프론트는 `src/main.tsx`에서 `AuthBootstrapGate`를 통해 앱 시작 시 인증 bootstrap을 수행합니다.

흐름은 다음과 같습니다.

1. `appLogin()` 호출
2. SDK가 `{ authorizationCode, referrer }` 반환
3. 프론트가 `POST /users/login` 호출
4. 백엔드가 Apps in Toss OAuth 교환 + `login-me` 조회 후 `tossUserKey`를 내부 식별에 사용하고 서버 발급 `sessionToken` 생성
5. 프론트가 응답의 `sessionToken`을 메모리에 저장하고 이후 API 호출에 `Authorization: Bearer <token>` 헤더를 붙임
6. 이후 하니스/알림 API 호출

핵심 코드는 다음 파일에 있습니다.
- `src/bootstrapAuth.ts`
- `src/AuthBootstrapGate.tsx`
- `src/api/client.ts`

직접 `userKey`를 SDK에서 받는 방식은 더 이상 사용하지 않습니다.

## 4. granite.config.ts 설정

```typescript
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ai-investment-harness',
  brand: {
    displayName: 'AI 투자 하니스',
    primaryColor: '#3182F6',
    icon: null,
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: { dev: 'vite', build: 'vite build' },
  },
  permissions: [],
});
```

## 5. 빌드 및 번들

```bash
npm run build
npx ait bundle   # .ait 파일 생성 (최대 100MB)
```

## 6. 검수 전 체크리스트

### 필수 사항
- [x] `user-scalable=no` meta 태그 유지 — `index.html`
- [x] 앱 메타데이터 비일반화 — `lang="ko"`, `<title>AI 투자 하니스</title>`, description 반영
- [x] Builder 화면에 앱인토스 뒤로가기 + 닫기(X) 연동 — `graniteEvent.backEvent`, `partner.addAccessoryButton`, `tdsEvent.navigationAccessoryEvent`, `closeView`
- [x] 다크 모드 미구현 확인 (라이트 모드 전용) — `src/index.css`
- [ ] 테스트 광고 ID → 프로덕션 ID 교체
- [ ] mTLS 인증서 유효기간 확인 (390일)
- [x] API 키 하드코딩 없음 확인
- [x] TDS 컴포넌트 적용 확인
- [ ] 화면 로드 2초 이내 확인
- [ ] 접근성: 텍스트 대비 4.5:1 이상, 터치 타겟 44×44pt

### 다크패턴 방지
- [ ] 진입 시 바텀시트/팝업 즉시 표시 없음
- [ ] 뒤로가기 가로채기 없음 (이탈 방해 팝업 없음)
- [ ] 닫기 버튼 없는 팝업 없음
- [ ] 사용자 플로우 중 예상치 못한 광고 없음
- [ ] 모든 CTA 버튼 명확한 레이블 ("확인하기" → "하니스 시작하기" 등)

### CORS 설정 (백엔드)
백엔드 `server.ts`에 앱인토스 도메인이 이미 허용되어 있음:
- `https://*.apps.tossmini.com` (프로덕션)
- `https://*.private-apps.tossmini.com` (테스트)

### 환경변수 (백엔드 `.env`)
```
DATABASE_URL=postgresql://...
LLM_API_KEY=...
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o
KIS_WS_URL=ws://ops.koreainvestment.com:21000
KIS_APPROVAL_KEY=...
MTLS_CERT=/path/to/client-cert.pem
MTLS_KEY=/path/to/client-key.pem
```

### 환경변수 (프론트엔드 `.env`)
```
VITE_API_URL=https://your-backend-domain.com
```

## 7. 검수 프로세스 (영업일 2-3일)

| 단계 | 항목 |
|------|------|
| 1. 운영 검수 | 앱 정보, 서류 확인 |
| 2. 디자인 검수 | TDS 가이드라인 준수 |
| 3. 기능 검수 | 핵심 동작 QA |
| 4. 보안 검수 | XSS/CSRF/민감정보 암호화 |

## 8. npm audit / residual risk (2026-04-13)

- 프런트 `npm audit --omit=dev`는 `@apps-in-toss/web-framework`를 `2.4.6`으로 올린 뒤에도 **20건(High 14 / Low 6)** 을 보고합니다.
- 남은 High는 `@apps-in-toss/web-framework`가 동반 설치하는 App-in-Toss / Granite CLI·native 체인(`@apps-in-toss/cli`, `@granite-js/mpack`, `fastify@4.x`, `react-native` 호환 패키지)에서 발생합니다.
- 현재 앱 코드는 `@apps-in-toss/web-framework`의 웹 브리지 API만 사용하며, 빌드된 `dist/**/*.js`에는 `fastify`, `find-my-way`, `react-native`, `@granite-js` 문자열이 남지 않아 브라우저 번들에 직접 포함되지 않음을 확인했습니다.
- `npm audit`가 제시하는 `@apps-in-toss/web-framework@1.14.1`은 현재 2.x SDK 라인으로의 실질적 수정 경로가 아니며, 최신 `2.4.6`도 동일한 Granite 체인을 유지합니다.
- 따라서 이 항목은 **현재 미니앱 브라우저 런타임 경로의 직접 취약점이 아니라 upstream SDK packaging/tooling residual risk** 로 기록합니다.
- 출시 직전에는 App-in-Toss SDK 신규 패치 여부를 다시 확인하고, 검수 제출 시 필요하면 이 배경을 별도 메모로 보관합니다.

## 9. 최종 rehearsal / rollback gate

### 저장소 기준 엔지니어링 검증 완료
- 프런트: `npm run lint`, `npm run test`, `npm run build`
- 백엔드: `npm run migrate:status`, `npm run migrate:deploy`, `npm run build`, `npm test`, `npm run typecheck`
- 로컬 검증 기준으로 현재 release candidate는 저장소 내부 품질 게이트를 통과했습니다.

### 출시 전 수동 확인 필수 항목
- [ ] 실 App-in-Toss 컨테이너에서 auth bootstrap 성공 확인
- [ ] Builder에서 하니스 생성 1회 이상 확인
- [ ] Dashboard에서 조회 후 토글 또는 삭제 1회 확인
- [ ] History 화면 진입 확인
- [ ] production 값 확정: `VITE_API_URL`, `DATABASE_URL`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `SESSION_TOKEN_SECRET`
- [ ] 실시간 감시를 사용할 경우 `KIS_WS_URL`, `KIS_APPROVAL_KEY` 확정
- [ ] `MTLS_CERT`, `MTLS_KEY` 경로와 인증서 유효기간 확인
- [ ] App-in-Toss SDK / Prisma residual-risk 문구 검토 및 수용 여부 확정
- [ ] rollback 실행 담당자와 트리거(`/health` 실패, `POST /users/login` 실패, `/harnesses` 이상) 확정
- [ ] launch 중 확인할 monitoring/alert 채널 존재 여부 확정

### Rollback 기준
- **Frontend artifact issue**: 앱 진입/렌더/bootstrap이 깨지면 직전 정상 프런트 산출물로 즉시 복귀 후 다시 확인합니다.
- **Backend deploy issue**: `/health`, `POST /users/login`, `/harnesses` 이상 시 직전 정상 백엔드 산출물/설정으로 복귀 후 보호 API를 재확인합니다.
- **Migration/app mismatch**: 추가 migration 적용을 중단하고 현재 적용된 schema와 호환되는 직전 앱 버전으로 되돌립니다. 검증되지 않은 DB downgrade는 즉시 실행하지 않습니다.
