import { notFound } from "next/navigation";
import { SubscriptionDetail } from "@/components/admin/subscription-detail";
import { idSchema } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { getSubscription, listSubscriptionDiscountOptions } from "@/server/services/subscription.service";

export const instant = false;

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "STAFF");
  const { id } = await params;
  const validId = idSchema.safeParse(id);
  if (!validId.success) notFound();
  const subscription = await getSubscription(validId.data);
  if (!subscription) notFound();
  const availableDiscounts = await listSubscriptionDiscountOptions(subscription.id);
  return (
    <SubscriptionDetail
      subscription={{
        id: subscription.id,
        number: subscription.number,
        status: subscription.status,
        startDate: subscription.startDate.toISOString(),
        expiryDate: subscription.expiryDate.toISOString(),
        quotationValidUntil: subscription.quotationValidUntil?.toISOString() ?? null,
        billedCount: subscription.billedCount,
        nextBillingDate: subscription.nextBillingDate?.toISOString() ?? null,
        notes: subscription.notes,
        customer: subscription.customer,
        plan: subscription.plan,
        template: subscription.template,
        paymentTerm: subscription.paymentTerm,
        lines: subscription.lines.map((line) => ({
          id: line.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          amount: line.amount.toString(),
          product: line.product,
          variant: line.variant,
          tax: line.tax ? { ...line.tax, rate: line.tax.rate.toString() } : null,
        })),
        discounts: subscription.discounts.map(({ discount }) => ({
          discount: {
            id: discount.id,
            name: discount.name,
            type: discount.type,
            value: discount.value.toString(),
            scope: discount.scope,
          },
        })),
        events: subscription.events.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          action: event.action,
          createdAt: event.createdAt.toISOString(),
          actor: event.actor,
        })),
      }}
      availableDiscounts={availableDiscounts.map((discount) => ({
        id: discount.id,
        name: discount.name,
        type: discount.type,
        value: discount.value.toString(),
        scope: discount.scope,
      }))}
    />
  );
}
