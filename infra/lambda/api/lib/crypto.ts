import { createHash, randomInt } from "node:crypto";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export function generatePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    words.push(wordlist[randomInt(wordlist.length)]);
  }
  return words.join(" ");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Compute the stored keyHash from a raw passphrase: keyHash = SHA256(SHA256(passphrase)) */
export function computeKeyHash(passphrase: string): string {
  const token = sha256(passphrase);
  return sha256(token);
}

/** Convert a client-provided token (SHA256 of passphrase) to the stored keyHash */
export function tokenToKeyHash(token: string): string {
  return sha256(token);
}
