import Link from "next/link";
import { pageQuerySchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listCustomerSubscriptions } from "@/server/services/customer-portal.service";

export const instant = false;

function pageFrom(value: string | string[] | undefined) {
  const parsed = pageQuerySchema.safeParse({ page: typeof value === "string" ? value : undefined });
  return parsed.success ? parsed.data.page : 1;
}

export default async function CustomerSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole("CUSTOMER");
  const params = await searchParams;
  const page = pageFrom(params.page);
  const result = await listCustomerSubscriptions(user.id, page);

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER SPACE</p>
        <h1>My subscriptions</h1>
      </div>
      <section className="admin-table-panel">
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>Subscription</th><th>Plan</th><th>Status</th><th>Start date</th><th>Expiry date</th></tr></thead>
            <tbody>
              {result.items.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.number}</td>
                  <td>{subscription.plan.name}</td>
                  <td><span className={`status-pill status-${subscription.status.toLowerCase()}`}>{subscription.status}</span></td>
                  <td>{subscription.startDate.toLocaleDateString()}</td>
                  <td>{subscription.expiryDate.toLocaleDateString()}</td>
                </tr>
              ))}
              {result.items.length === 0 && <tr><td className="table-empty" colSpan={5}>You do not have any subscriptions yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <nav className="pagination-bar" aria-label="Subscription pages">
          <span>Page {result.page} of {result.pageCount}</span>
          <div>
            {result.page > 1
              ? <Link className="quiet-button" href={`/portal/subscriptions?page=${result.page - 1}`}>Previous</Link>
              : <button className="quiet-button" type="button" disabled>Previous</button>}
            {result.page < result.pageCount
              ? <Link className="quiet-button" href={`/portal/subscriptions?page=${result.page + 1}`}>Next</Link>
              : <button className="quiet-button" type="button" disabled>Next</button>}
          </div>
        </nav>
      </section>
    </section>
  );
}
