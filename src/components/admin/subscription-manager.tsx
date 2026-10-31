"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useState } from "react";

type SubscriptionRow = {
  id: string;
  number: string;
  status: string;
  startDate: string;
  expiryDate: string;
  customer: { id: string; name: string };
  plan: { id: string; name: string };
};

const statusNames: Record<string, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export function SubscriptionManager({
  initialPage,
  initialQuery,
  initialStatus,
  initialCustomerId,
  initialPlanId,
  statuses,
  customers,
  plans,
}: {
  initialPage: number;
  initialQuery: string;
  initialStatus: string;
  initialCustomerId: string;
  initialPlanId: string;
  statuses: readonly string[];
  customers: { id: string; name: string }[];
  plans: { id: string; name: string }[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [planId, setPlanId] = useState(initialPlanId);
  const filters = { status, customerId, planId };
  const columns: DataTableColumn<SubscriptionRow>[] = [
    { key: "number", header: "Subscription", render: (row) => <strong>{row.number}</strong> },
    { key: "customer", header: "Customer", render: (row) => row.customer.name },
    { key: "plan", header: "Plan", render: (row) => row.plan.name },
    {
      key: "status",
      header: "Status",
      render: (row) => <span className={`status-pill ${row.status === "ACTIVE" ? "status-active" : "status-inactive"}`}>{statusNames[row.status] ?? row.status}</span>,
    },
    { key: "start", header: "Start date", render: (row) => new Date(row.startDate).toLocaleDateString() },
    { key: "expiry", header: "Expiry date", render: (row) => new Date(row.expiryDate).toLocaleDateString() },
  ];

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">CUSTOMER OPERATIONS</p>
          <h1>Subscriptions</h1>
          <p className="page-intro">Create, quote, activate, and manage customer subscriptions.</p>
        </div>
        <Link className="primary-button create-button" href="/subscriptions/new">+ New subscription</Link>
      </div>
      <div className="subscription-filter-bar">
        <label className="form-field">
          Status
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{statusNames[value] ?? value}</option>)}
          </select>
        </label>
        <label className="form-field">
          Customer
          <select value={customerId} onChange={(event) => setCustomerId(event.currentTarget.value)}>
            <option value="">All customers</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Plan
          <select value={planId} onChange={(event) => setPlanId(event.currentTarget.value)}>
            <option value="">All plans</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
      </div>
      <DataTable
        endpoint="/api/subscriptions"
        columns={columns}
        searchPlaceholder="Search number, customer, or plan…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        filters={filters}
        rowActions={(row) => <Link className="quiet-button" href={`/subscriptions/${row.id}`}>Open</Link>}
      />
    </section>
  );
}
