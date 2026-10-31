"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { DiscountDialog } from "@/components/admin/discount-dialog";
import type { discountInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";

type DiscountValues = z.infer<typeof discountInputSchema>;
type ProductOption = { id: string; name: string };
type Discount = {
  id: string;
  name: string;
  code: string | null;
  type: "PERCENT" | "FIXED";
  value: string;
  scope: "PRODUCT" | "SUBSCRIPTION";
  minPurchase: string | null;
  minQuantity: number | null;
  startDate: string;
  endDate: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  products: { product: ProductOption }[];
};

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

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "No end date";
}

export function DiscountManager({
  isAdmin,
  initialPage,
  initialQuery,
  products,
}: {
  isAdmin: boolean;
  initialPage: number;
  initialQuery: string;
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
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

  function openEdit(discount: Discount) {
    setEditing(discount);
    setError("");
    setNotice("");
    setOpen(true);
  }

  async function save(values: DiscountValues) {
    setBusy(true);
    setError("");
    try {
      await mutate(
        editing ? `/api/discounts/${editing.id}` : "/api/discounts",
        editing ? "PATCH" : "POST",
        values,
      );
      setOpen(false);
      setEditing(null);
      setRefreshKey((value) => value + 1);
      setNotice(editing ? "Discount updated." : "Discount created.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(discount: Discount, refresh: () => void) {
    if (!window.confirm(`Delete discount ${discount.name}?`)) return;
    try {
      await mutate(`/api/discounts/${discount.id}`, "DELETE");
      setNotice("Discount deleted.");
      refresh();
    } catch (cause) {
      window.alert(errorMessage(cause));
    }
  }

  const columns: DataTableColumn<Discount>[] = [
    { key: "name", header: "Discount", render: (discount) => <strong>{discount.name}</strong> },
    { key: "code", header: "Code", render: (discount) => discount.code ?? "—" },
    {
      key: "value",
      header: "Value",
      render: (discount) => `${discount.value}${discount.type === "PERCENT" ? "%" : ""}`,
    },
    {
      key: "scope",
      header: "Scope",
      render: (discount) => discount.scope === "PRODUCT"
        ? discount.products.map(({ product }) => product.name).join(", ")
        : "Subscription",
    },
    {
      key: "usage",
      header: "Used",
      render: (discount) => `${discount.usedCount} / ${discount.usageLimit ?? "Unlimited"}`,
    },
    {
      key: "dates",
      header: "Validity",
      render: (discount) => `${formatDate(discount.startDate)} – ${formatDate(discount.endDate)}`,
    },
    {
      key: "status",
      header: "Status",
      render: (discount) => (
        <span className={`status-pill ${discount.isActive ? "status-active" : "status-inactive"}`}>
          {discount.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">BILLING SETUP</p>
          <h1>Discounts</h1>
          <p className="page-intro">Create product and subscription discounts with usage and purchase limits.</p>
        </div>
        {isAdmin && (
          <button className="primary-button create-button" type="button" onClick={openCreate}>
            + Add discount
          </button>
        )}
      </div>
      {notice && <p className="form-message form-success" role="status">{notice}</p>}
      <DataTable
        endpoint="/api/discounts"
        columns={columns}
        searchPlaceholder="Search discounts…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        refreshKey={refreshKey}
        rowActions={isAdmin ? (discount, refresh) => (
          <>
            <button className="quiet-button" type="button" onClick={() => openEdit(discount)}>Edit</button>
            <button className="danger-button" type="button" onClick={() => void remove(discount, refresh)}>Delete</button>
          </>
        ) : undefined}
      />
      {isAdmin && (
        <DiscountDialog
          open={open}
          busy={busy}
          error={error}
          discount={editing}
          products={products}
          onClose={() => {
            if (!busy) {
              setOpen(false);
              setError("");
            }
          }}
          onSave={save}
        />
      )}
    </section>
  );
}
