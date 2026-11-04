import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { openBytes, randomToken, sealBytes } from "./crypto";
import { dataKeys } from "./keys";
import { MAX_UPLOAD_BYTES, forensicFlags, pdfMeta, sniffType, type SniffedType } from "./sniff";

/**
 * Upload pipeline: size limit → magic-byte sniff → forensics on original
 * metadata → re-render images to a clean JPEG (drops EXIF/GPS, embedded
 * payloads, polyglots) → encrypt → store in the sandbox store with a 7-day TTL.
 *
 * Local dev uses a directory; production uses an isolated bucket that only the
 * no-network processing sandbox can read, with object-lock lifecycle deletion.
 */
const STORE = path.resolve(process.cwd(), ".uploads");
export const UPLOAD_TTL_MS = 7 * 86_400_000;

export class UploadRejected extends Error {}

export interface ProcessedUpload {
  key: string;
  mediaType: "image/jpeg" | "application/pdf";
  /** Sanitized bytes, kept in memory only for the extraction call. */
  sanitized: Buffer;
  flags: string[];
}

export async function processUpload(raw: Buffer): Promise<ProcessedUpload> {
  if (raw.length === 0) throw new UploadRejected("Empty file");
  if (raw.length > MAX_UPLOAD_BYTES) throw new UploadRejected("File is larger than 10 MB");
  const type: SniffedType | null = sniffType(raw);
  if (!type) throw new UploadRejected("Only JPEG, PNG, WebP or PDF bills are accepted");

  let sanitized: Buffer;
  let flags: string[];
  let mediaType: ProcessedUpload["mediaType"];

  if (type === "application/pdf") {
    const meta = pdfMeta(raw);
    flags = forensicFlags({ producer: meta.producer, pdfIncrementalUpdates: meta.incrementalUpdates });
    if (/\/JavaScript|\/JS\s|\/Launch|\/EmbeddedFile/.test(raw.toString("latin1"))) {
      throw new UploadRejected("PDF contains active content and was rejected");
    }
    // Production: rasterize inside the sandbox (e.g. pdftoppm) so only pixels survive.
    sanitized = raw;
    mediaType = "application/pdf";
  } else {
    let software: string | null = null;
    try {
      const meta = await sharp(raw, { limitInputPixels: 40_000_000 }).metadata();
      if (meta.exif) software = /Software\0*([\x20-\x7e]{2,60})/.exec(meta.exif.toString("latin1"))?.[1] ?? null;
      sanitized = await sharp(raw, { limitInputPixels: 40_000_000 })
        .rotate() // apply EXIF orientation before metadata is dropped
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer(); // sharp strips all metadata unless .withMetadata() is called
    } catch {
      throw new UploadRejected("Image could not be decoded");
    }
    flags = forensicFlags({ software });
    mediaType = "image/jpeg";
  }

  const key = `${randomToken(18)}-${mediaType === "application/pdf" ? "pdf" : "jpg"}.bin`;
  await mkdir(STORE, { recursive: true, mode: 0o700 });
  await writeFile(path.join(STORE, key), sealBytes(dataKeys(), sanitized, `upload:${key}:${mediaType}`), { mode: 0o600 });
  return { key, mediaType, sanitized, flags };
}

function safePath(key: string) {
  if (!/^[A-Za-z0-9_-]+\.bin$/.test(key)) throw new Error("Bad upload key");
  return path.join(STORE, key);
}

export const uploadMediaType = (key: string): ProcessedUpload["mediaType"] => (key.endsWith("-pdf.bin") ? "application/pdf" : "image/jpeg");

export async function readUpload(key: string): Promise<{ bytes: Buffer; mediaType: ProcessedUpload["mediaType"] }> {
  const mediaType = uploadMediaType(key);
  return { bytes: openBytes(dataKeys(), await readFile(safePath(key)), `upload:${key}:${mediaType}`), mediaType };
}

export async function deleteUpload(key: string) {
  await rm(safePath(key), { force: true });
}
