"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Status = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "CLOSED";
type Discount = {
  id: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: string;
  scope: "PRODUCT" | "SUBSCRIPTION";
};
type SubscriptionView = {
  id: string;
  number: string;
  status: Status;
  startDate: string;
  expiryDate: string;
  quotationValidUntil: string | null;
  billedCount: number;
  nextBillingDate: string | null;
  notes: string | null;
  customer: { id: string; name: string; email: string; company: string | null };
  plan: { id: string; name: string; period: string; minQuantity: number; pausable: boolean; closable: boolean; renewable: boolean };
  template: { id: string; name: string; validityDays: number } | null;
  paymentTerm: { id: string; name: string; days: number };
  lines: {
    id: string;
    quantity: number;
    unitPrice: string;
    amount: string;
    product: { id: string; name: string };
    variant: { id: string; attribute: string; value: string } | null;
    tax: { id: string; name: string; type: string; rate: string } | null;
  }[];
  discounts: { discount: Discount }[];
  events: {
    id: string;
    fromStatus: Status | null;
    toStatus: Status;
    action: string;
    createdAt: string;
    actor: { id: string; name: string } | null;
  }[];
};

const steps: { status: Status; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "QUOTATION", label: "Quotation" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "ACTIVE", label: "Active" },
  { status: "CLOSED", label: "Closed" },
];
const statusNames: Record<Status, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function getAllowedActions(subscription: SubscriptionView) {
  switch (subscription.status) {
    case "DRAFT":
      return [{ action: "send_quotation", label: "Send quotation" }, { action: "cancel", label: "Cancel subscription" }];
    case "QUOTATION":
      return [{ action: "confirm", label: "Confirm" }, { action: "cancel", label: "Cancel subscription" }];
    case "CONFIRMED":
      return [{ action: "activate", label: "Activate" }, { action: "cancel", label: "Cancel subscription" }];
    case "ACTIVE":
      return [
        ...(subscription.plan.pausable ? [{ action: "pause", label: "Pause" }] : []),
        ...(subscription.plan.closable ? [{ action: "close", label: "Close" }] : []),
        ...(subscription.plan.renewable ? [{ action: "renew", label: "Renew" }] : []),
      ];
    case "PAUSED":
      return [{ action: "resume", label: "Resume" }];
    case "CLOSED":
      return [];
  }
}

