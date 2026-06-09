import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupabaseSession } from "./supabaseAuth";

test("normalizeSupabaseSession accepts flat Supabase session payloads", () => {
  const session = normalizeSupabaseSession({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    user: {
      id: "user-1",
      phone: null,
      email: null,
      is_anonymous: true
    }
  });

  assert.equal(session.accessToken, "access-token");
  assert.equal(session.refreshToken, "refresh-token");
  assert.equal(session.user.id, "user-1");
  assert.equal(session.user.is_anonymous, true);
  assert.equal(typeof session.expiresAt, "number");
});

test("normalizeSupabaseSession accepts nested anonymous sign-in payloads", () => {
  const session = normalizeSupabaseSession({
    session: {
      access_token: "nested-access-token",
      refresh_token: "nested-refresh-token",
      expires_at: 1_800_000_000,
      user: {
        id: "anonymous-user-1",
        is_anonymous: true
      }
    },
    user: {
      id: "anonymous-user-1",
      is_anonymous: true
    }
  });

  assert.deepEqual(session, {
    accessToken: "nested-access-token",
    refreshToken: "nested-refresh-token",
    expiresAt: 1_800_000_000,
    user: {
      id: "anonymous-user-1",
      is_anonymous: true
    }
  });
});

test("normalizeSupabaseSession rejects incomplete payloads", () => {
  assert.throws(
    () => normalizeSupabaseSession({ user: { id: "user-1" } }),
    /supabase_session_missing_fields/
  );
});
