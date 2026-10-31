import { BillingPeriod, Prisma, SubscriptionStatus } from "@prisma/client";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { subscriptionInputSchema, subscriptionActionSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { nextNumber } from "@/lib/numbering";
import { prisma } from "@/server/db";
import { validateCatalogLines } from "@/server/services/catalog-lines";
import { AdminResourceNotFoundError } from "@/server/services/errors";
import { ServiceValidationError, SubscriptionTransitionError } from "@/server/services/service-errors";

const pageSize = 10;
type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;
type SubscriptionAction = z.infer<typeof subscriptionActionSchema>["action"];

const subscriptionInclude = {
  customer: { select: { id: true, name: true, email: true, company: true } },
  plan: { select: { id: true, name: true, period: true, minQuantity: true, pausable: true, closable: true, renewable: true, availableFrom: true, availableTo: true } },
  template: { select: { id: true, name: true, validityDays: true } },
  paymentTerm: { select: { id: true, name: true, days: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, attribute: true, value: true } },
      tax: { select: { id: true, name: true, type: true, rate: true } },
    },
  },
  discounts: { include: { discount: true } },
  events: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.SubscriptionInclude;

function dayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function checkAvailability(startDate: Date, plan: { availableFrom: Date; availableTo: Date | null }) {
  const start = dayStart(startDate);
  if (start < dayStart(plan.availableFrom) || (plan.availableTo && start > dayStart(plan.availableTo))) {
    throw new ServiceValidationError("The subscription start date must be within the plan's availability dates.");
  }
}

function addPlanPeriod(date: Date, period: BillingPeriod) {
  switch (period) {
    case BillingPeriod.DAILY: return addDays(date, 1);
    case BillingPeriod.WEEKLY: return addWeeks(date, 1);
    case BillingPeriod.MONTHLY: return addMonths(date, 1);
    case BillingPeriod.YEARLY: return addYears(date, 1);
  }
}

async function buildLineData(transaction: Prisma.TransactionClient, input: SubscriptionInput) {
  await validateCatalogLines(transaction, input.lines);
  const taxIds = [...new Set(input.lines.flatMap((line) => line.taxId ? [line.taxId] : []))];
  const taxes = await transaction.tax.findMany({
    where: { id: { in: taxIds } },
    select: { id: true, type: true, rate: true },
  });
  const taxById = new Map(taxes.map((tax) => [tax.id, tax]));

  return input.lines.map((line) => {
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const subtotal = unitPrice.mul(line.quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const tax = line.taxId ? taxById.get(line.taxId) : undefined;
    const taxAmount = tax
      ? (tax.type === "PERCENT"
        ? subtotal.mul(tax.rate).div(100)
        : tax.rate.mul(line.quantity)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(0);
    return {
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice,
      taxId: line.taxId,
      amount: subtotal.plus(taxAmount),
    };
  });
}

async function validateSubscriptionReferences(
  transaction: Prisma.TransactionClient,
  input: SubscriptionInput,
) {
  const [customer, plan, paymentTerm, template] = await Promise.all([
    transaction.customer.findUnique({ where: { id: input.customerId }, select: { id: true } }),
    transaction.plan.findUnique({ where: { id: input.planId } }),
    transaction.paymentTerm.findUnique({ where: { id: input.paymentTermId }, select: { id: true } }),
    input.templateId
      ? transaction.quotationTemplate.findUnique({ where: { id: input.templateId }, select: { id: true, planId: true, isActive: true, validityDays: true } })
      : Promise.resolve(null),
  ]);
  if (!customer) throw new ServiceValidationError("Choose an existing customer.");
  if (!plan || !plan.isActive) throw new ServiceValidationError("Choose an active plan.");
  if (!paymentTerm) throw new ServiceValidationError("Choose an existing payment term.");
  if (input.templateId && (!template || !template.isActive || template.planId !== plan.id)) {
    throw new ServiceValidationError("Choose an active quotation template for the selected plan.");
  }
  const startDate = new Date(input.startDate);
  checkAvailability(startDate, plan);
  const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0);
  if (quantity < plan.minQuantity) {
    throw new ServiceValidationError(`The total subscription quantity must be at least ${plan.minQuantity}.`);
  }
  return { plan, template };
}

export async function listSubscriptions(input: {
  page: number;
  q: string;
  status?: SubscriptionStatus;
  customerId?: string;
  planId?: string;
}) {
  const where: Prisma.SubscriptionWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.q ? {
      OR: [
        { number: { contains: input.q, mode: "insensitive" } },
        { customer: { name: { contains: input.q, mode: "insensitive" } } },
        { plan: { name: { contains: input.q, mode: "insensitive" } } },
      ],
    } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscription.count({ where }),
  ]);
  return { items, page: input.page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getSubscription(id: string) {
  return prisma.subscription.findUnique({ where: { id }, include: subscriptionInclude });
}

export async function createSubscription(input: SubscriptionInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const { template } = await validateSubscriptionReferences(transaction, input);
    const lines = await buildLineData(transaction, input);
    const startDate = new Date(input.startDate);
    const quotationValidUntil = template
      ? addDays(new Date(), template.validityDays)
      : null;
    const subscription = await transaction.subscription.create({
      data: {
        number: await nextNumber("SUB", transaction),
        customerId: input.customerId,
        planId: input.planId,
        templateId: input.templateId,
        paymentTermId: input.paymentTermId,
        startDate,
        expiryDate: new Date(input.expiryDate),
        quotationValidUntil,
        notes: input.notes,
        lines: { create: lines },
        events: {
          create: {
            fromStatus: null,
            toStatus: SubscriptionStatus.DRAFT,
            action: "create",
            actorId,
          },
        },
      },
      include: subscriptionInclude,
    });
    return subscription;
  });
}

