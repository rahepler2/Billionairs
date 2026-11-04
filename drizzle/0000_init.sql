CREATE TYPE "public"."bill_status" AS ENUM('pending_review', 'live', 'funded', 'paid', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."bill_category" AS ENUM('utility', 'rent', 'medical', 'childcare', 'internet', 'other');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('pending', 'succeeded', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('submitted', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('member', 'reviewer', 'admin');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" text NOT NULL,
	"kind" text NOT NULL,
	"display_name" text,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" "bill_category" NOT NULL,
	"partner_biller_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billers_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poster_id" uuid NOT NULL,
	"biller_id" uuid,
	"biller_name" text NOT NULL,
	"category" "bill_category" NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"story" text,
	"poster_first_name" text,
	"poster_city" text,
	"anonymous" boolean DEFAULT false NOT NULL,
	"account_token" text NOT NULL,
	"account_last4" text NOT NULL,
	"status" "bill_status" DEFAULT 'pending_review' NOT NULL,
	"funded_cents" integer DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fingerprint" real[] NOT NULL,
	"upload_key" text,
	"upload_purge_after" timestamp with time zone,
	"extracted_by" text DEFAULT 'manual' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"thank_you" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"donor_id" uuid,
	"amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"processing_fee_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded_at" timestamp with time zone,
	CONSTRAINT "contributions_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "luminaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"list_source" text NOT NULL,
	"list_source_url" text NOT NULL,
	"known_giving" text,
	"known_giving_source_url" text,
	"user_id" uuid,
	"statement" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "luminaries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"partner_ref" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payout_status" DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "payouts_bill_id_unique" UNIQUE("bill_id"),
	CONSTRAINT "payouts_partner_ref_unique" UNIQUE("partner_ref")
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"luminary_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"contact_enc" text NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"elevated_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"show_on_honor_roll" boolean DEFAULT false NOT NULL,
	"city" text,
	"legal_name_enc" text,
	"address_enc" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_entries" (
	"token" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"bill_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_bill_id_user_id_pk" PRIMARY KEY("bill_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_biller_id_billers_id_fk" FOREIGN KEY ("biller_id") REFERENCES "public"."billers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luminaries" ADD CONSTRAINT "luminaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_luminary_id_luminaries_id_fk" FOREIGN KEY ("luminary_id") REFERENCES "public"."luminaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bills_poster_idx" ON "bills" USING btree ("poster_id");--> statement-breakpoint
CREATE INDEX "contributions_bill_idx" ON "contributions" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "contributions_donor_idx" ON "contributions" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "passkeys_user_idx" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "votes_user_time_idx" ON "votes" USING btree ("user_id","created_at");