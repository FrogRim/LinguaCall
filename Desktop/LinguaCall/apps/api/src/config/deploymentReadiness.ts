type ReadinessChecks = {
  databaseConfigured: boolean;
  openAiConfigured: boolean;
  clerkPublishableKeyConfigured: boolean;
  clerkSecretKeyConfigured: boolean;
  allowedOriginsConfigured: boolean;
  piiEncryptionKeyConfigured: boolean;
  sentryConfigured: boolean;
  tossConfigured: boolean;
  stripeConfigured: boolean;
  workerLoopEnabled: boolean;
};

export type DeploymentReadiness = {
  ready: boolean;
  mode: string;
  publicBaseUrl?: string;
  appBaseUrl?: string;
  apiBaseUrl?: string;
  checks: ReadinessChecks;
  blockingIssues: string[];
  warnings: string[];
};

const readEnv = (value?: string) => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const getHostname = (value?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
};

const isLocalHostname = (hostname?: string) => {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};

export const getDeploymentReadiness = (
  env: Record<string, string | undefined> = process.env
): DeploymentReadiness => {
  const mode = readEnv(env.NODE_ENV) ?? "development";
  const publicBaseUrl = readEnv(env.PUBLIC_BASE_URL);
  const appBaseUrl = readEnv(env.APP_BASE_URL);
  const apiBaseUrl = readEnv(env.API_BASE_URL);
  const publicHostname = getHostname(publicBaseUrl) ?? getHostname(appBaseUrl);

  const checks: ReadinessChecks = {
    databaseConfigured: Boolean(readEnv(env.DATABASE_URL)),
    openAiConfigured: Boolean(readEnv(env.OPENAI_API_KEY)),
    clerkPublishableKeyConfigured: Boolean(readEnv(env.CLERK_PUBLISHABLE_KEY)),
    clerkSecretKeyConfigured: Boolean(readEnv(env.CLERK_SECRET_KEY)),
    allowedOriginsConfigured: Boolean(readEnv(env.ALLOWED_ORIGINS)),
    piiEncryptionKeyConfigured: Boolean(readEnv(env.PII_ENCRYPTION_KEY)),
    sentryConfigured: Boolean(readEnv(env.SENTRY_DSN)),
    tossConfigured: Boolean(readEnv(env.TOSS_CLIENT_KEY) && readEnv(env.TOSS_SECRET_KEY)),
    stripeConfigured: Boolean(
      readEnv(env.STRIPE_SECRET_KEY) && readEnv(env.BILLING_WEBHOOK_SECRET_STRIPE)
    ),
    workerLoopEnabled: readEnv(env.ENABLE_WORKER_BATCH_LOOP) === "true"
  };

  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!checks.databaseConfigured) {
    blockingIssues.push("DATABASE_URL is not configured.");
  }
  if (!checks.openAiConfigured) {
    blockingIssues.push("OPENAI_API_KEY is not configured.");
  }
  if (!checks.clerkPublishableKeyConfigured) {
    blockingIssues.push("CLERK_PUBLISHABLE_KEY is not configured.");
  }
  if (!checks.clerkSecretKeyConfigured) {
    blockingIssues.push("CLERK_SECRET_KEY is not configured.");
  }
  if (!checks.piiEncryptionKeyConfigured) {
    blockingIssues.push("PII_ENCRYPTION_KEY is not configured. Phone number encryption will fail.");
  }
  if (mode === "production" && !checks.allowedOriginsConfigured) {
    blockingIssues.push("ALLOWED_ORIGINS must be configured in production.");
  }

  const publishableKey = readEnv(env.CLERK_PUBLISHABLE_KEY);
  if (
    publishableKey?.startsWith("pk_test_") &&
    publicHostname &&
    !isLocalHostname(publicHostname)
  ) {
    blockingIssues.push("Deployed Clerk OAuth is using a test publishable key on a non-local host.");
  }

  if (!checks.sentryConfigured) {
    warnings.push("Sentry DSN is not configured for the API.");
  }
  if (!checks.tossConfigured) {
    warnings.push("Toss Payments keys are not configured.");
  }
  if (!checks.stripeConfigured) {
    warnings.push("Stripe secret/webhook secret is not configured.");
  }
  if (!checks.workerLoopEnabled) {
    warnings.push("ENABLE_WORKER_BATCH_LOOP is disabled; scheduled jobs and notifications will not run.");
  }
  if (!publicBaseUrl) {
    warnings.push("PUBLIC_BASE_URL is not configured.");
  }
  if (!appBaseUrl) {
    warnings.push("APP_BASE_URL is not configured.");
  }
  if (!apiBaseUrl) {
    warnings.push("API_BASE_URL is not configured.");
  }

  return {
    ready: blockingIssues.length === 0,
    mode,
    publicBaseUrl,
    appBaseUrl,
    apiBaseUrl,
    checks,
    blockingIssues,
    warnings
  };
};
