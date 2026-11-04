import "server-only";
import { env } from "@/lib/env";
import { keyProviderFromSecret, type KeyProvider } from "./crypto";

let data: KeyProvider | undefined;
let vault: KeyProvider | undefined;

/** KEK for field-level encryption of PII in the main database. */
export const dataKeys = () => (data ??= keyProviderFromSecret(env().DATA_MASTER_KEY, "data"));
/** Separate KEK for the tokenization vault. Never shared with the main DB. */
export const vaultKeys = () => (vault ??= keyProviderFromSecret(env().VAULT_MASTER_KEY, "vault"));
