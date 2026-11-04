import "server-only";
import { z } from "zod";

/**
 * Validated server configuration. Fails closed: a bad or dangerous
 * combination (e.g. demo login in production) throws at first use.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1).default("postgres://lifted:lifted@127.0.0.1:5432/lifted"),
    DATA_MASTER_KEY: z.string().optional(),
    VAULT_MASTER_KEY: z.string().optional(),
    BILLPAY_WEBHOOK_SECRET: z.string().optional(),
    WEBAUTHN_RP_ID: z.string().default("localhost"),
    WEBAUTHN_RP_NAME: z.string().default("Lifted"),
    ALLOW_DEMO_LOGIN: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    PAYMENTS_MODE: z.enum(["mock", "stripe"]).default("mock"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_BILLPAY_PARTNER_ACCOUNT: z.string().optional(),
    PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(2000).default(500),
    EXTRACTION_PROVIDER: z.enum(["manual", "anthropic"]).default("manual"),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const prod = env.NODE_ENV === "production";
    if (prod && env.ALLOW_DEMO_LOGIN) {
      ctx.addIssue({ code: "custom", message: "ALLOW_DEMO_LOGIN must be false in production" });
    }
    if (prod && env.PAYMENTS_MODE === "mock") {
      ctx.addIssue({ code: "custom", message: "PAYMENTS_MODE=mock is not allowed in production" });
    }
    if (env.PAYMENTS_MODE === "stripe") {
      for (const k of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_BILLPAY_PARTNER_ACCOUNT"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", message: `${k} is required when PAYMENTS_MODE=stripe` });
      }
    }
    if (prod) {
      for (const k of ["DATA_MASTER_KEY", "VAULT_MASTER_KEY", "BILLPAY_WEBHOOK_SECRET"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", message: `${k} is required in production` });
      }
      if (env.DATA_MASTER_KEY && env.DATA_MASTER_KEY === env.VAULT_MASTER_KEY) {
        ctx.addIssue({ code: "custom", message: "VAULT_MASTER_KEY must differ from DATA_MASTER_KEY" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
