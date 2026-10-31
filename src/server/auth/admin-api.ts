import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { AuthorizationError } from "@/server/auth/guards";
import { AdminResourceNotFoundError } from "@/server/services/errors";
import { InvoiceTransitionError, ServiceValidationError, SubscriptionTransitionError } from "@/server/services/service-errors";

export function adminApiErrorResponse(error: unknown) {
  if (
    error instanceof Error
    && "digest" in error
    && error.digest === "HANGING_PROMISE_REJECTION"
  ) {
    throw error;
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AdminResourceNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ServiceValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof SubscriptionTransitionError || error instanceof InvoiceTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A record with the same unique value already exists." }, { status: 409 });
    }
    if (error.code === "P2003") {
      return NextResponse.json({ error: "This record is in use and cannot be deleted." }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "The requested record was not found." }, { status: 404 });
    }
  }

  console.error("Admin API request failed:", error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
