import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const roleEnum = pgEnum("role", ["member", "reviewer", "admin"]);
export const billStatusEnum = pgEnum("bill_status", [
  "pending_review", // submitted, not public
  "live", // verified and public, accepting votes + payments
  "funded", // fully funded, payout submitted to bill-pay partner
  "paid", // partner confirmed the biller received the money
  "rejected", // failed verification
  "expired",
]);
export const categoryEnum = pgEnum("bill_category", ["utility", "rent", "medical", "childcare", "internet", "other"]);
export const contributionStatusEnum = pgEnum("contribution_status", ["pending", "succeeded", "refunded", "failed"]);
export const payoutStatusEnum = pgEnum("payout_status", ["submitted", "confirmed", "rejected"]);
export const claimStatusEnum = pgEnum("claim_status", ["pending", "approved", "declined"]);

// ── Identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("member"),
  /** Shown on the Honor Roll only if true. Default private. */
  showOnHonorRoll: boolean("show_on_honor_roll").notNull().default(false),
  city: text("city"),
  /** KYC-lite fields, envelope-encrypted (see security/crypto.ts). Never public. */
  legalNameEnc: text("legal_name_enc"),
  addressEnc: text("address_enc"),
  /** Set once the account has a passkey (or is a seeded demo account). Gates voting. */
  verifiedAt: ts("verified_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const passkeys = pgTable(
  "passkeys",
  {
    id: text("id").primaryKey(), // base64url credential id
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: bytea("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").array(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastUsedAt: ts("last_used_at"),
  },
  (t) => [index("passkeys_user_idx").on(t.userId)],
);

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  challenge: text("challenge").notNull(),
  kind: text("kind", { enum: ["register", "login"] }).notNull(),
  /** For registration: the pending display name. */
  displayName: text("display_name"),
  expiresAt: ts("expires_at").notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the cookie token — the raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    /** Step-up: when the user last re-verified with a passkey. */
    elevatedUntil: ts("elevated_until"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ── Bills ───────────────────────────────────────────────────────────────────

/** Known-biller directory (utilities, landlords, hospitals the partner can pay). */
export const billers = pgTable("billers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  category: categoryEnum("category").notNull(),
  partnerBillerId: text("partner_biller_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    posterId: uuid("poster_id")
      .notNull()
      .references(() => users.id),
    billerId: uuid("biller_id").references(() => billers.id),
    billerName: text("biller_name").notNull(),
    category: categoryEnum("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    /** 280 chars max, PII-redacted, moderated before publish. */
    story: text("story"),
    /** Public attribution: first name + city only, and only if not anonymous. */
    posterFirstName: text("poster_first_name"),
    posterCity: text("poster_city"),
    anonymous: boolean("anonymous").notNull().default(false),
    /** Tokenized biller account number (lives in the vault); last 4 for reviewers. */
    accountToken: text("account_token").notNull(),
    accountLast4: text("account_last4").notNull(),
    status: billStatusEnum("status").notNull().default("pending_review"),
    fundedCents: integer("funded_cents").notNull().default(0),
    voteCount: integer("vote_count").notNull().default(0),
    /** Automated verification signals (forensics, duplicates, directory match). */
    flags: jsonb("flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Feature-hashed vector over redacted fields, for near-duplicate detection. */
    fingerprint: real("fingerprint").array().notNull(),
    /** Encrypted upload in the sandbox store; null once purged. */
    uploadKey: text("upload_key"),
    uploadPurgeAfter: ts("upload_purge_after"),
    extractedBy: text("extracted_by", { enum: ["manual", "anthropic"] }).notNull().default("manual"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    publishedAt: ts("published_at"),
    paidAt: ts("paid_at"),
    thankYou: text("thank_you"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("bills_status_idx").on(t.status), index("bills_poster_idx").on(t.posterId)],
);

export const votes = pgTable(
  "votes",
  {
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.billId, t.userId] }), index("votes_user_time_idx").on(t.userId, t.createdAt)],
);

// ── Money ───────────────────────────────────────────────────────────────────

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id),
    donorId: uuid("donor_id").references(() => users.id),
    /** Amount that goes to the biller. */
    amountCents: integer("amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    processingFeeCents: integer("processing_fee_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    anonymous: boolean("anonymous").notNull().default(false),
    status: contributionStatusEnum("status").notNull().default("pending"),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    succeededAt: ts("succeeded_at"),
  },
  (t) => [index("contributions_bill_idx").on(t.billId), index("contributions_donor_idx").on(t.donorId)],
);

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id)
    .unique(),
  partnerRef: text("partner_ref").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  status: payoutStatusEnum("status").notNull().default("submitted"),
  createdAt: ts("created_at").notNull().defaultNow(),
  resolvedAt: ts("resolved_at"),
});

/** Webhook idempotency: every processed event id is recorded exactly once. */
export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey(),
  source: text("source", { enum: ["stripe", "billpay"] }).notNull(),
  processedAt: ts("processed_at").notNull().defaultNow(),
});

// ── Luminaries (the billionaire board) ──────────────────────────────────────

export const luminaries = pgTable("luminaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Which public list they came from, and a link to it. */
  listSource: text("list_source").notNull(),
  listSourceUrl: text("list_source_url").notNull(),
  /** Publicly documented philanthropy elsewhere, always with a source. */
  knownGiving: text("known_giving"),
  knownGivingSourceUrl: text("known_giving_source_url"),
  /** Set when the person or their office claims the profile. */
  userId: uuid("user_id").references(() => users.id),
  statement: text("statement"),
  claimedAt: ts("claimed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const profileClaims = pgTable("profile_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  luminaryId: uuid("luminary_id")
    .notNull()
    .references(() => luminaries.id),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id),
  /** Encrypted: office contact details used to verify the claim offline. */
  contactEnc: text("contact_enc").notNull(),
  status: claimStatusEnum("status").notNull().default("pending"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ── Security ────────────────────────────────────────────────────────────────

/** Tamper-evident, append-only audit log (hash chained). */
export const auditLog = pgTable("audit_log", {
  seq: bigserial("seq", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});

/**
 * Tokenization vault. In production this table lives in a separate database in
 * a separate cloud account, behind its own service with its own KMS key.
 */
export const vaultEntries = pgTable("vault_entries", {
  token: text("token").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  purgeAfter: ts("purge_after"),
});
