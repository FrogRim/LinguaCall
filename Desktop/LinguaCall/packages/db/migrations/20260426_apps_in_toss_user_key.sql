ALTER TABLE users
ADD COLUMN IF NOT EXISTS apps_in_toss_user_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_apps_in_toss_user_key
ON users(apps_in_toss_user_key)
WHERE apps_in_toss_user_key IS NOT NULL;
