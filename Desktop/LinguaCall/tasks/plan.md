# LinguaCall 기능 개선 구현 계획

## 요구사항 요약

1. **PTT (Push-to-Talk)**: AI가 먼저 말하지 않도록, 버튼으로 말하기 시작/끝 제어
2. **단계/상황 설정 세분화**: 세션 생성 시 stage(단계)와 situation(상황) 구분
3. **조기 종료 키워드**: 특정 발화 감지 시 세션 자동 종료
4. **UI/UX 개선**: 세션 로그 하단 고정 + 편집(삭제/이동) + 스크립트 하이라이팅 + 단어 사전

---

## 현재 구조 파악

### 핵심 파일 위치

| 파일 | 역할 |
|------|------|
| `apps/web/src/pages/ScreenSession.tsx` | 세션 화면 전체 (폼 + 활성 세션 + 세션 목록) |
| `apps/web/src/pages/ScreenReport.tsx` | 리포트 화면 |
| `apps/web/src/lib/webVoiceClient.ts` | WebRTC + OpenAI Realtime 연결, 트랜스크립트 처리 |
| `apps/api/src/routes/sessions.ts` | 세션 CRUD API |
| `packages/shared/src/contracts.ts` | 공유 타입 정의 |

### 현재 AI 자동 인사 코드 위치

`apps/web/src/lib/webVoiceClient.ts` line 168-176:
```ts
dataChannel.send(JSON.stringify({
  type: "response.create",
  response: {
    modalities: ["audio", "text"],
    instructions: "Greet the learner briefly and start the conversation immediately."
  }
}));
```
→ PTT 모드에서는 이 자동 인사를 제거해야 함

---

## 의존성 그래프

```
Phase 1 (PTT)
  └─ webVoiceClient.ts (새 옵션 추가)
  └─ ScreenSession.tsx (PTT 버튼 UI)

Phase 2 (설정 세분화)
  └─ contracts.ts (CreateSessionPayload 타입 확장)
  └─ ScreenSession.tsx (폼 UI 확장)
  └─ API sessions.ts 는 topic 필드 안에 합쳐 전달 가능 (스키마 변경 최소화)

Phase 3 (조기 종료 키워드)
  └─ webVoiceClient.ts (트랜스크립트 감지 로직 추가)
  └─ ScreenSession.tsx (콜백 연결)

Phase 4 (세션 로그 UI)
  └─ ScreenSession.tsx (레이아웃 재배치, 편집 상태 관리)
  └─ API sessions.ts (DELETE 엔드포인트 추가, 선택적)

Phase 5 (리포트 하이라이팅)
  └─ ScreenReport.tsx (트랜스크립트 + grammarCorrections 시각화)
  └─ contracts.ts (Report 타입은 이미 grammarCorrections 포함)

Phase 6 (단어 사전)
  └─ ScreenReport.tsx (클릭 이벤트 + 팝오버)
  └─ API (선택: 사전 API 프록시 엔드포인트, 또는 클라이언트에서 직접)
```

---

## Phase별 구현 계획

---

### Phase 1: PTT (Push-to-Talk) 제어

**목표**: AI가 세션 시작 시 자동으로 말을 시작하지 않고, 사용자가 버튼을 눌러서 발화를 제어

**변경 파일**:
- `apps/web/src/lib/webVoiceClient.ts`
- `apps/web/src/pages/ScreenSession.tsx`

**구현 내용**:

1. `webVoiceClient.ts`에 `pttMode: boolean` 옵션 추가
   - `pttMode: true`이면 `dataChannel.open` 시 자동 `response.create` 전송하지 않음
   - 마이크 트랙을 초기에는 음소거(`enabled = false`) 상태로 시작
   - 컨트롤러에 `startSpeaking()` / `stopSpeaking()` 메서드 추가
     - `startSpeaking()`: 마이크 트랙 enabled = true
     - `stopSpeaking()`: 마이크 트랙 enabled = false, 필요 시 `input_audio_buffer.commit` 전송

2. `ScreenSession.tsx`에서 PTT UI 추가
   - 활성 세션 패널에 "말하기" 버튼 (누르는 동안 / 누르고 떼기 두 가지 방식 중 토글 선택)
   - 버튼 상태: 대기중(회색) / 말하는 중(녹색 pulse)

**수락 기준**:
- 세션 연결 직후 AI가 자동으로 말을 시작하지 않음
- 사용자가 "말하기 시작" 버튼을 누르면 마이크 활성화, AI는 사용자 발화 후 반응
- "말하기 종료" 버튼을 누르면 마이크 비활성화

