# Supabase Phone Auth Manual

Use this runbook to verify the current LinguaCall login path.

## Current auth path

LinguaCall now uses:

- Supabase Auth phone OTP
- Supabase access and refresh session in the browser
- bearer token auth from `web` to `api`

The app no longer relies on the old `/auth/otp/*` API routes for the active login flow.

## 1. Supabase dashboard setup

Go to:

- `Authentication > Providers > Phone`

Do one of these:

### Option A. Test mode

Use `Test Phone Numbers and OTPs`.

Example:

```text
+821012345678:123456
```

This lets you test login without real SMS delivery.

### Option B. Real SMS

Configure Twilio in the Supabase dashboard.

Required values:

- `Twilio Account SID`
- `Twilio Auth Token`
- `Twilio Message Service SID`

Then go to:

- `Authentication > URL Configuration`

Set:

```text
Site URL: https://app.linguacall.shop
Redirect URLs: https://app.linguacall.shop/**
```

## 2. Required app env

The VPS env file must contain:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Then rebuild:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.yml build --no-cache web api
docker compose --env-file infra/.env.production -f infra/docker-compose.yml up -d --force-recreate web api
```

## 3. Browser login flow

1. Open `https://app.linguacall.shop/#/`
2. Move to the verify page
3. Enter the phone number
4. Request OTP
5. Enter the OTP
6. Confirm the app lands on `/#/session`

## 4. Session persistence checks

After login:

1. Refresh the browser
2. Reopen the app in the same browser
3. Confirm the user is still signed in
4. Open a protected page such as `/#/billing`

Expected:

- no OTP prompt on every refresh
- protected routes keep working while the Supabase session is valid

## 5. Logout checks

1. Click logout
2. Try opening `/#/session`

Expected:

- app redirects back to login

## 6. Failure triage

### OTP request fails

Check:

- Supabase Phone provider is enabled
- test phone number or Twilio is configured
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### OTP verify fails

Check:

- test OTP matches the configured code
- Twilio is delivering SMS if using real SMS
- browser console/network for `/auth/v1/verify`

### Login succeeds but API returns 401

Check:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- API logs
- bearer token is present on protected API requests

## 7. Expected network pattern

The active web login path should look like this:

1. `POST https://<supabase>/auth/v1/otp`
2. `POST https://<supabase>/auth/v1/verify`
3. `GET /users/me` with `Authorization: Bearer <access token>`

The old pattern:

- `POST /auth/otp/start`
- `POST /auth/otp/verify`
- `POST /auth/refresh`

is no longer the active path.
