/**
 * PII redaction for any free text that a human reviewer, the public, or a
 * model provider might see (stories, extracted text). Conservative by design:
 * false positives just mask a harmless number.
 */
const PATTERNS: [RegExp, string][] = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]"],
  [/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]"],
  // Street addresses: number + words + common suffix.
  [
    /\b\d{1,6}\s+(?:[A-Z][a-z]+\s){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace|Pkwy|Hwy)\b\.?(?:\s*(?:Apt|Unit|#)\s*\w+)?/g,
    "[address]",
  ],
  // Any remaining run of 6+ digits (account numbers, card numbers), allowing separators.
  [/\b(?:\d[\s-]?){6,}\d\b/g, "[number]"],
];

export function redactPII(text: string): string {
  return PATTERNS.reduce((acc, [re, label]) => acc.replace(re, label), text);
}

export function containsPII(text: string): boolean {
  return redactPII(text) !== text;
}
