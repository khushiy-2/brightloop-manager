"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { paymentMethods } from "@/lib/validation/admin";

type PaymentRow = {
  id: string;
  method: string;
  amount: string;
  paidAt: string;
  reference: string | null;
  note: string | null;
  invoice: { id: string; number: string; customer: { name: string } };
  recordedBy: { name: string };
};

function formatMoney(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

const columns: DataTableColumn<PaymentRow>[] = [
  { key: "date", header: "Paid at", render: (row) => new Date(row.paidAt).toLocaleString() },
  {
    key: "invoice",
    header: "Invoice",
    render: (row) => <Link href={`/invoices/${row.invoice.id}`}>{row.invoice.number}</Link>,
  },
  { key: "customer", header: "Customer", render: (row) => row.invoice.customer.name },
  { key: "method", header: "Method", render: (row) => row.method.replaceAll("_", " ") },
  { key: "amount", header: "Amount", render: (row) => formatMoney(row.amount) },
  { key: "reference", header: "Reference", render: (row) => row.reference ?? "—" },
  { key: "recordedBy", header: "Recorded by", render: (row) => row.recordedBy.name },
];

export function PaymentManager({
  initialPage,
  initialQuery,
  initialMethod,
  initialStartDate,
  initialEndDate,
}: {
  initialPage: number;
  initialQuery: string;
  initialMethod: string;
  initialStartDate: string;
  initialEndDate: string;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">FINANCE OPERATIONS</p>
          <h1>Payments</h1>
          <p className="page-intro">Review recorded invoice payments.</p>
        </div>
      </div>
      <div className="payment-filter-bar">
        <label className="form-field">
          Method
          <select value={method} onChange={(event) => setMethod(event.currentTarget.value)}>
            <option value="">All methods</option>
            {paymentMethods.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Paid from
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
        </label>
        <label className="form-field">
          Paid to
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} />
        </label>
      </div>
      <DataTable
        endpoint="/api/payments"
        columns={columns}
        searchPlaceholder="Search invoice, customer, or reference…"
        initialPage={initialPage}
        initialQuery={initialQuery}
        filters={{ method, startDate, endDate }}
      />
    </section>
  );
}
