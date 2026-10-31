"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { subscriptionInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Values = z.infer<typeof subscriptionInputSchema>;
type EditorOptions = {
  customers: { id: string; name: string; email: string }[];
  plans: { id: string; name: string; period: string; minQuantity: number; availableFrom: string; availableTo: string | null }[];
  templates: {
    id: string;
    name: string;
    planId: string;
    validityDays: number;
    lines: { productId: string; variantId: string | null; quantity: number; taxId: string | null }[];
  }[];
  paymentTerms: { id: string; name: string; days: number }[];
  products: {
    id: string;
    name: string;
    salesPrice: string;
    defaultTaxId: string | null;
    variants: { id: string; attribute: string; value: string; extraPrice: string; unitPrice: string }[];
  }[];
  taxes: { id: string; name: string; type: "PERCENT" | "FIXED"; rate: string }[];
};
type ExistingSubscription = Values & { id: string; number: string };

function localDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function lineAmount(line: Values["lines"][number], options: EditorOptions) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(line.unitPrice)) return "—";
  const subtotal = new Prisma.Decimal(line.unitPrice).mul(line.quantity);
  const tax = options.taxes.find((option) => option.id === line.taxId);
  if (!tax) return subtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
  const taxAmount = tax.type === "PERCENT"
    ? subtotal.mul(tax.rate).div(100)
    : new Prisma.Decimal(tax.rate).mul(line.quantity);
  return subtotal.plus(taxAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export function SubscriptionEditor({
  options,
  initialValues,
  initialStartDate,
  initialExpiryDate,
}: {
  options: EditorOptions;
  initialValues?: ExistingSubscription;
  initialStartDate: string;
  initialExpiryDate: string;
}) {
  const router = useRouter();
  const firstProduct = options.products[0];
  const [values, setValues] = useState<Values>(initialValues ?? {
    customerId: options.customers[0]?.id ?? "",
    planId: options.plans[0]?.id ?? "",
    templateId: null,
    paymentTermId: options.paymentTerms[0]?.id ?? "",
    startDate: initialStartDate,
    expiryDate: initialExpiryDate,
    notes: null,
    lines: firstProduct ? [{
      productId: firstProduct.id,
      variantId: null,
      quantity: 1,
      unitPrice: firstProduct.salesPrice,
      taxId: firstProduct.defaultTaxId,
    }] : [],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedPlan = options.plans.find((plan) => plan.id === values.planId);
  const templatesForPlan = options.templates.filter((template) => template.planId === values.planId);
  const quantityTotal = values.lines.reduce((sum, line) => sum + line.quantity, 0);

  function defaultPrice(productId: string, variantId: string | null) {
    const product = options.products.find((option) => option.id === productId);
    if (!product) return "0.00";
    return product.variants.find((variant) => variant.id === variantId)?.unitPrice ?? product.salesPrice;
  }

  function updateLine(index: number, patch: Partial<Values["lines"][number]>) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  function applyTemplate(templateId: string) {
    const template = options.templates.find((option) => option.id === templateId);
    if (!template) {
      setValues((current) => ({ ...current, templateId: null }));
      return;
    }
    setValues((current) => ({
      ...current,
      planId: template.planId,
      templateId: template.id,
      lines: template.lines.map((line) => ({
        ...line,
        unitPrice: defaultPrice(line.productId, line.variantId),
        taxId: line.taxId ?? options.products.find((product) => product.id === line.productId)?.defaultTaxId ?? null,
      })),
    }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = subscriptionInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the subscription details.");
      return;
    }
    const normalized = {
      ...parsed.data,
      startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`).toISOString(),
      expiryDate: new Date(`${parsed.data.expiryDate}T00:00:00.000Z`).toISOString(),
    };
    setBusy(true);
    setError("");
    try {
      const response = await fetch(initialValues ? `/api/subscriptions/${initialValues.id}` : "/api/subscriptions", {
        method: initialValues ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const result = await response.json() as { error?: string; subscription?: { id: string } };
      if (!response.ok || !result.subscription) throw new Error(result.error ?? "Unable to save the subscription.");
      router.push(`/subscriptions/${result.subscription.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the subscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">CUSTOMER OPERATIONS</p>
          <h1>{initialValues ? `Edit ${initialValues.number}` : "New subscription"}</h1>
          <p className="page-intro">Choose a customer, plan, billing dates, and priced lines.</p>
        </div>
        <Link className="quiet-button" href={initialValues ? `/subscriptions/${initialValues.id}` : "/subscriptions"}>Cancel</Link>
      </div>
      <form className="subscription-editor-form" onSubmit={(event) => void save(event)}>
        <div className="subscription-form-grid">
          <label className="form-field">Customer
            <select value={values.customerId} onChange={(event) => setValues((current) => ({ ...current, customerId: event.currentTarget.value }))}>
              {options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}
            </select>
          </label>
          <label className="form-field">Plan
            <select value={values.planId} onChange={(event) => setValues((current) => ({
              ...current,
              planId: event.currentTarget.value,
              templateId: null,
            }))}>
              {options.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · min {plan.minQuantity}</option>)}
            </select>
          </label>
          <label className="form-field">Quotation template (optional)
            <select value={values.templateId ?? ""} onChange={(event) => applyTemplate(event.currentTarget.value)}>
              <option value="">No template</option>
              {templatesForPlan.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label className="form-field">Payment terms
            <select value={values.paymentTermId} onChange={(event) => setValues((current) => ({ ...current, paymentTermId: event.currentTarget.value }))}>
              {options.paymentTerms.map((term) => <option key={term.id} value={term.id}>{term.name} ({term.days} days)</option>)}
            </select>
          </label>
          <label className="form-field">Start date
            <input type="date" value={localDate(values.startDate)} onChange={(event) => setValues((current) => ({ ...current, startDate: event.currentTarget.value }))} />
          </label>
          <label className="form-field">Expiry date
            <input type="date" value={localDate(values.expiryDate)} onChange={(event) => setValues((current) => ({ ...current, expiryDate: event.currentTarget.value }))} />
          </label>
        </div>
        {selectedPlan && (
          <p className={`form-message ${quantityTotal >= selectedPlan.minQuantity ? "muted-copy" : "form-error"}`}>
            Plan availability: {new Date(selectedPlan.availableFrom).toLocaleDateString()}
            {selectedPlan.availableTo ? ` – ${new Date(selectedPlan.availableTo).toLocaleDateString()}` : " – ongoing"}.
            {" "}Minimum total quantity: {selectedPlan.minQuantity}; current: {quantityTotal}.
          </p>
        )}
        {values.templateId && <p className="muted-copy">Quotation validity will be set to the template’s validity period when saved.</p>}
        <label className="form-field">Notes
          <textarea rows={3} value={values.notes ?? ""} onChange={(event) => setValues((current) => ({ ...current, notes: event.currentTarget.value || null }))} />
        </label>
        <div className="subscription-lines-panel">
          <div className="variant-heading">
            <div>
              <strong>Subscription lines</strong>
              <p>Unit prices default to product and variant pricing; edit prices as needed.</p>
            </div>
            <button
              className="quiet-button"
              type="button"
              disabled={!firstProduct || values.lines.length >= 100}
              onClick={() => setValues((current) => ({
                ...current,
                lines: [...current.lines, {
                  productId: firstProduct!.id,
                  variantId: null,
                  quantity: 1,
                  unitPrice: firstProduct!.salesPrice,
                  taxId: firstProduct!.defaultTaxId,
                }],
              }))}
            >
              + Add line
            </button>
          </div>
          <div className="admin-table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead>Quantity</TableHead>
                  <TableHead>Unit price</TableHead><TableHead>Tax</TableHead><TableHead>Amount</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.lines.map((line, index) => {
                  const product = options.products.find((option) => option.id === line.productId);
                  return (
                    <TableRow key={`subscription-line-${index}`}>
                      <TableCell>
                        <select aria-label={`Line ${index + 1} product`} value={line.productId} onChange={(event) => {
                          const nextProduct = options.products.find((option) => option.id === event.currentTarget.value);
                          updateLine(index, {
                            productId: event.currentTarget.value,
                            variantId: null,
                            unitPrice: nextProduct?.salesPrice ?? "0.00",
                            taxId: nextProduct?.defaultTaxId ?? null,
                          });
                        }}>
                          {options.products.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select aria-label={`Line ${index + 1} variant`} value={line.variantId ?? ""} onChange={(event) => {
                          const variantId = event.currentTarget.value || null;
                          updateLine(index, { variantId, unitPrice: defaultPrice(line.productId, variantId) });
                        }}>
                          <option value="">No variant</option>
                          {product?.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.attribute}: {variant.value}</option>)}
                        </select>
                      </TableCell>
                      <TableCell><input aria-label={`Line ${index + 1} quantity`} type="number" min={1} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.currentTarget.value) })} /></TableCell>
                      <TableCell><input aria-label={`Line ${index + 1} unit price`} inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.currentTarget.value })} /></TableCell>
                      <TableCell>
                        <select aria-label={`Line ${index + 1} tax`} value={line.taxId ?? ""} onChange={(event) => updateLine(index, { taxId: event.currentTarget.value || null })}>
                          <option value="">No tax</option>
                          {options.taxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>{lineAmount(line, options)}</TableCell>
                      <TableCell>
                        <button className="danger-button" type="button" aria-label={`Remove line ${index + 1}`} disabled={values.lines.length <= 1} onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}>Remove</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        <div className="subscription-form-footer">
          <Link className="quiet-button" href={initialValues ? `/subscriptions/${initialValues.id}` : "/subscriptions"}>Cancel</Link>
          <button className="primary-button dialog-submit" type="submit" disabled={busy || !values.lines.length || !options.customers.length || !options.plans.length || !options.paymentTerms.length}>
            {busy ? "Saving…" : initialValues ? "Save changes" : "Create draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
