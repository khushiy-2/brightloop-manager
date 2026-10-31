import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getSession } from "@/server/auth/guards";

export const instant = false;

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Products", "/products"],
  ["Plans", "/plans"],
  ["Taxes", "/taxes"],
  ["Payment Terms", "/payment-terms"],
  ["Discounts", "/discounts"],
  ["Quotation Templates", "/quotation-templates"],
  ["Customers", "/customers"],
  ["Subscriptions", "/subscriptions"],
  ["Invoices", "/invoices"],
  ["Payments", "/payments"],
  ["Billing", "/billing"],
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === Role.CUSTOMER) redirect("/portal");

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="sidebar-brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>brightloop</span>
        </Link>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          {user.role === Role.ADMIN && <Link href="/staff">Staff</Link>}
        </nav>
        <div className="sidebar-bottom">Subscription operations</div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="topbar-name">{user.name}</span>
            <span className="role-label">{user.role}</span>
          </div>
          <LogoutButton />
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}