import assert from "node:assert/strict";
import test from "node:test";
import { HostBridgeError, canLaunchAppsInTossPayment, launchAppsInTossPayment, requestAppsInTossLogin } from "./hostBridge";
import type { HostRuntime } from "./hostRuntime";

const webRuntime: HostRuntime = {
  platform: "web",
  hasBridge: false,
  bridge: null
};

test("canLaunchAppsInTossPayment returns false on web", () => {
  assert.equal(canLaunchAppsInTossPayment(webRuntime), false);
});

test("launchAppsInTossPayment throws host_unavailable outside Apps in Toss", async () => {
  await assert.rejects(
    () => launchAppsInTossPayment({ orderId: "order_1" }, webRuntime),
    (error: unknown) => {
      assert.ok(error instanceof HostBridgeError);
      assert.equal(error.code, "host_unavailable");
      return true;
    }
  );
});

test("requestAppsInTossLogin throws login_not_supported when appLogin is unavailable", async () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {}
  };

  await assert.rejects(
    () => requestAppsInTossLogin(runtime),
    (error: unknown) => {
      assert.ok(error instanceof HostBridgeError);
      assert.equal(error.code, "login_not_supported");
      return true;
    }
  );
});

test("launchAppsInTossPayment throws payment_not_supported when makePayment is unavailable", async () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {}
  };

  await assert.rejects(
    () => launchAppsInTossPayment({ orderId: "order_1" }, runtime),
    (error: unknown) => {
      assert.ok(error instanceof HostBridgeError);
      assert.equal(error.code, "payment_not_supported");
      return true;
    }
  );
});

test("requestAppsInTossLogin delegates to the Apps in Toss bridge", async () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      appLogin: async () => ({ authorizationCode: "auth_code_123", referrer: "tossapp://miniapp" })
    }
  };

  const result = await requestAppsInTossLogin<{ authorizationCode: string; referrer: string }>(runtime);

  assert.deepEqual(result, { authorizationCode: "auth_code_123", referrer: "tossapp://miniapp" });
});

test("launchAppsInTossPayment delegates to the Apps in Toss bridge", async () => {
  const calls: unknown[] = [];
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      makePayment: async (payload) => {
        calls.push(payload);
        return { ok: true };
      }
    }
  };

  const result = await launchAppsInTossPayment({ orderId: "order_1", amount: 9900 }, runtime);

  assert.deepEqual(calls, [{ orderId: "order_1", amount: 9900 }]);
  assert.deepEqual(result, { ok: true });
});

test("launchAppsInTossPayment wraps bridge failures", async () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      makePayment: async () => {
        throw new Error("bridge exploded");
      }
    }
  };

  await assert.rejects(
    () => launchAppsInTossPayment({ orderId: "order_1" }, runtime),
    (error: unknown) => {
      assert.ok(error instanceof HostBridgeError);
      assert.equal(error.code, "payment_launch_failed");
      assert.match(error.message, /bridge exploded/);
      return true;
    }
  );
});