**검증**:
- `pnpm typecheck` 통과
- 브라우저에서 세션 시작 후 AI 자동 발화 없음 확인

---

### Phase 2: 단계/상황 설정 세분화

**목표**: 세션 생성 폼에서 `stage`(준비/모의/실전)와 `situation`(상황 프리셋)을 별도로 선택

**변경 파일**:
- `apps/web/src/pages/ScreenSession.tsx`
- `packages/shared/src/contracts.ts` (타입 주석 수준으로만, 실제 API 스키마는 기존 topic 필드 활용)

**구현 내용**:

1. UI에 `stage` 선택 추가
   - 옵션: `준비 (Warm-up)` / `모의 (Practice)` / `실전 (Full Test)`
   - stage에 따라 AI 프롬프트 지시가 달라짐 (topic 필드에 포함)

2. UI에 `situation` 선택 추가
   - 언어/시험 유형별 상황 프리셋 (예: 영어 OPIC → "자기소개", "경험 말하기", "의견 제시")
   - 기존 `topic` 드롭다운과 별도로 존재
   - 최종 topic 값 = `${stage}::${situation}::${topic}` 형태로 조합하여 API에 전달
   - 또는 topic을 확장하여 stage+situation을 포함한 복합 값으로 구성

3. LANG_CONFIGS에 situation 프리셋 데이터 추가

**수락 기준**:
- 세션 생성 폼에 Stage, Situation 선택 항목이 표시됨
- 조합된 값이 세션 생성 API에 올바르게 전달됨
- 기존 API 스키마 변경 없음

**검증**:
- `pnpm typecheck` 통과
- 세션 생성 후 세션 목록에서 topic 값이 조합된 형태로 표시됨

---

### Phase 3: 조기 종료 키워드 감지

**목표**: 사용자가 특정 발화(예: "끝내자", "그만하자", "여기서 마칠게요")를 하면 세션을 자동 종료

**변경 파일**:
- `apps/web/src/lib/webVoiceClient.ts`
- `apps/web/src/pages/ScreenSession.tsx`

**구현 내용**:

1. `webVoiceClient.ts`에 `earlyExitKeywords: string[]` 옵션 추가
   - 사용자 발화 트랜스크립트 완성 시(`conversation.item.input_audio_transcription.completed`) 키워드 체크
   - 키워드 감지 시 `onEarlyExit?.()` 콜백 호출 후 `finalize()` 실행

2. 다국어 종료 키워드 목록 정의 (ScreenSession.tsx에서 전달)
   - 한국어: "끝내자", "그만하자", "여기서 마칠게요", "채워지지 않아도"
   - 영어: "let's finish", "let's stop", "end the session"
   - 공통 로직: 부분 문자열 매칭(includes)

3. ScreenSession.tsx에서 `onEarlyExit` 콜백 처리
   - 종료 메시지 표시 후 세션 목록 새로고침

**수락 기준**:
- 사용자가 종료 키워드를 말하면 세션이 자동 종료됨
- 종료 후 세션 상태가 `completed`로 전환됨
- 정상 종료 흐름(runtime-complete)을 타고 종료됨

**검증**:
- `pnpm typecheck` 통과
- 종료 키워드 발화 시 세션 패널이 닫히는 동작 확인

---

### Phase 4: UI/UX — 세션 로그 위치 및 편집 기능

**목표**:
1. 세션 로그를 하단 고정 영역으로 이동 (쌓여도 상단 UI 밀리지 않음)
2. 세션 항목 삭제 기능 추가

**변경 파일**:
- `apps/web/src/pages/ScreenSession.tsx`
- `apps/api/src/routes/sessions.ts` (DELETE 엔드포인트)
- `apps/api/src/storage/inMemoryStore.ts` (deleteSession 메서드)

**구현 내용**:

1. ScreenSession.tsx 레이아웃 재구성
   - 상단(fixed): 헤더 + 세션 생성 폼 + 활성 세션 패널
   - 하단 고정 영역: `max-h-[40vh] overflow-y-auto` 세션 목록 박스
   - 세션 목록 상단에 "세션 기록" 타이틀 + 스크롤

2. 세션 항목 삭제 기능
   - 각 세션 항목에 삭제(휴지통) 아이콘 버튼 추가
   - 삭제 확인 없이 즉시 삭제 (또는 인라인 확인 토글)
   - API DELETE `/sessions/:id` 호출

3. API DELETE 엔드포인트 추가
   - `completed`, `cancelled`, `failed` 상태의 세션만 삭제 허용
   - `in_progress` 상태 세션 삭제 시도 시 409 응답

