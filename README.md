# Lifted

**Real bills. Real people. Real generosity.**

Lifted lets people post real, verified household bills (electric, rent, medical, childcare, internet). The community backs the most urgent ones, and givers pay them **directly to the biller**. Every Lift goes on the public record. Givers, from first-time donors to the world's biggest philanthropists, earn a place on **The Honor Roll**.

> Working name in the original spec: *BillWall*. Renamed to **Lifted** so the product celebrates generosity instead of keeping score of who hasn't given.

## The idea: social capital for giving

| Spec (BillWall) | Lifted |
| --- | --- |
| Leaderboard | **The Honor Roll**, with celebratory tiers: Lifter → Champion → Patron → **Luminary** |
| Billionaire board, "$0 paid" | **The Luminaries**: every billionaire has a *reserved seat*. When they Lift, it's verified, ranked and celebrated |
| "$0 paid through BillWall" | "Seat reserved. Paid through Lifted so far: $0", shown next to their **sourced philanthropy elsewhere** |
| Claim your profile | **Claim your seat**: link Lifts, add a statement, show foundation giving |

The framing is positive by design. It gives billionaires a reason to show up (public, verified credit for helping real households), and it also lowers the defamation/false-light risk the spec flags as the biggest legal exposure.

## Core loop

```
post a bill → redact + encrypt → verify (forensics, dedupe, biller check, human review)
  → community backs it → giver pays via Stripe → Connect routes the bill amount to a
  licensed bill-pay partner → partner pays the biller → signed webhook → bill marked
  Paid → Honor Roll updates → poster can post a public thank-you
```

## Quick start

Requirements: Node 20.11+, Docker (for Postgres), or any Postgres 16.

```bash
docker compose up -d                 # Postgres on 127.0.0.1:5432
cp .env.example .env                 # defaults run fully locally (mock payments, demo login)
npm install
npm run db:migrate
npm run db:seed                      # fictional sample data
npm run dev                          # http://localhost:3000
```

Go to **/signin → Demo accounts** to try every role: *Everyday donor*, *Bill poster*, *Verification reviewer*, *Luminary's office*. Payments run in **mock mode**: a test checkout page stands in for Stripe, and a mock bill-pay partner confirms instantly, so you can walk the whole loop with no keys.

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm test` | Unit tests (fees, ranking, Honor Roll, redaction, dedupe, crypto, audit chain, webhooks, LLM guardrails, env guards) |
| `npm run lint` / `typecheck` | ESLint / `tsc` |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run db:seed` | Reset dev data (refuses to run in production) |
| `npm run db:import-luminaries -- file.csv` | Load the real Luminaries board from a **sourced** CSV |
| `npm run purge` | Retention job: 7-day uploads, paid+90-day vault entries, expired sessions |

### Going live

1. **Stripe:** set `PAYMENTS_MODE=stripe`, `STRIPE_SECRET_KEY` (restricted key), `STRIPE_WEBHOOK_SECRET`, `STRIPE_BILLPAY_PARTNER_ACCOUNT`. Point a webhook at `/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed`. **Get Stripe to approve the use case first.**
2. **Bill-pay partner:** implement `BillPayPartner` in `src/lib/payments/billpay.ts` for the chosen provider. Its webhook goes to `/api/webhooks/billpay` (HMAC, `t=…,v1=…`).
3. **Keys:** replace `LocalKeyProvider` with a KMS-backed `KeyProvider` (wrap/unwrap inside the HSM). Data and vault keys must differ; boot fails otherwise.
4. **Extraction (optional):** `EXTRACTION_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`. Only enable this under a zero-data-retention agreement, or point the client at a self-hosted model.
5. **Luminaries:** import from a public list with source URLs (`list_source_url` is required, and `known_giving` requires its own source). Get counsel's sign-off before publishing real names.

Production refuses to boot with demo login, mock payments, missing keys, or shared data/vault keys.

## Architecture

```
src/
  proxy.ts                 per-request CSP nonce (Next 16 "proxy", formerly middleware)
  app/                     pages (server components) + /api route handlers
  components/              client components (forms, vote, checkout, passkeys)
  lib/
    db/schema.ts           Drizzle schema (Postgres)
    auth/                  passkeys (WebAuthn) + hashed server-side sessions + step-up
    security/              envelope crypto, KMS key providers, vault, uploads, sniffing,
                           rate limiting, hash-chained audit log
    payments/              Stripe Checkout/Connect, bill-pay partner adapter, ledger
    llm/extract.ts         Claude bill extraction: no tools, strict schema, no PII fields
    ranking.ts             feed ranking (votes × urgency × waiting)
    honor.ts               impact points + tiers
    dedupe.ts              feature-hashed vectors over redacted fields (pgvector-ready)
    redact.ts              PII redaction for stories and model output
```

**Stack:** Next.js 16 (App Router, TypeScript) · Postgres 16 + Drizzle · SimpleWebAuthn · Stripe · Anthropic SDK · sharp · Vitest.

### Note for the RAG / embeddings side

`dedupe.ts` is intentionally dependency-free: character n-gram feature hashing → 256-d L2-normalized vector → cosine ≥ 0.92 flags a likely duplicate. Inputs are **only** redacted, canonicalized fields (biller, amount, due month, last-4), never the document. To upgrade, swap `embedFields()` for a self-hosted embedding model and move `bills.fingerprint` to a `pgvector` column with an HNSW index. The call sites depend only on `embedFields` and `cosine`.

## Security

See [SECURITY.md](SECURITY.md) for how each control in the spec maps to code, and for what still has to happen before launch.

## Docs

- [docs/SPEC.md](docs/SPEC.md): product summary and decisions made while building