export async function updateSubscription(id: string, input: SubscriptionInput) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.subscription.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new AdminResourceNotFoundError();
    if (existing.status !== SubscriptionStatus.DRAFT && existing.status !== SubscriptionStatus.QUOTATION) {
      throw new SubscriptionTransitionError("Only draft and quotation subscriptions can be edited.");
    }

    const { template } = await validateSubscriptionReferences(transaction, input);
    const lines = await buildLineData(transaction, input);
    const updated = await transaction.subscription.updateMany({
      where: { id, status: { in: [SubscriptionStatus.DRAFT, SubscriptionStatus.QUOTATION] } },
      data: {
        customerId: input.customerId,
        planId: input.planId,
        templateId: input.templateId,
        paymentTermId: input.paymentTermId,
        startDate: new Date(input.startDate),
        expiryDate: new Date(input.expiryDate),
        quotationValidUntil: template ? addDays(new Date(), template.validityDays) : null,
        notes: input.notes,
      },
    });
    if (!updated.count) throw new SubscriptionTransitionError("The subscription status changed and it can no longer be edited.");
    await transaction.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
    await transaction.subscriptionLine.createMany({ data: lines.map((line) => ({ subscriptionId: id, ...line })) });
    return transaction.subscription.findUniqueOrThrow({ where: { id }, include: subscriptionInclude });
  });
}

export async function transitionSubscription(id: string, action: SubscriptionAction, actor: { id: string }) {
  return prisma.$transaction(async (transaction) => {
    const subscription = await transaction.subscription.findUnique({
      where: { id },
      include: { plan: { select: { period: true, pausable: true, closable: true, renewable: true } } },
    });
    if (!subscription) throw new AdminResourceNotFoundError();

    const fromStatus = subscription.status;
    let toStatus = fromStatus;
    let update: Prisma.SubscriptionUpdateManyMutationInput = {};
    const now = new Date();

    switch (action) {
      case "send_quotation":
        if (fromStatus !== SubscriptionStatus.DRAFT) throw new SubscriptionTransitionError("Only a draft can be sent as a quotation.");
        toStatus = SubscriptionStatus.QUOTATION;
        break;
      case "confirm":
        if (fromStatus !== SubscriptionStatus.QUOTATION) throw new SubscriptionTransitionError("Only a quotation can be confirmed.");
        toStatus = SubscriptionStatus.CONFIRMED;
        break;
      case "activate":
        if (fromStatus !== SubscriptionStatus.CONFIRMED) throw new SubscriptionTransitionError("Only a confirmed subscription can be activated.");
        toStatus = SubscriptionStatus.ACTIVE;
        update = { nextBillingDate: subscription.startDate, billedCount: 0 };
        break;
      case "pause":
        if (fromStatus !== SubscriptionStatus.ACTIVE) throw new SubscriptionTransitionError("Only an active subscription can be paused.");
        if (!subscription.plan.pausable) throw new SubscriptionTransitionError("This plan does not allow pausing.");
        toStatus = SubscriptionStatus.PAUSED;
        update = { pausedAt: now };
        break;
      case "resume": {
        if (fromStatus !== SubscriptionStatus.PAUSED) throw new SubscriptionTransitionError("Only a paused subscription can be resumed.");
        const pausedDays = subscription.pausedAt
          ? Math.max(0, Math.ceil((now.getTime() - subscription.pausedAt.getTime()) / 86_400_000))
          : 0;
        toStatus = SubscriptionStatus.ACTIVE;
        update = {
          pausedAt: null,
          nextBillingDate: subscription.nextBillingDate ? addDays(subscription.nextBillingDate, pausedDays) : null,
          expiryDate: addDays(subscription.expiryDate, pausedDays),
        };
        break;
      }
      case "close":
        if (fromStatus !== SubscriptionStatus.ACTIVE) throw new SubscriptionTransitionError("Only an active subscription can be closed.");
        if (!subscription.plan.closable) throw new SubscriptionTransitionError("This plan does not allow closing.");
        toStatus = SubscriptionStatus.CLOSED;
        update = { closedAt: now };
        break;
      case "renew":
        if (fromStatus !== SubscriptionStatus.ACTIVE) throw new SubscriptionTransitionError("Only an active subscription can be renewed.");
        if (!subscription.plan.renewable) throw new SubscriptionTransitionError("This plan does not allow renewal.");
        update = { expiryDate: addPlanPeriod(subscription.expiryDate, subscription.plan.period) };
        break;
      case "cancel":
        if (
          fromStatus !== SubscriptionStatus.DRAFT
          && fromStatus !== SubscriptionStatus.QUOTATION
          && fromStatus !== SubscriptionStatus.CONFIRMED
        ) {
          throw new SubscriptionTransitionError("Only a draft, quotation, or confirmed subscription can be cancelled.");
        }
        toStatus = SubscriptionStatus.CLOSED;
        update = { closedAt: now };
        break;
    }

    const changed = await transaction.subscription.updateMany({
      where: { id, status: fromStatus },
      data: { ...update, status: toStatus },
    });
    if (!changed.count) throw new SubscriptionTransitionError("The subscription changed before this action could be applied.");
    await transaction.subscriptionEvent.create({
      data: { subscriptionId: id, fromStatus, toStatus, action, actorId: actor.id },
    });
    return transaction.subscription.findUniqueOrThrow({ where: { id }, include: subscriptionInclude });
  });
}

