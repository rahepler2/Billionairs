import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/SignOutButton";
import { Logo } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lifted — Real bills. Real people. Real generosity.", template: "%s · Lifted" },
  description:
    "Lifted pays verified household bills directly to the biller. Every Lift is on the record, and every giver earns a place on the Honor Roll.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo" aria-label="Lifted home">
              <Logo /> Lifted
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/bills">Bills</Link>
              <Link href="/honor-roll">Honor Roll</Link>
              <Link href="/post" className="hide-sm">
                Ask for help
              </Link>
              {user?.role === "reviewer" || user?.role === "admin" ? <Link href="/review">Review</Link> : null}
              {user ? (
                <>
                  <Link href="/account" className="hide-sm">
                    {user.displayName}
                  </Link>
                  <SignOutButton />
                </>
              ) : (
                <Link href="/signin" className="btn sm">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="container row spread">
            <span>© {new Date().getFullYear()} Lifted. Money goes to the biller, never to us or the poster.</span>
            <span className="row">
              <Link href="/methodology">Methodology</Link>
              <Link href="/privacy">Privacy &amp; security</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
