"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";

function localDateTimeNow() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RecordPaymentDialog({
  invoiceId,
  outstanding,
}: {
  invoiceId: string;
  outstanding: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = new FormData(event.currentTarget);
      const paidAt = new Date(String(values.get("paidAt") ?? ""));
      if (Number.isNaN(paidAt.getTime())) throw new Error("Enter a valid payment date.");
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: values.get("method"),
          amount: values.get("amount"),
          paidAt: paidAt.toISOString(),
          note: values.get("note"),
          reference: values.get("reference"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to record payment.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={() => {
        setError("");
        setOpen(true);
      }}>
        Record payment
      </button>
      <AdminDialog
        open={open}
        title="Record payment"
        submitLabel="Record payment"
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={(event) => void submit(event)}
      >
        <label className="form-field">
          Method
          <select name="method" defaultValue="CASH" required>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="form-field">
          Amount
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            min="0.01"
            max={outstanding}
            step="0.01"
            required
          />
          <small>Outstanding balance: {outstanding}</small>
        </label>
        <label className="form-field">
          Paid at
          <input name="paidAt" type="datetime-local" defaultValue={localDateTimeNow()} required />
        </label>
        <label className="form-field">
          Reference (optional)
          <input name="reference" maxLength={160} />
        </label>
        <label className="form-field">
          Note (optional)
          <textarea name="note" maxLength={1000} rows={3} />
        </label>
      </AdminDialog>
    </>
  );
}
