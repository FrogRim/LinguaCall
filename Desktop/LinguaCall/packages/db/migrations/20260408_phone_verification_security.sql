ALTER TABLE phone_verifications
  ADD COLUMN IF NOT EXISTS code_hash TEXT;

ALTER TABLE phone_verifications
  ALTER COLUMN code DROP NOT NULL;
