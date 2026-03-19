# Provider E2E 매트릭스

Last updated: 2026-03-14

## 목적

이 문서는 LinguaCall MVP의 실제 provider 검증 계약을 고정하기 위한 문서다.

첫 실서비스 smoke run에서 아래 항목을 검증할 때 기준 문서로 사용한다.

- Stripe checkout + webhook 동기화
- Telegram reminder / report delivery
- Web Voice live session + browser/runtime 경로

이 문서는 내부 MVP 코드 경로는 이미 준비됐고, 남은 작업이 provider 계약 검증과 runtime 설정이라고 가정한다.

## 범위

포함:

- 필수 환경변수
- 허용되는 요청/응답 shape
- webhook payload 기대값
- 기대되는 시스템 상태 변화
- 검증해야 할 retry / failure 시나리오

제외:

- 프론트엔드 리디자인
- 새 제품 기능
- billing 정책 재설계
- 새 데이터베이스 스키마 작업

## 전역 사전 조건

실provider smoke 전에 아래가 모두 충족되어야 한다.

- API 서버가 provider callback을 받을 수 있도록 공인 인터넷에서 접근 가능해야 한다.
- `PUBLIC_BASE_URL`, `APP_BASE_URL`은 브라우저가 보는 앱 origin을 가리켜야 한다.
- `API_BASE_URL` 또는 reverse proxy 경로가 provider callback을 현재 실행 중인 API로 전달해야 한다.
- DB가 초기화되어 있어야 하고, billing provider 매핑과 맞는 활성 유료 플랜이 최소 1개 있어야 한다.
- 테스트 사용자가 아래를 완료할 수 있어야 한다.
  - `/users/me`
  - `/users/phone/start`
  - `/users/phone/confirm`
- smoke 중 worker trigger endpoint를 쓸 경우 worker token이 설정되어 있어야 한다.

## Stripe 설정 체크리스트

필수 env:

- `PAYMENT_PROVIDER=stripe`
- `PAYMENT_PROVIDER_CREATE_URL_STRIPE`
- `PAYMENT_PROVIDER_BEARER_TOKEN_STRIPE` 또는 `PAYMENT_PROVIDER_AUTH_HEADER_STRIPE` + `PAYMENT_PROVIDER_AUTH_VALUE_STRIPE`
- `BILLING_WEBHOOK_SECRET_STRIPE`
- `PAYMENT_RETURN_URL_STRIPE` 또는 호출자가 넘기는 `returnUrl`
- `PAYMENT_CANCEL_URL_STRIPE` 또는 호출자가 넘기는 `cancelUrl`

권장 env:

- `PUBLIC_BASE_URL`
- `APP_BASE_URL`

플랜 매핑 규칙:

- 현재 `planCode`는 Stripe `price`로 전송된다.
- 따라서 구매 가능한 LinguaCall plan code는 실제 Stripe Price ID와 같아야 한다.
- 또는 `PAYMENT_PROVIDER_CREATE_URL_STRIPE` 뒤에 있는 provider adapter가 forwarding 전에 변환해야 한다.

## Stripe Checkout 생성 계약

### LinguaCall이 보내는 요청

`POST {PAYMENT_PROVIDER_CREATE_URL_STRIPE}`

기대 요청 바디 필드:

- `provider`
- `checkoutSessionId`
- `planCode`
- `clerkUserId`
- `returnUrl`
- `cancelUrl`
- `successRedirectUrl`
- `cancelRedirectUrl`
- `mode=subscription`
- `payment_method_types=["card"]`
- `client_reference_id`
- `metadata`
- `line_items[0].price`
- `line_items[0].quantity`
- `success_url`
- `cancel_url`
- `success_redirect_url`
- `cancel_redirect_url`
- `subscription_data.metadata`

기대 metadata 필드:

- `provider`
- `checkoutSessionId`
- `clerkUserId`
- `planCode`
- `priceId`

### 허용되는 checkout 생성 응답 shape

