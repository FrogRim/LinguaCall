import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequireAuthenticatedUser, type AuthenticatedRequest } from "../middleware/auth";

vi.mock("../modules/auth/supabase", () => ({
  getSupabaseDisplayName: vi.fn(() => "Test User"),
  toSupabaseSubject: vi.fn((id: string) => `supabase:${id}`),
  verifySupabaseAccessToken: vi.fn()
}));

const { verifySupabaseAccessToken } = await import("../modules/auth/supabase");

describe("createRequireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates requests from Supabase bearer tokens", async () => {
    vi.mocked(verifySupabaseAccessToken).mockResolvedValue({
      id: "supabase-user-1",
      email: "user@example.com",
      phone: "+821012345678",
      user_metadata: { name: "Test User" }
    });

    const app = express();
    app.get(
      "/protected",
      createRequireAuthenticatedUser({
        repo: {
          async syncSupabaseIdentity() {
            return {
              userId: "user-123",
              clerkUserId: "supabase:supabase-user-1"
            };
          }
        }
      }),
      (req, res) => {
        const authReq = req as AuthenticatedRequest;
        res.json({
          ok: true,
          data: {
            userId: authReq.userId,
            clerkUserId: authReq.clerkUserId
          }
        });
      }
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer supabase-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      userId: "user-123",
      clerkUserId: "supabase:supabase-user-1"
    });
  });

  it("rejects requests without a bearer token", async () => {
    vi.mocked(verifySupabaseAccessToken).mockResolvedValue(null);

    const app = express();
    app.get(
      "/protected",
      createRequireAuthenticatedUser({
        repo: {
          async syncSupabaseIdentity() {
            throw new Error("not implemented in rejection test");
          }
        }
      }),
      (_req, res) => {
        res.json({ ok: true });
      }
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "authentication required"
      }
    });
  });
});
