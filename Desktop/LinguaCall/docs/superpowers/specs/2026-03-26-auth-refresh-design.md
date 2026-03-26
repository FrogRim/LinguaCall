# Auth Refresh Design

**Goal**

Reduce repeated SMS OTP prompts by keeping users signed in on the same device for up to 30 days.

**Problem**

The current auth flow issues both access and refresh cookies, but only the access cookie is used. Once the one-hour access cookie expires, every protected request returns `401`, forcing users back through SMS OTP even though a 30-day refresh token already exists.

**Recommended Approach**

Keep the current SOLAPI OTP login as the first-factor entry point and add refresh-session support on top of it.

- OTP remains the first login and fallback recovery path.
- `lc_access` stays short-lived.
- `lc_refresh` becomes the long-lived device session cookie.
- The API rotates refresh sessions and reissues cookies through `/auth/refresh`.
- The web client retries one failed `401` request after a refresh attempt.
- App boot attempts refresh before declaring the user logged out.

**API Changes**

- Extend the auth repository with:
  - `findAuthSessionByRefreshTokenHash`
  - `rotateAuthSessionRefreshToken`
  - `revokeAuthSessionByRefreshTokenHash`
- Extend the auth service with:
  - `refreshSession(refreshToken, userAgent, ip)`
  - `logout(refreshToken?)`
- Add `POST /auth/refresh`
  - Reads `lc_refresh`
  - Verifies the hashed refresh token against a non-revoked, non-expired `auth_sessions` row
  - Rotates refresh token and reissues both cookies
- Update `POST /auth/logout`
  - Revoke current refresh session when cookie is present
  - Always clear cookies

**Web Changes**

- Upgrade `apiClient()` to:
  - retry once on `401`
  - call `/auth/refresh`
  - repeat the original request if refresh succeeds
- Upgrade `UserContext.refreshSession()` to:
  - attempt `/auth/refresh`
  - then read `/auth/me`
  - mark logged out only if refresh and `/auth/me` both fail

**Security**

- 30-day refresh cookie remains `httpOnly`, `secure`, `sameSite=lax`
- Refresh rotation is required so stolen old refresh tokens stop working after reuse
- Logout revokes the stored refresh session server-side instead of just clearing browser cookies

**Expected UX**

- First login still uses SMS OTP
- Returning users usually open the app already authenticated
- Expired access cookies recover silently
- Users only see OTP again after refresh expiry, logout, or revoked sessions
