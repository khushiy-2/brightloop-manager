import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { StaffManager } from "@/components/staff/staff-manager";
import { getSession } from "@/server/auth/guards";

export default async function StaffPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== Role.ADMIN) redirect("/dashboard");
  return <StaffManager />;
}