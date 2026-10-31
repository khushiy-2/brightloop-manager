import { PlanManager } from "@/components/admin/resource-managers";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";

export const instant = false;

type PlansPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PlansPage({ searchParams }: PlansPageProps) {
  const user = await requireRole("ADMIN", "STAFF");
  const query = parsePageQueryParams(await searchParams);
  return <PlanManager isAdmin={user.role === "ADMIN"} initialPage={query.page} initialQuery={query.q} />;
}
