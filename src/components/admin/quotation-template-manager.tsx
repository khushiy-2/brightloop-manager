"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { quotationTemplateInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";

type TemplateValues = z.infer<typeof quotationTemplateInputSchema>;
type ProductOption = { id: string; name: string; variants: { id: string; attribute: string; value: string }[] };
type Template = TemplateValues & {
  id: string;
  plan: { id: string; name: string; period: string };
  lines: (TemplateValues["lines"][number] & {
    product: { id: string; name: string };
    variant: { id: string; attribute: string; value: string } | null;
    tax: { id: string; name: string } | null;
  })[];
};

function emptyValues(products: ProductOption[], plans: { id: string }[]): TemplateValues {
  const firstProduct = products[0];
  return {
    name: "",
    planId: plans[0]?.id ?? "",
    validityDays: 30,
    isActive: true,
    lines: firstProduct ? [{
      productId: firstProduct.id,
      variantId: null,
      quantity: 1,
      taxId: null,
    }] : [],
  };
}

export function QuotationTemplateManager({
  initialPage,
  initialQuery,
  plans,
  products,
  taxes,
}: {
  initialPage: number;
  initialQuery: string;
  plans: { id: string; name: string }[];
  products: ProductOption[];
  taxes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [values, setValues] = useState<TemplateValues>(() => emptyValues(products, plans));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function showDialog(template: Template | null) {
    setEditing(template);
    setValues(template ? {
      name: template.name,
      planId: template.planId,
      validityDays: template.validityDays,
      isActive: template.isActive,
      lines: template.lines.map(({ productId, variantId, quantity, taxId }) => ({
        productId, variantId, quantity, taxId,
      })),
    } : emptyValues(products, plans));
    setError("");
    setOpen(true);
  }

  function updateLine(index: number, patch: Partial<TemplateValues["lines"][number]>) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = quotationTemplateInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the template details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/quotation-templates/${editing.id}` : "/api/quotation-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save the quotation template.");
      setOpen(false);
      setNotice(editing ? "Quotation template updated." : "Quotation template created.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the quotation template.");
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<Template>[] = [
    { key: "name", header: "Template", render: (template) => <strong>{template.name}</strong> },
    { key: "plan", header: "Plan", render: (template) => template.plan.name },
    { key: "validity", header: "Validity", render: (template) => `${template.validityDays} days` },
    { key: "lines", header: "Lines", render: (template) => template.lines.length },
    {
      key: "status",
      header: "Status",
      render: (template) => <span className={`status-pill ${template.isActive ? "status-active" : "status-inactive"}`}>{template.isActive ? "Active" : "Inactive"}</span>,
    },
  ];

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">SALES SETUP</p>
          <h1>Quotation templates</h1>
          <p className="page-intro">Build reusable quotation line sets for each plan.</p>
        </div>
        <button className="primary-button create-button" type="button" disabled={!plans.length || !products.length} onClick={() => showDialog(null)}>+ Add template</button>
      </div>
      {notice && <p className="form-message form-success" role="status">{notice}</p>}
      <DataTable
        endpoint="/api/quotation-templates"
        columns={columns}
        searchPlaceholder="Search templates…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        refreshKey={refreshKey}
        rowActions={(template) => <button className="quiet-button" type="button" onClick={() => showDialog(template)}>Edit</button>}
      />
      <AdminDialog
        open={open}
        title={editing ? "Edit quotation template" : "Create quotation template"}
        submitLabel={editing ? "Save changes" : "Create template"}
        busy={busy}
        error={error}
        onClose={() => !busy && setOpen(false)}
        onSubmit={(event) => void save(event)}
      >
        <label className="form-field">Name<input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.currentTarget.value }))} /></label>
        <label className="form-field">
          Plan
          <select value={values.planId} onChange={(event) => setValues((current) => ({ ...current, planId: event.currentTarget.value }))}>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Validity (days)
          <input type="number" min={1} value={values.validityDays} onChange={(event) => setValues((current) => ({ ...current, validityDays: Number(event.currentTarget.value) }))} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={values.isActive} onChange={(event) => setValues((current) => ({ ...current, isActive: event.currentTarget.checked }))} />
          <span>Active</span>
        </label>
        <div className="template-line-editor">
          <div className="variant-heading">
            <strong>Quotation lines</strong>
            <button
              className="quiet-button"
              type="button"
              disabled={values.lines.length >= 100 || !products.length}
              onClick={() => setValues((current) => ({
                ...current,
                lines: [...current.lines, { productId: products[0]!.id, variantId: null, quantity: 1, taxId: null }],
              }))}
            >
              + Add line
            </button>
          </div>
          {values.lines.map((line, index) => {
            const product = products.find((option) => option.id === line.productId);
            return (
              <div className="template-line-row" key={`line-${index}`}>
                <label className="form-field">
                  Product
                  <select value={line.productId} onChange={(event) => updateLine(index, { productId: event.currentTarget.value, variantId: null })}>
                    {products.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  Variant
                  <select value={line.variantId ?? ""} onChange={(event) => updateLine(index, { variantId: event.currentTarget.value || null })}>
                    <option value="">No variant</option>
                    {product?.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.attribute}: {variant.value}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  Quantity
                  <input type="number" min={1} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.currentTarget.value) })} />
                </label>
                <label className="form-field">
                  Tax
                  <select value={line.taxId ?? ""} onChange={(event) => updateLine(index, { taxId: event.currentTarget.value || null })}>
                    <option value="">No tax</option>
                    {taxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                  </select>
                </label>
                <button className="danger-button" type="button" aria-label={`Remove line ${index + 1}`} disabled={values.lines.length <= 1} onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}>Remove</button>
              </div>
            );
          })}
        </div>
      </AdminDialog>
    </section>
  );
}
