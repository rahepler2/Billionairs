import { z } from "zod";

/** Launch limits (spec §1): raised later with trust score. */
export const MAX_BILL_CENTS = 250_000;
export const MAX_ACTIVE_BILLS = 1;
export const STORY_MAX = 280;
export const DAILY_VOTE_BUDGET = 10;
export const HUMAN_REVIEW_OVER_CENTS = 100_000;
export const THREE_DS_OVER_CENTS = 50_000;
export const MIN_CONTRIBUTION_CENTS = 500;

export const CATEGORIES = ["utility", "rent", "medical", "childcare", "internet", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  utility: "Utility",
  rent: "Rent",
  medical: "Medical",
  childcare: "Childcare",
  internet: "Internet",
  other: "Other essential",
};

const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !/[<>]/.test(s), "Please remove < and > characters");

export const billFieldsSchema = z.object({
  billerName: plainText(120).min(2, "Biller name is required"),
  category: z.enum(CATEGORIES),
  amountCents: z
    .number()
    .int()
    .min(1000, "Bills start at $10")
    .max(MAX_BILL_CENTS, `Bills are capped at $${MAX_BILL_CENTS / 100} during launch`),
  dueDate: z.iso.date("Due date must be YYYY-MM-DD"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{4,34}$/, "Account number should be 4-34 letters or digits"),
  story: plainText(STORY_MAX).optional().default(""),
  firstName: plainText(40).optional().default(""),
  city: plainText(60).optional().default(""),
  anonymous: z.boolean().default(false),
  legalName: plainText(120).min(2, "Legal name is required for verification"),
  address: plainText(240).min(5, "Address is required for verification"),
  /** Server-sealed ticket from /api/uploads binding the upload, its flags and the uploader. */
  uploadTicket: z.string().max(4000).optional(),
});
export type BillFields = z.infer<typeof billFieldsSchema>;

export const checkoutSchema = z.object({
  amountCents: z.number().int().min(MIN_CONTRIBUTION_CENTS, "Minimum contribution is $5").max(MAX_BILL_CENTS),
  anonymous: z.boolean().default(false),
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: plainText(500).optional(),
  publishStory: z.boolean().default(true),
});

export const claimSchema = z.object({
  contact: plainText(500).min(10, "Tell us how to reach the office to verify"),
});

export const displayNameSchema = plainText(40).min(2, "Name must be at least 2 characters");
