import type { ComponentProps } from "react";

export function Table({ className = "", ...props }: ComponentProps<"table">) {
  return <table data-slot="table" className={`w-full caption-bottom text-sm ${className}`} {...props} />;
}

export function TableHeader({ className = "", ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={`[&_tr]:border-b [&_tr]:border-[#e7ece8] ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={`[&_tr:last-child]:border-0 ${className}`} {...props} />;
}

export function TableFooter({ className = "", ...props }: ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={`border-t border-[#e7ece8] bg-[#f7f9f7] font-medium ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={`border-b border-[#edf0ed] transition-colors hover:bg-[#f8faf8] ${className}`} {...props} />;
}

export function TableHead({ className = "", ...props }: ComponentProps<"th">) {
  return <th data-slot="table-head" className={`h-11 px-4 text-left align-middle font-semibold text-[#56665c] ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={`px-4 py-3 align-middle ${className}`} {...props} />;
}

export function TableCaption({ className = "", ...props }: ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={`mt-4 text-sm text-[#66746d] ${className}`} {...props} />;
}
