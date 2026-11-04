import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section narrow center">
      <h1>Nothing here</h1>
      <p className="muted">That page doesn&apos;t exist, or the bill has been resolved.</p>
      <Link className="btn" href="/bills">
        Browse bills
      </Link>
    </div>
  );
}
