import { Prisma } from "@prisma/client";
import type { discountInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { prisma } from "@/server/db";

const pageSize = 10;

type DiscountInput = z.infer<typeof discountInputSchema>;

function pageResult<T>(items: T[], total: number, page: number) {
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function discountData(input: DiscountInput) {
  return {
    name: input.name,
    code: input.code || null,
    type: input.type,
    value: new Prisma.Decimal(input.value),
    scope: input.scope,
    minPurchase: input.minPurchase === null ? null : new Prisma.Decimal(input.minPurchase),
    minQuantity: input.minQuantity,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    usageLimit: input.usageLimit,
    isActive: input.isActive,
  };
}

export async function listDiscounts(page: number, query: string) {
  const where: Prisma.DiscountWhereInput = query
    ? {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.discount.findMany({
      where,
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.discount.count({ where }),
  ]);
  return pageResult(items, total, page);
}

export async function listDiscountProductOptions() {
  return prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createDiscount(input: DiscountInput) {
  return prisma.discount.create({
    data: {
      ...discountData(input),
      products: {
        create: input.productIds.map((productId) => ({ product: { connect: { id: productId } } })),
      },
    },
    include: { products: { include: { product: { select: { id: true, name: true } } } } },
  });
}

export async function updateDiscount(id: string, input: DiscountInput) {
  return prisma.$transaction(async (transaction) => {
    await transaction.discount.update({ where: { id }, data: discountData(input) });
    await transaction.discountProduct.deleteMany({ where: { discountId: id } });
    if (input.productIds.length > 0) {
      await transaction.discountProduct.createMany({
        data: input.productIds.map((productId) => ({ discountId: id, productId })),
      });
    }
    return transaction.discount.findUniqueOrThrow({
      where: { id },
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
    });
  });
}

export async function deleteDiscount(id: string) {
  return prisma.discount.delete({ where: { id } });
}
