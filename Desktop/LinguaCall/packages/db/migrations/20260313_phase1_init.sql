CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone_encrypted TEXT,
  phone_last4 TEXT,
  phone_e164_hash TEXT UNIQUE,
  phone_country_code TEXT DEFAULT '+82',
  phone_verified BOOLEAN DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  plan_code TEXT DEFAULT 'free',
  trial_calls_remaining INTEGER DEFAULT 3,
  paid_minutes_balance INTEGER DEFAULT 0,
  native_lang TEXT DEFAULT 'ko',
  notification_kakao BOOLEAN DEFAULT true,
  notification_email BOOLEAN DEFAULT false,
  streak_days INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  status_detail TEXT,
  contact_mode TEXT NOT NULL DEFAULT 'immediate',
  language TEXT NOT NULL,
  exam TEXT NOT NULL,
  level TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_target_minutes INTEGER NOT NULL,
  timezone TEXT DEFAULT 'Asia/Seoul',
  scheduled_for_at_utc TIMESTAMPTZ,
  dispatch_deadline_at_utc TIMESTAMPTZ,
  reminder_at_utc TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_version TEXT,
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_call_sid TEXT,
  reserved_trial_call BOOLEAN DEFAULT false,
  reserved_minutes INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  report_status TEXT DEFAULT 'not_requested',
  failure_reason TEXT,
  last_provider_sequence_number INTEGER DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp_ms BIGINT,
  is_final BOOLEAN DEFAULT true,
  stt_confidence NUMERIC,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  grammar_score INTEGER,
  vocabulary_score INTEGER,
  fluency_score INTEGER,
  topic_score INTEGER,
  total_score INTEGER,
  level_assessment TEXT,
  score_delta INTEGER,
  grammar_corrections JSONB,
  vocabulary_analysis JSONB,
  fluency_metrics JSONB,
  scoring_version TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  summary_text TEXT,
  recommendations JSONB,
  storage_path TEXT,
  kakao_status TEXT,
  kakao_sent_at TIMESTAMPTZ,
  email_status TEXT,
  email_sent_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  attempt_count INTEGER DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekdays INTEGER[] NOT NULL,
  local_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  session_config JSONB NOT NULL,
  next_run_at_utc TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  entry_kind TEXT NOT NULL,
  delta INTEGER NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_krw INTEGER NOT NULL,
  included_minutes INTEGER NOT NULL DEFAULT 0,
  trial_calls INTEGER NOT NULL DEFAULT 0,
  max_session_minutes INTEGER NOT NULL DEFAULT 10,
  entitlements JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT UNIQUE NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_user
ON sessions(user_id)
WHERE status IN ('dialing', 'ringing', 'in_progress', 'ending');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_upcoming_scheduled_session_per_user
ON sessions(user_id)
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at
ON sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_session_sequence
ON messages(session_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_sessions_reminder
ON sessions(reminder_at_utc)
WHERE status = 'scheduled' AND reminder_sent = false;

CREATE INDEX IF NOT EXISTS idx_sessions_provider_sequence
ON sessions(provider_call_sid, last_provider_sequence_number);
