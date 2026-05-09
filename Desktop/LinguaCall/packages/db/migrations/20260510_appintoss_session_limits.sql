-- AppInToss 수익화 게이트: 월별 세션 한도 컬럼 + 플랜 데이터

-- plans 테이블에 월별 세션 한도 추가
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_session_limit INTEGER NOT NULL DEFAULT 0;

-- users 테이블에 월별 세션 사용량 추적 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_sessions_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_period_start DATE;

-- sessions 테이블에 월별 세션 예약 플래그 추가 (bootstrap 실패 시 환불 추적용)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS reserved_monthly_session BOOLEAN NOT NULL DEFAULT false;

-- free 플랜: 3분 × 평생 3회 (trial_calls 기반)
INSERT INTO plans (code, display_name, price_krw, included_minutes, trial_calls, max_session_minutes, monthly_session_limit, entitlements, active)
VALUES ('free', '무료 체험', 0, 0, 3, 3, 0, '[]', true)
ON CONFLICT (code) DO UPDATE SET
  display_name = '무료 체험',
  max_session_minutes = 3,
  trial_calls = 3,
  monthly_session_limit = 0,
  updated_at = NOW();

-- basic 플랜: 5분 × 10회/월 · ₩7,900
INSERT INTO plans (code, display_name, price_krw, included_minutes, trial_calls, max_session_minutes, monthly_session_limit, entitlements, active)
VALUES ('basic', 'Basic', 7900, 0, 0, 5, 10, '[]', true)
ON CONFLICT (code) DO UPDATE SET
  display_name = 'Basic',
  price_krw = 7900,
  included_minutes = 0,
  trial_calls = 0,
  max_session_minutes = 5,
  monthly_session_limit = 10,
  updated_at = NOW();

-- pro 플랜: 15분 × 12회/월 · ₩15,900
INSERT INTO plans (code, display_name, price_krw, included_minutes, trial_calls, max_session_minutes, monthly_session_limit, entitlements, active)
VALUES ('pro', 'Pro', 15900, 0, 0, 15, 12, '[]', true)
ON CONFLICT (code) DO UPDATE SET
  display_name = 'Pro',
  price_krw = 15900,
  included_minutes = 0,
  trial_calls = 0,
  max_session_minutes = 15,
  monthly_session_limit = 12,
  updated_at = NOW();
