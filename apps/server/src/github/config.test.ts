import { describe, expect, test } from "bun:test";
import { createSign, generateKeyPairSync } from "node:crypto";
import { pemFrom } from "./config";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

const canSign = (pem: string) => {
  try {
    const signer = createSign("RSA-SHA256");
    signer.update("payload");
    signer.sign(pem, "base64url");
    return true;
  } catch {
    return false;
  }
};

describe("pemFrom", () => {
  test("signs with a key that has real newlines", () => {
    expect(canSign(pemFrom(privateKey))).toBe(true);
  });

  /**
   * How Vercel and most .env files store a multi-line key. Passing this
   * straight to createSign fails with an opaque error.
   */
  test("signs with a key whose newlines arrived escaped", () => {
    const escaped = privateKey.replace(/\n/g, "\\n");
    expect(canSign(escaped)).toBe(false);
    expect(canSign(pemFrom(escaped))).toBe(true);
  });

  test("tolerates surrounding whitespace", () => {
    expect(canSign(pemFrom(`\n  ${privateKey}  \n`))).toBe(true);
  });
});
