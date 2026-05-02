import assert from "node:assert/strict";
import test from "node:test";
import { HostBridgeError } from "../../lib/hostBridge";
import type { HostRuntime } from "../../lib/hostRuntime";
import { getFriendlyCopy } from "../../content/friendlyCopy";
import {
  buildBillingReturnUrl,
  createCheckoutPayload,
  createTossPaymentRequest,
  readBillingReturnState,
  readTossRedirectParams,
  resolveBillingLaunch,
  resolveWebBillingLaunch,
  startAppsInTossBillingLaunch
} from "./checkout";

test("buildBillingReturnUrl omits provider query params for toss-only flow", () => {
  const url = buildBillingReturnUrl(
    "https://linguacall.app/",
    "success",
    "basic"
  );

  assert.equal(
    url,
    "https://linguacall.app/#/billing?checkout=success&plan=basic"
  );
});

test("createCheckoutPayload sends a provider-free billing checkout request", () => {
  const payload = createCheckoutPayload(
    "https://linguacall.app/",
    "pro"
  );

  assert.deepEqual(payload, {
    planCode: "pro",
    returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=pro",
    cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=pro"
  });
  assert.equal("provider" in payload, false);
});

test("readTossRedirectParams extracts Toss success query params from the URL search", () => {
  const redirect = readTossRedirectParams(
    "https://linguacall.app/?paymentKey=pay_123&orderId=order_456&amount=9900#/billing?checkout=success&plan=basic"
  );

  assert.deepEqual(redirect, {
    paymentKey: "pay_123",
    orderId: "order_456",
    amount: 9900
  });
});

test("readBillingReturnState keeps both Toss redirect params and billing hash params for confirm flow", () => {
  const state = readBillingReturnState(
    "https://linguacall.app/?paymentKey=pay_123&orderId=order_456&amount=9900#/billing?checkout=success&plan=basic"
  );

  assert.deepEqual(state, {
    checkoutResult: "success",
    checkoutPlan: "basic",
    tossRedirect: {
      paymentKey: "pay_123",
      orderId: "order_456",
      amount: 9900
    },
    shouldConfirm: true,
    hasLegacyReturn: true,
    channel: "web"
  });
});

test("readBillingReturnState does not request confirm on cancelled return", () => {
  const state = readBillingReturnState(
    "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
  );

  assert.deepEqual(state, {
    checkoutResult: "cancel",
    checkoutPlan: "basic",
    tossRedirect: null,
    shouldConfirm: false,
    hasLegacyReturn: true,
    channel: "appintoss"
  });
});

test("readBillingReturnState marks direct Toss redirect params as a legacy web return", () => {
  const state = readBillingReturnState(
    "https://linguacall.app/?paymentKey=pay_123&orderId=order_456&amount=9900#/billing"
  );

  assert.equal(state.hasLegacyReturn, true);
  assert.equal(state.checkoutResult, null);
  assert.deepEqual(state.tossRedirect, {
    paymentKey: "pay_123",
    orderId: "order_456",
    amount: 9900
  });
});

test("createTossPaymentRequest builds a redirect-based card payment request", () => {
  const request = createTossPaymentRequest({
    planCode: "basic",
    orderId: "order_123",
    orderName: "Basic Plan",
    amount: 9900,
    successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
    failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
    customerEmail: "user@example.com",
    customerName: "Lingua User"
  });

  assert.deepEqual(request, {
    method: "CARD",
    amount: {
      currency: "KRW",
      value: 9900
    },
    orderId: "order_123",
    orderName: "Basic Plan",
    successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
    failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
    customerEmail: "user@example.com",
    customerName: "Lingua User",
    metadata: {
      planCode: "basic"
    }
  });
});

