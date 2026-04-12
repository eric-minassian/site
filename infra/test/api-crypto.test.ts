import { describe, expect, it } from "vitest";
import {
  computeKeyHash,
  generatePassphrase,
  sha256,
  tokenToKeyHash,
} from "../lambda/api/lib/crypto";

describe("sha256", () => {
  it("produces a 64-char hex string", () => {
    const hash = sha256("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    expect(sha256("test")).toBe(sha256("test"));
  });

  it("differs for different inputs", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("generatePassphrase", () => {
  it("returns 12 words separated by spaces", () => {
    const passphrase = generatePassphrase();
    const words = passphrase.split(" ");
    expect(words).toHaveLength(12);
  });

  it("uses only lowercase alphabetic words", () => {
    const passphrase = generatePassphrase();
    for (const word of passphrase.split(" ")) {
      expect(word).toMatch(/^[a-z]+$/);
    }
  });

  it("generates different passphrases", () => {
    const a = generatePassphrase();
    const b = generatePassphrase();
    expect(a).not.toBe(b);
  });
});

describe("computeKeyHash / tokenToKeyHash", () => {
  it("keyHash equals SHA256(SHA256(passphrase))", () => {
    const passphrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const token = sha256(passphrase);
    const keyHash = sha256(token);
    expect(computeKeyHash(passphrase)).toBe(keyHash);
  });

  it("tokenToKeyHash(SHA256(passphrase)) equals computeKeyHash(passphrase)", () => {
    const passphrase = generatePassphrase();
    const token = sha256(passphrase);
    expect(tokenToKeyHash(token)).toBe(computeKeyHash(passphrase));
  });
});
