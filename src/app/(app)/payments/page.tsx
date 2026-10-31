import { PaymentManager } from "@/components/admin/payment-manager";
import { paymentListQuerySchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const params = await searchParams;
  const parsed = paymentListQuerySchema.safeParse({
    page: params.page,
    q: params.q,
    method: params.method,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = parsed.success ? parsed.data : {
    page: 1,
    q: "",
    method: undefined,
    startDate: undefined,
    endDate: undefined,
  };
  return (
    <PaymentManager
      initialPage={query.page}
      initialQuery={query.q}
      initialMethod={query.method ?? ""}
      initialStartDate={query.startDate ?? ""}
      initialEndDate={query.endDate ?? ""}
    />
  );
}
