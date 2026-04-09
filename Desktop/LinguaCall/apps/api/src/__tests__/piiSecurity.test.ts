import { describe, expect, it } from "vitest";

import {
  decryptPhoneFromStorage,
  encryptPhoneForStorage,
  hashPhoneVerificationCode,
  verifyPhoneVerificationCode
} from "../lib/piiSecurity";

describe("piiSecurity", () => {
  it("encrypts and decrypts phone numbers for storage", () => {
    const originalKey = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = "test-encryption-key";

    const encrypted = encryptPhoneForStorage("+821012345678");

    expect(encrypted).not.toBe("+821012345678");
    expect(decryptPhoneFromStorage(encrypted)).toBe("+821012345678");

    process.env.PII_ENCRYPTION_KEY = originalKey;
  });

  it("hashes OTP codes and verifies them without storing the raw code", () => {
    const originalKey = process.env.PHONE_VERIFICATION_SECRET;
    process.env.PHONE_VERIFICATION_SECRET = "test-otp-secret";

    const codeHash = hashPhoneVerificationCode("123456");

    expect(codeHash).not.toContain("123456");
    expect(verifyPhoneVerificationCode(codeHash, "123456")).toBe(true);
    expect(verifyPhoneVerificationCode(codeHash, "654321")).toBe(false);

    process.env.PHONE_VERIFICATION_SECRET = originalKey;
  });
});
