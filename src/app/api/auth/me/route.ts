import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/server/auth/http";
import { requireUser } from "@/server/auth/guards";

export async function GET() {
  try {
    return NextResponse.json({ user: await requireUser() });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}