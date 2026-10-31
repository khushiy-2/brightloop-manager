import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/session";
import { createCustomerAccount } from "@/server/services/auth";
import { signupSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  try {
    const user = await createCustomerAccount(parsed.data);
    await setSessionCookie({ userId: user.id, role: user.role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    throw error;
  }
}