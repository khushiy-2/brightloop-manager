"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceActions({
  id,
  status,
  amountPaid,
}: {
  id: string;
  status: string;
  amountPaid: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions = [
    ...(status === "DRAFT" ? [{ action: "confirm", label: "Confirm" }] : []),
    ...((status === "DRAFT" || (status === "CONFIRMED" && /^0(?:\.0+)?$/.test(amountPaid)))
      ? [{ action: "cancel", label: "Cancel invoice" }]
      : []),
    ...(status === "CONFIRMED" ? [{ action: "send", label: "Send" }] : []),
  ];

  async function runAction(action: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The invoice action failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invoice action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invoice-actions">
      {actions.map(({ action, label }) => (
        <button
          className={action === "cancel" ? "danger-button" : "quiet-button"}
          key={action}
          type="button"
          disabled={busy}
          onClick={() => void runAction(action)}
        >
          {busy ? "Working…" : label}
        </button>
      ))}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
    </div>
  );
}
