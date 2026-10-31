import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/session";
import { authenticateUser } from "@/server/services/auth";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const user = await authenticateUser(parsed.data);
  if (!user) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await setSessionCookie({ userId: user.id, role: user.role });
  return NextResponse.json({ user });
}