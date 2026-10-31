"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  paymentStatus: "Paid" | "Outstanding" | "Overdue";
  issueDate: string;
  dueDate: string;
  total: string;
  customer: { id: string; name: string };
  subscription: { number: string };
};

const statusNames: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const paymentStatusClasses = {
  Paid: "status-paid",
  Outstanding: "status-outstanding",
  Overdue: "status-overdue",
} as const;

function formatMoney(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function InvoiceManager({
  initialPage,
  initialQuery,
  initialStatus,
  initialCustomerId,
  initialOverdue,
  initialStartDate,
  initialEndDate,
  customers,
}: {
  initialPage: number;
  initialQuery: string;
  initialStatus: string;
  initialCustomerId: string;
  initialOverdue: string;
  initialStartDate: string;
  initialEndDate: string;
  customers: { id: string; name: string }[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [overdue, setOverdue] = useState(initialOverdue);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const columns: DataTableColumn<InvoiceRow>[] = [
    { key: "number", header: "Invoice", render: (row) => <strong>{row.number}</strong> },
    { key: "customer", header: "Customer", render: (row) => row.customer.name },
    { key: "subscription", header: "Subscription", render: (row) => row.subscription.number },
    {
      key: "status",
      header: "Status",
      render: (row) => <span className={`status-pill ${row.status === "CONFIRMED" ? "status-active" : "status-inactive"}`}>{statusNames[row.status] ?? row.status}</span>,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (row) => <span className={`status-pill ${paymentStatusClasses[row.paymentStatus]}`}>{row.paymentStatus}</span>,
    },
    { key: "issue", header: "Issue date", render: (row) => new Date(row.issueDate).toLocaleDateString() },
    { key: "due", header: "Due date", render: (row) => new Date(row.dueDate).toLocaleDateString() },
    { key: "total", header: "Total", render: (row) => formatMoney(row.total) },
  ];

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">FINANCE OPERATIONS</p>
          <h1>Invoices</h1>
          <p className="page-intro">Review, confirm, send, and print subscription invoices.</p>
        </div>
      </div>
      <div className="invoice-filter-bar">
        <label className="form-field">
          Status
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Customer
          <select value={customerId} onChange={(event) => setCustomerId(event.currentTarget.value)}>
            <option value="">All customers</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <label className="checkbox-field invoice-overdue-filter">
          <input type="checkbox" checked={overdue === "true"} onChange={(event) => setOverdue(event.currentTarget.checked ? "true" : "")} />
          Overdue only
        </label>
        <label className="form-field">
          Issue date from
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
        </label>
        <label className="form-field">
          Issue date to
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} />
        </label>
      </div>
      <DataTable
        endpoint="/api/invoices"
        columns={columns}
        searchPlaceholder="Search invoice or customer…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        filters={{ status, customerId, overdue, startDate, endDate }}
        rowActions={(row) => <Link className="quiet-button" href={`/invoices/${row.id}`}>Open</Link>}
      />
    </section>
  );
}
