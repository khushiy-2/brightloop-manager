import {
  BillingItemResult,
  BillingPeriod,
  BillingRunStatus,
  InvoiceStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";
import { addPeriod } from "@/lib/dates";
import { nextNumber } from "@/lib/numbering";
import { prisma } from "@/server/db";
import { calculateInvoice, type PricingDiscountInput, type PricingLineInput } from "@/server/services/pricing.service";

const chunkSize = 25;
const catchUpLimit = 24;

const billingSubscriptionInclude = {
  customer: { select: { id: true } },
  plan: { select: { period: true, autoClose: true } },
  paymentTerm: { select: { days: true } },
  lines: {
    include: {
      product: { select: { name: true } },
      variant: { select: { attribute: true, value: true } },
      tax: { select: { type: true, rate: true } },
    },
  },
  discounts: {
    include: {
      discount: {
        include: { products: { select: { productId: true } } },
      },
    },
  },
} satisfies Prisma.SubscriptionInclude;

type BillingSubscription = Prisma.SubscriptionGetPayload<{
  include: typeof billingSubscriptionInclude;
}>;

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function pricingLines(subscription: BillingSubscription): PricingLineInput[] {
  return subscription.lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    tax: line.tax ? { type: line.tax.type, rate: line.tax.rate } : null,
  }));
}

function pricingDiscounts(subscription: BillingSubscription): PricingDiscountInput[] {
  return subscription.discounts.map(({ discount }) => ({
    id: discount.id,
    name: discount.name,
    type: discount.type,
    value: discount.value,
    scope: discount.scope,
    productIds: discount.products.map(({ productId }) => productId),
    minPurchase: discount.minPurchase,
    minQuantity: discount.minQuantity,
    startDate: discount.startDate,
    endDate: discount.endDate,
    usageLimit: discount.usageLimit,
    usedCount: discount.usedCount,
    isActive: discount.isActive,
  }));
}

async function createPeriodInvoice(
  transaction: Prisma.TransactionClient,
  subscription: BillingSubscription,
  runId: string,
  periodStart: Date,
  periodEnd: Date,
  issueDate: Date,
) {
  const lines = pricingLines(subscription);
  const discounts = pricingDiscounts(subscription);
  const excludedDiscountIds = new Set<string>();
  const reservedDiscountIds = new Set<string>();
  let priced = calculateInvoice(lines, discounts, issueDate);

  while (true) {
    const nextDiscount = priced.appliedDiscounts.find(
      ({ discountId }) => !reservedDiscountIds.has(discountId),
    );
    if (!nextDiscount) break;

    const discount = discounts.find(({ id }) => id === nextDiscount.discountId);
    if (!discount) throw new Error("Pricing returned a discount that is not attached to the subscription.");
    const reserved = await transaction.discount.updateMany({
      where: {
        id: discount.id,
        OR: [
          { usageLimit: null },
          { usageLimit: { gt: discount.usedCount }, usedCount: discount.usedCount },
        ],
      },
      data: { usedCount: { increment: 1 } },
    });

    if (reserved.count === 0) {
      excludedDiscountIds.add(discount.id);
      priced = calculateInvoice(
        lines,
        discounts.filter(({ id }) => !excludedDiscountIds.has(id)),
        issueDate,
      );
    } else {
      reservedDiscountIds.add(discount.id);
    }
  }

  const invoice = await transaction.invoice.create({
    data: {
      number: await nextNumber(`INV-${issueDate.getUTCFullYear()}`, transaction),
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      status: InvoiceStatus.DRAFT,
      periodStart,
      periodEnd,
      issueDate,
      dueDate: addDays(issueDate, subscription.paymentTerm.days),
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      taxTotal: priced.taxTotal,
      total: priced.total,
      billingRunId: runId,
      lines: {
        create: priced.lines.map((line, index) => {
          const subscriptionLine = subscription.lines[index]!;
          return {
            productId: subscriptionLine.productId,
            variantId: subscriptionLine.variantId,
            taxId: subscriptionLine.taxId,
            description: subscriptionLine.description
              ?? `${subscriptionLine.product.name}${subscriptionLine.variant
                ? ` — ${subscriptionLine.variant.attribute}: ${subscriptionLine.variant.value}`
                : ""}`,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxRate: subscriptionLine.tax?.rate ?? new Prisma.Decimal(0),
            taxAmount: line.taxAmount,
            lineSubtotal: line.lineSubtotal,
            lineTotal: line.lineTotal,
          };
        }),
      },
    },
  });

  const appliedAmounts = new Map(
    priced.appliedDiscounts.map(({ discountId, amount }) => [discountId, amount]),
  );
  const usageRows = [...reservedDiscountIds].flatMap((discountId) => {
    const amount = appliedAmounts.get(discountId);
    return amount ? [{ discountId, invoiceId: invoice.id, amount }] : [];
  });
  if (usageRows.length) {
    await transaction.discountUsage.createMany({ data: usageRows });
  }

  return invoice;
}

