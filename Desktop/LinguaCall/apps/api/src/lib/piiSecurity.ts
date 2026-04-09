import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1";

const readEnv = (value?: string): string | undefined => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const getEncryptionSecret = (): string => {
  return readEnv(process.env.PII_ENCRYPTION_KEY)
    || readEnv(process.env.PHONE_VERIFICATION_SECRET)
    || readEnv(process.env.WORKER_SHARED_SECRET)
    || readEnv(process.env.TOSS_SECRET_KEY)
    || readEnv(process.env.TWILIO_AUTH_TOKEN)
    || readEnv(process.env.OPENAI_API_KEY)
    || readEnv(process.env.DATABASE_URL)
    || "linguacall-dev-fallback-secret";
};

const getPhoneVerificationSecret = (): string => {
  return readEnv(process.env.PHONE_VERIFICATION_SECRET)
    || getEncryptionSecret();
};

const deriveKey = (secret: string, scope: string): Buffer => {
  return createHash("sha256").update(`${scope}:${secret}`).digest();
};

export const encryptPhoneForStorage = (phone: string): string => {
  const iv = randomBytes(12);
  const key = deriveKey(getEncryptionSecret(), "pii-phone");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
};

export const decryptPhoneFromStorage = (value: string): string => {
  const normalized = value.trim();
  if (!normalized.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return normalized;
  }

  const parts = normalized.split(":");
  if (parts.length !== 5) {
    throw new Error("invalid_encrypted_phone_payload");
  }

  const [, , ivEncoded, authTagEncoded, cipherEncoded] = parts;
  const key = deriveKey(getEncryptionSecret(), "pii-phone");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivEncoded, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherEncoded, "base64url")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
};

export const hashPhoneVerificationCode = (code: string): string => {
  return createHmac("sha256", deriveKey(getPhoneVerificationSecret(), "otp-code"))
    .update(code)
    .digest("hex");
};

export const verifyPhoneVerificationCode = (expectedHash: string, candidateCode: string): boolean => {
  const candidateHash = hashPhoneVerificationCode(candidateCode);
  if (expectedHash.length !== candidateHash.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(candidateHash));
  } catch {
    return false;
  }
};
