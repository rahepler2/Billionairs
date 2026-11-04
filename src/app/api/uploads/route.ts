import { NextResponse } from "next/server";
import { HttpError, assertSameOrigin, clientIp, handler, rateLimit, requireUser } from "@/lib/http";
import { extractBillFields } from "@/lib/llm/extract";
import { audit } from "@/lib/security/audit";
import { MAX_UPLOAD_BYTES } from "@/lib/security/sniff";
import { UploadRejected, processUpload } from "@/lib/security/uploads";
import { sealTicket } from "@/lib/uploadTicket";
import { env } from "@/lib/env";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("post", user.id, clientIp(req));
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64_000) throw new HttpError(413, "File is larger than 10 MB");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a photo or PDF of the bill");

  let processed;
  try {
    processed = await processUpload(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof UploadRejected) throw new HttpError(400, e.message);
    throw e;
  }
  const extraction = await extractBillFields(processed.sanitized, processed.mediaType);
  const extractedBy = extraction.fields ? "anthropic" : "manual";
  const flags = [...processed.flags, ...extraction.flags];
  await audit("upload.processed", { actorId: user.id, meta: { flags, extractedBy } });

  return NextResponse.json({
    ticket: sealTicket(user.id, { key: processed.key, flags, extractedBy }),
    provider: env().EXTRACTION_PROVIDER,
    fields: extraction.fields
      ? {
          billerName: extraction.fields.biller_name,
          category: extraction.fields.category,
          amountCents: extraction.fields.amount_due_cents,
          dueDate: extraction.fields.due_date,
        }
      : null,
  });
});
