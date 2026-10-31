import { NextResponse } from "next/server";
import { AuthorizationError } from "@/server/auth/guards";

export function authorizationErrorResponse(error: unknown) {
  if (!(error instanceof AuthorizationError)) return null;
  return NextResponse.json({ error: error.message }, { status: error.status });
}

export function validationErrorResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}