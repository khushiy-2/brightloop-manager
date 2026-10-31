"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { customerInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";

type CustomerValues = z.infer<typeof customerInputSchema>;
type Customer = CustomerValues & { id: string; createdAt: string };

function blankCustomer(): CustomerValues {
  return { name: "", email: "", phone: null, company: null, address: null };
}

export function CustomerManager({
  initialPage,
  initialQuery,
}: {
  initialPage: number;
  initialQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [values, setValues] = useState<CustomerValues>(blankCustomer());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function showDialog(customer: Customer | null) {
    setEditing(customer);
    setValues(customer ? {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      address: customer.address,
    } : blankCustomer());
    setError("");
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = customerInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the customer details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/customers/${editing.id}` : "/api/customers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save the customer.");
      setOpen(false);
      setNotice(editing ? "Customer updated." : "Customer created.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the customer.");
    } finally {
      setBusy(false);
    }
  }

  function setField<K extends keyof CustomerValues>(key: K, value: CustomerValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const columns: DataTableColumn<Customer>[] = [
    { key: "name", header: "Customer", render: (customer) => <strong>{customer.name}</strong> },
    { key: "email", header: "Email", render: (customer) => customer.email },
    { key: "phone", header: "Phone", render: (customer) => customer.phone ?? "—" },
    { key: "company", header: "Company", render: (customer) => customer.company ?? "—" },
    { key: "address", header: "Address", render: (customer) => customer.address ?? "—" },
  ];

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Customers</h1>
          <p className="page-intro">Manage customer contact and billing details.</p>
        </div>
        <button className="primary-button create-button" type="button" onClick={() => showDialog(null)}>+ Add customer</button>
      </div>
      {notice && <p className="form-message form-success" role="status">{notice}</p>}
      <DataTable
        endpoint="/api/customers"
        columns={columns}
        searchPlaceholder="Search customers…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        refreshKey={refreshKey}
        rowActions={(customer) => <button className="quiet-button" type="button" onClick={() => showDialog(customer)}>Edit</button>}
      />
      <AdminDialog
        open={open}
        title={editing ? "Edit customer" : "Create customer"}
        submitLabel={editing ? "Save changes" : "Create customer"}
        busy={busy}
        error={error}
        onClose={() => !busy && setOpen(false)}
        onSubmit={(event) => void save(event)}
      >
        <label className="form-field">Name<input value={values.name} onChange={(event) => setField("name", event.currentTarget.value)} /></label>
        <label className="form-field">Email<input type="email" value={values.email} onChange={(event) => setField("email", event.currentTarget.value)} /></label>
        <label className="form-field">Phone<input value={values.phone ?? ""} onChange={(event) => setField("phone", event.currentTarget.value || null)} /></label>
        <label className="form-field">Company<input value={values.company ?? ""} onChange={(event) => setField("company", event.currentTarget.value || null)} /></label>
        <label className="form-field">Address<textarea rows={3} value={values.address ?? ""} onChange={(event) => setField("address", event.currentTarget.value || null)} /></label>
      </AdminDialog>
    </section>
  );
}
