"use client";

export function PrintButton() {
  return (
    <button className="quiet-button print-action" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}
