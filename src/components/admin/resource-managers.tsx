"use client";

import { useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import {
  PaymentTermDialog,
  PlanDialog,
  ProductDialog,
  TaxDialog,
  VariantDialog,
} from "@/components/admin/resource-dialogs";
import type {
  variantUpdateSchema,
} from "@/lib/validation/admin";
import type { z } from "zod";

type ProductType = "SERVICE" | "SOFTWARE" | "ADDON" | "PHYSICAL";
type BillingPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type TaxType = "PERCENT" | "FIXED";
type ProductVariant = {
  id: string;
  attribute: string;
  value: string;
  extraPrice: string;
  isActive: boolean;
};
type Product = {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: string;
  costPrice: string;
  notes: string | null;
  defaultTaxId: string | null;
  defaultTax: { id: string; name: string; type: TaxType; rate: string } | null;
  isActive: boolean;
  variants: ProductVariant[];
};
type Tax = { id: string; name: string; type: TaxType; rate: string; isActive: boolean };
type PaymentTerm = { id: string; name: string; days: number };
type Plan = {
  id: string;
  name: string;
  price: string;
  period: BillingPeriod;
  minQuantity: number;
  availableFrom: string;
  availableTo: string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  isActive: boolean;
};
type TaxOption = { id: string; name: string; isActive: boolean };

type EditorState<T> = {
  open: boolean;
  editing: T | null;
  busy: boolean;
  error: string;
  notice: string;
  refreshKey: number;
  openCreate: () => void;
  openEdit: (record: T) => void;
  close: () => void;
  save: (url: string, method: "POST" | "PATCH", body: unknown, notice: string) => Promise<void>;
  remove: (url: string, label: string, refresh: () => void) => Promise<void>;
};

function useResourceEditor<T>(): EditorState<T> {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  function openCreate() {
    setEditing(null);
    setError("");
    setNotice("");
    setOpen(true);
  }

  function openEdit(record: T) {
    setEditing(record);
    setError("");
    setNotice("");
    setOpen(true);
  }

  async function save(url: string, method: "POST" | "PATCH", body: unknown, successMessage: string) {
    setBusy(true);
    setError("");
    try {
      await mutate(url, method, body);
      setOpen(false);
      setEditing(null);
      setRefreshKey((value) => value + 1);
      setNotice(successMessage);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string, label: string, refresh: () => void) {
    if (!window.confirm(`Deactivate ${label}?`)) return;
    try {
      await mutate(url, "DELETE");
      setNotice(`${label} deactivated.`);
      refresh();
    } catch (cause) {
      window.alert(errorMessage(cause));
    }
  }

  function close() {
    if (!busy) {
      setOpen(false);
      setError("");
    }
  }

  return { open, editing, busy, error, notice, refreshKey, openCreate, openEdit, close, save, remove };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "The request failed. Please try again.";
}

async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request failed. Please try again.");
}

function Status({ active }: { active: boolean }) {
  return <span className={`status-pill ${active ? "status-active" : "status-inactive"}`}>{active ? "Active" : "Inactive"}</span>;
}

function PageHeading({
  eyebrow,
  title,
  description,
  onCreate,
  createLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="admin-page-heading">
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro">{description}</p>
      </div>
      {onCreate && <button className="primary-button create-button" type="button" onClick={onCreate}>+ {createLabel}</button>}
    </div>
  );
}

function Notice({ children }: { children: string }) {
  return <p className="form-message form-success" role="status">{children}</p>;
}

export function ProductManager({ isAdmin, initialPage, initialQuery }: { isAdmin: boolean; initialPage: number; initialQuery: string }) {
  const editor = useResourceEditor<Product>();
  const [taxes, setTaxes] = useState<TaxOption[]>([]);
  const [taxError, setTaxError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/taxes/options")
      .then(async (response) => {
        const result = await response.json() as { taxes?: TaxOption[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load taxes.");
        if (active) setTaxes(result.taxes ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setTaxError(errorMessage(cause));
      });
    return () => { active = false; };
  }, []);

  const columns: DataTableColumn<Product>[] = [
    { key: "name", header: "Product", render: (product) => <strong>{product.name}</strong> },
    { key: "type", header: "Type", render: (product) => product.type },
    { key: "sales", header: "Sales price", render: (product) => product.salesPrice },
    { key: "cost", header: "Cost price", render: (product) => product.costPrice },
    { key: "tax", header: "Default tax", render: (product) => product.defaultTax?.name ?? "—" },
    { key: "status", header: "Status", render: (product) => <Status active={product.isActive} /> },
  ];

  return (
    <section className="page-section">
      <PageHeading
        eyebrow="CATALOG"
        title="Products"
        description="Manage product pricing, taxes, and configurable variants."
        onCreate={isAdmin ? editor.openCreate : undefined}
        createLabel="Add product"
      />
      {editor.notice && <Notice>{editor.notice}</Notice>}
      {taxError && <p className="form-message form-error" role="alert">{taxError}</p>}
      <DataTable
        endpoint="/api/products"
        columns={columns}
        searchPlaceholder="Search products…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        refreshKey={editor.refreshKey}
        rowActions={isAdmin ? (product, refresh) => (
          <>
            <button className="quiet-button" type="button" onClick={() => editor.openEdit(product)}>Edit</button>
            {product.isActive && <button className="danger-button" type="button" onClick={() => void editor.remove(`/api/products/${product.id}`, product.name, refresh)}>Deactivate</button>}
          </>
        ) : undefined}
        renderExpanded={(product, refresh) => (
          <ProductVariants product={product} isAdmin={isAdmin} refresh={refresh} />
        )}
      />
      {isAdmin && (
        <ProductDialog
          open={editor.open}
          busy={editor.busy}
          error={editor.error}
          product={editor.editing}
          taxes={taxes}
          onClose={editor.close}
          onSave={(values) => editor.save(
            editor.editing ? `/api/products/${editor.editing.id}` : "/api/products",
            editor.editing ? "PATCH" : "POST",
            values,
            editor.editing ? "Product updated." : "Product created.",
          )}
        />
      )}
    </section>
  );
}

function ProductVariants({
  product,
  isAdmin,
  refresh,
}: {
  product: Product;
  isAdmin: boolean;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(values: z.infer<typeof variantUpdateSchema>) {
    setBusy(true);
    setError("");
    try {
      await mutate(
        editing ? `/api/products/${product.id}/variants/${editing.id}` : `/api/products/${product.id}/variants`,
        editing ? "PATCH" : "POST",
        values,
      );
      setOpen(false);
      setEditing(null);
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(variant: ProductVariant) {
    if (!window.confirm(`Deactivate variant ${variant.attribute}: ${variant.value}?`)) return;
    try {
      await mutate(`/api/products/${product.id}/variants/${variant.id}`, "DELETE");
      refresh();
    } catch (cause) {
      window.alert(errorMessage(cause));
    }
  }

  return (
    <div className="variant-manager">
      <div className="variant-heading">
        <div>
          <strong>Variants for {product.name}</strong>
          <p>Attribute and value combinations with an optional price adjustment.</p>
        </div>
        {isAdmin && (
          <button className="quiet-button" type="button" onClick={() => {
            setEditing(null);
            setError("");
            setOpen(true);
          }}>
            Add variant
          </button>
        )}
      </div>
      {product.variants.length ? (
        <div className="variant-list">
          {product.variants.map((variant) => (
            <div className="variant-row" key={variant.id}>
              <span><strong>{variant.attribute}</strong> = {variant.value}</span>
              <span>+{variant.extraPrice}</span>
              <Status active={variant.isActive} />
              {isAdmin && (
                <span className="variant-actions">
                  <button className="quiet-button" type="button" onClick={() => {
                    setEditing(variant);
                    setError("");
                    setOpen(true);
                  }}>Edit</button>
                  {variant.isActive && <button className="danger-button" type="button" onClick={() => void deactivate(variant)}>Deactivate</button>}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : <p className="muted-copy">No variants configured.</p>}
      {isAdmin && (
        <VariantDialog
          open={open}
          busy={busy}
          error={error}
          variant={editing}
          onClose={() => {
            if (!busy) {
              setOpen(false);
              setError("");
            }
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

export function TaxManager({ isAdmin, initialPage, initialQuery }: { isAdmin: boolean; initialPage: number; initialQuery: string }) {
  const editor = useResourceEditor<Tax>();
  const columns: DataTableColumn<Tax>[] = [
    { key: "name", header: "Name", render: (tax) => <strong>{tax.name}</strong> },
    { key: "type", header: "Type", render: (tax) => tax.type },
    { key: "rate", header: "Rate", render: (tax) => `${tax.rate}${tax.type === "PERCENT" ? "%" : ""}` },
    { key: "status", header: "Status", render: (tax) => <Status active={tax.isActive} /> },
  ];

  return (
    <section className="page-section">
      <PageHeading eyebrow="CATALOG" title="Taxes" description="Configure percentage and fixed taxes used by products." onCreate={isAdmin ? editor.openCreate : undefined} createLabel="Add tax" />
      {editor.notice && <Notice>{editor.notice}</Notice>}
      <DataTable endpoint="/api/taxes" columns={columns} searchPlaceholder="Search taxes…" initialPage={initialPage} initialQuery={initialQuery} refreshKey={editor.refreshKey} rowActions={isAdmin ? (tax, refresh) => (
        <>
          <button className="quiet-button" type="button" onClick={() => editor.openEdit(tax)}>Edit</button>
          {tax.isActive && <button className="danger-button" type="button" onClick={() => void editor.remove(`/api/taxes/${tax.id}`, tax.name, refresh)}>Deactivate</button>}
        </>
      ) : undefined} />
      {isAdmin && <TaxDialog open={editor.open} busy={editor.busy} error={editor.error} tax={editor.editing} onClose={editor.close} onSave={(values) => editor.save(editor.editing ? `/api/taxes/${editor.editing.id}` : "/api/taxes", editor.editing ? "PATCH" : "POST", values, editor.editing ? "Tax updated." : "Tax created.")} />}
    </section>
  );
}

export function PaymentTermManager({ isAdmin, initialPage, initialQuery }: { isAdmin: boolean; initialPage: number; initialQuery: string }) {
  const editor = useResourceEditor<PaymentTerm>();
  const columns: DataTableColumn<PaymentTerm>[] = [
    { key: "name", header: "Name", render: (term) => <strong>{term.name}</strong> },
    { key: "days", header: "Due in", render: (term) => `${term.days} days` },
  ];

  async function remove(term: PaymentTerm, refresh: () => void) {
    if (!window.confirm(`Delete payment term ${term.name}?`)) return;
    try {
      await mutate(`/api/payment-terms/${term.id}`, "DELETE");
      refresh();
    } catch (cause) {
      window.alert(errorMessage(cause));
    }
  }

  return (
    <section className="page-section">
      <PageHeading eyebrow="BILLING SETUP" title="Payment Terms" description="Set the payment due window available on subscriptions." onCreate={isAdmin ? editor.openCreate : undefined} createLabel="Add payment term" />
      {editor.notice && <Notice>{editor.notice}</Notice>}
      <DataTable endpoint="/api/payment-terms" columns={columns} searchPlaceholder="Search payment terms…" initialPage={initialPage} initialQuery={initialQuery} refreshKey={editor.refreshKey} rowActions={isAdmin ? (term, refresh) => (
        <>
          <button className="quiet-button" type="button" onClick={() => editor.openEdit(term)}>Edit</button>
          <button className="danger-button" type="button" onClick={() => void remove(term, refresh)}>Delete</button>
        </>
      ) : undefined} />
      {isAdmin && <PaymentTermDialog open={editor.open} busy={editor.busy} error={editor.error} paymentTerm={editor.editing} onClose={editor.close} onSave={(values) => editor.save(editor.editing ? `/api/payment-terms/${editor.editing.id}` : "/api/payment-terms", editor.editing ? "PATCH" : "POST", values, editor.editing ? "Payment term updated." : "Payment term created.")} />}
    </section>
  );
}

export function PlanManager({ isAdmin, initialPage, initialQuery }: { isAdmin: boolean; initialPage: number; initialQuery: string }) {
  const editor = useResourceEditor<Plan>();
  const columns: DataTableColumn<Plan>[] = [
    { key: "name", header: "Plan", render: (plan) => <strong>{plan.name}</strong> },
    { key: "price", header: "Price", render: (plan) => `${plan.price} / ${plan.period.toLowerCase()}` },
    { key: "quantity", header: "Min quantity", render: (plan) => plan.minQuantity },
    { key: "availability", header: "Availability", render: (plan) => `${new Date(plan.availableFrom).toLocaleDateString()} – ${plan.availableTo ? new Date(plan.availableTo).toLocaleDateString() : "No end date"}` },
    { key: "flags", header: "Options", render: (plan) => [plan.autoClose && "Auto close", plan.closable && "Closable", plan.pausable && "Pausable", plan.renewable && "Renewable"].filter(Boolean).join(", ") || "—" },
    { key: "status", header: "Status", render: (plan) => <Status active={plan.isActive} /> },
  ];

  return (
    <section className="page-section">
      <PageHeading eyebrow="BILLING SETUP" title="Plans" description="Define subscription pricing, billing periods, and lifecycle options." onCreate={isAdmin ? editor.openCreate : undefined} createLabel="Add plan" />
      {editor.notice && <Notice>{editor.notice}</Notice>}
      <DataTable endpoint="/api/plans" columns={columns} searchPlaceholder="Search plans…" initialPage={initialPage} initialQuery={initialQuery} refreshKey={editor.refreshKey} rowActions={isAdmin ? (plan, refresh) => (
        <>
          <button className="quiet-button" type="button" onClick={() => editor.openEdit(plan)}>Edit</button>
          {plan.isActive && <button className="danger-button" type="button" onClick={() => void editor.remove(`/api/plans/${plan.id}`, plan.name, refresh)}>Deactivate</button>}
        </>
      ) : undefined} />
      {isAdmin && <PlanDialog open={editor.open} busy={editor.busy} error={editor.error} plan={editor.editing} onClose={editor.close} onSave={(values) => editor.save(editor.editing ? `/api/plans/${editor.editing.id}` : "/api/plans", editor.editing ? "PATCH" : "POST", values, editor.editing ? "Plan updated." : "Plan created.")} />}
    </section>
  );
}
