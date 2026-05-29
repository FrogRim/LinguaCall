# LinguaCall

실시간 AI 회화 연습을 위한 WebRTC 기반 언어 학습 MVP입니다. 브라우저가 OpenAI Realtime API에 직접 연결되고, API 서버와 worker는 인증, 세션, 결제, 리포트 생성 흐름을 담당합니다.

> Portfolio position: realtime AI product engineering, browser voice UX, launch-oriented backend/worker/deploy pipeline.

## Problem

언어 시험 준비자는 실제 대화처럼 말하고 즉시 피드백을 받아야 하지만, 일반 채팅형 학습 도구는 음성 턴 제어, 실시간성, 교정 리포트, 단어 확인 흐름이 분리되어 있습니다. LinguaCall은 브라우저 음성 대화와 학습 리포트를 한 제품 흐름으로 묶는 것을 목표로 했습니다.

## What I Built

- Browser-direct OpenAI Realtime voice session over WebRTC
- Push-to-Talk 기반 음성 입력 제어
- Supabase Auth phone OTP 기반 로그인과 bearer-token API auth
- Supabase Postgres 기반 세션/리포트 데이터 저장
- Toss sandbox billing path
- API process와 분리된 async report worker
- 문법 교정 highlight, 단어 dictionary popover, session delete UX
- VPS self-hosted deployment path: `web + api + worker + caddy`

## My Role

개인 프로젝트로 프론트엔드, 백엔드, 인증, worker, 배포 구조를 단독 설계하고 구현했습니다. 초기 SaaS-heavy 구조를 걷어내고, 한국 시장 MVP에 필요한 Supabase/Toss/VPS 중심 launch stack으로 단순화했습니다.

## Stack

| Area | Stack |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Realtime voice | WebRTC, OpenAI Realtime API |
| Backend | Node.js, TypeScript, API server, worker process |
| Auth/Data | Supabase Auth, Supabase Postgres |
| Deploy | Docker Compose, Caddy, VPS |
| Billing | Toss sandbox flow |

## Repository Map

현재 실제 앱 코드는 `Desktop/LinguaCall/` 아래에 있습니다. 루트 README는 포트폴리오 진입점으로 정리했고, 상세 launch/runbook 문서는 하위 폴더 문서를 기준으로 봅니다.

```text
Desktop/LinguaCall/
  apps/       web, api, worker
  packages/   shared packages
  infra/      Docker/Caddy/deploy configuration
  docs/       product and engineering notes
  scripts/    launch smoke and validation scripts
```

## Run Locally

```bash
cd Desktop/LinguaCall
pnpm install
pnpm dev
```

Production-style checks and deployment helpers:

```bash
cd Desktop/LinguaCall
pnpm lint
pnpm typecheck
pnpm build
pnpm launch:env:check
pnpm launch:smoke
pnpm compose:config
```

Environment values are intentionally not committed. Use local `.env` / deployment secrets only.

## Validation Evidence

| Evidence | Result |
| --- | --- |
| Realtime voice path | Browser WebRTC session bootstrapping with PTT mode |
| Auth | Supabase phone OTP and refresh-session recovery path |
| Worker architecture | Report processing moved out of API process |
| Learning UX | Grammar correction highlight and dictionary popover |
| Deploy path | VPS Docker Compose stack with Caddy HTTPS |
| Scope reduction | Clerk, Stripe, Railway, Vercel, Naver SMS, SOLAPI, Sentry removed from active launch path |

## Demo / Screenshots

공개 가능한 데모 영상이나 스크린샷을 추가할 때 이 섹션에 배치합니다. 현재 README는 공개 가능한 아키텍처와 실행/검증 정보만 포함합니다.

## Status

MVP launch path is ready for real-user testing and hardening. Remaining work is product iteration, monitoring, and production launch validation.
