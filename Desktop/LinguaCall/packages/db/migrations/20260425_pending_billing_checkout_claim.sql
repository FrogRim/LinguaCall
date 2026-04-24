ALTER TABLE pending_billing_checkouts
ADD COLUMN IF NOT EXISTS confirmation_token TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_billing_checkouts_confirmation_token
ON pending_billing_checkouts(confirmation_token)
WHERE confirmation_token IS NOT NULL;
