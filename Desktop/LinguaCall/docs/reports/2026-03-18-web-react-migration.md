# Web Frontend React 마이그레이션 결과 보고서

**작업일:** 2026-03-18
**작업 범위:** `apps/web` 전체 — Vanilla TS → React 18 + Tailwind CSS + shadcn/ui
**결과:** TypeScript 에러 0건, Vite 빌드 성공 (220KB JS / 14KB CSS)

---

## 1. 배경 및 목표

기존 `apps/web`은 Vanilla TypeScript + HTML string template 방식으로 972줄의 `main.ts` 단일 파일에 모든 로직이 집중되어 있었다. 컴포넌트 재사용성이 없고, DOM 직접 조작 방식이라 유지보수가 어려운 상태였다.

**목표:**
- React 18 + Tailwind CSS + shadcn/ui 기반으로 전면 재설계
- 화면 4개(Login, Verify, Session, Billing) + Report 화면 React 컴포넌트화
- 기존 WebRTC 로직(`webVoiceClient.ts`)은 그대로 재사용
- TypeScript strict 모드 유지

---

## 2. 기술 스택 변경 내역

| 항목 | 변경 전 | 변경 후 |
|------|---------|--------|
| UI 프레임워크 | Vanilla TypeScript | React 18.3 |
| 라우팅 | `window.location.hash` 수동 파싱 | React Router v6 (HashRouter) |
| CSS | 커스텀 CSS (26줄) | Tailwind CSS v3.4 + CSS 변수 |
| 컴포넌트 시스템 | 없음 | shadcn/ui 스타일 컴포넌트 |
| 엔트리 파일 | `src/main.ts` | `src/main.tsx` |
| 빌드 플러그인 | Vite 기본 | `@vitejs/plugin-react` 추가 |

---

## 3. 디자인 토큰

```css
--primary:    221.2 83.2% 53.3%   /* #2563eb — 액센트 블루 */
--background: 210 40% 98%          /* #f8fafc — 전체 배경 */
--card:       0 0% 100%            /* #ffffff — 카드 배경 */
--border:     214.3 31.8% 91.4%    /* 연한 회색 테두리 */
```

레이아웃: Login/Verify는 `max-w-lg` 센터 카드, Session/Billing/Report는 `max-w-2xl` 풀페이지.

---

## 4. 추가된 의존성

### dependencies (런타임)
```json
"class-variance-authority": "^0.7.0",
"clsx": "^2.1.1",
"lucide-react": "^0.454.0",
"react": "^18.3.1",
"react-dom": "^18.3.1",
"react-router-dom": "^6.27.0",
"tailwind-merge": "^2.5.4"
```

### devDependencies (빌드타임)
```json
"@types/react": "^18.3.12",
"@types/react-dom": "^18.3.1",
"@vitejs/plugin-react": "^4.3.3",
"autoprefixer": "^10.4.20",
"postcss": "^8.4.47",
"tailwindcss": "^3.4.14"
```

---

## 5. 파일 구조 (변경 후)

```
apps/web/
├── index.html                          # main.tsx 참조로 변경
├── package.json                        # 의존성 추가
├── tsconfig.json                       # jsx: react-jsx, *.tsx include 추가
├── vite.config.ts                      # @vitejs/plugin-react 추가
├── tailwind.config.js                  # NEW — content: ./src/**/*.{ts,tsx}
├── postcss.config.js                   # NEW — tailwind + autoprefixer
├── components.json                     # NEW — shadcn/ui 설정
└── src/
    ├── main.tsx                        # NEW (main.ts 대체)
    ├── App.tsx                         # NEW — 라우트 정의
    ├── styles.css                      # 교체 — Tailwind directives + CSS 변수
    ├── context/
    │   └── UserContext.tsx             # NEW — clerkUserId 전역 상태
    ├── lib/
    │   ├── api.ts                      # NEW — apiClient() 공통 fetch 헬퍼
    │   └── webVoiceClient.ts           # 재사용 (body 타입 object로 수정)
    ├── components/
    │   ├── ui/
    │   │   ├── cn.ts                   # NEW — clsx + tailwind-merge 유틸
    │   │   ├── button.tsx              # NEW — shadcn Button (6 variants)
    │   │   ├── card.tsx                # NEW — Card, CardHeader, CardTitle, CardContent, CardFooter
    │   │   ├── input.tsx               # NEW — shadcn Input
    │   │   ├── label.tsx               # NEW — shadcn Label
    │   │   ├── badge.tsx               # NEW — Badge (default/secondary/destructive/outline)
    │   │   └── separator.tsx           # NEW — Separator
    │   └── layout/
    │       └── PageLayout.tsx          # NEW — 센터 카드 레이아웃 래퍼
    └── pages/
        ├── ScreenLogin.tsx             # NEW — Screen 1
        ├── ScreenVerify.tsx            # NEW — Screen 2
        ├── ScreenSession.tsx           # NEW — Screen 3 (가장 복잡)
        ├── ScreenBilling.tsx           # NEW — Screen 4
        └── ScreenReport.tsx            # NEW — 리포트 상세
```

