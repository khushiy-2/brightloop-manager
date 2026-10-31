import { CustomerManager } from "@/components/admin/customer-manager";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  return <CustomerManager initialPage={query.page} initialQuery={query.q} />;
}
