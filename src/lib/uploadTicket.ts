import "server-only";
import { z } from "zod";
import { open, seal } from "@/lib/security/crypto";
import { dataKeys } from "@/lib/security/keys";

/**
 * An upload ticket is an authenticated-encrypted blob the server hands back
 * after processing an upload. It binds the stored file, the forensic/model
 * flags, and the uploader, so a client can't strip flags or reuse someone
 * else's upload when it submits the bill.
 */
const ticketSchema = z.object({
  key: z.string(),
  flags: z.array(z.string()),
  extractedBy: z.enum(["manual", "anthropic"]),
  exp: z.number(),
});
export type UploadTicket = z.infer<typeof ticketSchema>;

export const sealTicket = (userId: string, t: Omit<UploadTicket, "exp">) =>
  seal(dataKeys(), JSON.stringify({ ...t, exp: Date.now() + 2 * 3_600_000 }), `upload-ticket:${userId}`);

export function openTicket(userId: string, sealed: string): UploadTicket | null {
  try {
    const t = ticketSchema.parse(JSON.parse(open(dataKeys(), sealed, `upload-ticket:${userId}`)));
    return t.exp > Date.now() ? t : null;
  } catch {
    return null;
  }
}