LinguaCall은 현재 아래 URL 필드 중 하나를 받아들인다.

- `checkoutUrl`
- `checkout_url`
- `sessionUrl`
- `session_url`
- `url`
- `data.checkoutUrl`
- `data.checkout_url`
- `data.sessionUrl`
- `data.session_url`
- `data.url`
- `data.data.checkoutUrl`
- `data.data.checkout_url`
- `data.data.sessionUrl`
- `data.data.session_url`
- `data.data.url`
- `checkout_session.url`
- `data.checkout_session.url`
- `data.object.url`

LinguaCall은 현재 아래 session id 필드 중 하나를 받아들인다.

- `checkoutSessionId`
- `checkout_session_id`
- `sessionId`
- `session_id`
- `id`
- `session`
- `checkout_session.id`
- `data.checkoutSessionId`
- `data.checkout_session_id`
- `data.sessionId`
- `data.session_id`
- `data.id`
- `data.session`
- `data.checkout_session.id`
- `data.data.id`
- `data.data.checkoutSessionId`
- `data.data.checkout_session_id`
- `data.data.sessionId`
- `data.data.session_id`
- `data.object.id`

### Stripe Checkout smoke 시나리오

시나리오 1: checkout 생성 성공

- provider를 `stripe`로 두고 `POST /billing/checkout`을 호출한다.
- 기대 결과:
  - `200`
  - 비어 있지 않은 `checkoutUrl`
  - 비어 있지 않은 `checkoutSessionId`
  - 반환된 `provider === "stripe"`

시나리오 2: 잘못된 plan 매핑

- 유효한 Stripe price가 아닌 `planCode`로 `POST /billing/checkout`을 호출한다.
- 기대 결과:
  - `422 validation_error`
  - provider adapter 또는 LinguaCall validation 메시지가 그대로 유지된다.

시나리오 3: provider 인증 설정 오류

- Stripe auth env를 제거한 뒤 checkout 생성을 호출한다.
- 기대 결과:
  - provider adapter가 auth/config 오류를 반환하면 `422 validation_error`
  - generic `failed_to_create_checkout_session`가 나오면 안 된다.

## Stripe Webhook 계약

권장 endpoint:

- `POST /billing/webhooks/stripe`

fallback endpoint:

- `POST /billing/webhooks/payments`

webhook 서명:

- `BILLING_WEBHOOK_SECRET_STRIPE`로 검증한다.
- 지원 헤더:
  - `x-signature`
  - `x-payment-signature`
  - `x-webhook-signature`
  - `payment-signature`
  - `stripe-signature`

LinguaCall이 현재 해석 가능한 payload 필드:

- event type:
  - `type`
  - `eventType`
  - `event_type`
  - `event`
  - `event_name`
- provider:
  - `provider`
  - metadata의 provider
  - `/webhooks/:provider` 라우트 힌트
- user identity:
  - `clerkUserId`
  - `clerk_user_id`
  - `userId`
  - `user_id`
  - metadata 변형들
  - `client_reference_id`
  - `customer`
- plan identity:
  - `planCode`
  - `plan_code`
  - `plan_id`
  - metadata 변형들
  - `priceId`
  - `price_id`
  - `plan.id`
  - `price.id`
  - 첫 line item의 `price.id`
- provider subscription identity:
  - `providerSubscriptionId`
  - `subscriptionId`
  - `subscription`
  - `subscription_data.id`
  - 중첩 subscription object id
  - invoice line item의 `subscription`
- status:
  - 직접 `status`
  - `payment_status`
  - `subscription_status`
  - event name 기반 fallback

### Stripe Webhook 시나리오 매트릭스

시나리오 1: checkout/session completed -> active subscription

- 대표 이벤트:
  - `checkout.session.completed`
- payload에서 반드시 해석돼야 하는 값:
  - `client_reference_id` 또는 metadata의 user id
  - metadata 또는 price 매핑의 plan
  - `subscription`의 provider subscription id
