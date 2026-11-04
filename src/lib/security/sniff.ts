/** Magic-byte file type detection. Never trust the client's Content-Type or extension. */
export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function sniffType(buf: Uint8Array): SniffedType | null {
  const at = (i: number) => buf[i];
  if (buf.length < 12) return null;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a) return "image/png";
  if (String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...buf.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EDITOR_HINTS = /photoshop|gimp|affinity|pixelmator|canva|illustrator|inkscape|paint\.net|acrobat pro|pdf-?xchange|sejda|smallpdf|ilovepdf/i;

/** Document forensics: signals that a bill may have been edited. Advisory only — flags route to human review. */
export function forensicFlags(input: { software?: string | null; producer?: string | null; pdfIncrementalUpdates?: number }): string[] {
  const flags: string[] = [];
  if (input.software && EDITOR_HINTS.test(input.software)) flags.push(`edited_with:${input.software.slice(0, 40)}`);
  if (input.producer && EDITOR_HINTS.test(input.producer)) flags.push(`pdf_producer:${input.producer.slice(0, 40)}`);
  if ((input.pdfIncrementalUpdates ?? 0) > 1) flags.push("pdf_modified_after_creation");
  return flags;
}

/** Cheap PDF metadata read (Producer + count of incremental-update %%EOF markers). */
export function pdfMeta(buf: Buffer): { producer: string | null; incrementalUpdates: number } {
  const text = buf.toString("latin1");
  const producer = /\/Producer\s*\(([^)]{0,120})\)/.exec(text)?.[1] ?? null;
  const incrementalUpdates = (text.match(/%%EOF/g) ?? []).length;
  return { producer, incrementalUpdates };
}