**수락 기준**:
- 세션 목록이 하단 고정 영역에 표시됨
- 세션이 쌓여도 상단 폼 UI가 밀리지 않음
- 삭제 버튼으로 세션 항목 제거 가능

**검증**:
- `pnpm typecheck` 통과
- 10개 이상의 세션 목록에서 스크롤 동작 확인

---

### Phase 5: 리포트 — 문장 하이라이팅

**목표**: 리포트에서 사용자 발화의 정확한 부분(검정/파란)과 틀린 부분(빨간)을 색상으로 구분

**변경 파일**:
- `apps/web/src/pages/ScreenReport.tsx`

**구현 내용**:

1. 트랜스크립트 + grammarCorrections 매핑
   - `report.evaluation.grammarCorrections`의 `issue` 텍스트를 트랜스크립트 메시지에서 찾아 하이라이팅
   - 정확한 부분: 기본 텍스트(검정)
   - 잘못된 부분 (`issue`): 빨간색(red) 밑줄
   - 제안 부분 (`suggestion`): 파란색(blue) 보조 표시

2. `HighlightedTranscript` 컴포넌트 신규 작성
   - 문자열 + corrections 목록을 받아 `<span>` 단위로 분리 렌더링
   - 매칭: 대소문자 무시, 부분 문자열 기준

3. 리포트의 트랜스크립트 메시지 섹션 추가
   - 현재 ScreenReport에 없는 메시지 목록을 API에서 별도 로드
   - `GET /sessions/:id/messages` 를 report publicId → sessionId로 호출

**수락 기준**:
- 리포트 화면에 트랜스크립트 목록이 표시됨
- 사용자 발화에서 문법 오류 부분이 빨간색으로 표시됨
- 대체 제안 텍스트가 파란색으로 나란히 표시됨

**검증**:
- `pnpm typecheck` 통과
- grammarCorrections 데이터가 있는 리포트에서 하이라이팅 확인

---

### Phase 6: 리포트 — 단어 사전 팝오버

**목표**: 리포트/트랜스크립트에서 단어를 클릭하면 해당 단어의 뜻을 팝오버로 표시

**변경 파일**:
- `apps/web/src/pages/ScreenReport.tsx`
- `apps/api/src/routes/` (사전 프록시 엔드포인트 추가)

**구현 내용**:

1. `WordPopover` 컴포넌트 작성
   - 단어 클릭 시 로딩 → API 호출 → 뜻 표시
   - Tailwind CSS 기반 팝오버 (Radix UI Popover 활용 or 간단한 절대 위치 div)

2. API 사전 엔드포인트
   - `GET /dictionary?word=hello&lang=en`
   - OpenAI API를 사용하여 단어 뜻, 예문, 품사 반환
   - 캐싱: 동일 단어 재요청 시 메모리 캐시 활용

3. ScreenReport.tsx에 단어 클릭 이벤트 연결
   - 트랜스크립트 텍스트를 단어 단위로 분리하여 각 단어를 클릭 가능한 `<span>`으로 렌더링

**수락 기준**:
- 리포트 화면에서 단어 클릭 시 팝오버 표시
- 팝오버에 품사, 뜻, 예문이 표시됨
- 같은 단어 재클릭 시 캐시된 결과 즉시 표시

**검증**:
- `pnpm typecheck` 통과
- 영어/한국어 단어 클릭 시 팝오버 표시 확인

---

## 체크포인트

| 단계 | 완료 기준 |
|------|-----------|
| Phase 1 완료 후 | PTT 버튼 동작 확인, AI 자동 발화 없음 |
| Phase 2 완료 후 | 세션 생성 폼 UI 확인, API 정상 전달 |
| Phase 3 완료 후 | 종료 키워드 감지 동작 확인 |
| Phase 4 완료 후 | 세션 로그 하단 고정, 삭제 가능 |
| Phase 5 완료 후 | 리포트에서 하이라이팅 표시 |
| Phase 6 완료 후 | 단어 클릭 사전 팝오버 표시 |

---

## 리스크 및 가정

- **PTT + WebRTC**: 마이크 트랙 `enabled = false`로 음소거 처리 시 OpenAI Realtime이 무음으로 인식할 수 있음 → VAD(Voice Activity Detection) 설정 확인 필요
- **사전 API**: OpenAI API 호출 비용 발생, 캐싱으로 최소화
- **하이라이팅**: grammarCorrections의 `issue` 텍스트가 실제 발화와 정확히 일치하지 않을 수 있음 → 부분 매칭 로직 필요
- **세션 삭제**: 현재 store가 메모리 기반이므로 DB 연동 시 추가 마이그레이션 필요
