CREATE TABLE IF NOT EXISTS pending_billing_checkouts (
  order_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_billing_checkouts_clerk_user_id
ON pending_billing_checkouts(clerk_user_id, created_at DESC);
