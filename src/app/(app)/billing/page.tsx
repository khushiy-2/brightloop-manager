import { BillingManager } from "@/components/admin/billing-manager";
import { requireRole } from "@/server/auth/guards";
import { listBillingRuns } from "@/server/services/billing.service";

export const instant = false;

export default async function BillingPage() {
  await requireRole("ADMIN", "STAFF");
  const runs = await listBillingRuns();
  return (
    <BillingManager
      initialDate={new Date().toISOString().slice(0, 10)}
      initialRuns={runs.map((run) => ({
        ...run,
        asOfDate: run.asOfDate.toISOString(),
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
