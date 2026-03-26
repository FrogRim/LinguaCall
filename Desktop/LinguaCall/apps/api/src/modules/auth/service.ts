import { createHash } from "node:crypto";
import { issueAccessToken, hashToken, verifyAccessToken } from "./session";

export interface OtpChallengeRecord {
  phoneE164: string;
  codeHash: string;
  expiresAt: string;
  attemptCount: number;
  consumedAt?: string;
}

export interface AuthUserRecord {
  id: string;
  phoneE164: string;
}

export interface CreateAuthSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface AuthRepository {
  replaceOtpChallenge(input: {
    phoneE164: string;
    codeHash: string;
    expiresAt: string;
  }): Promise<void>;
  findActiveOtpChallengeByPhone(phoneE164: string): Promise<OtpChallengeRecord | undefined>;
  incrementOtpAttempt(phoneE164: string): Promise<void>;
  consumeOtpChallenge(phoneE164: string): Promise<void>;
  findUserByPhone(phoneE164: string): Promise<AuthUserRecord | undefined>;
  findUserById(userId: string): Promise<AuthUserRecord | undefined>;
  createUserForPhone(phoneE164: string): Promise<AuthUserRecord>;
  createAuthSession(input: CreateAuthSessionInput): Promise<{ id: string }>;
  findAuthSessionByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | undefined>;
  rotateAuthSessionRefreshToken(input: CreateAuthSessionInput & { sessionId: string }): Promise<void>;
  revokeAuthSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void>;
}

export interface OtpSmsSender {
  sendOtp(payload: { to: string; message: string }): Promise<void>;
}

interface CreateAuthServiceOptions {
  repo: AuthRepository;
  smsSender: OtpSmsSender;
  now?: () => Date;
  generateOtpCode?: () => string;
  generateToken?: () => string;
  accessTokenSecret?: string;
}

const normalizePhoneE164 = (input: string) => {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("82")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+82${digits.slice(1)}`;
  }
  return `+${digits}`;
};

const maskPhoneE164 = (phoneE164: string) => {
  if (phoneE164.length < 8) {
    return phoneE164;
  }
  return `${phoneE164.slice(0, 5)}****${phoneE164.slice(-4)}`;
};

const hashOtpCode = (code: string) =>
  createHash("sha256").update(code).digest("hex");

const defaultOtpMessage = (code: string) =>
  `[LinguaCall] Your verification code is ${code}`;

export const createAuthService = ({
  repo,
  smsSender,
  now = () => new Date(),
  generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000)),
  generateToken = () => crypto.randomUUID(),
  accessTokenSecret = process.env.SESSION_COOKIE_SECRET ?? "dev-session-secret"
}: CreateAuthServiceOptions) => {
  const issueSessionTokens = async (input: {
    user: AuthUserRecord;
    sessionId: string;
    refreshToken: string;
    nowDate?: Date;
  }) => {
    const current = input.nowDate ?? now();
    const refreshExpiresAt = new Date(
      current.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const accessExpiresAt = new Date(
      current.getTime() + 60 * 60 * 1000
    ).toISOString();

    return {
      user: input.user,
      sessionId: input.sessionId,
      refreshToken: input.refreshToken,
      accessToken: issueAccessToken(
        {
          userId: input.user.id,
          sessionId: input.sessionId,
          expiresAt: accessExpiresAt
        },
        accessTokenSecret
      ),
      accessExpiresAt,
      refreshExpiresAt
    };
  };

  return {
    async startOtp(phone: string) {
      const phoneE164 = normalizePhoneE164(phone);
      const code = generateOtpCode();
      const expiresAt = new Date(now().getTime() + 5 * 60 * 1000).toISOString();

      await repo.replaceOtpChallenge({
        phoneE164,
        codeHash: hashOtpCode(code),
        expiresAt
      });

      await smsSender.sendOtp({
        to: phoneE164,
        message: defaultOtpMessage(code)
      });

      return {
        phoneE164,
        maskedPhone: maskPhoneE164(phoneE164),
        debugCode: code,
        expiresAt
      };
    },

    async verifyOtp(input: {
      phone: string;
      code: string;
      userAgent?: string;
      ip?: string;
    }) {
      const phoneE164 = normalizePhoneE164(input.phone);
      const challenge = await repo.findActiveOtpChallengeByPhone(phoneE164);
      if (!challenge || challenge.consumedAt) {
        throw new Error("invalid_verification_code_or_expired");
      }

      await repo.incrementOtpAttempt(phoneE164);
      if (challenge.codeHash !== hashOtpCode(input.code)) {
        throw new Error("invalid_verification_code_or_expired");
      }

      await repo.consumeOtpChallenge(phoneE164);

      const user =
        (await repo.findUserByPhone(phoneE164)) ??
        (await repo.createUserForPhone(phoneE164));

      const refreshToken = generateToken();
      const refreshTokenHash = hashToken(refreshToken);
      const current = now();
      const refreshExpiresAt = new Date(
        current.getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const session = await repo.createAuthSession({
        userId: user.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        userAgent: input.userAgent,
        ip: input.ip
      });
      return issueSessionTokens({
        user,
        sessionId: session.id,
        refreshToken,
        nowDate: current
      });
    },

    async getCurrentUser(accessToken: string) {
      const payload = verifyAccessToken(accessToken, accessTokenSecret);
      if (!payload) {
        return undefined;
      }
      const user = await repo.findUserById(payload.userId);
      if (!user) {
        return undefined;
      }
      return {
        user,
        sessionId: payload.sessionId
      };
    },

    async refreshSession(input: {
      refreshToken: string;
      userAgent?: string;
      ip?: string;
    }) {
      const refreshTokenHash = hashToken(input.refreshToken);
      const session = await repo.findAuthSessionByRefreshTokenHash(refreshTokenHash);
      if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) {
        throw new Error("invalid_refresh_session");
      }

      const user = await repo.findUserById(session.userId);
      if (!user) {
        throw new Error("invalid_refresh_session");
      }

      const nextRefreshToken = generateToken();
      const current = now();
      const nextRefreshExpiresAt = new Date(
        current.getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      await repo.rotateAuthSessionRefreshToken({
        sessionId: session.id,
        userId: session.userId,
        refreshTokenHash: hashToken(nextRefreshToken),
        expiresAt: nextRefreshExpiresAt,
        userAgent: input.userAgent,
        ip: input.ip
      });

      return issueSessionTokens({
        user,
        sessionId: session.id,
        refreshToken: nextRefreshToken,
        nowDate: current
      });
    },

    async logout(refreshToken?: string) {
      if (!refreshToken) {
        return;
      }
      await repo.revokeAuthSessionByRefreshTokenHash(hashToken(refreshToken));
    }
  };
};
