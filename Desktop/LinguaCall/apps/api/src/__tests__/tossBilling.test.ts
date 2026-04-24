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

describe("billing toss-only flow", () => {
  beforeEach(() => {
    mocked.createCheckoutSessionMock.mockReset();
    mocked.handlePaymentWebhookMock.mockReset();
    mocked.getPendingCheckoutMock.mockReset();
    mocked.claimPendingCheckoutMock.mockReset();
    mocked.releasePendingCheckoutMock.mockReset();
    mocked.completePendingCheckoutMock.mockReset();
  });

  it("rejects non-toss provider checkout requests", async () => {
    mocked.createCheckoutSessionMock.mockResolvedValue({
      provider: "stripe",
      checkoutSessionId: "cs_123",
      checkoutUrl: "https://checkout.example/stripe",
      planCode: "basic"
    });

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    const response = await request(app)
      .post("/billing/checkout")
      .send({ planCode: "basic", provider: "stripe" });

    expect(response.status).toBe(422);
    expect(mocked.createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns Toss widget checkout data for the billing screen", async () => {
    mocked.createCheckoutSessionMock.mockResolvedValue({
      provider: "toss",
      checkoutSessionId: "order_basic_123",
      checkoutUrl: "https://checkout.example/toss",
      planCode: "basic",
      orderId: "order_basic_123",
      orderName: "Basic Plan",
      amount: 9900,
      successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
      failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic",
      customerEmail: "user@example.com",
      customerName: "Lingua User"
    });

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

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      provider: "toss",
      orderId: "order_basic_123",
      orderName: "Basic Plan",
      amount: 9900,
      successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
      failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
    });
  });

  it("drops untrusted return and cancel URLs before creating a checkout session", async () => {
    mocked.createCheckoutSessionMock.mockResolvedValue({
      provider: "toss",
      checkoutSessionId: "order_basic_123",
      planCode: "basic",
      orderId: "order_basic_123",
      orderName: "Basic Plan",
      amount: 9900,
      successUrl: "https://linguacall.app/#/billing?checkout=success&plan=basic",
      failUrl: "https://linguacall.app/#/billing?checkout=cancel&plan=basic"
    });

    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = "https://linguacall.app";

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/checkout")
        .send({
          planCode: "basic",
          returnUrl: "https://evil.example/steal",
          cancelUrl: "https://evil.example/cancel"
        });

      expect(response.status).toBe(200);
    } finally {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
    expect(mocked.createCheckoutSessionMock).toHaveBeenCalledWith(
      "local:user-1",
      expect.objectContaining({
        planCode: "basic",
        returnUrl: undefined,
        cancelUrl: undefined
      })
    );
  });

  it("confirms Toss payments using the pending checkout plan instead of orderName", async () => {
    mocked.getPendingCheckoutMock.mockResolvedValue({
      orderId: "order_basic_123",
      clerkUserId: "local:user-1",
      planCode: "basic",
      amount: 9900
    });
    mocked.claimPendingCheckoutMock.mockResolvedValue({
      orderId: "order_basic_123",
      clerkUserId: "local:user-1",
      planCode: "basic",
      amount: 9900,
      confirmationToken: "claim_123"
    });
    mocked.completePendingCheckoutMock.mockResolvedValue(undefined);
    mocked.handlePaymentWebhookMock.mockResolvedValue({
      id: "sub_123",
      userId: "user-1",
      provider: "toss",
      providerSubscriptionId: "order_basic_123",
      planCode: "basic",
      status: "active",
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const originalSecret = process.env.TOSS_SECRET_KEY;
    const originalFetch = global.fetch;
    process.env.TOSS_SECRET_KEY = "test_secret";
    global.fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          orderName: "Basic Plan"
        })
      } as Response;
    }) as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 9900 });

      expect(response.status).toBe(200);
      expect(mocked.handlePaymentWebhookMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkUserId: "local:user-1",
          providerSubscriptionId: "order_basic_123",
          planCode: "basic"
        })
      );
    } finally {
      process.env.TOSS_SECRET_KEY = originalSecret;
      global.fetch = originalFetch;
    }
  });

  it("does not call Toss confirm when the pending checkout belongs to another user", async () => {
    mocked.getPendingCheckoutMock.mockResolvedValue({
      orderId: "order_basic_123",
      clerkUserId: "local:other-user",
      planCode: "basic",
      amount: 9900
    });

    const originalSecret = process.env.TOSS_SECRET_KEY;
    const originalFetch = global.fetch;
    process.env.TOSS_SECRET_KEY = "test_secret";
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          metadata: { planCode: "pro" },
          orderName: "Pro Plan"
        })
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 9900 });

      expect(response.status).toBe(422);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
    } finally {
      process.env.TOSS_SECRET_KEY = originalSecret;
      global.fetch = originalFetch;
    }
  });

  it("does not call Toss confirm when the checkout amount does not match", async () => {
    mocked.getPendingCheckoutMock.mockResolvedValue({
      orderId: "order_basic_123",
      clerkUserId: "local:user-1",
      planCode: "basic",
      amount: 9900
    });

    const originalSecret = process.env.TOSS_SECRET_KEY;
    const originalFetch = global.fetch;
    process.env.TOSS_SECRET_KEY = "test_secret";
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          orderName: "Basic Plan"
        })
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 19900 });

      expect(response.status).toBe(422);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
    } finally {
      process.env.TOSS_SECRET_KEY = originalSecret;
      global.fetch = originalFetch;
    }
  });

  it("does not call Toss confirm when the checkout session is missing", async () => {
    mocked.getPendingCheckoutMock.mockResolvedValue(null);

    const originalSecret = process.env.TOSS_SECRET_KEY;
    const originalFetch = global.fetch;
    process.env.TOSS_SECRET_KEY = "test_secret";
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          orderName: "Basic Plan"
        })
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 9900 });

      expect(response.status).toBe(422);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
    } finally {
      process.env.TOSS_SECRET_KEY = originalSecret;
      global.fetch = originalFetch;
    }
  });

  it("does not call Toss confirm when another request already claimed the checkout", async () => {
    mocked.getPendingCheckoutMock.mockResolvedValue({
      orderId: "order_basic_123",
      clerkUserId: "local:user-1",
      planCode: "basic",
      amount: 9900
    });
    mocked.claimPendingCheckoutMock.mockResolvedValue(null);

    const originalSecret = process.env.TOSS_SECRET_KEY;
    const originalFetch = global.fetch;
    process.env.TOSS_SECRET_KEY = "test_secret";
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          orderName: "Basic Plan"
        })
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const app = express();
    app.use(express.json());
    app.use("/billing", billingRouter);

    try {
      const response = await request(app)
        .post("/billing/toss/confirm")
        .send({ paymentKey: "pay_123", orderId: "order_basic_123", amount: 9900 });

      expect(response.status).toBe(409);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocked.handlePaymentWebhookMock).not.toHaveBeenCalled();
    } finally {
      process.env.TOSS_SECRET_KEY = originalSecret;
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
