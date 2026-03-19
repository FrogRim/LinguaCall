ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  FOR ALL
  USING (clerk_user_id = auth.jwt()->>'sub');

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_owner_read ON sessions
  FOR ALL
  USING (user_id::text = auth.jwt()->>'sub');

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_owner_read ON reports
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id::text = auth.jwt()->>'sub'
    )
  );

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_ledger_owner_read ON credit_ledger
  FOR ALL
  USING (user_id::text = auth.jwt()->>'sub');
