# Web Voice 운영 세팅 가이드

Last updated: 2026-03-18

## 목적

LinguaCall의 MVP 주 통화 경로는 더 이상 PSTN 전화가 아니라 브라우저 기반 Web Voice입니다.
사용자는 웹에서 바로 세션에 입장하고, 마이크 권한을 허용한 뒤 OpenAI Realtime과 실시간 음성 대화를 진행합니다.

핵심 흐름은 아래와 같습니다.

1. 사용자 로그인 및 프로필 준비
2. 세션 생성 또는 예약 세션 선택
3. `Start Call` 또는 `Join Session`
4. 브라우저 마이크 권한 허용
5. OpenAI Realtime 연결
6. 종료 후 transcript / report 생성

## 필수 환경변수

### `apps/api/.env`

```env
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=alloy
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_REALTIME_SESSION_URL=https://api.openai.com/v1/realtime/sessions

PUBLIC_BASE_URL=https://app.example.com
APP_BASE_URL=https://app.example.com
API_BASE_URL=https://api.example.com
DATABASE_URL=postgresql://...
```

### `apps/web/.env`

```env
VITE_API_BASE_URL=https://api.example.com
```

## OpenAI에서 준비할 것

- `OPENAI_API_KEY` 발급
- API billing 활성화
- `gpt-realtime` 사용 가능 상태 확인
- 월 사용량 한도 설정

권장 기본값:

- 모델: `gpt-realtime`
- 음성: `alloy`
- 전사 모델: `gpt-4o-mini-transcribe`

## 브라우저/배포 조건

### HTTPS

운영 환경에서는 HTTPS가 사실상 필수입니다.

- 운영: `https://...`
- 로컬 개발: `http://localhost` 허용

### 마이크 권한

사용자는 브라우저에서 마이크 권한을 허용해야 합니다.

주요 실패 원인:

- 사용자가 권한 거부
- 브라우저에 입력 장치 없음
- OS 레벨에서 마이크 차단

## 운영 체크리스트

- [ ] `OPENAI_API_KEY` 준비
- [ ] `OPENAI_REALTIME_MODEL=gpt-realtime` 설정
- [ ] `apps/api/.env` 입력
- [ ] `apps/web/.env` 입력
- [ ] API 공개 주소 준비
- [ ] Web 공개 주소 준비
- [ ] HTTPS 적용
- [ ] 브라우저 마이크 권한 확인

## Smoke test 순서

### Smoke 1. Immediate Web Voice

1. 사용자 bootstrap 완료
2. phone verification 완료
3. immediate session 생성
4. `Start Call`
5. 마이크 권한 허용
6. 2~3턴 대화
7. `End Call`

기대 결과:

- 세션 상태가 `connecting -> in_progress`로 진행
- 브라우저에서 실시간 음성 대화 동작
- 종료 후 transcript / report 생성 경로 진입

### Smoke 2. Scheduled Web Voice

1. scheduled session 생성
2. 예약 시간 10분 전 이후 진입
3. `Join Session`

기대 결과:

- 예약 세션을 웹에서 바로 입장 가능
- live session 정상 시작

### Smoke 3. Microphone denied

1. `Start Call`
2. 마이크 권한 거부

기대 결과:

- UI에 명확한 실패 메시지 노출
- 세션이 애매한 live 상태로 남지 않음
