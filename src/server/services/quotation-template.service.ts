import { Prisma } from "@prisma/client";
import type { quotationTemplateInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { prisma } from "@/server/db";
import { validateCatalogLines } from "@/server/services/catalog-lines";
import { ServiceValidationError } from "@/server/services/service-errors";

const pageSize = 10;
type TemplateInput = z.infer<typeof quotationTemplateInputSchema>;

const templateInclude = {
  plan: { select: { id: true, name: true, period: true, minQuantity: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, attribute: true, value: true } },
      tax: { select: { id: true, name: true, type: true, rate: true } },
    },
  },
} satisfies Prisma.QuotationTemplateInclude;

export async function listQuotationTemplates(page: number, query: string) {
  const where: Prisma.QuotationTemplateWhereInput = query
    ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { plan: { name: { contains: query, mode: "insensitive" } } }] }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.quotationTemplate.findMany({
      where,
      include: templateInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quotationTemplate.count({ where }),
  ]);
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function lineCreates(input: TemplateInput) {
  return input.lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    taxId: line.taxId,
  }));
}

export async function createQuotationTemplate(input: TemplateInput) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.plan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true } });
    if (!plan) throw new ServiceValidationError("Choose an existing plan.");
    await validateCatalogLines(transaction, input.lines);
    return transaction.quotationTemplate.create({
      data: {
        name: input.name,
        planId: input.planId,
        validityDays: input.validityDays,
        isActive: input.isActive,
        lines: { create: lineCreates(input) },
      },
      include: templateInclude,
    });
  });
}

export async function updateQuotationTemplate(id: string, input: TemplateInput) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.plan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true } });
    if (!plan) throw new ServiceValidationError("Choose an existing plan.");
    await validateCatalogLines(transaction, input.lines);
    await transaction.quotationTemplate.update({
      where: { id },
      data: {
        name: input.name,
        planId: input.planId,
        validityDays: input.validityDays,
        isActive: input.isActive,
      },
    });
    await transaction.quotationTemplateLine.deleteMany({ where: { templateId: id } });
    await transaction.quotationTemplateLine.createMany({
      data: input.lines.map((line) => ({ templateId: id, ...line })),
    });
    return transaction.quotationTemplate.findUniqueOrThrow({ where: { id }, include: templateInclude });
  });
}

export async function listTemplateEditorOptions() {
  const [plans, products, taxes] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        variants: { where: { isActive: true }, select: { id: true, attribute: true, value: true }, orderBy: [{ attribute: "asc" }, { value: "asc" }] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tax.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { plans, products, taxes };
}
