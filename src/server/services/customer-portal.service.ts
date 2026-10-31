import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { getInvoicePaymentStatus } from "@/server/services/invoice.service";

const pageSize = 10;

export async function listCustomerSubscriptions(userId: string, page: number) {
  const where: Prisma.SubscriptionWhereInput = {
    customer: { userId },
  };
  const [items, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where: { ...where, customer: { userId } },
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        expiryDate: true,
        plan: { select: { name: true, period: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscription.count({ where: { ...where, customer: { userId } } }),
  ]);
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listCustomerInvoices(userId: string, page: number) {
  const where: Prisma.InvoiceWhereInput = {
    customer: { userId },
  };
  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where: { ...where, customer: { userId } },
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        subscription: { select: { number: true, plan: { select: { name: true } } } },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where: { ...where, customer: { userId } } }),
  ]);
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

const customerInvoiceInclude = {
  customer: { select: { name: true, email: true, company: true, address: true, taxId: true } },
  subscription: { select: { number: true, plan: { select: { name: true, period: true } } } },
  lines: {
    include: {
      product: { select: { name: true } },
      variant: { select: { attribute: true, value: true } },
      tax: { select: { name: true } },
    },
  },
  payments: {
    select: { id: true, amount: true, method: true, paidAt: true },
    orderBy: { paidAt: "desc" },
  },
} satisfies Prisma.InvoiceInclude;

export async function getCustomerInvoice(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, customer: { userId } },
    include: customerInvoiceInclude,
  });
  if (!invoice) return null;
  return { ...invoice, paymentStatus: getInvoicePaymentStatus(invoice) };
}
