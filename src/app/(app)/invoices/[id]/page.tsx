import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceActions } from "@/components/admin/invoice-actions";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { idSchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { getInvoice } from "@/server/services/invoice.service";

export const instant = false;

function money(value: { toFixed: (digits: number) => string }) {
  return value.toFixed(2);
}

function dateLabel(value: Date) {
  return value.toLocaleDateString();
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const invoice = await getInvoice(parsedId.data);
  if (!invoice) notFound();

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">INVOICE {invoice.number}</p>
          <h1>{invoice.customer.name}</h1>
          <p className="page-intro">{invoice.customer.email} · {invoice.subscription.number}</p>
        </div>
        <div className="subscription-actions">
          {invoice.status === "CONFIRMED" && invoice.paymentStatus !== "Paid" && (
            <RecordPaymentDialog
              invoiceId={invoice.id}
              outstanding={invoice.total.sub(invoice.amountPaid).toString()}
            />
          )}
          <InvoiceActions id={invoice.id} status={invoice.status} amountPaid={invoice.amountPaid.toString()} />
          <Link className="quiet-button" href={`/invoices/${invoice.id}/print`}>Print view</Link>
          <Link className="quiet-button" href="/invoices">Back to invoices</Link>
        </div>
      </div>

      <dl className="subscription-detail-grid">
        <div><dt>Status</dt><dd>{invoice.status}</dd></div>
        <div><dt>Issue date</dt><dd>{dateLabel(invoice.issueDate)}</dd></div>
        <div><dt>Due date</dt><dd>{dateLabel(invoice.dueDate)}</dd></div>
        <div>
          <dt>Payment status</dt>
          <dd><span className={`status-pill status-${invoice.paymentStatus.toLowerCase()}`}>{invoice.paymentStatus}</span></dd>
        </div>
        <div><dt>Paid at</dt><dd>{invoice.paidAt ? dateLabel(invoice.paidAt) : "—"}</dd></div>
        <div><dt>Period</dt><dd>{dateLabel(invoice.periodStart)} – {dateLabel(invoice.periodEnd)}</dd></div>
        <div><dt>Confirmed</dt><dd>{invoice.confirmedAt ? dateLabel(invoice.confirmedAt) : "—"}</dd></div>
        <div><dt>Sent</dt><dd>{invoice.sentAt ? dateLabel(invoice.sentAt) : "—"}</dd></div>
      </dl>

      <section className="invoice-lines-panel">
        <h2>Invoice lines</h2>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax</th><th>Line total</th></tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}{line.tax ? <small>{line.tax.name} ({line.taxRate.toString()}{line.tax.type === "PERCENT" ? "%" : " per unit"})</small> : null}</td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unitPrice)}</td>
                  <td>{money(line.discountAmount)}</td>
                  <td>{money(line.taxAmount)}</td>
                  <td>{money(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="invoice-lines-panel">
        <h2>Payments</h2>
        {invoice.payments.length ? (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr><th>Paid at</th><th>Method</th><th>Amount</th><th>Reference</th><th>Note</th></tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paidAt.toLocaleString()}</td>
                    <td>{payment.method.replaceAll("_", " ")}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.reference ?? "—"}</td>
                    <td>{payment.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted-copy">No payments have been recorded.</p>}
      </section>

      <div className="invoice-bottom-grid">
        <section className="invoice-lines-panel">
          <h2>Applied discounts</h2>
          {invoice.discounts.length ? (
            <ul className="invoice-discount-list">
              {invoice.discounts.map(({ id, discount, amount }) => (
                <li key={id}><span>{discount.name}</span><strong>{money(amount)}</strong></li>
              ))}
            </ul>
          ) : <p className="muted-copy">No discounts were applied.</p>}
        </section>
        <section className="invoice-totals" aria-label="Invoice totals">
          <div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div>
          <div><span>Discounts</span><strong>−{money(invoice.discountTotal)}</strong></div>
          <div><span>Tax</span><strong>{money(invoice.taxTotal)}</strong></div>
          <div className="invoice-grand-total"><span>Total</span><strong>{money(invoice.total)}</strong></div>
          <div><span>Paid</span><strong>{money(invoice.amountPaid)}</strong></div>
          <div><span>Outstanding</span><strong>{money(invoice.total.sub(invoice.amountPaid))}</strong></div>
        </section>
      </div>
    </section>
  );
}
