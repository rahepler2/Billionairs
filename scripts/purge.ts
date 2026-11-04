/**
 * Retention job. Run on a schedule (e.g. hourly):
 *  - raw bill uploads older than 7 days are destroyed, even if never reviewed
 *  - vault entries past their purge date (paid + 90 days) are destroyed
 *  - expired sessions and auth challenges are removed
 */
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import { deleteUpload } from "@/lib/security/uploads";
import { purgeExpired } from "@/lib/security/vault";

async function main() {
  const now = new Date();
  const stale = await db()
    .select({ id: schema.bills.id, key: schema.bills.uploadKey })
    .from(schema.bills)
    .where(and(isNotNull(schema.bills.uploadKey), lt(schema.bills.uploadPurgeAfter, now)));
  for (const b of stale) {
    if (b.key) await deleteUpload(b.key);
    await db().update(schema.bills).set({ uploadKey: null, uploadPurgeAfter: null }).where(eq(schema.bills.id, b.id));
  }
  const vault = await purgeExpired(now);
  await db().delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db().delete(schema.authChallenges).where(lt(schema.authChallenges.expiresAt, now));
  await audit("retention.purge", { meta: { uploads: stale.length, vaultEntries: vault.length } });
  console.log(`Purged ${stale.length} uploads and ${vault.length} vault entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
