import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_OAUTH_CALLBACK_PATH,
  AUTH_VERIFY_PATH,
  buildClerkSignInProps,
  isClerkOAuthCallbackSearch,
  shouldWarnAboutLimitedClerkOAuth
} from "./clerkAuth";

test("buildClerkSignInProps keeps auth redirects on the verify screen", () => {
  assert.deepEqual(buildClerkSignInProps(), {
    routing: "hash",
    forceRedirectUrl: AUTH_VERIFY_PATH,
    fallbackRedirectUrl: AUTH_VERIFY_PATH
  });
});

test("shouldWarnAboutLimitedClerkOAuth flags test keys on non-localhost deployments", () => {
  assert.equal(
    shouldWarnAboutLimitedClerkOAuth("pk_test_example", "linguacall.vercel.app"),
    true
  );
  assert.equal(
    shouldWarnAboutLimitedClerkOAuth("pk_test_example", "localhost"),
    false
  );
  assert.equal(
    shouldWarnAboutLimitedClerkOAuth("pk_live_example", "linguacall.vercel.app"),
    false
  );
  assert.equal(AUTH_OAUTH_CALLBACK_PATH, "/oauth-callback");
});

test("isClerkOAuthCallbackSearch detects OAuth callback query strings", () => {
  assert.equal(isClerkOAuthCallbackSearch("?state=test&code=oauth-code"), true);
  assert.equal(isClerkOAuthCallbackSearch("?state=test&error=access_denied"), true);
  assert.equal(isClerkOAuthCallbackSearch("?redirect_url=%2Fverify"), false);
  assert.equal(isClerkOAuthCallbackSearch(""), false);
});