export async function listSubscriptionEditorOptions() {
  const [customers, plans, templates, paymentTerms, products, taxes] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, period: true, minQuantity: true, availableFrom: true, availableTo: true },
      orderBy: { name: "asc" },
    }),
    prisma.quotationTemplate.findMany({
      where: { isActive: true },
      include: { lines: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentTerm.findMany({ select: { id: true, name: true, days: true }, orderBy: { days: "asc" } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        salesPrice: true,
        defaultTaxId: true,
        variants: { where: { isActive: true }, select: { id: true, attribute: true, value: true, extraPrice: true }, orderBy: [{ attribute: "asc" }, { value: "asc" }] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tax.findMany({ where: { isActive: true }, select: { id: true, name: true, type: true, rate: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    customers,
    plans: plans.map((plan) => ({
      ...plan,
      availableFrom: plan.availableFrom.toISOString(),
      availableTo: plan.availableTo?.toISOString() ?? null,
    })),
    templates,
    paymentTerms,
    products: products.map((product) => ({
      ...product,
      salesPrice: product.salesPrice.toString(),
      defaultTaxId: product.defaultTaxId && taxes.some((tax) => tax.id === product.defaultTaxId)
        ? product.defaultTaxId
        : null,
      variants: product.variants.map((variant) => ({
        ...variant,
        extraPrice: variant.extraPrice.toString(),
        unitPrice: new Prisma.Decimal(product.salesPrice).plus(variant.extraPrice).toFixed(2),
      })),
    })),
    taxes: taxes.map((tax) => ({ ...tax, rate: tax.rate.toString() })),
  };
}

export async function listSubscriptionFilterOptions() {
  const [customers, plans] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.plan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { customers, plans };
}

export async function listSubscriptionDiscountOptions(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { lines: { select: { productId: true } }, discounts: { select: { discountId: true } } },
  });
  if (!subscription) throw new AdminResourceNotFoundError();
  const now = new Date();
  const productIds = [...new Set(subscription.lines.map((line) => line.productId))];
  const discounts = await prisma.discount.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      id: { notIn: subscription.discounts.map((discount) => discount.discountId) },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        {
          OR: [
            { scope: "SUBSCRIPTION" },
            { scope: "PRODUCT", products: { some: { productId: { in: productIds } } } },
          ],
        },
      ],
    },
    orderBy: { name: "asc" },
  });
  return discounts.filter((discount) => discount.usageLimit === null || discount.usedCount < discount.usageLimit);
}

export async function attachSubscriptionDiscount(subscriptionId: string, discountId: string) {
  const [subscription, discount] = await Promise.all([
    prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { lines: { select: { productId: true } } } }),
    prisma.discount.findUnique({
      where: { id: discountId },
      include: { products: { select: { productId: true } } },
    }),
  ]);
  if (!subscription) throw new AdminResourceNotFoundError();
  if (!discount || !discount.isActive) throw new ServiceValidationError("Choose an active discount.");
  const now = new Date();
  if (discount.startDate > now || (discount.endDate && discount.endDate < now)) {
    throw new ServiceValidationError("This discount is outside its validity dates.");
  }
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    throw new ServiceValidationError("This discount has reached its usage limit.");
  }
  if (discount.scope === "PRODUCT" && !discount.products.some(({ productId }) => subscription.lines.some((line) => line.productId === productId))) {
    throw new ServiceValidationError("This product discount does not apply to any subscription line.");
  }
  return prisma.subscriptionDiscount.create({
    data: { subscriptionId, discountId },
    include: { discount: true },
  });
}

export async function detachSubscriptionDiscount(subscriptionId: string, discountId: string) {
  const result = await prisma.subscriptionDiscount.deleteMany({ where: { subscriptionId, discountId } });
  if (!result.count) throw new ServiceValidationError("This discount is not attached to the subscription.");
}