function duePeriodCount(
  subscription: Pick<BillingSubscription, "startDate" | "billedCount" | "nextBillingDate" | "expiryDate">
    & { plan: { period: BillingPeriod } },
  asOfDate: Date,
) {
  if (!subscription.nextBillingDate || subscription.nextBillingDate > asOfDate || subscription.nextBillingDate > subscription.expiryDate) {
    return 0;
  }
  const offsetDays = differenceInCalendarDays(
    subscription.nextBillingDate,
    addPeriod(subscription.startDate, subscription.billedCount, subscription.plan.period),
  );
  let count = 0;
  let periodStart = subscription.nextBillingDate;
  while (
    count < catchUpLimit
    && periodStart <= asOfDate
    && periodStart <= subscription.expiryDate
  ) {
    count += 1;
    periodStart = addDays(
      addPeriod(subscription.startDate, subscription.billedCount + count, subscription.plan.period),
      offsetDays,
    );
  }
  return count;
}

async function billSubscription(subscriptionId: string, runId: string, asOfDate: Date) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Subscription" WHERE "id" = ${subscriptionId} FOR UPDATE
    `;
    let subscription = await transaction.subscription.findUnique({
      where: { id: subscriptionId },
      include: billingSubscriptionInclude,
    });
    if (
      !subscription
      || subscription.status !== SubscriptionStatus.ACTIVE
      || !subscription.nextBillingDate
      || subscription.nextBillingDate > asOfDate
      || subscription.nextBillingDate > subscription.expiryDate
    ) {
      return { created: 0, alreadyBilled: 0, skipped: true };
    }

    let created = 0;
    let alreadyBilled = 0;
    const offsetDays = differenceInCalendarDays(
      subscription.nextBillingDate,
      addPeriod(subscription.startDate, subscription.billedCount, subscription.plan.period),
    );
    for (let periodIndex = 0; periodIndex < catchUpLimit; periodIndex += 1) {
      const periodStart = subscription.nextBillingDate;
      if (!periodStart || periodStart > asOfDate || periodStart > subscription.expiryDate) break;
      const periodEnd = addPeriod(
        subscription.startDate,
        subscription.billedCount + 1,
        subscription.plan.period,
      );
      const adjustedPeriodEnd = addDays(periodEnd, offsetDays);
      const existing = await transaction.invoice.findFirst({
        where: {
          subscriptionId,
          periodStart,
          status: { not: InvoiceStatus.CANCELLED },
        },
        select: { id: true },
      });

      if (existing) {
        alreadyBilled += 1;
        await transaction.billingRunItem.create({
          data: {
            runId,
            subscriptionId,
            result: BillingItemResult.ALREADY_BILLED,
            invoiceId: existing.id,
          },
        });
      } else {
        const invoice = await createPeriodInvoice(
          transaction,
          subscription,
          runId,
          periodStart,
          adjustedPeriodEnd,
          asOfDate,
        );
        created += 1;
        await transaction.billingRunItem.create({
          data: {
            runId,
            subscriptionId,
            result: BillingItemResult.CREATED,
            invoiceId: invoice.id,
          },
        });
      }

      const billedCount: number = subscription.billedCount + 1;
      const nextBillingDate: Date = addDays(
        addPeriod(subscription.startDate, billedCount, subscription.plan.period),
        offsetDays,
      );
      await transaction.subscription.update({
        where: { id: subscriptionId },
        data: { billedCount, nextBillingDate },
      });
      subscription = { ...subscription, billedCount, nextBillingDate };
    }
    return { created, alreadyBilled, skipped: false };
  }, { timeout: 30_000 });
}

export async function runBilling(asOfDate: Date, actor: { id: string }) {
  const run = await prisma.billingRun.create({
    data: { asOfDate, triggeredById: actor.id },
  });
  let totalDue = 0;
  let created = 0;
  let alreadyBilled = 0;
  let failed = 0;

  try {
    const candidates = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { lte: asOfDate },
      },
      select: {
        id: true,
        startDate: true,
        expiryDate: true,
        billedCount: true,
        nextBillingDate: true,
        plan: { select: { period: true } },
      },
      orderBy: { nextBillingDate: "asc" },
    });
    const due = candidates.filter(
      (subscription) => subscription.nextBillingDate !== null
        && subscription.nextBillingDate <= subscription.expiryDate,
    );
    totalDue = due.reduce(
      (total, subscription) => total + duePeriodCount(subscription, asOfDate),
      0,
    );

    await prisma.billingRun.update({ where: { id: run.id }, data: { totalDue } });

    for (let offset = 0; offset < due.length; offset += chunkSize) {
      const chunk = due.slice(offset, offset + chunkSize);
      const results = await Promise.all(chunk.map(async (candidate) => {
        const periodsDue = duePeriodCount(candidate, asOfDate);
        try {
          return {
            result: await billSubscription(candidate.id, run.id, asOfDate),
            periodsDue,
            candidate,
          };
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            try {
              await prisma.billingRunItem.create({
                data: {
                  runId: run.id,
                  subscriptionId: candidate.id,
                  result: BillingItemResult.ALREADY_BILLED,
                },
              });
              if (periodsDue > 1) {
                await prisma.billingRunItem.createMany({
                  data: Array.from({ length: periodsDue - 1 }, () => ({
                    runId: run.id,
                    subscriptionId: candidate.id,
                    result: BillingItemResult.FAILED,
                    error: "Billing transaction rolled back after a unique conflict.",
                  })),
                });
              }
            } catch (recordError) {
              console.error(`Unable to record billing result for subscription ${candidate.id}:`, recordError);
            }
            return {
              result: { created: 0, alreadyBilled: 1, skipped: false },
              periodsDue: Math.max(periodsDue, 1),
              candidate,
            };
          }

          console.error(`Billing failed for subscription ${candidate.id}:`, error);
          try {
            await prisma.billingRunItem.createMany({
              data: Array.from({ length: Math.max(periodsDue, 1) }, () => ({
                runId: run.id,
                subscriptionId: candidate.id,
                result: BillingItemResult.FAILED,
                error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown billing error.",
              })),
            });
          } catch (recordError) {
            console.error(`Unable to record billing failure for subscription ${candidate.id}:`, recordError);
          }
          return {
            result: { created: 0, alreadyBilled: 0, skipped: false },
            periodsDue: Math.max(periodsDue, 1),
            candidate,
          };
        }
      }));

      for (const { result, periodsDue } of results) {
        if (result.skipped) {
          totalDue -= periodsDue;
          continue;
        }
        created += result.created;
        alreadyBilled += result.alreadyBilled;
        failed += Math.max(0, periodsDue - result.created - result.alreadyBilled);
      }
    }

    await prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiryDate: { lt: asOfDate },
        plan: { autoClose: true },
      },
      data: { status: SubscriptionStatus.CLOSED, closedAt: asOfDate },
    });

    const status = failed === 0
      ? BillingRunStatus.COMPLETED
      : created + alreadyBilled === 0
        ? BillingRunStatus.FAILED
        : BillingRunStatus.PARTIAL;
    return await prisma.billingRun.update({
      where: { id: run.id },
      data: {
        totalDue,
        created,
        alreadyBilled,
        failed,
        status,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.billingRun.update({
      where: { id: run.id },
      data: {
        totalDue,
        created,
        alreadyBilled,
        failed,
        status: BillingRunStatus.FAILED,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function listBillingRuns() {
  return prisma.billingRun.findMany({
    include: { triggeredBy: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
}
