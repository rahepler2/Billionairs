"use client";
import { useRouter } from "next/navigation";
import { postJson } from "./api";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn ghost sm"
      onClick={async () => {
        await postJson("/api/auth/logout").catch(() => null);
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
