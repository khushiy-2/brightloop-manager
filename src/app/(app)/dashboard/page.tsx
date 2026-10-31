import { Role } from "@prisma/client";
import Link from "next/link";
import { Suspense } from "react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { dashboardQuerySchema, type DashboardQuery } from "@/lib/validation/dashboard";
import { requireRole } from "@/server/auth/guards";
import { getDashboardFilterOptions, getDashboardReport } from "@/server/services/dashboard.service";

export const instant = false;

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function defaultDateRange() {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function money(value: { toFixed: (digits: number) => string }) {
  return `$${value.toFixed(2)}`;
}

async function DashboardContent({ query }: { query: DashboardQuery }) {
  const [report, options] = await Promise.all([
    getDashboardReport(query),
    getDashboardFilterOptions(),
  ]);
  const selectedFilters = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
  });
  if (query.planId) selectedFilters.set("planId", query.planId);
  if (query.customerId) selectedFilters.set("customerId", query.customerId);

  function pageHref(page: number) {
    const params = new URLSearchParams(selectedFilters);
    params.set("page", String(page));
    return `/dashboard?${params.toString()}`;
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">OVERVIEW</p>
        <h1>Dashboard</h1>
      </div>
      <form className="dashboard-filters" action="/dashboard" method="get">
        <label className="form-field">
          From
          <input type="date" name="startDate" defaultValue={query.startDate} required />
        </label>
        <label className="form-field">
          To
          <input type="date" name="endDate" defaultValue={query.endDate} required />
        </label>
        <label className="form-field">
          Plan
          <select name="planId" defaultValue={query.planId ?? ""}>
            <option value="">All plans</option>
            {options.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Customer
          <select name="customerId" defaultValue={query.customerId ?? ""}>
            <option value="">All customers</option>
            {options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <button className="primary-button dashboard-filter-button" type="submit">Apply filters</button>
      </form>

      <div className="dashboard-kpis">
        <article className="dashboard-kpi">
          <span>Active subscriptions</span>
          <strong>{report.activeSubscriptions.toLocaleString()}</strong>
        </article>
        <article className="dashboard-kpi">
          <span>Revenue</span>
          <strong>{money(report.revenue)}</strong>
          <small>Payments received in the selected date range</small>
        </article>
        <article className="dashboard-kpi">
          <span>Invoiced total</span>
          <strong>{money(report.invoicedTotal)}</strong>
        </article>
        <article className="dashboard-kpi">
          <span>Outstanding</span>
          <strong>{money(report.outstandingTotal)}</strong>
        </article>
        <article className="dashboard-kpi dashboard-kpi-alert">
          <span>Overdue invoices</span>
          <strong>{report.overdueCount.toLocaleString()}</strong>
        </article>
        <article className="dashboard-kpi dashboard-kpi-alert">
          <span>Overdue amount</span>
          <strong>{money(report.overdueAmount)}</strong>
        </article>
      </div>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Revenue by month</h2>
            <p>Payments received within the selected date range.</p>
          </div>
        </div>
        <RevenueChart data={report.monthlyRevenue} />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Overdue invoices</h2>
            <p>{report.overdueTotal.toLocaleString()} confirmed invoices past due.</p>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Total</th><th>Outstanding</th></tr>
            </thead>
            <tbody>
              {report.overdueInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><Link href={`/invoices/${invoice.id}`}>{invoice.number}</Link></td>
                  <td>{invoice.customer.name}</td>
                  <td>{invoice.dueDate.toLocaleDateString()}</td>
                  <td>{money(invoice.total)}</td>
                  <td>{money(invoice.total.sub(invoice.amountPaid))}</td>
                </tr>
              ))}
              {report.overdueInvoices.length === 0 && (
                <tr><td className="table-empty" colSpan={5}>No overdue invoices for these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <nav className="pagination-bar" aria-label="Overdue invoice pages">
          <span>Page {report.overduePage} of {report.overduePageCount}</span>
          <div>
            {report.overduePage > 1
              ? <Link className="quiet-button" href={pageHref(report.overduePage - 1)}>Previous</Link>
              : <button className="quiet-button" type="button" disabled>Previous</button>}
            {report.overduePage < report.overduePageCount
              ? <Link className="quiet-button" href={pageHref(report.overduePage + 1)}>Next</Link>
              : <button className="quiet-button" type="button" disabled>Next</button>}
          </div>
        </nav>
      </section>
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole(Role.ADMIN, Role.STAFF);
  const params = await searchParams;
  const defaults = defaultDateRange();
  const parsed = dashboardQuerySchema.safeParse({
    startDate: firstParam(params.startDate) ?? defaults.startDate,
    endDate: firstParam(params.endDate) ?? defaults.endDate,
    planId: firstParam(params.planId),
    customerId: firstParam(params.customerId),
    page: firstParam(params.page),
  });
  const query = parsed.success
    ? parsed.data
    : { ...defaults, page: 1 };

  return (
    <Suspense fallback={<section className="page-section"><p>Loading dashboard…</p></section>}>
      <DashboardContent query={query} />
    </Suspense>
  );
}
