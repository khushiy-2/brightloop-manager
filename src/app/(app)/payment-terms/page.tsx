import { PaymentTermManager } from "@/components/admin/resource-managers";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

type PaymentTermsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PaymentTermsPage({ searchParams }: PaymentTermsPageProps) {
  const user = await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  return <PaymentTermManager isAdmin={user.role === "ADMIN"} initialPage={query.page} initialQuery={query.q} />;
}
