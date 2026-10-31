import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type {
  paymentTermInputSchema,
  planInputSchema,
  productInputSchema,
  taxInputSchema,
  variantInputSchema,
  variantUpdateSchema,
} from "@/lib/validation/admin";
import type { z } from "zod";
import { AdminResourceNotFoundError } from "@/server/services/errors";

const pageSize = 10;

function pageResult<T>(items: T[], total: number, page: number) {
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listProducts(page: number, query: string) {
  const where: Prisma.ProductWhereInput = query
    ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { notes: { contains: query, mode: "insensitive" } }] }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        defaultTax: { select: { id: true, name: true, type: true, rate: true } },
        variants: { orderBy: [{ attribute: "asc" }, { value: "asc" }] },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return pageResult(items, total, page);
}

export async function createProduct(input: z.infer<typeof productInputSchema>) {
  return prisma.product.create({
    data: {
      ...input,
      notes: input.notes || null,
      defaultTaxId: input.defaultTaxId || null,
      salesPrice: new Prisma.Decimal(input.salesPrice),
      costPrice: new Prisma.Decimal(input.costPrice),
    },
    include: { defaultTax: true, variants: true },
  });
}

export async function updateProduct(id: string, input: z.infer<typeof productInputSchema>) {
  return prisma.product.update({
    where: { id },
    data: {
      ...input,
      notes: input.notes || null,
      defaultTaxId: input.defaultTaxId || null,
      salesPrice: new Prisma.Decimal(input.salesPrice),
      costPrice: new Prisma.Decimal(input.costPrice),
    },
    include: { defaultTax: true, variants: true },
  });
}

export async function deactivateProduct(id: string) {
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function createProductVariant(productId: string, input: z.infer<typeof variantInputSchema>) {
  return prisma.productVariant.create({
    data: { ...input, productId, extraPrice: new Prisma.Decimal(input.extraPrice) },
  });
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  input: z.infer<typeof variantUpdateSchema>,
) {
  const result = await prisma.productVariant.updateMany({
    where: { id: variantId, productId },
    data: { ...input, extraPrice: new Prisma.Decimal(input.extraPrice) },
  });
  if (!result.count) throw new AdminResourceNotFoundError();
  return prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
}

export async function deactivateProductVariant(productId: string, variantId: string) {
  const result = await prisma.productVariant.updateMany({
    where: { id: variantId, productId },
    data: { isActive: false },
  });
  if (!result.count) throw new AdminResourceNotFoundError();
  return prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
}

export async function listProductVariants(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new AdminResourceNotFoundError();
  return prisma.productVariant.findMany({
    where: { productId },
    orderBy: [{ attribute: "asc" }, { value: "asc" }],
  });
}

export async function listTaxes(page: number, query: string) {
  const where: Prisma.TaxWhereInput = query
    ? { name: { contains: query, mode: "insensitive" } }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.tax.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.tax.count({ where }),
  ]);
  return pageResult(items, total, page);
}

export async function listTaxOptions() {
  return prisma.tax.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function createTax(input: z.infer<typeof taxInputSchema>) {
  return prisma.tax.create({ data: { ...input, rate: new Prisma.Decimal(input.rate) } });
}

export async function updateTax(id: string, input: z.infer<typeof taxInputSchema>) {
  return prisma.tax.update({ where: { id }, data: { ...input, rate: new Prisma.Decimal(input.rate) } });
}

export async function deactivateTax(id: string) {
  return prisma.tax.update({ where: { id }, data: { isActive: false } });
}

export async function listPaymentTerms(page: number, query: string) {
  const where: Prisma.PaymentTermWhereInput = query
    ? { name: { contains: query, mode: "insensitive" } }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.paymentTerm.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.paymentTerm.count({ where }),
  ]);
  return pageResult(items, total, page);
}

export async function createPaymentTerm(input: z.infer<typeof paymentTermInputSchema>) {
  return prisma.paymentTerm.create({ data: input });
}

export async function updatePaymentTerm(id: string, input: z.infer<typeof paymentTermInputSchema>) {
  return prisma.paymentTerm.update({ where: { id }, data: input });
}

export async function deletePaymentTerm(id: string) {
  return prisma.paymentTerm.delete({ where: { id } });
}

export async function listPlans(page: number, query: string) {
  const where: Prisma.PlanWhereInput = query
    ? { name: { contains: query, mode: "insensitive" } }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.plan.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.plan.count({ where }),
  ]);
  return pageResult(items, total, page);
}

export async function createPlan(input: z.infer<typeof planInputSchema>) {
  return prisma.plan.create({
    data: {
      ...input,
      price: new Prisma.Decimal(input.price),
      availableFrom: new Date(input.availableFrom),
      availableTo: input.availableTo ? new Date(input.availableTo) : null,
    },
  });
}

export async function updatePlan(id: string, input: z.infer<typeof planInputSchema>) {
  return prisma.plan.update({
    where: { id },
    data: {
      ...input,
      price: new Prisma.Decimal(input.price),
      availableFrom: new Date(input.availableFrom),
      availableTo: input.availableTo ? new Date(input.availableTo) : null,
    },
  });
}

export async function deactivatePlan(id: string) {
  return prisma.plan.update({ where: { id }, data: { isActive: false } });
}
