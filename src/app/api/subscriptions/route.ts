import { NextResponse } from "next/server";
import { subscriptionInputSchema, subscriptionListQuerySchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { createSubscription, listSubscriptions } from "@/server/services/subscription.service";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const url = new URL(request.url);
    const query = subscriptionListQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      customerId: url.searchParams.get("customerId") ?? undefined,
      planId: url.searchParams.get("planId") ?? undefined,
    });
    if (!query.success) return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
    return NextResponse.json(await listSubscriptions(query.data));
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN", "STAFF");
    const parsed = subscriptionInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ subscription: await createSubscription(parsed.data, actor.id) }, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
