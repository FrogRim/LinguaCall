import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  return {
    createCheckoutSessionMock: vi.fn(),
    handlePaymentWebhookMock: vi.fn(),
    getPendingCheckoutMock: vi.fn(),
    claimPendingCheckoutMock: vi.fn(),
    releasePendingCheckoutMock: vi.fn(),
    completePendingCheckoutMock: vi.fn()
  };
});

vi.mock("../middleware/auth", () => {
  return {
    requireAuthenticatedUser: (
      req: express.Request & { clerkUserId?: string; userId?: string },
      _res: express.Response,
      next: express.NextFunction
    ) => {
      req.clerkUserId = "local:user-1";
      req.userId = "user-1";
      next();
    }
  };
});

vi.mock("../storage/inMemoryStore", () => {
  class AppError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    AppError,
    store: {
      getPool() {
        return {
          query: vi.fn(async () => ({ rows: [] }))
        };
      },
      listBillingPlans: vi.fn(async () => []),
      getUserActiveSubscription: vi.fn(async () => null),
      createCheckoutSession: mocked.createCheckoutSessionMock,
      handlePaymentWebhook: mocked.handlePaymentWebhookMock,
      getPendingCheckoutByOrderId: mocked.getPendingCheckoutMock,
      claimPendingCheckout: mocked.claimPendingCheckoutMock,
      releasePendingCheckout: mocked.releasePendingCheckoutMock,
      completePendingCheckout: mocked.completePendingCheckoutMock
    }
  };
});

import billingRouter from "../routes/billing";

describe("billing web gating", () => {
  beforeEach(() => {
    mocked.createCheckoutSessionMock.mockReset();
    mocked.handlePaymentWebhookMock.mockReset();
    mocked.getPendingCheckoutMock.mockReset();
    mocked.claimPendingCheckoutMock.mockReset();
    mocked.releasePendingCheckoutMock.mockReset();
    mocked.completePendingCheckoutMock.mockReset();
  });

  it("blocks Apps in Toss payment launch until the host session has been server-verified", async () => {
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = "https://linguacall.app";

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/apps-in-toss/payment-launch")
        .send({
          planCode: "basic",
          returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
          cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: "apps_in_toss_verification_required",
        message: "Apps in Toss verification required before payment launch"
      });
      expect(mocked.createCheckoutSessionMock).not.toHaveBeenCalled();
    } finally {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("verifies an Apps in Toss host session and then creates a payment launch payload", async () => {
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    const originalFetch = global.fetch;
    process.env.ALLOWED_ORIGINS = "https://linguacall.app";
    mocked.createCheckoutSessionMock.mockResolvedValue({
      provider: "toss",
      checkoutSessionId: "order_basic_123",
      planCode: "basic",
      orderId: "order_basic_123",
      orderName: "Basic Plan",
      amount: 9900,
      successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
      failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
      customerKey: "user_123",
      customerEmail: "user@example.com",
      customerName: "Lingua User"
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: "apps_in_toss_access_token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userKey: "toss-user-1" })
      });
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const verifyResponse = await request(app)
        .post("/billing/apps-in-toss/verify-session")
        .send({
          authorizationCode: "auth_code_123",
          referrer: "tossapp://miniapp"
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.ok).toBe(true);

      const launchResponse = await request(app)
        .post("/billing/apps-in-toss/payment-launch")
        .send({
          planCode: "basic",
          returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
          cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
        });

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationCode: "auth_code_123",
            referrer: "tossapp://miniapp"
          })
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me",
        expect.objectContaining({
          headers: { Authorization: "Bearer apps_in_toss_access_token" }
        })
      );
      expect(launchResponse.status).toBe(200);
      expect(launchResponse.body).toMatchObject({
        ok: true,
        data: {
          provider: "toss",
          orderId: "order_basic_123",
          orderName: "Basic Plan",
          amount: 9900,
          successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
          failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
          customerKey: "user_123",
          customerEmail: "user@example.com",
          customerName: "Lingua User",
          planCode: "basic"
        }
      });
      expect(mocked.createCheckoutSessionMock).toHaveBeenCalledWith("local:user-1", {
        planCode: "basic",
        returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
        cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
      });
    } finally {
      global.fetch = originalFetch;
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("rejects Apps in Toss launch callback URLs outside trusted origins", async () => {
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = "https://linguacall.app";
    mocked.createCheckoutSessionMock.mockResolvedValue({
      provider: "toss",
      checkoutSessionId: "order_basic_123",
      planCode: "basic",
      orderId: "order_basic_123",
      orderName: "Basic Plan",
      amount: 9900,
      successUrl: "https://evil.example/return",
      failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
      customerKey: "user_123"
    });

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/apps-in-toss/payment-launch")
        .send({
          planCode: "basic",
          returnUrl: "https://evil.example/return",
          cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({
        code: "validation_error",
        message: "untrusted billing callback url"
      });
      expect(mocked.createCheckoutSessionMock).not.toHaveBeenCalled();
    } finally {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("blocks web checkout requests and does not create a checkout session", async () => {
    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    const response = await request(app)
      .post("/billing/checkout")
      .send({
        planCode: "basic",
        returnUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
        cancelUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "forbidden",
      message: "web checkout is disabled; complete payment inside Apps in Toss"
    });
    expect(mocked.createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("blocks legacy web confirm requests and does not touch pending checkout state", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 9900 });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: "forbidden",
        message: "web payment confirmation is disabled; complete payment inside Apps in Toss"
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocked.getPendingCheckoutMock).not.toHaveBeenCalled();
      expect(mocked.claimPendingCheckoutMock).not.toHaveBeenCalled();
      expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("rejects payment webhooks when the webhook secret is missing", async () => {
    const originalSecret = process.env.BILLING_WEBHOOK_SECRET_TOSS;
    const originalFallback = process.env.BILLING_WEBHOOK_SECRET;
    delete process.env.BILLING_WEBHOOK_SECRET_TOSS;
    delete process.env.BILLING_WEBHOOK_SECRET;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/webhooks/toss")
        .send({ eventType: "payment.confirmed" });

      expect(response.status).toBe(401);
    } finally {
      process.env.BILLING_WEBHOOK_SECRET_TOSS = originalSecret;
      process.env.BILLING_WEBHOOK_SECRET = originalFallback;
    }
    expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
  });
});
