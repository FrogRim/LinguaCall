import { NextFunction, Request, Response } from "express";
import {
  getSupabaseDisplayName,
  toSupabaseSubject,
  verifySupabaseAccessToken
} from "../modules/auth/supabase";
import { encryptPhoneForStorage } from "../lib/piiSecurity";

export interface AuthenticatedRequest extends Request {
  userId: string;
  clerkUserId: string;
  sessionId?: string;
}

type AuthIdentity = {
  userId: string;
  clerkUserId: string;
};

type AuthMiddlewareRepository = {
  syncSupabaseIdentity(input: {
    authUserId: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
  }): Promise<AuthIdentity>;
};

type CreateRequireAuthenticatedUserOptions = {
  repo?: AuthMiddlewareRepository;
};

const AUTHORIZATION_PREFIX = "Bearer ";

const createDefaultRepo = (): AuthMiddlewareRepository => {
  const { store } = require("../storage/inMemoryStore") as typeof import("../storage/inMemoryStore");
  return {
    async syncSupabaseIdentity(input) {
      const subject = toSupabaseSubject(input.authUserId);
      const profile = await store.upsertUser(subject, {
        name: input.name,
        email: input.email ?? undefined
      });

      if (input.phone) {
        const normalizedPhone = input.phone.trim();
        const phoneLast4 = normalizedPhone.slice(-4);
        const phoneCountryCode = normalizedPhone.startsWith("+82") ? "+82" : null;
        await store.getPool().query(
          `
            UPDATE users
            SET phone_encrypted = COALESCE($2, phone_encrypted),
                phone_last4 = COALESCE($3, phone_last4),
                phone_country_code = COALESCE($4, phone_country_code),
                phone_verified = true,
                phone_verified_at = COALESCE(phone_verified_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
          `,
          [profile.id, encryptPhoneForStorage(normalizedPhone), phoneLast4, phoneCountryCode]
        );
      }

      return {
        userId: profile.id,
        clerkUserId: subject
      };
    }
  };
};

const readBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader || !authorizationHeader.startsWith(AUTHORIZATION_PREFIX)) {
    return undefined;
  }
  const token = authorizationHeader.slice(AUTHORIZATION_PREFIX.length).trim();
  return token || undefined;
};

export function createRequireAuthenticatedUser(
  options: CreateRequireAuthenticatedUserOptions = {}
) {
  const repo = options.repo ?? createDefaultRepo();

  return async function requireAuthenticatedUser(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const bearerToken = readBearerToken(req.headers.authorization);
    if (bearerToken) {
      const supabaseUser = await verifySupabaseAccessToken(bearerToken);
      if (supabaseUser) {
        const identity = await repo.syncSupabaseIdentity({
          authUserId: supabaseUser.id,
          email: supabaseUser.email ?? undefined,
          phone: supabaseUser.phone ?? undefined,
          name: getSupabaseDisplayName(supabaseUser)
        });

        const authReq = req as AuthenticatedRequest;
        authReq.userId = identity.userId;
        authReq.clerkUserId = identity.clerkUserId;
        next();
        return;
      }
    }

    res.status(401).json({
      ok: false,
      error: { code: "forbidden", message: "authentication required" }
    });
  };
}

export const requireAuthenticatedUser = createRequireAuthenticatedUser();
