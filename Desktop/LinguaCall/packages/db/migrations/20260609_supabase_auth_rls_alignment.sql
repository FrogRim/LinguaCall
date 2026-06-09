-- Portfolio hardening: align the current Supabase Auth subject mapping with
-- the existing internal user table and add the session timestamp the API uses.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE sessions
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE sessions
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DROP POLICY IF EXISTS users_self ON users;
DROP POLICY IF EXISTS sessions_owner_read ON sessions;
DROP POLICY IF EXISTS reports_owner_read ON reports;
DROP POLICY IF EXISTS credit_ledger_owner_read ON credit_ledger;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  FOR ALL
  USING (
    clerk_user_id = auth.jwt()->>'sub'
    OR clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
  )
  WITH CHECK (
    clerk_user_id = auth.jwt()->>'sub'
    OR clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
  );

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_owner_read ON sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = sessions.user_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = sessions.user_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  );

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_owner_read ON reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = reports.session_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = reports.session_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  );

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_ledger_owner_read ON credit_ledger
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = credit_ledger.user_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = credit_ledger.user_id
        AND (
          users.clerk_user_id = auth.jwt()->>'sub'
          OR users.clerk_user_id = ('supabase:' || (auth.jwt()->>'sub'))
        )
    )
  );
