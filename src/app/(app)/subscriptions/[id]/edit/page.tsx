import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscriptionEditor } from "@/components/admin/subscription-editor";
import { idSchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listSubscriptionEditorOptions, getSubscription } from "@/server/services/subscription.service";

export const instant = false;

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "STAFF");
  const { id } = await params;
  const validId = idSchema.safeParse(id);
  if (!validId.success) notFound();
  const [subscription, options] = await Promise.all([
    getSubscription(validId.data),
    listSubscriptionEditorOptions(),
  ]);
  if (!subscription) notFound();
  if (subscription.status !== "DRAFT" && subscription.status !== "QUOTATION") {
    return (
      <section className="page-section">
        <div className="page-heading"><h1>Subscription cannot be edited</h1><p className="page-intro">Only draft and quotation subscriptions can be changed.</p></div>
        <Link className="quiet-button" href={`/subscriptions/${subscription.id}`}>Return to subscription</Link>
      </section>
    );
  }
  return (
    <SubscriptionEditor
      options={options}
      initialStartDate={subscription.startDate.toISOString().slice(0, 10)}
      initialExpiryDate={subscription.expiryDate.toISOString().slice(0, 10)}
      initialValues={{
        id: subscription.id,
        number: subscription.number,
        customerId: subscription.customerId,
        planId: subscription.planId,
        templateId: subscription.templateId,
        paymentTermId: subscription.paymentTermId,
        startDate: subscription.startDate.toISOString().slice(0, 10),
        expiryDate: subscription.expiryDate.toISOString().slice(0, 10),
        notes: subscription.notes,
        lines: subscription.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          taxId: line.taxId,
        })),
      }}
    />
  );
}
