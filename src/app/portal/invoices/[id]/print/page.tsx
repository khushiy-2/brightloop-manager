import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { idSchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { getCustomerInvoice } from "@/server/services/customer-portal.service";

export const instant = false;

function money(value: { toFixed: (digits: number) => string }) {
  return `$${value.toFixed(2)}`;
}

export default async function CustomerInvoicePrintPage({
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
    <article className="print-page">
      <div className="print-toolbar">
        <Link className="quiet-button" href={`/portal/invoices/${invoice.id}`}>Back to invoice</Link>
        <PrintButton />
      </div>
      <header className="print-heading">
        <div><p className="eyebrow">BRIGHTLOOP</p><h1>Invoice</h1></div>
        <div className="print-invoice-number"><strong>{invoice.number}</strong><span>{invoice.status}</span></div>
      </header>
      <div className="print-parties">
        <section>
          <h2>Bill to</h2>
          <strong>{invoice.customer.company || invoice.customer.name}</strong>
          {invoice.customer.company && <span>{invoice.customer.name}</span>}
          <span>{invoice.customer.email}</span>
          {invoice.customer.address && <span>{invoice.customer.address}</span>}
          {invoice.customer.taxId && <span>Tax ID: {invoice.customer.taxId}</span>}
        </section>
        <dl>
          <div><dt>Issue date</dt><dd>{invoice.issueDate.toLocaleDateString()}</dd></div>
          <div><dt>Due date</dt><dd>{invoice.dueDate.toLocaleDateString()}</dd></div>
          <div><dt>Service period</dt><dd>{invoice.periodStart.toLocaleDateString()} – {invoice.periodEnd.toLocaleDateString()}</dd></div>
          <div><dt>Subscription</dt><dd>{invoice.subscription.number}</dd></div>
        </dl>
      </div>
      <table className="print-lines">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td>{money(line.unitPrice)}</td>
              <td>{money(line.discountAmount)}</td>
              <td>{money(line.taxAmount)}</td>
              <td>{money(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="print-totals">
        <div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div>
        <div><span>Discounts</span><strong>−{money(invoice.discountTotal)}</strong></div>
        <div><span>Tax</span><strong>{money(invoice.taxTotal)}</strong></div>
        <div className="invoice-grand-total"><span>Total due</span><strong>{money(invoice.total)}</strong></div>
        <div><span>Paid</span><strong>{money(invoice.amountPaid)}</strong></div>
      </div>
    </article>
  );
}
