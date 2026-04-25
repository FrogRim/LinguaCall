# 출시 전 E2E 체크리스트

이 문서는 현재 LinguaCall 런치 경로를 기준으로 한 메인 E2E 체크리스트다.

## 함께 볼 문서

- 배포: [`vps-deploy.md`](./vps-deploy.md)
- 전화번호 인증: [`supabase-phone-auth-manual.md`](./supabase-phone-auth-manual.md)
- 결제: [`toss-sandbox-manual.md`](./toss-sandbox-manual.md)

## 사전 조건

아래가 모두 준비되어 있어야 한다.

- VPS에서 `web`, `api`, `worker`, `caddy`가 실행 중
- `https://APP_DOMAIN`, `https://API_DOMAIN` 접근 가능
- Supabase Phone Auth 활성화 완료
- Toss 키 설정 완료
- OpenAI 키 설정 완료

## 1. 플랫폼 상태 확인

### API

```bash
curl -i "https://API_DOMAIN/healthz"
```

기대 결과:

- HTTP `200`
- JSON 응답에 `ok: true`

### Worker 수동 실행

```bash
curl -i -X POST "https://API_DOMAIN/workers/run" -H "x-worker-token: YOUR_WORKER_SHARED_SECRET"
```

기대 결과:

- HTTP `200`

### App

```bash
curl -I "https://APP_DOMAIN"
```

기대 결과:

- HTTP `200`

## 2. 전화번호 인증 E2E

상세 절차는 [`supabase-phone-auth-manual.md`](./supabase-phone-auth-manual.md)를 함께 본다.

확인 순서:

1. `https://APP_DOMAIN/#/` 접속
2. `/#/verify`로 이동
3. 전화번호 입력
4. OTP 요청
5. OTP 입력
6. `/#/session` 진입 확인
7. 브라우저 새로고침
8. 로그인 유지 확인
9. 로그아웃
10. `/#/session` 재진입 시 로그인 화면으로 돌아가는지 확인

기대 결과:

- OTP 요청 성공
- OTP 검증 성공
- 새로고침 후 세션 유지
- 로그아웃 후 보호 경로 차단

## 3. 결제 E2E

상세 절차는 [`toss-sandbox-manual.md`](./toss-sandbox-manual.md)를 함께 본다.

이 저장소의 현재 결제 모델은 **web visibility + Apps in Toss payment entry**다. 즉, 일반 브라우저의 `/#/billing`은 플랜 비교와 현재 구독 확인용이고, 실제 결제 시작은 Apps in Toss 내부에서만 허용된다.

확인 순서:

### 3.1 일반 웹 브라우저 모드

1. 로그인 상태에서 `https://APP_DOMAIN/#/billing` 진입
2. 현재 구독 상태와 플랜 비교 UI 확인
3. 유료 플랜 CTA가 비활성 상태인지 확인
4. `플랜 변경은 Apps in Toss 안에서만 진행할 수 있습니다.` 같은 안내 문구 확인

예상 API 호출:

- `GET /billing/plans`
- `GET /billing/subscription`

기대 결과:

- web에서 checkout을 직접 시작하지 않음
- dead CTA 없이 Apps in Toss 진입 필요성이 명확히 보임
- `POST /billing/checkout` 또는 `POST /billing/toss/confirm`이 브라우저 플로우에서 발생하지 않음

### 3.2 Apps in Toss 호스트 모드

1. Apps in Toss 내부 진입 경로로 `/#/billing` 열기
2. 상단의 in-app payment 준비 notice 확인
3. 유료 플랜 CTA 활성화 확인
4. 플랜 선택 후 인앱 결제 handoff 시작
5. 샌드박스 결제 완료
6. webhook 처리 후 현재 구독 상태 갱신 확인

예상 API 호출:

- `GET /billing/plans`
- `GET /billing/subscription`
- `POST /billing/apps-in-toss/verify-session`
- `POST /billing/apps-in-toss/payment-launch`
- `POST /billing/webhooks/toss`
- `GET /billing/subscription` (갱신 확인)

기대 결과:

- verify-session 성공 후에만 payment launch payload 준비 성공
- Apps in Toss bridge를 통해 인앱 결제로 이어짐
- webhook 이후 현재 플랜 상태가 별도 수작업 없이 갱신됨

### 3.3 레거시/예외 상태

1. 예전 billing success/cancel 복귀 URL로 `/#/billing` 재진입
2. success / cancel 별 안내 문구가 과장 없이 보이는지 확인
3. Apps in Toss host hint는 있으나 bridge가 없는 환경이면 재진입 안내 문구가 보이는지 확인

기대 결과:

- 레거시 복귀 링크가 primary 결제 경로처럼 보이지 않음
- unsupported host에서도 다음 행동이 분명함

## 4. 세션 생성 확인

확인 순서:

1. `/#/session` 진입
2. 새 세션 생성
3. 새로고침
4. 목록에 세션이 유지되는지 확인

기대 결과:

- 세션 생성 성공
- 목록과 상세 상태 일치

## 5. 실시간 통화 확인

확인 순서:

1. 라이브 세션 시작
2. 마이크 권한 허용
3. 연결 성공 확인
4. 짧게 발화
5. AI 응답 확인
6. 통화 종료

기대 결과:

- bootstrap 오류 없음
- 통화 시작 가능
- 통화 종료 가능

## 6. 리포트 생성 확인

확인 순서:

1. 세션 종료
2. worker 처리 대기
3. 리포트 화면 열기
4. 점수, 요약, 교정 내용 렌더링 확인

기대 결과:

- 수동 DB 조작 없이 리포트가 생성됨

## 7. 브라우저 화면 확인

아래 화면을 직접 확인한다.

- `/`
- `/#/verify`
- `/#/session`
- `/#/billing`
- `/#/report/:id`
- `/#/privacy`
- `/#/terms`

기대 결과:

- 데스크톱 레이아웃 문제 없음
- 모바일 레이아웃 문제 없음
- 깨진 문자열 없음
- 동작하지 않는 CTA 없음

## 8. 실패 시 확인할 로그

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 api
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 web
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 worker
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 caddy
```

## 9. Go / No-Go 기준

Go:

- health check 통과
- 전화번호 인증 동작
- 결제 동작
- 세션 생성 동작
- 실시간 통화 동작
- 리포트 렌더링 동작
- 보호 경로가 정상적으로 보호됨

No-Go:

- 로그인 완료 불가
- Apps in Toss launch 준비 또는 webhook 반영 실패
- 라이브 세션 시작 또는 종료 실패
- 리포트가 생성되지 않음
