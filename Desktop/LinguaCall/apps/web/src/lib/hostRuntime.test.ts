import assert from "node:assert/strict";
import test from "node:test";
import { detectHostRuntime } from "./hostRuntime";

test("detectHostRuntime returns web for a regular browser", () => {
  const runtime = detectHostRuntime({
    navigator: { userAgent: "Mozilla/5.0 Chrome/123.0" }
  });

  assert.equal(runtime.platform, "web");
  assert.equal(runtime.hasBridge, false);
});

test("detectHostRuntime returns apps-in-toss when the explicit host override is set", () => {
  const runtime = detectHostRuntime({
    navigator: { userAgent: "Mozilla/5.0 Chrome/123.0" },
    __LINGUACALL_HOST__: "apps-in-toss"
  });

  assert.equal(runtime.platform, "apps-in-toss");
  assert.equal(runtime.hasBridge, false);
});

test("detectHostRuntime returns apps-in-toss when a known bridge object exists", () => {
  const runtime = detectHostRuntime({
    navigator: { userAgent: "Mozilla/5.0 Chrome/123.0" },
    AppsInToss: {
      makePayment: async () => undefined
    }
  });

  assert.equal(runtime.platform, "apps-in-toss");
  assert.equal(runtime.hasBridge, true);
});

test("detectHostRuntime returns unknown when the Toss host is hinted but no bridge is available", () => {
  const runtime = detectHostRuntime({
    navigator: { userAgent: "Mozilla/5.0 TossAndroidWebView/1.0" }
  });

  assert.equal(runtime.platform, "unknown");
  assert.equal(runtime.hasBridge, false);
});
