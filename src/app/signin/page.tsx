import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/SignInPanel";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await currentUser()) redirect("/bills");
  const demo = env().ALLOW_DEMO_LOGIN && env().NODE_ENV !== "production";
  return (
    <div className="container section narrow">
      <h1>Welcome to Lifted</h1>
      <p className="muted">
        Lifted uses passkeys: sign in with your fingerprint, face or device PIN. No passwords to steal, nothing to phish.
      </p>
      <SignInPanel demoAccounts={demo ? Object.entries(DEMO_ACCOUNTS).map(([key, v]) => ({ key, label: v.label })) : []} />
    </div>
  );
}
