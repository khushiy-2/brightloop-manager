import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createPasswordReset } from "@/server/services/auth";

const genericResponse = { message: "If the email is associated with an account, a reset link will be sent." };

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    try {
      await createPasswordReset(parsed.data.email, new URL(request.url).origin);
    } catch (error) {
      console.error("Password reset request failed.", error);
    }
  }
  return NextResponse.json(genericResponse);
}