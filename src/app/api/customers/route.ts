import { NextResponse } from "next/server";
import { customerInputSchema, pageQuerySchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { createCustomer, listCustomers } from "@/server/services/customer.service";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const url = new URL(request.url);
    const query = pageQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });
    if (!query.success) return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
    return NextResponse.json(await listCustomers(query.data.page, query.data.q));
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const parsed = customerInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ customer: await createCustomer(parsed.data) }, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
