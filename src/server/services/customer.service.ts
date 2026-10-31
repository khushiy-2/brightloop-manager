import { Prisma } from "@prisma/client";
import type { customerInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { prisma } from "@/server/db";

const pageSize = 10;
type CustomerInput = z.infer<typeof customerInputSchema>;

export async function listCustomers(page: number, query: string) {
  const where: Prisma.CustomerWhereInput = query ? {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { company: { contains: query, mode: "insensitive" } },
    ],
  } : {};
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listCustomerOptions() {
  return prisma.customer.findMany({
    select: { id: true, name: true, email: true, company: true },
    orderBy: { name: "asc" },
  });
}

export async function createCustomer(input: CustomerInput) {
  return prisma.customer.create({ data: input });
}

export async function updateCustomer(id: string, input: CustomerInput) {
  return prisma.customer.update({ where: { id }, data: input });
}
