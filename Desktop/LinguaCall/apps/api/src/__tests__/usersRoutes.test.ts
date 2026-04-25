import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  return {
    startPhoneVerificationMock: vi.fn(),
    confirmPhoneVerificationMock: vi.fn(),
    getByClerkUserIdMock: vi.fn()
  };
});

vi.mock("../middleware/auth", () => {
  return {
    requireAuthenticatedUser: (
      req: express.Request & { clerkUserId?: string; userId?: string },
      _res: express.Response,
      next: express.NextFunction
    ) => {
      req.clerkUserId = "supabase:user-1";
      req.userId = "user-1";
      next();
    }
  };
});

vi.mock("../modules/users/repository", () => {
  return {
    usersRepository: {
      startPhoneVerification: mocked.startPhoneVerificationMock,
      confirmPhoneVerification: mocked.confirmPhoneVerificationMock,
      getByClerkUserId: mocked.getByClerkUserIdMock,
      updateUiLanguage: vi.fn(),
      upsert: vi.fn()
    }
  };
});

import usersRouter from "../routes/users";

describe("users phone verification routes", () => {
  beforeEach(() => {
    mocked.startPhoneVerificationMock.mockReset();
    mocked.confirmPhoneVerificationMock.mockReset();
    mocked.getByClerkUserIdMock.mockReset();
  });

  it("does not expose the raw OTP code when starting phone verification", async () => {
    mocked.startPhoneVerificationMock.mockResolvedValue({
      maskedPhone: "***-****-5678",
      debugCode: "123456"
    });

    const app = express();
    app.use(express.json());
    app.use("/users", usersRouter);

    const response = await request(app)
      .post("/users/phone/start")
      .send({ phone: "+821012345678" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      maskedPhone: "***-****-5678"
    });
  });
});
