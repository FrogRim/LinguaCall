# Supabase Demo Auth Manual

Use this runbook to verify the public portfolio login path.

## Current auth path

LinguaCall public visitors now use:

- Supabase Auth Anonymous Sign-Ins
- Supabase access and refresh session in the browser
- bearer token auth from `web` to `api`

Phone OTP code is preserved, but `/#/verify` redirects away in the public portfolio build.

## 1. Supabase dashboard setup

In the Supabase dashboard:

1. Open `Authentication > Sign In / Providers`
2. Enable `Anonymous Sign-Ins`
3. Open `Authentication > URL Configuration`
4. Set:

```text
Site URL: https://app.linguacall.shop
Redirect URLs: https://app.linguacall.shop/**
```

Review Auth rate limits before sharing the link broadly. Supabase anonymous sign-ins use the signup endpoint and are IP-limited; this is suitable for interviewer testing and a small portfolio demo, not unrestricted public traffic.

## 2. Required app env

The VPS env file must contain:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Use the low-cost portfolio OpenAI model profile:

```env
OPENAI_REALTIME_MODEL=gpt-realtime-mini
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_EVAL_MODEL=gpt-4.1-nano
```

Then rebuild:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.yml build --no-cache web api
docker compose --env-file infra/.env.production -f infra/docker-compose.yml up -d --force-recreate web api
```

## 3. Required migrations

Apply the portfolio demo limit migrations before opening the domain to interviewers:

```bash
psql $DATABASE_URL -f packages/db/migrations/20260510_appintoss_session_limits.sql
psql $DATABASE_URL -f packages/db/migrations/20260609_supabase_auth_rls_alignment.sql
```

The first migration sets the free plan to a 3-minute, 3-session demo profile. The second aligns Supabase Auth identities with the internal user mapping and secondary RLS guard.

## 4. Browser login flow

1. Open `https://app.linguacall.shop/#/`
2. Click `데모로 바로 체험하기`
3. Confirm the app lands on `/#/session`
4. Refresh the browser
5. Confirm the user is still signed in
6. Open `/#/verify` directly
7. Confirm the app redirects back to login instead of showing phone OTP

Expected:

- no phone number prompt
- no SMS or Twilio dependency
- protected pages work with the Supabase bearer token
- refresh-session recovery works on the same browser

## 5. Expected network pattern

The public demo login path should look like this:

1. `POST https://<supabase>/auth/v1/signup`
2. `GET /users/me` with `Authorization: Bearer <access token>`
3. `GET /billing/plans`
4. `GET /billing/subscription`

The old public phone OTP pattern should not appear in the visitor flow:

- `POST https://<supabase>/auth/v1/otp`
- `POST https://<supabase>/auth/v1/verify`

## 6. Failure triage

### Demo sign-in fails

Check:

- Anonymous Sign-Ins are enabled in Supabase
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- browser console/network for `/auth/v1/signup`
- Supabase Auth rate limits for the source IP

### Login succeeds but API returns 401

Check:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- API logs
- bearer token is present on protected API requests

### Session duration is not 3 minutes for free users

Check:

- `packages/db/migrations/20260510_appintoss_session_limits.sql` was applied
- `GET /billing/plans` returns the free plan with `maxSessionMinutes: 3`

