import { describe, expect, it } from "vitest";
import { forensicFlags, pdfMeta, sniffType } from "@/lib/security/sniff";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("upload sniffing", () => {
  it("identifies by magic bytes, not extension", () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj"))).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("MZ\x90\x00 executable......"))).toBeNull();
  });

  it("flags editing software and incremental PDF saves", () => {
    expect(forensicFlags({ software: "Adobe Photoshop 25.0" })[0]).toMatch(/edited_with/);
    expect(forensicFlags({ software: "iOS 18.1" })).toEqual([]);
    const meta = pdfMeta(Buffer.from("%PDF-1.4 /Producer (Sejda PDF) %%EOF more %%EOF"));
    expect(meta.incrementalUpdates).toBe(2);
    expect(forensicFlags({ producer: meta.producer, pdfIncrementalUpdates: meta.incrementalUpdates })).toHaveLength(2);
  });
});
