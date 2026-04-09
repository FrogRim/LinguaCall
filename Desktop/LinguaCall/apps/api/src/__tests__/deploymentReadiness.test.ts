import { describe, expect, it } from "vitest";

import { getDeploymentReadiness } from "../config/deploymentReadiness";

describe("getDeploymentReadiness", () => {
  it("treats localhost development with test Clerk keys as non-blocking", () => {
    const readiness = getDeploymentReadiness({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://example",
      OPENAI_API_KEY: "sk-proj-test",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      PII_ENCRYPTION_KEY: "test-pii-key-32-bytes-long-enough",
      PUBLIC_BASE_URL: "http://localhost:5173",
      APP_BASE_URL: "http://localhost:5173",
      API_BASE_URL: "http://localhost:4000"
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockingIssues).toEqual([]);
  });

  it("flags deployed OAuth when a test Clerk key is used on a non-local host", () => {
    const readiness = getDeploymentReadiness({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      OPENAI_API_KEY: "sk-proj-test",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      PUBLIC_BASE_URL: "https://linguacall.vercel.app",
      APP_BASE_URL: "https://linguacall.vercel.app",
      API_BASE_URL: "https://linguacall-api.up.railway.app",
      ALLOWED_ORIGINS: "https://linguacall.vercel.app"
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockingIssues).toContain(
      "Deployed Clerk OAuth is using a test publishable key on a non-local host."
    );
  });

  it("flags missing production CORS allowlist", () => {
    const readiness = getDeploymentReadiness({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      OPENAI_API_KEY: "sk-proj-test",
      CLERK_PUBLISHABLE_KEY: "pk_live_example",
      CLERK_SECRET_KEY: "sk_live_example",
      PUBLIC_BASE_URL: "https://linguacall.example.com",
      APP_BASE_URL: "https://linguacall.example.com",
      API_BASE_URL: "https://linguacall-api.up.railway.app"
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockingIssues).toContain(
      "ALLOWED_ORIGINS must be configured in production."
    );
  });

  it("surfaces optional integration warnings without blocking readiness", () => {
    const readiness = getDeploymentReadiness({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      OPENAI_API_KEY: "sk-proj-test",
      CLERK_PUBLISHABLE_KEY: "pk_live_example",
      CLERK_SECRET_KEY: "sk_live_example",
      PII_ENCRYPTION_KEY: "test-pii-key-32-bytes-long-enough",
      PUBLIC_BASE_URL: "https://linguacall.example.com",
      APP_BASE_URL: "https://linguacall.example.com",
      API_BASE_URL: "https://linguacall-api.up.railway.app",
      ALLOWED_ORIGINS: "https://linguacall.example.com",
      ENABLE_WORKER_BATCH_LOOP: "true"
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.warnings).toContain("Sentry DSN is not configured for the API.");
    expect(readiness.warnings).toContain("Toss Payments keys are not configured.");
    expect(readiness.warnings).toContain("Stripe secret/webhook secret is not configured.");
  });
});
