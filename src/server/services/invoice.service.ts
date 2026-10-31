import { InvoiceStatus, Prisma } from "@prisma/client";
import type { invoiceActionSchema, invoiceListQuerySchema, paymentInputSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { prisma } from "@/server/db";
import { AdminResourceNotFoundError } from "@/server/services/errors";
import { InvoiceTransitionError } from "@/server/services/service-errors";

const pageSize = 10;

const invoiceInclude = {
  customer: { select: { id: true, name: true, email: true, company: true, address: true, taxId: true } },
  subscription: { select: { id: true, number: true, plan: { select: { name: true, period: true } } } },
  lines: {
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, attribute: true, value: true } },
      tax: { select: { id: true, name: true, type: true } },
    },
  },
  discounts: { include: { discount: { select: { id: true, name: true, type: true, value: true } } } },
  payments: {
    select: { id: true, method: true, amount: true, paidAt: true, note: true, reference: true },
    orderBy: { paidAt: "desc" },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
type InvoiceAction = z.infer<typeof invoiceActionSchema>["action"];
type PaymentInput = z.infer<typeof paymentInputSchema>;

type InvoicePaymentState = {
  status: InvoiceStatus;
  dueDate: Date;
  amountPaid: Prisma.Decimal;
  total: Prisma.Decimal;
};

export function isInvoiceOverdue(invoice: InvoicePaymentState, now = new Date()) {
  return invoice.status === InvoiceStatus.CONFIRMED
    && invoice.dueDate < now
    && invoice.amountPaid.lt(invoice.total);
}

export function getInvoicePaymentStatus(invoice: InvoicePaymentState, now = new Date()) {
  if (invoice.status === InvoiceStatus.PAID || invoice.amountPaid.gte(invoice.total)) return "Paid";
  if (isInvoiceOverdue(invoice, now)) return "Overdue";
  return "Outstanding";
}

function dayStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

export async function listInvoices(input: InvoiceListQuery) {
  const now = new Date();
  const where: Prisma.InvoiceWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.overdue === "true"
      ? {
        AND: [{
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: now },
          amountPaid: { lt: prisma.invoice.fields.total },
        }],
      }
      : {}),
    ...(input.startDate || input.endDate
      ? {
        issueDate: {
          ...(input.startDate ? { gte: dayStart(input.startDate) } : {}),
          ...(input.endDate ? { lte: dayEnd(input.endDate) } : {}),
        },
      }
      : {}),
    ...(input.q
      ? {
        OR: [
          { number: { contains: input.q, mode: "insensitive" } },
          { customer: { name: { contains: input.q, mode: "insensitive" } } },
        ],
      }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        subscription: { select: { number: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: (input.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);
  return {
    items: items.map((invoice) => ({
      ...invoice,
      paymentStatus: getInvoicePaymentStatus(invoice, now),
    })),
    page: input.page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) return null;
  return { ...invoice, paymentStatus: getInvoicePaymentStatus(invoice) };
}

export async function listInvoiceFilterOptions() {
  return prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function transitionInvoice(id: string, action: InvoiceAction) {
  let shouldLogSend = false;
  const invoice = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE
    `;
    const current = await transaction.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!current) throw new AdminResourceNotFoundError();

    switch (action) {
      case "confirm": {
        if (current.status !== InvoiceStatus.DRAFT) {
          throw new InvoiceTransitionError("Only a draft invoice can be confirmed.");
        }
        return transaction.invoice.update({
          where: { id },
          data: { status: InvoiceStatus.CONFIRMED, confirmedAt: new Date() },
          include: invoiceInclude,
        });
      }
      case "cancel": {
        const unpaid = new Prisma.Decimal(current.amountPaid).isZero();
        if (
          current.status !== InvoiceStatus.DRAFT
          && !(current.status === InvoiceStatus.CONFIRMED && unpaid)
        ) {
          throw new InvoiceTransitionError("Only a draft or unpaid confirmed invoice can be cancelled.");
        }
        const usages = await transaction.discountUsage.findMany({
          where: { invoiceId: id },
          select: { id: true, discountId: true },
        });
        for (const usage of usages) {
          const decremented = await transaction.discount.updateMany({
            where: { id: usage.discountId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
          if (!decremented.count) {
            throw new InvoiceTransitionError("A discount usage count could not be released safely.");
          }
        }
        await transaction.discountUsage.deleteMany({ where: { invoiceId: id } });
        return transaction.invoice.update({
          where: { id },
          data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
          include: invoiceInclude,
        });
      }
      case "send": {
        if (current.status !== InvoiceStatus.CONFIRMED) {
          throw new InvoiceTransitionError("Only a confirmed invoice can be sent.");
        }
        if (!current.sentAt) {
          shouldLogSend = true;
          return transaction.invoice.update({
            where: { id },
            data: { sentAt: new Date() },
            include: invoiceInclude,
          });
        }
        return current;
      }
    }
  });

  if (shouldLogSend) {
    console.log("Invoice send simulated:", {
      number: invoice.number,
      recipient: invoice.customer.email,
      invoiceId: invoice.id,
    });
  }
  return invoice;
}

export async function recordInvoicePayment(
  invoiceId: string,
  recordedById: string,
  input: PaymentInput,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE
    `;
    const invoice = await transaction.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, amountPaid: true, total: true },
    });
    if (!invoice) throw new AdminResourceNotFoundError();
    if (invoice.status !== InvoiceStatus.CONFIRMED) {
      throw new InvoiceTransitionError("Only confirmed invoices can receive payments.");
    }

    const amount = new Prisma.Decimal(input.amount);
    const outstanding = invoice.total.sub(invoice.amountPaid);
    if (amount.gt(outstanding)) {
      throw new InvoiceTransitionError("Payment amount cannot exceed the outstanding balance.");
    }

    const amountPaid = invoice.amountPaid.add(amount);
    const paidAt = new Date(input.paidAt);
    const payment = await transaction.payment.create({
      data: {
        invoiceId,
        recordedById,
        method: input.method,
        amount,
        paidAt,
        note: input.note,
        reference: input.reference,
      },
    });
    const updatedInvoice = await transaction.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid,
        ...(amountPaid.gte(invoice.total) ? { status: InvoiceStatus.PAID, paidAt } : {}),
      },
    });
    return { payment, invoice: updatedInvoice };
  });
}