test("startAppsInTossBillingLaunch rejects when the Apps in Toss bridge is unavailable", async () => {
  const webRuntime: HostRuntime = {
    platform: "web",
    hasBridge: false,
    bridge: null
  };

  await assert.rejects(
    () => startAppsInTossBillingLaunch({
      apiPost: async () => {
        throw new Error("should not call api");
      },
      runtime: webRuntime,
      originUrl: "https://linguacall.app/",
      planCode: "basic"
    }),
    (error: unknown) => {
      assert.ok(error instanceof HostBridgeError);
      assert.equal(error.code, "payment_not_supported");
      return true;
    }
  );
});

test("startAppsInTossBillingLaunch verifies the host session before requesting a launch session", async () => {
  const apiCalls: Array<{ url: string; body: unknown }> = [];
  const bridgeCalls: unknown[] = [];
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      appLogin: async () => ({ authorizationCode: "auth_code_123", referrer: "tossapp://miniapp" }),
      makePayment: async (payload) => {
        bridgeCalls.push(payload);
      }
    }
  };

  await startAppsInTossBillingLaunch({
    apiPost: async (url, body) => {
      apiCalls.push({ url, body });
      if (url === "/billing/apps-in-toss/verify-session") {
        return { verified: true } as never;
      }
      return {
        provider: "toss",
        planCode: "basic",
        orderId: "order_basic_123",
        orderName: "Basic Plan",
        amount: 9900,
        successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
        failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
        customerKey: "user_123"
      };
    },
    runtime,
    originUrl: "https://linguacall.app/",
    planCode: "basic"
  });

  assert.deepEqual(apiCalls, [{
    url: "/billing/apps-in-toss/verify-session",
    body: {
      authorizationCode: "auth_code_123",
      referrer: "tossapp://miniapp"
    }
  }, {
    url: "/billing/apps-in-toss/payment-launch",
    body: {
      planCode: "basic",
      returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
      cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
    }
  }]);
  assert.deepEqual(bridgeCalls, [{
    provider: "toss",
    planCode: "basic",
    orderId: "order_basic_123",
    orderName: "Basic Plan",
    amount: 9900,
    successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
    failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
    customerKey: "user_123"
  }]);
});

test("billing trust points describe web comparison and Apps in Toss checkout in Korean", () => {
  const copy = getFriendlyCopy("ko");

  assert.deepEqual(copy.billing.trustPoints, [
    "웹에서 플랜 비교",
    "앱인토스에서는 가능할 때 네이티브 결제 브리지",
    "웹·앱 어디서나 구독 상태 확인 가능"
  ]);
  assert.equal(copy.billing.planActionLabel, "Apps in Toss에서 이어가기");
});

test("billing trust points describe web comparison and Apps in Toss checkout in English", () => {
  const copy = getFriendlyCopy("en");

  assert.deepEqual(copy.billing.trustPoints, [
    "Plan comparison on web",
    "In-app bridge inside Apps in Toss",
    "Subscription status visible on web and in-app"
  ]);
  assert.equal(copy.billing.planActionLabel, "Continue in Apps in Toss");
});


test("login entry copy keeps plan comparison separate from Apps in Toss payment in Korean", () => {
  const copy = getFriendlyCopy("ko");

  assert.equal(copy.login.secondaryCta, "플랜 비교해보기");
  assert.equal(copy.login.secondaryCtaAppsInToss, "Apps in Toss에서 플랜 비교하기");
  assert.equal(copy.login.bullets[2], "유료 전환이 필요하면 플랜을 비교한 뒤 결제는 Apps in Toss에서 진행합니다.");
});


test("login entry copy keeps plan comparison separate from Apps in Toss payment in English", () => {
  const copy = getFriendlyCopy("en");

  assert.equal(copy.login.secondaryCta, "Compare plans first");
  assert.equal(copy.login.secondaryCtaAppsInToss, "Compare plans in Apps in Toss");
  assert.equal(copy.login.bullets[2], "If you decide to upgrade, compare plans first and complete payment in Apps in Toss.");
});


