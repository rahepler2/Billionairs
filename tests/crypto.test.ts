import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalKeyProvider, open, openBytes, seal, sealBytes } from "@/lib/security/crypto";

const kp = new LocalKeyProvider(randomBytes(32), "test-1");

describe("envelope encryption", () => {
  it("round-trips", () => {
    expect(open(kp, seal(kp, "Jane Q. Public", "user:1:legal_name"), "user:1:legal_name")).toBe("Jane Q. Public");
  });

  it("uses a fresh data key and IV per value", () => {
    expect(seal(kp, "same", "ctx")).not.toBe(seal(kp, "same", "ctx"));
  });

  it("binds ciphertext to its context (no copy-paste between rows)", () => {
    const c = seal(kp, "secret", "user:1:address");
    expect(() => open(kp, c, "user:2:address")).toThrow();
  });

  it("detects tampering", () => {
    const parts = seal(kp, "secret", "ctx").split(".");
    const ct = Buffer.from(parts[5]!, "base64url");
    ct[0]! ^= 1;
    parts[5] = ct.toString("base64url");
    expect(() => open(kp, parts.join("."), "ctx")).toThrow();
  });

  it("refuses ciphertext from a different key", () => {
    const other = new LocalKeyProvider(randomBytes(32), "test-2");
    expect(() => open(other, seal(kp, "x", "ctx"), "ctx")).toThrow();
  });

  it("handles binary payloads", () => {
    const data = randomBytes(1024);
    expect(openBytes(kp, sealBytes(kp, data, "upload:k"), "upload:k").equals(data)).toBe(true);
  });
});
