ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS accuracy_policy JSONB,
  ADD COLUMN IF NOT EXISTS accuracy_state JSONB;
