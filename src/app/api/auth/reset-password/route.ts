import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetUserPassword } from "@/server/services/auth";

export async function POST(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const reset = await resetUserPassword(parsed.data.token, parsed.data.password);
  if (!reset) return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  return NextResponse.json({ message: "Password updated. You can now sign in." });
}