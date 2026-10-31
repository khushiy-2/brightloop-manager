"use client";

import type { FormEvent, ReactNode } from "react";

type AdminDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

export function AdminDialog({
  open,
  title,
  submitLabel,
  busy,
  error,
  onClose,
  onSubmit,
  children,
}: AdminDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <form onSubmit={onSubmit}>
          <header className="admin-dialog-heading">
            <h2 id="admin-dialog-title">{title}</h2>
            <button className="dialog-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button>
          </header>
          <div className="admin-dialog-content">
            {children}
            {error && <p className="form-message form-error" role="alert">{error}</p>}
          </div>
          <footer className="admin-dialog-footer">
            <button className="quiet-button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
            <button className="primary-button dialog-submit" type="submit" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
