import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

async function incrementCounter(prefix: string, transaction: Prisma.TransactionClient) {
  const counter = await transaction.counter.upsert({
    where: { key: prefix },
    create: { key: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(6, "0")}`;
}

export async function nextNumber(prefix: string, transaction?: Prisma.TransactionClient) {
  if (!/^[A-Z]+(?:-\d{4})?$/.test(prefix)) {
    throw new Error("Number prefix must contain uppercase letters and an optional four-digit year.");
  }
  if (transaction) return incrementCounter(prefix, transaction);
  return prisma.$transaction((tx) => incrementCounter(prefix, tx));
}
