import { SubscriptionManager } from "@/components/admin/subscription-manager";
import { subscriptionListQuerySchema, subscriptionStatuses } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listSubscriptionFilterOptions } from "@/server/services/subscription.service";

export const instant = false;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const [params, filters] = await Promise.all([searchParams, listSubscriptionFilterOptions()]);
  const parsed = subscriptionListQuerySchema.safeParse({
    page: params.page,
    q: params.q,
    status: params.status,
    customerId: params.customerId,
    planId: params.planId,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, q: "", status: undefined, customerId: undefined, planId: undefined };
  return (
    <SubscriptionManager
      initialPage={query.page}
      initialQuery={query.q}
      initialStatus={query.status ?? ""}
      initialCustomerId={query.customerId ?? ""}
      initialPlanId={query.planId ?? ""}
      statuses={subscriptionStatuses}
      customers={filters.customers}
      plans={filters.plans}
    />
  );
}