**삭제:**
- `apps/web/src/main.ts` (972줄, 모든 로직 포함하던 파일)

---

## 6. 라우트 구조

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/#/` | `ScreenLogin` | 이름 + 이메일 입력 → /verify |
| `/#/verify` | `ScreenVerify` | 전화번호 입력 → OTP → /session |
| `/#/session` | `ScreenSession` | 세션 생성/관리, 통화 UI |
| `/#/billing` | `ScreenBilling` | 구독 상태, 플랜 카드, 체크아웃 |
| `/#/billing?checkout=success&...` | `ScreenBilling` | 체크아웃 결과 처리 |
| `/#/report/:reportId` | `ScreenReport` | 리포트 상세 |
| `/#/*` | `Navigate to /` | 404 리다이렉트 |

HashRouter를 사용하므로 실제 URL은 `http://localhost:5173/#/session` 형태.

---

## 7. 핵심 설계 결정

### 7-1. UserContext
`clerkUserId`를 localStorage에서 읽어 Context로 전역 공유. 모든 스크린이 `useUser()` 훅으로 접근.

```ts
// 사용 패턴
const { clerkUserId, clearIdentity } = useUser();
const api = apiClient(clerkUserId);
```

### 7-2. apiClient() 팩토리
`clerkUserId`를 클로저로 감싸 `x-clerk-user-id` 헤더를 자동 주입하는 fetch 래퍼.

```ts
export function apiClient(clerkUserId: string) {
  return {
    get<T>(url: string): Promise<T>,
    post<T>(url: string, body: object): Promise<T>,
    patch<T>(url: string, body: object): Promise<T>,
    headers(): Record<string, string>,
    base: string
  };
}
```

### 7-3. ScreenSession — ActiveWebVoiceSession 상태 관리
WebVoice 콜백(onStateChange, onTranscriptChange)은 장수명 클로저이므로 stale closure 문제를 방지하기 위해 `useRef` + `useState` 이중 패턴 사용:

```ts
const activeRef = useRef<ActiveWebVoiceSession | null>(null);
const [activeSession, setActiveSession] = useState<...>(null);

// ref와 state를 항상 동기화
const syncActive = (next) => {
  activeRef.current = next;
  setActiveSession(next ? { ...next } : null);
};
```

- `activeRef`: 콜백 내부에서 최신 상태 참조용
- `activeSession`: React 렌더링 트리거용

### 7-4. webVoiceClient.ts 수정 내역
단 1줄 수정 — 내부 `postJson` body 파라미터 타입을 `Record<string, unknown>` → `object`로 변경.
이유: `@lingua/shared`의 `WebVoiceRuntimeEventPayload`, `CompleteWebVoiceCallPayload`가 인덱스 시그니처를 가지지 않아 TypeScript 에러 발생.

---

## 8. API 엔드포인트 매핑 (프론트→백)

ScreenSession.tsx가 호출하는 엔드포인트:

