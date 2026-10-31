import Link from "next/link";
import { notFound } from "next/navigation";
import { idSchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { getCustomerInvoice } from "@/server/services/customer-portal.service";

export const instant = false;

function money(value: { toFixed: (digits: number) => string }) {
  return `$${value.toFixed(2)}`;
}

export default async function CustomerInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const invoice = await getCustomerInvoice(user.id, parsedId.data);
  if (!invoice) notFound();

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">INVOICE {invoice.number}</p>
          <h1>{invoice.customer.company || invoice.customer.name}</h1>
          <p className="page-intro">{invoice.subscription.number} · {invoice.subscription.plan.name}</p>
        </div>
        <div className="subscription-actions">
          <Link className="quiet-button" href={`/portal/invoices/${invoice.id}/print`}>Print view</Link>
          <Link className="quiet-button" href="/portal/invoices">Back to invoices</Link>
        </div>
      </div>
      <dl className="subscription-detail-grid">
        <div><dt>Status</dt><dd>{invoice.status}</dd></div>
        <div><dt>Payment status</dt><dd><span className={`status-pill status-${invoice.paymentStatus.toLowerCase()}`}>{invoice.paymentStatus}</span></dd></div>
        <div><dt>Issue date</dt><dd>{invoice.issueDate.toLocaleDateString()}</dd></div>
        <div><dt>Due date</dt><dd>{invoice.dueDate.toLocaleDateString()}</dd></div>
        <div><dt>Service period</dt><dd>{invoice.periodStart.toLocaleDateString()} – {invoice.periodEnd.toLocaleDateString()}</dd></div>
      </dl>
      <section className="invoice-lines-panel">
        <h2>Invoice lines</h2>
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Tax</th><th>Total</th></tr></thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}{line.variant && <small>{line.variant.attribute}: {line.variant.value}</small>}</td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unitPrice)}</td>
                  <td>{money(line.taxAmount)}</td>
                  <td>{money(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="invoice-bottom-grid">
        <section className="invoice-lines-panel">
          <h2>Payments</h2>
          {invoice.payments.length
            ? <ul className="invoice-discount-list">{invoice.payments.map((payment) => (
              <li key={payment.id}>
                <span>{payment.paidAt.toLocaleDateString()} · {payment.method.replaceAll("_", " ")}</span>
                <strong>{money(payment.amount)}</strong>
              </li>
            ))}</ul>
            : <p className="muted-copy">No payments have been recorded.</p>}
        </section>
        <section className="invoice-totals" aria-label="Invoice totals">
          <div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div>
          <div><span>Discount</span><strong>−{money(invoice.discountTotal)}</strong></div>
          <div><span>Tax</span><strong>{money(invoice.taxTotal)}</strong></div>
          <div className="invoice-grand-total"><span>Total</span><strong>{money(invoice.total)}</strong></div>
          <div><span>Paid</span><strong>{money(invoice.amountPaid)}</strong></div>
          <div><span>Outstanding</span><strong>{money(invoice.total.sub(invoice.amountPaid))}</strong></div>
        </section>
      </div>
    </section>
  );
}
