# Security

Principle: store almost nothing sensitive, isolate what we must keep, and make any breach small, detectable and recoverable.

## Reporting a vulnerability

Please email security@ (domain TBD) instead of opening a public issue. A bug bounty is planned from launch.

## Controls implemented in this repo

| Spec control | Implementation |
| --- | --- |
| Card data never touches our servers (SAQ-A) | Stripe Checkout redirect; `src/lib/payments/stripe.ts` |
| Money never touches users | Connect destination charge to the bill-pay partner; Lifted keeps only the fee. `ledger.ts` |
| Passkeys, no SMS MFA | WebAuthn with discoverable credentials and required user verification; counter-regression check. `api/auth/*` |
| Session security | 256-bit opaque token in an `HttpOnly; Secure; SameSite=Strict` (`__Host-` in prod) cookie; only SHA-256 stored; 30-min idle, 7-day absolute; revoke-all helper. `auth/session.ts` |
| Step-up auth | Fresh passkey assertion (10 min) required for document viewing, data export, and account deletion |
| Field-level envelope encryption | AES-256-GCM, a random data key per value, wrapped by a KEK via `KeyProvider`; context bound as AAD. `security/crypto.ts` |
| Tokenized account numbers | Separate vault table + separate KEK; callers see only `tok_…` + last-4; detokenized only at payout. `security/vault.ts` |
| Upload hardening | 10 MB cap, magic-byte sniffing, images re-rendered by sharp (metadata/GPS/polyglots stripped), PDFs with active content rejected, encrypted at rest, 7-day TTL, deleted at review. `security/uploads.ts` |
| Document forensics | EXIF Software / PDF Producer editor detection, incremental-save detection. `security/sniff.ts` |
| Duplicate detection on redacted fields | `dedupe.ts` |
| LLM pipeline | No tools; strict JSON schema with no PII slots; zod re-validation; range checks; PII scrub of any model text; output only pre-fills a draft the poster confirms, and every bill still goes to review. `llm/extract.ts` |
| Upload ticket integrity | Flags and upload key are sealed (AEAD) and bound to the uploader, so clients can't strip flags or reuse others' uploads. `uploadTicket.ts` |
| Parameterized queries | Drizzle query builder only, with a 10s statement timeout |
| Input validation / output encoding | zod on every route; `<`/`>` rejected in free text; React escaping; no `dangerouslySetInnerHTML` |
| Strict CSP | Per-request nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`. HSTS preload, nosniff, DENY framing, COOP. `proxy.ts`, `next.config.ts` |
| CSRF | SameSite=Strict, plus an Origin check on every state-changing route |
| Rate limiting | Per-IP and per-account sliding windows on auth, post, vote, checkout, claim, review. `security/rateLimit.ts` |
| Webhook verification | Stripe: `constructEvent` with signature + 300s tolerance. Partner: HMAC-SHA256 over `t.body` + 300s tolerance. Both de-duplicated by event id (`processed_events`) |
| Idempotent payments | Stripe idempotency keys on checkout and refunds; row-locked funding; over-funding is auto-refunded |
| Refund on biller rejection | All contributions refunded including fees (`refund_application_fee`, `reverse_transfer`) |
| Voting integrity | Verified accounts only, one vote per bill (PK), 10/day budget, can't vote on your own bill |
| Tamper-evident audit log | SHA-256 hash chain under an advisory lock; covers auth, review decisions, every document view, payouts, exports, and deletions. `security/audit.ts` |
| Harassment / doxxing | Public pages show first name + city only (opt-in) or "A neighbor"; no images ever public; stories PII-redacted and moderated |
| Data minimization / retention | Uploads ≤ 7 days; vault entries purged at paid + 90 days; `npm run purge` |
| User rights | Self-serve export and deletion (anonymization, keeping legally required payment records) |
| Fail-closed config | Boot refuses demo login, mock payments, missing keys, or shared data/vault keys in production. `lib/env.ts` |
| Errors | Generic messages to clients; no stack traces or internals |

## Not done yet (required before launch)

These live outside the application code, or need vendors and contracts:

- **KMS/HSM `KeyProvider`** (the repo ships the interface and an env-key stand-in) and a secrets manager.
- **Vault isolation:** move `vault_entries` into its own service, database and cloud account with mTLS.
- **Sandboxed file processing:** run `processUpload` in a no-network sandbox with malware scanning; rasterize PDFs there.
- **Image redaction:** automatic masking of account numbers/addresses on document images needs OCR inside the sandbox. Today reviewers see the sanitized original, behind step-up and audit logging.
- **Distributed rate limiting** (Redis) and edge WAF, bot management and DDoS protection.
- **Biller confirmation integration** (partner API / payment network). Today reviewers attest to it in the review UI.
- **Device fingerprinting / vote-graph anomaly detection.**
- **SIEM shipping** of the audit log to write-once storage, plus alerting.
- **Refresh-token rotation** (sessions currently use an idle + absolute timeout with opaque server-side tokens).
- Launch gates from the spec: third-party pen test, outside threat-model review, Stripe SAQ-A review, IR tabletop, bug bounty, SOC 2 Type I readiness.
