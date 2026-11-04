import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

async function load(vars: Record<string, string>) {
  process.env = { ...original, ...vars } as NodeJS.ProcessEnv;
  vi.resetModules();
  return (await import("@/lib/env")).env;
}

describe("env guardrails (fail closed)", () => {
  it("refuses demo login in production", async () => {
    const env = await load({ NODE_ENV: "production", ALLOW_DEMO_LOGIN: "true" });
    expect(() => env()).toThrow(/ALLOW_DEMO_LOGIN/);
  });

  it("refuses mock payments in production", async () => {
    const env = await load({ NODE_ENV: "production", PAYMENTS_MODE: "mock" });
    expect(() => env()).toThrow(/PAYMENTS_MODE=mock/);
  });

  it("requires distinct data and vault keys in production", async () => {
    const k = Buffer.alloc(32, 1).toString("base64");
    const env = await load({
      NODE_ENV: "production",
      PAYMENTS_MODE: "stripe",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_BILLPAY_PARTNER_ACCOUNT: "acct_x",
      DATA_MASTER_KEY: k,
      VAULT_MASTER_KEY: k,
      BILLPAY_WEBHOOK_SECRET: "s",
    });
    expect(() => env()).toThrow(/must differ/);
  });

  it("accepts a safe development config", async () => {
    const env = await load({ NODE_ENV: "development", ALLOW_DEMO_LOGIN: "true", PAYMENTS_MODE: "mock" });
    expect(env().ALLOW_DEMO_LOGIN).toBe(true);
  });
});