| 메서드 | 경로 | 사용처 |
|--------|------|--------|
| GET | `/users/me` | duration 옵션 계산용 planCode 조회 |
| GET | `/billing/plans` | duration 옵션 계산 |
| GET | `/sessions` | 세션 목록 |
| POST | `/sessions` | 세션 생성 |
| PATCH | `/sessions/:id` | 예약 시간 변경 |
| POST | `/sessions/:id/cancel` | 예약 취소 |
| POST | `/calls/initiate` | 즉시 통화 시작 (WebVoice) |
| POST | `/calls/:id/join` | 예약 세션 조인 (WebVoice) |
| POST | `/calls/:id/end` | 통화 종료 |
| GET | `/sessions/:id/report` | 리포트 조회 |
| POST | `/sessions/:id/report` | 리포트 생성 (not_found시) |
| GET | `/sessions/:id/messages` | 트랜스크립트 조회 |

ScreenBilling.tsx:

| 메서드 | 경로 | 사용처 |
|--------|------|--------|
| GET | `/billing/subscription` | 현재 구독 상태 |
| GET | `/billing/plans` | 플랜 목록 |
| POST | `/billing/checkout` | 체크아웃 URL 생성 |

ScreenReport.tsx:

| 메서드 | 경로 | 사용처 |
|--------|------|--------|
| GET | `/reports/:publicId` | 퍼블릭 리포트 조회 |

---

## 9. tsconfig.json 변경 내역

```json
// 변경 전
{
  "compilerOptions": {
    "jsx": "preserve",
    ...
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}

// 변경 후
{
  "compilerOptions": {
    "jsx": "react-jsx",       // ← 변경
    ...
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",           // ← 추가
    "src/**/*.d.ts"
  ]
}
```

`"types"` 필드는 `["vite/client", "node"]`로 유지. `@types/react`는 `jsx: react-jsx` 모드에서 모듈 레벨로 자동 해석되어 별도 추가 불필요.

---

## 10. 검증 결과

```bash
# TypeScript
pnpm typecheck   → ✓ 에러 0건

# 프로덕션 빌드
pnpm build       → ✓ 49 modules transformed
                    dist/assets/index.css   14.05 kB (gzip: 3.53 kB)
                    dist/assets/index.js   220.00 kB (gzip: 69.64 kB)
```

---

## 11. 향후 작업 시 참고 사항

### 새 UI 컴포넌트 추가
shadcn/ui CLI 없이 수동으로 `apps/web/src/components/ui/` 아래 추가.
`cn()` 유틸(`components/ui/cn.ts`)과 `cva`를 활용해 variant 정의.

### 새 스크린/라우트 추가
1. `apps/web/src/pages/ScreenXxx.tsx` 생성
2. `apps/web/src/App.tsx`에 `<Route>` 추가

### 환경변수
```bash
# apps/web/.env.local (로컬 개발용, git 제외)
VITE_API_BASE_URL=http://localhost:4000
```
미설정 시 `http://localhost:4000`이 기본값으로 사용됨.

### WebVoice 세션 흐름
```
POST /calls/initiate (또는 /calls/:id/join)
  → StartCallResponse { sessionId, clientSecret, model }
  → startWebVoiceClient({ apiBase, bootstrap, headers, onStateChange, onTranscriptChange })
  → WebVoiceClientController { end(), getTranscript() }
```
`clientSecret`은 OpenAI Realtime API SDP 핸드셰이크에 사용됨. 프론트에서 직접 `api.openai.com/v1/realtime`에 WebRTC 연결.

### Billing 체크아웃 리턴 URL 패턴
```
http://localhost:5173/#/billing?checkout=success&provider=mock&plan=basic
```
HashRouter 기반이므로 `window.location.href.split('#')[0]` + `#/billing?...` 형태로 구성.
`useSearchParams()`로 파라미터 읽음.

---

## 12. 관련 문서

| 문서 | 경로 |
|------|------|
| PRD | `LinguaCall_PRD_v3.1_scope_locked.md` |
| 엔지니어링 태스크 | `LinguaCall_engineering_task_breakdown_v1.md` |
| 이전 핸드오프 | `handoff.md` |
| 마이그레이션 플랜 (원본) | 세션 트랜스크립트 참조 |
