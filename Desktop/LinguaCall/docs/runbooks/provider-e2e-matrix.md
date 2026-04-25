# Provider E2E 매트릭스

Last updated: 2026-04-25

## 목적

이 문서는 현재 LinguaCall 출시 후보에서 provider·host 결합 시나리오를 한눈에 검증하기 위한 매트릭스입니다.

현재 기준의 핵심 계약:

- auth: Supabase Phone OTP
- payment entry: Apps in Toss only
- payment completion sync: Toss webhook
- live voice: browser WebRTC → OpenAI Realtime

---

## 시나리오 매트릭스

| ID | 시나리오 | 환경 | 기대 UI | 기대 API / 이벤트 | 남겨야 할 증적 | 판정 |
|---|---|---|---|---|---|---|
| B1 | billing web mode | 일반 브라우저 | 플랜 비교/구독 상태만 보임, 유료 CTA 비활성, Apps in Toss 안내 문구 노출 | `GET /billing/plans`, `GET /billing/subscription`만 호출 | billing 화면 캡처, network 캡처 | blocking |
| B2 | billing Apps in Toss mode | Apps in Toss host + bridge | ready notice 노출, 유료 CTA 활성 | `POST /billing/apps-in-toss/payment-launch` 200 | launch payload 응답, host 화면 캡처 | blocking |
| B3 | billing unsupported host | host hint 있음, bridge 없음 | host unavailable notice 노출, dead end 없음 | launch API 미호출 | unsupported 화면 캡처 | blocking |
| B4 | legacy success return | 예전 success URL | success notice 노출, primary flow처럼 보이지 않음 | confirm API 미호출 | notice 화면, network 무호출 증적 | non-blocking |
| B5 | legacy cancel return | 예전 cancel URL | cancel notice 노출, Apps in Toss 재진입 문구 표시 | confirm API 미호출 | notice 화면, network 무호출 증적 | non-blocking |
| B6 | launch API validation failure | Apps in Toss host | 에러 배너 + 재시도/재진입 문구 | `POST /billing/apps-in-toss/payment-launch` 4xx | 응답 JSON, UI 캡처 | blocking |
| B7 | webhook success sync | Apps in Toss sandbox 결제 완료 | billing 상태 새로고침 후 구독 반영 | `POST /billing/webhooks/toss`, `GET /billing/subscription` | 최신 subscription 조회, billing 화면 | blocking |
| A1 | phone OTP success | 일반 브라우저 | `/verify` → `/session` 자연 이동 | Supabase OTP 성공, `/users/me` 접근 가능 | session 화면 캡처 | blocking |
| A2 | OTP wrong/expired | 일반 브라우저 | 이해 가능한 에러 문구, 재시도 가능 | auth 실패, 보호 경로 유지 | 에러 UI 캡처 | blocking |
| V1 | live voice success | 데스크톱/모바일 브라우저 | 연결, 발화, 종료 가능 | session create/bootstrap/runtime complete | 세션 상태, transcript/report 증적 | blocking |
| V2 | mic denied | 브라우저 | 치명적 붕괴 없이 실패 안내 | live start 실패 처리 | 실패 UI/로그 | blocking |
| R1 | report generation | worker 동작 환경 | 리포트 렌더링, 교정/요약 표시 | report 생성 관련 API/worker 처리 | report 화면 캡처 | blocking |

---

## 세부 확인 포인트

### B1. billing web mode
- `/#/billing`은 비교/상태 확인용 surface다.
- 일반 웹에서는 결제 시작 CTA가 활성화되면 안 된다.
- `POST /billing/checkout`, `POST /billing/toss/confirm`은 현재 primary path에서 나오면 안 된다.

### B2. billing Apps in Toss mode
- Apps in Toss host에서만 유료 CTA가 활성화된다.
- launch contract는 `provider`, `planCode`, `orderId`, `orderName`, `amount`, `successUrl`, `failUrl`, `customerKey`를 포함해야 한다.

### B3. unsupported host
- Toss에서 열린 것처럼 보이더라도 bridge가 없으면 unsupported 문구를 보여야 한다.
- 사용자가 다음 행동을 이해할 수 있어야 한다.

### B4/B5. legacy return
- 예전 success/cancel URL은 compatibility notice만 보여주는 보조 경로다.
- primary 결제 성공/실패 UX처럼 보이면 안 된다.

### B7. webhook success sync
- browser confirm이 아니라 webhook 반영이 현재 authoritative completion path다.
- `subscriptions`, `users.plan_code`, 필요 시 `credit_ledger`를 함께 확인한다.

---

## Go / No-Go

### Go
- B1, B2, B3, B6, B7, A1, A2, V1, V2, R1 모두 통과
- B4/B5는 실제 유입 시 notice 동작만 확인되면 충분

### No-Go
- 일반 웹 billing에서 결제를 직접 시작할 수 있음
- Apps in Toss host에서 launch API가 안정적으로 준비되지 않음
- webhook 반영 후 구독 상태가 일관되게 갱신되지 않음
- unsupported/legacy 상태에서 사용자가 다음 행동을 이해할 수 없음
- OTP, live voice, report 중 하나라도 blocking 수준으로 깨짐

---

## 최종 기록 템플릿

- 테스트 날짜:
- 배포 커밋 SHA:
- 테스트 환경:
- Apps in Toss 앱 버전:
- 브라우저 / 기기:
- 통과한 시나리오:
- 미해결 known issue:
- 최종 판단: `go` / `go with known issues` / `no-go`
