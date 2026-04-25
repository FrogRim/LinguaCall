export const AUTH_VERIFY_PATH = "/verify";
export const AUTH_OAUTH_CALLBACK_PATH = "/oauth-callback";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const buildClerkSignInProps = () => ({
  routing: "hash" as const,
  forceRedirectUrl: AUTH_VERIFY_PATH,
  fallbackRedirectUrl: AUTH_VERIFY_PATH
});

export const shouldWarnAboutLimitedClerkOAuth = (
  publishableKey: string | undefined,
  hostname: string | undefined
) => {
  const normalizedHost = (hostname ?? "").trim().toLowerCase();
  return Boolean(
    publishableKey?.startsWith("pk_test_") &&
    normalizedHost &&
    !LOCAL_HOSTS.has(normalizedHost)
  );
};

export const isClerkOAuthCallbackSearch = (search: string) => {
  const params = new URLSearchParams(search);
  if (!params.get("state")) {
    return false;
  }

  return params.has("code") || params.has("error");
};
