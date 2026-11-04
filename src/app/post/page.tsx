import type { Metadata } from "next";
import Link from "next/link";
import { PostBillForm } from "@/components/PostBillForm";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask for help with a bill" };

export default async function PostPage() {
  const user = await currentUser();
  return (
    <div className="container section narrow">
      <p className="eyebrow">Ask for help</p>
      <h1>Post an essential bill</h1>
      <p className="muted">
        Utility, rent, medical, childcare and internet bills up to $2,500. Money goes straight to your biller, never through anyone&apos;s
        hands. Publicly, people only ever see your first name and city, or nothing at all if you stay anonymous.
      </p>
      {user ? (
        <PostBillForm aiExtraction={env().EXTRACTION_PROVIDER === "anthropic"} />
      ) : (
        <Link className="btn" href="/signin">
          Sign in to post a bill
        </Link>
      )}
    </div>
  );
}
