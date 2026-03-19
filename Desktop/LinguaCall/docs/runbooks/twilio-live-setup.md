# Twilio 실전 세팅 가이드

> Deprecated for MVP primary path. LinguaCall의 현재 기본 통화 경로는 Twilio/PSTN이 아니라 `Web Voice + OpenAI Realtime`이다.
> 이 문서는 과거 구현 참고용 / dev-only 참고 문서로 남겨둔다.

Last updated: 2026-03-14

## 목적

이 문서는 LinguaCall에서 Twilio를 실제 통화 provider로 붙이기 위해 필요한 운영 세팅을 아주 구체적으로 설명한다.

이 문서가 답하려는 질문은 아래다.

- Twilio에서 어떤 상품/기능이 필요한가
- trial 계정과 정식 계정의 차이는 무엇인가
- 어떤 번호를 사야 하는가
- Twilio 콘솔에서 어떤 메뉴를 눌러야 하는가
- 어떤 URL이 공인 인터넷에 노출되어야 하는가
- 어떤 env를 어디에 넣어야 하는가
- smoke test는 어떤 순서로 해야 하는가

## LinguaCall이 Twilio에서 실제로 사용하는 것

현재 코드 기준으로 LinguaCall이 Twilio에서 사용하는 것은 아래 3개다.

1. Programmable Voice outbound call
2. Status Callback webhook
3. Media Streams WebSocket

즉, 단순히 전화번호만 사면 끝이 아니고, 아래 경로가 모두 살아 있어야 한다.

- 발신 API 호출
- 통화 상태 callback
- 실시간 media stream 연결

## 먼저 알아야 할 핵심

### 1. Trial 계정으로는 제한이 있다

Twilio trial 계정은 보통 아래 제약이 있다.

- 검증된 번호로만 발신 가능
- 통화 시작 시 trial 안내 음성이 붙을 수 있음
- 일부 국가/번호 타입에서 제한이 있음

그래서 진짜 smoke test를 하려면 권장 순서는 아래다.

- 로컬 내부 검증: trial 가능
- 외부 실사용 smoke: 가능하면 유료 계정으로 upgrade 후 진행

### 2. 번호는 아무 번호나 사면 안 된다

반드시 `Voice capability`가 있는 번호가 필요하다.

권장:

- 음성 발신 가능한 일반 local number

불필요:

- SMS 전용 번호
- WhatsApp 전용 번호
- Voice capability가 없는 번호

### 3. 서버가 공인 인터넷에서 보여야 한다

Twilio는 네 로컬 PC를 직접 호출하지 못한다.

최소 아래가 외부에서 접근 가능해야 한다.

- `https://api.example.com/calls/twilio-twiml`
- `https://api.example.com/calls/twilio-status-callback`
- `wss://api.example.com/media-stream`

`localhost`, `127.0.0.1`, 내부 사설 IP는 Twilio 운영 테스트에 사용할 수 없다.

## Twilio에서 준비해야 하는 것

### 필요한 계정/기능

- Twilio account
- `Programmable Voice` 사용 가능 상태
- Voice-capable phone number 1개 이상

권장:

- 결제수단 등록 완료
- 계정 upgrade 완료

## 1단계. Twilio 가입

### 해야 할 일

1. `https://www.twilio.com`에 가입한다.
2. 이메일 인증을 완료한다.
3. 전화번호 인증을 완료한다.
4. Twilio Console에 로그인한다.

### 확인해야 할 것

- Console에 들어갈 수 있어야 한다.
- Account SID가 보여야 한다.
- Auth Token을 볼 수 있어야 한다.

## 2단계. Trial 여부 확인

### 어디서 확인하나

Twilio Console 메인 대시보드에서 account 상태를 확인한다.

### 판단 기준

- `Trial`이면 제한 계정
- `Upgraded` 또는 유사 유료 상태면 실운영 smoke 가능

### 권장 판단

- 내부 dev 확인만 하면 `Trial`로도 가능
- 실제 외부 번호 대상 smoke를 할 거면 upgrade 권장

## 3단계. Account SID / Auth Token 복사

### Twilio에서 복사할 값

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### 보통 어디에 있나

- Console Dashboard
- 또는 `Account Info` 영역

### 넣을 위치

- `apps/api/.env`

예시:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4단계. Voice 가능한 번호 구매

### 어디로 가나

- `Phone Numbers`
- `Manage`
- `Buy a number`

### 필터에서 확인할 것

- Country: 사용할 국가
- Capabilities: 반드시 `Voice`

권장:

- `Voice`는 필수
- `SMS`는 있어도 되고 없어도 됨

### 구매 전에 확인할 것

- 네가 발신하려는 국가로 통화가 가능한지
- 해당 번호가 outbound voice에 사용 가능한지

### 복사할 값

- 구매한 번호
  - 예: `+1XXXXXXXXXX`

### 넣을 위치

- `apps/api/.env`

```env
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
```

## 5단계. Trial 계정이면 발신 대상 번호 검증

