import { AuthForm } from "@/components/auth/auth-form";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <AuthForm mode="reset-password" initialToken={typeof token === "string" ? token : token?.[0] ?? ""} />;
}