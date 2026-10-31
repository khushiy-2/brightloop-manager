import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getSession } from "@/server/auth/guards";

export const instant = false;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/dashboard");

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <Link className="sidebar-brand" href="/portal">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>brightloop</span>
        </Link>
        <nav className="portal-nav" aria-label="Customer navigation">
          <Link href="/portal/subscriptions">My subscriptions</Link>
          <Link href="/portal/invoices">My invoices</Link>
        </nav>
        <div className="portal-user">
          <span className="topbar-name">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="portal-content">{children}</main>
    </div>
  );
}