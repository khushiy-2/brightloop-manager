import { InvoiceStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import type { DashboardQuery } from "@/lib/validation/dashboard";
import { prisma } from "@/server/db";

const pageSize = 10;

type MonthlyRevenueJson = {
  month: string;
  revenue: string;
};

type DashboardMetricRow = {
  active_subscription_count: bigint;
  revenue: Prisma.Decimal;
  invoiced_total: Prisma.Decimal;
  outstanding_total: Prisma.Decimal;
  overdue_count: bigint;
  overdue_amount: Prisma.Decimal;
  monthly_revenue: Prisma.JsonValue;
};

function parseMonthlyRevenue(value: Prisma.JsonValue): MonthlyRevenueJson[] {
  if (!Array.isArray(value)) {
    throw new Error("Dashboard query returned invalid monthly revenue data.");
  }

  return value.map((entry) => {
    if (
      typeof entry !== "object"
      || entry === null
      || Array.isArray(entry)
      || typeof entry.month !== "string"
      || typeof entry.revenue !== "string"
    ) {
      throw new Error("Dashboard query returned invalid monthly revenue data.");
    }
    return { month: entry.month, revenue: entry.revenue };
  });
}

function rangeStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function rangeEndExclusive(value: string) {
  const end = rangeStart(value);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export async function getDashboardReport(input: DashboardQuery) {
  const start = rangeStart(input.startDate);
  const end = rangeEndExclusive(input.endDate);
  const lastDay = rangeStart(input.endDate);
  const now = new Date();
  const rows = await prisma.$queryRaw<DashboardMetricRow[]>`
    WITH selected_payments AS (
      SELECT payment."amount", payment."paidAt"
      FROM "Payment" AS payment
      INNER JOIN "Invoice" AS invoice ON invoice."id" = payment."invoiceId"
      INNER JOIN "Subscription" AS subscription ON subscription."id" = invoice."subscriptionId"
      WHERE payment."paidAt" >= ${start}
        AND payment."paidAt" < ${end}
        AND (${input.planId ?? null}::text IS NULL OR subscription."planId" = ${input.planId ?? null})
        AND (${input.customerId ?? null}::text IS NULL OR invoice."customerId" = ${input.customerId ?? null})
    ),
    selected_invoices AS (
      SELECT invoice."status", invoice."total", invoice."amountPaid", invoice."dueDate"
      FROM "Invoice" AS invoice
      INNER JOIN "Subscription" AS subscription ON subscription."id" = invoice."subscriptionId"
      WHERE invoice."issueDate" >= ${start}
        AND invoice."issueDate" < ${end}
        AND (${input.planId ?? null}::text IS NULL OR subscription."planId" = ${input.planId ?? null})
        AND (${input.customerId ?? null}::text IS NULL OR invoice."customerId" = ${input.customerId ?? null})
    ),
    selected_subscriptions AS (
      SELECT subscription."status"
      FROM "Subscription" AS subscription
      WHERE (${input.planId ?? null}::text IS NULL OR subscription."planId" = ${input.planId ?? null})
        AND (${input.customerId ?? null}::text IS NULL OR subscription."customerId" = ${input.customerId ?? null})
    ),
    monthly_revenue AS (
      SELECT date_trunc('month', payment."paidAt") AS month_start, SUM(payment."amount") AS revenue
      FROM selected_payments AS payment
      GROUP BY date_trunc('month', payment."paidAt")
    )
    SELECT
      (SELECT COUNT(*) FILTER (WHERE subscription."status" = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus")
        FROM selected_subscriptions AS subscription) AS active_subscription_count,
      (SELECT COALESCE(SUM(payment."amount") FILTER (
        WHERE payment."paidAt" >= ${start} AND payment."paidAt" < ${end}
      ), 0) FROM selected_payments AS payment) AS revenue,
      (SELECT COALESCE(SUM(invoice."total") FILTER (
        WHERE invoice."status" IN (${InvoiceStatus.CONFIRMED}::"InvoiceStatus", ${InvoiceStatus.PAID}::"InvoiceStatus")
      ), 0) FROM selected_invoices AS invoice) AS invoiced_total,
      (SELECT COALESCE(SUM(invoice."total" - invoice."amountPaid") FILTER (
        WHERE invoice."status" = ${InvoiceStatus.CONFIRMED}::"InvoiceStatus"
      ), 0) FROM selected_invoices AS invoice) AS outstanding_total,
      (SELECT COUNT(*) FILTER (
        WHERE invoice."status" = ${InvoiceStatus.CONFIRMED}::"InvoiceStatus"
          AND invoice."dueDate" < ${now}
          AND invoice."amountPaid" < invoice."total"
      ) FROM selected_invoices AS invoice) AS overdue_count,
      (SELECT COALESCE(SUM(invoice."total" - invoice."amountPaid") FILTER (
        WHERE invoice."status" = ${InvoiceStatus.CONFIRMED}::"InvoiceStatus"
          AND invoice."dueDate" < ${now}
          AND invoice."amountPaid" < invoice."total"
      ), 0) FROM selected_invoices AS invoice) AS overdue_amount,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'month', to_char(calendar.month_start, 'YYYY-MM'),
              'revenue', COALESCE(monthly.revenue, 0)::text
            ) ORDER BY calendar.month_start
          ),
          '[]'::jsonb
        )
        FROM generate_series(
          date_trunc('month', ${start}::timestamptz),
          date_trunc('month', ${lastDay}::timestamptz),
          interval '1 month'
        ) AS calendar(month_start)
        LEFT JOIN monthly_revenue AS monthly ON monthly.month_start = calendar.month_start
      ) AS monthly_revenue
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Dashboard query did not return its aggregate row.");
  }

  const overdueWhere: Prisma.InvoiceWhereInput = {
    status: InvoiceStatus.CONFIRMED,
    dueDate: { lt: now },
    amountPaid: { lt: prisma.invoice.fields.total },
    issueDate: { gte: start, lt: end },
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.planId ? { subscription: { planId: input.planId } } : {}),
  };
  const [overdueInvoices, overdueTotal] = await prisma.$transaction([
    prisma.invoice.findMany({
      where: overdueWhere,
      select: {
        id: true,
        number: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      skip: (input.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where: overdueWhere }),
  ]);
  return {
    activeSubscriptions: Number(row.active_subscription_count),
    revenue: row.revenue,
    invoicedTotal: row.invoiced_total,
    outstandingTotal: row.outstanding_total,
    overdueCount: Number(row.overdue_count),
    overdueAmount: row.overdue_amount,
    monthlyRevenue: parseMonthlyRevenue(row.monthly_revenue),
    overdueInvoices,
    overduePage: input.page,
    overduePageSize: pageSize,
    overdueTotal,
    overduePageCount: Math.max(1, Math.ceil(overdueTotal / pageSize)),
  };
}

export async function getDashboardFilterOptions() {
  const [plans, customers] = await Promise.all([
    prisma.plan.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { plans, customers };
}
