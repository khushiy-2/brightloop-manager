"use client";

import { useState } from "react";

type BillingRunRow = {
  id: string;
  asOfDate: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalDue: number;
  created: number;
  alreadyBilled: number;
  failed: number;
  triggeredBy: { name: string } | null;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

export function BillingManager({
  initialRuns,
  initialDate,
}: {
  initialRuns: BillingRunRow[];
  initialDate: string;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [asOfDate, setAsOfDate] = useState(initialDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runBilling() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOfDate }),
      });
      const result = await response.json() as { run?: BillingRunRow; error?: string };
      if (!response.ok || !result.run) throw new Error(result.error ?? "Unable to run billing.");
      setRuns((current) => [result.run!, ...current].slice(0, 50));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to run billing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <div className="admin-page-heading">
        <div className="page-heading">
          <p className="eyebrow">FINANCE OPERATIONS</p>
          <h1>Billing</h1>
          <p className="page-intro">Create draft invoices for active subscriptions due on or before a date.</p>
        </div>
      </div>
      <div className="billing-run-panel">
        <label className="form-field">
          Bill through date
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.currentTarget.value)} />
        </label>
        <button className="primary-button create-button" type="button" disabled={busy || !asOfDate} onClick={() => void runBilling()}>
          {busy ? "Running…" : "Run billing"}
        </button>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
      </div>
      <section className="subscription-detail-section">
        <h2>Previous billing runs</h2>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Run date</th>
                <th>As of</th>
                <th>Status</th>
                <th>Due</th>
                <th>Created</th>
                <th>Already billed</th>
                <th>Failed</th>
                <th>Triggered by</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{dateLabel(run.startedAt)}</td>
                  <td>{new Date(run.asOfDate).toLocaleDateString()}</td>
                  <td>{run.status}</td>
                  <td>{run.totalDue}</td>
                  <td>{run.created}</td>
                  <td>{run.alreadyBilled}</td>
                  <td>{run.failed}</td>
                  <td>{run.triggeredBy?.name ?? "System"}</td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={8} className="table-empty">No billing runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
