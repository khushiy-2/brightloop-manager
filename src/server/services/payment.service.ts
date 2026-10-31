import { Prisma } from "@prisma/client";
import type { paymentListQuerySchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { prisma } from "@/server/db";

const pageSize = 10;

type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

function dayStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

export async function listPayments(input: PaymentListQuery) {
  const where: Prisma.PaymentWhereInput = {
    ...(input.method ? { method: input.method } : {}),
    ...(input.startDate || input.endDate
      ? {
        paidAt: {
          ...(input.startDate ? { gte: dayStart(input.startDate) } : {}),
          ...(input.endDate ? { lte: dayEnd(input.endDate) } : {}),
        },
      }
      : {}),
    ...(input.q
      ? {
        OR: [
          { invoice: { number: { contains: input.q, mode: "insensitive" } } },
          { invoice: { customer: { name: { contains: input.q, mode: "insensitive" } } } },
          { reference: { contains: input.q, mode: "insensitive" } },
        ],
      }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { id: true, number: true, customer: { select: { name: true } } } },
        recordedBy: { select: { name: true } },
      },
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, page: input.page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
