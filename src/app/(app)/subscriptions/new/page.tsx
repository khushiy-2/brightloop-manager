import { addMonths } from "date-fns";
import { SubscriptionEditor } from "@/components/admin/subscription-editor";
import { requireRole } from "@/server/auth/guards";
import { listSubscriptionEditorOptions } from "@/server/services/subscription.service";

export const instant = false;

export default async function NewSubscriptionPage() {
  await requireRole("ADMIN", "STAFF");
  const options = await listSubscriptionEditorOptions();
  const today = new Date();
  return (
    <SubscriptionEditor
      options={options}
      initialStartDate={today.toISOString().slice(0, 10)}
      initialExpiryDate={addMonths(today, 1).toISOString().slice(0, 10)}
    />
  );
}
