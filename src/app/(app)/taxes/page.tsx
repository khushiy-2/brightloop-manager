import { TaxManager } from "@/components/admin/resource-managers";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

type TaxesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TaxesPage({ searchParams }: TaxesPageProps) {
  const user = await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  return <TaxManager isAdmin={user.role === "ADMIN"} initialPage={query.page} initialQuery={query.q} />;
}
