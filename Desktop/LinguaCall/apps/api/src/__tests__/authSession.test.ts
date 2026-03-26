import { describe, expect, it } from "vitest";
import {
  createAuthService,
  type AuthSessionRecord,
  type AuthRepository,
  type OtpChallengeRecord,
  type OtpSmsSender
} from "../modules/auth/service";
import { hashToken, issueAccessToken, verifyAccessToken } from "../modules/auth/session";

const accessTokenSecret = "test-secret";

const createRepo = () => {
  let challenge: OtpChallengeRecord | undefined = {
    phoneE164: "+821012345678",
    codeHash: hashToken("123456"),
    expiresAt: "2026-03-23T00:05:00.000Z",
    attemptCount: 0
  };

  let createdSession:
    | {
      userId: string;
      refreshTokenHash: string;
      expiresAt: string;
      userAgent?: string;
      ip?: string;
    }
    | undefined;
  let storedAuthSession: AuthSessionRecord | undefined;
  let revokedRefreshTokenHash: string | undefined;
  let rotatedSession:
    | {
      sessionId: string;
      refreshTokenHash: string;
      expiresAt: string;
      userAgent?: string;
      ip?: string;
    }
    | undefined;

  const repo: AuthRepository = {
    async replaceOtpChallenge() {
      return;
    },
    async findActiveOtpChallengeByPhone() {
      return challenge;
    },
    async incrementOtpAttempt() {
      if (challenge) {
        challenge = { ...challenge, attemptCount: challenge.attemptCount + 1 };
      }
    },
    async consumeOtpChallenge() {
      if (challenge) {
        challenge = { ...challenge, consumedAt: "2026-03-23T00:01:00.000Z" };
      }
    },
    async findUserByPhone() {
      return undefined;
    },
    async findUserById(userId) {
      return {
        id: userId,
        phoneE164: "+821012345678"
      };
    },
    async createUserForPhone(phoneE164) {
      return {
        id: "user-1",
        phoneE164
      };
    },
    async createAuthSession(input) {
      createdSession = input;
      storedAuthSession = {
        id: "session-1",
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt
      };
      return {
        id: "session-1"
      };
    },
    async findAuthSessionByRefreshTokenHash(refreshTokenHash) {
      if (storedAuthSession?.refreshTokenHash === refreshTokenHash) {
        return storedAuthSession;
      }
      return undefined;
    },
    async rotateAuthSessionRefreshToken(input) {
      rotatedSession = input;
      if (storedAuthSession?.id === input.sessionId) {
        storedAuthSession = {
          ...storedAuthSession,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt
        };
      }
    },
    async revokeAuthSessionByRefreshTokenHash(refreshTokenHash) {
      revokedRefreshTokenHash = refreshTokenHash;
    }
  };

  return {
    repo,
    getCreatedSession: () => createdSession,
    getRotatedSession: () => rotatedSession,
    getRevokedRefreshTokenHash: () => revokedRefreshTokenHash
  };
};

describe("createAuthService.verifyOtp", () => {
  it("creates an auth session after a valid OTP verification", async () => {
    const { repo, getCreatedSession } = createRepo();
    const smsSender: OtpSmsSender = {
      async sendOtp() {
        return;
      }
    };

    const service = createAuthService({
      repo,
      smsSender,
      now: () => new Date("2026-03-23T00:00:00.000Z"),
      generateOtpCode: () => "654321",
      generateToken: () => "refresh-token",
      accessTokenSecret
    });

    const result = await service.verifyOtp({
      phone: "01012345678",
      code: "123456",
      userAgent: "vitest",
      ip: "127.0.0.1"
    });

    expect(result.user.id).toBe("user-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBe("refresh-token");
    expect(getCreatedSession()).toMatchObject({
      userId: "user-1",
      refreshTokenHash: hashToken("refresh-token"),
      userAgent: "vitest",
      ip: "127.0.0.1"
    });
  });
});

describe("createAuthService.refreshSession", () => {
  it("rotates the refresh token and reissues cookies for a valid auth session", async () => {
    const { repo, getCreatedSession, getRotatedSession } = createRepo();
    const smsSender: OtpSmsSender = {
      async sendOtp() {
        return;
      }
    };

    const service = createAuthService({
      repo,
      smsSender,
      now: () => new Date("2026-03-23T00:00:00.000Z"),
      generateToken: () => "rotated-refresh-token",
      accessTokenSecret
    });

    await service.verifyOtp({
      phone: "01012345678",
      code: "123456",
      userAgent: "vitest",
      ip: "127.0.0.1"
    });

    const created = getCreatedSession();
    expect(created).toBeDefined();

    const refreshed = await service.refreshSession({
      refreshToken: "refresh-token",
      userAgent: "vitest-refresh",
      ip: "127.0.0.2"
    });

    expect(refreshed.sessionId).toBe("session-1");
    expect(refreshed.refreshToken).toBe("rotated-refresh-token");
    expect(getRotatedSession()).toMatchObject({
      sessionId: "session-1",
      refreshTokenHash: hashToken("rotated-refresh-token"),
      userAgent: "vitest-refresh",
      ip: "127.0.0.2"
    });
  });
});

describe("createAuthService.logout", () => {
  it("revoke current refresh session when a token is present", async () => {
    const { repo, getRevokedRefreshTokenHash } = createRepo();
    const smsSender: OtpSmsSender = {
      async sendOtp() {
        return;
      }
    };

    const service = createAuthService({
      repo,
      smsSender,
      now: () => new Date("2026-03-23T00:00:00.000Z"),
      generateToken: () => "refresh-token",
      accessTokenSecret
    });

    await service.logout("refresh-token");

    expect(getRevokedRefreshTokenHash()).toBe(hashToken("refresh-token"));
  });
});

describe("auth session token helpers", () => {
  it("issues and verifies signed access tokens", () => {
    const token = issueAccessToken(
      {
        userId: "user-1",
        sessionId: "session-1",
        expiresAt: "2099-03-23T01:00:00.000Z"
      },
      accessTokenSecret
    );

    const parsed = verifyAccessToken(token, accessTokenSecret);

    expect(parsed).toMatchObject({
      userId: "user-1",
      sessionId: "session-1"
    });
  });
});
