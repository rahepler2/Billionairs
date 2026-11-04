import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy & security" };

export default function Privacy() {
  return (
    <div className="container section narrow stack">
      <h1>Privacy &amp; security</h1>
      <p className="muted">If we don&apos;t store it, it can&apos;t leak. Here is what we keep, why, and for how long.</p>
      <div className="table-wrap card flat">
        <table className="honor-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Where it lives</th>
              <th>Kept for</th>
              <th>Public?</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Bill photo or PDF</td><td>Encrypted sandbox store</td><td>Until verified, max 7 days</td><td>Never</td></tr>
            <tr><td>Biller account number</td><td>Separate encrypted vault</td><td>Until paid + 90 days</td><td>Never</td></tr>
            <tr><td>Legal name, address</td><td>Field-level encryption</td><td>Account life + legal minimum</td><td>Never</td></tr>
            <tr><td>Biller, amount, due date</td><td>Main database</td><td>Life of post</td><td>Yes</td></tr>
            <tr><td>First name + city</td><td>Main database</td><td>Life of post</td><td>Only if you choose</td></tr>
            <tr><td>Card details</td><td>Stripe only</td><td>Stripe&apos;s policy</td><td>Never</td></tr>
            <tr><td>Giver name</td><td>Main database</td><td>Account life</td><td>Only if you opt in</td></tr>
          </tbody>
        </table>
      </div>
      <h2>How we protect it</h2>
      <ul>
        <li>Passkey sign-in: no passwords to steal or phish.</li>
        <li>Personal details are redacted from stories automatically, and photos are re-rendered to strip hidden data like GPS location.</li>
        <li>Card data goes straight to Stripe and never touches our servers.</li>
        <li>Money goes from you to the biller through a licensed partner. Lifted never holds funds.</li>
        <li>Every staff view of a document is logged in a tamper-evident audit trail.</li>
        <li>No data sales, no ad tracking, no third-party analytics.</li>
      </ul>
      <p>You can download or delete your data at any time from your account page.</p>
    </div>
  );
}