- 기대 결과:
  - subscription row upsert
  - user `plan_code` 갱신
  - non-active에서 active/trialing으로 바뀌면 allowance 부여

시나리오 2: customer.subscription.updated -> 여전히 active

- 대표 상태:
  - `active`
  - `trialing`
- 기대 결과:
  - subscription 갱신
  - plan이 바뀌어 positive delta가 생긴 경우를 제외하고 allowance 중복 지급 없음

시나리오 3: customer.subscription.updated -> past_due

- 대표 상태:
  - `past_due`
  - `payment_failed`
- 기대 결과:
  - subscription status 갱신
  - 다른 active subscription이 있는지 기준으로 user fallback plan 재계산

시나리오 4: customer.subscription.deleted

- 기대 결과:
  - subscription status가 canceled로 설정
  - user는 가장 최근 active subscription 또는 `free`로 fallback

시나리오 5: webhook 재전송

- 같은 event id 또는 같은 provider subscription id + same event type으로 재전송한다.
- 기대 결과:
  - webhook dedupe hit
  - allowance 중복 지급 없음
  - 최신 subscription 상태가 그대로 유지됨

시나리오 6: user / plan / subscription이 빠진 malformed webhook

- 기대 결과:
  - `422 validation_error`
  - 어떤 필드가 빠졌는지 명시적인 메시지

## Telegram 설정 체크리스트

전송 방식 env, 아래 중 하나 선택:

- 표준 bot 모드:
  - `TELEGRAM_BOT_TOKEN`
- custom endpoint 모드:
  - `TELEGRAM_API_URL` 또는 `TELEGRAM_API_ENDPOINT`

대상 env, 아래 중 최소 하나 선택:

- `TELEGRAM_CHAT_ID`
- `TELEGRAM_CHAT_ID_DEFAULT`
- `TELEGRAM_CHAT_ID_MAP`
- `TELEGRAM_CHAT_ID_MAP_JSON`
- `TELEGRAM_CHAT_ID_<NORMALIZED_USER_ID>`

env key용 user id 정규화 규칙:

- 대문자
- 영숫자가 아닌 문자는 `_`로 치환

예시:

- user id `user-123@test` -> `USER_123_TEST`
- env key -> `TELEGRAM_CHAT_ID_USER_123_TEST`

### Telegram 라우팅 우선순위

LinguaCall은 Telegram 대상을 아래 순서로 결정한다.

1. `TELEGRAM_CHAT_ID_MAP_JSON` 또는 `TELEGRAM_CHAT_ID_MAP`
2. `TELEGRAM_CHAT_ID_<NORMALIZED_USER_ID>`
3. `TELEGRAM_CHAT_ID_DEFAULT`
4. `TELEGRAM_CHAT_ID`

### Telegram smoke 시나리오

시나리오 1: reminder 전송 성공

- due scheduled session에 대해 reminder worker를 실행한다.
- 기대 결과:
  - reminder가 accepted 또는 sent 처리된다.
  - `telegram_reminder` webhook event가 저장된다.

시나리오 2: report-ready 전송 성공

- ready report에 대해 report notification worker를 실행한다.
- 기대 결과:
  - report-ready 메시지가 전송된다.
  - delivery state가 갱신된다.
  - `telegram_report_ready` webhook event가 저장된다.

시나리오 3: 대상 설정 누락

- chat-id 관련 설정을 전부 제거한 뒤 notification을 실행한다.
- 기대 결과:
  - 현재 구현은 mock 스타일 delivery로 fallback될 수 있다.
  - 이것은 pre-production smoke에서는 허용 가능하다.
  - production go-live 전에는 명시적 target config가 반드시 필요하다.

시나리오 4: 사용자별 override

- default target과 normalized per-user target을 둘 다 설정한다.
- 해당 사용자에 대해 notification을 실행한다.
- 기대 결과:
  - per-user override가 우선한다.