이 단계는 trial 계정에서 특히 중요하다.

### 해야 할 일

- `Phone Numbers`
- `Manage`
- `Verified Caller IDs`
- 테스트에 사용할 수신 번호를 등록하고 검증한다.

### 왜 필요한가

trial 계정은 보통 검증된 대상에게만 발신할 수 있다.

### 주의

- 검증하지 않은 실제 사용자 번호로는 trial 발신이 막힐 수 있다.

## 6단계. Voice Geographic Permissions 확인

### 왜 필요한가

Twilio는 발신 국가/지역 권한이 꺼져 있으면 API나 번호가 정상이어도 통화가 실패한다.

### 어디서 확인하나

Twilio Console에서 `Voice` 관련 설정 아래 Geographic Permissions 메뉴를 찾는다.

계정 UI는 바뀔 수 있지만 보통 아래 성격의 메뉴다.

- Voice
- Settings
- Geographic Permissions

### 해야 할 일

- 네가 발신하려는 국가가 outbound 허용인지 확인한다.
- 테스트 대상 국가를 enable 한다.

### 권장

- 처음에는 테스트에 필요한 국가만 켠다.
- 전 세계를 무작정 다 열지 않는다.

## 7단계. 공개 URL 준비

Twilio는 아래 3개 URL에 접근할 수 있어야 한다.

### 1. TwiML URL

```text
https://api.example.com/calls/twilio-twiml
```

역할:

- 통화 연결 시 Twilio가 받아갈 TwiML XML을 반환한다.

현재 코드 동작:

- `POST /calls/twilio-twiml`
- `GET /calls/twilio-twiml`
- `POST /calls/twilio-twiml/:callId`
- `GET /calls/twilio-twiml/:callId`

실무 권장:

- 외부에서는 `https://.../calls/twilio-twiml` 1개만 쓰면 충분하다.

### 2. Status Callback URL

```text
https://api.example.com/calls/twilio-status-callback
```

역할:

- 통화 상태 변화(`initiated`, `ringing`, `answered`, `completed`, `busy`, `no-answer`, `failed`)를 Twilio가 보내준다.

현재 코드 동작:

- `POST /calls/twilio-status-callback`

### 3. Media Stream URL

```text
wss://api.example.com/media-stream
```

역할:

- 통화 음성을 Twilio Media Streams로 실시간 전달한다.

현재 코드 동작:

- WebSocket endpoint `/media-stream`

중요:

- `ws://`가 아니라 `wss://`를 권장한다.
- 운영 환경에서는 TLS가 사실상 필수다.

## 8단계. API env 채우기

아래를 `apps/api/.env`에 넣는다.

```env
CALL_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
TWILIO_TWIML_URL=https://api.example.com/calls/twilio-twiml
TWILIO_STATUS_CALLBACK_URL=https://api.example.com/calls/twilio-status-callback
TWILIO_MEDIA_STREAM_URL=wss://api.example.com/media-stream
```

추가 권장:

```env
TWILIO_WEBHOOK_AUTH_TOKEN=replace-with-random-secret
```

그리고 공통 값도 같이 맞춰야 한다.

```env
PUBLIC_BASE_URL=https://app.example.com
APP_BASE_URL=https://app.example.com
API_BASE_URL=https://api.example.com
```

## 9단계. Twilio가 어떤 HTTP/WebSocket 경로를 쓰는지 이해하기

LinguaCall 기준으로 실제 흐름은 아래다.

1. 앱이 `POST /calls/initiate` 호출
2. 서버가 Twilio REST API로 outbound call 생성
3. Twilio가 `TWILIO_TWIML_URL` 호출
4. 서버가 TwiML XML 반환
5. Twilio가 `<Stream>` 기준으로 `TWILIO_MEDIA_STREAM_URL`에 WebSocket 연결
6. Twilio가 `TWILIO_STATUS_CALLBACK_URL`로 상태 callback 전송
7. 서버가 상태를 저장하고 transcript/report 흐름을 이어감

즉, Twilio 콘솔에서 “한 군데만” 등록하면 되는 구조가 아니라, 실제로는 앱 env와 API 공개 URL이 서로 일치해야 한다.

## 10단계. TwiML 응답에서 서버가 Twilio에 요구하는 것

현재 서버는 Twilio에 아래 성격의 TwiML을 돌려준다.

- `<Connect>`
- `<Stream url="wss://.../media-stream">`
- custom parameters:
  - `session_id`
  - `provider_call_sid`
  - `call_id`

이 값들은 Twilio 콘솔에서 직접 넣는 게 아니라, 우리 서버가 Twilio에게 반환하는 XML 안에 들어간다.

즉, 네가 운영자가 해야 할 일은:

- `TWILIO_MEDIA_STREAM_URL`가 진짜 접속 가능한 주소인지 보장
- 그 주소가 TLS/WebSocket으로 열려 있는지 보장

이 두 가지다.

## 11단계. Twilio 콘솔에서 직접 등록해야 하는 것이 있는가