export function SubscriptionDetail({
  subscription,
  availableDiscounts,
}: {
  subscription: SubscriptionView;
  availableDiscounts: Discount[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discountId, setDiscountId] = useState("");
  const index = subscription.status === "PAUSED"
    ? 3
    : steps.findIndex((step) => step.status === subscription.status);
  const actions = getAllowedActions(subscription);

  async function post(url: string, method: "POST" | "DELETE", body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The request failed.");
  }

  async function runAction(action: string, label: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post(`/api/subscriptions/${subscription.id}/actions`, "POST", { action });
      setNotice(`${label} completed.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function attachDiscount() {
    if (!discountId) return;
    setBusy(true);
    setError("");
    try {
      await post(`/api/subscriptions/${subscription.id}/discounts`, "POST", { discountId });
      setDiscountId("");
      setNotice("Discount attached.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to attach discount.");
    } finally {
      setBusy(false);
    }
  }

  async function detachDiscount(id: string) {
    setBusy(true);
    setError("");
    try {
      await post(`/api/subscriptions/${subscription.id}/discounts`, "DELETE", { discountId: id });
      setNotice("Discount detached.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to detach discount.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">SUBSCRIPTION {subscription.number}</p>
          <h1>{subscription.customer.name}</h1>
          <p className="page-intro">{subscription.plan.name} · {subscription.customer.email}</p>
        </div>
        <div className="subscription-actions">
          {(subscription.status === "DRAFT" || subscription.status === "QUOTATION") && (
            <Link className="quiet-button" href={`/subscriptions/${subscription.id}/edit`}>Edit</Link>
          )}
          <Link className="quiet-button" href="/subscriptions">Back to subscriptions</Link>
        </div>
      </div>
      <ol className="subscription-stepper" aria-label="Subscription status">
        {steps.map((step, stepIndex) => (
          <li key={step.status} className={stepIndex < index ? "step-complete" : stepIndex === index ? "step-current" : ""} aria-current={stepIndex === index ? "step" : undefined}>
            {step.label}
          </li>
        ))}
      </ol>
      <div className="subscription-detail-grid">
        <div><dt>Status</dt><dd>{statusNames[subscription.status]}</dd></div>
        <div><dt>Customer</dt><dd>{subscription.customer.company ?? subscription.customer.name}</dd></div>
        <div><dt>Plan</dt><dd>{subscription.plan.name} ({subscription.plan.period.toLowerCase()})</dd></div>
        <div><dt>Start date</dt><dd>{dateLabel(subscription.startDate)}</dd></div>
        <div><dt>Expiry date</dt><dd>{dateLabel(subscription.expiryDate)}</dd></div>
        <div><dt>Next billing date</dt><dd>{dateLabel(subscription.nextBillingDate)}</dd></div>
        <div><dt>Quotation valid until</dt><dd>{dateLabel(subscription.quotationValidUntil)}</dd></div>
        <div><dt>Payment terms</dt><dd>{subscription.paymentTerm.name}</dd></div>
        <div><dt>Billed count</dt><dd>{subscription.billedCount}</dd></div>
      </div>
      {actions.length > 0 && (
        <div className="subscription-actions">
          {actions.map(({ action, label }) => (
            <button
              key={action}
              className={action === "close" || action === "cancel" ? "danger-button" : "primary-button create-button"}
              type="button"
              disabled={busy}
              onClick={() => void runAction(action, label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {notice && <p className="form-message form-success" role="status">{notice}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <section className="subscription-detail-section">
        <h2>Subscription lines</h2>
        <div className="admin-table-scroll">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead>Quantity</TableHead><TableHead>Unit price</TableHead><TableHead>Tax</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {subscription.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.product.name}</TableCell>
                  <TableCell>{line.variant ? `${line.variant.attribute}: ${line.variant.value}` : "—"}</TableCell>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>{line.unitPrice}</TableCell>
                  <TableCell>{line.tax?.name ?? "—"}</TableCell>
                  <TableCell>{line.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {subscription.notes && <p className="muted-copy">{subscription.notes}</p>}
      </section>
      <section className="subscription-detail-section">
        <h2>Attached discounts</h2>
        {subscription.discounts.length ? (
          <ul className="discount-attachment-list">
            {subscription.discounts.map(({ discount }) => (
              <li key={discount.id}>
                <span>{discount.name} · {discount.value}{discount.type === "PERCENT" ? "%" : ""} · {discount.scope.toLowerCase()}</span>
                <button className="danger-button" type="button" disabled={busy} onClick={() => void detachDiscount(discount.id)}>Detach</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted-copy">No discounts attached.</p>}
        <div className="subscription-actions">
          <select aria-label="Discount to attach" value={discountId} onChange={(event) => setDiscountId(event.currentTarget.value)}>
            <option value="">Select an available discount</option>
            {availableDiscounts.map((discount) => (
              <option key={discount.id} value={discount.id}>{discount.name} · {discount.value}{discount.type === "PERCENT" ? "%" : ""}</option>
            ))}
          </select>
          <button className="quiet-button" type="button" disabled={busy || !discountId} onClick={() => void attachDiscount()}>Attach discount</button>
        </div>
      </section>
      <section className="subscription-detail-section">
        <h2>Event history</h2>
        {subscription.events.length ? (
          <ul className="subscription-event-list">
            {subscription.events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                <span>{event.action.replaceAll("_", " ")} · {event.fromStatus ? statusNames[event.fromStatus] : "—"} → {statusNames[event.toStatus]}</span>
                <span>{event.actor?.name ?? "System"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted-copy">No subscription events.</p>}
      </section>
    </section>
  );
}
