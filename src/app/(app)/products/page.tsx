import { ProductManager } from "@/components/admin/resource-managers";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

type ProductsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  return <ProductManager isAdmin={user.role === "ADMIN"} initialPage={query.page} initialQuery={query.q} />;
}
