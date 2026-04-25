# Toss Sandbox 검증 매뉴얼

이 문서는 **배포된 web·api**에서 현재 LinguaCall의 **Apps in Toss 전용 결제 진입**을 검증할 때 쓰는 보조 런북입니다.

메인 순서는 [launch-e2e-checklist.md](./launch-e2e-checklist.md) **§3 결제 E2E**를 따릅니다.

---

## 범위

포함:

- 일반 웹 브라우저에서 `/#/billing`이 **안내/상태 확인 전용**으로 보이는지
- Apps in Toss 호스트에서 `POST /billing/apps-in-toss/payment-launch`가 호출되는지
- 인앱 결제 완료 후 Toss webhook으로 구독 상태가 갱신되는지
- legacy success/cancel 복귀 링크가 더 이상 primary checkout처럼 보이지 않는지
- host hint는 있으나 bridge가 없는 환경에서 복구 안내가 명확한지

제외:

- 일반 브라우저의 Toss SDK popup/redirect checkout
- `POST /billing/toss/confirm` 브라우저 복귀 confirm 플로우

현재 코드 기준 참고:

- web checkout 시작: `POST /billing/checkout` → **403 forbidden**
- web confirm: `POST /billing/toss/confirm` → **403 forbidden**
- Apps in Toss host 검증: `POST /billing/apps-in-toss/verify-session`
- in-app payment launch 준비: `POST /billing/apps-in-toss/payment-launch`
- 결제 완료 반영: `POST /billing/webhooks/toss`

---

## 사전 준비

- `https://APP_DOMAIN`, `https://API_DOMAIN` 모두 TLS 정상
- Apps in Toss 진입 경로 또는 호스트 QA 환경 준비
- `infra/.env.production`:
  - API: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` → 샌드박스 키
  - web: Apps in Toss host에서 로드 가능한 최신 번들 배포 완료
- [launch-e2e-checklist.md](./launch-e2e-checklist.md) §2까지 완료
- DB `plans` 테이블에 활성 유료 플랜이 1개 이상 존재

```sql
select code, display_name, price_krw, active
from plans
where active = true;
```

---

## 1. 일반 웹 브라우저 모드 확인

1. `https://APP_DOMAIN/#/billing` 열기
2. DevTools → Network → `billing` 필터
3. 아래 요청이 200인지 확인
   - `GET /billing/plans`
   - `GET /billing/subscription`
4. 유료 플랜 CTA가 비활성인지 확인
5. `Apps in Toss 안에서만 진행` 계열 안내 문구 확인

### 기대 결과

- 일반 웹에서는 `POST /billing/apps-in-toss/payment-launch`가 발생하지 않음
- `POST /billing/checkout` / `POST /billing/toss/confirm`도 발생하지 않음
- dead CTA 없이 Apps in Toss 진입 필요성이 명확히 보임

---

## 2. Apps in Toss 호스트 모드 확인

1. Apps in Toss 내부 진입 경로로 `/#/billing` 열기
2. 상단 ready notice 확인
3. DevTools 또는 네트워크 프록시에서 아래 흐름 확인
4. 유료 플랜 CTA 클릭

### 기대 결과

- `POST /billing/apps-in-toss/verify-session` → 200
- `POST /billing/apps-in-toss/payment-launch` → 200
- 응답 `data`에 대략 아래 필드 포함
  - `provider`
  - `planCode`
  - `orderId`
  - `orderName`
  - `amount`
  - `successUrl`
  - `failUrl`
  - `customerKey`
- 이후 Apps in Toss bridge가 인앱 결제 화면으로 handoff

### launch 준비 API 실패 시

- 응답 JSON의 `error.message` 확인
- API 로그 확인
- `plans` 테이블, 사용자 현재 구독 상태 점검

---

## 3. Sandbox 결제 진행

1. Toss 개발자 문서의 최신 샌드박스 수단으로 승인
2. 결제 완료까지 진행
3. 앱이 다시 billing surface로 돌아오거나 구독 상태를 새로고침할 수 있는지 확인

### 기대 결과

- primary 성공 경로는 webhook 반영 기준
- 브라우저 confirm 호출 없이도 구독 상태가 갱신됨
- billing 화면의 현재 플랜/상태가 새로고침 후 일치함

### 참고

legacy `checkout=success|cancel` URL이 열릴 수는 있지만, 이는 compatibility notice를 보여주는 보조 경로로만 남아 있어야 합니다.

---

## 4. 결과 확인

### 4.1 Network

- `POST /billing/apps-in-toss/verify-session` — 200
- `POST /billing/apps-in-toss/payment-launch` — 200
- `POST /billing/webhooks/toss` — provider 측 성공 반영
- `GET /billing/subscription` — 갱신된 플랜/상태 확인

### 4.2 UI

- Apps in Toss host에서는 CTA가 활성화됨
- 일반 웹에서는 CTA가 비활성 + 안내 문구 표시
- 에러/unsupported 상태에서 다음 행동이 문구로 명확함

### 4.3 응답 저장

- `POST /billing/apps-in-toss/payment-launch` 응답 JSON
- webhook 성공 증적 또는 최신 subscription 조회 결과
- 구독 반영 후 billing 화면 캡처

---

## 5. DB 확인 (Supabase SQL)

### 5.1 구독

```sql
select provider, plan_code, status, provider_subscription_id, updated_at
from subscriptions
order by updated_at desc
limit 10;
```

### 5.2 사용자 플랜·잔여 분

```sql
select id, plan_code, paid_minutes_balance, updated_at
from users
order by updated_at desc
limit 10;
```

### 5.3 크레딧 원장

```sql
select user_id, unit_type, entry_kind, delta, reason, created_at
from credit_ledger
order by created_at desc
limit 20;
```

---

## 6. 실패 시 분기

### 일반 웹에서 결제 진입을 시도하고 싶어지는 경우

- 기대 동작은 차단이다
- `/#/billing`은 비교/상태 확인용이고 Apps in Toss 진입을 안내해야 한다

### host hint는 있지만 bridge가 없는 경우

- `hostUnavailableNotice` 계열 문구가 보여야 함
- 사용자는 최신 Apps in Toss 진입 경로에서 다시 열어야 함

### launch 준비 API는 성공했지만 상태가 안 바뀌는 경우

- webhook 반영 여부 확인
- `subscriptions`, `users.plan_code` 직접 조회
- webhook 서명 설정(`BILLING_WEBHOOK_SECRET*`) 점검

### legacy success/cancel 복귀가 열리는 경우

- success/cancel별 notice만 보이고 primary 결제 경로처럼 보이지 않아야 함
- 사용자를 다시 Apps in Toss billing으로 유도해야 함

---

## 7. 운영 전환 시 알림

- 샌드박스에서 여러 번 성공한 뒤 `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`를 live 값으로 교체
- 키 변경 후 API 재시작과 최신 web 번들 반영 필요
- live 전환 뒤에는 Apps in Toss 내부에서 소액 실결제 1건으로 launch → webhook → 구독 반영까지 다시 확인

---

## 8. 남겨야 할 증적

- 일반 웹 `/#/billing` 화면
- Apps in Toss host `/#/billing` 화면
- `POST /billing/apps-in-toss/payment-launch` 응답
- webhook 반영 후 billing 화면 또는 subscription 조회 결과
- legacy success/cancel notice 화면 (해당 시)

[launch-e2e-checklist.md](./launch-e2e-checklist.md)와 함께 보관합니다.