test("verify copy explains that paid plan changes continue in Apps in Toss in Korean", () => {
  const copy = getFriendlyCopy("ko");

  assert.equal(copy.verify.steps[2], "바로 짧은 통화를 시작하거나, 유료 전환이 필요하면 플랜을 비교한 뒤 Apps in Toss에서 이어서 진행합니다.");
  assert.equal(copy.verify.supportCopy, "중요한 건 빨리 말하기 연습을 시작하는 것입니다. 나중에 플랜 변경이 필요해도 결제는 Apps in Toss 안에서 이어집니다.");
});


test("verify copy explains that paid plan changes continue in Apps in Toss in English", () => {
  const copy = getFriendlyCopy("en");

  assert.equal(copy.verify.steps[2], "Start a short practice call now, or compare plans first and complete any upgrade in Apps in Toss.");
  assert.equal(copy.verify.supportCopy, "The goal is to get you speaking quickly. If you later need a plan change, the payment step continues inside Apps in Toss.");
});

test("resolveWebBillingLaunch keeps web plan changes blocked and returns the Apps in Toss notice", () => {
  const result = resolveWebBillingLaunch("Plan changes stay available only inside Apps in Toss.");

  assert.deepEqual(result, {
    shouldStartCheckout: false,
    errorMessage: "Plan changes stay available only inside Apps in Toss."
  });
});

test("resolveBillingLaunch blocks standalone web checkout and returns the web guidance note", () => {
  const runtime: HostRuntime = {
    platform: "web",
    hasBridge: false,
    bridge: null
  };

  const result = resolveBillingLaunch(runtime, {
    webNote: "Plan changes stay available only inside Apps in Toss.",
    appsInTossUnavailableNote: "Reopen this page from Apps in Toss to continue with payment.",
    hostUnavailableNotice: "This page looks like it opened from Toss, but the payment bridge is not available here yet."
  });

  assert.deepEqual(result, {
    shouldStartCheckout: false,
    errorMessage: "Plan changes stay available only inside Apps in Toss."
  });
});

test("resolveBillingLaunch returns the reentry note for Apps in Toss without a payment bridge", () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: false,
    bridge: {
      appLogin: async () => ({ authorizationCode: "code", referrer: "tossapp://miniapp" })
    }
  };

  const result = resolveBillingLaunch(runtime, {
    webNote: "Plan changes stay available only inside Apps in Toss.",
    appsInTossUnavailableNote: "Reopen this page from Apps in Toss to continue with payment.",
    hostUnavailableNotice: "This page looks like it opened from Toss, but the payment bridge is not available here yet."
  });

  assert.deepEqual(result, {
    shouldStartCheckout: false,
    errorMessage: "Reopen this page from Apps in Toss to continue with payment."
  });
});

test("resolveBillingLaunch keeps Apps in Toss blocked when the login bridge is missing", () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      makePayment: async () => undefined
    }
  };

  const result = resolveBillingLaunch(runtime, {
    webNote: "Plan changes stay available only inside Apps in Toss.",
    appsInTossUnavailableNote: "Reopen this page from Apps in Toss to continue with payment.",
    hostUnavailableNotice: "This page looks like it opened from Toss, but the payment bridge is not available here yet."
  });

  assert.deepEqual(result, {
    shouldStartCheckout: false,
    errorMessage: "Reopen this page from Apps in Toss to continue with payment."
  });
});

test("resolveBillingLaunch allows checkout only when Apps in Toss login and payment bridges are both available", () => {
  const runtime: HostRuntime = {
    platform: "apps-in-toss",
    hasBridge: true,
    bridge: {
      appLogin: async () => ({ authorizationCode: "code", referrer: "tossapp://miniapp" }),
      makePayment: async () => undefined
    }
  };

  const result = resolveBillingLaunch(runtime, {
    webNote: "Plan changes stay available only inside Apps in Toss.",
    appsInTossUnavailableNote: "Reopen this page from Apps in Toss to continue with payment.",
    hostUnavailableNotice: "This page looks like it opened from Toss, but the payment bridge is not available here yet."
  });

  assert.deepEqual(result, {
    shouldStartCheckout: true,
    errorMessage: ""
  });
});