## Web Voice 설정 체크리스트

상세 운영 절차 참고:

- `docs/runbooks/web-voice-live-setup.md`

필수 env:

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `PUBLIC_BASE_URL`
- `APP_BASE_URL`
- `API_BASE_URL`

권장 env:

- `OPENAI_REALTIME_VOICE`
- `OPENAI_REALTIME_TRANSCRIPTION_MODEL`

### Web Voice smoke 시나리오

시나리오 1: immediate live session 정상 경로

- immediate session 생성
- `Start call`
- 브라우저에서 마이크 권한 허용
- 기대 결과:
  - session이 `ready -> connecting -> in_progress`로 전이
  - 브라우저에서 실시간 음성 시작
  - 종료 후 transcript와 report 생성

시나리오 2: scheduled join 정상 경로

- `scheduled_once` session 생성
- scheduled time 근처에서 `Join session`
- 기대 결과:
  - scheduled session에 웹으로 입장 가능
  - 상태가 live session lifecycle로 전이
  - reminder / 완료 흐름이 유지됨

시나리오 3: microphone permission denied

- `Start call`
- 브라우저에서 마이크 권한 거부
- 기대 결과:
  - session이 실패 상태로 정리
  - `mic_permission_denied` 계열 failure reason 저장

시나리오 4: network/media fault

- live session 중 네트워크 차단 또는 media 연결 실패 유도
- 기대 결과:
  - `network_error` 또는 `media_connection_failed`
  - allowance/refund 경로가 현재 정책에 맞게 적용

시나리오 5: normal complete

- live session을 정상 종료
- 기대 결과:
  - session이 `completed`
  - transcript / report / notification 경로가 이어짐

### Web Voice 운영 체크 포인트

- 브라우저가 마이크 권한을 받을 수 있어야 한다.
- 운영 후보 환경은 HTTPS여야 한다.
- `OPENAI_API_KEY`가 API 서버에만 들어가 있어야 한다.
- 사용자는 전화번호가 아니라 웹 브라우저로 세션에 입장한다.
- 예약 세션은 자동 전화 수신이 아니라 scheduled join 방식이다.

## 권장 live smoke 순서

노이즈를 줄이기 위해 아래 순서로 실행한다.

1. user bootstrap + phone verification 확인
2. Stripe checkout create만 먼저 확인
3. Stripe webhook success 경로 확인
4. Telegram reminder delivery 확인
5. Telegram report-ready delivery 확인
6. Web Voice immediate session 확인
7. Web Voice scheduled join 확인
8. Web Voice permission/network failure 확인

## 전체 E2E 전 Go / No-Go 체크

아래가 모두 참이면 Go:

- Stripe checkout create가 안정적인 session URL과 session id를 반환한다.
- Stripe webhook signature가 정상 검증된다.
- active subscription sync가 user plan을 정확히 갱신한다.
- Telegram target routing이 테스트 사용자에 대해 결정적으로 해석된다.
- Web Voice runtime이 정상 연결되고 상태를 전진시킨다.
- call 종료 후 report generation과 notification flow가 끝까지 완료된다.

아래 중 하나라도 참이면 No-Go:

- plan code와 Stripe price 매핑이 아직 불명확하다.
- webhook payload에서 안정적인 user id를 얻을 수 없다.
- production 후보 설정인데 Telegram 메시지가 여전히 mock 경로로 간다.
- 브라우저 마이크 권한 또는 HTTPS 조건이 충족되지 않는다.

## 운영자가 아직 확정해야 하는 값

실제 E2E 전에 아래 값은 운영자가 제공해야 한다.

- live Stripe endpoint URL
- Stripe auth secret 또는 custom auth header/value
- Stripe webhook secret
- 최종 plan-to-price 매핑
- Telegram 대상 정책:
  - 단일 공용 chat
  - default + per-user override
  - 완전 per-user 매핑
- 공개 웹 URL
- 공개 API base URL
