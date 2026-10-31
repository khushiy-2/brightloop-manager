import { DiscountManager } from "@/components/admin/discount-manager";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listDiscountProductOptions } from "@/server/services/discounts.service";

export const instant = false;

type DiscountsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DiscountsPage({ searchParams }: DiscountsPageProps) {
  const user = await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  const products = await listDiscountProductOptions();
  return (
    <DiscountManager
      isAdmin={user.role === "ADMIN"}
      initialPage={query.page}
      initialQuery={query.q}
      products={products}
    />
  );
}
