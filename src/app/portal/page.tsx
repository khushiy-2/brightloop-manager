import Link from "next/link";
import { requireRole } from "@/server/auth/guards";

export default async function PortalPage() {
  await requireRole("CUSTOMER");

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER SPACE</p>
        <h1>Customer Portal</h1>
        <p className="page-intro">View your subscriptions and billing history.</p>
      </div>
      <div className="portal-shortcuts">
        <Link className="portal-shortcut" href="/portal/subscriptions">
          <strong>My subscriptions</strong>
          <span>Review your current and past subscriptions.</span>
        </Link>
        <Link className="portal-shortcut" href="/portal/invoices">
          <strong>My invoices</strong>
          <span>View invoices, payments, and printable copies.</span>
        </Link>
      </div>
    </section>
  );
}