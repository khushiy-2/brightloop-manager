import { InvoiceManager } from "@/components/admin/invoice-manager";
import { invoiceListQuerySchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listInvoiceFilterOptions } from "@/server/services/invoice.service";

export const instant = false;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const [params, customers] = await Promise.all([searchParams, listInvoiceFilterOptions()]);
  const parsed = invoiceListQuerySchema.safeParse({
    page: params.page,
    q: params.q,
    status: params.status,
    customerId: params.customerId,
    overdue: params.overdue,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = parsed.success
    ? parsed.data
    : {
      page: 1,
      q: "",
      status: undefined,
      customerId: undefined,
      overdue: undefined,
      startDate: undefined,
      endDate: undefined,
    };
  return (
    <InvoiceManager
      initialPage={query.page}
      initialQuery={query.q}
      initialStatus={query.status ?? ""}
      initialCustomerId={query.customerId ?? ""}
      initialOverdue={query.overdue ?? ""}
      initialStartDate={query.startDate ?? ""}
      initialEndDate={query.endDate ?? ""}
      customers={customers}
    />
  );
}
