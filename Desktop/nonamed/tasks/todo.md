# Launch Readiness & Security Hardening Todo

## Phase 1 — Minimum deploy baseline
- [x] Task 1: frontend lint blocker 제거 및 auth bootstrap 상태 전환 정리
- [x] Task 2: backend scripts와 운영 문서 정합성 맞추기
- [x] Checkpoint: Baseline ready

## Phase 2 — Minimum launch hardening
- [x] Task 3: backend runtime logging을 structured logger로 통일
- [x] Task 4: backend 보안 헤더 추가 및 CORS 회귀 방지
- [x] Task 5: secret hygiene와 launch checklist 정리
- [x] Checkpoint: Minimum hardening ready

## Phase 3 — Auth and deploy correctness
- [x] Task 6: 서버 발급 세션 토큰 기반 인증으로 전환
- [x] Task 7: Prisma migration baseline 확립
- [x] Checkpoint: Security & deploy correctness ready

## Phase 4 — Final launch closure
- [x] Task 8: 앱인토스 검수 항목 닫기 및 실제 Toss TDS 교체
- [x] Task 9: npm audit remediation 및 residual risk 정리
- [x] Task 10: full pre-launch rehearsal 및 rollback runbook 고정
- [ ] Checkpoint: Launch candidate (manual production inputs + real App-in-Toss smoke test pending)