현재 LinguaCall 구조에서는 핵심 URL은 env에서 제어한다.

즉, 가장 중요한 것은 Twilio 번호 상세 화면에 수동 webhook을 깊게 넣는 것보다 아래를 맞추는 것이다.

- 앱 서버가 Twilio REST API를 호출할 때 사용할 `TWILIO_TWIML_URL`
- callback에 사용할 `TWILIO_STATUS_CALLBACK_URL`
- media stream에 사용할 `TWILIO_MEDIA_STREAM_URL`

다만 운영 점검 차원에서 아래는 확인하는 것이 좋다.

- 구매한 번호가 voice capable인지
- 계정의 Geographic Permissions가 발신 대상 국가에 대해 열려 있는지
- trial이면 verified caller id가 완료됐는지

## 12단계. 보안 관점에서 확인할 것

### 1. Auth Token

- 절대 프론트에 넣지 않는다.
- `apps/api/.env`에만 둔다.

### 2. Webhook 보호

현재 코드에는 아래 값이 있다.

- `TWILIO_WEBHOOK_AUTH_TOKEN`

이 값은 운영 보강용으로 두는 것이 좋다.

추가로 이미 구현된 상태:

- status callback 서명 검증 로직 존재

실운영에서는 아래를 권장한다.

- reverse proxy에서 HTTPS 강제
- API 로그에 Twilio token 원문 노출 금지
- env 파일을 배포 비밀 저장소로 관리

## 13단계. 가장 흔한 실패 원인

### 1. `TWILIO_FROM_NUMBER`는 있는데 Voice capability가 없음

결과:

- 발신 실패

### 2. trial 계정인데 수신 번호가 verified caller id가 아님

결과:

- 통화 생성 또는 연결 실패

### 3. Geographic Permissions가 꺼져 있음

결과:

- 특정 국가 발신 실패

### 4. `TWILIO_TWIML_URL`이 공인 인터넷에서 안 열림

결과:

- call은 생성됐는데 진행이 안 됨

### 5. `TWILIO_STATUS_CALLBACK_URL`이 외부에서 안 열림

결과:

- 실제 통화는 갔어도 우리 시스템 상태가 업데이트 안 됨

### 6. `TWILIO_MEDIA_STREAM_URL`이 `wss://`가 아니거나 TLS가 깨짐

결과:

- media stream 바인딩 실패
- transcript / runtime 흐름 실패

### 7. reverse proxy가 WebSocket upgrade를 안 열어줌

결과:

- `/media-stream` 연결 실패

## 14단계. Twilio smoke test 상세 순서

### Smoke A. 환경 확인

확인할 것:

- `CALL_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID` 입력됨
- `TWILIO_AUTH_TOKEN` 입력됨
- `TWILIO_FROM_NUMBER` 입력됨
- `TWILIO_TWIML_URL` 공개 접근 가능
- `TWILIO_STATUS_CALLBACK_URL` 공개 접근 가능
- `TWILIO_MEDIA_STREAM_URL` 공개 접근 가능

### Smoke B. immediate call

1. 사용자 bootstrap 완료
2. phone verification 완료
3. immediate session 생성
4. `Start call` 실행

기대 결과:

- 세션이 `ready -> dialing`으로 변한다.
- status callback이 들어온다.
- 가능한 경우 `ringing -> in_progress -> completed`로 간다.

### Smoke C. no-answer / busy

테스트 대상 번호를 일부러 받지 않거나 busy 상황을 만든다.

기대 결과:

- 세션이 terminal 상태로 저장된다.
- failure reason이 보인다.

### Smoke D. media stream

통화 중 media stream이 붙는지 본다.

기대 결과:

- `/media-stream`로 WebSocket 연결
- session 바인딩 성공
- 후속 transcript/report 경로 진입 가능

### Smoke E. callback replay

가능하면 같은 callback을 다시 보내거나 out-of-order callback을 만든다.

기대 결과:

- 상태가 뒤로 가지 않는다.
- dedupe / monotonicity가 유지된다.

## 15단계. 운영자가 최종적으로 채워야 하는 Twilio 값

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_TWIML_URL`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_MEDIA_STREAM_URL`
- 선택:
  - `TWILIO_WEBHOOK_AUTH_TOKEN`

## 16단계. Twilio 완료 기준

아래가 모두 참이면 Twilio 세팅은 완료로 본다.

- Twilio 계정 생성 완료
- trial 여부 파악 완료
- 필요 시 계정 upgrade 완료
- voice capable 번호 확보 완료
- trial이면 verified caller id 완료
- Geographic Permissions 확인 완료
- `apps/api/.env` 값 입력 완료
- `TWILIO_TWIML_URL` 외부 접근 가능
- `TWILIO_STATUS_CALLBACK_URL` 외부 접근 가능
- `TWILIO_MEDIA_STREAM_URL` 외부 접근 가능
- immediate call smoke 성공
- callback 상태 저장 성공
- media stream 연결 성공
