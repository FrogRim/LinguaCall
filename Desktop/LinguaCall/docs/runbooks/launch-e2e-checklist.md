# Launch E2E Checklist

This is the main end-to-end checklist for the current LinguaCall launch path.

## Related runbooks

- Deploy: [`vps-deploy.md`](./vps-deploy.md)
- Phone auth: [`supabase-phone-auth-manual.md`](./supabase-phone-auth-manual.md)
- Toss billing: [`toss-sandbox-manual.md`](./toss-sandbox-manual.md)

## Preconditions

Before running this checklist:

- `web`, `api`, `worker`, and `caddy` are running on the VPS
- `https://APP_DOMAIN` and `https://API_DOMAIN` are reachable
- Supabase Phone Auth is enabled
- Toss keys are configured
- OpenAI keys are configured

## 1. Platform health

### API

```bash
curl -i "https://API_DOMAIN/healthz"
```

Expected:

- HTTP `200`
- JSON response with `ok: true`

### Worker trigger

```bash
curl -i -X POST "https://API_DOMAIN/workers/run" -H "x-worker-token: YOUR_WORKER_SHARED_SECRET"
```

Expected:

- HTTP `200`

### App

```bash
curl -I "https://APP_DOMAIN"
```

Expected:

- HTTP `200`

## 2. Phone auth E2E

Use the detailed flow in [`supabase-phone-auth-manual.md`](./supabase-phone-auth-manual.md).

Verify:

1. Open `https://APP_DOMAIN/#/`
2. Continue to `/#/verify`
3. Enter a phone number
4. Request OTP
5. Enter the OTP
6. Land on `/#/session`
7. Refresh the browser
8. Confirm the user is still signed in
9. Log out
10. Confirm `/#/session` redirects back to login

Expected:

- OTP send succeeds
- OTP verify succeeds
- session persists across refresh
- logout clears access to protected pages

## 3. Billing E2E

Use the detailed flow in [`toss-sandbox-manual.md`](./toss-sandbox-manual.md).

Verify:

1. Sign in
2. Open `https://APP_DOMAIN/#/billing`
3. Select a plan
4. Start Toss checkout
5. Complete sandbox payment
6. Return to the billing page
7. Confirm subscription state updates

Expected API calls:

- `POST /billing/checkout`
- `POST /billing/toss/confirm`
- `GET /billing/subscription`

Expected:

- checkout starts
- confirm succeeds
- current plan updates without manual repair

## 4. Session creation

Verify:

1. Open `/#/session`
2. Create a new session
3. Refresh the page
4. Confirm the session appears in the list

Expected:

- session creation succeeds
- list reload still shows the session

## 5. Voice runtime

Verify:

1. Start a live session
2. Allow microphone access
3. Confirm connection succeeds
4. Speak briefly
5. Confirm the AI responds
6. End the call

Expected:

- no bootstrap error
- call can start
- call can end cleanly

## 6. Report generation

Verify:

1. Complete a session
2. Wait for worker processing
3. Open the report
4. Confirm score, summary, and corrections render

Expected:

- report becomes available without manual DB work

## 7. Browser checks

Verify these screens visually:

- `/`
- `/#/verify`
- `/#/session`
- `/#/billing`
- `/#/report/:id`
- `/#/privacy`
- `/#/terms`

Expected:

- no broken layout on desktop
- no broken layout on mobile
- no garbled strings
- no dead CTA

## 8. Failure triage

If something fails, check:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 api
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 web
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 worker
docker compose --env-file infra/.env.production -f infra/docker-compose.yml logs --tail=200 caddy
```

## 9. Go / No-Go

Go if all of these are true:

- health checks pass
- phone auth works
- billing works
- session creation works
- live voice works
- reports render
- protected routes stay protected

No-Go if any of these fail:

- login cannot complete
- billing cannot confirm
- live sessions cannot start or end
- reports never become available
