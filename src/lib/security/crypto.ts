import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Envelope encryption (AES-256-GCM).
 *
 * Every value gets its own random 256-bit data key. The data key is wrapped
 * by a key-encryption key (KEK) supplied by a KeyProvider. In production the
 * KeyProvider is a cloud KMS/HSM (wrap/unwrap happen inside the HSM and the
 * KEK never leaves it). Locally we use an env-supplied key so the app runs.
 *
 * Ciphertext format (base64url, dot separated):
 *   v1.<keyId>.<wrappedDataKey>.<iv>.<tag>.<ciphertext>
 */

export interface KeyProvider {
  readonly keyId: string;
  wrap(dataKey: Buffer): Buffer;
  unwrap(wrapped: Buffer): Buffer;
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

function gcmEncrypt(key: Buffer, plaintext: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

function gcmDecrypt(key: Buffer, iv: Buffer, tag: Buffer, ct: Buffer, aad: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/** Local KEK held in memory. Stand-in for KMS; never use without a real secret in prod. */
export class LocalKeyProvider implements KeyProvider {
  readonly keyId: string;
  readonly #kek: Buffer;
  constructor(kek: Buffer, keyId: string) {
    if (kek.length !== 32) throw new Error("KEK must be 32 bytes");
    this.#kek = kek;
    this.keyId = keyId;
  }
  wrap(dataKey: Buffer): Buffer {
    const { iv, tag, ct } = gcmEncrypt(this.#kek, dataKey, Buffer.from(this.keyId));
    return Buffer.concat([iv, tag, ct]);
  }
  unwrap(wrapped: Buffer): Buffer {
    return gcmDecrypt(this.#kek, wrapped.subarray(0, 12), wrapped.subarray(12, 28), wrapped.subarray(28), Buffer.from(this.keyId));
  }
}

/** Build a provider from a base64 secret, or a clearly-labelled dev key outside production. */
export function keyProviderFromSecret(secret: string | undefined, purpose: string): KeyProvider {
  if (secret) {
    const raw = Buffer.from(secret, "base64");
    if (raw.length !== 32) throw new Error(`${purpose} key must be 32 bytes, base64 encoded`);
    return new LocalKeyProvider(raw, `${purpose}-${createHash("sha256").update(raw).digest("hex").slice(0, 8)}`);
  }
  if (process.env.NODE_ENV === "production") throw new Error(`${purpose} key missing in production`);
  const devKey = createHash("sha256").update(`lifted-insecure-dev-key:${purpose}`).digest();
  return new LocalKeyProvider(devKey, `${purpose}-dev`);
}

/**
 * Encrypt a string. `context` is bound as additional authenticated data so a
 * ciphertext copied into a different column/row fails to decrypt.
 */
export function seal(provider: KeyProvider, plaintext: string, context: string): string {
  const dataKey = randomBytes(32);
  try {
    const { iv, tag, ct } = gcmEncrypt(dataKey, Buffer.from(plaintext, "utf8"), Buffer.from(context));
    return ["v1", provider.keyId, b64(provider.wrap(dataKey)), b64(iv), b64(tag), b64(ct)].join(".");
  } finally {
    dataKey.fill(0);
  }
}

export function open(provider: KeyProvider, sealed: string, context: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 6 || parts[0] !== "v1") throw new Error("Malformed ciphertext");
  const [, keyId, wrapped, iv, tag, ct] = parts as [string, string, string, string, string, string];
  if (keyId !== provider.keyId) throw new Error("Ciphertext was sealed under a different key");
  const dataKey = provider.unwrap(unb64(wrapped));
  try {
    return gcmDecrypt(dataKey, unb64(iv), unb64(tag), unb64(ct), Buffer.from(context)).toString("utf8");
  } finally {
    dataKey.fill(0);
  }
}

export function sealBytes(provider: KeyProvider, data: Buffer, context: string): Buffer {
  return Buffer.from(seal(provider, data.toString("base64"), context), "utf8");
}
export function openBytes(provider: KeyProvider, sealed: Buffer, context: string): Buffer {
  return Buffer.from(open(provider, sealed.toString("utf8"), context), "base64");
}

export const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function hmacSha256Hex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
