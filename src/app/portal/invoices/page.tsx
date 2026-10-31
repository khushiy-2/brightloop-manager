import Link from "next/link";
import { pageQuerySchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listCustomerInvoices } from "@/server/services/customer-portal.service";

export const instant = false;

function pageFrom(value: string | string[] | undefined) {
  const parsed = pageQuerySchema.safeParse({ page: typeof value === "string" ? value : undefined });
  return parsed.success ? parsed.data.page : 1;
}

function money(value: { toFixed: (digits: number) => string }) {
  return `$${value.toFixed(2)}`;
}

export default async function CustomerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole("CUSTOMER");
  const params = await searchParams;
  const page = pageFrom(params.page);
  const result = await listCustomerInvoices(user.id, page);

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">CUSTOMER SPACE</p>
        <h1>My invoices</h1>
      </div>
      <section className="admin-table-panel">
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>Invoice</th><th>Subscription</th><th>Issue date</th><th>Due date</th><th>Status</th><th>Total</th><th>Paid</th></tr></thead>
            <tbody>
              {result.items.map((invoice) => (
                <tr key={invoice.id}>
                  <td><Link href={`/portal/invoices/${invoice.id}`}>{invoice.number}</Link></td>
                  <td>{invoice.subscription.number} · {invoice.subscription.plan.name}</td>
                  <td>{invoice.issueDate.toLocaleDateString()}</td>
                  <td>{invoice.dueDate.toLocaleDateString()}</td>
                  <td><span className={`status-pill status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                  <td>{money(invoice.total)}</td>
                  <td>{money(invoice.amountPaid)}</td>
                </tr>
              ))}
              {result.items.length === 0 && <tr><td className="table-empty" colSpan={7}>You do not have any invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <nav className="pagination-bar" aria-label="Invoice pages">
          <span>Page {result.page} of {result.pageCount}</span>
          <div>
            {result.page > 1
              ? <Link className="quiet-button" href={`/portal/invoices?page=${result.page - 1}`}>Previous</Link>
              : <button className="quiet-button" type="button" disabled>Previous</button>}
            {result.page < result.pageCount
              ? <Link className="quiet-button" href={`/portal/invoices?page=${result.page + 1}`}>Next</Link>
              : <button className="quiet-button" type="button" disabled>Next</button>}
          </div>
        </nav>
      </section>
    </section>
  );
}
